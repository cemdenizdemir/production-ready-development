---
title: Incidents, severity, roles, and mitigation first
tech: Azure Container Apps revisions, feature flags, Azure SQL, Azure Monitor
version: November 2026
date: 2026-11-09
covers: [1, 2, 3]
---
# Incidents, severity, roles, and mitigation first
[← Overview](00-overview.md)

## Why it matters
- Checkout errors started at 14:02. People discussed in a team chat whether it was "really an incident" until 14:40. Declaring at 14:05 would have saved half an hour.
- Six engineers debugged six theories at once and two of them restarted things at the same time, making the logs useless. Nobody was in charge.
- The team spent 50 minutes finding the root cause of a bad deploy. Rolling back would have restored checkout in 2 minutes.

## Concepts

### What an incident is
An **incident** is any unplanned event that degrades service for users or threatens data, security, or money, and needs a coordinated response. When in doubt, **declare**: downgrading or closing an incident is cheap; a late one is expensive.

| Severity | Definition (shop) | Examples | Response |
|:--|:--|:--|:--|
| ⭐ SEV1 | critical: most users can't buy, data loss, or security breach | checkout down, payments double-charging, database lost | page immediately, all hands, status page, exec update |
| ⭐ SEV2 | major: important feature broken or badly degraded for many | search down, 20% checkout errors, emails not sent | page on-call, status page if users notice |
| SEV3 | minor: limited impact, workaround exists | admin export failing, one partner slow | business hours, ticket |
| SEV4 | cosmetic or no user impact yet | a warning trend, a non-critical job retrying | backlog |

Severity is about **impact now**, not cause or effort. Raise it as soon as impact grows.

### Roles
| Role | Does | Doesn't |
|:--|:--|:--|
| ⭐ incident commander (IC) | coordinates, decides, assigns, keeps time, declares end | debug hands-on (in big incidents) |
| ⭐ operations / tech lead | investigates and applies mitigations, with helpers | talk to customers |
| ⭐ communications lead | status page, support, stakeholders, regular updates | debug |
| scribe | timeline with timestamps in the channel or doc | |
| subject matter experts | pulled in by the IC for specific systems | start parallel uncoordinated changes |

In a small team, one person can hold several roles, but someone is always explicitly IC. Hand over explicitly ("I'm handing IC to Ana at 15:10").

**One incident channel** (`#inc-2026-11-09-checkout`) for all coordination; decisions and actions written there with times. Side conversations move to threads or calls, and conclusions come back to the channel.

### Mitigation first
| Mitigation | When | Shop example |
|:--|:--|:--|
| ⭐ roll back | anything started after a deploy or config change | traffic back to the previous revision (04-deployments) |
| ⭐ feature flag off | a specific feature misbehaves | `NewSearch` off |
| ⭐ scale out / up | saturation (CPU, replicas, DB DTU) | raise `maxReplicas`, scale SQL tier |
| fail over | region or zone issue | failover group, Front Door origin switch |
| shed or degrade | overload or a failed dependency | rate limit, fallback shipping rates, read-only mode |
| restart | stuck process, leak (buys time) | restart revision; capture a dump first if you can |
| block | abuse or attack | WAF rule, revoke key |
| pause producers | queue backlog | stop the bulk import job |

Ask: "What changed?" (deploys, config, flags, traffic, dependencies) and "What's the fastest safe action that reduces impact?" Root cause comes after users are OK. Capture evidence (dump, logs, query plans) before restarting when it's quick.

## Example
Incident kick-off message (the IC posts it in the new channel):
```text
SEV2 declared 14:05 UTC: checkout errors ~25% since ~14:02
IC: Ana   Ops: Mehmet   Comms: Lea   Scribe: Jo
What we know: 5xx on POST /orders, started after deploy r214 at 13:58
Next: Ops rolling back to r213 (ETA 14:08); Comms posting status page "investigating"
Next update: 14:20 or sooner
```
Rollback command the ops lead runs (from the runbook):
```bash
./scripts/rollback-api.sh rg-shop-prod-weu ca-shop-api
```
Checking whether impact stopped (KQL, Application Insights):
```kusto
requests
| where timestamp > ago(30m) and name == "POST /orders"
| summarize total = count(), failed = countif(success == false) by bin(timestamp, 1m)
| extend errorRate = round(100.0 * failed / total, 1)
| render timechart
```

## Production patterns
- Written severity definitions with examples; anyone can declare; declaring early is praised.
- Named roles from the first minute, one channel, a timeline, scheduled updates, explicit hand-overs.
- First question is always "what changed?"; first actions are rollback, flags, scaling, failover, or shedding, using rehearsed runbook commands.
- The incident is resolved when impact ends and has been stable for a while; root cause and fixes go to the postmortem.

## Mistakes
Wrong: debating whether something is "bad enough" to be an incident.
Right: declare at the right-looking severity; adjust later.

Wrong: hunting for the root cause while users are still failing.
Right: roll back or disable first, then investigate with users safe.

## Check yourself
1. What decides an incident's severity?
2. What does the incident commander do, and not do?
3. Why is rollback usually the first mitigation after a deploy?

<details><summary>Answers</summary>

1. Current impact on users, data, security, or money (how many users, how badly, which critical journeys), not the cause or how hard it is to fix.
2. Coordinates: assigns roles and tasks, makes decisions, keeps time and updates on schedule, and declares the end. In larger incidents the IC doesn't do hands-on debugging, so someone keeps the overview.
3. It's fast, rehearsed, and low-risk, and it removes the most likely cause (the change) without needing to understand it first. Understanding comes after users are safe.
</details>

## Sources
- [Google SRE book — Managing incidents](https://sre.google/sre-book/managing-incidents/)
- [PagerDuty — Severity levels](https://response.pagerduty.com/before/severity_levels/)
- [PagerDuty — Incident commander](https://response.pagerduty.com/training/incident_commander/)
- [Atlassian — Incident management handbook](https://www.atlassian.com/incident-management/handbook)
- [Container Apps traffic splitting](https://learn.microsoft.com/azure/container-apps/traffic-splitting)
