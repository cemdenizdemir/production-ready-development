---
title: Error tracking with Sentry; sampling and cost
tech: Sentry, OpenTelemetry, Express 5, BullMQ
version: Sentry JS SDK 10 (@sentry/node, @sentry/opentelemetry), OpenTelemetry JS SDK 2.x, Grafana Alloy
date: 2026-11-07
covers: [7, 10]
---
# Error tracking with Sentry; sampling and cost
[← Overview](00-overview.md)

## Why it matters
- A release throws a `TypeError` on one route for 2% of requests. The logs show it, but nobody reads 50,000 log lines a minute. Sentry groups it into one new issue, tagged with the release, and alerts within minutes.
- Traces sampled at 100% plus debug logs: the telemetry bill passes the compute bill.
- One error loop exhausts the Sentry quota on day 3 of the month; every real error after that is dropped.

## Concepts

### Sentry on the backend
| Feature | What it gives you |
|:--|:--|
| Issues | errors grouped by stack trace; custom fingerprints when grouping is wrong |
| Releases | which deploy introduced or fixed an issue; regression alerts |
| Environments | production and staging kept apart |
| Context | tags, user ID, request data (scrubbed), breadcrumbs (logs, HTTP calls, queries) |
| Tracing | spans through the shared OpenTelemetry setup; errors linked to their trace |
| Cron monitors | alert when a scheduled job doesn't run, or runs too long |
| Alerts | new issue, regression, spike in events |
| Logs | Sentry has a logs product too (also seen); this stack uses Loki |

### Sharing the OpenTelemetry setup
Sentry's Node SDK is built on OpenTelemetry. Since you already run your own `NodeSDK` ([lesson 02](02-tracing-and-metrics.md)), initialize Sentry with `skipOpenTelemetrySetup: true` and plug Sentry's parts into your SDK:
| Part | Role |
|:--|:--|
| `SentrySpanProcessor` | sends spans to Sentry, next to the OTLP exporter for Tempo |
| `SentrySampler` | one sampling decision for both backends (`tracesSampleRate`) |
| `SentryPropagator` | W3C `traceparent` plus Sentry headers, so browser and backend traces connect |
| `SentryContextManager` | keeps Sentry's scopes in sync with OpenTelemetry context |
| `Sentry.validateOpenTelemetrySetup()` | warns at startup if a part is missing |

### What to report
| Report | Don't report |
|:--|:--|
| unexpected exceptions (5xx) | expected 4xx: validation, not found, unauthorized |
| jobs that failed their last attempt | job attempts that will be retried |
| crashes, unhandled rejections | errors handled by a fallback (log a warning instead) |
| integration failures you can't recover from | bots probing for `/wp-admin` |

