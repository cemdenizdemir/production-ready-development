---
title: Reliability & Resilience
module: 03-backend
tech: Node.js 26, Express 5, BullMQ
---
# Reliability & Resilience
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Failure modes and designing for failure: slow and failed dependencies, overload, bad deploys
- [ ] ⭐ Timeouts everywhere: HTTP clients, database, Redis, server, request deadlines
- [ ] ⭐ Retries with exponential backoff and jitter; retry budgets; only retry what is safe
- [ ] ⭐ Health checks: liveness, readiness, startup
- [ ] ⭐ Graceful shutdown and zero-downtime deploys: SIGTERM, draining, ECS and ALB settings
- [ ] Circuit breakers and failing fast
- [ ] Bulkheads: isolating pools, queues, and concurrency
- [ ] Load shedding and backpressure: 503, `Retry-After`, bounded queues
- [ ] Graceful degradation and fallbacks: stale data, defaults, kill switches, partial responses
- [ ] SLIs, SLOs, and error budgets; burn-rate alerts
- [ ] Handling dependency outages: database failover, Redis down, third-party APIs
- [ ] Testing failure: fault injection, chaos experiments, game days

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Failure modes, timeouts, and retries](docs/01-failure-modes-timeouts-retries.md)
- [02 · Health checks and graceful shutdown](docs/02-health-checks-and-shutdown.md)
- [03 · Circuit breakers, bulkheads, and load shedding](docs/03-breakers-bulkheads-load-shedding.md)
- [04 · Degradation, dependency outages, SLOs, and failure testing](docs/04-degradation-slos-failure-testing.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn typescript/03-backend/08-reliability mode=tasks` when you are ready to build._
