---
title: Reliability cheatsheet
tech: Node.js 26, Express 5, BullMQ
version: Node.js 26 LTS (undici 8), Express 5.2, BullMQ 5, PostgreSQL 18, AWS ECS Fargate + ALB
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Reliability cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Failure modes
| Failure | Defense |
|:--|:--|
| ⭐ Slow dependency | timeouts, circuit breaker, bulkhead |
| Dependency down | retries, fallback, degradation |
| ⭐ Overload, retry storms | load shedding, backoff + jitter, autoscaling |
| Bad deploy | health checks, deployment circuit breaker, rollback |
| Resource exhaustion | pool limits, memory limits, bounded queues |
| Partial failure (one AZ, shard, endpoint) | redundancy, isolation |
| Cascading failure | slow spreads; make it fail fast |

## Timeouts by layer
| Layer | Setting | Default | Typical |
|:--|:--|:--|:--|
| ⭐ fetch, per attempt | `AbortSignal.timeout(ms)` | none | 0.5–10 s |
| Request deadline | `AbortSignal.any([disconnect, timeout])` | none | per route |
| undici dispatcher | `connectTimeout` / `headersTimeout` / `bodyTimeout` | 10 s / 300 s / 300 s | pass your own signal |
| ⭐ pg pool wait | `connectionTimeoutMillis` | 0 (forever) | 2–5 s |
| ⭐ Postgres queries | `statement_timeout` | 0 (off) | 5 s; `SET LOCAL` for reports |
| Postgres locks | `lock_timeout` | 0 (off) | 2 s |
| Forgotten transactions | `idle_in_transaction_session_timeout` | 0 (off) | 30 s |
| Whole transaction | `transaction_timeout` (PG 17+) | 0 (off) | per use case |
| Redis | `connectTimeout`, `disableOfflineQueue` | 5 s, queue on | fail fast |
| ⭐ Node keep-alive | `server.keepAliveTimeout` | 5 s | 65 s behind a 60 s ALB |
| Node headers | `server.headersTimeout` | 60 s | 66 s (> keep-alive) |
| Node whole request | `server.requestTimeout` | 300 s | 120 s (≥ `headersTimeout`) |
| ALB | idle timeout | 60 s | above the slowest request |

## Retry rules
| Rule | Detail |
|:--|:--|
| ⭐ Transient failures only | network errors, timeouts, 408, 429, 500, 502, 503, 504 |
| ⭐ Idempotent only | GET/PUT/DELETE, or POST with an `Idempotency-Key` |
| ⭐ Backoff + full jitter | `random(0, min(cap, base × 2^n))` |
| Few attempts in requests | 2–3, inside the budget |
| `Retry-After` | seconds or HTTP-date; cap it |
| ⭐ One layer only | 3 × 3 × 3 = 27 calls |
| Retry budget | retries ≤ ~10% of calls |
| Caller gave up | check `signal.aborted`, don't retry |
| Background jobs | let BullMQ retry (`attempts`, `backoff`) |

## Backoff variants
| Variant | Formula | Note |
|:--|:--|:--|
| Exponential | `base × 2^n` | synchronized waves without jitter |
| ⭐ Full jitter | `random(0, min(cap, base × 2^n))` | the usual choice |
| Equal jitter | `half + random(0, half)` of the exponential value | keeps a minimum wait |
| Decorrelated jitter | `min(cap, random(base, previous × 3))` | also good |

## Health checks
| Endpoint | Role | Checks |
|:--|:--|:--|
| ⭐ `/health/live` | liveness | nothing external |
| ⭐ `/health/ready` | readiness | started, not draining |
| `/health/deps` | dependency status | DB, Redis, partners; internal only |
| Startup | boot finished | grace period |
| ⭐ Rule | fail only for instance-local problems | DB down ≠ restart every task |

