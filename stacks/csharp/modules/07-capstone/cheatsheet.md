---
title: Capstone cheatsheet
date: 2026-11-10
---
# Capstone cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · Design & Build](01-design-build/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| scope + numbers (20–100 req/s, 300 orders/day, 99.9%, RPO 5 min / RTO 1 h) | requirements that drive the design |
| Pricing and Ordering core; Catalog, Fulfillment supporting; Payments, Identity, Notifications generic | where to invest |
| context map: customer–supplier, open host, published language, ACLs | module relationships |
| Order, StockItem, Promotion aggregates with written invariants | consistency boundaries |
| n-tier on Container Apps, modular monolith, clean architecture + slices | architecture at three levels |
| `*.Contracts` only, `internal`, NetArchTest, CODEOWNERS | enforced boundaries |
| ports/ACLs, state machines, checkout saga, outbox/inbox, CQRS-lite | patterns where they pay |
| conditional `UPDATE` for stock; one transaction for order + saga + outbox | strong consistency where needed |
| Stripe webhook drives payment state; saga compensates on expiry/failure | checkout correctness |
| ADR-0001…0010 | recorded decisions |
| M1 walking skeleton → M8 performance and polish, each deployed | milestones |

## [02 · Pre-Launch Checklist](02-pre-launch/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| every checklist item links to evidence | proof over opinion |
| authorization inventory test, OWASP Top 10:2025 review, supply-chain checks | security |
| data inventory, privacy policy, access/erasure flows, breach runbook | privacy and legal |
| timeouts, safe retries, probes, graceful shutdown tested under load | reliability |
| PITR 35 days, locks, purge protection, restore drill with measured RTO | data safety |
| SLOs, burn-rate alerts with runbooks, traces end to end | observability |
| on-call, external status page, rehearsed runbooks, budgets | operations |
| k6 campaign-peak test, caching verified, Web Vitals budgets | performance |
| axe gates + keyboard + screen reader passes (WCAG 2.2 AA) | accessibility |
| metadata, canonical URLs, structured data, noindex outside prod | SEO |
| no drift, OIDC, same digest, approval gate, rollback rehearsed | infrastructure and delivery |
| staff → 10% → 50% → 100% with gates; post-launch review | launch plan |
