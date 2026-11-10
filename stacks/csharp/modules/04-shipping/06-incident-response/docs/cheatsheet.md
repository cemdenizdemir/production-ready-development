---
title: Incident Response cheatsheet
tech: Application Insights, Azure Monitor, Sentry
version: Azure Monitor / Application Insights (November 2026), Sentry (current)
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Incident Response cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Lifecycle
| Phase | Goal | Note |
|:--|:--|:--|
| ⭐ detect | alert or report | SLO burn alerts |
| ⭐ triage | severity, declare | early |
| ⭐ mitigate | stop user impact | before root cause |
| resolve | stable, verified | monitor |
| ⭐ postmortem | learn | blameless |
| improve | actions done | tracked |

## Severity
| Level | Meaning | Response |
|:--|:--|:--|
| ⭐ SEV1 | critical: checkout down, data loss, breach | page all, status page |
| ⭐ SEV2 | major degradation | page on-call |
| SEV3 | minor, workaround | business hours |
| SEV4 | no user impact yet | backlog |
| ⭐ declare early | downgrade is cheap | |
| impact-based | not cause | |

## Roles
| Role | Does | Note |
|:--|:--|:--|
| ⭐ incident commander | coordinates, decides | not hands-on |
| ⭐ ops / tech lead | investigates, mitigates | |
| ⭐ comms lead | status page, support, stakeholders | |
| scribe | timeline | timestamps |
| SMEs | specific systems | pulled in by IC |
| ⭐ one channel | `#inc-<date>-<topic>` | decisions logged |
| explicit handover | "IC to Ana at 15:10" | |

## Mitigations
| Mitigation | When | Shop command/tool |
|:--|:--|:--|
| ⭐ rollback | after deploy | `rollback-api.sh` |
| ⭐ flag off | one feature | App Configuration |
| ⭐ scale | saturation | `maxReplicas`, SQL tier |
| failover | region/zone | failover group, Front Door |
| shed / degrade | overload, dependency down | rate limits, fallbacks |
| restart | stuck/leak | dump first |
| block | abuse | WAF rule |
| pause producers | backlog | stop jobs |
| ⭐ "what changed?" | first question | deploys, config, flags, traffic |

## Triage path
| Step | Where | Note |
|:--|:--|:--|
| ⭐ impact | SLO dashboard, `requests` | journeys |
| ⭐ time + changes | annotations, activity log | |
| operation + dependency | Failures blade, `dependencies` | by target |
| example | end-to-end transaction | trace |
| exceptions | `exceptions` by `problemId`, version | |
| scope | by instance, revision, region | |
| frontend | Sentry by release | |
| platform | ACA system logs | restarts, OOM |
| live | Live Metrics | during mitigation |

## KQL snippets
| Need | Query start | Note |
|:--|:--|:--|
| fail rate by op | `requests \| summarize countif(success == false) by name` | |
| dependency failures | `dependencies \| summarize ... by target, resultCode` | |
| new exceptions | `exceptions \| summarize count() by problemId, application_Version` | |
| time chart | `summarize ... by bin(timestamp, 1m) \| render timechart` | |
| Key Vault access | `AzureDiagnostics \| where OperationName == "SecretGet"` | security |

## Is it us or Azure?
| Tool | Shows | Note |
|:--|:--|:--|
| ⭐ Service Health | issues, maintenance, advisories for you | alerts |
| ⭐ Resource Health | per-resource availability | history |
| status.azure.com | global status | later, broader |
| partner status pages | Stripe, GitHub... | bookmarked |
| ⭐ activity log alert `ServiceHealth` | page on Azure issues | regions, services |

## Communication
| Audience | Channel | Note |
|:--|:--|:--|
| ⭐ customers | status page (separate infra) | impact first |
| support | internal channel | what to say |
| stakeholders | short updates | |
| ⭐ cadence | every 30 min SEV1/2 | even "no news" |
| templates | investigating / identified / monitoring / resolved | prepared |
| plain language | no jargon, no blame | |

## On-call
| Item | Practice | Note |
|:--|:--|:--|
| ⭐ rotation | primary + secondary, weekly | 5–8 people |
| ⭐ escalation | no ack 5–10 min → next | |
| paging tools | PagerDuty, incident.io, Splunk On-Call | Opsgenie retiring |
| action groups | route alerts | webhook, email, SMS |
| ⭐ alert quality | actionable + urgent only | < 2 pages/shift |
| sustainability | time off, compensation | |
| handover notes | open issues, risks | |
| readiness | access, PIM, runbooks tested | |

