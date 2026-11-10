---
title: Redis structures, operations, measurement, and pitfalls
tech: Redis 8, StackExchange.Redis, Azure Managed Redis, OpenTelemetry metrics
version: Redis 8 (local), Azure Managed Redis, StackExchange.Redis 2.x
date: 2026-11-09
covers: [6, 10, 11, 12]
---
# Redis structures, operations, measurement, and pitfalls
[← Overview](00-overview.md)

## Why it matters
- Redis reaches its memory limit with `noeviction`; writes fail, and with them sessions, rate limits, and Hangfire-like features that share the instance.
- A `KEYS shop:*` call in an admin tool blocks Redis for 4 seconds in production.
- The cache "works" but nobody knows its hit ratio; it turns out to be 12%, adding latency for nothing.

## Concepts

### Redis data structures for caching
| Structure | Commands | Use |
|:--|:--|:--|
| ⭐ string | `GET`, `SET key value EX 300`, `INCR` | serialized DTOs, counters, locks (`SET NX PX`) |
| hash | `HSET`, `HGET`, `HGETALL`; field TTL `HEXPIRE` (7.4+) | objects with fields updated separately |
| set | `SADD`, `SMEMBERS`, `SISMEMBER` | tag → keys, membership |
| sorted set | `ZADD`, `ZRANGE`, `ZREMRANGEBYSCORE` | leaderboards, sliding-window rate limits, delayed items |
| list / stream | `LPUSH`/`BRPOP`, `XADD`/`XREADGROUP` | queues, event logs (prefer Service Bus for business messages) |
| pub/sub | `PUBLISH`/`SUBSCRIBE` | cache invalidation fan-out, SignalR backplane |

StackExchange.Redis: one `ConnectionMultiplexer` per app (singleton), `GetDatabase()` per operation, async APIs, pipelining is automatic.

### Redis operations
| Concern | Setting / practice |
|:--|:--|
| ⭐ memory limit + eviction | `maxmemory` with `allkeys-lru` (or `allkeys-lfu`) for caches; `noeviction` breaks writes |
| TTLs | every cache key has one |
| persistence | RDB/AOF; for pure caches optional; for sessions/rate limits, understand loss on failover |
| replication / HA | Azure Managed Redis: high availability on by default; zone redundancy options |
| separate instances | cache vs sessions/locks vs queues (different eviction needs) |
| security | TLS, Entra ID authentication (Azure Managed Redis), no public access (private endpoint) |
| big keys / hot keys | avoid MB-sized values and single keys hit by everything |
| `SCAN` not `KEYS` | iterate without blocking |
| versions | Redis 8 locally; Azure Managed Redis may run a different version; Valkey (the open-source fork) is compatible with core commands; avoid niche new commands for portability |

### Measuring cache effectiveness
| Metric | Source |
|:--|:--|
| ⭐ hit ratio | your own counters around factories (`cache.misses` when the factory runs) or Redis `keyspace_hits/misses` |
| latency (cache vs source) | traces: Redis span vs SQL span |
| memory, evictions, server load | Azure Monitor metrics for Azure Managed Redis; `INFO memory`, `INFO stats` |
| key count, expired keys | `INFO keyspace` |
| SQL load before/after | Query Store, DTU/vCore usage |

A cache with a low hit ratio adds a network hop to every request; shorten keys' variety, lengthen TTLs, or remove it.

### Caching pitfalls
| Pitfall | Fix |
|:--|:--|
| stale data after writes | invalidate after commit + TTL |
| ⭐ leaking personalized data | user/tenant in the key; `private` HTTP headers; no output cache for authenticated responses |
| unbounded key cardinality (cache per search string) | normalize keys, cap variants, don't cache rare queries |
| caching errors or `null`s forever | short TTL for negative results; don't cache exceptions |
| serialization surprises | cache DTO records; version keys when shapes change |
| thundering herd after deploy/flush | warm-up, gradual rollouts, coalescing |
| cache as source of truth | data must be rebuildable from SQL |
| cache down = site down | timeouts on Redis, fall back to source with limits (03-backend/08) |

## Example
`src/Shop.Api/Caching/CacheMetrics.cs`
```csharp
using System.Diagnostics.Metrics;

public sealed class CacheMetrics(IMeterFactory meters)
{
    private readonly Counter<long> _lookups = meters.Create("Shop.Cache").CreateCounter<long>("shop.cache.lookups");

    public void Hit(string area) => _lookups.Add(1, new("area", area), new("result", "hit"));
    public void Miss(string area) => _lookups.Add(1, new("area", area), new("result", "miss"));
}

// inside a GetOrCreateAsync factory:
// metrics.Miss("product");   → hit ratio = 1 - misses / requests (requests counted at the call site)
```
`terminal` (local Redis checks)
```bash
docker compose exec redis redis-cli INFO stats | grep -E 'keyspace_(hits|misses)|evicted_keys'
docker compose exec redis redis-cli CONFIG GET maxmemory-policy
docker compose exec redis redis-cli --scan --pattern 'shop:product:*' | head
docker compose exec redis redis-cli --bigkeys
```
Distributed lock for an expensive refresh (rarely needed with HybridCache):
```csharp
var db = redis.GetDatabase();
var token = Guid.NewGuid().ToString();
if (await db.LockTakeAsync("lock:homepage", token, TimeSpan.FromSeconds(30)))
{
    try { await RebuildHomepageAsync(ct); }
    finally { await db.LockReleaseAsync("lock:homepage", token); }   // releases only if we still own it
}
```

## Production patterns
- Separate Redis databases/instances by purpose; caches use LRU/LFU eviction with TTLs on every key.
- Measure hit ratio per cache area and compare latency with and without; remove caches that don't pay.
- `SCAN`, never `KEYS`; check `--bigkeys` and hot keys periodically.
- Azure Managed Redis with Entra auth and private endpoints; plan for failover (connections reconnect; StackExchange.Redis handles it).

## Mistakes
Wrong: `maxmemory-policy noeviction` on a cache.
Right: `allkeys-lru`/`allkeys-lfu` + TTLs.

Wrong: caching every search query result.
Right: cache popular, normalized queries; let rare ones hit the database (or a search index).

## Check yourself
1. Which eviction policy fits a pure cache?
2. Why is `KEYS` dangerous in production?
3. How do you know whether a cache is worth it?

<details><summary>Answers</summary>

1. `allkeys-lru` or `allkeys-lfu` (evict least recently / least frequently used keys when memory is full).
2. Redis is single-threaded for commands; `KEYS` scans the whole keyspace and blocks all other clients until it finishes.
3. Measure hit ratio, latency with and without the cache, and the load removed from the database; a low hit ratio means it mostly adds a hop.
</details>

## Sources
- [Redis data types](https://redis.io/docs/latest/develop/data-types/)
- [Redis key eviction](https://redis.io/docs/latest/develop/reference/eviction/)
- [StackExchange.Redis basics](https://stackexchange.github.io/StackExchange.Redis/Basics)
- [Azure Managed Redis — best practices](https://learn.microsoft.com/azure/redis/best-practices-performance)
- [.NET metrics (System.Diagnostics.Metrics)](https://learn.microsoft.com/dotnet/core/diagnostics/metrics-instrumentation)
