---
title: Postmortems, common patterns, and practice
tech: Markdown postmortems, Azure Chaos Studio, Polly chaos strategies, restore drills
version: November 2026
date: 2026-11-09
covers: [8, 9, 10]
---
# Postmortems, common patterns, and practice
[← Overview](00-overview.md)

## Why it matters
- After an outage, the postmortem concluded "human error: Ali ran the wrong command". Ali stopped volunteering for on-call; the confusing script that made the mistake easy stayed.
- Postmortems produced 12 action items. Six months later, two were done, and the same incident happened again.
- The first time anyone followed the database failover runbook was during a real regional outage. Step 3 referenced a resource that had been renamed.

## Concepts

### Blameless postmortems
| Principle | Practice |
|:--|:--|
| ⭐ blameless | assume people acted reasonably with what they knew; ask "how did the system make this possible?" not "who?" |
| ⭐ written for every SEV1/SEV2 | and for near misses worth learning from |
| ⭐ timeline | from detection to resolution with timestamps (from the incident channel) |
| ⭐ contributing factors | usually several: a change, a missing guard, a gap in alerts, a confusing tool; avoid a single "root cause" |
| impact | users affected, duration, money, data, SLO budget spent |
| what went well | keep doing it |
| ⭐ action items | specific, owned, dated, tracked in the normal backlog; prioritised by risk reduction |
| review meeting | within a week; open to everyone; shared widely |
| follow-through | action items reviewed until done (lesson 05 measures this) |

| Weak action item | Strong action item |
|:--|:--|
| "be more careful with migrations" | "add `SET LOCK_TIMEOUT` check to the migration review checklist and a CI test that fails without it (owner: Ana, 2026-11-30)" |
| "improve monitoring" | "alert on outbox lag > 2 min, linked to runbook outbox.md (owner: Mehmet, 2026-11-20)" |

### Common incident patterns and first moves
| Pattern | Signals | First moves |
|:--|:--|:--|
| ⭐ bad deploy | errors start right after a release | roll back; then investigate |
| ⭐ bad config / flag change | errors after a config change, no deploy | revert config / flag |
| ⭐ dependency down or slow | failing `dependencies` to one target; partner status page | circuit breaker open? enable fallback/maintenance flag; communicate |
| ⭐ database saturation | high CPU/DTU, blocking, timeouts | find top query / blocking session; kill runaway query; scale up temporarily |
| traffic spike / abuse | requests up, one IP/user/route dominates | WAF rate limits, shed load, scale out |
| queue backlog | depth and age rising | scale workers, pause producers, check poison messages |
| memory leak / OOM | memory climbing, restarts (exit 137) | restart (capture dump first), roll back, raise limit temporarily |
| expired certificate / secret | TLS errors, 401s from partners | rotate/renew; add expiry alerts |
| storage / quota full | write failures | raise quota, delete safely, add alerts |
| data corruption | wrong values, user reports | stop the writer (flag), assess scope, PITR + copy back (05-data-safety) |

### Practising
| Format | What | How often |
|:--|:--|:--|
| ⭐ tabletop exercise | talk through a scenario ("Stripe is down at Black Friday peak") with roles, no systems touched | quarterly |
| ⭐ game day | inject a real failure in staging (or carefully in production) and run the response | quarterly |
| fault injection | Polly chaos strategies, Toxiproxy, Azure Chaos Studio experiments (03-backend/08-reliability) | continuous in staging |
| ⭐ restore drill | restore and verify backups (05-data-safety) | monthly |
| failover drill | planned SQL failover and back | yearly |
| wheel of misfortune | replay a past incident with a new on-call engineer | onboarding |

## Example
`docs/postmortems/2026-11-09-checkout-errors.md`
```markdown
# Postmortem: checkout errors after release r214 (SEV2)
Date: 2026-11-09 · Duration: 14:02–14:33 UTC (31 min) · Authors: Ana, Mehmet · Status: actions in progress

## Summary
A release changed the order total calculation to use a new `Money` type. Orders with discount codes threw an exception, so ~25% of checkouts failed for 31 minutes.

## Impact
1,240 failed checkout attempts; ~310 customers affected; no charges taken for failed orders; 4.2% of the monthly error budget.

## Timeline (UTC)
- 13:58 r214 deployed (canary skipped: "small change")
- 14:02 errors begin; 14:04 fast-burn alert pages Mehmet
- 14:05 SEV2 declared, roles assigned; status page "investigating" 14:08
- 14:08 rollback to r213 started; 14:11 traffic on r213; 14:33 error rate normal for 20 min, resolved

## Contributing factors
- Discount-code orders weren't covered by integration tests for the new `Money` type.
- The canary step could be skipped by a pipeline input without approval.
- The alert fired 2 minutes after onset (good), but rollback took 6 minutes because the script prompted for confirmation.

## What went well
Early declaration; rollback script worked; status page updated within 3 minutes.

## Action items
| Action | Owner | Due | Status |
|:--|:--|:--|:--|
| Integration tests for discount orders with `Money` | Lea | 2026-11-16 | open |
| Remove "skip canary" input from production pipeline | Jo | 2026-11-12 | done |
| Non-interactive rollback flag for incidents | Mehmet | 2026-11-14 | open |
```
Game day plan (`docs/game-days/2026-q4-redis-down.md`, excerpt):
```text
Hypothesis: if Redis is unavailable, checkout p99 stays < 1.5 s and error rate < 0.5%; caches fail open.
Blast radius: staging only; abort if staging SQL CPU > 90% for 5 min.
Injection: stop the staging Redis (Chaos Studio experiment) for 20 minutes at 10:00.
Observe: SLO dashboard, SQL CPU, cache error logs; on-call follows runbook redis-down.md.
Success criteria: alert fires within 5 min, runbook steps work, no customer-visible errors in synthetic tests.
```

## Production patterns
- Blameless postmortems for every SEV1/SEV2 within a week, with a timeline, multiple contributing factors, and owned, dated action items in the normal backlog.
- A table of common incident patterns with first moves in the on-call guide; each links to its runbook.
- Regular tabletops, game days, restore and failover drills; findings feed runbooks and action items.

## Mistakes
Wrong: "Root cause: human error."
Right: ask what made the error possible and likely (tools, defaults, missing guards), and fix those.

Wrong: postmortem action items in a document nobody revisits.
Right: tracked tickets with owners and dates, reviewed until closed.

## Check yourself
1. What makes a postmortem blameless?
2. What are the first moves for a "dependency down" pattern?
3. What's the difference between a tabletop exercise and a game day?

<details><summary>Answers</summary>

1. It focuses on how the system (tools, processes, defaults, information) allowed the failure, assumes people acted reasonably with what they knew, and never punishes individuals for honest mistakes, so people share details openly.
2. Confirm it's the dependency (failing calls to one target, its status page), make sure circuit breakers and fallbacks engage (or turn on a maintenance/fallback flag), communicate to users, and watch for recovery.
3. A tabletop is a discussion of a scenario without touching systems; a game day injects a real failure (usually in staging) and the team runs the actual response with real tools.
</details>

## Sources
- [Google SRE book — Postmortem culture](https://sre.google/sre-book/postmortem-culture/)
- [Google SRE book — Example postmortem](https://sre.google/sre-book/example-postmortem/)
- [Etsy — Blameless postmortems](https://www.etsy.com/codeascraft/blameless-postmortems)
- [Azure Chaos Studio](https://learn.microsoft.com/azure/chaos-studio/chaos-studio-overview)
- [PagerDuty — Postmortem process](https://postmortems.pagerduty.com/)
