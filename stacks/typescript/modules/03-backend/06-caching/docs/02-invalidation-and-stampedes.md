---
title: Invalidation, stampedes, and write patterns
tech: Redis 8, node-redis 5, PostgreSQL 18
version: Redis 8, node-redis 5
date: 2026-11-07
covers: [3, 4, 6]
---
# Invalidation, stampedes, and write patterns
[← Overview](00-overview.md)

## Why it matters
- A price update is saved, but the cache still serves the old price for 10 minutes; customers are charged one price and shown another.
- The homepage's cache key expires at 09:00 during a sale; 4,000 requests miss at once and run the same 2-second query, and the database falls over (cache stampede).
- Code deletes the cache before updating the database; a concurrent read refills the cache with the old value right after the delete.

## Concepts

### Invalidation strategies
| Strategy | How | Staleness | Fits |
|:--|:--|:--|:--|
| TTL only | entries expire | up to the TTL | data that may be a bit old (catalog, counts) |
| Delete on write | update DB, then `DEL key` | small race window | entity caches |
| Update on write | update DB, then `SET` new value | race if writes overlap | single-writer data |
| Versioned keys | key includes a version (`product:{id}:v{version}` or a namespace version) | none for readers of the new version | bulk invalidation, shape changes |
| Tag sets | Redis set per tag lists member keys; delete them all | small | "everything for account X" |
| Events | publish invalidations (pub/sub) to drop in-process L1 copies on all instances | small | two-level caches |

**Order matters:** update the database first, then invalidate. Deleting first lets a concurrent reader refill the cache with old data. For a remaining small race (reader loaded old data before the write, writes it after your delete), a short TTL bounds the damage; a second delayed delete (a few hundred ms later) narrows it further.

### Cache stampede (dogpile)
When a hot key expires, many requests miss together and all rebuild it.

| Technique | How |
|:--|:--|
| Request coalescing (single flight) | per instance, concurrent misses for a key share one in-flight promise |
| Distributed lock | `SET lock:{key} token NX PX 5000`; one rebuilds, others wait briefly or serve stale |
| Stale-while-revalidate | store a soft expiry inside the value; serve stale and refresh in the background |
| Jittered TTLs | avoid synchronized expiry |
| Early refresh | refresh hot keys before they expire |
| Warm-up | pre-fill critical keys after deploys or cache flushes |

### Write patterns
| Pattern | Writes go | Pros | Cons |
|:--|:--|:--|:--|
| Cache-aside (lazy) | DB; cache invalidated | simple, resilient | first read after write is slow |
| Write-through | DB and cache together | cache always warm | write latency, caches unread data |
| Write-behind | cache first, DB later (async) | fast writes | data loss risk; rarely worth it |
| Read-through | cache layer loads on miss | uniform access | needs a library/abstraction |
| Refresh-ahead | refresh before expiry | no miss latency for hot keys | wasted work for cold keys |

