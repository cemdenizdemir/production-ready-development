---
title: Where to cache, cache-aside, and the .NET caching APIs
tech: HybridCache, IMemoryCache, IDistributedCache, StackExchange.Redis
version: Microsoft.Extensions.Caching.Hybrid 10.x, Redis 8
date: 2026-11-09
covers: [1, 2, 3]
---
# Where to cache, cache-aside, and the .NET caching APIs
[← Overview](00-overview.md)

## Why it matters
- The product page runs six SQL queries per view; at 2,000 views per second the database maxes out, even though products change twice a day.
- Each of six replicas keeps a 1.5 GB `IMemoryCache` copy of the catalog; containers are OOM-killed and caches disagree with each other.
- A per-user dashboard is cached under the key `dashboard`; every user sees the first user's numbers.

## Concepts

### Where caches live
| Layer | Caches | Good for | Watch out |
|:--|:--|:--|:--|
| browser | HTTP responses, assets | static assets, public data | can't purge; personal data must be `private` |
| CDN (Front Door) | public responses | assets, public catalog | keys, purges |
| output cache | whole HTTP responses in the app | anonymous, hot GET endpoints | personalization, vary rules |
| ⭐ application L1 (memory) | objects per instance | tiny, very hot, rarely changing data | per instance, memory |
| ⭐ application L2 (Redis) | shared computed results | data shared by all instances | network hop, eviction |
| database | buffer pool, indexed views | repeated queries | |

What to cache: expensive, frequently read, rarely changing data (catalog, prices, reference data, slow external API results, aggregates). What not to: data that must be exact at that moment (stock at checkout, balances), per-user data under shared keys, data you can't rebuild.

### Cache-aside
1. Try the cache. 2. Hit → return. 3. Miss → load from the source, store with an expiration, return. 4. On write → update the source, then remove the cache entry.
The application owns the logic; an empty cache never breaks correctness.

### The .NET caching APIs
| API | What | Use |
|:--|:--|:--|
| `IMemoryCache` | in-process cache | small local lookups; set `SizeLimit` and entry sizes |
| `IDistributedCache` | byte[] get/set on Redis/SQL | low-level; you serialize, no stampede protection |
| ⭐ `HybridCache` | L1 memory + L2 `IDistributedCache`, serialization, stampede protection, tags | the default for application data |
| output caching | whole responses | lesson 03 |

HybridCache essentials:
| Member | Does |
|:--|:--|
| `GetOrCreateAsync(key, factory, options, tags, ct)` | cache-aside in one call; only one factory runs per key per instance |
| `SetAsync(key, value, options, tags)` | write-through |
| `RemoveAsync(key)` | invalidate one entry (L2 and local L1) |
| `RemoveByTagAsync(tag)` | invalidate a group |
| `HybridCacheEntryOptions.Expiration` | overall lifetime (L2) |
| `LocalCacheExpiration` | L1 lifetime; keep short (other instances' L1 isn't notified on removal) |
| `MaximumPayloadBytes`, `MaximumKeyLength` | limits |
| serializer | System.Text.Json by default; configurable per type |

## Example
`src/Shop.Api/Program.cs`
```csharp
using Microsoft.Extensions.Caching.Hybrid;

builder.Services.AddStackExchangeRedisCache(o =>
{
    o.Configuration = builder.Configuration.GetConnectionString("Redis");
    o.InstanceName = "shop:";
});
builder.Services.AddHybridCache(o =>
{
    o.DefaultEntryOptions = new HybridCacheEntryOptions
    {
        Expiration = TimeSpan.FromMinutes(10),
        LocalCacheExpiration = TimeSpan.FromSeconds(30),
    };
    o.MaximumPayloadBytes = 512 * 1024;
});
```
`src/Shop.Application/Catalog/CatalogService.cs`
```csharp
using Microsoft.Extensions.Caching.Hybrid;

public sealed class CatalogService(HybridCache cache, ShopDb db)
{
    public ValueTask<ProductDto?> GetAsync(string slug, CancellationToken ct) =>
        cache.GetOrCreateAsync(
            $"product:v2:{slug}",                                   // namespaced, versioned key
            async token => await db.Products.AsNoTracking()
                .Where(p => p.Slug == slug && p.IsPublished)
                .Select(p => new ProductDto(p.Id, p.Slug, p.Name, p.Price, p.Currency, p.ImageUrl))
                .FirstOrDefaultAsync(token),
            tags: ["products", $"product:{slug}"],
            cancellationToken: ct);

    public ValueTask<DashboardDto> DashboardAsync(Guid userId, CancellationToken ct) =>
        cache.GetOrCreateAsync(
            $"dashboard:v1:{userId}",                               // per-user data → user in the key
            async token => await BuildDashboardAsync(userId, token),
            new HybridCacheEntryOptions { Expiration = TimeSpan.FromMinutes(2) },
            cancellationToken: ct);
}
```

## Production patterns
- HybridCache for application data; `IMemoryCache` only for tiny per-instance lookups with size limits.
- Keys: `area:version:id[:userId]`; bump the version segment when the value shape changes.
- Short L1 lifetimes, longer L2 lifetimes; cache DTOs (small, serializable), not EF entities.
- Treat the cache as optional: if Redis fails, HybridCache falls back to the factory; make sure the database can survive that (03-backend/08).

## Mistakes
Wrong:
```csharp
_cache.Set("dashboard", data);     // shared by all users
```
Right: include the user (or tenant) in the key.

Wrong: caching EF Core entities.
Right: cache projected DTOs; entities carry tracking state and lazy relations.

## Check yourself
1. What does HybridCache add over `IDistributedCache`?
2. Why keep `LocalCacheExpiration` short?
3. Name two things you should not cache in a shared cache.

<details><summary>Answers</summary>

1. An L1 in-memory layer, serialization, stampede protection (one factory per key), tag invalidation, and a simple `GetOrCreateAsync` API.
2. Removing an entry on one instance doesn't clear other instances' L1 copies; a short L1 lifetime bounds how stale they can be.
3. Data that must be exact right now (stock at checkout, balances) and per-user data under keys without the user.
</details>

## Sources
- [HybridCache library in ASP.NET Core](https://learn.microsoft.com/aspnet/core/performance/caching/hybrid)
- [Caching in .NET (IMemoryCache)](https://learn.microsoft.com/dotnet/core/extensions/caching)
- [Distributed caching (Redis)](https://learn.microsoft.com/aspnet/core/performance/caching/distributed)
- [Azure Architecture Center — Cache-aside pattern](https://learn.microsoft.com/azure/architecture/patterns/cache-aside)
