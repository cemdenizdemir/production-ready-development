---
title: Outbox, messaging options, and monitoring
tech: BullMQ, Redis 8, PostgreSQL 18, OpenTelemetry
version: BullMQ 5, PostgreSQL 18, OpenTelemetry JS
date: 2026-11-07
covers: [10, 11, 12]
---
# Outbox, messaging options, and monitoring
[← Overview](00-overview.md)

## Why it matters
- The order is committed, then the process crashes before `queue.add('send-confirmation')`. The customer paid and never hears from you.
- The job is enqueued, then the transaction rolls back; a confirmation email goes out for an order that doesn't exist.
- The email queue grows from 0 to 80,000 jobs overnight because the provider's API key expired; nobody is alerted until customers complain.

## Concepts

### The dual-write problem and the transactional outbox
Writing to the database **and** a queue are two separate systems; one can succeed while the other fails. The **outbox pattern** makes the event part of the database transaction:
1. In the same transaction as the business change, insert a row into `outbox`.
2. A **relay** reads unsent rows (`FOR UPDATE SKIP LOCKED`), publishes them to BullMQ (or a broker), and marks them sent.
3. Consumers are idempotent (the relay may publish a row twice if it crashes after publishing).

```mermaid
sequenceDiagram
  participant API
  participant PG as Postgres
  participant R as Relay (worker)
  participant Q as BullMQ
  API->>PG: BEGIN; INSERT order; INSERT outbox(order.created); COMMIT
  loop every second
    R->>PG: SELECT … FROM outbox WHERE sent_at IS NULL FOR UPDATE SKIP LOCKED LIMIT 100
    R->>Q: add job (jobId = outbox.id)
    R->>PG: UPDATE outbox SET sent_at = now()
  end
```
also seen: change data capture (Debezium) reading the WAL instead of polling. On the consumer side, an **inbox** table (processed message IDs) gives the same dedupe as lesson 02.

### Messaging options
| Option | Model | Durability | Fits |
|:--|:--|:--|:--|
| Redis pub/sub | fire-and-forget broadcast | none (offline subscribers miss messages) | cache invalidation, live updates fan-out |
| Redis Streams | append-only log + consumer groups | persisted in Redis | lightweight event logs |
| **BullMQ** | job queue: retries, delays, priorities, flows | Redis (AOF) | background work inside one system (this stack) |
| AWS SQS | managed queue, visibility timeout, DLQ redrive, FIFO option | managed, durable | decoupling services, serverless consumers |
| AWS SNS / EventBridge | pub/sub fan-out / event bus with routing rules | managed | many consumers of one event, cross-team events |
| Kafka (MSK) / Redpanda | partitioned, replayable log, ordering per key | durable, retained | high-throughput event streaming, replay, analytics |
| RabbitMQ | AMQP routing (exchanges, queues) | durable | flexible routing (also seen) |

Rule of thumb: BullMQ for jobs within your app; SQS/SNS/EventBridge when events cross service or team boundaries on AWS; Kafka when you need ordered, replayable streams at scale.

### Monitoring queues
| Signal | Why | Alert when |
|:--|:--|:--|
| Waiting count (depth) per queue | backlog | growing for N minutes |
| **Age of the oldest waiting job** | latency users feel | above the queue's SLO (e.g. 5 min for email) |
| Processing time (p50/p95) | performance, regressions | sudden increases |
| Failure rate / failed count | broken dependency or bug | spikes; any failures in critical queues |
| Stalled jobs | crashes, blocked event loops | > 0 regularly |
| Throughput (completed/min) | capacity | drops to zero while waiting > 0 |
| Redis memory, connections | capacity of the queue store | near limits |

Tools: OpenTelemetry metrics/traces from workers (trace context can flow from the API request to the job), a queue dashboard (also seen: Bull Board, Taskforce.sh), and BullMQ's built-in metrics (`getMetrics`).

