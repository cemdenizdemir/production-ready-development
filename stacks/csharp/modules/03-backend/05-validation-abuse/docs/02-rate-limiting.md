---
title: "Rate limiting: strategies, the middleware, and Redis"
tech: Microsoft.AspNetCore.RateLimiting, System.Threading.RateLimiting, StackExchange.Redis, Azure Front Door WAF
version: ASP.NET Core 10, StackExchange.Redis 2.x, Redis 8
date: 2026-11-09
covers: [5, 6, 7]
---
# Rate limiting: strategies, the middleware, and Redis
[← Overview](00-overview.md)

## Why it matters
- The login limit is "5 per minute per IP" in memory. With 6 replicas behind the ingress, attackers get 30 per minute, and every user behind a mobile carrier's NAT shares one IP.
- A partner's buggy integration loops on `GET /products`; the database is saturated and checkout slows for everyone.
- 429 responses have no `Retry-After`; clients retry immediately and the storm gets worse.

## Concepts

### What to limit, and by what key
| Endpoint class | Key | Example limit |
|:--|:--|:--|
| login, password reset, OTP | IP **and** account/email | 5/min per account, 20/min per IP |
| signup | IP, device fingerprint | 3/hour per IP |
| authenticated API | user id | 100/10 s token bucket |
| partner API | API key / client id | per contract (1,000/min) |
| expensive endpoints (search, reports, exports) | user id + concurrency | 2 concurrent |
| payment attempts | customer + card fingerprint + IP | 5/hour |
| public, cached reads | none in app (CDN/edge) | edge rules |

### Algorithms (System.Threading.RateLimiting)
| Limiter | Behavior | Good for |
|:--|:--|:--|
| fixed window | N per window; bursts at window edges | simple quotas |
| sliding window | window split into segments | smoother quotas |
| ⭐ token bucket | refill rate + burst size | general API traffic |
| concurrency | at most N in flight | expensive work |
| chained (`PartitionedRateLimiter.CreateChained`) | several at once | per-user AND global |

### The middleware
| API | Does |
|:--|:--|
| `AddRateLimiter(o => …)` + `UseRateLimiter()` | register + enable |
| `o.GlobalLimiter` | applies to every request |
| `o.AddPolicy("name", ctx => RateLimitPartition.Get…Limiter(key, _ => options))` | named partitioned policy |
| `AddFixedWindowLimiter("name", …)` etc. | simple non-partitioned policies |
| `.RequireRateLimiting("name")` / `.DisableRateLimiting()` | per endpoint/group |
| `o.RejectionStatusCode = 429` | default is 503 |
| `o.OnRejected` | set `Retry-After`, log, metrics |
| `QueueLimit` | queue requests instead of rejecting (usually 0 for APIs) |

### Distributed limits
In-memory limiters are per instance. Options for global limits:
| Option | Notes |
|:--|:--|
| ⭐ Redis counters / buckets | atomic Lua script (`INCR` + `EXPIRE` or token bucket); shared across replicas |
| RedisRateLimiting library | implements System.Threading.RateLimiting limiters on Redis (also seen) |
| Azure Front Door WAF rate limit rules | per IP/geo/path at the edge, before your app |
| Azure API Management | quotas per subscription key for partner APIs |

Fail-open vs fail-closed when Redis is down: usually fail open for general traffic (fall back to the in-memory limiter) and fail closed (or very strict local limits) for login/OTP.

### Telling clients
- `429 Too Many Requests` + `Retry-After: <seconds>`.
- Quota headers: draft standard `RateLimit-Policy` / `RateLimit`, or the common `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
- Document limits per endpoint class (01-foundations/08).

## Example
`src/Shop.Api/RateLimits/RedisFixedWindow.cs`
```csharp
using StackExchange.Redis;

public sealed class RedisFixedWindow(IConnectionMultiplexer redis)
{
    // atomic: increment, set TTL on first hit, return count and TTL
    private const string Script = """
        local c = redis.call('INCR', KEYS[1])
        if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
        return { c, redis.call('PTTL', KEYS[1]) }
        """;

