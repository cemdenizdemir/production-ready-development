---
title: Scaling data, caching, and asynchronous processing
tech: SQL Server 2025, Azure SQL, Redis 8, Azure Service Bus, Event Hubs, C# 14
version: November 2026
date: 2026-11-09
covers: [5, 6, 7]
---
# Scaling data, caching, and asynchronous processing
[← Overview](00-overview.md)

## Why it matters
- Orders were sharded by `customerId % 4`. Adding a fifth shard meant moving 80% of the data; the migration took a month.
- A celebrity roaster's product page was one Redis key read 50,000 times a second. That single hot key saturated one Redis node while the others idled.
- Fan-out on write for a "followers" feed sent one post to 2 million followers synchronously; the request timed out and half the followers never got it.

## Concepts

### Scaling data
| Technique | What | Trade-off |
|:--|:--|:--|
| ⭐ vertical scaling | bigger database tier | simplest; has a ceiling and cost curve |
| ⭐ read replicas | copies serve reads | replication lag (read-your-writes) |
| ⭐ partitioning | split a table/data set by a key (range, hash, list) | queries across partitions get harder |
| ⭐ sharding | partitions on separate databases/servers | cross-shard joins and transactions, rebalancing |
| ⭐ consistent hashing | map keys to nodes on a ring with virtual nodes; adding a node moves ~1/N of keys | more complex than modulo |
| directory-based sharding | a lookup table maps tenant/customer → shard | flexible; the directory is a dependency |
| ⭐ hot keys / partitions | one key gets most traffic | split the key, add local caches, replicate the hot item |

Shard key choice: high cardinality, even load, and matching the main access pattern (most queries hit one shard). For the shop, `customerId` (or tenant) is a typical shard key for orders.

### Caching at system level
| Level | Caches | Invalidation |
|:--|:--|:--|
| browser | static assets, some API responses | versioned URLs, `Cache-Control` |
| ⭐ CDN (Front Door) | static and public cacheable responses | TTL, purge, versioned URLs |
| reverse proxy / output cache | whole responses | tags, TTL |
| ⭐ application cache (L1 memory + L2 Redis) | objects, query results | TTL + delete on change + tags |
| database buffer pool | pages | automatic |

| Strategy | How | Use when |
|:--|:--|:--|
| ⭐ cache-aside | read: cache → miss → DB → fill; write: DB then delete key | default |
| read-through / write-through | the cache layer loads/writes the DB | caching libraries/services that support it |
| write-behind | write to cache, flush later | counters, analytics; risk of loss |
| refresh-ahead | refresh hot keys before expiry | predictable hot data |
| ⭐ stampede protection | request coalescing, locks, jittered TTLs | hot keys expiring (HybridCache coalesces) |

### Asynchronous processing
| Pattern | Means | Azure |
|:--|:--|:--|
| ⭐ queue (work queue) | each message processed by one consumer; competing consumers scale | Service Bus queues |
| ⭐ pub/sub (topics) | each subscriber gets a copy | Service Bus topics, Event Grid |
| ⭐ stream (log) | ordered, retained, replayable; consumers track offsets | Event Hubs (Kafka API) |
| ⭐ fan-out | one event → many tasks or recipients; usually async, in batches | topic + workers, or a job that pages through recipients |
| fan-out on write vs read | precompute feeds on post vs assemble on read | write: fast reads, heavy writes; read: the reverse; hybrid for celebrities |
| ⭐ backpressure | slow producers or shed load when consumers fall behind | bounded queues, max delivery, scale workers by depth |
| batching | process many items per call | Service Bus batch receive, bulk SQL |

## In our stack
- Read replicas, partitioning, connection budgets: [03-backend/09-scalability lesson 04](../../../03-backend/09-scalability/docs/04-database-scaling-reads.md).
- HybridCache, output caching, Front Door: [03-backend/06-caching](../../../03-backend/06-caching/README.md).
- Queues, topics, workers, backpressure: [03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md), [03-backend/09-scalability lesson 05](../../../03-backend/09-scalability/docs/05-queues-capacity-payloads.md).

## When not to
- Don't shard before you've exhausted query tuning, caching, replicas, and bigger tiers; one well-tuned Azure SQL database goes a long way.
- Don't cache data that must be exact at the moment of use (stock at checkout) without a fallback check.
- Don't introduce a stream platform where a queue does the job; streams add retention, partitions, and offset management.

