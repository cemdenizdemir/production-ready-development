---
title: Kestrel, HTTP versions, and TLS
tech: ASP.NET Core 10 (Kestrel), HTTP/2, HTTP/3, TLS
version: ASP.NET Core 10
date: 2026-11-09
covers: [4, 5, 14]
---
# Kestrel, HTTP versions, and TLS
[← Overview](00-overview.md)

## Why it matters
- An upload endpoint fails at 30 MB with a confusing 413 because nobody knew Kestrel's default body limit.
- The app is deployed listening on `localhost:5000` inside a container; the ingress can't reach it.
- HSTS is enabled in Development; for a year the browser refuses plain `http://localhost` for every other project on that port.

## Concepts

### HTTP/1.1 vs HTTP/2 vs HTTP/3
| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|:--|:--|:--|:--|
| Transport | TCP | TCP | QUIC (UDP) |
| Requests per connection | one at a time | many, multiplexed | many, multiplexed |
| Head-of-line blocking | per connection | at TCP level | none between streams |
| Header compression | none | HPACK | QPACK |
| Negotiated by | — | ALPN in TLS (`h2`) | `Alt-Svc` header, then QUIC |
| Kestrel | on | on (needs TLS for browsers) | opt-in, needs `libmsquic` on Linux |

In production, Front Door or the Container Apps ingress usually terminates the client's HTTP/2 or HTTP/3; the hop to Kestrel is often HTTP/1.1 or h2c. gRPC needs HTTP/2 end to end.

### Kestrel endpoints
Ways to set where Kestrel listens, highest precedence last wins in practice:
| Setting | Example |
|:--|:--|
| `launchSettings.json` (local `dotnet run` only) | `"applicationUrl": "https://localhost:7043;http://localhost:5043"` |
| `ASPNETCORE_HTTP_PORTS` / `ASPNETCORE_HTTPS_PORTS` | `8080` (default in official container images) |
| `ASPNETCORE_URLS` | `http://+:8080` |
| `Kestrel:Endpoints` in configuration | per-endpoint protocols and certificates |
| `builder.WebHost.ConfigureKestrel(...)` in code | `ListenAnyIP(8080)` |

Inside a container, listen on all interfaces (`+` / `0.0.0.0`), not `localhost`.

### Kestrel limits worth knowing
| Limit | Default | Set via |
|:--|:--|:--|
| `MaxRequestBodySize` | 30,000,000 bytes (~28.6 MB) | `Limits.MaxRequestBodySize`, or per endpoint `[RequestSizeLimit]` / `.WithMetadata(new RequestSizeLimitAttribute(...))` |
| `KeepAliveTimeout` | 130 s | `Limits.KeepAliveTimeout` |
| `RequestHeadersTimeout` | 30 s | slowloris protection |
| `MaxRequestHeadersTotalSize` | 32 KB | big cookies hit this |
| `MaxRequestLineSize` | 8 KB | long query strings |
| `MaxConcurrentConnections` | unlimited | cap it if you must |
| `MinRequestBodyDataRate` | 240 bytes/s after 5 s grace | slow upload protection |
| `Http2.MaxStreamsPerConnection` | 100 | |

### HTTPS and TLS
- Development: `dotnet dev-certs https --trust` creates and trusts a localhost certificate.
- Production behind a proxy: TLS terminates at Front Door / ingress (managed certificates). Kestrel can still serve TLS on the internal hop if required.
- Production with Kestrel at the edge: load a certificate from Key Vault or a file via `Kestrel:Certificates:Default`.

`app.UseHttpsRedirection()` sends 307/308 from http to https. It needs to know the HTTPS port (`ASPNETCORE_HTTPS_PORTS` or forwarded headers); behind a TLS-terminating proxy, configure forwarded headers first (lesson 05) or it loops or does nothing.

`app.UseHsts()` adds `Strict-Transport-Security`. Only outside Development, because browsers cache it per host.

```csharp
builder.Services.AddHsts(o =>
{
    o.MaxAge = TimeSpan.FromDays(365);
    o.IncludeSubDomains = true;
    o.Preload = false;   // only once every subdomain is HTTPS forever
});
```

## Example
`src/Shop.Api/Program.cs`
```csharp
using Microsoft.AspNetCore.Mvc;                 // RequestSizeLimitAttribute
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(k =>
{
    k.Limits.MaxRequestBodySize = 10 * 1024 * 1024;      // 10 MB for the whole app
    k.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(130);
    k.ConfigureEndpointDefaults(l => l.Protocols = HttpProtocols.Http1AndHttp2);
});

builder.Services.AddHsts(o => o.MaxAge = TimeSpan.FromDays(365));
var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}
app.UseHttpsRedirection();

app.MapPost("/uploads", async (HttpRequest req) =>
{
    await using var file = File.Create(Path.GetTempFileName());
    await req.Body.CopyToAsync(file);
    return TypedResults.Accepted("/uploads/status");
}).WithMetadata(new RequestSizeLimitAttribute(50 * 1024 * 1024)); // this endpoint: 50 MB

app.Run();
```
`terminal`
```bash
curl -sI --http2 https://localhost:7043/ -k | head -1     # HTTP/2 200 (or 404)
curl -sI http://localhost:5043/ | grep -i location        # redirect to https
```

## Production patterns
- In containers, rely on `ASPNETCORE_HTTP_PORTS=8080` (the image default) and let the platform terminate TLS.
- Set body limits low globally and raise them per endpoint that needs it.
- HSTS with a long max-age only after every subdomain serves HTTPS; preload is a one-way door.
- Keep Kestrel's keep-alive longer than the proxy's idle timeout toward it (lesson 05).

## Mistakes
Wrong: HSTS and HTTPS redirection everywhere, including Development and behind a proxy without forwarded headers.
```csharp
app.UseHsts();
app.UseHttpsRedirection();
```
Right: `UseHsts()` only outside Development; configure forwarded headers before `UseHttpsRedirection()` when TLS ends at the proxy.

Wrong: `ASPNETCORE_URLS=http://localhost:8080` in a container.
Right: `http://+:8080` or `ASPNETCORE_HTTP_PORTS=8080`.

## Check yourself
1. What is Kestrel's default maximum request body size?
2. Why does a browser need TLS to use HTTP/2 with your server?
3. Why should `UseHsts()` not run in Development?

<details><summary>Answers</summary>

1. 30,000,000 bytes (about 28.6 MB).
2. Browsers only speak HTTP/2 over TLS; it is negotiated via ALPN during the handshake.
3. Browsers remember HSTS per host for `max-age`; localhost would then refuse plain HTTP for every app you run there.
</details>

## Sources
- [Kestrel — Endpoints](https://learn.microsoft.com/aspnet/core/fundamentals/servers/kestrel/endpoints)
- [Kestrel — Options and limits](https://learn.microsoft.com/aspnet/core/fundamentals/servers/kestrel/options)
- [Use HTTP/3 with Kestrel](https://learn.microsoft.com/aspnet/core/fundamentals/servers/kestrel/http3)
- [Enforce HTTPS in ASP.NET Core](https://learn.microsoft.com/aspnet/core/security/enforcing-ssl)
- [RFC 9113 — HTTP/2](https://www.rfc-editor.org/rfc/rfc9113) · [RFC 9114 — HTTP/3](https://www.rfc-editor.org/rfc/rfc9114)
