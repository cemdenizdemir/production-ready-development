---
title: BenchmarkDotNet and .NET runtime performance
tech: BenchmarkDotNet, .NET 10 runtime, System.Text.Json
version: BenchmarkDotNet 0.15.x, .NET 10
date: 2026-11-09
covers: [3, 8]
---
# BenchmarkDotNet and .NET runtime performance
[← Overview](00-overview.md)

## Why it matters
- A "faster" price formatter was measured with `Stopwatch` in a Debug build, in a loop the JIT optimised away. In production it was slower.
- A product feed endpoint allocated 40 MB per request. Gen 2 garbage collections paused the API several times a minute, and p99 jumped to 2 s.
- Sync-over-async (`.Result`) in a hot path starved the thread pool under load, and every endpoint stalled.

## Concepts

### BenchmarkDotNet
| Item | Does |
|:--|:--|
| `[Benchmark]`, `[Benchmark(Baseline = true)]` | methods to measure; ratios against the baseline |
| ⭐ `[MemoryDiagnoser]` | allocated bytes per operation and GC counts |
| `[Params(10, 1000)]` / `[ParamsSource]` | run with different inputs |
| `[GlobalSetup]` / `[IterationSetup]` | prepare data outside the measurement |
| `[SimpleJob]`, `[ShortRunJob]` | how many runs and warm-ups |
| `[RankColumn]`, `[Orderer]` | readable results |
| `BenchmarkRunner.Run<T>()` / `BenchmarkSwitcher` | entry point; `--filter *Price*` |
| exporters | Markdown, JSON, CSV for CI comparison |

Avoid misleading results:
| Trap | Fix |
|:--|:--|
| ⭐ Debug build or debugger attached | `dotnet run -c Release`, no debugger (BenchmarkDotNet refuses Debug) |
| dead-code elimination | return the result from the benchmark method |
| setup inside the benchmark | move it to `[GlobalSetup]` |
| tiny inputs only | `[Params]` with realistic sizes |
| noisy machine | close other apps; compare ratios, not absolute times; CI runners are noisy |
| micro-wins that don't matter | benchmark only code a profile showed is hot |

### Where .NET time and memory go
| Topic | What to know | Tool |
|:--|:--|:--|
| ⭐ allocations | every allocation is future GC work; hot paths should allocate little | `[MemoryDiagnoser]`, `dotnet-counters` (allocation rate) |
| ⭐ GC | gen 0/1 cheap; gen 2 and LOH (objects ≥ 85 KB) expensive; ASP.NET Core uses Server GC; DATAS adapts heap size (.NET 9+) | `dotnet-counters`, `dotnet-gcdump` |
| ⭐ `Span<T>` / `ReadOnlySpan<T>` | slices of arrays, strings, or stack memory without copying | `AsSpan()`, `stackalloc` |
| ⭐ `ArrayPool<T>.Shared` | rent and return big buffers instead of allocating | `Rent(n)` / `Return(buf)` in `finally` |
| `string.Create`, interpolated string handlers | build strings with one allocation | |
| `StringBuilder` | many appends | reuse via pools if hot |
| `FrozenDictionary` / `FrozenSet` (.NET 8+) | read-only lookups, fastest reads | config tables |
| `SearchValues<T>` (.NET 8+) | fast "any of" searches | parsing |
| `System.Text.Json` source generation | no reflection, faster startup, trimming-safe | `JsonSerializerContext` |
| ⭐ async overhead | small, but sync-over-async (`.Result`, `.Wait()`) blocks threads and causes starvation | async all the way |
| `ValueTask` | avoids allocation when results are often synchronous | don't await twice |
| EF Core | `AsNoTracking`, projections, compiled queries, `AddDbContextPool` | 03-databases |
| Native AOT | fast startup, small memory; limits on reflection and EF Core | worth it for small functions/workers |

