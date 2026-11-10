---
title: Observability
module: 03-backend
tech: ILogger, OpenTelemetry, Aspire dashboard, Application Insights, Sentry
---
# Observability
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Logs, metrics, traces, and errors: what each answers; monitoring vs observability
- [ ] ⭐ Structured logging with `ILogger`: levels, message templates, scopes, `[LoggerMessage]` source generation, HTTP logging
- [ ] ⭐ Distributed tracing with OpenTelemetry: spans, context propagation, auto-instrumentation
- [ ] ⭐ Metrics with OpenTelemetry: counters, histograms, RED and USE, cardinality
- [ ] Instrumenting your own code: `ActivitySource`, `Meter`, and semantic conventions
- [ ] Correlating signals: trace IDs in logs, exemplars, linking errors to traces
- [ ] ⭐ The Aspire dashboard locally: logs, traces, and metrics from OpenTelemetry
- [ ] ⭐ Azure Monitor and Application Insights: the OpenTelemetry distro, failures, Live Metrics, KQL in Log Analytics
- [ ] Error tracking: exceptions in Application Insights; Sentry for the frontend
- [ ] Dashboards that help: service overview, dependencies, business panels, dashboards as code
- [ ] Alerting: symptom-based alerts, runbooks, routing, on-call hygiene
- [ ] Sampling and cost control: head vs tail sampling, log volume, cardinality, retention
- [ ] Business and dependency metrics: orders, payments, signups, partner latency
- [ ] Privacy and security in telemetry: redaction, personal data, secrets, access
- [ ] Serilog: why many teams use it, and bridging it to OpenTelemetry

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Signals, structured logging with ILogger, and Serilog](docs/01-signals-structured-logging.md)
- [02 · Traces and metrics with OpenTelemetry](docs/02-opentelemetry-traces-metrics.md)
- [03 · Aspire dashboard, Application Insights, and error tracking](docs/03-aspire-app-insights-errors.md)
- [04 · Dashboards, alerts, and business metrics](docs/04-dashboards-alerts-business.md)
- [05 · Sampling, cost, and privacy in telemetry](docs/05-sampling-cost-privacy.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/10-observability mode=tasks` when you are ready to build._
