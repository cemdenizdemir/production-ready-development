---
title: Security headers and rate limiting
tech: NetEscapades.AspNetCore.SecurityHeaders, ASP.NET Core rate limiting middleware
version: NetEscapades.AspNetCore.SecurityHeaders 1.3.x, ASP.NET Core 10
date: 2026-11-09
covers: [7, 8]
---
# Security headers and rate limiting
[← Overview](00-overview.md)

## Why it matters
- A pentest report lists 9 "missing header" findings; each one is a one-line fix nobody made.
- The login endpoint accepts unlimited attempts; a credential-stuffing botnet tries 2 million passwords overnight.
- A rate limit keyed on IP blocks every user behind the corporate NAT of the company's biggest customer.

## Concepts

### Security headers for an API
| Header | Value for a JSON API | Prevents |
|:--|:--|:--|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | downgrade to HTTP |
| `X-Content-Type-Options` | `nosniff` | browsers guessing content types |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` | the API being rendered or framed |
| `X-Frame-Options` | `DENY` | clickjacking (legacy browsers) |
| `Referrer-Policy` | `no-referrer` or `strict-origin-when-cross-origin` | leaking URLs |
| `Cross-Origin-Resource-Policy` | `same-site` | other sites embedding responses |
| `Permissions-Policy` | disable features (camera, geolocation…) | feature abuse |
| `Cache-Control` | `no-store` on sensitive responses | cached personal data |
| `Server` | removed (`AddServerHeader = false`) | fingerprinting |

HSTS and HTTPS redirection come from ASP.NET Core itself (`UseHsts`, `UseHttpsRedirection`, see 02-http-networking). The other headers come from NetEscapades.AspNetCore.SecurityHeaders (or Front Door rules at the edge).

```csharp
builder.Services.AddSecurityHeaderPolicies()
    .SetDefaultPolicy(p => p.AddDefaultApiSecurityHeaders());
// ...
app.UseSecurityHeaders();
```
Add or override individual headers on the policy (`AddContentSecurityPolicy(...)`, `AddCustomHeader(...)`, `RemoveServerHeader()`) when the defaults don't fit; check the package README for the current builder methods.
`AddDefaultApiSecurityHeaders()` sets the API-appropriate set (nosniff, frame denial, `default-src 'none'` CSP, referrer policy, removes `Server`). Use `AddDefaultSecurityHeaders()` for apps that serve HTML, then add a real CSP.

### Rate limiting in ASP.NET Core
`Microsoft.AspNetCore.RateLimiting` (built in since .NET 7):
| Limiter | How it works | Good for |
|:--|:--|:--|
| fixed window | N permits per window | simple quotas |
| sliding window | window split in segments | smoother than fixed |
| ⭐ token bucket | tokens refill at a rate; allows bursts | APIs |
| concurrency | at most N in flight | expensive endpoints |

Partition by what you are protecting: authenticated user id for general API use, IP **plus** username for login attempts, API key for partners. Combine a global limiter with per-endpoint policies.

The built-in limiters are **per instance** (in memory). With three instances, the effective limit triples. Distributed limits need Redis (03-backend/05-validation-abuse) or the edge (Front Door WAF rate-limit rules).

Brute-force protection for login has several layers: rate limit per IP and per account, ASP.NET Core Identity lockout (`MaxFailedAccessAttempts`), MFA, breached-password checks, and alerts on spikes (03-backend/04-auth).

## Example
`src/Shop.Api/Program.cs`
```csharp
using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSecurityHeaderPolicies()
    .SetDefaultPolicy(p => p.AddDefaultApiSecurityHeaders());

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // every request: per user if logged in, else per IP
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
    {
        var key = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetTokenBucketLimiter(key, _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = 100,
            TokensPerPeriod = 50,
            ReplenishmentPeriod = TimeSpan.FromSeconds(10),
            QueueLimit = 0,
        });
    });

    // login: strict, per IP
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    o.OnRejected = (ctx, _) =>
    {
        if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            ctx.HttpContext.Response.Headers.RetryAfter =
                ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        return ValueTask.CompletedTask;
    };
});

var app = builder.Build();
app.UseForwardedHeaders();          // real client IPs first (02-http-networking lesson 05)
app.UseSecurityHeaders();
app.UseRateLimiter();

app.MapPost("/auth/login", () => Results.Ok()).RequireRateLimiting("login");
app.MapGet("/catalog", () => Results.Ok()).DisableRateLimiting();      // cached, public

app.Run();
```
`terminal`
```bash
for i in $(seq 1 7); do curl -s -o /dev/null -w '%{http_code} ' -X POST localhost:5000/auth/login; done
# 200 200 200 200 200 429 429
curl -sI localhost:5000/catalog | grep -iE 'x-content-type|content-security|referrer'
```

## Production patterns
- `UseForwardedHeaders` before the rate limiter, or every user shares the proxy's IP.
- Keep per-instance limits conservative and add distributed or edge limits for anything that matters (login, signup, SMS, payments).
- Send `Retry-After` with 429 so well-behaved clients back off.
- Check headers in an integration test (`response.Headers.Contains("X-Content-Type-Options")`) so they don't silently disappear.

## Mistakes
Wrong: one global IP-based limit for everything.
Right: per user for authenticated traffic, IP+username for login, separate stricter policies for costly endpoints.

Wrong: rate limiter registered before forwarded headers.
```csharp
app.UseRateLimiter();
app.UseForwardedHeaders();
```
Right: forwarded headers first.

## Check yourself
1. Why does an API send `Content-Security-Policy: default-src 'none'`?
2. Three instances each allow 5 logins per minute per IP. What is the real limit?
3. Which limiter allows short bursts while enforcing an average rate?

<details><summary>Answers</summary>

1. The API never serves pages; if a response is ever rendered as HTML, nothing in it may load or execute, and it can't be framed.
2. Up to 15 per minute, depending on load balancing; built-in limiters are per instance.
3. Token bucket.
</details>

## Sources
- [NetEscapades.AspNetCore.SecurityHeaders](https://github.com/andrewlock/NetEscapades.AspNetCore.SecurityHeaders)
- [Andrew Lock — SecurityHeaders 1.0 released](https://andrewlock.net/netescapades-aspnetcore-securityheaders-1-0-0-released)
- [Rate limiting middleware in ASP.NET Core](https://learn.microsoft.com/aspnet/core/performance/rate-limit)
- [OWASP — HTTP Security Response Headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [Azure Front Door WAF rate limiting](https://learn.microsoft.com/azure/web-application-firewall/afds/waf-front-door-rate-limit)
