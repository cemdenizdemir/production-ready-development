---
title: Caching
module: 03-backend
tech: HybridCache, IMemoryCache, Redis 8, output caching
---
# Caching
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Why and where to cache: browser, CDN, application, database; what not to cache
- [ ] ⭐ Cache-aside with Redis: keys, TTLs, serialization
- [ ] ⭐ In-memory vs distributed caching in .NET: `IMemoryCache`, `IDistributedCache`, and HybridCache as the two-level cache
- [ ] ⭐ Invalidation strategies: TTLs, deletes after writes, versioned keys, tag sets
- [ ] Cache stampede protection: locks, request coalescing, jittered TTLs, stale-while-revalidate
- [ ] Redis data structures for caching: strings, hashes, sets, sorted sets; hash-field expiration
- [ ] Write-through, write-behind, and read-through patterns
- [ ] ⭐ Output caching middleware: policies, vary-by rules, tags, eviction, a Redis-backed store
- [ ] HTTP caching for APIs: `Cache-Control`, ETags, CDN caching
- [ ] Redis operations: memory limits, eviction policies, persistence, replication; Valkey compatibility
- [ ] Measuring cache effectiveness: hit ratio, latency, memory
- [ ] Caching pitfalls: stale data, leaking personalized data, unbounded keys

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Where to cache, cache-aside, and the .NET caching APIs](docs/01-where-cache-aside-apis.md)
- [02 · Invalidation, stampedes, and write patterns](docs/02-invalidation-stampedes-writes.md)
- [03 · Output caching and HTTP caching for APIs](docs/03-output-http-caching.md)
- [04 · Redis structures, operations, measurement, and pitfalls](docs/04-redis-ops-measuring-pitfalls.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/06-caching mode=tasks` when you are ready to build._
