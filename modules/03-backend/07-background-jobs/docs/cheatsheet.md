---
title: Background jobs cheatsheet
tech: BullMQ, Redis 8
version: BullMQ 5, Redis 8 (noeviction, AOF), PostgreSQL 18 (outbox), AWS SQS/SNS/EventBridge (also seen)
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Background jobs cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Move it to a job?
| Work | Job? | Why |
|:--|:--|:--|
| ⭐ Emails, SMS, push | yes | slow, flaky providers |
| PDFs, images, exports, imports | yes | CPU/IO heavy, long |
| ⭐ Outgoing webhooks | yes | retries over hours |
| Third-party API sync | yes | rate limits, outages |
| Fan-out to many users | yes | volume |
| Cleanup, reports, reminders | yes (scheduled) | periodic |
| Validation, the main DB write | no | user needs the result now |
| Payment authorization result | no | user needs the result now |

## BullMQ pieces
| Piece | Role | Note |
|:--|:--|:--|
| ⭐ `Queue` | adds jobs | lives in the API |
| ⭐ `Worker` | processes jobs | separate deployable |
| ⭐ Job | `name` + `data` + `opts` | JSON, small, IDs only |
| ⭐ Connection | ioredis options | workers: `maxRetriesPerRequest: null` |
| `QueueEvents` | lifecycle events across processes | own Redis connection |
| `FlowProducer` | parent/child job trees | flows |
| Job schedulers | cron / every-N jobs | `upsertJobScheduler` |
| Sandboxed processor | processor file path instead of a function | child process or `useWorkerThreads` |

## Job states
| State | Meaning |
|:--|:--|
| `waiting` | ready, not picked up yet |
| `prioritized` | waiting, ordered by priority |
| `delayed` | waits for a timestamp (delay, backoff) |
| `active` | a worker holds the lock |
| `waiting-children` | parent waits for its children |
| ⭐ `completed` | return value stored |
| ⭐ `failed` | attempts used up, or unrecoverable |

## Job options
| Option | Example | Note |
|:--|:--|:--|
| ⭐ `attempts` | `5` | total tries; default: no retries |
| ⭐ `backoff` | `{ type: 'exponential', delay: 2000 }` | `fixed`, `jitter`, custom strategy |
| `delay` | `60_000` | run later (ms) |
| `priority` | `1` | 1 = highest; 0 = none |
| ⭐ `jobId` | `welcome-{userId}` | dedupe while stored; no `:`, not an integer |
| `deduplication` | `{ id, ttl }` | simple, throttle (`ttl`), debounce (`extend`, `replace`) |
| ⭐ `removeOnComplete` | `{ age: 86400, count: 5000 }` | retention, seconds |
| ⭐ `removeOnFail` | `{ age: 1209600 }` | keep failures ~14 days |
| `lifo` | `true` | newest first |
| `parent` | `{ id, queue }` | manual parent link |
| `repeat` | `{ pattern }` | avoid: legacy, use job schedulers |
| `defaultJobOptions` | on `new Queue(...)` | queue-wide defaults |

## Worker options
| Option | Default | Use |
|:--|:--|:--|
| ⭐ `concurrency` | 1 | parallel jobs per process (I/O work) |
| ⭐ `limiter: { max, duration }` | none | queue-wide rate limit across all workers |
| `lockDuration` | 30 s | lock renewal window |
| `stalledInterval` | 30 s | how often stalls are checked |
| `maxStalledCount` | 1 | stall recoveries before failing |
| `useWorkerThreads` | false | sandboxed processors on threads |
| `autorun` | true | false = start later with `worker.run()` |
| `metrics: { maxDataPoints }` | off | built-in completed/failed counts |
| `removeOnComplete` / `removeOnFail` | keep all | worker-level retention |
| `telemetry` | off | OpenTelemetry via `bullmq-otel` |

## Queue methods
| Method | What it does |
|:--|:--|
| ⭐ `add(name, data, opts)` | enqueue one job |
| `addBulk([{ name, data, opts }])` | enqueue many atomically |
| `getJob(id)` | fetch one job |
| ⭐ `getJobCounts('waiting', 'active', 'failed')` | counts per state |
| `getWaiting` / `getActive` / `getDelayed` / `getFailed(start, end)` | list jobs |
| ⭐ `retryJobs({ state: 'failed', count })` | replay failed jobs in batches |
| `pause()` / `resume()` | stop/start processing for all workers |
| `clean(graceMs, limit, state)` | delete old jobs in a state |
| ⭐ `upsertJobScheduler(id, repeat, template)` | create or update a schedule |
| `getJobSchedulers()` / `removeJobScheduler(id)` | list / remove schedules |
| `getMetrics('completed')` | built-in metrics (worker `metrics` option) |
| `drain()` | avoid in prod: deletes waiting jobs |
| `obliterate({ force })` | avoid in prod: deletes the whole queue |
| ⭐ `close()` | close connections on shutdown |

