---
title: Invalidation, stampedes, and write patterns
tech: HybridCache, Redis 8, EF Core 10
version: Microsoft.Extensions.Caching.Hybrid 10.x
date: 2026-11-09
covers: [4, 5, 7]
---
# Invalidation, stampedes, and write patterns
[← Overview](00-overview.md)

## Why it matters
- A price change is saved, then the cache entry is deleted, then a request that started earlier writes the **old** price back into the cache. The wrong price shows for 10 minutes.
- The homepage key expires at 12:00:00; 3,000 requests miss at once and all run the same 800 ms query. SQL Server CPU hits 100% (cache stampede).
- Every product edit clears the whole cache "to be safe"; the database is hammered after every admin change.

## Concepts

### Invalidation strategies
| Strategy | How | Trade-off |
|:--|:--|:--|
| ⭐ TTL | every entry expires | simple; bounded staleness |
| ⭐ delete after write | `RemoveAsync(key)` after the transaction commits | precise; race windows exist |
| versioned keys | `product:v3:…` or a per-entity version in the key | old entries just age out |
| ⭐ tags | `RemoveByTagAsync("products")` | group invalidation |
| events | outbox message → consumers invalidate (multi-service) | eventual |
| write-through | update the cache on write | cache always warm; more code |

Order matters: **commit the database change, then invalidate**. Invalidating before commit lets a concurrent reader re-cache the old value. With a short TTL as a safety net, rare races heal themselves.

### Stampedes
| Defense | How |
|:--|:--|
| ⭐ request coalescing | HybridCache runs one factory per key per instance; concurrent callers wait for it |
| jittered TTLs | `Expiration = base + random(0..10%)` so hot keys don't expire together |
| stale-while-revalidate | serve the old value while one caller refreshes (also seen: FusionCache "fail-safe") |
| distributed lock | one refresher across instances (Redis `SET NX PX`), for very expensive values |
| pre-warming | refresh hot keys in a background job before they expire |

### Write and read patterns
| Pattern | Write path | Read path | Use |
|:--|:--|:--|:--|
| ⭐ cache-aside | DB, then invalidate | cache → DB on miss | default |
| write-through | DB and cache together | cache | data read right after writing |
| write-behind | cache now, DB later (async) | cache | counters, analytics; risk of loss |
| read-through | — | cache library loads on miss | what `GetOrCreateAsync` gives you |
| refresh-ahead | background refresh | cache | predictable hot keys |

Write-behind risks data loss if Redis fails; use it only for data you can lose or rebuild (view counts), never for orders or payments.

## Example
`src/Shop.Application/Catalog/ProductAdminService.cs`
```csharp
using Microsoft.Extensions.Caching.Hybrid;

public sealed class ProductAdminService(ShopDb db, HybridCache cache, IOutputCacheStore outputCache)
{
    public async Task UpdatePriceAsync(long productId, decimal price, CancellationToken ct)
    {
        var product = await db.Products.SingleAsync(p => p.Id == productId, ct);
        product.ChangePrice(price);
        await db.SaveChangesAsync(ct);                                      // 1. commit

        await cache.RemoveByTagAsync($"product:{product.Slug}", ct);        // 2. invalidate application cache
        await outputCache.EvictByTagAsync("catalog", ct);                   // 3. invalidate cached responses
        // 4. tell Next.js (02-frontend/06): enqueue a revalidation job for tag "product:{slug}"
    }
}
```
Jittered expiration for hot keys:
```csharp
static HybridCacheEntryOptions Jittered(TimeSpan baseTtl) => new()
{
    Expiration = baseTtl + TimeSpan.FromMilliseconds(Random.Shared.Next(0, (int)(baseTtl.TotalMilliseconds * 0.1))),
    LocalCacheExpiration = TimeSpan.FromSeconds(30),
};
```
Write-behind view counters (acceptable to lose a few):
```csharp
await redis.GetDatabase().StringIncrementAsync($"views:{productId}");   // fast path
// a Hangfire recurring job flushes views:* into SQL every 5 minutes
```

## Production patterns
- Cache-aside with TTL as the baseline; precise invalidation after commit on top.
- Tags per entity and per collection; invalidate the smallest set that's wrong.
- Coalescing (HybridCache) everywhere, jitter for hot keys, refresh-ahead for the few very expensive ones.
- The same invalidation event also revalidates the Next.js cache and output cache, so all layers agree.

## Mistakes
Wrong: invalidate, then save.
```csharp
await cache.RemoveAsync(key); await db.SaveChangesAsync();   // a reader can re-cache the old value in between
```
Right: save (commit), then invalidate.

Wrong: `FLUSHALL` / clearing everything on every write.
Right: targeted keys or tags.

## Check yourself
1. Why invalidate after the commit rather than before?
2. What does request coalescing prevent?
3. When is write-behind acceptable?

<details><summary>Answers</summary>

1. Before the commit, a concurrent reader can miss, load the still-old value from the database, and put it back in the cache.
2. Many concurrent misses on the same key all running the expensive factory (a stampede); only one runs, the others wait for its result.
3. For data you can afford to lose or rebuild (counters, analytics), never for business records.
</details>

## Sources
- [HybridCache — Removal and tags](https://learn.microsoft.com/aspnet/core/performance/caching/hybrid#remove-cache-entries)
- [Azure Architecture Center — Caching guidance](https://learn.microsoft.com/azure/architecture/best-practices/caching)
- [Redis — Cache stampede](https://redis.io/glossary/cache-stampede/)
- [FusionCache (fail-safe, backplane)](https://github.com/ZiggyCreatures/FusionCache)
