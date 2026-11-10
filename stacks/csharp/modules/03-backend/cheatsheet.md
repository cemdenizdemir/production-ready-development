---
title: Backend cheatsheet
date: 2026-11-09
---
# Backend cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · C# and the .NET runtime](01-language-runtime/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `dotnet new webapi` / `dotnet build` / `test` / `run` / `watch` | project and inner loop |
| `dotnet package add X` + Central Package Management | dependencies in `Directory.Packages.props` |
| `<Nullable>enable</Nullable>` + warnings as errors | null safety |
| `decimal` for money, `DateTimeOffset` for instants | correct types |
| `record` / `sealed class` / `readonly record struct` | DTOs, entities, value objects |
| `List<T>`, `Dictionary<K,V>`, `IReadOnlyList<T>` | everyday collections |
| `IQueryable` vs `IEnumerable` | SQL vs in-memory LINQ |
| switch expressions and patterns | `x switch { ... }`, `is { Status: "Paid" }` |
| primary constructors, collection expressions | `class S(ShopDb db)`, `[1, 2, .. more]` |
| `async`/`await` + `CancellationToken` everywhere | non-blocking I/O |
| no `.Result` / `.Wait()` | avoids thread-pool starvation |
| `TimeProvider` | testable time |
| LTS vs STS | .NET 10 LTS → Nov 2028 |

## [02 · API Design](02-api-design/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `GET /orders`, `GET /orders/{id}`, `POST /orders` → 201 + `Location` | resource conventions |
| `app.MapGroup("/orders")` + `MapOrderEndpoints()` | feature endpoint files |
| `TypedResults.Ok/Created/NotFound/Problem` | typed responses for OpenAPI |
| `AddProblemDetails()` + `IExceptionHandler` | errors as Problem Details with `traceId` |
| `AddValidation()` (.NET 10) / FluentValidation | request validation |
| DTO per use case, never entities | stable contracts |
| `[AsParameters]` | list query objects |
| cursor (keyset) pagination + max page size | stable, fast lists |
| `Idempotency-Key` header | safe POST retries |
| `AddOpenApi()` + `MapOpenApi()` | OpenAPI document → Orval for the frontend |
| `JsonStringEnumConverter`, `JsonSerializerContext` | JSON settings and source generation |
| additive evolution, `Deprecation`/`Sunset` headers | versioning |

## [03 · Databases](03-databases/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| PK + FKs + `UNIQUE` + `CHECK` | integrity in the database |
| `decimal(18,2)` + `char(3)`, `datetimeoffset(3)` | money and instants |
| `bigint IDENTITY` clustered key | narrow, increasing; not random/v7 GUIDs |
| composite index (equality → range) + `INCLUDE` | covering seeks |
| actual execution plan, Query Store | find and fix slow queries |
| `AsNoTracking`, `Select` projections, `AsSplitQuery` | efficient EF Core reads |
| `dotnet ef migrations add` / bundles | schema changes |
| `SaveChangesAsync` = one transaction | unit of work |
| `EnableRetryOnFailure` + execution strategy | transient SQL errors |
| RCSI, `rowversion` concurrency tokens | concurrency |
| `UPDATE … WHERE Stock >= @q` | atomic stock decrement |
| `UPDLOCK, READPAST, ROWLOCK` | queue claims |
| Dapper for hand-written SQL | reports, hot paths |

## [04 · Authentication & Authorization](04-auth/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| authentication vs authorization | who vs what |
| `PasswordHasher<TUser>` | PBKDF2 hashes |
| `__Host-` cookie, `HttpOnly`, `Secure`, `SameSite=Lax` | session cookie |
| `OnRedirectToLogin` → 401 | API-friendly cookies |
| ASP.NET Core Identity: `UserManager`, `SignInManager` | users, sign-in, 2FA |
| `AddIdentityApiEndpoints` + `MapIdentityApi` | SPA auth endpoints |
| passkeys (.NET 10), TOTP | strong authentication |
| lockout + login rate limits + same response for unknown emails | brute force and enumeration |
| `AddJwtBearer` with issuer, audience, lifetime, key checks | token APIs |
| refresh rotation + reuse detection | long sessions safely |
| `AddAuthorization` policies + `RequireAuthorization("Admin")` | access rules |
| resource-based authorization (owner checks) | no IDOR |
| security stamp | revoke old sessions |