## Job API (inside a processor)
| Member | Use |
|:--|:--|
| ⭐ `job.data` / `job.name` / `job.id` | payload, type, identity |
| ⭐ `job.attemptsMade` | which try this is |
| `job.updateProgress(50)` | progress for UIs and events |
| `job.log('step 2 done')` | per-job log lines |
| `job.getChildrenValues()` | parent reads child results |
| `job.moveToDelayed(ts, token)` + `throw new DelayedError()` | postpone without failing |
| `job.retry()` | replay one failed job |
| `job.remove()` | delete one job |
| `job.waitUntilFinished(queueEvents)` | avoid in HTTP handlers |

## Errors and retries
| Situation | Do | API |
|:--|:--|:--|
| ⭐ Transient: timeout, 5xx, network | throw, retry with backoff | `throw new Error(...)` |
| ⭐ Permanent: 4xx, missing record | fail now, no retries | `throw new UnrecoverableError(...)` |
| ⭐ 429 / provider limit | pause the queue, retry without using an attempt | `await worker.rateLimit(ms)` + `throw Worker.RateLimitError()` |
| Not ready yet | postpone | `moveToDelayed` + `DelayedError` |
| Children added inside the processor | park the parent | `moveToWaitingChildren` + `WaitingChildrenError` |
| Bug in your code | alert, fix, replay | `retryJobs` |
| avoid | catch and return success | work silently skipped |

## Backoff math (exponential, 1 s base)
| `attempts` | Keeps retrying for about |
|:--|:--|
| 5 | 15 s |
| 8 | 2 min |
| 10 | 8.5 min |
| 12 | 34 min |
| 15 | 4.5 h |

## Idempotency
| Technique | Example |
|:--|:--|
| ⭐ Assume at-least-once | every handler safe to run twice |
| ⭐ External idempotency keys | Stripe `idempotencyKey`, email provider dedupe IDs |
| ⭐ Unique claim/done row | `INSERT … ON CONFLICT DO NOTHING RETURNING` |
| State checks | act only when status allows; update atomically |
| Upserts | `ON CONFLICT DO UPDATE` |
| Deterministic `jobId` | `welcome-{userId}`, `outbox-{id}` |
| Deterministic object keys | S3 `invoices/{orderId}.pdf` |
| One side effect per job | split charge / email / webhook |
| Inbox table | processed message IDs on the consumer side |

## Scheduling
| Need | API |
|:--|:--|
| ⭐ Once, later | `add(name, data, { delay })` |
| ⭐ Cron | `upsertJobScheduler(id, { pattern: '0 6 * * *', tz: 'Europe/Berlin' }, { name, data, opts })` |
| Every N ms | `upsertJobScheduler(id, { every: 300_000 }, template)` |
| Limited runs / window | `limit`, `startDate`, `endDate` |
| Change a schedule | upsert again with the same id |
| Remove a schedule | `removeJobScheduler(id)` |
| ⭐ Idempotent per period | claim `(kind, day)` before working |
| avoid | `setInterval` crons, legacy `repeat` option |

## Cron patterns
| Pattern | Runs |
|:--|:--|
| `*/5 * * * *` | every 5 minutes |
| `0 * * * *` | hourly |
| `0 6 * * *` | daily at 06:00 |
| `0 6 * * 1-5` | weekdays at 06:00 |
| `0 0 * * 0` | Sundays at midnight |
| `0 0 1 * *` | first day of the month |
| `0 */15 * * * *` | 6 fields: leading seconds field (every 15 min at :00) |

## Flows
| Concept | API / option |
|:--|:--|
| ⭐ Tree of jobs | `new FlowProducer({ connection }).add({ name, queueName, data, children })` |
| Order | children first (in parallel), parent last |
| ⭐ Read child results | `await job.getChildrenValues()` |
| Child fails → parent fails | `failParentOnFailure: true` |
| Child fails → parent still runs | `ignoreDependencyOnFailure` / `removeDependencyOnFailure` |
| Many flows at once | `flowProducer.addBulk([...])` |
| Inspect a tree | `flowProducer.getFlow({ id, queueName })` |

## Shutdown and stalls
| Item | Note |
|:--|:--|
| ⭐ `await worker.close()` on SIGTERM | finishes active jobs, takes no new ones |
| Hard deadline | exit before the platform kills (ECS stop timeout: 30 s default) |
| ⭐ Stalled job | lock not renewed: crash or blocked event loop |
| Recovery | back to waiting up to `maxStalledCount`, then failed |
| ⭐ CPU-heavy steps | sandboxed processors, no false stalls |
| Long jobs | checkpoint and resume, split, or a longer stop timeout |
| Stall alerts | `worker.on('stalled')` / `QueueEvents` `stalled` |

## Transactional outbox
| Step | Detail |
|:--|:--|
| ⭐ 1. Same transaction | business row + `outbox` row, commit together |
| 2. Relay reads | `SELECT … WHERE sent_at IS NULL ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED` |
| 3. Publish | `queue.add(topic, payload, { jobId: 'outbox-' + id })` |
| 4. Mark sent | `sent_at = now()` |
| 5. Clean up | delete or archive sent rows after N days |
| Table | `id uuid DEFAULT uuidv7()` (PG 18), `topic`, `payload jsonb`, `created_at`, `sent_at` |
| Index | partial index `WHERE sent_at IS NULL` |
| ⭐ Consumers | idempotent: the relay may publish twice |
| CDC alternative | Debezium reads the WAL (also seen) |

