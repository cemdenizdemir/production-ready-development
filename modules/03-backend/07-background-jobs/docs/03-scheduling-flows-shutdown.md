---
title: Scheduling, flows, and graceful shutdown
tech: BullMQ, Redis 8, Node.js 26
version: BullMQ 5 (job schedulers), Node.js 26 LTS
date: 2026-11-07
covers: [5, 7, 9]
---
# Scheduling, flows, and graceful shutdown
[← Overview](00-overview.md)

## Why it matters
- A `setInterval` cron in the API runs on every instance; with 6 instances, the daily report email goes out 6 times.
- A report needs data from three slow sources; one job does everything sequentially, takes 20 minutes, and starts over from zero on any failure.
- Each deploy kills workers mid-job; jobs are marked stalled, retried, and half-done work is repeated.

## Concepts

### Delayed and scheduled jobs
| Need | BullMQ |
|:--|:--|
| Run once, later | `queue.add(name, data, { delay: ms })` |
| Run on a schedule (cron) | `queue.upsertJobScheduler(id, { pattern: '0 6 * * *', tz: 'Europe/Berlin' }, template)` |
| Run every N ms | `upsertJobScheduler(id, { every: 300_000 }, template)` |
| Change or remove a schedule | call `upsertJobScheduler` again with the same ID / `removeJobScheduler(id)` |
| List schedules | `getJobSchedulers()` |

Job schedulers are stored in Redis and produce one job per tick, no matter how many API or worker instances exist. Upserting at startup is idempotent. They replace the older "repeatable jobs" API.

Time zones: give cron patterns an explicit `tz`; schedules around DST changes can skip or repeat an hour, so make scheduled jobs idempotent per period (e.g. key `report:2026-11-07`).

### Flows: parent and child jobs
A **flow** is a tree: children run first (in parallel, possibly on different queues); the parent runs when all children complete and can read their results (`job.getChildrenValues()`).

| Use | Example |
|:--|:--|
| Fan-out / fan-in | fetch three data sources, then assemble a report |
| Multi-step pipelines | transcode → thumbnail → notify |
| Partial retries | only the failed child retries, not the whole pipeline |

Options decide what a failing child does to its parent (fail the parent, or ignore/continue).

### Graceful shutdown and stalled jobs
| Concept | Meaning |
|:--|:--|
| Lock | an active job holds a lock that the worker renews periodically (`lockDuration`, default 30 s) |
| Stalled job | lock expired (worker crashed, or event loop blocked too long); BullMQ moves it back to waiting (up to `maxStalledCount`, default 1), then fails it |
| `worker.close()` | stops taking new jobs and waits for active ones to finish |
| SIGTERM handling | call `worker.close()` within the platform's stop timeout |
| Long jobs | make them resumable/checkpointed, or split them; give the container a longer stop timeout |

A blocked event loop (CPU-heavy job code) stops lock renewal and causes false "stalled" detections: move CPU work to sandboxed processors.