## ECS and ALB settings
| Setting | Default | Use |
|:--|:--|:--|
| ⭐ ALB health check path | `/` | `/health/ready` |
| Interval / healthy / unhealthy | 30 s / 5 / 2 | 10 s / 2 / 3 |
| ⭐ `deregistration_delay` | 300 s | 30–60 s |
| ⭐ ECS `stopTimeout` | 30 s | above the app deadline (max 120 s) |
| `healthCheckGracePeriodSeconds` | 0 | boot time, e.g. 60 s |
| Container `healthCheck` | none | `/health/live` via a `node -e "fetch(…)"` one-liner |
| `initProcessEnabled` | false | true |
| Deployment circuit breaker | off | `enable: true`, `rollback: true` |
| `minimumHealthyPercent` / `maximumPercent` | 100 / 200 | rolling deploys |
| ALB fail-open | always on | all targets unhealthy → traffic to all |

## Graceful shutdown
| Step | API |
|:--|:--|
| ⭐ 1. Catch the signal | `process.once('SIGTERM', …)` |
| 2. Fail readiness | flag → `/health/ready` returns 503 |
| ⭐ 3. Stop accepting | `server.close()` (also closes idle keep-alive, Node 19+) |
| 4. Finish in-flight | wait for the server `'close'` event |
| ⭐ 5. Deadline | `setTimeout(…, 25_000).unref()`, then `closeAllConnections()` or exit 1 |
| 6. Stop workers | `await worker.close()` |
| 7. Close stores | `pool.end()`, `redis.close()` |
| 8. Flush telemetry | OTel SDK `shutdown()`, `Sentry.flush()` |
| 9. Exit | `process.exitCode = 0` |
| ⭐ Container | exec form `CMD ["node", "src/server.ts"]` or an init process |

## Circuit breaker
| Item | Typical |
|:--|:--|
| ⭐ States | closed → open → half-open → closed or open |
| Trip | ≥ 50% failures, ≥ 20 calls, 10–30 s window |
| ⭐ Counts as failure | timeouts, connection errors, 5xx, 429 |
| Doesn't count | 4xx caused by your input |
| Cooldown | 10–30 s |
| Half-open trials | 1–3 calls |
| ⭐ Scope | per dependency, per instance |
| While open | fallback or fast 503 |
| Metrics | state changes, rejected calls |
| Libraries | cockatiel, opossum (also seen) |

## Bulkheads
| Resource | Bulkhead |
|:--|:--|
| ⭐ Calls per dependency | semaphore: max concurrent + max queued |
| Sockets | undici `Agent({ connections })` per host |
| DB | separate pools/roles for API, jobs, reports |
| Jobs | separate BullMQ queues and workers |
| Services | critical paths deployed separately |
| Tenants | per-tenant rate limits |
| Helpers | p-limit (also seen) |

## Load shedding and backpressure
| Technique | Detail |
|:--|:--|
| ⭐ Max in-flight per instance | 503 + `Retry-After` above N |
| ⭐ Event loop delay | `monitorEventLoopDelay()` p99 over a threshold |
| ⭐ Exempt health checks | mount them before the shedder |
| Priorities | shed low-value routes first |
| Deadline check | skip work that can't finish in time |
| Bounded queues | a max size everywhere |
| Streams | `pipeline()`; `write()` returns false → wait for `'drain'` |
| Clients | back off on 429/503 with jitter |
| Autoscaling | ECS target tracking (CPU, requests per target) |

## Graceful degradation
| Technique | Example |
|:--|:--|
| ⭐ Critical vs optional | dependency table per service |
| ⭐ `Promise.allSettled` | optional parts can't fail the page |
| Serve stale | last good value when a refresh fails |
| Defaults | empty recommendations, standard estimate |
| Partial response | `"degraded": ["reviews"]` |
| Defer | queue it in BullMQ |
| Kill switch | config or flag off under load |
| Read-only mode | browsing works while writes fail |
| Static fallback | CDN maintenance page |

