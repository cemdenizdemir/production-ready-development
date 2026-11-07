---
title: Consensus, distributed locks, and delivery guarantees
tech: PostgreSQL 18, Redis 8, BullMQ
version: PostgreSQL 18 (advisory locks, SKIP LOCKED), Redis 8 / Valkey (SET NX PX), BullMQ 5; etcd, Raft (also seen)
date: 2026-11-07
covers: [7, 8]
---
# Consensus, distributed locks, and delivery guarantees
[← Overview](00-overview.md)

## Why it matters
- A nightly billing job takes a Redis lock with a 30-second TTL. A long GC pause makes it outlive the lock; a second instance starts, and customers are billed twice.
- A consumer marks messages as processed before doing the work. A crash in between loses the work, so "exactly-once" became "at-most-once".
- Two nodes both believe they're the leader after a network blip (split brain) and both write to the same storage.

## Concepts

### Consensus
Consensus lets a group of nodes agree on a value (a leader, a log entry) despite failures, as long as a **majority (quorum)** is reachable.
| Concept | Meaning |
|:--|:--|
| Raft / Paxos / Zab | consensus algorithms (Raft is the readable one) |
| Leader election | one node coordinates; a new one is elected if it fails |
| Replicated log | every node applies the same commands in the same order |
| Quorum | majority (3 nodes tolerate 1 failure, 5 tolerate 2) |
| Term / epoch | increasing number identifying the current leader period |
| Where it lives | etcd, Consul, ZooKeeper, Kafka KRaft, CockroachDB, Spanner (also seen) |

You almost never implement consensus; you use a system that does, or you use your database's guarantees.

### Distributed locks and leases
| Approach | Safety | Use |
|:--|:--|:--|
| Postgres advisory lock (session or transaction) | strong within one database | migrations, singleton jobs |
| `SELECT … FOR UPDATE SKIP LOCKED` | strong, per row | work queues in Postgres, outbox relays |
| Unique constraint "claim" rows | strong | once-per-key work |
| Redis `SET key token NX PX ttl` | **lease**: best effort (pauses, failover, clock issues) | efficiency (avoid duplicate work), not correctness |
| Redlock (several Redis nodes) | debated; still a lease | also seen |
| etcd/ZooKeeper leases + fencing | strong with fencing tokens | coordination at scale |

**Fencing tokens**: every lock grant returns an increasing number; the protected resource rejects requests carrying a token older than the newest it has seen. This makes leases safe even if a holder pauses past its expiry.

Rule: if a duplicate execution would be **incorrect** (double billing), don't rely on a lease alone; make the work idempotent or enforce uniqueness in the database.

### Delivery guarantees
| Guarantee | Meaning | How |
|:--|:--|:--|
| At-most-once | may be lost, never duplicated | ack before processing |
| **At-least-once** | never lost, may be duplicated | ack after processing; retries |
| Exactly-once *delivery* | not achievable in general across a network | — |
| **Effectively-once processing** | duplicates arrive but have no extra effect | at-least-once + idempotent consumer (dedupe store, idempotency keys, upserts) |
| Exactly-once within a system | transactional reads/writes in one system | Kafka transactions, outbox + dedupe in one database |

Ordering guarantees are separate: most queues give no global order; streams order **per partition/key**.

