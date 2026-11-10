---
title: Failure modes, timeouts, and retries
tech: ASP.NET Core 10, EF Core 10, StackExchange.Redis, Polly 8
version: ASP.NET Core 10, Polly 8.x
date: 2026-11-09
covers: [1, 2, 3]
---
# Failure modes, timeouts, and retries
[← Overview](00-overview.md)

## Why it matters
- The shipping-rates API starts taking 60 s per call. `HttpClient`'s default timeout is 100 s, so every checkout request waits, the thread pool and SQL connection pool fill up, and product pages fail too, even though they never call shipping.
- The payment provider returns 503 for 30 seconds. Three layers each retry 3 times, so every user request becomes 4 × 4 × 4 = 64 calls, and the provider stays down longer.
- A retried `POST /orders` creates two orders because the first attempt actually succeeded.

## Concepts

### Failure modes to design for
| Failure | What it looks like | Typical defence |
|:--|:--|:--|
| ⭐ slow dependency | latency climbs, requests pile up | timeouts, bulkheads, circuit breakers |
| failed dependency | errors, refused connections | retries (transient), fallbacks |
| ⭐ overload | queueing, rising p99, then errors everywhere | load shedding, autoscaling, backpressure |
| ⭐ bad deploy | new revision errors or crashes | health probes, canary/blue-green, fast rollback (04-shipping) |
| resource exhaustion | thread pool starvation, connection pool timeouts, memory | async everywhere, limits, pools sized on purpose |
| partial failure | one replica, one zone, one region | redundancy, readiness probes |
| data issues | poison messages, bad config | validation, dead-letter queues, config validation at startup |

A slow dependency is worse than a dead one: a dead dependency fails fast, but a slow one holds resources while it fails.

### Timeouts everywhere
Every network call needs a timeout that is shorter than the caller's timeout.
| Layer | Setting | Default | Shop value |
|:--|:--|:--|:--|
| client (browser) | `AbortSignal.timeout(ms)` | none | 15 s |
| Container Apps ingress | request timeout | 240 s (fixed) | can't change; keep requests short |
| ⭐ server (whole request) | request timeouts middleware: `AddRequestTimeouts`, `.WithRequestTimeout(...)` | none | 10 s |
| ⭐ outgoing HTTP | resilience handler total and attempt timeouts | 30 s total / 10 s attempt (standard handler); `HttpClient.Timeout` 100 s | 5 s total for partners |
| ⭐ SQL | EF Core `CommandTimeout`, SqlClient `Command Timeout` | 30 s | 5–15 s |
| SQL connect | `Connect Timeout` in the connection string | 15 s | 15 s |
| Redis | `ConnectTimeout`, `SyncTimeout`, `AsyncTimeout` | 5 s | 200–500 ms for cache reads |
| jobs | Hangfire `CancellationToken` + your own deadline | none | per job |

**Deadline propagation:** pass `HttpContext.RequestAborted` (or the endpoint's `CancellationToken`) to every async call. When the request times out or the client disconnects, the downstream work stops too.

### Retries
| Rule | Why |
|:--|:--|
| ⭐ retry only transient failures | 5xx, 408, 429, timeouts, connection resets. Never 400/401/403/404/409/422 |
| ⭐ retry only safe or idempotent operations | GET, PUT/DELETE by design, POST only with an idempotency key |
| ⭐ exponential backoff + jitter | spreads retries out so clients don't hit the server in sync |
| respect `Retry-After` | the server is telling you when to come back |
| retry at one layer only | retries multiply across layers |
| retry budget | cap retries as a share of traffic (for example 10%), so retries can't double the load during an outage |
| stop at the deadline | no retry after the caller has given up |

Polly 8 has no built-in "retry budget". Get close to one with few retries, a circuit breaker that opens when failures rise, and a total timeout.

## Example
`src/Shop.Api/Program.cs`
```csharp
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.EntityFrameworkCore;

builder.Services.AddRequestTimeouts(o =>
{
    o.DefaultPolicy = new RequestTimeoutPolicy { Timeout = TimeSpan.FromSeconds(10), TimeoutStatusCode = 504 };
    o.AddPolicy("reports", TimeSpan.FromSeconds(60));
});

builder.Services.AddDbContext<ShopDb>(o => o.UseSqlServer(
    builder.Configuration.GetConnectionString("Shop"),
    sql => sql.CommandTimeout(15).EnableRetryOnFailure(maxRetryCount: 3)));   // retries transient SQL errors only

var app = builder.Build();
app.UseRequestTimeouts();     // after UseRouting when routing is explicit

app.MapGet("/products/{id:long}", async (long id, ShopDb db, CancellationToken ct) =>
    await db.Products.FindAsync([id], ct) is { } p ? Results.Ok(p) : Results.NotFound());

app.MapGet("/reports/sales", (SalesReports r, CancellationToken ct) => r.BuildAsync(ct))
   .WithRequestTimeout("reports");
```
The request timeouts middleware doesn't throw. It cancels `HttpContext.RequestAborted`, so your code must pass the token down. The middleware is also skipped while a debugger is attached.

Redis with short timeouts, so a cache outage fails fast instead of slowing every request:
```csharp
var redis = ConfigurationOptions.Parse(builder.Configuration.GetConnectionString("Redis")!);
redis.ConnectTimeout = 2000; redis.SyncTimeout = 500; redis.AsyncTimeout = 500; redis.AbortOnConnectFail = false;
```

## Production patterns
- A **timeout budget** per request: client 15 s > ingress > server 10 s > outgoing calls 2–5 s each.
- Retries live in one place, the resilience handler for HTTP or `EnableRetryOnFailure` for SQL, never in a hand-written loop as well.
- POST calls to partners carry idempotency keys (07-background-jobs lesson 03), so retries are safe.
- Each failure mode in the table above has a named defence and a test (lesson 05).

## Mistakes
Wrong:
```csharp
for (var i = 0; i < 5; i++)
{
    try { return await http.PostAsJsonAsync("/charges", charge); }
    catch { await Task.Delay(1000); }      // retries 400s too, fixed delay, no jitter, no token
}
```
Right: the resilience handler with exponential backoff and jitter, `DisableForUnsafeHttpMethods()` or an idempotency key, and the request's `CancellationToken`.

Wrong: `db.Products.ToListAsync()` without passing `ct`.
Right: `ToListAsync(ct)`, so a cancelled request releases its SQL connection.

## Check yourself
1. Why is a slow dependency more dangerous than one that is down?
2. Why should timeouts get shorter as you go deeper into the call chain?
3. Which failures should never be retried?

<details><summary>Answers</summary>

1. A down dependency fails fast. A slow one holds threads, connections, and memory for the whole wait, so the backlog grows until healthy features fail too.
2. If an inner call can wait longer than its caller, the caller has already given up and the inner work is wasted, still holding resources. Shorter inner timeouts leave time to retry or fall back.
3. Permanent client errors (400, 401, 403, 404, 409, 422), validation failures, and non-idempotent operations without an idempotency key.
</details>

## Sources
- [Request timeouts middleware in ASP.NET Core](https://learn.microsoft.com/aspnet/core/performance/timeouts)
- [Connection resiliency (EF Core)](https://learn.microsoft.com/ef/core/miscellaneous/connection-resiliency)
- [StackExchange.Redis configuration](https://stackexchange.github.io/StackExchange.Redis/Configuration)
- [AWS Builders' Library — Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [Google SRE book — Handling overload](https://sre.google/sre-book/handling-overload/)
