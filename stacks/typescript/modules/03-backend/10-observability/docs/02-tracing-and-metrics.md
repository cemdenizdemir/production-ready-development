---
title: Tracing and metrics with OpenTelemetry
tech: OpenTelemetry, Node.js 26, Express 5, BullMQ
version: OpenTelemetry JS SDK 2.x (sdk-node, auto-instrumentations-node), Node.js 26 LTS, BullMQ 5
date: 2026-11-07
covers: [3, 4, 5]
---
# Tracing and metrics with OpenTelemetry
[← Overview](00-overview.md)

## Why it matters
- Checkout p99 is 4 seconds and the logs show nothing slow. A trace would show 30 sequential Redis calls: an N+1 on the cache.
- Someone adds `userId` as a metric attribute. Two million time series later, the metrics bill jumps and dashboards time out.
- Logs and traces live in different tools with no shared ID. Matching an error to its request takes 30 minutes of comparing timestamps.

## Concepts

### Tracing
| Term | Meaning |
|:--|:--|
| Trace | one request's whole journey, across services and queues |
| Span | one operation (HTTP handler, DB query, Redis call, job) with start, duration, attributes, status |
| Span kind | `server`, `client`, `producer`, `consumer`, `internal` |
| Context propagation | the W3C `traceparent` header carries trace ID + parent span ID; queues carry it in job data |
| Attributes | key-values on a span: `http.route`, `db.system.name`, `order.id` |
| Exceptions | `span.recordException(err)` + status `ERROR` |
| Resource | who emitted it: `service.name`, `service.version`, `deployment.environment.name` |

**Auto-instrumentation** (`@opentelemetry/auto-instrumentations-node`) creates spans for incoming and outgoing HTTP (including `fetch`), Express routes, pg, Redis, the AWS SDK, and adds trace IDs to Pino logs. You add **manual spans** for business operations worth seeing on their own.

### Metrics
| Instrument | Use | Example |
|:--|:--|:--|
| Counter | only goes up | `shop.orders.created`, `shop.payments` |
| UpDownCounter | goes up and down | open SSE connections |
| Histogram | distributions → percentiles | durations, payload sizes |
| Gauge / ObservableGauge | sampled current value | queue depth, pool usage |

RED for free: with `OTEL_SEMCONV_STABILITY_OPT_IN=http`, the HTTP instrumentation records `http.server.request.duration` (seconds) with `http.request.method`, `http.route`, and `http.response.status_code`, and `http.client.request.duration` for outgoing calls.

### Cardinality
Every unique combination of attribute values is a separate time series. Cost and query speed scale with the number of series.
| Attribute | On metrics? |
|:--|:--|
| `http.route` (`/api/orders/:id`) | ✓ |
| Full URL (`/api/orders/8f3c…`) | ✗ |
| Status code, method | ✓ |
| Error type (bounded set) | ✓ |
| User ID, email, order ID | ✗ (traces and logs only) |
| Tenant ID | only for a small, bounded set |

### Correlating signals
| Link | How |
|:--|:--|
| Logs → trace | `trace_id` and `span_id` on every log line (Pino instrumentation) |
| Trace → logs | Grafana "trace to logs" queries Loki by trace ID |
| Metrics → trace | exemplars: sample trace IDs attached to histogram data points (where supported) |
| Error → trace | Sentry events carry the trace ID ([lesson 04](04-sentry-sampling-cost.md)) |
| Job → request | context propagated through job data (BullMQ telemetry) |
| Support ticket → trace | return `X-Request-Id`; log it next to the trace ID |

