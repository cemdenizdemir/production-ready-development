---
title: Proxies, forwarded headers, timeouts, and keep-alive
tech: ASP.NET Core 10 (Kestrel), Azure Front Door, Azure Container Apps
version: ASP.NET Core 10
date: 2026-11-09
covers: [10, 11]
---
# Proxies, forwarded headers, timeouts, and keep-alive
[← Overview](00-overview.md)

## Why it matters
- Behind the Container Apps ingress, every request appears to come from the same internal IP. The rate limiter blocks all users at once.
- The OAuth callback URL is generated as `http://...` because the app thinks the request was HTTP; sign-in fails in production only.
- A report endpoint takes 5 minutes; the ingress kills it at 240 s, the client retries, and now two reports run.
- Random 502s at low traffic: the server closes idle connections before the proxy does, and the proxy reuses a dead socket.

## Concepts

### What a proxy changes
| Original value | Seen by Kestrel behind a proxy | Restored from |
|:--|:--|:--|
| client IP | proxy's IP | `X-Forwarded-For` (or `Forwarded: for=`) |
| scheme (`https`) | `http` (TLS ended at the proxy) | `X-Forwarded-Proto` |
| host | internal host name | `X-Forwarded-Host` (only if you trust it) |

Forwarded headers are just request headers: anyone can send them. Only trust them from known proxies.

### Forwarded Headers Middleware
```csharp
using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.ForwardLimit = 2;                                   // Front Door + ingress
    o.KnownIPNetworks.Add(IPNetwork.Parse("10.0.0.0/16")); // .NET 10; KnownNetworks is obsolete
});

var app = builder.Build();
app.UseForwardedHeaders();     // first, before anything that reads IP or scheme
```
- By default only loopback proxies are trusted; requests from other proxies keep their original values.
- `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` turns it on with "trust everything" defaults. Fine only when the app is unreachable except through the proxy (private ingress).
- After it runs: `ctx.Connection.RemoteIpAddress` is the client, `ctx.Request.Scheme` is `https`, and `UseHttpsRedirection`, auth redirects, and link generation work.

### Timeouts line up from the outside in
Each hop should time out a bit **before** the hop in front of it, so the inner one fails cleanly and the outer one doesn't retry a request that is still running.

| Hop | Default / limit | Set in |
|:--|:--|:--|
| Browser / Next.js `fetch` | none by default | `AbortSignal.timeout(...)` |
| Azure Front Door origin response timeout | 60 s (configurable 16–240 s) | origin group settings |
| Container Apps ingress | 240 s, fixed | — |
| ⭐ ASP.NET Core request timeout | none by default | `AddRequestTimeouts()` + `.WithRequestTimeout(...)` |
| `HttpClient.Timeout` (outgoing) | 100 s | per client, usually much lower |
| SQL command timeout | 30 s | connection string / EF Core `CommandTimeout` |

Requests longer than the shortest outer limit should become async jobs: return `202 Accepted` with a status URL (03-backend/07-background-jobs).

### Keep-alive
Idle connections are reused. The side that closes an idle connection first can race with the other side sending a request on it.

- The proxy → Kestrel hop: Kestrel's `KeepAliveTimeout` (130 s) should be **longer** than the proxy's idle timeout toward the app, so the proxy always closes first.
- Kestrel → downstream (`HttpClient`): `SocketsHttpHandler.PooledConnectionIdleTimeout` (default 1 min) should be shorter than the downstream server's keep-alive; `PooledConnectionLifetime` (e.g. 5 min) makes DNS changes take effect.

## Example
`src/Shop.Api/Program.cs`
```csharp
using System.Net;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Add(IPNetwork.Parse("10.0.0.0/16"));
});

builder.Services.AddRequestTimeouts(o =>
{
    o.DefaultPolicy = new RequestTimeoutPolicy { Timeout = TimeSpan.FromSeconds(30) };
    o.AddPolicy("reports", TimeSpan.FromSeconds(120));
});

builder.Services.AddHttpClient("payments", c =>
{
    c.BaseAddress = new Uri("https://api.payments.test");
    c.Timeout = TimeSpan.FromSeconds(10);
});

var app = builder.Build();
app.UseForwardedHeaders();
app.UseRequestTimeouts();

app.MapGet("/whoami", (HttpContext ctx) => new
{
    ip = ctx.Connection.RemoteIpAddress?.ToString(),
    scheme = ctx.Request.Scheme,
});

app.MapGet("/reports/daily", async (CancellationToken ct) =>
{
    await Task.Delay(TimeSpan.FromSeconds(5), ct);   // ct fires when the timeout hits
    return TypedResults.Ok("done");
}).WithRequestTimeout("reports");

app.Run();
```
`terminal`
```bash
curl -s localhost:5000/whoami -H 'X-Forwarded-For: 203.0.113.7' -H 'X-Forwarded-Proto: https'
# from loopback (trusted by default): {"ip":"203.0.113.7","scheme":"https"}
```

## Production patterns
- `UseForwardedHeaders()` is the first middleware. Trust only the proxy networks you run.
- Every outgoing call has a timeout, and every handler passes the request's `CancellationToken` down to EF Core and `HttpClient`.
- Request timeouts don't fire while a debugger is attached; test them without one.
- Anything that may run longer than ~30 s becomes a background job with a status resource.

## Mistakes
Wrong: trusting every forwarded header on a publicly reachable app.
```csharp
o.KnownIPNetworks.Clear(); o.KnownProxies.Clear();   // anyone can spoof their IP
```
Right: list your proxy's networks, or make the app reachable only through the proxy.

Wrong: ignoring the cancellation token.
```csharp
app.MapGet("/r", async () => await db.Reports.ToListAsync());
```
Right:
```csharp
app.MapGet("/r", async (ShopDb db, CancellationToken ct) => await db.Reports.ToListAsync(ct));
```

## Check yourself
1. Why must `UseForwardedHeaders()` come before authentication and HTTPS redirection?
2. The ingress allows 240 s and your handler has no timeout. What happens to a 300 s request?
3. Which side should close an idle connection first between a proxy and Kestrel?

<details><summary>Answers</summary>

1. Those middlewares read the scheme and client IP; they must see the restored values.
2. The ingress returns an error at 240 s while your code keeps running (and the client may retry, doubling the work).
3. The proxy. Kestrel's keep-alive should be longer than the proxy's idle timeout.
</details>

## Sources
- [Configure ASP.NET Core to work with proxy servers and load balancers](https://learn.microsoft.com/aspnet/core/host-and-deploy/proxy-load-balancer)
- [ForwardedHeadersOptions.KnownIPNetworks](https://learn.microsoft.com/dotnet/api/microsoft.aspnetcore.builder.forwardedheadersoptions)
- [Request timeouts middleware](https://learn.microsoft.com/aspnet/core/performance/timeouts)
- [Ingress in Azure Container Apps](https://learn.microsoft.com/azure/container-apps/ingress-overview)
- [Azure Front Door — origin timeout](https://learn.microsoft.com/azure/frontdoor/troubleshoot-issues)