### Sampling
| Strategy | Where | How | Trade-off |
|:--|:--|:--|:--|
| Head sampling | SDK, when the trace starts | `tracesSampleRate: 0.1` (parent-based: follows the caller's decision) | cheap; may drop the interesting traces |
| Tail sampling | collector, after the trace ends | keep all errors, all slow traces, 5% of the rest | best signal; all spans of a trace must reach the same collector |
| Errors-only Sentry + tail sampling | both | SDK sends 100% to the collector, Alloy tail-samples for Tempo, Sentry gets errors only (no `SentrySpanProcessor`) | common at scale |
| Logs | app | `info` in production, sample noisy debug logs | |
| Errors | Sentry | `sampleRate`, `ignoreErrors`, rate limits, spike protection | |

### Cost control
| Driver | Lever |
|:--|:--|
| Log volume | levels, no bodies, no health-check logs, shorter retention, archive to S3 |
| Metric cardinality | bounded attributes; drop unused metrics in the collector |
| Trace volume | head + tail sampling; drop noisy spans (fs, DNS) |
| Error events | don't report expected errors; fix or fingerprint loops; per-project quotas |
| Retention | 7–30 days hot; longer only for what you actually query |
| Ownership | monthly telemetry cost review per team |

## Example
`src/instrumentation.ts` — lesson 02's SDK with Sentry plugged in.
```ts
import { register } from 'node:module';
import * as Sentry from '@sentry/node';
import { SentryPropagator, SentrySampler, SentrySpanProcessor } from '@sentry/opentelemetry';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

const sentry = Sentry.init({
  dsn: process.env.SENTRY_DSN,                      // unset locally: Sentry stays off
  environment: process.env.APP_ENV,
  release: process.env.APP_VERSION,                 // the same version string as the deploy and the logs
  tracesSampleRate: 0.1,                            // shared decision for Sentry and Tempo
  sendDefaultPii: false,                            // no IPs, cookies, or request bodies
  skipOpenTelemetrySetup: true,                     // we own the OpenTelemetry setup below
  beforeSend(event) {
    if (event.request?.headers) delete event.request.headers['authorization'];
    return event;
  },
});

export const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'api',
    [ATTR_SERVICE_VERSION]: process.env.APP_VERSION ?? 'dev',
    'deployment.environment.name': process.env.APP_ENV ?? 'local',
  }),
  sampler: sentry ? new SentrySampler(sentry) : undefined,
  textMapPropagator: new SentryPropagator(),
  contextManager: new Sentry.SentryContextManager(),
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter()), new SentrySpanProcessor()],
  metricReader: new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter(), exportIntervalMillis: 15_000 }),
  logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
  instrumentations: [getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false } })],
});

sdk.start();
Sentry.validateOpenTelemetrySetup();
```
`src/app.ts` — capture server errors, then your own problem+json handler.
```ts
import * as Sentry from '@sentry/node';

app.use('/api', apiRouter);
Sentry.setupExpressErrorHandler(app);   // reports errors whose status is ≥ 500 (or missing); 4xx AppErrors are skipped
app.use(errorHandler(logger));          // problem+json responses (02-api-design lesson 02)
```
User context, failed jobs, and scheduled jobs:
```ts
// after authentication: an ID, never an email
Sentry.setUser({ id: user.id });

// BullMQ: report only when no retries are left
worker.on('failed', (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    Sentry.captureException(err, {
      tags: { queue: job.queueName, job: job.name },
      contexts: { job: { id: job.id, attemptsMade: job.attemptsMade } },
    });
  }
});

// A cron monitor: Sentry alerts if the 06:00 report doesn't start, or runs longer than 30 minutes
await Sentry.withMonitor('daily-sales-report', () => dailySalesReport(job), {
  schedule: { type: 'crontab', value: '0 6 * * *' },
  timezone: 'Europe/Berlin',
  checkinMargin: 5,
  maxRuntime: 30,
});

// graceful shutdown: flush before exiting
await Promise.allSettled([sdk.shutdown(), Sentry.flush(2_000)]);
```
Tail sampling in Alloy (for the errors-only Sentry setup: SDK sampler always on, no `SentrySpanProcessor`):
```alloy
otelcol.processor.tail_sampling "default" {
  decision_wait = "10s"

  policy {
    name = "errors"
    type = "status_code"
    status_code { status_codes = ["ERROR"] }
  }
  policy {
    name = "slow"
    type = "latency"
    latency { threshold_ms = 1000 }
  }
  policy {
    name = "baseline"
    type = "probabilistic"
    probabilistic { sampling_percentage = 5 }
  }

  output { traces = [otelcol.processor.batch.default.input] }
}
```
Source maps: with Node's type stripping, `.ts` line numbers are already correct. If you bundle or transpile, upload source maps for each release (`sentry-cli sourcemaps inject` and `upload` in CI).

## Production patterns
- **Sentry for unexpected errors only**, tied to releases and environments, with alerts on new issues and regressions.
- **One OpenTelemetry setup** feeding Tempo and Sentry, with one sampling decision.
- **Head sampling to start, tail sampling at scale**: keep all errors and slow traces, sample the rest.
- **Personal data off by default** (`sendDefaultPii: false`, `beforeSend` scrubbing, user ID only).
- **A monthly look at telemetry cost and quota usage**; fix the top noise sources.

## Mistakes
Wrong: reporting every error.
```ts
app.use((err, _req, _res, next) => { Sentry.captureException(err); next(err); }); // 404s and validation errors flood Sentry
```
Right: `setupExpressErrorHandler` (5xx only) and explicit captures for real failures.

Wrong: `sendDefaultPii: true` without a decision. IP addresses, cookies, and request data go to a third party. Right: off by default; add only the context you need, scrubbed.

Wrong: `tracesSampleRate: 1.0` in production at scale. Cost grows with traffic, not with insight. Right: 5–20% head sampling, or tail sampling in the collector.

Wrong: no flush on shutdown. The errors that explain why a task died are lost with it. Right: `sdk.shutdown()` and `Sentry.flush()` in the shutdown handler.

## Check yourself
1. Why use `skipOpenTelemetrySetup: true` in this stack?
2. What's the difference between head and tail sampling, and why does tail sampling need a collector?
3. Which errors should not go to Sentry?

<details>
<summary>Answers</summary>

1. The app already runs its own OpenTelemetry `NodeSDK` for Tempo, Mimir, and Loki. Letting Sentry set up a second one would conflict. Skipping Sentry's setup and adding its sampler, propagator, context manager, and span processor to the existing SDK gives one trace pipeline for both backends.
2. Head sampling decides at the start of a trace, before you know if it will be slow or fail. Tail sampling decides after the trace finishes, so it can keep every error and slow trace. That requires buffering all spans of a trace in one place, which is the collector's job.
3. Expected client errors (4xx such as validation, not found, unauthorized), failures that will be retried or are handled by a fallback, and noise such as bot scans. They waste quota and hide real problems.
</details>

## Sources
- [Sentry — Express guide](https://docs.sentry.io/platforms/javascript/guides/express/)
- [Sentry — Using your existing OpenTelemetry setup](https://docs.sentry.io/platforms/javascript/guides/node/opentelemetry/custom-setup/)
- [Sentry — Crons](https://docs.sentry.io/platforms/javascript/guides/node/crons/)
- [OpenTelemetry — Sampling](https://opentelemetry.io/docs/concepts/sampling/)
- [Grafana Alloy — `otelcol.processor.tail_sampling`](https://grafana.com/docs/alloy/latest/reference/components/otelcol/otelcol.processor.tail_sampling/)
