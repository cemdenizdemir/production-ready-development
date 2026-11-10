---
title: Rate limits, idempotency, availability, security, and cost
tech: Redis 8, ASP.NET Core rate limiting, Azure Front Door, Azure SQL failover groups, C# 14
version: November 2026
date: 2026-11-09
covers: [8, 9, 11]
---
# Rate limits, idempotency, availability, security, and cost
[← Overview](00-overview.md)

## Why it matters
- A public price API had no limits. A competitor's scraper called it 2,000 times a second and the shop's checkout slowed for real customers.
- A mobile client retried `POST /orders` on flaky networks. Without idempotency keys, some customers had three identical orders.
- The design promised 99.99% availability, but the API depended in series on SQL, Redis, and a partner, each at 99.9%. The real ceiling was about 99.7%.

## Concepts

### Rate limiting at scale
| Algorithm | Behaviour | Use |
|:--|:--|:--|
| fixed window | N per window; bursts at window edges | simple quotas |
| ⭐ sliding window | smoother counts over a rolling window | per-user API limits |
| ⭐ token bucket | steady refill with burst capacity | APIs with bursty clients |
| leaky bucket | constant outflow | smoothing to a downstream limit |
| concurrency limit | max in flight | protect expensive endpoints |

| Where | Tool |
|:--|:--|
| edge | Front Door WAF rate-limit rules (per IP, geo, path) |
| app (per instance) | ASP.NET Core rate limiting middleware |
| app (global, many replicas) | Redis counters/Lua scripts shared by replicas |
| clients | `429` + `Retry-After`, documented quotas, API keys per partner |

### Idempotency and API design at scale
| Practice | How |
|:--|:--|
| ⭐ idempotency keys | client sends `Idempotency-Key`; server stores key → response for 24 h; repeat requests get the same response |
| ⭐ idempotent consumers | dedupe messages by ID (inbox) |
| ⭐ pagination | cursor/keyset for large lists; max page sizes |
| async APIs | `202 Accepted` + status URL for long work |
| versioning | additive changes; versioned paths or headers for breaking ones |
| bulk endpoints | batch operations with per-item results and limits |
| ETags / conditional requests | `If-None-Match` for caching; `If-Match` for optimistic concurrency |

### Availability and reliability
| Concept | Rule |
|:--|:--|
| ⭐ serial dependencies | availability multiplies: 0.999 × 0.999 × 0.999 ≈ 0.997 |
| ⭐ redundancy (parallel) | 1 − (1 − a)^n: two 99.9% replicas ≈ 99.9999% (if failures are independent) |
| ⭐ remove from the critical path | make non-essential dependencies optional (fallbacks, async) |
| failover | active-passive (failover groups, standby) or active-active (multi-region) |
| zones and regions | zone redundancy for most; multi-region for strict RTO/RPO or regulatory needs |
| ⭐ the nines | 99.9% ≈ 43 min/month; 99.95% ≈ 22 min; 99.99% ≈ 4.3 min |

### Security, privacy, and cost in designs
| Area | Design questions |
|:--|:--|
| ⭐ security | where's the trust boundary? authn/authz at every entry; least-privilege identities; private networking; secrets; WAF; abuse cases |
| ⭐ privacy | which personal data, where stored, who can see it, retention, deletion, regions (GDPR) |
| ⭐ cost | main cost drivers (compute, DB, egress, logs); cost per 1,000 orders; what scales with traffic vs fixed |
| threat model | STRIDE on the main data flows (01-foundations/06-security) |

## In our stack
- Rate limits: [03-backend/05-validation-abuse](../../../03-backend/05-validation-abuse/README.md).
- Idempotency keys and pagination: [03-backend/02-api-design](../../../03-backend/02-api-design/README.md).
- Redundancy, failover groups, DR: [04-shipping/05-data-safety](../../../04-shipping/05-data-safety/README.md), [03-backend/08-reliability](../../../03-backend/08-reliability/README.md).
- Security and threat modelling: [01-foundations/06-security](../../../01-foundations/06-security/README.md); cost: [04-shipping/02-cloud lesson 05](../../../04-shipping/02-cloud/docs/05-cost-logs.md).

