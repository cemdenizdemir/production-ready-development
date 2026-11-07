---
title: Why background jobs; BullMQ basics, concurrency, priorities
tech: BullMQ, Redis 8, Express 5
version: BullMQ 5, Redis 8
date: 2026-11-07
covers: [1, 2, 6]
---
# Why background jobs; BullMQ basics, concurrency, priorities
[← Overview](00-overview.md)

## Why it matters
- Signup sends the welcome email inline; the email provider has a 10-second hiccup, and signups time out and fail.
- An invoice PDF is rendered in the request; under load it blocks the event loop and every endpoint slows down.
- A nightly import fires 50,000 calls at a partner API with 100 requests/second allowed; the partner blocks you.

## Concepts

### What belongs in a job
| Work | Why a job |
|:--|:--|
| Emails, SMS, push notifications | slow, unreliable providers; retries |
| PDFs, images, exports, imports | CPU/IO heavy, long-running |
| Outgoing webhooks | retries over hours, backoff |
| Third-party API sync | rate limits, failures |
| Scheduled maintenance | cleanup, reports, reminders |
| Fan-out | notify 10,000 users after an event |

Keep in the request: work the user must see succeed right now (validation, the DB write, payment authorization result). Everything else: enqueue and return `202` or the created resource.

### BullMQ building blocks
| Piece | Role |
|:--|:--|
| `Queue` | adds jobs (producer side); lives in your API process |
| `Worker` | processes jobs; usually a separate process/container |
| Job | `name` + `data` (JSON) + options (`attempts`, `backoff`, `delay`, `priority`, `jobId`) |
| Connection | ioredis options; workers need `maxRetriesPerRequest: null` |
| `QueueEvents` | listen to job lifecycle events across processes |
| `FlowProducer` | parent/child job trees (lesson 03) |

Job states: `waiting` → `active` → `completed` | `failed`; plus `delayed`, `prioritized`, `waiting-children`.

### Concurrency, rate limiting, priorities
| Option | Effect |
|:--|:--|
| `concurrency: 10` (worker) | up to 10 jobs at once **per worker process** (async I/O work) |
| More worker processes | horizontal scaling; CPU-heavy jobs need processes, not concurrency |
| `limiter: { max: 100, duration: 1000 }` | queue-wide rate limit across all workers |
| `priority: 1` (job) | lower number = higher priority |
| Separate queues | isolate slow/critical work (`email` vs `reports`) so one can't starve the other |
| Sandboxed processors | run job code in a child process/thread (crash isolation, CPU work) |

Job data should be **small** (IDs, not whole objects): workers load fresh data, and Redis memory stays low.