## Runbooks
| Section | Content | Note |
|:--|:--|:--|
| ⭐ trigger | alert/symptom | |
| impact | user view | |
| ⭐ first checks | 3–5, with links | saved queries |
| ⭐ mitigations | exact commands, safest first | |
| verify | recovery check | |
| escalate | owners | |
| owner + last tested | freshness | |
| ⭐ linked from alerts | one click | |

## Postmortems
| Item | Practice | Note |
|:--|:--|:--|
| ⭐ blameless | system, not person | |
| ⭐ timeline | from the channel | |
| ⭐ contributing factors | several | not one root cause |
| impact | users, money, budget | |
| what went well | keep | |
| ⭐ action items | specific, owned, dated | in backlog |
| review | within a week | shared |

## Common patterns
| Pattern | First move | Note |
|:--|:--|:--|
| ⭐ bad deploy | roll back | |
| bad config/flag | revert | |
| ⭐ dependency down | fallback, flag, communicate | |
| ⭐ DB saturation | top query, kill blocker, scale | |
| traffic spike | WAF, shed, scale | |
| queue backlog | scale workers, pause producers | poison? |
| OOM / leak | dump, restart, roll back | exit 137 |
| expired cert/secret | renew/rotate | expiry alerts |
| data corruption | stop writer, PITR + copy back | |

## Practice
| Format | What | How often |
|:--|:--|:--|
| ⭐ tabletop | talk-through | quarterly |
| ⭐ game day | real injected failure | quarterly |
| chaos in staging | Polly, Chaos Studio | continuous |
| ⭐ restore drill | backups verified | monthly |
| failover drill | SQL failover + back | yearly |
| wheel of misfortune | replay old incident | onboarding |

## Security incidents
| Step | Practice | Note |
|:--|:--|:--|
| ⭐ involve security + legal | immediately | legal clocks |
| ⭐ preserve evidence | export logs first | before rotating |
| ⭐ contain | revoke, rotate, disable, block | |
| eradicate | remove access paths | role assignments, app regs |
| recover | clean restore | monitor |
| private channel | need-to-know | |
| ⭐ GDPR Art. 33 | 72 h to authority | from awareness |
| GDPR Art. 34 | notify people if high risk | |
| NIS2 | 24 h warning, 72 h report | covered entities |
| Defender for Cloud, Sentinel | detection, SIEM | |

## Metrics
| Metric | Measures | Direction |
|:--|:--|:--|
| ⭐ MTTD | detection speed | down |
| MTTA | ack speed | down |
| ⭐ MTTM | mitigation speed | down |
| MTTR | resolution | down |
| ⭐ customer-detected % | monitoring gaps | down |
| ⭐ action follow-through | learning | up |
| repeat incidents | same factor | down |
| pages per shift | load | low |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| late declaration | lost minutes | declare early |
| no IC | chaos | named roles |
| root cause first | longer outage | mitigate first |
| status page on same infra | down with you | separate host |
| silence to customers | ticket flood | scheduled updates |
| noisy pages | burnout | fix/delete alerts |
| stale runbooks | wrong steps | test in drills |
| "human error" | nothing improves | system factors |
| untracked actions | repeats | backlog + dates |
| rebuild before evidence | can't investigate | export first |
| legal told late | missed 72 h | escalate on awareness |

## Sources
| Source | Link |
|:--|:--|
| SRE: Managing incidents | https://sre.google/sre-book/managing-incidents/ |
| SRE: Postmortem culture | https://sre.google/sre-book/postmortem-culture/ |
| SRE: Being on-call | https://sre.google/sre-book/being-on-call/ |
| PagerDuty incident response | https://response.pagerduty.com/ |
| Azure Service Health | https://learn.microsoft.com/azure/service-health/overview |
| Resource Health | https://learn.microsoft.com/azure/service-health/resource-health-overview |
| Action groups | https://learn.microsoft.com/azure/azure-monitor/alerts/action-groups |
| GDPR Art. 33 | https://gdpr-info.eu/art-33-gdpr/ |
| NIST SP 800-61r3 | https://csrc.nist.gov/pubs/sp/800/61/r3/final |