## When not to
- Don't design for 99.99% and multi-region active-active when the business can tolerate an hour of downtime a month; the cost and complexity are large.
- Don't build global distributed rate limiting when Front Door rules and per-instance limits cover the abuse you see.
- Don't add idempotency keys to naturally idempotent operations (`PUT` with full state, `DELETE` by ID).

## Example
Availability of a request path (C# helper for design docs):
```csharp
public static class Availability
{
    public static double Serial(params double[] parts) => parts.Aggregate(1.0, (acc, a) => acc * a);
    public static double Parallel(double a, int replicas) => 1 - Math.Pow(1 - a, replicas);
    public static TimeSpan DowntimePerMonth(double a) => TimeSpan.FromMinutes((1 - a) * 30 * 24 * 60);
}

var checkout = Availability.Serial(
    0.9999,                                   // Front Door
    Availability.Parallel(0.999, 2),          // 2 API replicas (zone-redundant)
    0.9995,                                   // Azure SQL zone-redundant
    0.999);                                   // payment provider (can't avoid: on the critical path)
Console.WriteLine($"{checkout:P3}, ~{Availability.DowntimePerMonth(checkout).TotalMinutes:0} min/month");
// Redis isn't in the list: the cache fails open (03-backend/08-reliability), so it's off the critical path.
```
A Redis sliding-window limiter shared by all replicas (sorted set per client):
```csharp
public sealed class RedisSlidingWindow(IConnectionMultiplexer redis)
{
    private const string Script = """
        redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
        local count = redis.call('ZCARD', KEYS[1])
        if count < tonumber(ARGV[3]) then
          redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
          redis.call('PEXPIRE', KEYS[1], ARGV[2])
          return 1
        end
        return 0
        """;

    public async Task<bool> TryAcquireAsync(string client, int limit, TimeSpan window)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var result = await redis.GetDatabase().ScriptEvaluateAsync(Script,
            keys: [new RedisKey($"rl:{client}")],
            values: [now, (long)window.TotalMilliseconds, limit, $"{now}:{Guid.NewGuid():N}"]);
        return (int)result == 1;
    }
}
```
Idempotency key handling (sketch):
```text
POST /orders  Idempotency-Key: 6f1c...
 → look up key in IdempotencyKeys (SQL, unique) → found? return stored status + body
 → not found: insert key (status "in progress") in the same transaction as the order → store response → return
 → concurrent duplicate while in progress → 409 "request in progress"
```

## Production patterns
- Rate limits at the edge and in the app, per client, with `429` + `Retry-After`; partner quotas documented.
- Every non-idempotent write that clients may retry accepts an idempotency key; every consumer dedupes.
- Availability targets computed from the dependency chain; non-essential dependencies removed from the critical path; redundancy where the math says it matters.
- Each design names its trust boundaries, personal data, and main cost drivers.

## Mistakes
Wrong: promising 99.99% while depending in series on three 99.9% services.
Right: compute the chain; add redundancy, fallbacks, or adjust the target.

Wrong: storing idempotency keys in memory on one replica.
Right: a shared store (SQL or Redis) with a TTL, written atomically with the result.

## Check yourself
1. What's the availability of three 99.9% dependencies in series?
2. Why does a token bucket suit APIs with bursty clients?
3. What three non-functional areas should every design address besides scale?

<details><summary>Answers</summary>

1. About 99.7% (0.999³ ≈ 0.997), roughly 2 hours of downtime per month.
2. It allows short bursts up to the bucket size while enforcing an average rate through the refill, matching clients that send several requests at once and then pause.
3. Security (trust boundaries, auth, least privilege, abuse), privacy (personal data, retention, deletion, residency), and cost (main drivers and how they scale).
</details>

## Sources
- [Rate limiting pattern (Azure)](https://learn.microsoft.com/azure/architecture/patterns/rate-limiting-pattern)
- [Rate limiting middleware in ASP.NET Core](https://learn.microsoft.com/aspnet/core/performance/rate-limit)
- [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [IETF draft — Idempotency-Key header](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
- [Composite SLA (Azure Well-Architected)](https://learn.microsoft.com/azure/well-architected/reliability/metrics#composite-slo)
- [Front Door WAF rate limiting](https://learn.microsoft.com/azure/web-application-firewall/afds/waf-front-door-rate-limit)
