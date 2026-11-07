---
title: Incident Response cheatsheet
tech: Sentry, Grafana, OpenTelemetry
version: Grafana (Alerting, Mimir, Loki, Tempo), Sentry JS SDK 10, OpenTelemetry JS SDK 2.x, PostgreSQL 18, AWS ECS
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Incident Response cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Severities
| Level | Examples | Response |
|:--|:--|:--|
| ⭐ SEV1 | site/checkout down, data loss, active breach | all hands, updates every 30 min |
| ⭐ SEV2 | major feature broken, SLO burning fast | page, IC, regular updates |
| SEV3 | partial, workaround exists | on-call, working hours |
| SEV4 | cosmetic, internal | ticket |
| ⭐ Rule | declare early, downgrade later | |

## Roles
| Role | Does |
|:--|:--|
| ⭐ Incident commander | coordinates, decides, timeline; doesn't debug |
| Operations / experts | investigate and mitigate |
| Communications | status page, internal and customer updates |
| Scribe | records actions and times |

## Lifecycle
| Phase | Done when |
|:--|:--|
| Detect | a human knows |
| ⭐ Declare | severity, IC, channel |
| ⭐ Mitigate | user impact stopped |
| Resolve | SLIs normal, stable 15–30 min |
| ⭐ Learn | postmortem + action items |

## Mitigations (fastest first)
| Mitigation | When |
|:--|:--|
| ⭐ Feature flag off | new feature suspected |
| ⭐ Roll back the deploy | impact after a change |
| Scale out / restart | overload, leak, stuck tasks |
| Shed / block traffic | bots, abuse, retry storms |
| Fail over / disable dependency | provider or AZ down |
| Degrade | optional features off |
| Restore data | last resort |

## First ten minutes
| Step | Action |
|:--|:--|
| 1 | declare, roles, channel |
| 2 | scope: who, what, since when |
| 3 | ⭐ what changed? deploys, flags, config, traffic, dependencies |
| 4 | pick and apply a mitigation |
| 5 | verify on dashboards |
| 6 | status update, next update time |

## Investigation path
| Step | Tool |
|:--|:--|
| ⭐ Scope | service dashboard, SLO panel |
| ⭐ Change | deploy annotations, flag history, Sentry releases |
| Narrow | RED per route, dependency panels |
| ⭐ Example request | Tempo trace |
| Detail | Loki logs by `trace_id` |
| Error | Sentry issue: stack, first seen, release |
| Resources | DB views, queues, ECS events |
| Baseline | `offset 1w` comparisons |

## Queries to keep handy
| Query | Shows |
|:--|:--|
| ⭐ 5xx ratio `by (http_route)` | where errors are |
| `histogram_quantile(0.99, … http_client_request_duration_seconds_bucket … by (le, server_address))` | slow dependency |
| ⭐ `{ span.http.route = "/api/orders" && status = error }` | failing traces |
| `{ … && duration > 2s } \| select(span.db.query.text)` | slow queries in traces |
| ⭐ `{service_name="api"} \| trace_id="…"` | logs of one request |
| `sum by (detected_level) (count_over_time({service_name="api"}[1m]))` | log volume by level |

## PostgreSQL triage
| SQL | Use |
|:--|:--|
| ⭐ `pg_stat_activity` ordered by `now() - xact_start` | long and idle-in-transaction sessions |
| ⭐ `pg_blocking_pids(pid)` | who blocks whom |
| `pg_cancel_backend(pid)` | cancel a query |
| `pg_terminate_backend(pid)` | end a session (announce first) |
| `pg_stat_statements` | top queries by total time |

## Common patterns
| Pattern | First move |
|:--|:--|
| ⭐ Bad deploy | roll back |
| Bad config/flag | revert, flag off |
| ⭐ DB overload | kill runaway queries, shed load, roll back query change |
| Lock contention | find and cancel the blocker |
| ⭐ Dependency outage | breaker/fallback, disable feature, queue work |
| Traffic spike/bots | rate limits, WAF, scale, shed |
| Memory leak (exit 137) | restart/scale, heap snapshots, roll back |
| Queue backlog | scale workers, fix failing jobs |
| Expired cert / DNS | renew, check automation |
| Storage full | grow storage, find growth |