## Example
`src/jobs/schedules.ts` — run at worker startup; idempotent.
```ts
import { reportsQueue, maintenanceQueue } from './queues.ts';

export async function registerSchedules() {
  await reportsQueue.upsertJobScheduler(
    'daily-sales-report',
    { pattern: '0 6 * * *', tz: 'Europe/Berlin' },          // 06:00 Berlin time, DST-aware
    { name: 'daily-sales-report', data: {}, opts: { attempts: 3 } },
  );
  await maintenanceQueue.upsertJobScheduler(
    'cleanup-idempotency-keys',
    { every: 60 * 60 * 1000 },                              // hourly
    { name: 'cleanup-idempotency-keys' },
  );
}
```
The scheduled job keys its work by period, so a duplicate tick is harmless:
```ts
async function dailySalesReport(job: Job) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(job.timestamp); // YYYY-MM-DD
  const created = await reports.claim('daily-sales', day);   // unique (kind, day)
  if (!created) return { skipped: `already generated for ${day}` };
  return reports.generateDailySales(day);
}
```
A flow: three children, one parent.
```ts
import { FlowProducer } from 'bullmq';
import { connection } from './connection.ts';

const flows = new FlowProducer({ connection });

export async function startQuarterlyReport(accountId: string, quarter: string) {
  return flows.add({
    name: 'assemble-quarterly-report',
    queueName: 'reports',
    data: { accountId, quarter },
    children: [
      { name: 'fetch-sales', queueName: 'reports', data: { accountId, quarter }, opts: { attempts: 5 } },
      { name: 'fetch-refunds', queueName: 'reports', data: { accountId, quarter }, opts: { attempts: 5 } },
      { name: 'fetch-ad-spend', queueName: 'integrations', data: { accountId, quarter }, opts: { attempts: 8 } },
    ],
  });
}

// in the reports worker:
async function assemble(job: Job) {
  const parts = await job.getChildrenValues();               // { 'bull:reports:<id>': {…}, … }
  return reports.build(job.data, Object.values(parts));
}
```
Graceful worker shutdown:
```ts
const workers = [emailWorker, reportsWorker];

async function shutdown(signal: string) {
  logger.info({ signal }, 'closing workers');
  const deadline = setTimeout(() => process.exit(1), 25_000); // below the platform stop timeout
  deadline.unref();
  await Promise.all(workers.map((w) => w.close()));          // finish active jobs, take no new ones
  await Promise.all([emailQueue.close(), reportsQueue.close()]);
  process.exitCode = 0;
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
```

## Production patterns
- **Schedules in BullMQ job schedulers**, upserted at startup, with explicit time zones; never `setInterval` crons in multi-instance apps.
- **Scheduled work idempotent per period** (claim by day/hour).
- **Flows for multi-step work**, so failures retry the failed step only.
- **`worker.close()` on SIGTERM** within the stop timeout; long jobs checkpoint or get a longer timeout.
- **Keep the worker's event loop free**; CPU-heavy steps in sandboxed processors to avoid false stalls.

## Mistakes
Wrong: in-process timers as cron.
```ts
setInterval(sendDailyDigest, 24 * 3600 * 1000); // runs on every instance, drifts, lost on restart
```
Right: `upsertJobScheduler` with a cron pattern and time zone.

Wrong: one giant job for a multi-source report. Right: a flow with child jobs.

Wrong: no SIGTERM handling in workers. Every deploy creates stalled jobs and repeated work. Right: `await worker.close()` in the shutdown handler.

Wrong: old repeatable-job code (`repeat: { cron }`) copied from tutorials. Right: job schedulers in BullMQ 5.

## Check yourself
1. Why are BullMQ job schedulers safe with many instances, unlike `setInterval`?
2. What happens to a parent job when its children complete?
3. What causes a "stalled" job, and how do you prevent false stalls?

<details>
<summary>Answers</summary>

1. The schedule lives in Redis and BullMQ creates exactly one job per tick for the queue, no matter how many processes call `upsertJobScheduler` or run workers; `setInterval` runs independently in every process.
2. It moves from `waiting-children` to `waiting`, a worker processes it, and it can read the children's return values with `getChildrenValues()`.
3. The job's lock wasn't renewed in time, because the worker died or its event loop was blocked. Prevent false stalls by keeping job code non-blocking (sandboxed processors for CPU work) and setting `lockDuration` appropriately.
</details>

## Sources
- [BullMQ — Job schedulers](https://docs.bullmq.io/guide/job-schedulers)
- [BullMQ — Delayed jobs](https://docs.bullmq.io/guide/jobs/delayed)
- [BullMQ — Flows](https://docs.bullmq.io/guide/flows)
- [BullMQ — Stalled jobs](https://docs.bullmq.io/guide/workers/stalled-jobs)
- [BullMQ — Graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown)