## Messaging options
| Option | Model | Use when | Note |
|:--|:--|:--|:--|
| ⭐ BullMQ | job queue on Redis | in-app background work | this stack |
| Redis pub/sub | broadcast, nothing stored | cache invalidation, live updates | offline subscribers miss messages |
| Redis Streams | log + consumer groups | lightweight event log | `XADD`, `XREADGROUP`, `XACK` |
| ⭐ AWS SQS | managed queue | decoupling services | visibility timeout, DLQ redrive, long polling |
| AWS SQS FIFO | ordered, deduplicated | ordering per group | `MessageGroupId`, lower throughput |
| AWS SNS | pub/sub fan-out | one event, many consumers | SNS → one SQS queue per consumer |
| AWS EventBridge | event bus + routing rules | cross-team and SaaS events | archive/replay, Scheduler |
| Kafka (Amazon MSK) | partitioned, replayable log | high-volume streams, replay | ordering per key, consumer groups |
| RabbitMQ | AMQP exchanges and queues | complex routing | also seen |

## Redis Streams and pub/sub commands
| Command | Use |
|:--|:--|
| `XADD key * field value` | append an entry |
| `XREADGROUP GROUP g c COUNT 10 BLOCK 5000 STREAMS key >` | consume as a group |
| `XACK` | confirm processed |
| `XPENDING` / `XAUTOCLAIM` | find and claim stuck entries |
| `XTRIM` / `XADD … MAXLEN ~ n` | cap the length |
| `XACKDEL` / `XDELEX` (8.2) | acknowledge and delete in one step |
| `XINFO GROUPS` | consumer group lag |
| `PUBLISH` / `SUBSCRIBE` / `PSUBSCRIBE` | channel and pattern broadcast |
| `SPUBLISH` / `SSUBSCRIBE` (7.0+) | sharded pub/sub for clusters |

## Redis for queues
| Setting | Value |
|:--|:--|
| ⭐ `maxmemory-policy` | `noeviction` (BullMQ warns otherwise) |
| ⭐ Separate instance | never the evicting cache |
| Persistence | AOF, `appendfsync everysec` |
| ⭐ Worker connection | `maxRetriesPerRequest: null` |
| Queue connection in the API | `enableOfflineQueue: false` to fail fast |
| Redis Cluster | hash tag in the prefix: `prefix: '{bull}'` |
| AWS | ElastiCache (Valkey / Redis OSS), Multi-AZ |
| Memory | retention limits + small payloads |

## Monitoring
| Signal | Alert when |
|:--|:--|
| ⭐ Age of the oldest waiting job | above the queue's SLO (e.g. 5 min for email) |
| ⭐ Waiting count | growing for 10+ minutes |
| ⭐ Failure rate / failed count | spikes; any failures in critical queues |
| Throughput | 0 while jobs are waiting |
| Processing time p95 | sudden increase |
| Stalled jobs | > 0 regularly |
| Redis memory / connections | near limits |
| Tools | OpenTelemetry (`bullmq-otel`), Grafana; Bull Board, Taskforce.sh (also seen) |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `:` in a custom `jobId` | throws `Custom Id cannot contain :` | `-` or `_` |
| Integer custom `jobId` | throws `Custom Id cannot be integers` | prefix: `order-42` |
| `jobId` dedupe after removal | the same id can be added again | DB unique row for "once ever" |
| ioredis instance without `maxRetriesPerRequest: null` | `Worker` throws at startup | set it on worker connections |
| Eviction policy on the queue Redis | jobs silently disappear | `noeviction`, separate instance |
| No `worker.on('error')` | unhandled error events | always attach a listener |
| `removeOnFail: true` | failures vanish before anyone looks | age-based retention + alerts |
| Cron without `tz` | runs in server time (UTC in containers) | explicit `tz` |
| CPU-heavy processor code | false stalls, duplicate runs | sandboxed processors |
| Commit, then enqueue | events lost on crash | outbox |
| Mocked `queue.add` in tests | invalid ids/options only fail in prod | integration test against Redis |
| Legacy `repeat` jobs next to schedulers | duplicate runs | migrate, remove old repeatables |

## Sources
| Source | Link |
|:--|:--|
| BullMQ docs | https://docs.bullmq.io/ |
| BullMQ going to production | https://docs.bullmq.io/guide/going-to-production |
| BullMQ job schedulers | https://docs.bullmq.io/guide/job-schedulers |
| BullMQ job IDs | https://docs.bullmq.io/guide/jobs/job-ids |
| Transactional outbox | https://microservices.io/patterns/data/transactional-outbox.html |
| Amazon SQS | https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html |
| Redis Streams | https://redis.io/docs/latest/develop/data-types/streams/ |