## Example
`src/instrumentation.ts` — loaded before the app with `node --import ./src/instrumentation.ts src/server.ts`.
```ts
import { register } from 'node:module';
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

register('@opentelemetry/instrumentation/hook.mjs', import.meta.url); // instrument ESM imports too

export const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'api',
    [ATTR_SERVICE_VERSION]: process.env.APP_VERSION ?? 'dev',
    'deployment.environment.name': process.env.APP_ENV ?? 'local',
  }),
  // Exporters read OTEL_EXPORTER_OTLP_ENDPOINT (default http://localhost:4318)
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  metricReader: new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter(), exportIntervalMillis: 15_000 }),
  logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())], // Pino logs, via the pino instrumentation
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },              // very noisy, rarely useful
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) => req.url?.startsWith('/health') ?? false,
      },
    }),
  ],
});

sdk.start();
// In the graceful shutdown (01-language-runtime lesson 02): await sdk.shutdown() to flush telemetry
```
Environment (local values; in AWS the endpoint is the Alloy sidecar):
```bash
OTEL_SERVICE_NAME=api
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SEMCONV_STABILITY_OPT_IN=http
```
A manual span around a business operation:
```ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('checkout');

export async function placeOrder(accountId: string, input: PlaceOrderInput) {
  return tracer.startActiveSpan('checkout.place_order', async (span) => {
    span.setAttribute('order.item_count', input.items.length);
    try {
      const order = await orders.create(accountId, input);       // pg spans become children of this span
      span.setAttribute('order.id', order.id);                   // fine on a span, never on a metric
      return order;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();                                                // always end spans
    }
  });
}
```
`src/metrics.ts` — business metrics with bounded attributes.
```ts
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('shop');

export const ordersCreated = meter.createCounter('shop.orders.created', { description: 'Orders placed' });
export const payments = meter.createCounter('shop.payments', { description: 'Payment attempts by outcome' });
export const checkoutDuration = meter.createHistogram('shop.checkout.duration', {
  unit: 's',
  advice: { explicitBucketBoundaries: [0.1, 0.25, 0.5, 1, 2, 4, 8] },
});

// usage
ordersCreated.add(1, { channel: 'web', 'payment.method': 'card' });
payments.add(1, { outcome: 'failed', reason: 'card_declined' });   // bounded values only, never a user ID
checkoutDuration.record(1.42, { channel: 'web' });
```
In Prometheus/Mimir these become `shop_orders_created_total`, `shop_payments_total`, and `shop_checkout_duration_seconds_bucket`.

Traces through BullMQ — the job's spans continue the request's trace:
```ts
import { Queue, Worker } from 'bullmq';
import { BullMQOtel } from 'bullmq-otel';

const telemetry = new BullMQOtel('shop');
export const emailQueue = new Queue('email', { connection, telemetry });
new Worker('email', processEmail, { connection, telemetry });
```

## Production patterns
- **SDK loaded first** with `--import`, resource attributes on everything (service, version, environment).
- **Auto-instrumentation for the plumbing, manual spans for business steps**, noisy instrumentations disabled.
- **Metrics with bounded attributes**; IDs go on spans and logs.
- **Stable HTTP semantic conventions** turned on, so dashboards and SLO queries use standard names.
- **Context propagated across queues and services**, so one trace shows the whole flow.

## Mistakes
Wrong: importing the SDK inside the app.
```ts
import express from 'express';
import './instrumentation.ts'; // express was already loaded: no Express spans
```
Right: `node --import ./src/instrumentation.ts src/server.ts`, so instrumentation runs before any app import.

Wrong: high-cardinality metric attributes.
```ts
requestCounter.add(1, { userId: user.id, path: req.originalUrl }); // a new series per user and per URL
```
Right: `{ 'http.route': '/api/orders/:id' }` on metrics; user IDs on spans.

Wrong: `tracer.startSpan()` without `end()` on every path. Spans leak and traces show nothing. Right: `startActiveSpan` with `try`/`finally { span.end() }`.

Wrong: averaging latency from histograms (`sum / count`). Right: `histogram_quantile(0.95, …)` per route.

## Check yourself
1. What carries the trace context from one service, or one job, to the next?
2. Why is `order.id` fine on a span but not on a metric?
3. Why must the OpenTelemetry SDK load before the application code?

<details>
<summary>Answers</summary>

1. For HTTP, the W3C `traceparent` header (injected by the client instrumentation, extracted by the server instrumentation). For queues, the context is serialized into the job (BullMQ's telemetry integration), and the worker starts its span as a child of it.
2. Spans are individual records, so a unique value per span costs nothing extra. Metrics are aggregated per unique attribute combination; a unique order ID creates a new time series for every order, which explodes storage, cost, and query time.
3. Instrumentation works by patching modules when they are loaded (require/import hooks). If Express, pg, or http are imported before the SDK starts, they aren't patched and produce no spans.
</details>

## Sources
- [OpenTelemetry JS — Node.js getting started](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- [OpenTelemetry JS — ESM support](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md)
- [OpenTelemetry — Semantic conventions for HTTP metrics](https://opentelemetry.io/docs/specs/semconv/http/http-metrics/)
- [W3C — Trace Context](https://www.w3.org/TR/trace-context/)
- [Prometheus — Metric and label naming](https://prometheus.io/docs/practices/naming/)
- [BullMQ — Telemetry](https://docs.bullmq.io/guide/telemetry)
