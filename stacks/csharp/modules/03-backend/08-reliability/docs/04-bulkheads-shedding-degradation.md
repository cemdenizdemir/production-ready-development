---
title: Bulkheads, load shedding, degradation, and dependency outages
tech: ASP.NET Core rate limiting, Polly 8, Microsoft.FeatureManagement, HybridCache, EF Core 10
version: ASP.NET Core 10, Polly 8.x, Microsoft.FeatureManagement.AspNetCore 4.x
date: 2026-11-09
covers: [9, 10, 11, 13]
---
# Bulkheads, load shedding, degradation, and dependency outages
[← Overview](00-overview.md)

## Why it matters
- Report exports and checkout share one SQL connection pool. A heavy export run uses all 100 connections, and checkout times out.
- A flash sale doubles traffic. With no limit, every request queues, p99 goes to 30 s, and the shop serves nothing. Shedding 20% with a fast 503 would have kept 80% of users happy.
- The recommendations service is down, so the product page returns 500, even though the page works fine without recommendations.

## Concepts

### Bulkheads: isolate so one failure can't sink everything
| Resource | Bulkhead | .NET tool |
|:--|:--|:--|
| ⭐ outgoing calls per dependency | concurrency limit per client | standard handler rate limiter (`RateLimiter` options) or `AddConcurrencyLimiter(permits, queue)` |
| background work | separate queues, workers, containers | Hangfire queues and servers (07-background-jobs) |
| SQL connections | separate pools per workload | different connection strings (`Application Name=Shop.Reports;Max Pool Size=20`) |
| ⭐ endpoints | concurrency limits on expensive routes | rate limiting middleware policies |
| deployment | separate apps for API and workers | two Container Apps from one image |

### Load shedding and backpressure
When demand exceeds capacity, reject the excess **early and cheaply** rather than queueing everything.
| Technique | How | Response |
|:--|:--|:--|
| ⭐ global concurrency limit | `RateLimiterOptions.GlobalLimiter` with `ConcurrencyLimiter` | 503 + `Retry-After` |
| per-client limits | partitioned limiter by user, API key, or IP (02-api-design) | 429 + `Retry-After` |
| bounded queues | `Channel.CreateBounded`, limiter `QueueLimit` | reject when full |
| priority | shed anonymous browsing before checkout | separate policies |
| Kestrel limits | `MaxConcurrentConnections`, `MaxRequestBodySize` | connection refused / 413 |
| autoscaling | more replicas on CPU, concurrency, or queue length | slower than shedding; both together |

