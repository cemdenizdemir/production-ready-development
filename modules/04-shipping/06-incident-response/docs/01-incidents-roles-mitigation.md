---
title: Incidents, roles, and mitigation first
tech: Grafana, Sentry, AWS ECS
version: Grafana Alerting, Sentry, Amazon ECS rollbacks, feature flags
date: 2026-11-07
covers: [1, 2, 3]
---
# Incidents, roles, and mitigation first
[← Overview](00-overview.md)

## Why it matters
- Checkout errors rise slowly for 40 minutes. Three engineers each notice, each assume someone else is on it, and nobody declares an incident.
- During an outage everyone debugs at once. Nobody decides to roll back the deploy from 20 minutes earlier, which would have fixed it immediately.
- The team spends two hours finding the root cause of a memory leak while the site keeps crashing, instead of first restarting tasks and adding capacity.

## Concepts

### What an incident is
An incident is any unplanned event that harms (or will soon harm) users, data, or the business and needs a coordinated response. **Declare early**: downgrading is cheap, a late declaration is expensive.

| Severity | Examples | Response |
|:--|:--|:--|
| SEV1 | site or checkout down, data loss, active security breach | all hands, page immediately, updates every 30 min, exec + customer comms |
| SEV2 | major feature broken or badly degraded for many users, SLO burning fast | page on-call, incident commander, regular updates |
| SEV3 | partial degradation with a workaround, single customer affected | on-call handles during working hours |
| SEV4 | cosmetic or internal-only problem | ticket |

### Roles
| Role | Does | Doesn't |
|:--|:--|:--|
| Incident commander (IC) | coordinates, sets priorities, decides (rollback, escalate), keeps the timeline | debug hands-on |
| Operations / subject experts | investigate and apply mitigations the IC agrees on | change things without telling the channel |
| Communications lead | status page, customer and internal updates on a schedule | speculate about causes |
| Scribe (optional) | records actions, decisions, and times | — |

In a small team one person may hold two roles at SEV3, but at SEV1 the IC should not also be the main debugger.

### Mitigation first
| Mitigation | When | Speed |
|:--|:--|:--|
| Roll back the last deploy | impact started after a deploy or config change | minutes |
| Turn off a feature flag | the new feature is the suspect | seconds |
| Scale out / restart tasks | overload, leak, stuck processes | minutes |
| Shed or block traffic | abuse, bots, retry storms | minutes |
| Fail over / disable a dependency | a provider or AZ is down | minutes |
| Degrade gracefully | turn off optional features ([03-backend/08-reliability](../../../03-backend/08-reliability/docs/04-degradation-slos-failure-testing.md)) | minutes |
| Restore data | corruption or deletion | hours: last resort |

**Stop the bleeding, then investigate.** Root cause matters for the postmortem; users care about recovery now. The first question is always **"what changed?"**: deploys, config, flags, traffic, dependencies, certificates, data.

### Incident lifecycle
| Phase | Done when |
|:--|:--|
| Detect | an alert or report reaches a human |
| Declare | severity set, IC named, channel open |
| Mitigate | user impact stopped or reduced |
| Resolve | SLIs back to normal, monitoring for recurrence |
| Learn | postmortem written, action items tracked |

## Example
Declaring an incident — the first message in a dedicated channel (`#inc-2026-11-07-checkout-errors`):
```text
:rotating_light: INCIDENT DECLARED — SEV2
What: checkout returns 500 for ~30% of requests since 14:05 UTC
Impact: customers can't pay; order rate down 35% vs last week
IC: Dana (@dana)   Ops: Sam (@sam)   Comms: Lee (@lee)
Current suspect: deploy shop-api sha-3f2a1c9 at 14:02
Next update: 14:45 UTC
```
The first ten minutes, as a checklist the IC follows:
| Step | Action |
|:--|:--|
| 1 | Declare: severity, IC, channel, roles |
| 2 | Scope: which users, routes, regions? Since when? (service dashboard, SLO panel) |
| 3 | What changed? Deploy annotations, flag changes, config, traffic, dependency status pages |
| 4 | Choose a mitigation: rollback, flag off, scale, shed, fail over |
| 5 | Apply it, announce it in the channel |
| 6 | Verify: error rate and latency back to normal? |
| 7 | Communicate: status page and internal update |
| 8 | Keep monitoring; resolve when stable for 15–30 minutes |

Rolling back the suspect deploy (from [04-deployments](../../04-deployments/README.md)):
```bash
aws ecs update-service --cluster shop-prod --service api --task-definition shop-api:41
aws ecs wait services-stable --cluster shop-prod --services api
```

## Production patterns
- **Written severity levels** that everyone uses, and a culture of declaring early.
- **An incident commander for every SEV1/SEV2** who coordinates instead of debugging.
- **A dedicated channel per incident** with a pinned summary: impact, roles, next update time.
- **Mitigation before diagnosis**: rollback and flags are the first tools, practiced in advance.
- **"What changed?"** answered from deploy annotations, flag history, and dependency status.

## Mistakes
Wrong: waiting to be sure before declaring. Twenty minutes of silent impact. Right: declare at the first credible sign; downgrade later.

Wrong: the most senior engineer as IC and lead debugger at once. Coordination stops while they're heads-down. Right: separate IC and operations roles.

Wrong: refusing to roll back "until we understand it". Users stay broken while the team investigates. Right: roll back first when a change is the likely cause; investigate on staging or with the rolled-back version stable.

Wrong: debugging in DMs and side calls. Nobody has the full picture, and the timeline is lost. Right: everything in the incident channel.

## Check yourself
1. What does an incident commander do, and what should they avoid?
2. Why mitigate before finding the root cause?
3. What's the first question to ask when an incident starts?

<details>
<summary>Answers</summary>

1. They coordinate the response: set severity and priorities, assign roles, make decisions (rollback, escalation), ensure communication happens, and keep the timeline. They avoid hands-on debugging, because coordination stops when the IC is buried in a terminal.
2. Users are hurt every minute the impact continues, and mitigations like rollbacks or flags usually work without knowing the exact cause. The root cause can be found calmly afterwards, with the system stable and evidence preserved.
3. "What changed?" Most incidents follow a change: a deploy, configuration, feature flag, traffic pattern, dependency, certificate, or data change. Deploy annotations and change logs answer it quickly.
</details>

## Sources
- [Google SRE book — Managing incidents](https://sre.google/sre-book/managing-incidents/)
- [PagerDuty — Incident commander training](https://response.pagerduty.com/training/incident_commander/)
- [PagerDuty — Severity levels](https://response.pagerduty.com/before/severity_levels/)
- [Atlassian — Incident severity levels](https://www.atlassian.com/incident-management/kpis/severity-levels)