## Example
Consistent hashing with virtual nodes (C# 14):
```csharp
using System.IO.Hashing;
using System.Text;

public sealed class ConsistentHashRing<TNode>(IEnumerable<TNode> nodes, Func<TNode, string> name, int virtualNodes = 100)
    where TNode : notnull
{
    private readonly SortedList<ulong, TNode> _ring = Build(nodes, name, virtualNodes);

    private static SortedList<ulong, TNode> Build(IEnumerable<TNode> nodes, Func<TNode, string> name, int vnodes)
    {
        var ring = new SortedList<ulong, TNode>();
        foreach (var node in nodes)
            for (var i = 0; i < vnodes; i++)
                ring[Hash($"{name(node)}#{i}")] = node;
        return ring;
    }

    private static ulong Hash(string key) => XxHash64.HashToUInt64(Encoding.UTF8.GetBytes(key));

    public TNode NodeFor(string key)
    {
        var h = Hash(key);
        var keys = _ring.Keys;
        int lo = 0, hi = keys.Count - 1;                        // first ring position >= h (binary search)
        while (lo <= hi) { var mid = (lo + hi) / 2; if (keys[mid] < h) lo = mid + 1; else hi = mid - 1; }
        return _ring.Values[lo == keys.Count ? 0 : lo];         // wrap around
    }
}

var ring = new ConsistentHashRing<string>(["shard-a", "shard-b", "shard-c"], s => s);
Console.WriteLine(ring.NodeFor("customer:42"));
```
`XxHash64` comes from the `System.IO.Hashing` package. Adding `shard-d` moves only about a quarter of the keys, instead of most keys with `hash % n`.

Hot key mitigation: key splitting with local caching
```csharp
// writes update N copies; reads pick one at random → load spreads over Redis nodes
static string HotKey(string key, int copies = 8) => $"{key}:copy{Random.Shared.Next(copies)}";
// plus HybridCache L1 (in-process) with a short TTL so most reads never reach Redis
```
Fan-out of a "back in stock" notification without blocking the request:
```text
Product restocked (SQL, outbox) → topic "product-events"
  → subscription "restock-notify" → worker pages through watchers in batches of 500
     → enqueues per-user notifications to queue "notifications" (batched sends)
        → notification workers (scaled on queue depth) → email/push
```

## Production patterns
- Scale data in order: tune → cache → replicas → bigger tier → partition → shard; choose shard keys by access pattern and evenness.
- Cache at the edge first, then application L1/L2, with explicit invalidation and stampede protection; watch for hot keys.
- Anything slow or fan-out-heavy goes through queues/topics with batching, idempotent consumers, and scaling on queue depth.

## Mistakes
Wrong: `shard = customerId % shardCount` with plans to "add shards later".
Right: consistent hashing or a directory, chosen before data grows, or no sharding until it's needed.

Wrong: sending 2 million notifications inside the HTTP request.
Right: publish one event; workers fan out in batches.

## Check yourself
1. Why does consistent hashing beat modulo hashing when adding nodes?
2. How do you protect a hot cache key?
3. When is a stream better than a queue?

<details><summary>Answers</summary>

1. With modulo, changing the node count remaps most keys; with consistent hashing, a new node takes over only the ring segments next to its positions (about 1/N of keys), so little data moves.
2. Spread it (split into several copies or replicate), cache it locally in each instance (L1) with short TTLs, coalesce concurrent misses, and refresh it ahead of expiry.
3. When you need ordered, retained, replayable events with many independent consumers reading at their own pace (analytics, event sourcing, telemetry), rather than work items each processed once.
</details>

## Sources
- [Consistent hashing (Karger et al.)](https://dl.acm.org/doi/10.1145/258533.258660)
- [Sharding pattern (Azure)](https://learn.microsoft.com/azure/architecture/patterns/sharding)
- [Cache-aside pattern (Azure)](https://learn.microsoft.com/azure/architecture/patterns/cache-aside)
- [Competing consumers pattern](https://learn.microsoft.com/azure/architecture/patterns/competing-consumers)
- [Event Hubs vs Service Bus](https://learn.microsoft.com/azure/service-bus-messaging/compare-messaging-services)
- [System.IO.Hashing.XxHash64](https://learn.microsoft.com/dotnet/api/system.io.hashing.xxhash64)
