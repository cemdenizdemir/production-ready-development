---
title: Aspire dashboard, Application Insights, and error tracking
tech: Aspire dashboard, Azure Monitor OpenTelemetry Distro, Application Insights, Log Analytics, Sentry
version: Aspire dashboard 13.x, Azure.Monitor.OpenTelemetry.AspNetCore 1.5+, @sentry/nextjs 10.x
date: 2026-11-09
covers: [7, 8, 9]
---
# Aspire dashboard, Application Insights, and error tracking
[← Overview](00-overview.md)

## Why it matters
- Developers only look at telemetry in production, during incidents, so nobody knows what "normal" traces look like or that half the spans are missing.
- The team installed the classic Application Insights SDK *and* OpenTelemetry. Every request was recorded twice and the bill doubled.
- Frontend errors went to the browser console and nowhere else. A broken checkout button on Safari went unnoticed for three days.

## Concepts

### Aspire dashboard locally
| Item | Value |
|:--|:--|
| ⭐ what | a web UI for OpenTelemetry logs, traces, and metrics; accepts any OTLP data |
| run | standalone container (no AppHost needed), or automatically with an Aspire AppHost (04-shipping/01-containers) |
| ports | UI `18888`, OTLP/gRPC `18889`, OTLP/HTTP `18890` (inside the container) |
| app settings | `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317`, `OTEL_SERVICE_NAME=shop-api` |
| storage | in memory only; restart = empty |
| auth | login token in the container logs; `ASPIRE_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS=true` only on your machine |

Use it every day: run a request, open its trace, check that SQL, Redis, and HTTP spans appear, and that logs carry the trace ID.

### Azure Monitor and Application Insights
| Piece | Role |
|:--|:--|
| ⭐ Azure Monitor OpenTelemetry Distro | `Azure.Monitor.OpenTelemetry.AspNetCore`; `UseAzureMonitor()` adds instrumentation, exporters, Live Metrics, and sampling |
| Application Insights resource | the app's telemetry UI: Failures, Performance, Application Map, Transaction search, Live Metrics |
| Log Analytics workspace | where data lives; query with KQL; tables `AppRequests`, `AppDependencies`, `AppExceptions`, `AppTraces`, `AppMetrics` |
| connection string | `APPLICATIONINSIGHTS_CONNECTION_STRING` (not a secret, but keep it out of code); Entra ID auth with `Credential` for ingestion |
| ⭐ sampling | distro 1.5+: rate-limited, 5 traces/s by default; set `TracesPerSecond` or `SamplingRatio` (lesson 05) |
| classic SDK (`Microsoft.ApplicationInsights.AspNetCore`) | avoid in new apps; never alongside the distro |

| Blade | Answers |
|:--|:--|
| ⭐ Failures | top failing operations, exceptions, and dependencies, grouped, with sample traces |
| Performance | slowest operations and dependencies, by percentile |
| Application Map | services and dependencies with call rates, latency, and errors |
| ⭐ Transaction search / end-to-end view | one request's spans and logs across services |
| ⭐ Live Metrics | real-time requests, failures, and CPU during a deploy or incident |
| Workbooks / Dashboards | saved views (lesson 04) |

### Error tracking
| Where | Tool | What you get |
|:--|:--|:--|
| ⭐ backend | Application Insights exceptions (from `LogError(ex, ...)` and span exceptions) | grouped by problem ID, linked to the trace, release (`service.version`) |
| ⭐ frontend | Sentry (`@sentry/nextjs`) | browser and server errors, source maps, release tracking, session replay (opt-in) |
| linking | frontend sends `traceparent` (`propagateTraceparent: true`) | Sentry issue → backend trace ID |
| also seen | Sentry for .NET | if the team wants one error tool for everything |

Treat new error groups after a release as a release signal: compare by `service.version` and roll back if a new group spikes.

