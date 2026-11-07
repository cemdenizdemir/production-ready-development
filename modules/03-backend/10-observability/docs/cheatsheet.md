---
title: Observability cheatsheet
tech: Pino, OpenTelemetry, Grafana LGTM, Sentry
version: Pino 9+, pino-http, OpenTelemetry JS SDK 2.x, Loki 3 / Tempo / Mimir + Grafana Alloy, Sentry JS SDK 10
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Observability cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Signals
| Signal | Answers | Tool here |
|:--|:--|:--|
| ⭐ Metrics | how much, how fast, how often | OpenTelemetry → Mimir |
| ⭐ Traces | where the time went, across services | OpenTelemetry → Tempo |
| ⭐ Logs | what exactly happened | Pino → Loki |
| ⭐ Errors | which bugs, since which release | Sentry |
| Profiles | which code burns CPU | Pyroscope (also seen) |
| ⭐ Glue | one trace ID on all of them | |

## Pino options
| Option | Use |
|:--|:--|
| ⭐ `level` | `info` in prod, `debug` locally |
| `base` | fields on every line: service, version, env |
| ⭐ `redact: { paths, censor }` | hide secrets: `req.headers.cookie`, `*.password` |
| `formatters.level` | `"level":"error"` instead of numbers (single transport only) |
| `timestamp: pino.stdTimeFunctions.isoTime` | ISO timestamps |
| `serializers` | pick safe fields from objects |
| `mixin()` | add fields to every line (e.g. from AsyncLocalStorage) |
| `transport: { target: 'pino-pretty' }` | readable local output; never in prod |
| `messageKey` / `errorKey` | rename `msg` / `err` |

## Pino API
| Call | Use |
|:--|:--|
| ⭐ `logger.info({ orderId }, 'order placed')` | fields first, stable message second |
| ⭐ `logger.error({ err }, 'charge failed')` | error with stack and cause |
| ⭐ `logger.child({ module: 'payments' })` | scoped logger |
| `req.log` | per-request child logger (pino-http) |
| `logger.isLevelEnabled('debug')` | skip expensive debug work |
| `logger.level = 'debug'` | change level at runtime |
| `logger.flush()` | flush before exit |

## pino-http options
| Option | Use |
|:--|:--|
| `logger` | reuse the app logger |
| ⭐ `genReqId` | request ID (validated incoming or new UUID) |
| `customLogLevel` | 5xx error, 4xx warn, else info |
| `customProps` | add `userId`, `accountId` |
| ⭐ `autoLogging.ignore` | skip `/health` |
| `serializers.req` / `.res` | method, URL, status only |
| `customSuccessMessage` / `customErrorMessage` | message format |

## Log levels
| Level | Use |
|:--|:--|
| `fatal` | process about to exit |
| ⭐ `error` | request/job failed, someone may act |
| ⭐ `warn` | unexpected but handled |
| ⭐ `info` | business events, lifecycle |
| `debug` / `trace` | developer detail, off in prod |

## Privacy in telemetry
| Never | Instead |
|:--|:--|
| ⭐ Tokens, cookies, API keys, passwords | `redact`, safe serializers |
| ⭐ Emails, addresses, card data | IDs only |
| Request/response bodies | log specific fields |
| Tokens in URLs | headers or bodies |
| SQL values | parameterized queries |
| PII in Sentry | `sendDefaultPii: false`, `beforeSend` |
| Leaks past the app | Alloy `otelcol.processor.attributes` delete/hash |
| Unlimited retention, broad access | retention limits, least privilege |

## OpenTelemetry concepts
| Term | Meaning |
|:--|:--|
| ⭐ Trace / span | request journey / one operation |
| Span kind | server, client, producer, consumer, internal |
| ⭐ `traceparent` | W3C header carrying trace context |
| Resource | `service.name`, `service.version`, `deployment.environment.name` |
| Attributes | key-values on spans, metrics, logs |
| ⭐ OTLP | the protocol to collectors (HTTP 4318, gRPC 4317) |
| Exemplars | trace IDs on metric samples |
| Sampler | parent-based ratio, always on/off |

## OpenTelemetry packages
| Package | Use |
|:--|:--|
| ⭐ `@opentelemetry/sdk-node` | `NodeSDK` |
| ⭐ `@opentelemetry/auto-instrumentations-node` | http, express, pg, redis, aws-sdk, pino… |
| `@opentelemetry/api` | `trace`, `metrics`, `context` in app code |
| `@opentelemetry/exporter-{trace,metrics,logs}-otlp-proto` | OTLP over HTTP |
| `@opentelemetry/sdk-metrics` / `sdk-logs` / `sdk-trace-base` | readers and processors |
| `@opentelemetry/resources` | `resourceFromAttributes()` (SDK 2.x) |
| `@opentelemetry/semantic-conventions` | `ATTR_SERVICE_NAME` and friends |
| `@opentelemetry/instrumentation/hook.mjs` | ESM loader hook (`register()`) |
| `bullmq-otel` | trace context through BullMQ |

