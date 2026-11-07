---
title: Replication, partitioning, and time
tech: PostgreSQL 18, Redis 8
version: PostgreSQL 18 (streaming and logical replication), Redis 8 / Valkey replication; Cassandra, DynamoDB (also seen)
date: 2026-11-07
covers: [4, 5, 6]
---
# Replication, partitioning, and time
[← Overview](00-overview.md)

## Why it matters
- After a failover, the new primary is missing the last few seconds of writes from the old one (asynchronous replication). Two orders vanish.
- Two servers stamp events with their local clocks. One clock is 3 seconds fast, and "last write wins" keeps the older update.
- A cluster is partitioned by country; 60% of customers are in one country, so one partition melts while the others idle.

## Concepts

### Replication
| Style | How | Pros | Cons | Examples |
|:--|:--|:--|:--|:--|
| Single leader | writes to one leader, followers copy | simple, no write conflicts | leader is a bottleneck; failover | Postgres, MySQL, Redis/Valkey |
| Multi-leader | several nodes accept writes | multi-region writes, offline clients | write conflicts to resolve | multi-region setups, collaborative apps |
| Leaderless | clients write/read to several replicas with quorums | no failover, high availability | eventual consistency, read repair | Cassandra, DynamoDB-style |

| Setting | Effect |
|:--|:--|
| Synchronous replication | no data loss on failover; writes wait for a replica (latency) |
| Asynchronous replication | fast writes; recent writes can be lost on failover; replica lag |
| Semi-synchronous | wait for one replica, others async |
| Quorums (N, W, R) | W + R > N gives overlapping reads and writes (e.g. N=3, W=2, R=2) |

Replication lag shows up as stale reads, non-monotonic reads (newer then older), and causality violations (a reply before the post). Fixes: read-your-writes routing, sticky sessions per replica, reading from the leader for critical paths.

RDS Multi-AZ (instance) uses synchronous replication to a standby; RDS read replicas are asynchronous.

### Partitioning (sharding)
| Strategy | Good | Watch out |
|:--|:--|:--|
| Key range | range scans | hot ranges (recent timestamps) |
| Hash of key | even load | no efficient range queries |
| Consistent hashing | minimal movement when nodes change | needs virtual nodes |
| Composite (hash + range) | partition by tenant, sort by time | design per access pattern |

| Concern | Approach |
|:--|:--|
| Secondary indexes | local (per partition, scatter-gather reads) or global (partitioned by term, async updates) |
| Rebalancing | fixed number of partitions moved between nodes, or dynamic splitting |
| Routing | client-side, proxy/router, or coordination service |
| Skew and hot spots | better keys, splitting hot keys, caching |

### Time and ordering
| Concept | Meaning |
|:--|:--|
| Physical (wall-clock) time | drifts and jumps; NTP keeps clocks within milliseconds, not exactly |
| Monotonic clock | only moves forward; use for durations (`performance.now()`), never for ordering across machines |
| Lamport clock | counter incremented on each event, max-merged on messages; gives a total order consistent with causality |
| Vector clock | one counter per node; detects concurrent (conflicting) updates |
| Hybrid logical clock (HLC) | physical time + logical counter; used by CockroachDB, MongoDB |
| TrueTime | bounded clock uncertainty with atomic clocks/GPS (Spanner) |
| Last write wins (LWW) | resolve conflicts by timestamp; simple, silently drops concurrent writes |
| CRDTs | data types that merge without conflicts (counters, sets, text) (also seen: Automerge, Yjs) |

Practical rules: order events **within one partition or aggregate** with a sequence or version number, use database-generated timestamps from a single source when possible, and never trust client clocks for ordering.

