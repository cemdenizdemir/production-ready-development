---
title: Observability cheatsheet
tech: ILogger, OpenTelemetry, Aspire dashboard, Application Insights, Sentry
version: OpenTelemetry .NET 1.x, Azure.Monitor.OpenTelemetry.AspNetCore 1.5+, Aspire dashboard 13.x, ASP.NET Core 10
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
---
# Observability cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Signals
| Signal | Answers | Cost |
|:--|:--|:--|
| ⭐ metrics | is it wrong, how much? | cheap, aggregated |
| ⭐ traces | where did time/errors go? | per request, sampled |
| ⭐ logs | what exactly happened? | per event, volume |
| errors | which exceptions, since when? | grouped |
| monitoring | known failures | dashboards, alerts |
| observability | new questions | rich, sliceable data |

## ILogger
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `ILogger<T>` | category = class | inject |
| ⭐ message templates | `"Order {OrderId}"` → fields | no interpolation |
| ⭐ `LogError(ex, ...)` | exception first | log once |
| `BeginScope(...)` | fields for a block | dictionary |
| ⭐ `[LoggerMessage]` | source-generated logging | `static partial` |
| `EventId` | stable event identity | |
| levels | Trace, Debug, Information, Warning, Error, Critical | |
| `Logging:LogLevel` config | per-category filters | `Microsoft.AspNetCore: Warning` |
| `IsEnabled(level)` | guard expensive work | |

## HTTP logging
| Item | Does | Note |
|:--|:--|:--|
| `AddHttpLogging(o => ...)` | configure | |
| `UseHttpLogging()` | middleware | |
| `LoggingFields` | allow-list fields | no bodies |
| `CombineLogs = true` | one line per request | .NET 8+ |
| `IHttpLoggingInterceptor` | per-request control | .NET 8+ |
| `AddW3CLogging()` | W3C log files | |
| `RequestHeaders` / `ResponseHeaders` | allowed headers | never `Authorization` |

## Serilog
| Item | Does | Note |
|:--|:--|:--|
| `AddSerilog((sp, lc) => ...)` | Serilog as provider | Serilog.AspNetCore |
| `ReadFrom.Configuration(...)` | config-driven | |
| `WriteTo.OpenTelemetry()` | OTLP export | Serilog.Sinks.OpenTelemetry |
| `writeToProviders: true` | keep other providers | OTel provider too |
| `UseSerilogRequestLogging()` | request summary | |
| enrichers | extra properties | |
| code uses `ILogger<T>` | Serilog stays swappable | |

## OpenTelemetry setup
| API | Does | Note |
|:--|:--|:--|
| ⭐ `AddOpenTelemetry()` | entry point | OpenTelemetry.Extensions.Hosting |
| `ConfigureResource(r => r.AddService(...))` | `service.name`, version | |
| ⭐ `WithTracing(...)` | traces | |
| ⭐ `WithMetrics(...)` | metrics | |
| `WithLogging()` | logs via OTel | |
| ⭐ `UseOtlpExporter()` | OTLP for all signals | env endpoint |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | where to send | `http://localhost:4317` |
| `OTEL_SERVICE_NAME` | service name | |
| `OTEL_RESOURCE_ATTRIBUTES` | extra attributes | `deployment.environment=prod` |

## Instrumentation
| Package / call | Covers | Note |
|:--|:--|:--|
| ⭐ `AddAspNetCoreInstrumentation()` | incoming requests | `Filter` health |
| ⭐ `AddHttpClientInstrumentation()` | outgoing HTTP | |
| `AddSqlClientInstrumentation()` | SQL | prerelease |
| `AddEntityFrameworkCoreInstrumentation()` | EF Core | prerelease |
| `AddRedisInstrumentation()` | StackExchange.Redis | prerelease |
| `AddSource("Azure.*")` | Azure SDK spans | Service Bus, Blob |
| `AddRuntimeInstrumentation()` | GC, thread pool | |
| `AddMeter("Shop.*")` | your meters | wildcards |
| `AddSource("Shop.*")` | your sources | |

## Traces
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `ActivitySource` | creates spans | one per component |
| ⭐ `StartActivity("Name")` | span | may be `null`: `?.` |
| `SetTag(k, v)` | attribute | |
| `AddEvent(...)` | timestamped event | |
| `SetStatus(ActivityStatusCode.Error)` | mark failed | |
| `AddException(ex)` | record exception | .NET 9+ |
| ⭐ `traceparent` | W3C context header | |
| `ActivityKind` | server/client/producer/consumer | |
| `Baggage` | propagated key-values | sparingly |

