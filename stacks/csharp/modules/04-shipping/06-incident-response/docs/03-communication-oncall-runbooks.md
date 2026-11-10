---
title: Communication, on-call, and runbooks
tech: Azure Monitor action groups, a paging tool, a hosted status page, Markdown runbooks
version: November 2026
date: 2026-11-09
covers: [5, 6, 7]
---
# Communication, on-call, and runbooks
[← Overview](00-overview.md)

## Why it matters
- During a 2-hour outage, customers saw nothing on the status page and flooded support. A message every 30 minutes would have cut tickets by most of their volume.
- The status page was hosted on the same Container Apps environment as the shop. When the environment went down, so did the status page.
- One engineer was paged 40 times in a week, mostly by flapping alerts. They burned out and left; the alerts stayed.

## Concepts

### Communication during incidents
| Audience | Channel | Content |
|:--|:--|:--|
| ⭐ customers | status page (hosted elsewhere), in-app banner | impact in plain words, workaround, next update time |
| ⭐ support team | internal channel, a pinned summary | what to tell customers, known affected orders |
| stakeholders / leadership | short updates | impact, ETA if known, business effect |
| engineers | incident channel | timeline, decisions, tasks |
| partners | email / their portal | when their integration is affected |

| Rule | Why |
|:--|:--|
| ⭐ update on a schedule (every 30 min for SEV1/2), even with "no news" | silence creates more questions and tickets |
| ⭐ plain language, impact first | "Some customers can't complete checkout" beats "elevated 5xx on POST /orders" |
| say what you know and don't | no guesses as facts, no blame on vendors |
| ⭐ status page outside your infrastructure | it must work when you don't |
| templates | investigating / identified / monitoring / resolved, prepared in advance |
| close the loop | a resolved message, and a public summary for big incidents |

### On-call
| Practice | Detail |
|:--|:--|
| ⭐ rotation | primary + secondary, weekly, handover with open issues; enough people (5–8) per rotation to stay sustainable |
| ⭐ escalation policy | no ack in 5–10 min → secondary → team lead → manager |
| paging tool | PagerDuty, incident.io, Splunk On-Call, Better Stack... (Opsgenie is being retired) |
| Azure Monitor action groups | route alerts to the paging tool (webhook/integration), email, SMS, push |
| ⭐ alert quality | every page actionable and urgent; others are tickets; target < 2 pages per shift |
| ⭐ sustainable load | compensation or time off after night pages; review page counts monthly |
| handover | written notes: incidents, risky changes, things to watch |
| readiness | laptop, VPN/access, runbooks, PIM rights tested before the shift |

### Runbooks
| Section | Content |
|:--|:--|
| ⭐ trigger | which alert or symptom leads here |
| ⭐ impact | what users experience |
| ⭐ first checks | 3–5 quick checks with links and saved queries |
| ⭐ mitigations | exact commands or buttons, in order of safety (rollback, flag off, scale, failover) |
| escalation | who owns the system, how to reach them |
| verification | how to confirm recovery |
| background | architecture links, known causes, past incidents |
| owner and last tested date | so it stays current |

**Link runbooks from alerts** (the alert description has the URL). Update them after every incident and drill; a runbook nobody has used in a year is probably wrong.

## Example
Status page message templates (`docs/runbooks/status-templates.md`):
```text
Investigating (14:08 UTC): Some customers can't complete checkout. We're investigating and will update by 14:40 UTC.
Identified (14:25 UTC): We've identified the cause (a faulty update) and are reverting it. Orders placed before 14:00 are not affected.
Monitoring (14:35 UTC): Checkout is working again. We're monitoring to make sure it stays stable.
Resolved (15:05 UTC): Checkout has been working normally since 14:33 UTC. If your payment failed between 14:02 and 14:33, you were not charged.
```
`docs/runbooks/checkout-errors.md`
```markdown
# Runbook: checkout errors (POST /orders failure rate)
Owner: team-ordering · Last tested: 2026-10-14 (game day)

## Trigger
Alert "Checkout SLO fast burn" (14.4x) or support reports of failed checkouts.

## Impact
Customers can't place orders; revenue loss ~€X per minute at peak.

## First checks (5 minutes)
1. Recent deploys or flag changes? GitHub deployments for `shop-api`; App Configuration history.
2. Failure rate by operation and dependency: saved queries 1 and 2 (link).
3. Payments provider status: https://status.stripe.com
4. Azure Service Health and Resource Health for SQL and Container Apps (link).

## Mitigations (in order)
1. Deploy in the last 2 h → `./scripts/rollback-api.sh rg-shop-prod-weu ca-shop-api`
2. New feature involved → turn off its flag in App Configuration (`NewCheckout`).
3. Payment provider failing → enable `PaymentsMaintenance` flag (checkout shows "try again shortly"; carts kept).
4. SQL saturated → see runbook sql-saturation.md (kill blocking session, scale tier).

## Verify
Failure rate < 0.5% for 15 minutes (query 1); a test order with a test card in production succeeds.

## Escalate
team-ordering on-call → #team-ordering → engineering manager.
```
Action group routing pages to the paging tool (Bicep excerpt):
```bicep
resource onCall 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'ag-shop-oncall'
  location: 'global'
  properties: {
    groupShortName: 'shoponcall'
    enabled: true
    webhookReceivers: [ { name: 'paging', serviceUri: pagingWebhookUrl, useCommonAlertSchema: true } ]
    emailReceivers: [ { name: 'team', emailAddress: 'team-shop@shop.example', useCommonAlertSchema: true } ]
  }
}
```
`pagingWebhookUrl` is a `@secure()` parameter from Key Vault: integration URLs often contain keys.

## Production patterns
- A status page on separate infrastructure with prepared templates; updates on a fixed schedule during SEV1/2; support briefed in its own channel.
- On-call rotations with secondary and escalation, sustainable page volume, compensation, and written handovers.
- Every paging alert links to a runbook with first checks, ordered mitigations, verification, and escalation; runbooks are updated after each incident and drill.

## Mistakes
Wrong: "We'll update customers when we know the cause."
Right: post within minutes of declaring, then on a schedule, even if the update is "still investigating".

Wrong: runbooks in someone's head or an outdated wiki page.
Right: Markdown runbooks in the repo, owned, linked from alerts, tested in game days.

## Check yourself
1. Why host the status page outside your own infrastructure?
2. What makes an on-call rotation sustainable?
3. What are the must-have sections of a runbook?

<details><summary>Answers</summary>

1. Because it must keep working during the outages it reports, including when your cloud region, environment, DNS, or CDN is the problem.
2. Enough people in the rotation, a secondary and escalation path, few and actionable pages, compensation or recovery time after night pages, and regular review of alert quality and load.
3. Trigger, impact, first checks, ordered mitigations with exact commands, verification, escalation, and an owner with a last-tested date.
</details>

## Sources
- [Google SRE book — Being on-call](https://sre.google/sre-book/being-on-call/)
- [PagerDuty — External communication guidelines](https://response.pagerduty.com/during/external_communication_guidelines/)
- [Atlassian — Incident communication templates](https://www.atlassian.com/incident-management/incident-communication/templates)
- [Azure Monitor action groups](https://learn.microsoft.com/azure/azure-monitor/alerts/action-groups)
- [Atlassian — Opsgenie end of sale and support](https://www.atlassian.com/software/opsgenie/migration)
