---
title: ADRs, runbooks, and changelogs
tech: Markdown, GitHub
version: Nygard ADR format, Keep a Changelog 1.1, Nov 2026
date: 2026-11-07
covers: [4, 8, 10]
---
# ADRs, runbooks, and changelogs
[← Overview](00-overview.md)

## Why it matters
- A new lead proposes moving from Postgres to MongoDB "because we never decided why". The original reasons (transactions for payments) were only in the memory of someone who left.
- The queue backs up at 3 a.m. The on-call engineer has never touched the worker service and spends 40 minutes finding the dashboard and the safe way to drain it.
- Customers ask what changed in v2.3. Nobody knows, because the release only says "bug fixes and improvements".

## Concepts

### Architecture Decision Records
An ADR is a short Markdown file recording one significant decision: the context, what was decided, and the consequences. Numbered, stored in the repo, never edited after acceptance; a later ADR supersedes it.

| Section | Contents |
|:--|:--|
| Title | `0007 · Use BullMQ on Redis for background jobs` |
| Status | proposed · accepted · deprecated · superseded by 0012 |
| Context | forces at play: requirements, constraints, options considered |
| Decision | what we will do, in active voice |
| Consequences | what gets easier, what gets harder, follow-up work |

Write an ADR when a decision is expensive to reverse: databases, frameworks, auth approach, public API style, hosting. [STACK.md](../../../../STACK.md)'s decision log is a lightweight version of the same idea.

### Runbooks
A runbook is a how-to guide for operating a system under stress. It must work for someone tired who has never seen the service.

| Section | Contents |
|:--|:--|
| Overview | what the service does, who owns it, dependencies |
| Dashboards and logs | direct links |
| Alerts → actions | for each alert: what it means, how to confirm, how to mitigate |
| Common operations | deploy, roll back, scale, drain a queue, rotate a secret |
| Verification | how to know it's fixed |
| Escalation | who to call next, and when |

Link each alert's notification to its runbook section ([04-shipping/06-incident-response](../../../04-shipping/06-incident-response/README.md)).

### Changelogs and release notes
| Artifact | Audience | Source |
|:--|:--|:--|
| `CHANGELOG.md` (Keep a Changelog) | developers, integrators | curated per release: Added, Changed, Deprecated, Removed, Fixed, Security |
| GitHub Release notes | users of a version | generated from PR titles/labels (`.github/release.yml`), then edited |
| Commit history | maintainers | Conventional Commits ([01-git](../../01-git/README.md)) |

A changelog is for humans: group by impact, call out breaking changes and migrations first, link PRs. also seen: release-please and Changesets automate versioning and changelogs from commits.

## Example
`docs/adr/0007-background-jobs-with-bullmq.md`
```md
# 0007 · Use BullMQ on Redis for background jobs
Status: accepted · Date: 2026-11-07 · Deciders: @api-team

## Context
Order confirmation emails and invoice PDFs run inside requests and time out at peak.
We need retries with backoff, delayed jobs, and visibility into failures.
Options: BullMQ (Redis), pg-boss (Postgres), AWS SQS.

## Decision
Use BullMQ on our existing Redis 8. Jobs are idempotent and carry an idempotency key.

## Consequences
+ Retries, delays, rate limits, and a dashboard without new infrastructure.
+ Redis is already run and monitored.
- Redis now holds work in flight: enable AOF persistence and alert on memory.
- Long-term, if we need cross-region queues, revisit SQS (new ADR).
```
`docs/runbooks/orders-worker.md` (excerpt)
```md
# Runbook · orders-worker
Owner: #team-orders · Dashboard: <grafana link> · Logs: <loki query link>

## Alert: OrdersQueueBacklogHigh (waiting jobs > 5,000 for 10 min)
1. Confirm: dashboard "Queue depth" panel; check `failed` count too.
2. Common causes: SMTP provider down (look for `ETIMEDOUT` in worker logs), worker crash-looping.
3. Mitigate:
   - Provider down: pause sends with flag `email-sending=false`; jobs wait safely.
   - Workers down: `aws ecs update-service --cluster prod --service orders-worker --force-new-deployment`
4. Verify: backlog decreasing for 10 min; failed jobs retried.
5. Escalate after 30 min: @orders-oncall-secondary.
```
`CHANGELOG.md`
```md
# Changelog
All notable changes to this project. Format: Keep a Changelog; versions follow SemVer.

## [2.3.0] - 2026-11-07
### Added
- `GET /orders?status=` filter (#412).
### Deprecated
- `GET /orders/search`; use `GET /orders?q=`. Removal in 3.0.
### Fixed
- Duplicate confirmation emails on retried payments (#405).
### Security
- Rate limit on `POST /auth/login` lowered to 10 per 15 minutes per IP.
```

## Production patterns
- **ADRs in `docs/adr/`, numbered, linked from the README.** Review them as PRs; acceptance = merge.
- **Every alert links to a runbook section.** An alert without a runbook isn't ready for production.
- **Practice runbooks** in game days; fix every step that was unclear.
- **Changelog entries in the same PR as the change**, or generated and then edited at release time.
- **Breaking changes get a migration note** with before/after examples.

## Mistakes
Wrong: editing an accepted ADR when the decision changes. The history of why disappears.
Right: write a new ADR that supersedes it, and mark the old one "superseded by 00xx".

Wrong: a runbook that says "investigate and fix". Right: concrete checks, commands, links, and an escalation path.

Wrong: a changelog that is the raw commit log.
```md
- fix: typo
- chore(deps): bump x
- wip
```
Right: user-facing changes grouped by type, with breaking changes first.

## Check yourself
1. When is a decision worth an ADR?
2. Who is the reader of a runbook, and what does that imply for how it's written?
3. How does a changelog differ from a commit log?

<details>
<summary>Answers</summary>

1. When it is costly to reverse or affects many people: data stores, frameworks, auth design, API style, hosting, major dependencies.
2. A tired on-call engineer who may not know the service. Steps must be explicit, with direct links and copy-paste commands, and safe mitigation before deep diagnosis.
3. A changelog is curated for users of the software: grouped by impact, written in plain language, with breaking changes and migrations. A commit log records every internal step for maintainers.
</details>

## Sources
- [Michael Nygard — Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub organization — templates](https://adr.github.io/)
- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Google SRE Workbook — On-call](https://sre.google/workbook/on-call/)
- [GitHub — Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
