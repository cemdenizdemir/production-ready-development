---
title: Infrastructure, code health, and the launch plan
tech: Bicep, deployment stacks, GitHub Actions (OIDC), Azure Container Apps, Microsoft.FeatureManagement, NetArchTest
version: Bicep 0.3x, azure/login v2, .NET 10
date: 2026-11-10
covers: [10, 11, 12]
---
# Infrastructure, code health, and the launch plan
[← Overview](00-overview.md)

## Why it matters
- A portal change made "just for launch" drifts production from staging, and the next deploy silently reverts it.
- If rollback has never been tried, launch day is when you learn it takes 40 minutes.
- Launching to everyone at once turns every unknown into an incident; a gradual rollout with gates turns it into a dashboard reading.

## Infrastructure and delivery
| Item | Check | Evidence |
|:--|:--|:--|
| ⭐ no drift | nightly what-if shows no changes for staging and production; deployment stacks with deny settings | what-if output |
| ⭐ OIDC everywhere | no client secrets in GitHub; federated credentials per environment; least-privilege roles | identity config |
| ⭐ same image | the production digest equals the tested staging digest | pipeline logs |
| ⭐ approval gate | production environment requires reviewers; deploy windows agreed | GitHub settings |
| ⭐ rollback tested | traffic shift back to the previous revision in < 2 min, rehearsed | drill notes |
| migrations | migration job runs before revisions; latest migration is expand-only (rollback-safe) | pipeline + PR |
| policies and locks | Azure Policy denies (public blobs, non-Entra SQL); locks on data resources | policy compliance |
| network | private endpoints for SQL, Redis, Storage, Key Vault, Service Bus; public access off | Bicep |
| certificates and DNS | managed certificates; DNS in IaC; expiry alerts for anything else | config |
| supported versions | .NET 10, Node 24, base images patched in the last week | image scan |

## Architecture and code health
| Item | Check | Evidence |
|:--|:--|:--|
| ⭐ boundaries enforced | architecture tests green; no cross-module table access; contracts only | CI |
| ⭐ ADRs current | ADR-0001…0010 reflect what's built; superseded ones marked | `docs/adr/` |
| ⭐ no critical review findings | `/review` or `/code-review` on the main flows: no open critical/high findings | review report |
| test health | unit + integration suites green and fast; no skipped tests on money/auth paths | CI |
| analyzers | warnings as errors; `dotnet format` clean | CI |
| dependency licences | no commercial-licence packages without an approved ADR | CI package check |
| docs | README (run locally), runbooks, API docs (OpenAPI), on-call guide | links |

## Launch plan
| Phase | Action | Gate to continue |
|:--|:--|:--|
| T−14 days | dry run of the whole checklist; fix blockers | blockers closed or accepted |
| T−7 | freeze risky changes; final load test; restore drill | thresholds and RTO met |
| T−1 | go/no-go meeting; on-call and support confirmed; status page ready | all owners say go |
| ⭐ T0 (staff) | flags on for staff; place real orders with real cards; refund them | no errors, reconciliation clean |
| ⭐ T+1 h (10%) | `Checkout` flag targeting 10% of visitors | SLO burn < 1×, no new error groups |
| T+4 h (50%) | 50% | same |
| T+1 day (100%) | everyone; announce | same for 24 h |
| ⭐ T+7 days | post-launch review: incidents, metrics vs targets, surprises, action items | review doc |

| Launch-day checklist | |
|:--|:--|
| ⭐ on-call primary and secondary online; incident channel ready | |
| dashboards open: SLOs, business (orders/min, payment success), dependencies, DLQ, outbox lag | |
| Stripe live mode keys in Key Vault; webhook endpoint (live) verified with a test event | |
| ACS sending quota raised; DMARC reports flowing | |
| rollback command and flag kill switches written in the channel | |
| support team briefed; customer FAQ live | |
| no other deploys during the launch window | |

## Example
Rollout flag (App Configuration, targeting):
```json
{
  "id": "Checkout",
  "enabled": true,
  "conditions": {
    "client_filters": [
      { "name": "Microsoft.Targeting", "parameters": { "Audience": {
        "Groups": [ { "Name": "staff", "RolloutPercentage": 100 } ],
        "DefaultRolloutPercentage": 10 } } }
    ]
  }
}
```
Gate check between rollout steps (run by the pipeline or the launch lead):
```bash
# fail if checkout burn rate over the last 30 minutes exceeds 1x, or new exception groups appeared since the step started
az monitor log-analytics query -w "$LAW_ID" --analytics-query @queries/checkout-burn-30m.kql -o tsv | awk '{ if ($1 > 1.0) exit 1 }'
az monitor log-analytics query -w "$LAW_ID" --analytics-query @queries/new-error-groups.kql -o tsv | awk 'NF { exit 1 }'
```
Post-launch review outline (`docs/launch/post-launch-review.md`):
```markdown
## Targets vs actuals
| Target | Planned | Actual |
| checkout p95 | < 800 ms | 610 ms |
| orders day 1 | 300 | 412 |
## Incidents and near misses
## What surprised us
## Action items (owner, date)
```

## Mistakes
Wrong: "We'll test rollback if we need it."
Right: rehearse it before launch and write the command in the launch channel.

Wrong: 100% of traffic at launch because "everything passed staging".
Right: staff first, then 10% → 50% → 100% with gates on SLOs and error groups.

## Check yourself
1. How do you prove there's no infrastructure drift?
2. What gates each step of the gradual rollout?
3. Why does the latest migration before launch have to be expand-only?

<details><summary>Answers</summary>

1. A what-if against production (nightly and before launch) shows no changes, deployment stacks deny out-of-band changes, and nobody has standing write access.
2. SLO burn rate (below 1× over the window), no new error groups, business metrics in expected ranges (orders, payment success), and reconciliation clean; any breach stops the rollout or turns the flag off.
3. So the previous application version still works against the new schema; if the launch release must be rolled back, the database doesn't block it.
</details>

## Sources
- [04-shipping/03-iac](../../../04-shipping/03-iac/README.md), [04-shipping/04-deployments](../../../04-shipping/04-deployments/README.md)
- [03-backend/11-architecture lesson 06](../../../03-backend/11-architecture/docs/06-microservices-adrs-boundaries.md)
- [05-practice lesson 05 (ownership, readiness)](../../../05-practice/01-engineering-practice/docs/05-ownership-growth.md)
- [Feature management targeting](https://learn.microsoft.com/azure/azure-app-configuration/howto-targetingfilter)
- [Google SRE — Launch coordination](https://sre.google/sre-book/reliable-product-launches/)
