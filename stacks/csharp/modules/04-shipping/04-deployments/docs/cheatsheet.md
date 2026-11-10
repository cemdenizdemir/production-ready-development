---
title: Deployments cheatsheet
tech: GitHub Actions, Docker, Azure Container Registry, Azure Container Apps, azd
version: GitHub Actions (azure/login v2, docker/build-push-action v6), Azure CLI 2.7x, EF Core 10
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Deployments cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Pipeline principles
| Principle | Practice | Note |
|:--|:--|:--|
| ⭐ build once | on merge to `main` | |
| ⭐ promote the digest | `image@sha256:...` | same bytes everywhere |
| ⭐ config from environment | no env values in image | |
| fail fast | test → scan → push → deploy | |
| small, frequent deploys | less risk per deploy | DORA |
| one pipeline per deployable | api, web, workers, migrate | reusable workflows |

## OIDC
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `azure/login@v2` | OIDC login | client/tenant/subscription IDs |
| ⭐ `id-token: write` | request token | per job; callers grant it |
| ⭐ federated credential | trust a subject | `repo:org/repo:environment:prod` |
| identity per stage | build, staging, prod | least privilege |
| `AcrPush` | build identity | registry |
| vars, not secrets | IDs aren't secret | |
| fork PRs | no tokens | |

## ACR and images
| Item | Does | Note |
|:--|:--|:--|
| `az acr login --name crshop` | Docker login via Azure | after azure/login |
| ⭐ `docker/build-push-action@v6` | build + push | `outputs.digest` |
| ⭐ `sha-<commit>` tags | traceable | immutable |
| release tags | `1.8.2` | SemVer |
| `az acr import` | copy between registries | separate prod ACR |
| `cache-from/to: type=gha` | CI cache | |

## Container Apps deploy
| Command | Does | Note |
|:--|:--|:--|
| ⭐ `az containerapp update --image X@sha256 --revision-suffix rN` | new revision | |
| ⭐ `az containerapp revision show --query properties.healthState` | wait for `Healthy` | |
| `az containerapp revision list` | revisions | active, created |
| `az containerapp replica list` | replicas | |
| `azure/container-apps-deploy-action` | GitHub action | alternative |
| smoke tests | `curl --fail .../health/ready` | after deploy |

## Revision modes and traffic
| Item | Does | Note |
|:--|:--|:--|
| ⭐ single mode | auto cut-over | rolling |
| ⭐ multiple mode | weights, labels | canary, blue/green |
| `az containerapp revision set-mode --mode multiple` | switch mode | |
| ⭐ `az containerapp ingress traffic set --revision-weight a=90 b=10` | split traffic | |
| `--label-weight blue=100` | by label | |
| `az containerapp revision label add --label green` | label URL | `app---green.<domain>` |
| `az containerapp revision activate/deactivate` | manage revisions | |
| session affinity | sticky users | for canaries on stateful flows |

## Release strategies
| Strategy | Exposure | Rollback |
|:--|:--|:--|
| rolling | everyone in minutes | redeploy previous |
| ⭐ blue/green | 0% → 100% switch | instant |
| ⭐ canary | 5–10% first | instant |
| linear | timed steps | instant |
| ⭐ feature flag | per user/segment | toggle |

## Canary analysis
| Signal | Compare | Note |
|:--|:--|:--|
| ⭐ 5xx rate | new vs old revision | |
| ⭐ p95/p99 | new vs old | |
| new error groups | only in new | |
| business metrics | conversion, payments | enough traffic |
| decision | thresholds → promote/rollback | automate |

## Rollbacks
| Situation | Action | Speed |
|:--|:--|:--|
| ⭐ old revision active | traffic back to it | seconds |
| old revision inactive | activate + traffic | ~1 min |
| single mode | redeploy previous digest | minutes |
| config error | revert config | minutes |
| ⭐ destructive migration | blocked | use expand/contract |
| alert-based | action group → workflow | automatic |

## Migrations
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `dotnet ef migrations bundle --self-contained -r linux-x64` | executable | `efbundle` |
| `./efbundle --connection "..."` | apply pending | idempotent |
| ⭐ Container Apps manual job | run once per deploy | before revision |
| `az containerapp job start` | start execution | |
| `az containerapp job execution show` | status | Succeeded/Failed |
| ⭐ `dotnet ef migrations script --idempotent` | review SQL | in PR |
| migrator identity | DDL rights | app has none |
| ⭐ expand → migrate → contract | compatible schema | 3 releases |
| `Database.Migrate()` at startup | | avoid in prod |

