---
title: Redis structures, operations, and measurement
tech: Redis 8, node-redis 5, AWS ElastiCache
version: Redis 8.x, Valkey 8.x (ElastiCache), node-redis 5
date: 2026-11-07
covers: [5, 9, 10]
---
# Redis structures, operations, and measurement
[← Overview](00-overview.md)

## Why it matters
- Cache and BullMQ queues share one Redis with `allkeys-lru`; under memory pressure Redis evicts queue data and jobs silently disappear.
- Someone runs `KEYS *` on production to debug; Redis blocks for 4 seconds and every request times out.
- A single 40 MB JSON value is read on every request; network and CPU spike, and latency follows.

## Concepts

### Data structures for caching and friends
| Structure | Commands | Use |
|:--|:--|:--|
| String | `SET key val EX n`, `GET`, `MGET`, `INCR`, `SET … NX` | JSON blobs, counters, locks |
| Hash | `HSET`, `HGET`, `HGETALL`, `HINCRBY`, `HEXPIRE` (7.4+), `HGETEX`/`HSETEX` (8.0+) | objects with field-level reads/updates, per-field TTL |
| Set | `SADD`, `SMEMBERS`, `SISMEMBER`, `SREM` | tags, unique members |
| Sorted set | `ZADD`, `ZRANGE … BYSCORE`, `ZREMRANGEBYSCORE`, `ZINCRBY` | leaderboards, time indexes, sliding-window limits |
| List | `LPUSH`, `RPOP`, `LRANGE` | simple queues (prefer streams/BullMQ) |
| Stream | `XADD`, `XREADGROUP`, `XACK` | event logs, consumer groups |
| HyperLogLog | `PFADD`, `PFCOUNT` | approximate unique counts with tiny memory |
| Bitmap | `SETBIT`, `BITCOUNT` | per-day activity flags |
| JSON (Redis 8 built in) | `JSON.SET`, `JSON.GET` | partial document updates (not portable to all Valkey setups) |
| Vector set (Redis 8) | `VADD`, `VSIM` | similarity search (Redis-specific) |

### Operating Redis
| Setting / practice | Why |
|:--|:--|
| `maxmemory` | Redis must know its budget |
| `maxmemory-policy allkeys-lru` (or `allkeys-lfu`) | for pure caches: evict least recently/frequently used |
| `noeviction` | for queues and sessions (BullMQ requires it): fail writes instead of losing data |
| **Separate instances for cache vs queues/sessions** | different eviction and persistence needs |
| Persistence: none or RDB for caches; AOF (`everysec`) for sessions/queues | durability where it matters |
| Replication + automatic failover | ElastiCache Multi-AZ, Sentinel |
| Cluster mode | sharding; multi-key commands need the same hash slot (`{tag}` in keys) |
| `SCAN` instead of `KEYS` | non-blocking iteration |
| Avoid big keys and hot keys | `redis-cli --bigkeys`, `MEMORY USAGE`, `HOTKEYS` (8.6), `--hotkeys` (LFU) |
| `SLOWLOG GET`, `LATENCY DOCTOR` | find slow commands |
| TLS + AUTH/ACL users | encrypt and restrict access; disable dangerous commands for app users |
| Client timeouts and reconnect | `connectTimeout`, retry strategy, `'error'` listener |

### Measuring effectiveness
| Metric | Source | Meaning |
|:--|:--|:--|
| Hit ratio per cache | app metrics (`cache_requests_total{cache,result}`) | is the cache useful? |
| Global hits/misses | `INFO stats` (`keyspace_hits`, `keyspace_misses`) | overall picture |
| Latency of cache calls (p50/p99) | app metrics / traces | network or Redis problems |
| `used_memory`, `evicted_keys`, `expired_keys` | `INFO memory`, `INFO stats` | capacity and churn |
| DB load before/after | DB metrics | the real goal |
| Value sizes | sampling, `MEMORY USAGE` | big values hurt |

A low hit ratio usually means keys are too specific (high cardinality), TTLs too short, or the data isn't reused.

