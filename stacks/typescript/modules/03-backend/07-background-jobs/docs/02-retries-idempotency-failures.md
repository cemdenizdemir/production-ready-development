---
title: Retries, idempotency, and failed jobs
tech: BullMQ, Redis 8, PostgreSQL 18
version: BullMQ 5, PostgreSQL 18
date: 2026-11-07
covers: [3, 4, 8]
---
# Retries, idempotency, and failed jobs
[← Overview](00-overview.md)

## Why it matters
- A worker sends an email, then crashes before marking the job complete; the job is retried and the customer gets the same invoice three times.
- A job fails because the order was deleted; it retries 25 times over two days, filling logs and alerts with noise.
- 3,000 webhook deliveries fail during a partner outage and sit in the failed set; nobody notices, and nobody replays them.

## Concepts

### Delivery semantics
BullMQ (like SQS, Kafka consumers, and most queues) gives **at-least-once** processing. A job can run more than once when:
- it failed after a side effect and is retried,
- the worker crashed or stalled (missed its lock renewal) and the job was moved back to waiting,
- someone replays it manually.

"Exactly once" isn't something a queue can promise for side effects in other systems. You get **effectively once** by making handlers **idempotent**.

### Making jobs idempotent
| Technique | Example |
|:--|:--|
| Idempotency keys with external APIs | Stripe `Idempotency-Key: job.id`; email provider dedupe IDs |
| A unique "done" record | `INSERT INTO email_sends (kind, user_id) … ON CONFLICT DO NOTHING`; skip if it already existed |
| State checks | only ship an order whose status is `paid`; set `shipped` atomically |
| Upserts instead of inserts | `ON CONFLICT DO UPDATE` |
| Deterministic `jobId` at enqueue | `welcome-{userId}`: duplicate adds are ignored while that job is still stored (until retention removes it) |
| Small, single-purpose steps | split "charge + email + webhook" into separate jobs |

### Retries and errors
| Error type | Examples | Handling |
|:--|:--|:--|
| Transient | timeouts, network errors, 5xx, 429 | retry with exponential backoff (+ jitter) |
| Permanent | validation errors, 4xx (except 429), missing records | `throw new UnrecoverableError(...)`: fail now, no retries |
| Rate-limited | provider says "slow down" | rate-limit the worker (`worker.rateLimit(ms)`) and retry later |
| Bugs | `TypeError` in your code | retries won't help; alert, fix, replay |

Backoff: `{ type: 'exponential', delay: 1000 }` doubles the wait each attempt (1 s, 2 s, 4 s, …); add `jitter` to spread retries, or write a custom strategy. Choose `attempts` from how long the dependency might be down: with a 1 s base, `attempts: 8` keeps retrying for about 2 minutes and `attempts: 12` for about 34 minutes. Webhooks that should retry for hours need a larger base delay or a custom strategy.

### Failed jobs are your dead-letter queue
After the last attempt, a job lands in the **failed** set with its error and stack trace.
| Practice | How |
|:--|:--|
| Alert | on failure rate and failed-count growth per queue |
| Inspect | dashboard (also seen: Bull Board), `queue.getFailed()` |
| Fix, then replay | `job.retry()`, or `queue.retryJobs({ state: 'failed' })` after the fix |
| Keep long enough | `removeOnFail: { age: 14 days }` |
| Separate DLQ (optional) | copy exhausted jobs to a `*-dlq` queue in `worker.on('failed')` for long-term handling |

