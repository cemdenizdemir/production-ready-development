---
title: Ownership and growing to senior
tech: GitHub, Application Insights, production readiness checklists
version: November 2026
date: 2026-11-09
covers: [11, 12]
---
# Ownership and growing to senior
[← Overview](00-overview.md)

## Why it matters
- A developer merged the discount feature, moved the ticket to Done, and went on holiday. The flag was still off; nobody turned it on for two weeks, and the campaign launched without it.
- A deploy doubled database CPU. The author didn't watch the dashboards after release; on-call found out at 03:00.
- A strong mid-level engineer was told "you need more impact" for two promotion cycles without knowing what that meant in practice.

## Concepts

### Ownership: done means working in production
| Practice | How |
|:--|:--|
| ⭐ definition of done includes production | deployed, flag state as intended, monitored, docs updated, ticket closed with a note |
| ⭐ watch your deploys | dashboards and error groups for 15–30 minutes after release; the author is around |
| ⭐ production readiness checklist | for new services or big features (below) |
| follow through | loose ends become tickets you own; you close the loop with the requester |
| on-call empathy | you'd be woken by this at 03:00: add the alert, the runbook, the fallback |
| leave it better | update docs and runbooks you used |

| Production readiness (new feature/service) | Done when |
|:--|:--|
| ⭐ observability | logs, metrics, traces, dashboard panel, alerts with runbook |
| ⭐ failure modes | timeouts, retries, fallbacks, idempotency considered (03-backend/08-reliability) |
| ⭐ security | authz on every endpoint, input validation, secrets in Key Vault, threat-modelled if risky |
| data | migrations safe and reversible; backups cover new data; retention defined |
| capacity | load-tested to expected peak; limits and quotas checked |
| rollout | flag, canary, rollback plan; support and docs informed |
| ownership | owning team, on-call, CODEOWNERS |

### Growing from mid-level to senior
| Dimension | Mid-level | Senior |
|:--|:--|:--|
| ⭐ scope | delivers well-defined features | owns ambiguous problems end to end; defines the work |
| ⭐ impact | their tickets | the team's outcomes: fewer incidents, faster delivery, better decisions |
| technical judgment | applies patterns | chooses (and rejects) patterns with trade-offs; simplifies |
| ⭐ influence | contributes in reviews | improves others' work: reviews, design docs, standards |
| ⭐ mentoring | asks for help well | multiplies others: pairing, unblocking, teaching |
| communication | status updates | writes docs and ADRs that align people; escalates with options |
| operations | fixes their bugs | owns reliability: on-call, postmortems, readiness |

| Practice | How |
|:--|:--|
| ⭐ ask for specific feedback | "What would make my last design doc more effective?" not "Any feedback?" |
| brag document | a running list of impact with evidence (links, metrics), for reviews and promotions |
| pick visible problems | the flaky test suite, the slow deploy, the incident that keeps returning |
| mentor | onboard someone, run a tabletop, write the guide you wish existed |
| give feedback | specific, timely, kind (situation → behaviour → impact) |
| learn in public | short write-ups of what you learned (internal blog, ADRs, lunch talks) |

## Example
Definition of done (team agreement, `docs/definition-of-done.md`):
```markdown
A ticket is done when:
- [ ] Code merged to main with review, tests, and passing checks
- [ ] Deployed to production (not just merged)
- [ ] Feature flag in its intended state (and a cleanup ticket if it's a release flag)
- [ ] Dashboards/alerts updated if behaviour or load changed; watched for 30 min after release
- [ ] Docs, runbooks, and API docs updated
- [ ] Requester told, with how to use it
```
Release watch notes posted in the ticket:
```text
Released r221 (discount codes, flag at 10%) 10:05. Watched to 10:40:
- POST /orders error rate 0.2% (baseline 0.2%), p95 310 ms (baseline 300 ms)
- shop.discounts.applied: 84 applications, 3 rejected (expired codes, expected)
- No new exception groups. Next: 50% tomorrow 10:00 if unchanged.
```
Brag document entry:
```markdown
## 2026-Q4
- Led discount codes (design doc, 7 PRs, rollout with flags). Support hand-work −40 codes/week. Link: design doc, dashboard.
- Found the money-rounding regression with git bisect in 12 min; added rounding property tests (link PR).
- Ran the Redis-down game day; fixed 2 runbook errors; MTTM for cache incidents 25 → 8 min.
- Mentored Jo through first on-call shift; wrote "first week on-call" guide.
```

## Production patterns
- "Done" includes production: deployed, flag set, watched, documented, and communicated.
- New services and large features pass a readiness checklist before launch; owners add the alerts and runbooks they'd want at 03:00.
- Growth is deliberate: specific feedback, a brag document with evidence, visible problems solved, and others helped to grow.

## Mistakes
Wrong: moving the ticket to Done at merge.
Right: done after the change works in production and the requester knows.

Wrong: waiting for a manager to define your growth.
Right: ask for the expectations of the next level, map your work to them with evidence, and pick gaps to close.

## Check yourself
1. What does a production readiness checklist cover?
2. What do you watch after a release, and for how long?
3. Which dimensions separate senior from mid-level engineers?

<details><summary>Answers</summary>

1. Observability (logs, metrics, alerts, runbooks), failure modes and resilience, security, data safety (migrations, backups, retention), capacity, rollout and rollback, and ownership.
2. The SLO and error dashboards for the affected journeys, latency and saturation, new error groups, and any business metric the change affects, for about 15–30 minutes (longer for gradual rollouts).
3. Scope (owning ambiguous problems), impact (team outcomes), technical judgment, influence and mentoring, communication, and operational ownership.
</details>

## Sources
- [Google SRE — Production readiness review](https://sre.google/sre-book/evolving-sre-engagement-model/)
- [Will Larson — Staff Engineer](https://staffeng.com/guides/)
- [Julia Evans — Get your work recognized: write a brag document](https://jvns.ca/blog/brag-documents/)
- [Camille Fournier — The Manager's Path](https://www.oreilly.com/library/view/the-managers-path/9781491973882/)
- [Microsoft — Engineering Fundamentals Playbook](https://microsoft.github.io/code-with-engineering-playbook/)
