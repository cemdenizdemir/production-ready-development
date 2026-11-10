---
title: Partial failure, CAP and PACELC, consistency models
tech: PostgreSQL 18, Redis 8
version: PostgreSQL 18 (isolation levels, replicas), Redis 8 / Valkey
date: 2026-11-07
covers: [1, 2, 3]
---
# Partial failure, CAP and PACELC, consistency models
[← Overview](00-overview.md)

## Why it matters
- A request to the payment provider times out. The code assumes failure and retries; the first charge had succeeded. A timeout means "unknown", not "failed".
- A user updates their address and the confirmation page, served from a read replica, shows the old one. Support tickets follow.
- A team picks a database because it's "CP" for consistency, then runs it with settings that allow stale reads anyway.

## Concepts

### The fallacies of distributed computing
| Fallacy | Reality |
|:--|:--|
| The network is reliable | packets drop, connections reset |
| Latency is zero | every hop costs ms, tails cost seconds |
| Bandwidth is infinite | large payloads saturate links |
| The network is secure | encrypt and authenticate everything |
| Topology doesn't change | IPs, nodes, and routes change constantly |
| There is one administrator | many teams, providers, and configs |
| Transport cost is zero | serialization and data transfer cost money |
| The network is homogeneous | mixed protocols, versions, clients |

**Partial failure**: some parts work while others don't, and you often can't tell a slow node from a dead one. A remote call can succeed, fail, or end in an **unknown** state (timeout after the work happened).

### CAP and PACELC
| Theorem | Statement |
|:--|:--|
| CAP | during a network **P**artition, a system must choose **C**onsistency (refuse some requests) or **A**vailability (answer, possibly stale) |
| PACELC | if **P**artition: choose **A** or **C**; **E**lse (normal operation): choose **L**atency or **C**onsistency |

CAP's "consistency" means linearizability, and the choice only applies during partitions. PACELC is more useful day to day: even without failures, synchronous replication (consistency) costs latency.
| System (typical config) | PACELC |
|:--|:--|
| Single Postgres primary | PC/EC (no partition tolerance across nodes: one primary) |
| Postgres + async replicas (reads from replicas) | PA/EL for replica reads |
| DynamoDB (eventual reads), Cassandra (low quorum) | PA/EL |
| Spanner, CockroachDB, etcd | PC/EC |

### Consistency models (strongest → weakest)
| Model | Guarantee | Example |
|:--|:--|:--|
| Linearizable (strong) | every read sees the latest completed write; behaves like one copy | Postgres primary; etcd |
| Sequential | everyone sees operations in the same order (not necessarily real-time) | — |
| Causal | causally related operations are seen in order by everyone | replies after the posts they reply to |
| Read-your-writes | a user always sees their own writes | read from primary after a write |
| Monotonic reads | no going back in time between reads | sticky replica per session |
| Eventual | replicas converge if writes stop | DNS, caches, async replicas |

Transaction isolation (single database) is a related but different axis: read committed, repeatable read, serializable ([03-backend/03-databases lesson 03](../../../03-backend/03-databases/docs/03-transactions-pg-connections.md)).

## Example
Treat a timeout as "unknown" and resolve it, instead of retrying blindly:
```ts
export async function chargeOrder(order: Order) {
  const idempotencyKey = `order-${order.id}`;
  try {
    return await payments.charge({ orderId: order.id, amountCents: order.totalCents, idempotencyKey });
  } catch (err) {
    if (!isTimeout(err)) throw err;
    // Unknown outcome: the provider may have charged. Ask, using the same idempotency key or a lookup.
    const existing = await payments.findByOrderId(order.id);
    if (existing) return existing;                                               // it succeeded after all
    return payments.charge({ orderId: order.id, amountCents: order.totalCents, idempotencyKey }); // safe retry: same key
  }
}
```
Choosing consistency per operation in the shop:
| Operation | Needs | Read from |
|:--|:--|:--|
| Checkout stock check and reservation | linearizable | primary, in a transaction with row locks or conditional updates |
| Payment status after a webhook | read-your-writes for that user | primary |
| Product listing | eventual (seconds OK) | replica or cache |
| Account page right after an edit | read-your-writes | primary for N seconds after the write |
| Analytics dashboard | eventual (minutes OK) | read model / warehouse |

Read-your-writes with a short "stickiness" window:
```ts
export function dbForRead(req: Request): Db {
  const lastWrite = Number(req.cookies['last_write_at'] ?? 0);
  return Date.now() - lastWrite < 5_000 ? db.$primary : db;    // replicas otherwise (withReplicas from Drizzle)
}
// after any write: res.cookie('last_write_at', String(Date.now()), { httpOnly: true, sameSite: 'lax', maxAge: 10_000 })
```

## In our stack
- Timeouts, retries, idempotency keys: [03-backend/08-reliability lesson 01](../../../03-backend/08-reliability/docs/01-failure-modes-timeouts-retries.md), [03-backend/12-integrations lesson 01](../../../03-backend/12-integrations/docs/01-principles-and-stripe-payments.md).
- Replicas and read-your-writes with `db.$primary`: [03-backend/09-scalability lesson 03](../../../03-backend/09-scalability/docs/03-scaling-postgresql.md).
- Cache staleness and invalidation: [03-backend/06-caching](../../../03-backend/06-caching/README.md).

## When not to
- Don't demand strong consistency for everything; it costs latency and availability. Most reads tolerate seconds of staleness.
- Don't pick a database by its CAP label; look at its actual configuration and the consistency of the operations you run.

## Production patterns
- **Every remote call has three outcomes**: success, failure, unknown; unknowns are resolved with idempotency keys and lookups.
- **Consistency chosen per operation** and documented in the design.
- **Primary for read-after-write paths**, replicas and caches for the rest.
- **Reconciliation jobs** as the safety net for unknown outcomes.

## Mistakes
Wrong: `catch (timeout) { retry without idempotency }`. Right: same idempotency key, or check the outcome first.

Wrong: all reads from replicas, including right after writes. Right: read-your-writes routing.

Wrong: assuming "the network is reliable" between your own services in one VPC. Right: timeouts and retries on every internal call too.

## Check yourself
1. Why is a timeout not the same as a failure?
2. What does PACELC add to CAP?
3. Which consistency model does a user expect right after editing their profile, and how do you provide it with replicas?

<details>
<summary>Answers</summary>

1. The request may have reached the other side and completed; only the response was lost or late. Treating it as failure and retrying without an idempotency key can repeat the side effect; the outcome must be resolved (same idempotency key, a status lookup, or reconciliation).
2. CAP only describes the choice during network partitions. PACELC adds that in normal operation there's still a trade-off between latency and consistency (e.g. synchronous vs asynchronous replication), which affects every request, not just failures.
3. Read-your-writes. Route that user's reads to the primary for a short window after their write (or for their own data always), and let other reads use replicas.
</details>

## Sources
- [Fallacies of distributed computing](https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing)
- [Eric Brewer — CAP twelve years later](https://www.infoq.com/articles/cap-twelve-years-later-how-the-rules-have-changed/)
- [Daniel Abadi — PACELC (PDF)](https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf)
- [Jepsen — Consistency models](https://jepsen.io/consistency)
- [Martin Kleppmann — Please stop calling databases CP or AP](https://martin.kleppmann.com/2015/05/11/please-stop-calling-databases-cp-or-ap.html)
