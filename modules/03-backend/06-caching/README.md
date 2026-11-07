---
title: Caching
module: 03-backend
tech: Redis 8
---
# Caching
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Why and where to cache: browser, CDN, application, database; what not to cache
- [ ] ⭐ Cache-aside with Redis: keys, TTLs, serialization
- [ ] ⭐ Invalidation strategies: TTLs, deletes after writes, versioned keys, tag sets
- [ ] Cache stampede protection: locks, request coalescing, jittered TTLs, stale-while-revalidate
- [ ] Redis data structures for caching: strings, hashes, sets, sorted sets; hash-field expiration
- [ ] Write-through, write-behind, and read-through patterns
- [ ] In-process caches (LRU) vs Redis; two-level caching
- [ ] HTTP caching for APIs: `Cache-Control`, ETags, CDN caching
- [ ] Redis operations: memory limits, eviction policies, persistence, replication; Valkey compatibility
- [ ] Measuring cache effectiveness: hit ratio, latency, memory
- [ ] Caching pitfalls: stale data, leaking personalized data, unbounded keys

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Why and where to cache; cache-aside](docs/01-why-where-cache-aside.md)
- [02 · Invalidation, stampedes, and write patterns](docs/02-invalidation-and-stampedes.md)
- [03 · Redis structures, operations, and measurement](docs/03-redis-structures-and-operations.md)
- [04 · HTTP caching for APIs and caching pitfalls](docs/04-http-caching-and-pitfalls.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 03-backend/06-caching mode=tasks` when you are ready to build._
