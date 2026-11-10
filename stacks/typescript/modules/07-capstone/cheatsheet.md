---
title: Capstone cheatsheet
date: 2026-11-07
---
# Capstone cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · Design & Build](01-design-build/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| n-tier + modular monolith + DDD + clean | each answers a different question |
| DDD shapes the boxes, clean shapes the arrows | contexts as modules, dependencies inward |
| Core: Pricing, Ordering; generic: Payments, Identity, Notifications | where to invest |
| Context folders: domain, application, adapters, contracts, queries, index.ts | consistent structure |
| Lint rules + architecture test | enforced boundaries |
| Ports owned by contexts, wired in `deps.ts` | dependency inversion |
| Conditional `UPDATE` for stock | no overselling |
| Orchestrated checkout saga, pivot at payment | consistency without 2PC |
| Outbox + idempotent consumers | effectively-once events |
| CQRS-lite read models | fast history and dashboards |
| ADRs 0001–0009 | recorded decisions |
| M1 walking skeleton → M7 production | milestones, each deployed |

## [02 · Pre-Launch Checklist](02-pre-launch/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Claim → evidence → owner | readiness you can prove |
| Authorization test matrix | IDOR prevented |
| gitleaks, CodeQL, Dependabot, header check | security evidence |
| Privacy inventory, consent, erasure, breach runbook | GDPR readiness |
| Deploy under load with 0 errors | graceful shutdown proven |
| Restore drill with measured RTO | backups proven |
| Acknowledged test page | alerts reach humans |
| k6 at campaign peak + Lighthouse budgets | performance gates |
| axe in CI + manual keyboard/screen reader | WCAG 2.2 AA |
| `noindex` outside production | SEO safety |
| Same digest staging → prod, rollback timed | safe delivery |
| Flags: internal → 5% → 25% → 100% with gates | gradual launch |
| Post-launch review | lessons kept |