## Example
`src/jobs/connection.ts` and `queues.ts`
```ts
import { Queue } from 'bullmq';

export const connection = {
  host: process.env.REDIS_QUEUE_HOST ?? 'localhost',
  port: Number(process.env.REDIS_QUEUE_PORT ?? 6379),
  maxRetriesPerRequest: null,                       // required for workers (blocking commands)
};

export const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2_000 },  // 2 s, 4 s, 8 s, 16 s
    removeOnComplete: { age: 24 * 3600, count: 5_000 }, // don't keep every completed job forever
    removeOnFail: { age: 14 * 24 * 3600 },          // keep failures long enough to investigate
  },
});

export const reportsQueue = new Queue('reports', { connection }); // slow work isolated from emails
```
Producer: enqueue from the API and return quickly.
```ts
router.post('/auth/signup', async (req, res) => {
  const user = await users.create(SignupBody.parse(req.body));
  await emailQueue.add('welcome', { userId: user.id }, { jobId: `welcome-${user.id}` }); // jobId dedupes
  res.status(201).json(toUserDTO(user));
});
```
Custom `jobId`s must not contain `:` (BullMQ uses it as the Redis key separator and throws) and must not be plain integers; build them with `-`.
`src/jobs/email.worker.ts` — a separate process (`node src/jobs/email.worker.ts`).
```ts
import { Worker, type Job } from 'bullmq';
import { connection } from './connection.ts';
import { logger } from '#src/logger.ts';
import { sendEmail } from '#src/integrations/email.ts';
import { users } from '#src/users/users.repo.ts';

type EmailJob = { userId: string };

const worker = new Worker<EmailJob>('email', async (job: Job<EmailJob>) => {
  const user = await users.findById(job.data.userId);     // load fresh data by ID
  if (!user) return { skipped: 'user deleted' };
  switch (job.name) {
    case 'welcome':
      return sendEmail({ to: user.email, template: 'welcome', idempotencyKey: job.id! });
    default:
      throw new Error(`Unknown job ${job.name}`);
  }
}, {
  connection,
  concurrency: 20,                                         // I/O-bound: many at once per process
  limiter: { max: 50, duration: 1_000 },                   // provider limit: 50 emails/s across all workers
});

worker.on('failed', (job, err) => logger.warn({ jobId: job?.id, name: job?.name, attempts: job?.attemptsMade, err }, 'job failed'));
worker.on('error', (err) => logger.error({ err }, 'worker error')); // connection errors; must be handled
```
Priorities and delays:
```ts
await emailQueue.add('password-reset', { userId }, { priority: 1 });                 // ahead of newsletters
await emailQueue.add('newsletter', { userId, issue: 42 }, { priority: 10 });
await emailQueue.add('trial-ending', { userId }, { delay: 6 * 24 * 3600 * 1000 });   // in 6 days
```

## Production patterns
- **Workers as separate deployables** (own container/service), scaled independently from the API.
- **Small payloads with IDs**; workers read current state.
- **Queues per workload class** (critical vs bulk vs CPU-heavy) with their own concurrency and limits.
- **Retention limits** (`removeOnComplete`, `removeOnFail`) so Redis doesn't fill up.
- **Respect provider limits with `limiter`** instead of failing and retrying in loops.

## Mistakes
Wrong: slow side effects inside the request.
```ts
await sendWelcomeEmail(user); // provider outage = signup outage
res.status(201).json(user);
```
Right: enqueue, respond, let the worker retry.

Wrong: whole objects in job data.
```ts
await queue.add('invoice', { order /* 200 KB, stale by the time the job runs */ });
```
Right: `{ orderId }`, load in the worker.

Wrong: one queue for everything; a 10,000-job report backlog delays password-reset emails. Right: separate queues and priorities.

Wrong: CPU-heavy work with high `concurrency` in one process. It still runs on one thread. Right: more processes or sandboxed processors.

## Check yourself
1. Which parts of a signup should stay in the request, and which go to a job?
2. What's the difference between `concurrency` and `limiter`?
3. Why put only IDs in job data?

<details>
<summary>Answers</summary>

1. In the request: validation, creating the user, setting the session, returning the result. In jobs: the welcome email, analytics events, CRM sync, anything slow or third-party.
2. `concurrency` is how many jobs one worker process runs at the same time; `limiter` caps how many jobs the whole queue processes per time window across all workers (e.g. a provider's rate limit).
3. Payloads stay small (less Redis memory), and the worker reads current data when the job runs instead of a stale snapshot from enqueue time; it also avoids storing sensitive data in Redis.
</details>

## Sources
- [BullMQ — Quick start](https://docs.bullmq.io/readme-1)
- [BullMQ — Job IDs](https://docs.bullmq.io/guide/jobs/job-ids)
- [BullMQ — Workers and concurrency](https://docs.bullmq.io/guide/workers/concurrency)
- [BullMQ — Rate limiting](https://docs.bullmq.io/guide/rate-limiting)
- [BullMQ — Job priorities](https://docs.bullmq.io/guide/jobs/prioritized)
- [BullMQ — Auto-removal of jobs](https://docs.bullmq.io/guide/queues/auto-removal-of-jobs)
