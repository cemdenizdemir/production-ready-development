---
title: Background Jobs & Messaging
module: 03-backend
tech: BullMQ, Redis 8
---
# Background Jobs & Messaging
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Why background jobs: what leaves the request path and why
- [ ] ⭐ BullMQ basics: queues, workers, jobs, connections
- [ ] ⭐ Retries with backoff, attempts, and unrecoverable errors
- [ ] ⭐ Idempotent jobs and the exactly-once illusion
- [ ] Delayed and scheduled jobs: job schedulers, cron patterns, time zones
- [ ] Concurrency, rate limiting, and priorities
- [ ] Flows: parent and child jobs
- [ ] Failed jobs: dead-letter handling, alerting, replaying
- [ ] Graceful shutdown and stalled jobs
- [ ] The transactional outbox pattern
- [ ] Pub/sub and messaging options: Redis pub/sub, Streams, SQS/SNS, Kafka
- [ ] Monitoring queues: depth, oldest-job age, failure rate

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Why background jobs; BullMQ basics, concurrency, priorities](docs/01-why-and-bullmq-basics.md)
- [02 · Retries, idempotency, and failed jobs](docs/02-retries-idempotency-failures.md)
- [03 · Scheduling, flows, and graceful shutdown](docs/03-scheduling-flows-shutdown.md)
- [04 · Outbox, messaging options, and monitoring](docs/04-outbox-messaging-monitoring.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn typescript/03-backend/07-background-jobs mode=tasks` when you are ready to build._