## Dependency outages
| Dependency | Behavior |
|:--|:--|
| ⭐ Postgres failover (RDS Multi-AZ, 60–120 s) | `pool.on('error')`, short pool wait, retry idempotent reads |
| ⭐ Redis cache down | treat errors as misses |
| Redis for BullMQ down | `enableOfflineQueue: false`, outbox |
| Redis sessions down | authenticated routes 503, public pages fine |
| Email/SMS provider down | queue with long retries |
| Payments slow or down | timeout, clear error, idempotency keys |
| Faster DB failover | RDS Proxy, Multi-AZ DB cluster (also seen) |

## SLO math
| SLO | Bad time per 30 days | Per year |
|:--|:--|:--|
| 99% | 7.2 h | 3.65 days |
| 99.5% | 3.6 h | 1.83 days |
| ⭐ 99.9% | 43.2 min | 8.76 h |
| 99.95% | 21.6 min | 4.38 h |
| 99.99% | 4.3 min | 52.6 min |

## SLO terms
| Term | Meaning |
|:--|:--|
| ⭐ SLI | good events / valid events |
| ⭐ SLO | target for an SLI over a window |
| ⭐ Error budget | 1 − SLO |
| SLA | contract with penalties, looser than the SLO |
| Burn rate | speed of budget spend (1 = exactly on budget) |
| Error budget policy | what happens when the budget is spent |

## Burn-rate alerts (30-day SLO)
| Severity | Burn rate | Long window | Short window | Budget spent |
|:--|:--|:--|:--|:--|
| ⭐ Page | 14.4 | 1 h | 5 min | 2% |
| Page | 6 | 6 h | 30 min | 5% |
| Ticket | 1 | 3 days | 6 h | 10% |

## Failure testing
| Tool | Use |
|:--|:--|
| ⭐ MSW (`msw/node`) | 5xx, 429, `HttpResponse.error()`, `delay('infinite')` |
| `vi.useFakeTimers()` | backoff timing without waiting |
| `docker compose stop` / `pause` | local outages |
| Toxiproxy | latency, connection resets (also seen) |
| ⭐ AWS FIS | stop tasks, CPU stress, network latency, RDS failover, AZ scenarios |
| Game days | practice runbooks and alerts |
| Experiment design | hypothesis, blast radius, abort conditions |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| No timeout on `fetch` | waits up to 300 s for headers | `AbortSignal.timeout()` |
| Retrying at every layer | multiplies load during incidents | one layer, few attempts |
| Retry without jitter | synchronized waves | full jitter |
| Retrying POST after a timeout | duplicate side effects | idempotency keys |
| Deep liveness/readiness | a DB blip restarts every task | shallow checks, alert on dependencies |
| Health checks behind auth or shedding | healthy tasks replaced | mount them first |
| `npm start` as `CMD` | SIGTERM never reaches Node | exec form, init process |
| App deadline > `stopTimeout` | SIGKILL mid-cleanup | deadline below it |
| No `pool.on('error')` | crash during failover | attach the listener |
| Breaker counting 4xx | opens on bad input | `isFailure` predicate |
| Unbounded queues | memory growth, timeouts anyway | bounded, reject fast |
| SLO of 100% or on CPU | impossible or meaningless | user-journey SLIs, 99.x% |

## Sources
| Source | Link |
|:--|:--|
| Timeouts, retries, and backoff with jitter | https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/ |
| Implementing health checks | https://aws.amazon.com/builders-library/implementing-health-checks/ |
| Using load shedding to avoid overload | https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/ |
| ECS task lifecycle | https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-lifecycle-explanation.html |
| Addressing cascading failures | https://sre.google/sre-book/addressing-cascading-failures/ |
| Alerting on SLOs | https://sre.google/workbook/alerting-on-slos/ |
| AWS Fault Injection Service | https://docs.aws.amazon.com/fis/latest/userguide/what-is.html |
