---
title: Output caching and HTTP caching for APIs
tech: ASP.NET Core output caching, Microsoft.AspNetCore.OutputCaching.StackExchangeRedis, HTTP caching
version: ASP.NET Core 10
date: 2026-11-09
covers: [8, 9]
---
# Output caching and HTTP caching for APIs
[← Overview](00-overview.md)

## Why it matters
- `GET /catalog?roast=light` is computed 400 times per second from the same data; caching the whole response would remove nearly all of that work.
- An output cache policy varies by nothing; `?page=2` returns page 1 for everyone.
- `GET /me/orders` gets `Cache-Control: public, max-age=60`; Front Door serves one customer's orders to another.

## Concepts

### Output caching middleware
Caches whole responses on the server (memory or Redis) and serves them without running the endpoint.
| Feature | API |
|:--|:--|
| register / enable | `AddOutputCache(...)`, `app.UseOutputCache()` (after `UseCors`, before endpoints) |
| ⭐ named policies | `o.AddPolicy("catalog", b => b.Expire(...).SetVaryByQuery(...).Tag("catalog"))` |
| per endpoint | `.CacheOutput("catalog")` / `[OutputCache(PolicyName = "catalog")]` |
| vary by | query keys, headers (`Accept-Language`), route values, custom values |
| ⭐ tags + eviction | `IOutputCacheStore.EvictByTagAsync("catalog", ct)` |
| locking | concurrent misses wait for one computation (default on) |
| ⭐ Redis store | `AddStackExchangeRedisOutputCache(...)` → shared across replicas |
| defaults | only 200 responses to GET/HEAD; not for authenticated requests or responses setting cookies |

Output cache vs HybridCache: output cache stores the serialized response (fastest, coarse); HybridCache stores data objects (flexible, reused by many endpoints).

### HTTP caching for APIs
| Response | Header |
|:--|:--|
| public catalog | `Cache-Control: public, max-age=60, stale-while-revalidate=300` + `ETag` |
| product detail | `public, max-age=300` + `ETag`; CDN purge or short TTL on change |
| ⭐ per-user data | `private, no-store` (or `private, no-cache` + ETag) |
| auth, tokens, checkout | `no-store` |
| conditional GET | `If-None-Match` → `304` (01-foundations/02 lesson 04) |
| CDN-specific TTL | `s-maxage` |
| `Vary` | `Accept-Encoding`, `Accept-Language` where responses differ |

ETags from data versions (`rowversion`, `UpdatedAt` ticks) are cheap to compute and make conditional requests nearly free.

## Example
`src/Shop.Api/Program.cs`
```csharp
builder.Services.AddStackExchangeRedisOutputCache(o =>
{
    o.Configuration = builder.Configuration.GetConnectionString("Redis");
    o.InstanceName = "shop-oc:";
});
builder.Services.AddOutputCache(o =>
{
    o.AddPolicy("catalog", b => b
        .Expire(TimeSpan.FromMinutes(5))
        .SetVaryByQuery("roast", "sort", "cursor", "limit")
        .SetVaryByHeader("Accept-Language")
        .Tag("catalog"));
});

var app = builder.Build();
app.UseCors("web");
app.UseAuthentication();
app.UseAuthorization();
app.UseOutputCache();

app.MapGet("/catalog", async ([AsParameters] CatalogQuery q, CatalogService catalog, HttpResponse res, CancellationToken ct) =>
{
    var page = await catalog.ListAsync(q, ct);
    res.Headers.CacheControl = "public, max-age=60, stale-while-revalidate=300";
    return TypedResults.Ok(page);
})
.CacheOutput("catalog")
.AllowAnonymous();

app.MapGet("/me/orders", (ClaimsPrincipal me, OrderQueries orders, HttpResponse res, CancellationToken ct) =>
{
    res.Headers.CacheControl = "private, no-store";
    return orders.ForCustomerAsync(me.GetCustomerId(), ct);
}).RequireAuthorization();
```
Eviction after a catalog change (lesson 02): `await outputCache.EvictByTagAsync("catalog", ct);`

## Production patterns
- Output cache for anonymous, hot, parameterized GETs (catalog, product pages' JSON), Redis-backed, tagged, with explicit vary rules.
- `Cache-Control` set deliberately on every response class; `private, no-store` for anything personal.
- Front Door caches public responses based on those headers; app-side tags and CDN purge on important changes.
- Never output-cache authenticated responses unless the cache key includes the user and you've reviewed it.

## Mistakes
Wrong: a policy without vary-by-query on a parameterized endpoint.
Right: `SetVaryByQuery(...)` listing every parameter that changes the response.

Wrong: `public` cache headers on personalized responses.
Right: `private, no-store`.

## Check yourself
1. What does the output cache store, compared with HybridCache?
2. Why use the Redis output cache store with several replicas?
3. Which `Cache-Control` value fits `/me/orders`?

<details><summary>Answers</summary>

1. The whole serialized HTTP response (status, headers, body) for an endpoint; HybridCache stores data objects your code reuses.
2. All replicas share entries and evictions; with in-memory stores, each replica has its own copy and eviction only affects one.
3. `private, no-store` (personal data; never in shared caches).
</details>

## Sources
- [Output caching middleware](https://learn.microsoft.com/aspnet/core/performance/caching/output)
- [Redis output cache store](https://learn.microsoft.com/aspnet/core/performance/caching/output#redis-cache)
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111)
- [Azure Front Door — Caching](https://learn.microsoft.com/azure/frontdoor/front-door-caching)