## Metrics
| Instrument | Use | Example |
|:--|:--|:--|
| ⭐ `Counter<T>` | only up | `shop.orders.placed` |
| ⭐ `Histogram<T>` | distributions | `shop.payment.duration` |
| `UpDownCounter<T>` | up and down | in-flight items |
| `ObservableGauge<T>` | sampled value | outbox lag |
| ⭐ `IMeterFactory` | create meters via DI | |
| units | `s`, `By`, `{order}` | UCUM |
| ⭐ low cardinality | bounded tags | no IDs |
| exemplars | metric → trace | `SetExemplarFilter(...)` |

## Built-in metrics
| Metric | From | Note |
|:--|:--|:--|
| ⭐ `http.server.request.duration` | ASP.NET Core | by `http.route` |
| `http.server.active_requests` | ASP.NET Core | |
| `kestrel.active_connections` | Kestrel | |
| ⭐ `http.client.request.duration` | HttpClient | `server.address` |
| `dotnet.gc.*`, `dotnet.thread_pool.*` | runtime | .NET 9+ names |
| `resilience.polly.strategy.events` | Polly | breaker opens |
| `aspnetcore.rate_limiting.*` | rate limiter | rejections |

## RED and USE
| Method | For | Signals |
|:--|:--|:--|
| ⭐ RED | services | rate, errors, duration |
| ⭐ USE | resources | utilisation, saturation, errors |
| golden signals | services | latency, traffic, errors, saturation |

## Correlation
| Link | How | Note |
|:--|:--|:--|
| ⭐ logs ↔ traces | `TraceId` on log records | OTel provider |
| errors ↔ traces | exception on span | |
| API errors | `traceId` in problem details | |
| frontend → API | `propagateTraceparent: true` | Sentry 10.10+, CORS |
| messages | `Diagnostic-Id` / stored `traceparent` | Service Bus, outbox |

## Aspire dashboard
| Item | Value | Note |
|:--|:--|:--|
| ⭐ image | `mcr.microsoft.com/dotnet/aspire-dashboard` | pin a tag |
| UI port | 18888 | |
| OTLP gRPC / HTTP | 18889 / 18890 | map to 4317 / 4318 |
| login | token in logs | |
| `ASPIRE_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS` | no login | local only |
| storage | in memory | |
| AppHost | optional | 04-shipping |

## Azure Monitor and Application Insights
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `UseAzureMonitor(o => ...)` | distro setup | Azure.Monitor.OpenTelemetry.AspNetCore |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | target | env/config |
| `o.Credential` | Entra ID ingestion | managed identity |
| ⭐ `o.TracesPerSecond` | rate-limited sampling | default 5 (1.5+) |
| `o.SamplingRatio` | ratio sampling | set `TracesPerSecond = null` |
| Live Metrics | real time | on by default |
| ⭐ Failures / Performance | triage blades | |
| Application Map | topology | |
| Transaction search | one request end to end | |
| classic SDK | `TelemetryClient` | avoid |

## KQL tables and operators
| Item | Contains / does | Note |
|:--|:--|:--|
| ⭐ `AppRequests` | incoming requests | `DurationMs`, `ResultCode` |
| ⭐ `AppDependencies` | outgoing calls | `Target`, `Success` |
| `AppExceptions` | exceptions | `ProblemId` |
| `AppTraces` | logs | `SeverityLevel` |
| `AppMetrics` | custom metrics | `Name`, `Sum` |
| `Usage` | billable GB | cost review |
| `summarize ... by` | aggregate | |
| `percentile(x, 95)` | percentiles | |
| `bin(TimeGenerated, 5m)` | time buckets | `render timechart` |
| `ago(1h)` | relative time | |

## Error tracking
| Tool | Covers | Note |
|:--|:--|:--|
| ⭐ App Insights exceptions | backend | grouped, by version |
| ⭐ Sentry (`@sentry/nextjs`) | frontend | source maps, releases |
| `sendDefaultPii: false` | privacy | |
| `tracePropagationTargets` | which URLs get headers | |
| new error group after deploy | release signal | rollback |
| Sentry for .NET | also seen | one tool |

