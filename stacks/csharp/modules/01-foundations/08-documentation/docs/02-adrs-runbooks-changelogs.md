---
title: ADRs, runbooks, and changelogs
tech: Markdown, GitHub Releases
version: GitHub.com (Nov 2026)
date: 2026-11-09
covers: [4, 8, 10]
---
# ADRs, runbooks, and changelogs
[← Overview](00-overview.md)

## Why it matters
- A new lead wants to "switch to PostgreSQL". The reasons for SQL Server (Azure SQL features, team skills, stored procedures used by finance reports) were in a Slack thread that no longer exists.
- An alert fires at 3 a.m.: `ShopApi.Sql.DeadlockRate > 5/min`. The on-call engineer has never seen it and has no idea what to do.
- Customers ask what changed in v1.4; the only answer is `git log`.

## Concepts

### Architecture Decision Records
One short Markdown file per significant decision, numbered, immutable once accepted (superseded by a later ADR, never rewritten).

`docs/adr/0003-sql-server-and-ef-core.md`
```markdown
# 3. SQL Server 2025 and EF Core 10 for persistence

Date: 2026-11-09
Status: Accepted

## Context
We need a relational store for orders, payments, and inventory. The team targets .NET/Azure employers;
Azure SQL is the managed option; finance needs T-SQL reporting views. Load: ~200 writes/s peak.

## Decision
SQL Server 2025 locally (Docker) and Azure SQL Database in the cloud, accessed with EF Core 10.
Dapper for hand-tuned read queries.

## Consequences
+ Mature tooling (SSMS, Query Store), managed backups and PITR in Azure SQL.
+ `rowversion` for optimistic concurrency.
- T-SQL specifics make a later move to PostgreSQL costly.
- The SQL Server container needs ~2 GB RAM on laptops.

## Alternatives considered
PostgreSQL 18 (Azure Database for PostgreSQL): strong, cheaper; rejected for team/job alignment.
```
| Write an ADR when | Skip it when |
|:--|:--|
| a choice is expensive to reverse (database, auth model, messaging) | it's a local implementation detail |
| several reasonable options exist | there's only one sane option |
| people will ask "why?" later | the code makes it obvious |

Status values: Proposed, Accepted, Deprecated, Superseded by ADR-N. Review ADRs in PRs like code. Also seen: MADR template, `adr-tools`, and Log4brains for publishing.

### Runbooks
A runbook turns an alert into actions. Link it from the alert itself.

`docs/runbooks/sql-deadlocks.md`
```markdown
# SQL deadlock rate high

Alert: ShopApi.Sql.DeadlockRate > 5/min for 10 min · Severity: SEV3 (SEV2 if checkout error rate > 2%)

## Impact
Writes to orders may fail and be retried; checkout latency rises.

## Check (5 min)
1. Dashboard "Shop API / SQL": deadlocks, top waiting queries.
2. Last deploy: `az containerapp revision list -n ca-shop-api -g rg-prod -o table`.
3. Query Store → "Top resource consuming queries" since the alert started.

## Mitigate
- Deadlocks started after a deploy → roll back: `az containerapp ingress traffic set ... --revision-weight <previous>=100`.
- One job (e.g. nightly import) involved → pause it in the Hangfire dashboard.
## Escalate
Data team (#data-oncall) if not mitigated in 30 min.
## Afterwards
Capture the deadlock graph (`system_health` XE session), open an issue, link the postmortem.
```
Rules: commands are copy-pasteable, mitigation comes before diagnosis, every runbook names who to escalate to, and runbooks are tested in game days (04-shipping/06-incident-response).

### CHANGELOG and release notes
| Item | For | How |
|:--|:--|:--|
| `CHANGELOG.md` (Keep a Changelog) | humans, per version | sections Added / Changed / Deprecated / Removed / Fixed / Security |
| GitHub Release notes | consumers | `gh release create v1.4.0 --generate-notes`, then edit |
| API changelog | frontend and partners | deprecations with dates, breaking changes, new endpoints |
| deploy markers | operators | release annotation in Application Insights / Grafana |

```markdown
## [1.4.0] - 2026-11-20
### Added
- `POST /orders/{id}/cancel` (409 after shipment).
### Deprecated
- `GET /orders?page=` offset pagination; use `cursor`. Removal on 2027-02-01.
### Fixed
- Totals rounded half-up to match Stripe.
```
Conventional Commits (01-git) make generation possible; also seen: release-please, GitVersion.

## Example
A docs folder that scales:
```text
docs/
  adr/0001-record-architecture-decisions.md
  adr/0002-aspnet-core-minimal-apis.md
  adr/0003-sql-server-and-ef-core.md
  runbooks/README.md            # index: alert name → runbook
  runbooks/sql-deadlocks.md
  runbooks/api-5xx-spike.md
  configuration.md
  architecture.md
CHANGELOG.md
```

## Production patterns
- ADR 0001 is "we record decisions with ADRs"; it sets the habit.
- Every alert rule has a `runbook_url`; an alert without one doesn't go to production.
- Changelog entries are written in the PR that makes the change (or generated from its commit).
- Deprecations are dated in the changelog and in the API (lesson 04).

## Mistakes
Wrong: editing an accepted ADR when the decision changes.
Right: a new ADR that supersedes it; the old one gets `Status: Superseded by ADR-0009`.

Wrong: runbooks that explain the system instead of what to do.
Right: impact, quick checks, mitigation commands, escalation; links to explanation docs for later.

## Check yourself
1. What are the four core sections of an ADR?
2. Why does mitigation come before root-cause analysis in a runbook?
3. Which Keep a Changelog section announces something that will be removed later?

<details><summary>Answers</summary>

1. Title/status, Context, Decision, Consequences (alternatives are a useful fifth).
2. Users are affected now; restoring service (rollback, pause, failover) is the priority. Root cause can wait.
3. `Deprecated`.
</details>

## Sources
- [Michael Nygard — Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub organization (templates)](https://adr.github.io/)
- [MADR](https://adr.github.io/madr/)
- [Google SRE — Being on-call](https://sre.google/sre-book/being-on-call/)
- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [GitHub — Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