## [05 · Validation & Abuse Prevention](05-validation-abuse/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| request validation → domain guards → DB constraints | defence in depth |
| `[MaxLength]` on every string and list | bounded input |
| `Limits.MaxRequestBodySize` | small bodies |
| normalise text (trim, NFC), lowercase emails | consistent data |
| regex `matchTimeout` / `NonBacktracking` / `[GeneratedRegex]` | no ReDoS |
| DTOs only, never bind entities | no mass assignment |
| `AddRateLimiter` + partitioned policies | per user/IP limits |
| `GetTokenBucketLimiter` | bursts + steady rate |
| `OnRejected` → 429 + `Retry-After` | client guidance |
| Redis counters for distributed limits | limits across replicas |
| Front Door WAF rate rules, bot protection | edge defence |
| raw-body signature checks for webhooks | authentic callbacks |

## [06 · Caching](06-caching/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `AddHybridCache` + `GetOrCreateAsync(key, factory, options, tags)` | L1 + Redis cache-aside, stampede protection |
| `RemoveAsync` / `RemoveByTagAsync` after commit | invalidation |
| keys `product:v2:{slug}`, user ID in personal keys | no stale shapes, no leaks |
| TTL + jitter | bounded staleness |
| `AddOutputCache` + `.CacheOutput(...)` + `EvictByTagAsync` | whole-response cache |
| `AddStackExchangeRedisOutputCache` | shared output cache |
| `Cache-Control: public, max-age` / `private, no-store` | HTTP caching |
| `ConnectionMultiplexer` singleton | Redis connection |
| Redis strings, hashes, sorted sets, `INCR` | data structures |
| hit ratio, latency, memory, evictions | cache health |
| Azure Managed Redis | cloud Redis (Azure Cache for Redis retiring) |

## [07 · Background Jobs & Messaging](07-background-jobs/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `BackgroundService` + `Channel.CreateBounded<T>` | in-process, losable work |
| `IServiceScopeFactory.CreateAsyncScope()` | scope per job |
| `AddHangfire(c => c.UseSqlServerStorage(cs))` + `AddHangfireServer` | durable jobs |
| `Enqueue<T>` / `Schedule<T>` / `AddOrUpdate<T>(id, ..., cron, options)` | job types |
| `[AutomaticRetry]`, `[Queue]`, `[DisableConcurrentExecution]` | retries, priority, locks |
| dashboard behind the admin policy | safe operations UI |
| IDs as job arguments, idempotent handlers | at-least-once safety |
| provider idempotency keys | no double side effects |
| outbox row in the same transaction | no lost events |
| Service Bus queues, topics, DLQ, sessions, duplicate detection | messaging |
| `ServiceBusProcessor` with `AutoCompleteMessages = false` | explicit settlement |
| alerts: queue depth, oldest age, DLQ, outbox lag | queue health |

## [08 · Reliability & Resilience](08-reliability/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| timeouts at every layer, shorter inward | no pile-ups |
| `AddRequestTimeouts` + `.WithRequestTimeout(...)` | server deadlines |
| `AddStandardResilienceHandler(o => ...)` | rate limit, timeouts, retry, breaker |
| `Retry.DisableForUnsafeHttpMethods()` | no blind POST retries |
| exponential backoff + jitter, one retry layer | no retry storms |
| `BrokenCircuitException` → fallback | fail fast |
| `AddHttpClient<T>()` typed clients | no socket exhaustion |
| `/health/live` (no checks) vs `/health/ready` (tagged) | correct probes |
| `ApplicationStopping` → not ready, delay, drain | zero-downtime deploys |
| global `ConcurrencyLimiter` → 503 + `Retry-After` | load shedding |
| bulkheads: separate pools, queues, limits | isolation |
| stale data, defaults, kill switches | graceful degradation |
| SLO, error budget, burn-rate alerts (14.4× / 6×) | reliability targets |
| Polly chaos strategies, game days | test failure |

