---
title: Why and where to cache; cache-aside
tech: Redis 8, node-redis 5, Express 5
version: Redis 8, node-redis 5
date: 2026-11-07
covers: [1, 2, 7]
---
# Why and where to cache; cache-aside
[← Overview](00-overview.md)

## Why it matters
- The product page runs 6 queries per view; at 2,000 views/second the database maxes out. The data changes twice a day.
- A team caches everything "for performance", including per-user carts in shared keys; one user sees another's cart.
- Every instance builds its own in-memory cache of a 2 GB catalog; memory climbs until containers are killed.

## Concepts

### Where caches live
| Layer | Caches | Good for | Watch out |
|:--|:--|:--|:--|
| Browser | HTTP responses, assets | static assets, public data | can't purge; personalized data must be `private` |
| CDN | public HTTP responses | assets, public API responses, pages | cache keys, purges |
| In-process (L1) | objects in app memory | tiny, very hot, rarely changing data (config, flags, reference data) | per instance, inconsistent, memory per instance |
| Distributed (L2: Redis) | computed results, DB rows, sessions | shared across instances | network hop, eviction, consistency |
| Database | buffer cache, materialized views | repeated queries, heavy aggregates | refresh strategy |

### What to cache
| Cache | Don't cache (or be very careful) |
|:--|:--|
| expensive, frequently read, rarely changing data | data that must be exactly current (balances, stock at checkout) |
| results of slow external APIs (with their TTLs) | per-user data under shared keys |
| computed aggregates (dashboards, counts) | data that changes on almost every read |
| reference data (countries, plans, feature flags) | anything you can't rebuild if the cache vanishes |

Measure first: cache what profiling shows is expensive and hot.

### Cache-aside (lazy loading)
1. Read from the cache.
2. **Hit:** return it.
3. **Miss:** read the source, write it to the cache with a TTL, return it.
4. **On write:** update the source, then delete (or update) the cache entry (lesson 02).

The application owns the logic; the cache can be empty at any time without breaking correctness.

### Keys and values
| Practice | Example |
|:--|:--|
| Namespaced keys | `shop:product:v2:{id}` |
| Tenant/user in the key for scoped data | `shop:acct:{accountId}:dashboard` |
| A version segment | bump `v2` → `v3` when the value shape changes |
| TTL on every key | `EX 300` (+ jitter) |
| Small values | store what the reader needs, not whole object graphs |
| Serialization | JSON; revive dates; also seen: MessagePack for compactness |
| Negative caching | cache "not found" briefly to stop repeated misses |

### Two-level caching
L1 in-process (seconds, small, LRU-bounded) in front of L2 Redis (minutes) in front of the database. L1 removes the network hop for the hottest keys; keep its TTL short because instances can't see each other's L1.

## Example
`src/cache/redis.ts`
```ts
import { createClient } from 'redis';
import { logger } from '#src/logger.ts';

export const redis = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 2_000 } });
redis.on('error', (err) => logger.error({ err }, 'redis error')); // required: unhandled 'error' crashes the process
await redis.connect();
```
`src/cache/cache-aside.ts`
```ts
import { redis } from './redis.ts';

const jitter = (seconds: number) => Math.round(seconds * (0.9 + Math.random() * 0.2)); // ±10%
const NOT_FOUND = '__nf__';

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T | null>): Promise<T | null> {
  try {
    const hit = await redis.get(key);
    if (hit === NOT_FOUND) return null;
    if (hit !== null) return JSON.parse(hit) as T;
  } catch {
    // cache down: fall through to the source (degrade, don't fail)
  }
  const value = await load();
  try {
    await redis.set(key, value === null ? NOT_FOUND : JSON.stringify(value), {
      EX: value === null ? 30 : jitter(ttlSeconds),            // short negative cache
    });
  } catch { /* ignore cache write failures */ }
  return value;
}
```
Using it:
```ts
export const getProduct = (id: string) =>
  cached(`shop:product:v2:${id}`, 300, () => productsRepo.findById(id));

export const getAccountDashboard = (accountId: string) =>
  cached(`shop:acct:${accountId}:dashboard:v1`, 60, () => reports.dashboard(accountId)); // tenant in the key
```
A small in-process L1 in front of Redis (for very hot reference data):
```ts
const l1 = new Map<string, { value: unknown; expiresAt: number }>();
const L1_MAX = 1_000;

export async function cachedTwoLevel<T>(key: string, l1Ms: number, l2Seconds: number, load: () => Promise<T | null>) {
  const now = Date.now();
  const entry = l1.get(key);
  if (entry && entry.expiresAt > now) return entry.value as T;
  const value = await cached(key, l2Seconds, load);
  if (l1.size >= L1_MAX) l1.delete(l1.keys().next().value!);      // evict oldest insertion (simple bound)
  l1.set(key, { value, expiresAt: now + l1Ms });
  return value;
}
// also seen: the lru-cache package for proper LRU eviction and size limits
```

## Production patterns
- **Cache-aside with TTLs on every key**; correctness must never depend on the cache being present.
- **Keys include tenant/user for scoped data** and a version for the value shape.
- **Degrade on cache failure**: treat Redis errors as misses, alert on error rates.
- **L1 only for small, hot, slowly changing data**, with short TTLs and a size bound.
- **Measure hit ratio and DB load** before and after adding a cache (lesson 03).

## Mistakes
Wrong: shared keys for personalized data.
```ts
cached('dashboard', 60, () => reports.dashboard(req.user.accountId)); // first tenant's data served to all
```
Right: `` `shop:acct:${accountId}:dashboard:v1` ``.

Wrong: keys without TTL.
```ts
await redis.set(`search:${query}`, json); // user input in keys, never expires: memory grows forever
```
Right: always `EX`, and bound key cardinality (normalize queries, cache only popular ones).

Wrong: failing the request when Redis is down. Right: fall back to the source; the cache is an optimization.

Wrong: an unbounded in-process `Map` cache. Right: size-bounded LRU with TTL.

## Check yourself
1. In cache-aside, who loads data on a miss, and why is that resilient?
2. When is an in-process cache a better choice than Redis?
3. Why add jitter to TTLs?

<details>
<summary>Answers</summary>

1. The application: on a miss it reads the source and fills the cache. If the cache is empty or down, requests still work (just slower), so the cache never becomes a single point of correctness.
2. For small, extremely hot, rarely changing data (config, feature flags, reference lists) where the network hop to Redis matters and short per-instance staleness is acceptable.
3. Keys created at the same time (after a deploy or cold start) would otherwise expire at the same moment and send a burst of misses to the database; jitter spreads expirations out.
</details>

## Sources
- [AWS — Caching strategies (lazy loading, write-through)](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html)
- [Redis — Caching patterns](https://redis.io/solutions/caching/)
- [node-redis — Usage](https://github.com/redis/node-redis#usage)
- [Martin Fowler — Two hard things](https://martinfowler.com/bliki/TwoHardThings.html)
- [lru-cache](https://github.com/isaacs/node-lru-cache)