## Example
Invalidate after the database commit:
```ts
export async function updateProductPrice(id: string, priceCents: number) {
  const product = await db.transaction(async (tx) => {
    const [p] = await tx.update(products).set({ priceCents, version: sql`version + 1` }).where(eq(products.id, id)).returning();
    return p!;
  });
  await redis.del(`shop:product:v2:${id}`);              // after commit, never before
  setTimeout(() => void redis.del(`shop:product:v2:${id}`).catch(() => {}), 500); // delayed double delete
  return product;
}
```
Single-flight + lock + stale-while-revalidate:
```ts
type Envelope<T> = { value: T; softExpiresAt: number };
const inflight = new Map<string, Promise<unknown>>();

export async function cachedSWR<T>(key: string, softTtlS: number, hardTtlS: number, load: () => Promise<T>): Promise<T> {
  const raw = await redis.get(key).catch(() => null);
  if (raw) {
    const env = JSON.parse(raw) as Envelope<T>;
    if (Date.now() > env.softExpiresAt) void refresh(key, softTtlS, hardTtlS, load); // serve stale, refresh in background
    return env.value;
  }
  return refresh(key, softTtlS, hardTtlS, load);         // cold miss: must wait
}

async function refresh<T>(key: string, softTtlS: number, hardTtlS: number, load: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;           // coalesce within this instance

  const run = (async () => {
    const lockKey = `lock:${key}`;
    const token = crypto.randomUUID();
    const gotLock = await redis.set(lockKey, token, { NX: true, PX: 10_000 }).catch(() => null);
    if (!gotLock) {                                      // another instance is rebuilding
      await new Promise((r) => setTimeout(r, 100));
      const raw = await redis.get(key).catch(() => null);
      if (raw) return (JSON.parse(raw) as Envelope<T>).value;
    }
    try {
      const value = await load();
      const env: Envelope<T> = { value, softExpiresAt: Date.now() + softTtlS * 1000 };
      await redis.set(key, JSON.stringify(env), { EX: hardTtlS }).catch(() => {});
      return value;
    } finally {
      if (gotLock) await releaseLock(lockKey, token);
    }
  })();

  inflight.set(key, run);
  try { return await run; } finally { inflight.delete(key); }
}

// Release only if we still own the lock (portable across Redis and Valkey)
const RELEASE = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;
const releaseLock = (key: string, token: string) => redis.eval(RELEASE, { keys: [key], arguments: [token] }).catch(() => 0);
```
Redis 8.4+ can release with `DELEX key IFEQ token` instead of the script; keep the script if you target ElastiCache Valkey.

Tag-based invalidation for "everything about an account":
```ts
export async function cacheWithTag(key: string, tag: string, value: string, ttl: number) {
  await redis.multi().set(key, value, { EX: ttl }).sAdd(`tag:${tag}`, key).expire(`tag:${tag}`, ttl).exec();
}
export async function invalidateTag(tag: string) {
  const keys = await redis.sMembers(`tag:${tag}`);
  if (keys.length) await redis.del([...keys, `tag:${tag}`]);
}
// invalidateTag(`acct:${accountId}`) after bulk changes to that account's data
```

## Production patterns
- **Write to the database, then invalidate**; bound remaining races with TTLs.
- **Stampede protection on hot, expensive keys**: coalescing, locks, stale-while-revalidate, jitter.
- **Versioned keys for shape changes and bulk invalidation**; roll versions gradually to avoid a cold-cache storm.
- **Cache-aside by default**; write-through only for small, read-heavy datasets; avoid write-behind for business data.
- **Locks with owner tokens and timeouts**, released only by their owner.

## Mistakes
Wrong: delete before update.
```ts
await redis.del(key);
await db.update(...); // a reader in between caches the OLD value
```
Right: update, then delete.

Wrong: every request rebuilding an expired hot key. Right: single flight + lock + serve stale.

Wrong: releasing a lock with plain `DEL`. If your work took longer than the lock TTL, you delete someone else's lock. Right: compare-and-delete with the owner token.

Wrong: bumping a global cache version at peak traffic; every key misses at once. Right: change versions off-peak, warm critical keys, or roll per entity.

## Check yourself
1. Why must you invalidate after the database write, not before?
2. How does stale-while-revalidate prevent a stampede?
3. What are the risks of write-behind caching?

<details>
<summary>Answers</summary>

1. If you delete first, a concurrent reader can miss, read the old row (the write hasn't happened yet), and put the old value back into the cache, where it stays until TTL.
2. Expired-but-present values are served immediately while one refresh runs in the background, so readers never pile onto the database waiting for a rebuild.
3. Data written only to the cache can be lost on a crash or eviction before it reaches the database, ordering and consistency get hard, and the cache becomes a source of truth it isn't designed to be.
</details>

## Sources
- [AWS — Caching strategies](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html)
- [Redis — Distributed locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/)
- [RFC 5861 — stale-while-revalidate](https://www.rfc-editor.org/rfc/rfc5861)
- [Facebook — Scaling Memcache (leases, thundering herds)](https://research.facebook.com/publications/scaling-memcache-at-facebook/)
- [Redis — `SET` command options](https://redis.io/docs/latest/commands/set/)