## Example
`perf/Shop.Benchmarks/SlugBenchmarks.cs`
```csharp
using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Running;

BenchmarkRunner.Run<SlugBenchmarks>();

[MemoryDiagnoser]
public class SlugBenchmarks
{
    [Params("Ethiopia Yirgacheffe Natural 250g", "A much longer product name with many words, accents like café, and numbers 1000g")]
    public string Name { get; set; } = "";

    [Benchmark(Baseline = true)]
    public string Naive() =>
        string.Join("-", Name.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries))
              .Replace(",", "").Replace(".", "");

    [Benchmark]
    public string SpanBased()
    {
        Span<char> buffer = Name.Length <= 256 ? stackalloc char[Name.Length] : new char[Name.Length];
        var length = 0;
        var lastDash = true;
        foreach (var c in Name)
        {
            if (char.IsLetterOrDigit(c)) { buffer[length++] = char.ToLowerInvariant(c); lastDash = false; }
            else if (!lastDash) { buffer[length++] = '-'; lastDash = true; }
        }
        if (length > 0 && buffer[length - 1] == '-') length--;
        return new string(buffer[..length]);   // one allocation: the result
    }
}
```
Run: `dotnet run -c Release --project perf/Shop.Benchmarks`. Read `Mean`, `Ratio`, `Allocated`, and `Gen0`. A 2× speed-up on code that takes 1% of request time is still only 0.5%.

Pooling a large buffer:
```csharp
var buffer = ArrayPool<byte>.Shared.Rent(64 * 1024);
try { var read = await stream.ReadAsync(buffer.AsMemory(0, 64 * 1024), ct); /* ... */ }
finally { ArrayPool<byte>.Shared.Return(buffer); }
```

JSON source generation for hot endpoints:
```csharp
[JsonSerializable(typeof(ProductDto[]))]
internal partial class ShopJson : JsonSerializerContext;

builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.TypeInfoResolverChain.Insert(0, ShopJson.Default));
```

## Production patterns
- Profile first (`dotnet-trace`, App Insights Profiler), benchmark the hot spot, change it, then load test the endpoint to prove the user-visible win.
- Watch allocation rate and gen 2 GC count per endpoint under load. Big drops in allocations usually matter more than CPU micro-tuning.
- Keep a `perf/` benchmark project for hot code; run it in CI on demand and compare against the main branch.
- No `.Result`/`.Wait()` anywhere. Microsoft.VisualStudio.Threading.Analyzers (`VSTHRD002` synchronous waits, `VSTHRD103` sync calls in async methods) and `CA2012` (misused `ValueTask`) catch common mistakes.

## Mistakes
Wrong:
```csharp
var sw = Stopwatch.StartNew();
for (var i = 0; i < 1000; i++) Slugify(name);   // Debug build, JIT warm-up included, result unused
Console.WriteLine(sw.ElapsedMilliseconds);
```
Right: BenchmarkDotNet in Release with `[MemoryDiagnoser]` and the result returned.

Wrong: `var data = client.GetStringAsync(url).Result;` in a controller.
Right: `await client.GetStringAsync(url, ct)`.

## Check yourself
1. Why does BenchmarkDotNet refuse to run Debug builds?
2. Why does reducing allocations improve p99 latency?
3. When is `Span<T>` worth the extra complexity?

<details><summary>Answers</summary>

1. Debug builds turn off JIT optimisations, so results don't reflect production. An attached debugger changes timing too.
2. Fewer allocations mean fewer and shorter garbage collections. GC pauses and the CPU they use hit random requests, which shows up in the tail (p99) rather than the median.
3. In code a profile shows is hot, such as parsing, formatting, or byte processing on every request. Elsewhere, simple readable code wins.
</details>

## Sources
- [BenchmarkDotNet — Good practices](https://benchmarkdotnet.org/articles/guides/good-practices.html)
- [Memory-related and span types (.NET)](https://learn.microsoft.com/dotnet/standard/memory-and-spans/)
- [Garbage collection fundamentals](https://learn.microsoft.com/dotnet/standard/garbage-collection/fundamentals)
- [DATAS (dynamic adaptation)](https://learn.microsoft.com/dotnet/standard/garbage-collection/performance#dynamic-adaptation-to-application-sizes-datas)
- [System.Text.Json source generation](https://learn.microsoft.com/dotnet/standard/serialization/system-text-json/source-generation)
- [Performance improvements in .NET 10 (Stephen Toub)](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-10/)