## Example
A singleton job with a Postgres advisory lock (strong, released automatically if the session dies):
```ts
export async function runExclusively(pool: Pool, lockKey: number, job: () => Promise<void>): Promise<boolean> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [lockKey]);
    if (!rows[0]?.locked) return false;              // another instance is running it
    try { await job(); } finally { await client.query('SELECT pg_advisory_unlock($1)', [lockKey]); }
    return true;
  } finally {
    client.release();
  }
}
```
A Redis lease used only to avoid duplicate *effort*, plus a database guarantee for correctness:
```ts
import { randomUUID } from 'node:crypto';

export async function billMonth(accountId: string, month: string) {
  const token = randomUUID();
  const gotLease = await redis.set(`lease:billing:${accountId}:${month}`, token, { NX: true, PX: 60_000 });
  if (!gotLease) return { skipped: 'another worker is on it' };          // saves effort, not a guarantee

  // Correctness: one invoice per (account, month) enforced by a unique constraint
  const inserted = await db.execute(sql`
    INSERT INTO invoices (account_id, month, status) VALUES (${accountId}, ${month}, 'pending')
    ON CONFLICT (account_id, month) DO NOTHING RETURNING id`);
  if (inserted.rowCount === 0) return { skipped: 'already billed' };
  await chargeInvoice(inserted.rows[0].id, { idempotencyKey: `invoice-${accountId}-${month}` });
}
```
An idempotent consumer: dedupe and effect in one transaction (effectively-once):
```ts
new Worker<{ eventId: string; orderId: string }>('order-paid', async (job) => {
  await db.transaction(async (tx) => {
    const fresh = await tx.insert(processedMessages).values({ consumer: 'loyalty', messageId: job.data.eventId })
      .onConflictDoNothing().returning();
    if (fresh.length === 0) return;                               // duplicate delivery: no effect
    await loyaltyRepo.awardPoints(tx, job.data.orderId);          // the effect, committed with the dedupe row
  });
}, { connection });
```

## In our stack
- `SKIP LOCKED` relays, outbox, idempotent jobs: [03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md).
- Redis locks and owner-checked release: [03-backend/06-caching lesson 02](../../../03-backend/06-caching/docs/02-invalidation-and-stampedes.md).
- Migration advisory lock: [04-shipping/04-deployments lesson 03](../../../04-shipping/04-deployments/docs/03-migrations-environments-rollbacks.md); Stripe webhook dedupe: [03-backend/12-integrations lesson 02](../../../03-backend/12-integrations/docs/02-stripe-webhooks-reconciliation.md).

## When not to
- Don't run etcd or ZooKeeper just to coordinate a few jobs; Postgres advisory locks and BullMQ job schedulers cover it.
- Don't promise "exactly-once" to anyone; promise effectively-once processing and show the dedupe mechanism.

## Production patterns
- **Correctness from the database** (unique constraints, transactions, advisory locks), leases only for efficiency.
- **Fencing tokens** where a lease protects an external resource.
- **At-least-once delivery + idempotent consumers** everywhere, dedupe and effect committed together.
- **Consensus through proven tools**, never home-grown.

## Mistakes
Wrong: a Redis TTL lock as the only protection against double billing. Pauses and failovers break it. Right: a unique constraint or idempotency key enforces the outcome.

Wrong: acknowledging (or marking processed) before doing the work. Crashes lose work. Right: process, then acknowledge; dedupe for redeliveries.

Wrong: deleting a Redis lock with plain `DEL`. You may delete another holder's lock. Right: compare-and-delete with the owner token.

## Check yourself
1. Why isn't a Redis TTL lock enough to guarantee a job runs only once?
2. What problem do fencing tokens solve?
3. How do you get effectively-once processing from an at-least-once queue?

<details>
<summary>Answers</summary>

1. A lock holder can pause (GC, CPU starvation, network partition) longer than the TTL; the lock expires, another worker acquires it, and both run. Replica failover can also lose the lock key. It's a lease that avoids most duplicates, not a correctness guarantee.
2. A paused former lock holder acting after its lease expired. Each grant carries an increasing token and the protected resource rejects tokens older than the latest it has seen, so stale holders can't do damage.
3. Make the consumer idempotent: record the message ID in a dedupe table (or use an idempotency key or upsert) in the same transaction as the effect, so redeliveries find the record and do nothing.
</details>

## Sources
- [Raft — The Raft consensus algorithm](https://raft.github.io/)
- [Martin Kleppmann — How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
- [PostgreSQL — Advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [Confluent — Exactly-once semantics in Kafka](https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/)
- [microservices.io — Idempotent consumer](https://microservices.io/patterns/communication-style/idempotent-consumer.html)
