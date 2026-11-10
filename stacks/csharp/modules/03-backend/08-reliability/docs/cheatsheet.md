---
title: Reliability & Resilience cheatsheet
tech: Microsoft.Extensions.Http.Resilience (Polly 8), ASP.NET Core health checks, Hangfire
version: Microsoft.Extensions.Http.Resilience 10.x, Polly 8.x, ASP.NET Core 10
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
---
# Reliability & Resilience cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Failure modes
| Failure | Defence | Note |
|:--|:--|:--|
| ⭐ slow dependency | timeouts, bulkheads, breaker | worse than dead |
| failed dependency | retry transient, fallback | |
| ⭐ overload | shedding, autoscale, backpressure | |
| ⭐ bad deploy | probes, canary, rollback | most common cause |
| pool exhaustion | async, limits, `ct` everywhere | threads, SQL, sockets |
| partial failure | replicas, zones, readiness | |
| bad config | validate at startup | `ValidateOnStart()` |
| poison data | validation, DLQ | |

## Timeouts
| Layer | Setting | Default |
|:--|:--|:--|
| ⭐ server request | `AddRequestTimeouts`, `.WithRequestTimeout(...)` | none |
| request attribute | `[RequestTimeout("policy")]` | controllers |
| ⭐ outgoing HTTP | standard handler total / attempt | 30 s / 10 s |
| `HttpClient.Timeout` | client-level | 100 s |
| ⭐ EF Core command | `sql.CommandTimeout(15)` | 30 s |
| SqlClient connect | `Connect Timeout=15` | 15 s |
| Redis | `ConnectTimeout`, `SyncTimeout`, `AsyncTimeout` | 5 s |
| Container Apps ingress | request timeout | 240 s, fixed |
| browser | `AbortSignal.timeout(ms)` | none |
| deadline propagation | pass `CancellationToken` / `RequestAborted` | |

## Retries
| Rule | Why | Note |
|:--|:--|:--|
| ⭐ transient only | 5xx, 408, 429, timeouts | never 4xx logic errors |
| ⭐ idempotent only | duplicates | idempotency keys for POST |
| ⭐ backoff + jitter | no thundering herd | `UseJitter = true` |
| `Retry-After` | server hint | honoured by default |
| one layer | 4 × 4 × 4 = 64 calls | |
| retry budget | cap extra load | approximate with breaker |
| SQL retries | `EnableRetryOnFailure()` | transient SQL errors |

## Standard resilience handler
| # | Strategy | Default |
|:--|:--|:--|
| 1 | rate limiter | 1,000 permits, queue 0 |
| 2 | ⭐ total timeout | 30 s |
| 3 | ⭐ retry | 3, exponential, jitter, 2 s |
| 4 | ⭐ circuit breaker | 10%, min 100, 30 s sample, 5 s break |
| 5 | ⭐ attempt timeout | 10 s |

## Resilience APIs
| API | Does | Note |
|:--|:--|:--|
| ⭐ `AddStandardResilienceHandler(o => ...)` | default pipeline | one per client |
| `options.Retry.DisableForUnsafeHttpMethods()` | no retry on POST/PUT/PATCH/DELETE | |
| `options.Retry.DisableFor(HttpMethod.Post)` | per method | |
| `AddStandardHedgingHandler()` | parallel attempts | idempotent reads only |
| ⭐ `AddResilienceHandler("name", b => ...)` | custom pipeline | |
| `RemoveAllResilienceHandlers()` | clear defaults | |
| `ConfigureHttpClientDefaults(b => ...)` | baseline for all | |
| `HttpRetryStrategyOptions` | HTTP-aware retry | |
| `HttpCircuitBreakerStrategyOptions` | HTTP-aware breaker | |
| `AddResiliencePipeline("key", b => ...)` | non-HTTP pipeline | Polly.Extensions |
| `ResiliencePipelineProvider<string>` | resolve pipeline | |
| `context.EnableReloads<T>("name")` | reload options | |
| `Microsoft.Extensions.Http.Polly` | v7 style | avoid |

## Polly strategies
| Strategy | Builder | Throws |
|:--|:--|:--|
| retry | `AddRetry(...)` | last error |
| ⭐ circuit breaker | `AddCircuitBreaker(...)` | `BrokenCircuitException` |
| ⭐ timeout | `AddTimeout(TimeSpan)` | `TimeoutRejectedException` |
| rate limiter | `AddRateLimiter(...)` / `AddConcurrencyLimiter(n, q)` | `RateLimiterRejectedException` |
| fallback | `AddFallback(...)` | |
| hedging | `AddHedging(...)` | |
| chaos | `AddChaosLatency`, `AddChaosFault`, `AddChaosOutcome`, `AddChaosBehavior` | Polly 8.3+ |

## IHttpClientFactory
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `AddHttpClient<T>(c => ...)` | typed client | transient |
| `AddHttpClient("name")` | named client | `CreateClient("name")` |
| `SetHandlerLifetime(...)` | rotation | default 2 min |
| `ConfigurePrimaryHttpMessageHandler(...)` | handler options | |
| `AddHttpMessageHandler<T>()` | delegating handler | auth, headers |
| `SocketsHttpHandler.PooledConnectionLifetime` | static client DNS refresh | no DI |
| `new HttpClient()` per call | socket exhaustion | avoid |
| typed client in singleton | stuck handler | avoid |

## Circuit breaker states
| State | Behaviour | Next |
|:--|:--|:--|
| closed | calls flow, failures counted | open on threshold |
| ⭐ open | calls fail fast | half-open after break |
| half-open | trial call | closed or open |
| `FailureRatio` / `MinimumThroughput` | trip rule | |
| `SamplingDuration` | window | ≥ 2 × attempt timeout |
| `BreakDuration` | open time | |