## Example
`src/jobs/invoice.worker.ts` — idempotent with a unique record and an external idempotency key.
```ts
import { UnrecoverableError, Worker } from 'bullmq';
import { connection } from './connection.ts';
import { db } from '#src/db.ts';
import { sql } from 'drizzle-orm';

new Worker<{ orderId: string }>('invoices', async (job) => {
  const order = await orders.findById(job.data.orderId);
  if (!order) throw new UnrecoverableError(`Order ${job.data.orderId} not found`); // permanent: no retries
  if (order.status !== 'paid') return { skipped: `status ${order.status}` };

  // Claim the work: only one execution may proceed to send
  const claimed = await db.execute(sql`
    INSERT INTO invoice_sends (order_id, job_id) VALUES (${order.id}, ${job.id})
    ON CONFLICT (order_id) DO NOTHING RETURNING order_id`);
  if (claimed.rowCount === 0) return { skipped: 'already sent' };

  try {
    const pdfKey = await invoices.render(order);                     // writes to S3 under a deterministic key
    await email.send({ to: order.customerEmail, template: 'invoice', attachments: [pdfKey], idempotencyKey: `invoice:${order.id}` });
  } catch (err) {
    await db.execute(sql`DELETE FROM invoice_sends WHERE order_id = ${order.id} AND job_id = ${job.id}`); // release the claim
    throw err;                                                       // transient: let BullMQ retry
  }
}, { connection, concurrency: 5 });
```
Classifying HTTP errors in an integration job:
```ts
import { UnrecoverableError, Worker } from 'bullmq';

export async function callPartner(url: string, body: unknown, worker: Worker) {
  const res = await fetch(url, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  if (res.ok) return res.json();
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after') ?? 30) * 1000;
    await worker.rateLimit(retryAfter);                              // pause this queue
    throw Worker.RateLimitError();                                   // job goes back without using an attempt
  }
  if (res.status >= 400 && res.status < 500) throw new UnrecoverableError(`Partner rejected request: ${res.status}`);
  throw new Error(`Partner error ${res.status}`);                    // 5xx: retry with backoff
}
```
Replaying failures after a fix:
```ts
const failed = await webhookQueue.getFailed(0, 999);
console.log(failed.length, 'failed jobs', failed.slice(0, 3).map((j) => j.failedReason));
await webhookQueue.retryJobs({ state: 'failed', count: 500 });       // move them back to waiting in batches
```

## Production patterns
- **Assume every job runs twice**; design handlers to be idempotent from the start.
- **Deterministic `jobId`s** for "do this once per X" jobs; idempotency keys for external side effects.
- **Classify errors**: retry transient ones with backoff, fail permanent ones immediately, rate-limit on 429.
- **The failed set is monitored**, inspected, and replayed after fixes; failures are kept for weeks.
- **One side effect per job** where possible, so a retry repeats as little as possible.

## Mistakes
Wrong: non-idempotent side effects.
```ts
async (job) => { await stripe.paymentIntents.create({ amount, currency: 'eur', customer }); } // retry = second charge
```
Right: pass an idempotency key as the second argument (``{ idempotencyKey: `charge-${job.data.orderId}` }``) and record completion.

Wrong: retrying permanent errors.
```ts
if (!order) throw new Error('not found'); // retried 10 times for nothing
```
Right: `throw new UnrecoverableError(...)`.

Wrong: `removeOnFail: true`. Failures vanish before anyone sees them. Right: keep them with an age limit, alert on them.

Wrong: catching errors and returning success to "stop retries". The work silently didn't happen. Right: fail (unrecoverable if permanent) so it's visible.

## Check yourself
1. Name three ways a job can run more than once.
2. How do you stop retries for a permanent error in BullMQ?
3. What makes the invoice worker above safe to run twice?

<details>
<summary>Answers</summary>

1. Retry after a failure that happened after a side effect; stalled-job recovery after a worker crash or blocked event loop; manual replay; duplicate enqueues without a deterministic `jobId`.
2. Throw `UnrecoverableError`: the job moves to failed immediately without using remaining attempts.
3. It claims the order with a unique row before sending (a second run finds the claim and skips), uses a deterministic S3 key and an email idempotency key, and releases the claim only if sending failed, so a retry can try again.
</details>

## Sources
- [BullMQ — Retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [BullMQ — Stop retrying jobs (UnrecoverableError)](https://docs.bullmq.io/patterns/stop-retrying-jobs)
- [BullMQ — Idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs)
- [BullMQ — Rate limiting (manual)](https://docs.bullmq.io/guide/rate-limiting#manual-rate-limit)
- [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