## Dashboards
| Dashboard | Panels | Tool |
|:--|:--|:--|
| ⭐ service overview | RED by route, SLO, deploys | Workbooks / Grafana |
| ⭐ dependencies | per-partner latency, errors, breakers | |
| saturation | CPU, pools, queues | |
| ⭐ business | orders, payments, signups | |
| release | errors by version | |
| as code | JSON in repo, deployed by CI | |

## Alerting
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ symptoms | burn rate, errors, latency, business drops | page |
| causes | CPU, memory, pools | dashboards/tickets |
| ⭐ runbook link | in every alert | |
| severity | Sev 1–2 page, 3–4 ticket | |
| action group | notification targets | email, push, webhook |
| ⭐ log search alert | KQL rule | `scheduledQueryRules` |
| metric alert | fast metric rule | |
| activity log alert | resource changes | |
| smart detection | anomaly | App Insights |
| seasonality | compare with last week | business alerts |
| hygiene | weekly review, delete noise | |

## Sampling
| Kind | API | Note |
|:--|:--|:--|
| ⭐ head (ratio) | `TraceIdRatioBasedSampler` | cheap |
| parent-based | `ParentBasedSampler(...)` | whole traces |
| ⭐ rate-limited | distro `TracesPerSecond` | predictable |
| tail | OTel Collector `tail_sampling` | keep errors |
| log sampling | `AddRandomProbabilisticSampler`, `AddTraceBasedSampler` | Microsoft.Extensions.Telemetry |
| log buffering | `AddGlobalBuffer`, `AddPerIncomingRequestBuffer` | .NET 9+ |
| metrics | not sampled | aggregated |

## Cost
| Lever | How | Note |
|:--|:--|:--|
| ⭐ levels/filters | less volume | |
| ⭐ cardinality | bounded tags | |
| ⭐ retention | 30–90 days | |
| Basic / Auxiliary logs | cheap tables | limited KQL |
| daily cap | safety net | stops ingestion |
| DCR transforms | drop at ingestion | |
| `Usage` review | monthly | |

## Privacy
| Item | Does | Note |
|:--|:--|:--|
| ⭐ no secrets | tokens, keys, cookies | never |
| ⭐ pseudonymous IDs | not emails/names | |
| ⭐ `EnableRedaction()` | redaction in logging | Microsoft.Extensions.Telemetry |
| `AddRedaction(r => ...)` | configure redactors | Compliance.Redaction |
| `DataClassificationAttribute` | custom `[Pii]` | not `[PersonalData]` |
| `ErasingRedactor` | remove value | default fallback |
| `SetHmacRedactor(...)` | stable hash | experimental `EXTEXP0002` |
| table-level RBAC | limit access | Log Analytics |
| purge API | erasure requests | |
| workspace region | data residency | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| string interpolation in logs | no fields | templates |
| logging exceptions at every layer | duplicates | log once |
| IDs as metric tags | cardinality explosion | span attributes |
| classic SDK + distro | double data | distro only |
| default 5 traces/s unnoticed | missing traces | set sampling |
| health checks traced | noise, cost | `Filter` |
| `StartActivity` without `?.` | `NullReferenceException` | null-check |
| alerts on causes | noise, fatigue | symptoms |
| dashboards by hand | drift | as code |
| PII in logs | GDPR risk | redaction |
| daily cap hit | blind during incident | alert on cap |

## Sources
| Source | Link |
|:--|:--|
| .NET observability with OTel | https://learn.microsoft.com/dotnet/core/diagnostics/observability-with-otel |
| Logging in .NET | https://learn.microsoft.com/dotnet/core/extensions/logging |
| OpenTelemetry .NET | https://opentelemetry.io/docs/languages/dotnet/ |
| Azure Monitor OpenTelemetry | https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-enable |
| Aspire dashboard (standalone) | https://learn.microsoft.com/dotnet/aspire/fundamentals/dashboard/standalone |
| ASP.NET Core built-in metrics | https://learn.microsoft.com/aspnet/core/log-mon/metrics/built-in |
| Data redaction | https://learn.microsoft.com/dotnet/core/extensions/data-redaction |
| Azure Monitor alerts | https://learn.microsoft.com/azure/azure-monitor/alerts/alerts-overview |
| Sentry Next.js | https://docs.sentry.io/platforms/javascript/guides/nextjs/ |