## Health checks
| API | Does | Note |
|:--|:--|:--|
| ⭐ `AddHealthChecks().AddCheck<T>(name, tags: [...])` | register | |
| `AddDbContextCheck<TDb>()` | EF Core check | |
| `AddSqlServer`, `AddRedis`, `AddAzureServiceBusQueue` | AspNetCore.HealthChecks.* | community |
| ⭐ `MapHealthChecks(path, new() { Predicate = ... })` | endpoint | filter by tag |
| `Predicate = _ => false` | liveness | no checks |
| `HealthStatus.Degraded` | non-critical | 200 by default |
| `ResultStatusCodes` | status → HTTP | |
| `IHealthCheckPublisher` | push results | |

## Probes (Container Apps)
| Probe | Fails → | Checks |
|:--|:--|:--|
| ⭐ startup | wait longer | boot, warm-up |
| ⭐ liveness | restart | process only |
| ⭐ readiness | no traffic | critical deps |
| `failureThreshold`, `periodSeconds` | tuning | |

## Graceful shutdown
| Item | Does | Default |
|:--|:--|:--|
| SIGTERM | stop signal | |
| ⭐ `HostOptions.ShutdownTimeout` | stop budget | 30 s |
| `terminationGracePeriodSeconds` | before SIGKILL | 30 s |
| ⭐ `ApplicationStopping` | flip readiness, delay | |
| `IHostedLifecycleService` | stopping hooks | .NET 8+ |
| Kestrel drain | finishes in-flight | |
| `stoppingToken` | stop workers | |
| revisions | traffic shift after probes | single or multiple mode |
| min replicas ≥ 2 | no single point | |
| expand → migrate → contract | compatible schema | |

## Bulkheads
| Resource | Isolation | Note |
|:--|:--|:--|
| ⭐ per-dependency calls | concurrency limiter | |
| SQL pools | separate `Application Name` / pool size | |
| jobs | queues, servers | Hangfire |
| endpoints | rate limit policies | |
| apps | API vs workers containers | |

## Load shedding
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `GlobalLimiter` + `ConcurrencyLimiter` | cap per replica | |
| ⭐ 503 + `Retry-After` | fast rejection | `OnRejected` |
| 429 | per-client limit | |
| bounded `Channel<T>` | backpressure | |
| `QueueLimit` | bounded wait | |
| Kestrel `MaxConcurrentConnections` | connection cap | |
| priority shedding | protect checkout | |

## Degradation
| Fallback | Example | Note |
|:--|:--|:--|
| ⭐ stale data | last-known-good rates | label as stale |
| defaults | flat-rate shipping | |
| partial response | no recommendations | |
| ⭐ kill switch | `IFeatureManager`, `.WithFeatureGate(...)` | FeatureManagement 4.x |
| defer | queue email | |
| read-only mode | writes 503 | |
| fake success | | never |

## Dependency outages
| Down | Plan | Note |
|:--|:--|:--|
| ⭐ Azure SQL | failover group, retries | seconds |
| ⭐ Redis | fail open | watch SQL load |
| payments | breaker, clear error | fail closed |
| email | retry later | |
| Service Bus | outbox holds events | |
| identity | existing tokens work | |

## SLOs
| Term | Meaning | Example |
|:--|:--|:--|
| ⭐ SLI | good ÷ valid events | non-5xx < 1 s |
| ⭐ SLO | target over window | 99.5% / 30 d |
| ⭐ error budget | 1 − SLO | 3 h 36 min |
| 99.9% | budget | 43 min / 30 d |
| ⭐ burn rate 14.4 | 1 h + 5 min windows | page |
| burn rate 6 | 6 h + 30 min | page |
| burn rate 1 | 3 d + 6 h | ticket |
| budget policy | what happens when spent | |

## Testing failure
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ fakes | errors and delays in tests | |
| ⭐ Polly chaos | injected latency/faults | staging, config-gated |
| Toxiproxy | network faults | Testcontainers module |
| stop container | dependency kill | Testcontainers |
| Azure Chaos Studio | infra faults | |
| ⭐ game day | team practice | runbooks |
| hypothesis + abort | safe chaos | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| no timeout | pools exhaust | timeout per call |
| inner timeout > outer | wasted work | shrink inward |
| retries at every layer | retry storms | one layer |
| retrying POST | duplicates | idempotency keys |
| two resilience handlers | odd behaviour | one per client |
| liveness checks SQL | restart storms | process only |
| no shutdown delay | dropped requests | flip readiness, delay |
| unbounded queues | latency, memory | bounded + shed |
| untested fallback | fails when needed | chaos tests |
| CPU alerts only | miss user pain | SLO burn alerts |
| request timeout + debugger | seems not to work | skipped when attached |

## Sources
| Source | Link |
|:--|:--|
| Resilient HTTP apps | https://learn.microsoft.com/dotnet/core/resilience/http-resilience |
| Polly docs | https://www.pollydocs.org/ |
| IHttpClientFactory | https://learn.microsoft.com/dotnet/core/extensions/httpclient-factory |
| Request timeouts | https://learn.microsoft.com/aspnet/core/performance/timeouts |
| Health checks | https://learn.microsoft.com/aspnet/core/host-and-deploy/health-checks |
| Container Apps probes | https://learn.microsoft.com/azure/container-apps/health-probes |
| Rate limiting | https://learn.microsoft.com/aspnet/core/performance/rate-limit |
| SRE workbook: SLO alerting | https://sre.google/workbook/alerting-on-slos/ |
| Timeouts, retries, jitter | https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/ |
