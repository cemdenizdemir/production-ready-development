---
title: Dashboards, alerts, and business metrics
tech: Azure Monitor Workbooks, Azure Managed Grafana, Azure Monitor alerts, Bicep, OpenTelemetry metrics
version: Azure Monitor (2026), Bicep 0.3x
date: 2026-11-09
covers: [10, 11, 13]
---
# Dashboards, alerts, and business metrics
[← Overview](00-overview.md)

## Why it matters
- The team had 40 dashboards and none answered "is checkout healthy right now?". During an incident, people argued over which graph to trust.
- 300 alerts a week, most of them "CPU > 70%". On-call muted the channel, then missed the real payment outage.
- All technical metrics were green while orders per minute fell 60%. A partner's change silently broke one payment method.

## Concepts

### Dashboards that help
| Dashboard | Panels |
|:--|:--|
| ⭐ service overview (one per service) | request rate, error rate, p50/p95/p99 by route; SLO and error budget left; replicas; recent deploys |
| ⭐ dependencies | per dependency (SQL, Redis, payments, shipping, Service Bus): calls/s, error rate, p95, circuit breaker state |
| saturation | CPU, memory, thread-pool queue, SQL pool usage, DTU/vCore %, Redis CPU, queue depth and age |
| ⭐ business | orders/min, payment success rate by method, signups, cart → checkout conversion, revenue/hour vs last week |
| release | error groups and latency by `service.version` |

Rules: start with the user journey, show rates and percentiles (not averages), put the same time window on every panel, and link each panel to the query or trace view behind it.

| Tool | Use |
|:--|:--|
| ⭐ Azure Monitor Workbooks | parameterised KQL reports inside Azure; deployable from Bicep/ARM |
| Azure Managed Grafana | Grafana with Azure Monitor and Prometheus data sources; dashboards as JSON |
| Azure portal dashboards | pinned charts; simple, less flexible |
| Aspire dashboard | local only |

**Dashboards as code:** workbook JSON or Grafana JSON lives in the repo (`infra/dashboards/`) and is deployed by CI, so dashboards are reviewed, versioned, and recreated in every environment.

### Alerting
| Principle | Practice |
|:--|:--|
| ⭐ alert on symptoms | SLO burn rate, error rate, latency, orders/min drop: what users feel |
| causes on dashboards | CPU, memory, pool usage become tickets or dashboard panels, not pages |
| ⭐ every page is actionable | a page needs a human now; otherwise it's a ticket |
| ⭐ runbook link | every alert links to a runbook: what it means, first checks, mitigations (04-shipping/06-incident-response) |
| severity and routing | Sev 1–2 page on-call (action group → phone/push, PagerDuty/Opsgenie); Sev 3–4 create tickets or chat messages |
| dedupe and grouping | one alert per problem, not one per replica |
| on-call hygiene | review alerts weekly; delete or fix noisy ones; track pages per shift |

| Azure alert type | Use |
|:--|:--|
| metric alert | platform/custom metrics (fast, cheap): 5xx count, queue length, DLQ messages |
| ⭐ log search alert (scheduled query) | KQL over Log Analytics: burn rates, business metrics |
| activity log alert | resource changes (deleted, failed deployment) |
| smart detection | Application Insights failure anomalies |
| action group | who gets notified, and how |

### Business and dependency metrics
| Metric | Type | Tags |
|:--|:--|:--|
| ⭐ `shop.orders.placed` | counter | `payment.method`, `currency` |
| ⭐ `shop.payments.attempts` | counter | `provider`, `outcome` (succeeded, declined, error) |
| `shop.signups` | counter | `source` |
| `shop.carts.checkout_started` | counter | — |
| ⭐ `http.client.request.duration` | histogram (built in) | `server.address`, `http.response.status_code`: partner latency |
| `shop.outbox.lag` | gauge | — |
| `shop.jobs.failed` | counter | `queue`, `job` |

