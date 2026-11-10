---
title: Why background work, BackgroundService, Channels, and shutdown
tech: Microsoft.Extensions.Hosting, System.Threading.Channels
version: .NET 10
date: 2026-11-09
covers: [1, 2, 10]
---
# Why background work, BackgroundService, Channels, and shutdown
[← Overview](00-overview.md)

## Why it matters
- Checkout sends the confirmation email inline; when the email provider is slow, checkout takes 9 seconds and times out at Front Door.
- `_ = Task.Run(() => SendEmailAsync(order))` in an endpoint: the request scope disposes the `DbContext` mid-work, and every deploy silently drops queued emails.
- A worker loop ignores shutdown; each deploy kills it mid-batch, leaving half-processed records.

## Concepts

### What leaves the request path
| Move to background | Keep in the request |
|:--|:--|
| emails, SMS, push notifications | validation, the core state change (order saved) |
| calls to slow or flaky third parties (when the user needn't wait) | anything the response depends on |
| exports, reports, image processing | authorization decisions |
| webhooks to customers | idempotency recording |
| reconciliation, cleanup, scheduled tasks | |

The user gets `202 Accepted` or a fast success; the work happens reliably afterward.

### Choosing a mechanism
| Mechanism | Durable? | Scope | Use |
|:--|:--|:--|:--|
| `Task.Run` in a request | ✗ | lost on crash/deploy | never for real work |
| `BackgroundService` + `Channel<T>` | ✗ (in memory) | one instance | telemetry buffering, cache warming, best-effort work |
| `BackgroundService` polling the database | ✓ (DB is the queue) | all instances | outbox publishing, simple queue tables |
| ⭐ Hangfire | ✓ (SQL Server) | app cluster | emails, exports, retries, schedules |
| ⭐ Azure Service Bus | ✓ (broker) | across services | integration events, high-volume processing |

### BackgroundService + Channel
`Channel<T>` is an async producer/consumer queue. Bounded channels apply backpressure when full.
| Option | Meaning |
|:--|:--|
| `Channel.CreateBounded<T>(capacity)` | max items; `FullMode` = `Wait`, `DropOldest`, `DropNewest`, `DropWrite` |
| `Channel.CreateUnbounded<T>()` | no limit (memory risk) |
| `SingleReader = true` | optimization |
| `writer.TryWrite` / `WriteAsync` | produce |
| `await foreach (var x in reader.ReadAllAsync(ct))` | consume |

Inside a `BackgroundService`, create a **scope per item** (`IServiceScopeFactory`) to use scoped services like `DbContext`.

### Graceful shutdown and stalled work
- SIGTERM → `stoppingToken` cancelled → finish or abandon the current item → exit within `HostOptions.ShutdownTimeout` (01-language-runtime lesson 06).
- In-memory channel items are lost on shutdown: only put losable work there, or drain with a deadline.
- Durable systems handle crashes: Hangfire re-queues jobs whose worker disappeared (invisibility timeout / fetched-job recovery); Service Bus redelivers messages whose lock expired. Your job code must therefore be **idempotent** (lesson 03).
- Long jobs check the token regularly and save progress (checkpoints) so a restart resumes rather than restarts.

## Example
`src/Shop.Api/Background/ThumbnailQueue.cs`
```csharp
using System.Threading.Channels;

public sealed record ThumbnailRequest(Guid ProductId, string BlobName);

public sealed class ThumbnailQueue
{
    private readonly Channel<ThumbnailRequest> _channel =
        Channel.CreateBounded<ThumbnailRequest>(new BoundedChannelOptions(500) { FullMode = BoundedChannelFullMode.Wait, SingleReader = true });

    public ValueTask EnqueueAsync(ThumbnailRequest r, CancellationToken ct) => _channel.Writer.WriteAsync(r, ct);
    public IAsyncEnumerable<ThumbnailRequest> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

public sealed class ThumbnailWorker(ThumbnailQueue queue, IServiceScopeFactory scopes, ILogger<ThumbnailWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var req in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var images = scope.ServiceProvider.GetRequiredService<IImageService>();
                await images.CreateThumbnailAsync(req.BlobName, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                log.LogError(ex, "Thumbnail failed for {ProductId}", req.ProductId);   // best effort; a nightly job re-checks missing thumbnails
            }
        }
    }
}
```
`src/Shop.Api/Program.cs`
```csharp
builder.Services.AddSingleton<ThumbnailQueue>();
builder.Services.AddHostedService<ThumbnailWorker>();
builder.Services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromSeconds(20));
```

## Production patterns
- Anything that must happen goes to a durable queue (Hangfire or Service Bus), not a channel or `Task.Run`.
- Workers create a scope per item, honor `stoppingToken`, and catch per-item exceptions so one bad item doesn't stop the loop.
- Bounded channels everywhere; unbounded ones hide overload until memory runs out.
- A reconciliation job finds and repairs anything best-effort workers missed.

## Mistakes
Wrong:
```csharp
app.MapPost("/orders", async (CreateOrder c, ShopDb db, IEmailSender email) =>
{
    // ...save order...
    _ = Task.Run(() => email.SendConfirmationAsync(orderId));   // lost on restart, uses a disposed scope
});
```
Right: `jobs.Enqueue<OrderEmails>(x => x.SendConfirmationAsync(orderId, CancellationToken.None))` (lesson 02), or an outbox message (lesson 04).

## Check yourself
1. When is a `Channel<T>` an acceptable queue?
2. Why create a DI scope per item in a `BackgroundService`?
3. What happens to a Hangfire job if the server running it crashes?

<details><summary>Answers</summary>

1. For in-process work you can afford to lose on a crash or deploy (or can rebuild), such as telemetry buffering or best-effort thumbnails.
2. Background services are singletons; scoped services (`DbContext`) must live in a short scope per unit of work.
3. It's considered aborted and is picked up again by another worker after the fetch timeout, so it may run again (hence idempotency).
</details>

## Sources
- [Background tasks with hosted services](https://learn.microsoft.com/aspnet/core/fundamentals/host/hosted-services)
- [Channels in .NET](https://learn.microsoft.com/dotnet/core/extensions/channels)
- [Use scoped services within a BackgroundService](https://learn.microsoft.com/dotnet/core/extensions/scoped-service)
- [Queue-based load leveling pattern](https://learn.microsoft.com/azure/architecture/patterns/queue-based-load-leveling)
