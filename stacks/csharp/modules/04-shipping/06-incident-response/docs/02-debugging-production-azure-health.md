---
title: Debugging in production, and is it us or Azure?
tech: Application Insights, Log Analytics (KQL), Sentry, Azure Service Health, Resource Health
version: Azure Monitor (November 2026), Sentry (current)
date: 2026-11-09
covers: [4, 13]
---
# Debugging in production, and is it us or Azure?
[← Overview](00-overview.md)

## Why it matters
- During an incident, three people wrote KQL from scratch, each slightly wrong. Saved queries in the runbook would have answered "which endpoint, since when, which dependency" in a minute.
- The team spent 40 minutes debugging their code while Azure SQL in their region had a published service issue. Service Health had an alert option nobody had set up.
- Errors spiked after a deploy, but without deploy markers nobody connected them to the release.

## Concepts

### A triage path through telemetry
| Question | Where to look |
|:--|:--|
| ⭐ what's the user impact? | SLO dashboard; `requests` failure rate and latency by operation |
| ⭐ since when, and what changed then? | time charts with deploy markers (annotations), activity log, flag changes |
| ⭐ which operation and which dependency? | Application Insights Failures and Performance blades; `dependencies` by target |
| one example | end-to-end transaction view of a failed request (trace across API, SQL, Service Bus) |
| ⭐ which exception? | `exceptions` grouped by `problemId` and version |
| is it one replica / region? | split by `cloud_RoleInstance`, revision, region |
| frontend too? | Sentry issues by release; browser errors with trace IDs |
| platform events? | Container Apps system logs (restarts, OOM, probe failures) |
| live view | Live Metrics during mitigation |

Go **broad to narrow**: impact → time → operation → dependency → example trace → code. Change one thing at a time and watch the graph.

### Is it us or Azure?
| Tool | Shows |
|:--|:--|
| ⭐ Azure Service Health | service issues, planned maintenance, health and security advisories for **your** subscriptions, regions, and services |
| ⭐ Resource Health | availability of each of your resources (Available / Degraded / Unavailable / Unknown) and history |
| Azure status page | global public status (status.azure.com); usually later and broader than Service Health |
| third-party status pages | Stripe, GitHub, email providers |
| your own dependency metrics | partner latency and errors from `dependencies` |

Set **Service Health alerts** (activity log alerts) for the regions and services you use, routed to the on-call channel. Even when it's Azure, you still mitigate: fail over, degrade, communicate.

## Example
Saved queries in the runbook (Application Insights, `requests`/`dependencies`/`exceptions`):
```kusto
// 1. Failure rate by operation, last 2 hours
requests
| where timestamp > ago(2h)
| summarize total = count(), failed = countif(success == false), p95 = percentile(duration, 95) by name
| extend failRate = round(100.0 * failed / total, 2)
| where total > 50
| order by failRate desc
```
```kusto
// 2. Failing dependencies around the incident
dependencies
| where timestamp between (datetime(2026-11-09 13:50) .. datetime(2026-11-09 14:30))
| summarize calls = count(), failed = countif(success == false), p95 = percentile(duration, 95) by target, type, resultCode
| order by failed desc
```
```kusto
// 3. New exceptions after the deploy, by version
exceptions
| where timestamp > ago(3h)
| summarize count() by problemId, application_Version, outerMessage
| order by count_ desc
```
```kusto
// 4. Did it start with a deploy? Errors per minute next to annotations shown on the chart
requests
| where timestamp > ago(3h)
| summarize failed = countif(success == false) by bin(timestamp, 1m), cloud_RoleName
| render timechart
```
Service Health alert (Bicep excerpt):
```bicep
resource serviceHealth 'Microsoft.Insights/activityLogAlerts@2020-10-01' = {
  name: 'shop-service-health'
  location: 'global'
  properties: {
    scopes: [ subscription().id ]
    condition: {
      allOf: [
        { field: 'category', equals: 'ServiceHealth' }
        { field: 'properties.incidentType', equals: 'Incident' }
        { anyOf: [ { field: 'properties.impactedServices[*].ImpactedRegions[*].RegionName', containsAny: [ 'West Europe', 'North Europe' ] } ] }
      ]
    }
    actions: { actionGroups: [ { actionGroupId: onCallActionGroupId } ] }
    enabled: true
  }
}
```
Resource Health from the CLI:
```bash
az rest --method get \
  --url "https://management.azure.com${SQL_DB_ID}/providers/Microsoft.ResourceHealth/availabilityStatuses/current?api-version=2022-10-01" \
  --query "properties.{state:availabilityState, summary:summary}"
```

## Production patterns
- A triage runbook with saved queries and dashboard links; deploy markers and versions on every chart.
- Broad-to-narrow investigation with one person driving and others assigned specific questions by the IC.
- Service Health alerts for used services and regions, Resource Health checked early, partner status pages bookmarked.
- Evidence (queries, screenshots, trace IDs) pasted into the incident channel as you go: it becomes the postmortem timeline.

## Mistakes
Wrong: starting from code ("let's read OrderService") before knowing which operation and dependency fail.
Right: impact → time → operation → dependency → example → code.

Wrong: no Service Health alerts; finding out about an Azure outage on social media.
Right: activity log alerts on `ServiceHealth` for your regions and services, routed to on-call.

## Check yourself
1. What's the first question to answer with telemetry in an incident?
2. What's the difference between Service Health and Resource Health?
3. If Azure SQL has a regional issue, what do you still own?

<details><summary>Answers</summary>

1. What's the user impact (which journeys, how many users, how bad) and since when; that sets severity and the time window for everything else.
2. Service Health reports Azure service issues, maintenance, and advisories affecting your subscriptions and regions. Resource Health reports the availability of each of your individual resources.
3. Mitigation and communication: failing over or degrading (read-only mode, fallbacks), updating customers through the status page, and the postmortem on how to be more resilient next time.
</details>

## Sources
- [Application Insights — Failures and Performance](https://learn.microsoft.com/azure/azure-monitor/app/failures-performance-transactions)
- [Log queries in Azure Monitor](https://learn.microsoft.com/azure/azure-monitor/logs/log-query-overview)
- [Azure Service Health](https://learn.microsoft.com/azure/service-health/overview)
- [Resource Health](https://learn.microsoft.com/azure/service-health/resource-health-overview)
- [Service Health alerts](https://learn.microsoft.com/azure/service-health/alerts-activity-log-service-notifications-portal)
- [Sentry — releases](https://docs.sentry.io/product/releases/)
