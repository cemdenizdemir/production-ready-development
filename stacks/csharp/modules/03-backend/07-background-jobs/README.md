---
title: Background Jobs & Messaging
module: 03-backend
tech: BackgroundService, Channels, Hangfire, Azure Service Bus
---
# Background Jobs & Messaging
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Why background jobs: what leaves the request path and why
- [ ] ⭐ Built-in background work: `BackgroundService`, `Channel<T>` queues, scoped services inside workers
- [ ] ⭐ Hangfire basics: fire-and-forget, delayed, and recurring jobs; SQL Server storage; the dashboard
- [ ] ⭐ Retries with backoff, attempts, and unrecoverable errors
- [ ] ⭐ Idempotent jobs and the exactly-once illusion
- [ ] Delayed and scheduled jobs: job schedulers, cron patterns, time zones
- [ ] Concurrency, rate limiting, and priorities
- [ ] Job continuations: running a job after another succeeds
- [ ] Failed jobs: dead-letter handling, alerting, replaying
- [ ] Graceful shutdown and stalled jobs
- [ ] The transactional outbox pattern
- [ ] ⭐ Azure Service Bus: queues, topics and subscriptions, sessions, dead-letter queues, the local emulator
- [ ] Pub/sub and messaging options: Redis pub/sub, Azure Service Bus, Event Grid, Kafka
- [ ] Messaging libraries and licences: MassTransit 9 (commercial), Wolverine, Rebus, or the plain Azure SDK
- [ ] Monitoring queues: depth, oldest-job age, failure rate

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Why background work, BackgroundService, Channels, and shutdown](docs/01-why-builtin-shutdown.md)
- [02 · Hangfire: jobs, retries, schedules, continuations](docs/02-hangfire.md)
- [03 · Idempotent jobs, concurrency, priorities, and failures](docs/03-idempotency-concurrency-failures.md)
- [04 · The transactional outbox](docs/04-outbox.md)
- [05 · Azure Service Bus, messaging options, and monitoring queues](docs/05-service-bus-messaging-monitoring.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/07-background-jobs mode=tasks` when you are ready to build._