## Example
Hash for a product with partial updates and per-field expiry:
```ts
await redis.hSet('shop:product:v2:p1', { name: 'Oak desk', priceCents: '34900', stock: '12' });
await redis.expire('shop:product:v2:p1', 600);
await redis.hIncrBy('shop:product:v2:p1', 'stock', -1);             // update one field atomically
const price = await redis.hGet('shop:product:v2:p1', 'priceCents');
// Redis 7.4+/Valkey 9+: expire a single field, e.g. a short-lived promo price
await redis.sendCommand(['HEXPIRE', 'shop:product:v2:p1', '300', 'FIELDS', '1', 'promoPriceCents']);
```
Leaderboard and sliding-window counter with sorted sets:
```ts
await redis.zIncrBy('shop:bestsellers:2026-11', 1, productId);
const top10 = await redis.zRangeWithScores('shop:bestsellers:2026-11', 0, 9, { REV: true });

// requests in the last 60 s for a key
const now = Date.now();
await redis.multi()
  .zRemRangeByScore(`win:${key}`, 0, now - 60_000)
  .zAdd(`win:${key}`, { score: now, value: `${now}-${crypto.randomUUID()}` })
  .expire(`win:${key}`, 61)
  .exec();
const count = await redis.zCard(`win:${key}`);
```
Instrumenting hit ratio (OpenTelemetry metrics, [10-observability](../../10-observability/README.md)):
```ts
import { metrics } from '@opentelemetry/api';
const cacheRequests = metrics.getMeter('cache').createCounter('cache_requests_total');

const hit = await redis.get(key);
cacheRequests.add(1, { cache: 'product', result: hit === null ? 'miss' : 'hit' });
```
Safe iteration instead of `KEYS`:
```ts
for await (const keys of redis.scanIterator({ MATCH: 'shop:product:v1:*', COUNT: 500 })) {
  if (keys.length) await redis.unlink(keys);                      // UNLINK frees memory asynchronously
}
```
Local Compose service with production-like limits:
```yaml
redis-cache:
  image: redis:8-alpine
  command: ["redis-server", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru", "--save", ""]
redis-queue:
  image: redis:8-alpine
  command: ["redis-server", "--maxmemory-policy", "noeviction", "--appendonly", "yes"]
```

## Production patterns
- **Two Redis roles**: an evicting cache, and a durable `noeviction` store for sessions and queues.
- **Pick structures by access pattern**: hashes for partial updates, sorted sets for rankings and windows, strings for blobs.
- **Portable commands** when the cloud runs Valkey; feature-detect or avoid Redis-8-only features.
- **Hit ratio, latency, memory, and evictions on a dashboard**, with alerts on evictions in the durable instance.
- **No `KEYS`, no huge values, no unbounded collections**; `SCAN` and `UNLINK` for maintenance.

## Mistakes
Wrong: one Redis with `allkeys-lru` for cache and BullMQ. Queue keys get evicted. Right: separate instances; `noeviction` for queues.

Wrong: `KEYS shop:*` in production. Right: `SCAN` with `MATCH` and `COUNT`.

Wrong: caching a whole catalog under one key. Right: per-entity keys and small values; paginate lists.

Wrong: no `maxmemory` set; Redis grows until the OS kills it. Right: explicit `maxmemory` and a policy that matches the role.

## Check yourself
1. Why do caches and queues need different eviction policies?
2. When is a hash better than a JSON string?
3. Your cache hit ratio is 8%. What do you investigate?

<details>
<summary>Answers</summary>

1. Losing a cache entry costs a recomputation; losing a queue job or session loses work or logs users out. Caches should evict under pressure (`allkeys-lru`), durable data must refuse writes instead (`noeviction`).
2. When you read or update individual fields (stock count, one setting) without fetching and rewriting the whole object, or need per-field expiration.
3. Key cardinality (keys too specific, e.g. including timestamps or full query strings), TTLs too short for the access pattern, values evicted by memory pressure (`evicted_keys`), and whether the data is actually re-read.
</details>

## Sources
- [Redis — Data types](https://redis.io/docs/latest/develop/data-types/)
- [Redis — Key eviction](https://redis.io/docs/latest/develop/reference/eviction/)
- [Redis — Persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [BullMQ — Going to production (noeviction)](https://docs.bullmq.io/guide/going-to-production)
- [AWS — ElastiCache best practices](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/BestPractices.html)
