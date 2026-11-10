---
title: HTTP caching, compression, and content negotiation
tech: ASP.NET Core 10, HTTP
version: ASP.NET Core 10
date: 2026-11-09
covers: [8, 9]
---
# HTTP caching, compression, and content negotiation
[← Overview](00-overview.md)

## Why it matters
- The product catalog endpoint is hit 3,000 times per second by browsers that already have the data. One `ETag` and a 304 would save most of the bandwidth and CPU.
- A CDN caches `GET /me` without `Cache-Control: private`; users see each other's profiles.
- JSON responses of 2 MB go out uncompressed; mobile users wait seconds on every page.

## Concepts

### Cache-Control directives
| Directive | Meaning | Use for |
|:--|:--|:--|
| `max-age=N` | fresh for N seconds in any cache | public data |
| `s-maxage=N` | freshness for shared caches (CDN) only | CDN-specific TTL |
| `private` | only the browser may store it | per-user responses |
| `no-cache` | store, but revalidate before every use | HTML, data that must be current |
| `no-store` | never store | secrets, tokens, personal data |
| `immutable` | will never change at this URL | fingerprinted assets |
| `stale-while-revalidate=N` | serve stale for N s while refreshing | lists, feeds |
| `must-revalidate` | don't serve stale after expiry | |

### Validators and conditional requests
| Response header | Request header | Result if unchanged |
|:--|:--|:--|
| `ETag: "v42"` | `If-None-Match: "v42"` | `304 Not Modified`, empty body |
| `Last-Modified: <date>` | `If-Modified-Since: <date>` | `304` |
| `ETag` | `If-Match: "v42"` on PUT/PATCH | `412` if it changed (optimistic concurrency) |

A strong ETag can come from a row version (`rowversion` in SQL Server, see 03-backend/03-databases) or a hash of the response.

### Caching in ASP.NET Core: three different things
| Feature | What it does | When |
|:--|:--|:--|
| Setting `Cache-Control` / `ETag` yourself | tells browsers and CDNs how to cache | ⭐ always, for public reads |
| Response caching middleware (`AddResponseCaching`) | server-side cache that follows HTTP headers | rarely; mostly superseded |
| ⭐ Output caching (`AddOutputCache`) | server-side cache with policies, tags, eviction | hot server-rendered or API responses (03-backend/06-caching) |

### Compression and content negotiation
The client sends `Accept-Encoding: br, gzip, zstd`; the server picks one and replies with `Content-Encoding` and `Vary: Accept-Encoding`.

| Codec | Ratio | CPU | ASP.NET Core 10 |
|:--|:--|:--|:--|
| gzip | good | low | built in |
| Brotli (`br`) | better for text | higher at high levels | built in |
| zstd | very good, fast | low | not built in; do it at the CDN |

Rules:
- Compress text (JSON, HTML, CSS, JS, SVG). Don't compress images, video, or zips.
- Prefer compression at the CDN/proxy (Front Door) when one is in front; use the middleware when Kestrel faces clients or for internal hops that benefit.
- `EnableForHttps = true` has a BREACH risk when a response mixes secrets and attacker-controlled input. Don't compress such responses, or keep secrets out of compressed bodies.

`Accept` negotiation works the same way: the client says `Accept: application/json`, the server picks a representation. Minimal APIs return JSON; controllers can add XML formatters if you really need them.

## Example
`src/Shop.Api/Program.cs`
```csharp
using System.IO.Compression;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Net.Http.Headers;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddResponseCompression(o =>
{
    o.EnableForHttps = true;
    o.Providers.Add<BrotliCompressionProvider>();
    o.Providers.Add<GzipCompressionProvider>();
    o.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/problem+json"]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

var app = builder.Build();
app.UseResponseCompression();

var catalog = new { Version = 42, Items = Enumerable.Range(1, 500).Select(i => new { Id = i, Name = $"Coffee {i}" }) };

app.MapGet("/catalog", (HttpContext ctx) =>
{
    var etag = new EntityTagHeaderValue($"\"{catalog.Version}\"");
    if (ctx.Request.GetTypedHeaders().IfNoneMatch.Any(t => t.Compare(etag, useStrongComparison: false)))
        return Results.StatusCode(StatusCodes.Status304NotModified);

    var headers = ctx.Response.GetTypedHeaders();
    headers.ETag = etag;
    headers.CacheControl = new CacheControlHeaderValue { Public = true, MaxAge = TimeSpan.FromMinutes(5) };
    return Results.Ok(catalog);
});

app.MapGet("/me", (HttpContext ctx) =>
{
    ctx.Response.Headers.CacheControl = "private, no-store";
    return Results.Ok(new { Name = "Ada" });
});

app.Run();
```
`terminal`
```bash
curl -si localhost:5000/catalog -H 'Accept-Encoding: br' | grep -iE 'etag|content-encoding|cache-control'
curl -si localhost:5000/catalog -H 'If-None-Match: "42"' | head -1    # HTTP/1.1 304 Not Modified
```

## Production patterns
- Recipes: fingerprinted assets `public, max-age=31536000, immutable`; HTML `no-cache`; per-user JSON `private, no-store` or `private, no-cache`; public catalog `public, max-age=60, stale-while-revalidate=300`.
- Derive ETags from data versions, not from serializing the whole response on every request.
- Set `Vary` correctly (`Accept-Encoding`, `Origin`); a wrong `Vary` is how CDNs mix up responses.
- Let Front Door compress and cache public responses; keep the app's work for dynamic data.

## Mistakes
Wrong: no cache headers on personal data behind a CDN.
```csharp
app.MapGet("/me", () => user);     // CDN may cache it with default rules
```
Right:
```csharp
ctx.Response.Headers.CacheControl = "private, no-store";
```

Wrong: compressing already-compressed content (images, `.zip`) and wasting CPU.
Right: keep `MimeTypes` to text types.

## Check yourself
1. What is the difference between `no-cache` and `no-store`?
2. Which response code and body does a matching `If-None-Match` produce?
3. Why is `Vary: Accept-Encoding` required when compressing?

<details><summary>Answers</summary>

1. `no-cache` may store but must revalidate before use; `no-store` must not store at all.
2. `304 Not Modified` with no body.
3. So caches keep separate copies for compressed and uncompressed variants and don't send Brotli to a client that can't decode it.
</details>

## Sources
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111)
- [Response compression in ASP.NET Core](https://learn.microsoft.com/aspnet/core/performance/response-compression)
- [Output caching middleware](https://learn.microsoft.com/aspnet/core/performance/caching/output)
- [MDN — Cache-Control](https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control)
- [BREACH attack](https://www.breachattack.com/)