## Communication
| Audience | Cadence |
|:--|:--|
| Responders | continuous, incident channel |
| ⭐ Company | 30 min (SEV1), 60 min (SEV2) |
| ⭐ Customers | first update in 15–30 min, then scheduled |
| Status page states | Investigating → Identified → Monitoring → Resolved |
| ⭐ Status page hosting | outside your infrastructure |
| Update content | impact in plain words, actions, next update time |

## On-call
| Practice | Detail |
|:--|:--|
| ⭐ Rotation | weekly, primary + secondary |
| Escalation | primary → secondary → manager, with timeouts |
| ⭐ Page budget | ~2 pages per shift max; review |
| Only urgent + actionable pages | rest are tickets |
| Time off after night pages | sustainability |
| Tools | Grafana Cloud IRM, PagerDuty, incident.io (also seen) |
| Routing | Grafana notification policies by `severity`, `team` |

## Runbooks
| Section | Content |
|:--|:--|
| Alert | name, owner, default severity |
| Meaning + impact | what it measures, what users see |
| ⭐ Triage | dashboard links, saved queries |
| ⭐ Mitigations | safest first, with commands |
| Escalate | who, when |
| Verify | what "fixed" looks like |
| Location | `docs/runbooks/`, linked by `runbook_url` |

## Postmortems
| Rule | Detail |
|:--|:--|
| ⭐ Blameless | systems, not people |
| ⭐ For SEV1/SEV2 within a week | and useful near misses |
| Timeline | from channel, alerts, deploys (UTC) |
| Contributing factors | several, not one root cause |
| ⭐ Action items | specific, owner, due date, tracked |
| Sections | summary, impact, timeline, detection, factors, went well/poorly, actions |

## Practice
| Exercise | Trains |
|:--|:--|
| Tabletop | roles, decisions, comms |
| ⭐ Game day | real failure, real response |
| AWS FIS experiments | resilience under faults |
| Restore drills | data recovery |
| Shadow shifts | new on-call engineers |

## Security incidents
| Step | Detail |
|:--|:--|
| ⭐ Involve security + legal early | private channel |
| ⭐ Preserve evidence | CloudTrail, logs, snapshots; don't wipe |
| Contain | deactivate keys, block access, isolate |
| Scope | what was accessed? |
| Eradicate + recover | remove persistence, rebuild from known-good |
| ⭐ GDPR | authority within 72 h of awareness (personal data breach with risk) |
| NIS2 | 24 h early warning for covered entities |

## Metrics
| Metric | Measures |
|:--|:--|
| ⭐ Time to detect | impact → alert |
| Time to acknowledge | page → human |
| ⭐ Time to mitigate/restore | detection → impact stopped |
| ⭐ Detected by customers | alert coverage gaps |
| Incidents by severity | trend |
| Action items on time | follow-through |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Late declaration | silent impact | declare early |
| IC also debugging | coordination stops | separate roles |
| Root cause before mitigation | longer outage | roll back / flag off first |
| Side conversations | lost context and timeline | incident channel |
| Status page on your infra | down with you | hosted elsewhere |
| Noisy pages | real pages missed | actionable-only paging |
| Alerts without runbooks | slow triage | `runbook_url` |
| "Human error" conclusions | nothing changes | systemic factors |
| Action items without owners | never done | owner + date |
| Wiping compromised resources | evidence lost | preserve, then clean |

## Sources
| Source | Link |
|:--|:--|
| Managing incidents | https://sre.google/sre-book/managing-incidents/ |
| Postmortem culture | https://sre.google/sre-book/postmortem-culture/ |
| PagerDuty incident response | https://response.pagerduty.com/ |
| Being on-call | https://sre.google/sre-book/being-on-call/ |
| Grafana notification policies | https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/notification-policies/ |
| GDPR Art. 33 | https://gdpr-info.eu/art-33-gdpr/ |
| NIST SP 800-61 Rev. 3 | https://csrc.nist.gov/pubs/sp/800/61/r3/final |