## Example
A Lamport clock, the core idea in a few lines:
```ts
export class LamportClock {
  #time = 0;
  tick(): number { return ++this.#time; }                        // local event or before sending
  receive(remote: number): number { this.#time = Math.max(this.#time, remote) + 1; return this.#time; }
}
```
Ordering per aggregate with a version, instead of timestamps:
```ts
// Each order event carries the aggregate version; consumers apply only the next expected version
export async function applyOrderEvent(tx: Tx, e: { orderId: string; version: number; status: OrderStatus }) {
  const updated = await tx.update(orderSummaries).set({ status: e.status, version: e.version })
    .where(and(eq(orderSummaries.orderId, e.orderId), eq(orderSummaries.version, e.version - 1)))
    .returning({ id: orderSummaries.orderId });
  if (updated.length === 0) {
    const [current] = await tx.select({ version: orderSummaries.version }).from(orderSummaries).where(eq(orderSummaries.orderId, e.orderId));
    if (current && current.version >= e.version) return;          // duplicate or old event: ignore
    throw new Error(`gap before version ${e.version} for ${e.orderId}: retry later`); // out of order: let the job retry
  }
}
```
Checking replica lag in Postgres:
```sql
-- on the primary: how far behind each replica is
SELECT application_name, state, write_lag, flush_lag, replay_lag FROM pg_stat_replication;

-- on a replica: time since the last replayed transaction
SELECT now() - pg_last_xact_replay_timestamp() AS replica_delay;
```

## In our stack
- Postgres replicas and partitioning: [03-backend/09-scalability lesson 03](../../../03-backend/09-scalability/docs/03-scaling-postgresql.md); RDS Multi-AZ vs read replicas: [04-shipping/02-cloud lesson 03](../../../04-shipping/02-cloud/docs/03-managed-data.md).
- Consistent hashing: [06-system-design lesson 03](../../06-system-design/docs/03-scaling-async-reliability.md).
- Optimistic concurrency with versions: [05-domain-driven-design lesson 04](../../05-domain-driven-design/docs/04-persistence-clean-architecture.md).

## When not to
- No multi-leader or leaderless replication for a single-region business app; a single leader with Multi-AZ failover is simpler and safer.
- No vector clocks in application code unless you're building offline-first sync; versions per aggregate are enough for most ordering needs.

## Production patterns
- **Single leader + synchronous standby (Multi-AZ)** for durability; async replicas only for stale-tolerant reads.
- **Replica lag monitored and alerted**, with read-your-writes routing.
- **Partition keys from access patterns**, with skew checked against real data.
- **Ordering by per-aggregate versions or sequences**, never by machine clocks.

## Mistakes
Wrong: last-write-wins by `Date.now()` from different servers. Clock skew silently drops updates. Right: versions, or a single timestamp source with conflict detection.

Wrong: reading from async replicas immediately after writes. Right: primary for read-after-write.

Wrong: partitioning by a low-cardinality key (country, status). Right: high-cardinality keys (tenant ID, user ID) with skew analysis.

## Check yourself
1. What can be lost when an asynchronous replica is promoted after a primary failure?
2. With N=3 replicas, which W and R values guarantee a read overlaps the latest write?
3. Why shouldn't you order events from different servers by wall-clock timestamps?

<details>
<summary>Answers</summary>

1. Writes the primary acknowledged but hadn't yet shipped to the replica. With asynchronous replication they're gone after failover (unless recovered from the old primary), which is why Multi-AZ uses synchronous replication.
2. Any with W + R > N, for example W=2 and R=2 (or W=3, R=1): every read quorum shares at least one replica with every write quorum.
3. Clocks drift and jump, so a later event can carry an earlier timestamp. Ordering by them reorders events and lets last-write-wins discard the newer update. Use per-aggregate versions, sequences, or logical clocks.
</details>

## Sources
- [Martin Kleppmann — Designing Data-Intensive Applications (ch. 5, 6, 8)](https://dataintensive.net/)
- [PostgreSQL — High availability, load balancing, and replication](https://www.postgresql.org/docs/current/high-availability.html)
- [Leslie Lamport — Time, clocks, and the ordering of events](https://lamport.azurewebsites.net/pubs/time-clocks.pdf)
- [Kulkarni et al. — Hybrid logical clocks](https://cse.buffalo.edu/tech-reports/2014-04.pdf)
- [CRDT.tech — Conflict-free replicated data types](https://crdt.tech/)
