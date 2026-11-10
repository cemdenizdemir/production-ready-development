---
title: Reliability & Resilience
module: 03-backend
tech: Microsoft.Extensions.Http.Resilience (Polly 8), ASP.NET Core health checks, Hangfire
---
# Reliability & Resilience
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Failure modes and designing for failure: slow and failed dependencies, overload, bad deploys
- [ ] ⭐ Timeouts everywhere: HTTP clients, database, Redis, server, request deadlines
- [ ] ⭐ Retries with exponential backoff and jitter; retry budgets; only retry what is safe
- [ ] ⭐ Resilience pipelines with Microsoft.Extensions.Http.Resilience: the standard handler, retry, circuit breaker, timeout, hedging
- [ ] `IHttpClientFactory`: named and typed clients, handler lifetimes, socket exhaustion
- [ ] ⭐ Health checks with ASP.NET Core: liveness, readiness, startup; tagged dependency checks
- [ ] ⭐ Graceful shutdown and zero-downtime deploys: SIGTERM, draining, shutdown timeouts, Container Apps revisions
- [ ] Circuit breakers and failing fast
- [ ] Bulkheads: isolating pools, queues, and concurrency
- [ ] Load shedding and backpressure: 503, `Retry-After`, bounded queues
- [ ] Graceful degradation and fallbacks: stale data, defaults, kill switches, partial responses
- [ ] SLIs, SLOs, and error budgets; burn-rate alerts
- [ ] Handling dependency outages: database failover, Redis down, third-party APIs
- [ ] Testing failure: fault injection, chaos experiments, game days

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Failure modes, timeouts, and retries](docs/01-failure-timeouts-retries.md)
- [02 · Resilience pipelines, circuit breakers, and IHttpClientFactory](docs/02-resilience-pipelines-httpclient.md)
- [03 · Health checks and graceful shutdown](docs/03-health-checks-shutdown.md)
- [04 · Bulkheads, load shedding, degradation, and dependency outages](docs/04-bulkheads-shedding-degradation.md)
- [05 · SLOs, error budgets, and testing failure](docs/05-slos-testing-failure.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/08-reliability mode=tasks` when you are ready to build._