## [09 · Scalability & Performance](09-scalability/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| p95/p99, throughput, saturation | what to measure |
| `dotnet-counters`, `dotnet-trace` | runtime diagnostics |
| k6 `ramping-arrival-rate` + thresholds | open-model load tests |
| BenchmarkDotNet `[MemoryDiagnoser]`, Release builds | micro-benchmarks |
| `Span<T>`, `ArrayPool<T>`, JSON source generation | fewer allocations |
| stateless replicas, shared Data Protection keys | horizontal scale |
| Container Apps HTTP / Service Bus scale rules, `minReplicas` ≥ 2 | autoscaling |
| Front Door, Container Apps ingress, YARP | traffic management |
| connection budget: replicas × `Max Pool Size` | database limits |
| `ApplicationIntent=ReadOnly` | read replicas |
| CDN, HybridCache, precomputed tables | offload reads |
| Little's law, 60–70% peak utilisation | capacity planning |
| pagination, projections, streaming, bulk SQL | lean payloads |
| Azure SignalR Service | real-time scale-out |

## [10 · Observability](10-observability/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| metrics, traces, logs, errors | four signals |
| message templates + `[LoggerMessage]` | structured logging |
| `AddOpenTelemetry().WithTracing().WithMetrics().WithLogging()` | one pipeline |
| ASP.NET Core, HttpClient, SQL, Redis, `Azure.*` instrumentation | automatic spans |
| `ActivitySource` / `IMeterFactory` + `Counter`/`Histogram` | custom telemetry |
| low-cardinality metric tags | affordable metrics |
| `traceparent` everywhere, trace IDs in logs | correlation |
| Aspire dashboard (OTLP) locally | see telemetry daily |
| `UseAzureMonitor(o => o.TracesPerSecond = ...)` | Application Insights |
| `AppRequests`, `AppDependencies`, `AppExceptions` + KQL | queries |
| symptom alerts with runbooks; causes on dashboards | sane on-call |
| business metrics (orders, payment success) | detect silent failures |
| `EnableRedaction()` + `[Pii]` classifications | privacy in telemetry |
| Sentry for the frontend, `propagateTraceparent` | browser errors linked to traces |

## [11 · Architecture](11-architecture/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| modular monolith first | one deploy, clear seams |
| feature modules with Contracts projects | public surface per module |
| dependency rule: domain depends on nothing | testable core |
| `AddXxxModule()` / `MapXxxEndpoints()` | composition root per module |
| `ValidateScopes` + `ValidateOnBuild` | DI mistakes at startup |
| keyed services `[FromKeyedServices]` | choose implementations |
| value objects, encapsulated entities | rules in the domain |
| `Result<T>` + stable error codes → one HTTP mapping | error architecture |
| ports and adapters for payments, email, storage | swappable integrations |
| integration events via outbox, idempotent handlers | decoupled modules |
| no network calls inside transactions | short, safe transactions |
| plain handlers, Mapperly or manual mapping | no commercial mediator/mapper |
| ADRs, strangler fig | decisions and migrations |
| projects + `internal` + NetArchTest + CODEOWNERS | enforced boundaries |

## [12 · Common Integrations](12-integrations/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| adapter + timeouts + idempotency + Key Vault secrets | integration skeleton |
| PaymentIntent with server-computed minor-unit amounts | correct charges |
| `RequestOptions { IdempotencyKey }` | no double charges |
| Payment Element or Checkout | card data off your servers |
| `EventUtility.ConstructEvent` on the raw body | verified webhooks |
| store `event.id`, enqueue, 200 fast | idempotent webhook handling |
| ACS `EmailClient.SendAsync(WaitUntil.Started, ...)` from jobs | async email |
| SPF, DKIM, DMARC; suppression from Event Grid bounces | deliverability |
| user delegation SAS: one blob, write-only, minutes | direct uploads |
| quarantine → malware scan → magic bytes → promote | upload security |
| short read SAS after authorisation | private downloads |
| signed outgoing webhooks + SSRF-safe client | safe customer webhooks |
| WireMock.Net, Azurite, Stripe CLI | integration tests |
| reconciliation jobs + per-integration dashboards | catch silent drift |
