---
title: Cost awareness and platform logs
tech: Azure Cost Management, budgets, Azure Advisor, Log Analytics, Azure Monitor
version: Azure (November 2026)
date: 2026-11-09
covers: [11, 12]
---
# Cost awareness and platform logs
[← Overview](00-overview.md)

## Why it matters
- A load test environment was left running with 20 dedicated replicas and a Business Critical database. Nobody noticed for six weeks; it cost more than production.
- Verbose logs from every container went to Log Analytics at the Analytics tier with 2-year retention. Logs became the biggest line on the bill.
- A container kept restarting because of a failing liveness probe. The app's own logs were empty; the reason was only in the platform's system logs, which nobody knew to look at.

## Concepts

### What costs money (for this stack)
| Resource | Main cost drivers | Levers |
|:--|:--|:--|
| ⭐ Container Apps | vCPU-seconds, GiB-seconds, requests (Consumption); profile instances (Dedicated) | right-size CPU/memory, min replicas only where needed, scale to zero for workers and non-prod |
| ⭐ Azure SQL | vCores (or DTUs), storage, backup storage, replicas | right-size from metrics, serverless for non-prod, reservations for steady prod |
| Managed Redis | tier and size | smallest tier that fits memory and throughput |
| ⭐ Log Analytics | GB ingested, retention | filters, levels, table plans, retention (03-backend/10-observability) |
| Front Door | base fee, requests, data transfer | caching reduces origin traffic |
| egress | data leaving Azure | CDN, compression |
| Key Vault, ACR, Service Bus | operations, SKU | usually small; ACR Premium only if needed |
| NAT gateway, private endpoints | hourly + data | needed for security; budget them |

| Tool | Use |
|:--|:--|
| ⭐ budgets | monthly amount per subscription or resource group, alerts at 50/80/100% actual and forecast |
| Cost Management | cost analysis by resource group, service, and tag |
| ⭐ tags | `app`, `env`, `owner`, `costCenter` for allocation |
| anomaly alerts | Cost Management alerts on unusual spend |
| Azure Advisor | right-sizing and idle resource recommendations |
| reservations / savings plans | 1- or 3-year commitments for steady workloads (SQL vCores, compute) |
| free grants and offers | Container Apps monthly grant; Azure SQL free offer; free account credits |
| auto-shutdown | non-prod scaled to zero at night and weekends; ephemeral PR environments deleted |

### Platform logs and metrics
| Source | Where | Contains |
|:--|:--|:--|
| ⭐ Container Apps console logs | `ContainerAppConsoleLogs_CL` (Log Analytics destination) or `ContainerAppConsoleLogs` (diagnostic settings) | stdout/stderr of your containers |
| ⭐ Container Apps system logs | `ContainerAppSystemLogs_CL` / `ContainerAppSystemLogs` | revision provisioning, probe failures, restarts, scaling, OOM |
| platform metrics | Azure Monitor metrics | replicas, requests, CPU, memory, restarts per app |
| resource logs | diagnostic settings → Log Analytics | SQL (errors, timeouts, deadlocks), Key Vault (audit), Front Door (access, WAF), Storage |
| activity log | subscription | who changed what, deployments, deletions |
| application telemetry | Application Insights (same workspace) | traces, requests, exceptions (03-backend/10-observability) |

| Practice | Why |
|:--|:--|
| ⭐ one Log Analytics workspace per environment | one place to query; RBAC per environment |
| ⭐ diagnostic settings via policy/IaC | every resource sends logs consistently |
| retention per table | short for verbose logs, longer for audit (Key Vault, activity log) |
| alerts on platform signals | restart count, replica count at max, probe failures, SQL CPU/storage, Key Vault access denied |
| `az containerapp logs show --type system` | quick look at platform events |

## Example
Budget with alerts (Bicep excerpt, 03-iac):
```bicep
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'budget-shop-prod'
  properties: {
    category: 'Cost'
    amount: 600
    timeGrain: 'Monthly'
    timePeriod: { startDate: '2026-11-01' }
    notifications: {
      actual80: { enabled: true, operator: 'GreaterThan', threshold: 80, thresholdType: 'Actual', contactEmails: [ 'team-shop@shop.example' ] }
      forecast100: { enabled: true, operator: 'GreaterThan', threshold: 100, thresholdType: 'Forecasted', contactEmails: [ 'team-shop@shop.example' ] }
    }
  }
}
```
KQL: why does the API keep restarting?
```kusto
ContainerAppSystemLogs_CL
| where TimeGenerated > ago(6h) and ContainerAppName_s == "ca-shop-api"
| where Reason_s in ("ProbeFailed", "ContainerTerminated", "BackOff", "OOMKilled") or Log_s has "failed"
| project TimeGenerated, RevisionName_s, Reason_s, Log_s
| order by TimeGenerated desc
```
Cost by tag: in Cost Management → Cost analysis, group by the `env` and `app` tags and save the view; schedule an export to storage if finance needs the data.

## Production patterns
- Budgets and anomaly alerts on every subscription from day one; tags on every resource; a monthly cost review with Advisor recommendations.
- Non-production scales to zero outside working hours; temporary environments are deleted automatically.
- Steady production capacity (SQL vCores) on reservations once usage is stable.
- One workspace per environment; diagnostic settings enforced; alerts on platform signals (restarts, probes, max replicas) next to application SLO alerts.

## Mistakes
Wrong: no budget "because the bill is small".
Right: a budget with forecast alerts; small bills grow silently.

Wrong: debugging restarts only from application logs.
Right: check Container Apps system logs and metrics for probe failures, OOM kills, and scaling events.

## Check yourself
1. Name three levers to reduce Container Apps cost.
2. What do Container Apps system logs show that console logs don't?
3. Why tag every resource?

<details><summary>Answers</summary>

1. Right-size CPU and memory, keep min replicas at zero where cold starts are acceptable (workers, non-prod), and scale non-prod to zero outside working hours. Dedicated profiles or reservations can help for steady heavy loads.
2. Platform events: revision provisioning, probe failures, container restarts and terminations, OOM kills, image pull errors, and scaling.
3. To allocate and analyse cost by app, environment, owner, and cost centre, and to find orphaned resources and owners quickly.
</details>

## Sources
- [Billing in Azure Container Apps](https://learn.microsoft.com/azure/container-apps/billing)
- [Create and manage budgets](https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets)
- [Azure Advisor cost recommendations](https://learn.microsoft.com/azure/advisor/advisor-cost-recommendations)
- [Log storage and monitoring in Container Apps](https://learn.microsoft.com/azure/container-apps/log-options)
- [Diagnostic settings in Azure Monitor](https://learn.microsoft.com/azure/azure-monitor/essentials/diagnostic-settings)
- [Azure Well-Architected — cost optimization](https://learn.microsoft.com/azure/well-architected/cost-optimization/)