## GitHub environments
| Feature | Does | Note |
|:--|:--|:--|
| ⭐ required reviewers | approval | production |
| prevent self-review | no self-approval | |
| wait timer | cancel window | |
| ⭐ deployment branches | only `main`/tags | |
| env vars/secrets | scoped config | |
| custom protection rules | external gates | |
| deployment history | who, what, when | |

## Feature flags
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `AddFeatureManagement()` | enable | Microsoft.FeatureManagement |
| `.WithTargeting()` | user targeting | |
| ⭐ `IFeatureManager.IsEnabledAsync("X")` | check | |
| `[FeatureGate]` / `.WithFeatureGate()` | gate endpoints | |
| ⭐ `Microsoft.Percentage` | % rollout | |
| ⭐ `Microsoft.Targeting` | users, groups, default % | stable per user |
| `Microsoft.TimeWindow` | time-based | |
| variants | A/B | allocation |
| App Configuration `UseFeatureFlags()` | runtime changes | no deploy |
| ⭐ owner + expiry | flag hygiene | cleanup |

## Frontend deploys
| Item | Does | Note |
|:--|:--|:--|
| ⭐ own Container App | independent deploys | `ca-shop-web` |
| ⭐ `assetPrefix` + blob/CDN | all versions' assets available | |
| ⭐ `deploymentId` | version skew | git SHA |
| shared Server Actions key | consistent replicas | |
| API first, then web | compatibility | |
| `/_next/static/*` immutable | long cache | Front Door |
| `NEXT_PUBLIC_*` | build-time | |

## Scripts
| Practice | How | Note |
|:--|:--|:--|
| ⭐ in repo, reviewed | `scripts/` | |
| ⭐ fail fast | `set -euo pipefail` / `$ErrorActionPreference='Stop'` | |
| idempotent | check, then change | |
| dry run | `-WhatIf` / `--dry-run` | |
| run from CI | `workflow_dispatch` + approval | logged |
| `deploymentScripts` | in-deployment scripts | Bicep, rare |

## Release hygiene
| Item | Tool | Note |
|:--|:--|:--|
| ⭐ SemVer + SHA | versions | `service.version` |
| changelog | release-please, Conventional Commits | |
| MinVer / GitVersion | .NET versions from git | |
| ⭐ deploy markers | App Insights annotations | `Annotations` API |
| GitHub deployments | history | |
| release notes | user-facing | |

## DORA metrics
| Metric | Measures | Note |
|:--|:--|:--|
| ⭐ deployment frequency | how often | per day/week |
| ⭐ lead time for changes | commit → prod | |
| ⭐ change failure rate | bad deploys share | incidents, rollbacks |
| ⭐ failed deployment recovery time | time to recover | was MTTR |
| rework rate | unplanned fix deploys | newer |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| rebuild per env | untested images | promote digest |
| client secrets in CI | leaks, expiry | OIDC |
| "deployed" on command return | broken revision live | wait for Healthy |
| migrate on startup | races | job |
| rename column in one release | old code crashes | expand/contract |
| rollback = rebuild | slow | traffic shift |
| canary without metrics | blind | per-revision compare |
| hard-coded launch dates | redeploys | flags |
| stale flags | debt | expiry + cleanup |
| deleting old assets | ChunkLoadError | CDN keeps versions |
| inputs in `run:` | script injection | pass via `env:` |
| no deploy markers | slow triage | annotations |

## Sources
| Source | Link |
|:--|:--|
| Container Apps + GitHub Actions | https://learn.microsoft.com/azure/container-apps/github-actions |
| Revisions | https://learn.microsoft.com/azure/container-apps/revisions |
| Traffic splitting | https://learn.microsoft.com/azure/container-apps/traffic-splitting |
| Blue-green | https://learn.microsoft.com/azure/container-apps/blue-green-deployment |
| OIDC for azure/login | https://learn.microsoft.com/azure/developer/github/connect-from-azure-openid-connect |
| Migration bundles | https://learn.microsoft.com/ef/core/managing-schemas/migrations/applying#bundles |
| GitHub environments | https://docs.github.com/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment |
| Feature management | https://learn.microsoft.com/azure/azure-app-configuration/feature-management-dotnet-reference |
| DORA | https://dora.dev/guides/dora-metrics-four-keys/ |