## Example
`compose.yaml` (excerpt, profile `observability`)
```yaml
services:
  aspire-dashboard:
    image: mcr.microsoft.com/dotnet/aspire-dashboard:latest   # pin the tag you tested
    profiles: [observability]
    ports:
      - "18888:18888"   # UI
      - "4317:18889"    # OTLP gRPC
      - "4318:18890"    # OTLP HTTP
    environment:
      ASPIRE_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS: "true"      # local only
```
`src/Shop.Api/Properties/launchSettings.json` (environment for `dotnet run`)
```json
"environmentVariables": {
  "ASPNETCORE_ENVIRONMENT": "Development",
  "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4317",
  "OTEL_SERVICE_NAME": "shop-api"
}
```
`src/Shop.Api/Program.cs` (one setup, two destinations)
```csharp
using Azure.Identity;
using Azure.Monitor.OpenTelemetry.AspNetCore;

var otel = builder.Services.AddOpenTelemetry();   // instrumentation from lesson 02
if (!string.IsNullOrEmpty(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]))
    otel.UseOtlpExporter();                                            // Aspire dashboard
if (!string.IsNullOrEmpty(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]))
    otel.UseAzureMonitor(o =>
    {
        o.Credential = new DefaultAzureCredential();                   // Entra ID ingestion (managed identity)
        o.TracesPerSecond = 20;                                        // explicit, not the 5/s default
    });
```
KQL in Log Analytics: failing dependencies in the last hour
```kusto
AppDependencies
| where TimeGenerated > ago(1h) and Success == false
| summarize failures = count(), p95 = percentile(DurationMs, 95) by Target, ResultCode, AppRoleName
| order by failures desc
```
Exceptions by release:
```kusto
AppExceptions
| where TimeGenerated > ago(24h)
| summarize count() by ProblemId, AppVersion
| order by count_ desc
```
`frontend/instrumentation-client.ts` (Next.js 16, Sentry)
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_RELEASE,
  tracesSampleRate: 0.1,
  tracePropagationTargets: [/^https:\/\/api\.shop\.example/],
  propagateTraceparent: true,       // W3C header the .NET API understands; allow it in CORS
  sendDefaultPii: false,
});
```

## Production patterns
- Every developer runs the Aspire dashboard locally; a PR that adds a dependency shows its spans.
- Production uses the Azure Monitor distro with explicit sampling, Entra ID ingestion, and `service.version` from CI.
- The classic Application Insights SDK is removed when migrating; one telemetry pipeline only.
- Frontend errors go to Sentry with source maps and releases; backend exceptions go to Application Insights; both link through trace IDs.

## Mistakes
Wrong: `builder.Services.AddApplicationInsightsTelemetry()` and `UseAzureMonitor()` in the same app.
Right: the distro only.

Wrong: leaving the distro's sampling default unexamined, then searching for a specific failed request that was never kept.
Right: set `TracesPerSecond` or `SamplingRatio` on purpose; make sure errors are kept (lesson 05).

## Check yourself
1. Why can the Aspire dashboard be used without an Aspire AppHost?
2. Where do you go first in Application Insights when error rates rise?
3. How does a Sentry frontend error link to a backend trace?

<details><summary>Answers</summary>

1. It's a standalone OTLP receiver and UI. Any app exporting OpenTelemetry over OTLP can send to it.
2. The Failures blade (top failing operations, dependencies, and exceptions with sample traces), and Live Metrics if it's happening right now.
3. The browser SDK adds a `traceparent` header to API calls (`propagateTraceparent: true`). The .NET API continues that trace, so the Sentry event and the Application Insights trace share a trace ID.
</details>

## Sources
- [Standalone Aspire dashboard](https://learn.microsoft.com/dotnet/aspire/fundamentals/dashboard/standalone)
- [Enable Azure Monitor OpenTelemetry for .NET](https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-enable)
- [Sampling in Azure Monitor OpenTelemetry](https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-sampling)
- [Application Insights overview](https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- [Sentry for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry — CORS and trace headers](https://docs.sentry.io/platforms/javascript/tracing/distributed-tracing/dealing-with-cors-issues/)
