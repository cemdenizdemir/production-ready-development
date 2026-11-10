---
title: Exceptions, resource lifetimes, and memory
tech: C# 14, .NET 10 GC
version: .NET 10
date: 2026-11-09
covers: [10, 11]
---
# Exceptions, resource lifetimes, and memory
[← Overview](00-overview.md)

## Why it matters
- `catch (Exception ex) { throw ex; }` resets the stack trace; the production error points at the catch block instead of the real bug.
- A `SqlConnection` opened in a helper isn't disposed; the connection pool (100 by default) runs out at peak and every request waits 15 s.
- A static `Dictionary` used as a cache grows forever; the container hits its memory limit and is OOM-killed every few hours.

## Concepts

### Exceptions
| Exception | Means |
|:--|:--|
| `ArgumentException` / `ArgumentNullException` / `ArgumentOutOfRangeException` | caller passed bad input (bug in the caller) |
| `InvalidOperationException` | object is in the wrong state for this call |
| `NotSupportedException` | operation not supported |
| `OperationCanceledException` | cancellation requested |
| `TimeoutException` | operation took too long |
| `HttpRequestException` | HTTP call failed (`StatusCode` property) |
| `DbUpdateException` / `DbUpdateConcurrencyException` | EF Core save failed / concurrency conflict |
| your `DomainException` | business rule violated (mapped to 409/422) |

| Rule | Code |
|:--|:--|
| ⭐ rethrow preserving the stack | `throw;` (not `throw ex;`) |
| wrap with context | `throw new PaymentFailedException("…", ex);` (inner exception) |
| filters | `catch (HttpRequestException e) when (e.StatusCode == HttpStatusCode.TooManyRequests)` |
| guards | `ArgumentNullException.ThrowIfNull(x)`, `ArgumentOutOfRangeException.ThrowIfNegativeOrZero(n)` |
| catch where you can handle it | global handler maps the rest to Problem Details (03-backend/02-api-design) |
| don't use exceptions for expected outcomes | `TryParse`, `TryGetValue`, result types for validation |

Exceptions are relatively expensive (stack capture); fine for bugs and rare failures, wrong for normal control flow like "user not found".

### Resource lifetimes
`IDisposable.Dispose()` releases resources deterministically: connections, file handles, sockets, timers.
```csharp
await using var connection = new SqlConnection(cs);   // disposed at end of scope, even on exceptions
using var stream = File.OpenRead(path);
```
| Rule | Why |
|:--|:--|
| ⭐ `using` / `await using` for anything you create that's disposable | release on every path |
| don't dispose objects you didn't create (injected services) | the DI container owns them |
| `IAsyncDisposable` when cleanup does I/O | `await using` |
| `HttpClient`: don't create per call | sockets; use `IHttpClientFactory` |
| `DbContext`: one per request (scoped) | the container disposes it |
| finalizers | almost never; use `SafeHandle` for unmanaged handles |

### Memory and the garbage collector
| Concept | What to know |
|:--|:--|
| generations | gen0 (new, collected often), gen1, gen2 (long-lived, collected rarely) |
| Large Object Heap | objects ≥ 85,000 bytes; collected with gen2; avoid large temporary arrays (use `ArrayPool<T>`) |
| server GC | default for ASP.NET Core; one heap per core; DATAS (on by default since .NET 9) adapts heap count to load, good for containers |
| container limits | the GC respects cgroup limits (default hard limit ≈ 75% of the container memory) |
| allocation rate | the main driver of GC cost: fewer, smaller allocations in hot paths |
| leaks in managed code | objects kept reachable: static collections, event handlers not removed, unbounded caches, captured closures in singletons |

`Span<T>` basics: a view over contiguous memory (array, stack, native) without copying.
```csharp
ReadOnlySpan<char> sku = "COF-ETH-250".AsSpan();
var origin = sku.Slice(4, 3);                       // "ETH", no new string
```
`Span<T>` is a `ref struct`: it lives on the stack, can't be a field of a class or cross an `await` (use `Memory<T>` there).

## Example
`src/Shop.Infrastructure/Reports/CsvExporter.cs`
```csharp
using System.Buffers;
using System.Text;

public sealed class CsvExporter(ILogger<CsvExporter> log)
{
    public async Task ExportAsync(IAsyncEnumerable<OrderRow> rows, Stream output, CancellationToken ct)
    {
        await using var writer = new StreamWriter(output, Encoding.UTF8, bufferSize: 64 * 1024, leaveOpen: true);
        await writer.WriteLineAsync("id,placed_at,total,currency".AsMemory(), ct);

        var buffer = ArrayPool<char>.Shared.Rent(256);
        try
        {
            await foreach (var r in rows.WithCancellation(ct))
            {
                if (!r.TryFormat(buffer, out var written))
                    throw new InvalidOperationException($"Row {r.Id} doesn't fit the buffer.");
                await writer.WriteLineAsync(buffer.AsMemory(0, written), ct);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            log.LogInformation("CSV export cancelled by client");
            throw;                                           // preserve stack and semantics
        }
        finally
        {
            ArrayPool<char>.Shared.Return(buffer);
        }
    }
}
```
A bounded cache instead of a static dictionary:
```csharp
builder.Services.AddMemoryCache(o => o.SizeLimit = 10_000);   // entries must set Size; see 03-backend/06-caching
```

## Production patterns
- Throw specific exceptions with context; one global handler turns them into Problem Details and logs them once.
- `using`/`await using` everywhere you create disposables; never `new HttpClient()` per request.
- No unbounded static collections; caches have size limits and expirations.
- Measure allocations (dotnet-counters `gc-heap-size`, allocation profiling) before micro-optimizing; `Span<T>`/`ArrayPool<T>` for proven hot paths (03-backend/09-scalability).

## Mistakes
Wrong:
```csharp
catch (Exception ex) { _log.LogError(ex.Message); throw ex; }
```
Right:
```csharp
catch (PaymentGatewayException ex) when (ex.IsTransient) { _log.LogWarning(ex, "Payment gateway transient failure"); throw; }
```

Wrong: forgetting to unsubscribe from a long-lived event.
```csharp
_bus.OrderPlaced += OnPlaced;    // in a scoped service; the singleton bus now keeps every instance alive
```
Right: unsubscribe in `Dispose`, or use a weak/messaging pattern.

## Check yourself
1. What's the difference between `throw;` and `throw ex;`?
2. Which objects should you not dispose yourself?
3. Name two common causes of memory leaks in .NET services.

<details><summary>Answers</summary>

1. `throw;` rethrows the current exception with its original stack trace; `throw ex;` resets the trace to the current location.
2. Objects you got from dependency injection (the container disposes them) and anything you don't own.
3. Unbounded static collections/caches, event handlers never unsubscribed, long-lived objects capturing short-lived ones in closures, `HttpClient` misuse.
</details>

## Sources
- [Best practices for exceptions](https://learn.microsoft.com/dotnet/standard/exceptions/best-practices-for-exceptions)
- [Implement a Dispose method](https://learn.microsoft.com/dotnet/standard/garbage-collection/implementing-dispose)
- [Fundamentals of garbage collection](https://learn.microsoft.com/dotnet/standard/garbage-collection/fundamentals)
- [DATAS (dynamic adaptation)](https://learn.microsoft.com/dotnet/standard/garbage-collection/datas)
- [Memory\<T\> and Span\<T\> usage guidelines](https://learn.microsoft.com/dotnet/standard/memory-and-spans/memory-t-usage-guidelines)