Clients cooperate: retry with backoff and honour `Retry-After` (the frontend's TanStack Query retry settings, 02-frontend).

### Graceful degradation and fallbacks
| Fallback | Example |
|:--|:--|
| ⭐ stale data | last-known-good shipping rates from a long-TTL copy |
| ⭐ defaults | flat-rate shipping when the rates API is down |
| partial response | product page without the recommendations block; `"recommendations": null` |
| ⭐ kill switch | feature flag turns off a broken or expensive feature without a deploy |
| queue for later | accept the order, send the confirmation email later |
| read-only mode | browse works, writes return 503 during a database incident |

Feature flags: Microsoft.FeatureManagement (`IFeatureManager.IsEnabledAsync("Recommendations")`, `[FeatureGate]` for controllers, `.WithFeatureGate(...)` for Minimal APIs in Microsoft.FeatureManagement.AspNetCore 4.x), backed by Azure App Configuration in the cloud so flags change at runtime.

### Dependency outages
| Dependency down | Plan |
|:--|:--|
| ⭐ Azure SQL failover | failover groups with a listener endpoint; `EnableRetryOnFailure`; short outage (seconds) is normal; writes fail and must be retryable |
| ⭐ Redis | cache fails open: treat errors as misses, short timeouts, `AbortOnConnectFail = false`; watch SQL load as it rises |
| payment provider | circuit breaker → "payments temporarily unavailable"; keep the cart; never fake success |
| email provider | jobs retry later (Hangfire); users don't wait |
| Service Bus | outbox keeps events in SQL until the broker is back (07-background-jobs) |
| identity provider | existing sessions keep working until their tokens expire |

## Example
`src/Shop.Api/Program.cs` (global shedding)
```csharp
using System.Threading.RateLimiting;

builder.Services.AddRateLimiter(o =>
{
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(_ =>
        RateLimitPartition.GetConcurrencyLimiter("global", _ => new ConcurrencyLimiterOptions
        {
            PermitLimit = 400, QueueLimit = 100, QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
        }));
    o.RejectionStatusCode = StatusCodes.Status503ServiceUnavailable;
    o.OnRejected = (ctx, _) =>
    {
        ctx.HttpContext.Response.Headers.RetryAfter = "5";
        return ValueTask.CompletedTask;
    };
});
app.UseRateLimiter();
```
Limits are per replica: 400 concurrent requests on each one. Set them from load tests (09-scalability), not guesses.

`src/Shop.Application/Shipping/ShippingRates.cs` (fallback chain)
```csharp
using Microsoft.Extensions.Caching.Hybrid;
using Polly.CircuitBreaker;
using Polly.Timeout;

public sealed class ShippingRates(ShippingClient client, HybridCache cache, ILogger<ShippingRates> log)
{
    private static readonly HybridCacheEntryOptions LastGood = new() { Expiration = TimeSpan.FromDays(1) };
    private static readonly HybridCacheEntryOptions ReadOnly = new() { Flags = HybridCacheEntryFlags.DisableUnderlyingData };

    public async Task<RatesResult> GetAsync(QuoteRequest req, CancellationToken ct)
    {
        var key = $"shipping:last-good:{req.Country}:{req.WeightBand}";
        try
        {
            var quotes = await client.GetQuotesAsync(req, ct);
            await cache.SetAsync(key, quotes, LastGood, cancellationToken: ct);
            return RatesResult.Live(quotes);
        }
        catch (Exception ex) when (ex is BrokenCircuitException or HttpRequestException or TimeoutRejectedException)
        {
            log.LogWarning(ex, "Shipping rates unavailable; using fallback");
            var stale = await cache.GetOrCreateAsync<ShippingQuote[]?>(key,
                _ => ValueTask.FromResult<ShippingQuote[]?>(null), ReadOnly, cancellationToken: ct);   // cache read only
            return stale is { Length: > 0 } ? RatesResult.Stale(stale) : RatesResult.FlatRate(49.90m);
        }
    }
}
```
The response tells the UI which kind of answer it got (`live`, `stale`, `flat-rate`), so the checkout can show "estimated shipping".

Kill switch on an endpoint:
```csharp
app.MapGet("/products/{id:long}/recommendations", GetRecommendations).WithFeatureGate("Recommendations");   // 404 when off
```

## Production patterns
- Expensive or risky work runs in its own bulkhead: its own client limit, queue, pool, or container.
- One global concurrency limit per replica, set from load tests, returning fast 503s with `Retry-After`.
- Every non-critical dependency has a written fallback, and the response says when it is degraded.
- Feature flags for risky features, with an owner and a removal date.
- A written plan per dependency outage, linked from the runbook (04-shipping/06-incident-response).

## Mistakes
Wrong: an unbounded queue in front of a slow dependency ("we'll get to it").
Right: bounded queues and limits that reject early; memory and latency stay flat.

Wrong: a fallback that hides failure, such as returning "payment succeeded" when the provider is down.
Right: fall back only where a degraded answer is honest (stale rates, no recommendations). For payments, fail clearly.

## Check yourself
1. What is a bulkhead, and what is one example in the shop?
2. Why reject requests with 503 instead of letting them queue?
3. Which dependencies should fail open, and which must fail closed?

<details><summary>Answers</summary>

1. An isolation boundary that limits how much of a shared resource one workload can use, so its failure can't exhaust the rest. Examples: a separate SQL pool for reports, a concurrency limit on the shipping client, Hangfire's `low` queue on its own server.
2. Queued requests consume memory and connections, and they get slow anyway. A fast rejection keeps latency low for the requests you do serve and tells clients to come back later.
3. Fail open: caches, recommendations, analytics, non-critical enrichment. Fail closed: payments, authorization, stock reservation, anything where a wrong answer costs money or security.
</details>

## Sources
- [Bulkhead pattern (Azure Architecture Center)](https://learn.microsoft.com/azure/architecture/patterns/bulkhead)
- [Rate limiting middleware in ASP.NET Core](https://learn.microsoft.com/aspnet/core/performance/rate-limit)
- [Feature management in .NET](https://learn.microsoft.com/azure/azure-app-configuration/feature-management-dotnet-reference)
- [Azure SQL failover groups](https://learn.microsoft.com/azure/azure-sql/database/failover-group-sql-db)
- [Google SRE book — Handling overload](https://sre.google/sre-book/handling-overload/)