    public async Task<(bool Allowed, TimeSpan RetryAfter)> HitAsync(string key, int limit, TimeSpan window)
    {
        var result = (RedisResult[])(await redis.GetDatabase().ScriptEvaluateAsync(Script,
            [new RedisKey($"rl:{key}")], [(long)window.TotalMilliseconds]))!;
        var count = (long)result[0];
        var ttl = TimeSpan.FromMilliseconds((long)result[1]);
        return (count <= limit, ttl);
    }
}
```
`src/Shop.Api/RateLimits/LoginRateLimitFilter.cs`
```csharp
public sealed class LoginRateLimitFilter(RedisFixedWindow limiter, ILogger<LoginRateLimitFilter> log) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var http = ctx.HttpContext;
        var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var email = ctx.Arguments.OfType<LoginRequest>().FirstOrDefault()?.Email.Trim().ToLowerInvariant() ?? "-";

        var perIp = await limiter.HitAsync($"login:ip:{ip}", 20, TimeSpan.FromMinutes(1));
        var perAccount = await limiter.HitAsync($"login:acct:{email}", 5, TimeSpan.FromMinutes(1));
        if (perIp.Allowed && perAccount.Allowed) return await next(ctx);

        var retry = perIp.Allowed ? perAccount.RetryAfter : perIp.RetryAfter;
        log.LogWarning("Login rate limited {Ip}", ip);
        http.Response.Headers.RetryAfter = Math.Ceiling(retry.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        return TypedResults.Problem(statusCode: 429, title: "Too many sign-in attempts. Try again in a minute.");
    }
}
```
`src/Shop.Api/Program.cs` (in-memory policies + Redis-backed login)
```csharp
builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(builder.Configuration.GetConnectionString("Redis")!));
builder.Services.AddSingleton<RedisFixedWindow>();

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("api", ctx => RateLimitPartition.GetTokenBucketLimiter(
        ctx.User.FindFirstValue("sub") ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new TokenBucketRateLimiterOptions { TokenLimit = 100, TokensPerPeriod = 50, ReplenishmentPeriod = TimeSpan.FromSeconds(10) }));
    o.AddPolicy("exports", ctx => RateLimitPartition.GetConcurrencyLimiter(
        ctx.User.FindFirstValue("sub") ?? "anon", _ => new ConcurrencyLimiterOptions { PermitLimit = 2 }));
    o.OnRejected = (c, _) =>
    {
        if (c.Lease.TryGetMetadata(MetadataName.RetryAfter, out var ra))
            c.HttpContext.Response.Headers.RetryAfter = ((int)ra.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        return ValueTask.CompletedTask;
    };
});

app.UseRateLimiter();
app.MapGroup("/api").RequireRateLimiting("api");
app.MapPost("/auth/login", Login).AddEndpointFilter<LoginRateLimitFilter>();
app.MapPost("/reports/export", StartExport).RequireRateLimiting("exports");
```

## Production patterns
- Keys match the threat: account + IP for credential endpoints, user for API usage, API key for partners.
- Global (Redis or edge) limits for anything security-relevant; in-memory limits as a cheap first layer.
- Always `429` + `Retry-After`; document limits; emit a metric per rejected policy.
- Forwarded headers configured first, or every request appears to come from the proxy (01-foundations/02).

## Mistakes
Wrong: per-IP limits only on login.
Right: per account as well (attackers rotate IPs) and per IP (attackers rotate accounts).

Wrong: in-memory limits as the only protection with many replicas.
Right: Redis or edge-level limits for global guarantees.

## Check yourself
1. Why does a 6-replica deployment weaken in-memory limits?
2. When would you fail closed if Redis is unavailable?
3. Which limiter type fits "at most 2 exports at a time per user"?

<details><summary>Answers</summary>

1. Each replica counts separately; with load balancing, a client can make up to 6× the limit.
2. For sensitive endpoints like login, OTP, and password reset, where being open is more dangerous than being briefly unavailable.
3. A concurrency limiter partitioned by user.
</details>

## Sources
- [Rate limiting middleware in ASP.NET Core](https://learn.microsoft.com/aspnet/core/performance/rate-limit)
- [System.Threading.RateLimiting](https://learn.microsoft.com/dotnet/api/system.threading.ratelimiting)
- [Redis — Rate limiting patterns](https://redis.io/learn/howtos/ratelimiting)
- [IETF draft — RateLimit header fields](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/)
- [Azure Front Door WAF rate limiting](https://learn.microsoft.com/azure/web-application-firewall/afds/waf-front-door-rate-limit)