## OpenTelemetry environment variables
| Variable | Example |
|:--|:--|
| ⭐ `OTEL_SERVICE_NAME` | `api` |
| ⭐ `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` or `grpc` |
| `OTEL_EXPORTER_OTLP_HEADERS` | `authorization=Basic …` |
| `OTEL_RESOURCE_ATTRIBUTES` | `deployment.environment.name=production` |
| ⭐ `OTEL_SEMCONV_STABILITY_OPT_IN` | `http` (stable HTTP metric names) |
| `OTEL_TRACES_SAMPLER` / `_ARG` | `parentbased_traceidratio` / `0.1` |
| `OTEL_NODE_ENABLED_INSTRUMENTATIONS` | `http,express,pg,redis,pino` |
| `OTEL_NODE_DISABLED_INSTRUMENTATIONS` | `fs,dns` |
| `OTEL_METRIC_EXPORT_INTERVAL` | `15000` |
| `OTEL_LOG_LEVEL` | `debug` (SDK diagnostics) |
| `OTEL_SDK_DISABLED` | `true` (turn it off) |

## Instruments and API
| Call | Use |
|:--|:--|
| ⭐ `meter.createCounter(name)` | only up: orders, failures |
| `meter.createUpDownCounter(name)` | up and down: connections |
| ⭐ `meter.createHistogram(name, { unit, advice })` | durations, sizes |
| `meter.createObservableGauge(name)` + `addCallback` | sampled values: queue depth |
| ⭐ `tracer.startActiveSpan(name, fn)` | manual span (end it in `finally`) |
| `span.setAttribute(k, v)` | add detail |
| `span.recordException(err)` + `setStatus({ code: SpanStatusCode.ERROR })` | mark failure |
| `await sdk.shutdown()` | flush on exit |

## Semantic convention names
| Name | Where |
|:--|:--|
| ⭐ `http.server.request.duration` | server latency histogram (s) |
| `http.client.request.duration` | outgoing calls (s) |
| ⭐ `http.route` | route template (`/api/orders/:id`) |
| `http.request.method` / `http.response.status_code` | method / status |
| `error.type` | bounded error class |
| `db.system.name` / `db.query.text` / `db.operation.name` | database spans |
| Prometheus form | `http_server_request_duration_seconds_bucket`, `_count`, `_sum` |

## Cardinality
| Attribute | On metrics? |
|:--|:--|
| ⭐ Route template, method, status | ✓ |
| Error type (bounded) | ✓ |
| Small fixed sets (plan, channel) | ✓ |
| ⭐ User ID, email, order ID, full URL | ✗ (spans and logs) |
| Tenant ID | only if few |

## Correlation
| From → to | How |
|:--|:--|
| ⭐ Logs → trace | `trace_id` / `span_id` on log lines (pino instrumentation) |
| Trace → logs | Grafana trace-to-logs (Loki by trace ID) |
| Metric → trace | exemplars |
| Error → trace | Sentry with the shared OTel setup |
| Job → request | `bullmq-otel` |
| Customer → logs | `X-Request-Id` header |

## LGTM stack
| Part | Stores | Query |
|:--|:--|:--|
| ⭐ Loki | logs | LogQL |
| ⭐ Grafana | dashboards, alerts | — |
| ⭐ Tempo | traces | TraceQL |
| ⭐ Mimir | metrics | PromQL |
| ⭐ Alloy | collector: receive, scrub, sample, route | Alloy config |
| Local | `grafana/otel-lgtm` (Grafana :3001, OTLP :4318 here) | |
| Managed | Grafana Cloud (also seen) | |
| AWS-native | CloudWatch, X-Ray, Managed Grafana/Prometheus (also seen) | |

## PromQL snippets
| Query | Shows |
|:--|:--|
| ⭐ `sum by (http_route) (rate(http_server_request_duration_seconds_count[5m]))` | rate per route |
| ⭐ `histogram_quantile(0.95, sum by (le, http_route) (rate(…_bucket[5m])))` | p95 per route |
| `sum(rate(…_count{http_response_status_code=~"5.."}[5m])) / sum(rate(…_count[5m]))` | error ratio |
| `… offset 1w` | same time last week |
| `absent(up{job="api"})` | missing data |
| `increase(shop_orders_created_total[1h])` | count per hour |

## LogQL and TraceQL snippets
| Query | Shows |
|:--|:--|
| ⭐ `{service_name="api"} \| detected_level="error"` | error logs |
| ⭐ `{service_name=~"api\|worker"} \| trace_id="…"` | all logs of one trace |
| `{service_name="api"} \|= "payment"` | line contains text |
| `sum by (detected_level) (count_over_time({service_name="api"}[5m]))` | log volume by level |
| ⭐ `{ resource.service.name = "api" && duration > 1s }` | slow traces |
| `{ span.http.route = "/api/orders" && status = error }` | failing spans on a route |

