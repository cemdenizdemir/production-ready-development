---
title: Observability
module: 03-backend
tech: Pino, OpenTelemetry, Grafana LGTM, Sentry
---
# Observability
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Logs, metrics, traces, and errors: what each answers; monitoring vs observability
- [ ] ⭐ Structured logging with Pino: levels, context, child loggers, request logging
- [ ] ⭐ Distributed tracing with OpenTelemetry: spans, context propagation, auto-instrumentation
- [ ] ⭐ Metrics with OpenTelemetry: counters, histograms, RED and USE, cardinality
- [ ] Correlating signals: trace IDs in logs, exemplars, linking errors to traces
- [ ] Grafana LGTM: Loki, Grafana, Tempo, Mimir, and the Alloy collector
- [ ] ⭐ Error tracking with Sentry: Express setup, releases, sharing the OpenTelemetry setup
- [ ] Dashboards that help: service overview, dependencies, business panels, dashboards as code
- [ ] Alerting: symptom-based alerts, runbooks, routing, on-call hygiene
- [ ] Sampling and cost control: head vs tail sampling, log volume, cardinality, retention
- [ ] Business and dependency metrics: orders, payments, signups, partner latency
- [ ] Privacy and security in telemetry: redaction, personal data, secrets, access

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Observability basics and structured logging with Pino](docs/01-logs-and-pino.md)
- [02 · Tracing and metrics with OpenTelemetry](docs/02-tracing-and-metrics.md)
- [03 · Grafana LGTM, dashboards, and alerting](docs/03-lgtm-dashboards-alerting.md)
- [04 · Error tracking with Sentry; sampling and cost](docs/04-sentry-sampling-cost.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn typescript/03-backend/10-observability mode=tasks` when you are ready to build._