Alert on business symptoms with **seasonality** in mind: "orders/min < 40% of the same hour last week, for 15 minutes", not a fixed number.

## Example
`infra/modules/alerts.bicep` (log search alert: checkout burn rate)
```bicep
param workspaceId string
param actionGroupId string
param location string = resourceGroup().location

resource checkoutBurn 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: 'shop-checkout-slo-fast-burn'
  location: location
  properties: {
    displayName: 'Checkout SLO fast burn (14.4x, 1h + 5m)'
    description: 'Runbook: https://github.com/OWNER/REPO/blob/main/docs/runbooks/checkout-errors.md'
    severity: 1
    enabled: true
    scopes: [ workspaceId ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT1H'
    criteria: {
      allOf: [
        {
          query: '''
            let slo = 0.995;
            let burn = (w: timespan) { AppRequests
              | where TimeGenerated > ago(w) and Name == "POST /orders"
              | summarize bad = countif(toint(ResultCode) >= 500 or DurationMs > 1000), total = count()
              | project rate = (todouble(bad) / total) / (1 - slo) };
            burn(1h) | extend short = toscalar(burn(5m)) | where rate > 14.4 and short > 14.4
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: { numberOfEvaluationPeriods: 1, minFailingPeriodsToAlert: 1 }
        }
      ]
    }
    actions: { actionGroups: [ actionGroupId ] }
  }
}
```
Business alert query: orders drop vs last week
```kusto
let now_ = AppMetrics | where TimeGenerated > ago(15m) and Name == "shop.orders.placed" | summarize n = sum(Sum);
let lastWeek = AppMetrics | where TimeGenerated between (ago(7d + 15m) .. ago(7d)) and Name == "shop.orders.placed" | summarize n = sum(Sum);
print ratio = todouble(toscalar(now_)) / todouble(toscalar(lastWeek))
| where ratio < 0.4
```
Custom OpenTelemetry metrics land in `AppMetrics` when exported with the Azure Monitor distro.

## Production patterns
- One service-overview and one business dashboard per service, as code, linked from the README and every alert.
- Paging alerts are few: SLO burn rates for each critical journey, plus business drops, DLQ growth, and certificate or secret expiry.
- Every alert has an owner, a severity, a runbook, and a review date. Noisy alerts get fixed or deleted the same week.
- Partner dependencies have their own panels and alerts (latency, errors, breaker opens), so you know whether "it's us or them".

## Mistakes
Wrong: an alert on "average response time > 500 ms" for the whole API, paging at 03:00.
Right: a burn-rate alert on the checkout SLO, linked to a runbook.

Wrong: dashboards built by hand in one environment's portal.
Right: workbook or Grafana JSON in the repo, deployed by CI to every environment.

## Check yourself
1. What three things does every paging alert need?
2. Why compare business metrics with the same time last week?
3. Which built-in metric shows partner API latency, and which tag separates partners?

<details><summary>Answers</summary>

1. A user-facing symptom that needs action now, a clear severity and routing, and a runbook link (plus an owner).
2. Traffic has daily and weekly patterns. A fixed threshold either fires every night or misses a daytime drop; a relative comparison with last week's same hour accounts for seasonality.
3. `http.client.request.duration` (from HttpClient instrumentation), split by `server.address` (and status code).
</details>

## Sources
- [Azure Monitor alerts overview](https://learn.microsoft.com/azure/azure-monitor/alerts/alerts-overview)
- [Log search alert rules (Bicep reference)](https://learn.microsoft.com/azure/templates/microsoft.insights/scheduledqueryrules)
- [Azure Workbooks](https://learn.microsoft.com/azure/azure-monitor/visualize/workbooks-overview)
- [Azure Managed Grafana](https://learn.microsoft.com/azure/managed-grafana/overview)
- [Google SRE book — Monitoring distributed systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [My philosophy on alerting (Rob Ewaschuk)](https://docs.google.com/document/d/199PqyG3UsyXlwieHaqbGiWVa8eMWi8zzAn0YfcApr8Q/preview)
