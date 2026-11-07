---
title: Infrastructure, code health, and the launch plan
tech: Terraform, GitHub Actions, AWS ECS, Next.js 16, Express 5
version: Terraform 1.14, GitHub Actions (OIDC, environments), Amazon ECS, feature flags
date: 2026-11-07
covers: [10, 11, 12]
---
# Infrastructure, code health, and the launch plan
[← Overview](00-overview.md)

## Why it matters
- A hotfix on launch day fails because production was partly configured by hand and Terraform wants to "fix" it back.
- Architecture rules were enforced in month one and quietly disabled in month four; the modular monolith has become a mesh.
- Turning everything on for everyone at once leaves no room to learn: one bug hits 100% of customers.

## Infrastructure and delivery
| Check | How to verify |
|:--|:--|
| Everything in Terraform; no drift | nightly `terraform plan -detailed-exitcode` exits 0 |
| Separate staging and production accounts | Organizations structure |
| CI/CD with OIDC, no static keys | workflow files; IAM credential report |
| Build once, promote the same digest | deploy logs show the same `sha256` in staging and production |
| Approval gate for production | GitHub environment rules |
| Rollback tested | redeploy of the previous revision timed |
| Migrations as one-off tasks with locks | pipeline logs |
| Secrets in Secrets Manager, rotation documented | Terraform + runbook |
| Image scanning and SBOM | registry findings triaged |

## Architecture and code health
| Check | How to verify |
|:--|:--|
| Context boundaries enforced | lint rules and architecture test pass in CI (not disabled) |
| ADRs current | every major decision has an ADR; superseded ones marked |
| Domain rules unit-tested | coverage of domain folders, mutation testing optional |
| No critical or high review findings open | `/review` reports for capstone milestones |
| Glossary matches code | spot check names in code against `docs/domain/glossary.md` |
| Tech debt visible | `tech-debt` issues with costs and triggers |
| Dependencies current | Dependabot PRs merged or triaged |

## Launch plan
| Phase | Actions |
|:--|:--|
| T−14 days | readiness review complete; game day; load test at peak; content and legal pages final |
| T−7 | feature freeze on launch scope; flags in place; support macros and FAQ ready |
| T−1 | final checks; on-call briefed; dashboards and status page open; rollback path rehearsed |
| T0 (launch) | enable for internal users → 5% → 25% → 100% via flags, watching SLOs and business metrics at each step |
| T+1 | review errors, support tickets, payment success, Web Vitals |
| T+7 to T+14 | post-launch review: what went well, what broke, action items; remove launch flags |

| Rollout gate | Continue if |
|:--|:--|
| Error rate | ≤ baseline and burn rate under page thresholds |
| Checkout success | ≥ 97% of attempts reach payment, payment success ≥ 90% |
| Latency | p95 within SLO |
| Support | no new class of tickets |

## Example
A flag-driven gradual rollout with a kill switch (using the flag service from [04-shipping/04-deployments lesson 04](../../../04-shipping/04-deployments/docs/04-flags-frontend-releases.md)):
```ts
// Launch: the new storefront for a growing share of visitors; instant off switch
const useNewStorefront = await isEnabled('storefrontV2', { userId: visitorId });
if (!useNewStorefront) return renderLegacyStorefront();
```
```sql
-- Rollout steps recorded in the launch log (flag admin, or SQL in a reviewed script)
UPDATE flags SET enabled = true, rollout_percent = 5   WHERE name = 'storefrontV2';  -- T0 + 0 h
UPDATE flags SET rollout_percent = 25  WHERE name = 'storefrontV2';                    -- after 2 h green
UPDATE flags SET rollout_percent = 100 WHERE name = 'storefrontV2';                    -- after 24 h green
UPDATE flags SET enabled = false WHERE name = 'storefrontV2';                          -- kill switch
```
`docs/launch/post-launch-review.md` template:
```markdown
# Post-launch review — Roastery v1
Window: 2026-11-20 → 2026-12-04 · Facilitator: … · Blameless

## Outcomes vs goals
| Goal | Target | Actual |
|---|---|---|
| Orders/day | 300 | … |
| Checkout success | ≥ 97% | … |
| Availability | 99.9% | … |

## What went well / what didn't
## Incidents (links to postmortems)
## Action items (owner, due date)
```

## Mistakes
Wrong: launching at 100% on Friday evening. Right: a gradual, flag-driven rollout during working hours with gates.

Wrong: disabling the architecture test "temporarily" to ship a feature. Right: fix the boundary violation or record an ADR exception.

Wrong: no post-launch review. Lessons from launch are lost. Right: a scheduled review with owned action items.

## Check yourself
1. What proves production is fully managed by Terraform?
2. Which gates decide whether a rollout step continues?
3. What belongs in a post-launch review?

<details>
<summary>Answers</summary>

1. A plan against production that shows no changes (nightly drift check exit code 0), no resources created by hand (console access read-only), and every resource tagged `ManagedBy = terraform`.
2. Error rate and SLO burn, checkout and payment success rates, latency within SLO, and support signals; any failing gate pauses or rolls back via the flag.
3. Outcomes against goals (business and reliability), what went well and what didn't, links to incident postmortems, and owned, dated action items, run blamelessly one to two weeks after launch.
</details>

## Sources
- [Google SRE book — Reliable product launches at scale](https://sre.google/sre-book/reliable-product-launches/)
- [Martin Fowler — Feature toggles](https://martinfowler.com/articles/feature-toggles.html)
- [Terraform — Detecting drift (detailed exit codes)](https://developer.hashicorp.com/terraform/cli/commands/plan#detailed-exitcode)
- [Atlassian — Post-incident and post-launch reviews](https://www.atlassian.com/incident-management/postmortem)