## Example
Outbox write inside the business transaction:
```ts
export async function placeOrder(input: PlaceOrderInput) {
  return db.transaction(async (tx) => {
    const [order] = await tx.insert(orders).values(toOrderRow(input)).returning();
    await tx.insert(outbox).values({
      topic: 'order.created',
      payload: { orderId: order!.id },              // IDs only; consumers load fresh data
    });
    return order!;
  });                                                // both commit, or neither
}
```
`src/jobs/outbox-relay.ts`
```ts
import { inArray, sql } from 'drizzle-orm';
import { db } from '#src/db.ts';
import { outbox } from '#src/db/schema.ts';
import { queuesByTopic } from './queues.ts';

export async function relayOnce(batchSize = 100) {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string; topic: string; payload: unknown }>(sql`
      SELECT id, topic, payload FROM outbox
      WHERE sent_at IS NULL
      ORDER BY id
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED`);                       // several relays can run safely
    for (const row of rows.rows) {
      await queuesByTopic[row.topic]!.add(row.topic, row.payload, { jobId: `outbox-${row.id}` }); // dedupe on replays
    }
    if (rows.rows.length) {
      await tx.update(outbox).set({ sentAt: new Date() }).where(inArray(outbox.id, rows.rows.map((r) => r.id)));
    }
    return rows.rows.length;
  });
}
// run from a job scheduler every few seconds, or in a loop with a short sleep when the batch was empty
```
Queue metrics with OpenTelemetry:
```ts
import { metrics } from '@opentelemetry/api';
import { emailQueue, reportsQueue, webhookQueue } from './queues.ts';

const meter = metrics.getMeter('queues');
const depth = meter.createObservableGauge('queue_jobs', { description: 'Jobs per state' });
const oldest = meter.createObservableGauge('queue_oldest_waiting_seconds');

depth.addCallback(async (result) => {
  for (const q of [emailQueue, reportsQueue, webhookQueue]) {
    const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed');
    for (const [state, count] of Object.entries(counts)) result.observe(count, { queue: q.name, state });
  }
});

oldest.addCallback(async (result) => {
  for (const q of [emailQueue, reportsQueue, webhookQueue]) {
    const [job] = await q.getWaiting(0, 0);          // oldest waiting job
    result.observe(job ? (Date.now() - job.timestamp) / 1000 : 0, { queue: q.name });
  }
});
```
Alert rule idea (Grafana, [10-observability](../../10-observability/README.md)): `queue_oldest_waiting_seconds{queue="email"} > 300 for 10m` → page the owning team.

## Production patterns
- **Outbox for every event that must follow a DB change**; never "commit, then enqueue" for important events.
- **Idempotent consumers** with deterministic job IDs and inbox/claim records.
- **BullMQ for in-app jobs**; managed brokers (SQS/SNS/EventBridge) for cross-service events; Kafka only when you need its guarantees.
- **Dashboards and alerts per queue**: depth, oldest-job age, failure rate, stalls, throughput.
- **Outbox cleanup**: delete or archive sent rows after a retention period.

## Mistakes
Wrong: dual writes.
```ts
await db.insert(orders).values(row);
await emailQueue.add('confirmation', { orderId }); // crash between the two = lost email
```
Right: insert an outbox row in the same transaction; the relay enqueues.

Wrong: Redis pub/sub for work that must not be lost. Offline subscribers miss messages. Right: a queue or stream.

Wrong: alerting only on failures. A stuck worker produces no failures, just a growing backlog. Right: alert on oldest-job age and depth growth too.

Wrong: Kafka for a single app's email jobs. Heavy to run and the wrong abstraction. Right: BullMQ.

## Check yourself
1. What is the dual-write problem, and how does the outbox solve it?
2. When is Redis pub/sub enough, and when isn't it?
3. Why is "age of the oldest waiting job" a better alert than queue depth alone?

<details>
<summary>Answers</summary>

1. Writing to two systems (DB and queue) can't be atomic, so one may succeed and the other fail. The outbox stores the event in the same DB transaction as the change; a relay later publishes it, so the event exists if and only if the change committed.
2. Enough for ephemeral notifications where missing a message is fine (cache invalidation, live UI pushes). Not for work that must happen: messages aren't stored, so disconnected or slow subscribers lose them.
3. It measures what users experience (how long work waits), regardless of volume; a big but fast-moving queue is fine, while a small queue whose oldest job is an hour old means something is stuck.
</details>

## Sources
- [microservices.io — Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [Debezium — Outbox event router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html)
- [BullMQ — Metrics](https://docs.bullmq.io/guide/metrics)
- [AWS — Choosing between SQS, SNS, and EventBridge](https://aws.amazon.com/blogs/compute/choosing-between-messaging-services-for-serverless-applications/)
- [Redis — Pub/Sub](https://redis.io/docs/latest/develop/interact/pubsub/)