## Dashboards
| Dashboard | Must have |
|:--|:--|
| ⭐ Service overview | rate, errors, p50/p95/p99, saturation, deploy annotations |
| Dependencies | DB, Redis, each external API, breaker state |
| Queues | depth, oldest job age, failures |
| ⭐ Business | orders/min vs last week, payment success, signups |
| SLOs | SLI, budget left, burn rate |
| Rules | same layout everywhere, top row = health, dashboards in git |

## Alerting
| Rule | Detail |
|:--|:--|
| ⭐ Page on symptoms | errors, latency burn, business success rates |
| Causes on dashboards | CPU, memory, disk |
| ⭐ Runbook on every page | `runbook_url` annotation |
| Severity | `page` vs `ticket` |
| Silence detection | no orders, no job runs, `absent()` |
| Routing | contact points + notification policies |
| Grouping, silences | one notification per incident |
| ⭐ Weekly review | fix or delete noisy alerts |

## Sentry API
| Call / option | Use |
|:--|:--|
| ⭐ `Sentry.init({ dsn, environment, release })` | setup (in `instrumentation.ts`) |
| ⭐ `setupExpressErrorHandler(app)` | capture 5xx (after routes) |
| `captureException(err, { tags, contexts })` | manual capture |
| `setUser({ id })` | user ID only |
| `setTag` / `setContext` / `addBreadcrumb` | extra context |
| `withMonitor(slug, fn, { schedule, checkinMargin, maxRuntime, timezone })` | cron monitoring |
| `tracesSampleRate` / `tracesSampler` | trace sampling |
| `sampleRate`, `ignoreErrors`, `beforeSend` | error volume and scrubbing |
| ⭐ `sendDefaultPii: false` | no IPs/cookies by default |
| ⭐ `flush(2000)` | before exit |

## Sentry + your OpenTelemetry SDK
| Part | Role |
|:--|:--|
| ⭐ `skipOpenTelemetrySetup: true` | you own the SDK |
| `SentrySpanProcessor` | spans to Sentry |
| `SentrySampler` | shared sampling decision |
| `SentryPropagator` | traceparent + Sentry headers |
| `SentryContextManager` | scopes follow OTel context |
| `validateOpenTelemetrySetup()` | startup check |

## Sampling
| Strategy | Note |
|:--|:--|
| ⭐ Head (SDK) | `tracesSampleRate` 0.05–0.2, parent-based |
| ⭐ Tail (collector) | keep errors + slow + 5%; route by trace ID |
| Errors-only Sentry | SDK 100% → Alloy tail sampling; no `SentrySpanProcessor` |
| Per-route boost | higher rate for checkout |
| Logs | `info` in prod; sample noisy debug |

## Cost levers
| Driver | Lever |
|:--|:--|
| ⭐ Log volume | levels, no bodies, drop health checks, short retention |
| ⭐ Metric cardinality | bounded attributes, drop unused metrics |
| Trace volume | sampling, disable fs/DNS spans |
| Error events | skip 4xx, fingerprint loops, quotas, spike protection |
| Retention | 7–30 days hot, archive to S3 |
| Ownership | monthly cost review |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| SDK imported inside the app | modules loaded unpatched: no spans | `node --import ./src/instrumentation.ts` |
| No ESM hook | ESM imports not instrumented | `register('@opentelemetry/instrumentation/hook.mjs', …)` |
| No `OTEL_SEMCONV_STABILITY_OPT_IN=http` | old names (`http.server.duration`, ms) | opt in, fix dashboards once |
| `formatters.level` with `transport.targets` | Pino throws | single transport or no formatter |
| Pino OTLP log sending + stdout shipping | duplicate logs in Loki | pick one path |
| IDs as metric attributes | series explosion, big bill | IDs on spans/logs |
| Spans never ended | missing or broken traces | `finally { span.end() }` |
| 4xx sent to Sentry | quota burned on noise | 5xx and real failures only |
| No flush on shutdown | last errors lost | `sdk.shutdown()`, `Sentry.flush()` |
| Health checks traced and logged | noise, cost | ignore `/health` |
| PromQL `hour()` | UTC, not local time | adjust the window |
| Tokens in query strings | leak into logs and traces | headers |

## Sources
| Source | Link |
|:--|:--|
| Pino | https://getpino.io/ |
| OpenTelemetry JS | https://opentelemetry.io/docs/languages/js/ |
| HTTP semantic conventions | https://opentelemetry.io/docs/specs/semconv/http/http-metrics/ |
| Grafana Alloy | https://grafana.com/docs/alloy/latest/ |
| Loki OTLP ingestion | https://grafana.com/docs/loki/latest/send-data/otel/ |
| Sentry custom OTel setup | https://docs.sentry.io/platforms/javascript/guides/node/opentelemetry/custom-setup/ |
| Monitoring distributed systems | https://sre.google/sre-book/monitoring-distributed-systems/ |
