---
title: Shipping cheatsheet
date: 2026-11-09
---
# Shipping cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · Containers](01-containers/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| multi-stage Dockerfile: `sdk:10.0` → `aspnet:10.0-noble-chiseled-extra` | small runtime image with ICU and tzdata |
| `USER $APP_UID`, port 8080, exec-form `ENTRYPOINT` | non-root, SIGTERM-aware |
| `dotnet publish -t:PublishContainer` + `ContainerFamily` | images without a Dockerfile |
| csproj → `restore` → sources, `.dockerignore`, cache mounts | fast cached builds |
| `RUN --mount=type=secret` | build secrets outside layers |
| pinned bases, Trivy/Scout scans, SBOM + provenance | image security |
| git-SHA tags, deploy by digest | traceable, exact images |
| `FROM --platform=$BUILDPLATFORM` + `-a $TARGETARCH` | fast multi-arch builds |
| GC heap = 75% of container memory limit | memory limits matter |
| Compose `service_healthy`, profiles, `watch` | local orchestration |
| SQL Server container: ≥ 2 GB, volume, `sqlcmd -C` health | local database |
| Aspire AppHost: `WithReference`, `WaitFor`, `aspire run` | C# local orchestration |
| Next.js `output: "standalone"` + copy `.next/static`, `public` | small frontend image |
| exit 137 = OOM/SIGKILL; `docker inspect`, system logs | debugging |

## [02 · Cloud](02-cloud/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| subscription per environment, `rg-shop-prod-weu`, tags | structure |
| RBAC = principal + role + scope; data-plane roles | least privilege |
| user-assigned managed identity + `DefaultAzureCredential` | no secrets in apps |
| SQL contained user `FROM EXTERNAL PROVIDER` | Entra-only database access |
| VNet + private endpoints + public access off | private PaaS |
| NAT gateway | static outbound IP |
| Container Apps environment, apps, revisions, jobs | compute model |
| `registries: [{ server, identity }]` | ACR pull without passwords |
| Azure SQL vCore GP, zone-redundant, no auto-pause in prod | database setup |
| Azure Managed Redis + Entra auth | Redis (Azure Cache for Redis retiring) |
| Key Vault (RBAC, purge protection) + versionless references | secrets |
| App Configuration with labels and feature flags | settings |
| managed certificates, CNAME + `asuid` TXT | custom domains |
| budgets, tags, scale to zero; `ContainerAppSystemLogs_CL` | cost and platform logs |

## [03 · Infrastructure as Code](03-iac/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `resource`, `param`, `output`, `existing`, loops, conditions | Bicep basics |
| references create dependencies | no manual `dependsOn` |
| modules + user-defined types, AVM `br/public:avm/...` | reuse |
| `.bicepparam` per environment, `readEnvironmentVariable`, `az.getSecret` | environments and secrets |
| `@secure()`, no secret outputs | safe parameters |
| no state file; incremental mode leaves removed resources | ARM is the truth |
| `az deployment group what-if` in PRs | reviewable diffs |
| `az stack group create --action-on-unmanage --deny-settings-mode` | lifecycle + protection |
| changing `name` = new resource | refactor carefully |
| `CanNotDelete` locks, Azure Policy deny | guardrails |
| `azure/login@v2` OIDC + environment approvals | CI deploys |
| bicepconfig linter, PSRule, nightly what-if | tests and drift |
| `azd up` / `azd env new` / `azd infra gen` | developer workflow |
| Bicep vs Terraform: state, scope, licence | tool choice |

## [04 · Deployments](04-deployments/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| build once on `main`, promote the digest | tested = shipped |
| OIDC identity per stage, `id-token: write` | no CI secrets |
| `docker/build-push-action` → `outputs.digest` | image to deploy |
| `az containerapp update --image X@sha256 --revision-suffix` | new revision |
| wait for `healthState == Healthy` + smoke tests | real success |
| multiple revision mode, labels, `ingress traffic set` | canary, blue/green |
| per-revision error rate and p95 | canary analysis |
| traffic back to previous revision | seconds rollback |
| EF Core migration bundle as a Container Apps job | migrations once per deploy |
| expand → migrate → contract | rollback-safe schema |
| GitHub environments: reviewers, branch rules | production gates |
| Microsoft.FeatureManagement targeting/percentage | deploy ≠ release |
| `assetPrefix` + CDN, `deploymentId` | frontend version skew |
| App Insights annotations, DORA metrics | release hygiene |

## [05 · Data Safety](05-data-safety/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| RPO / RTO per data set and scenario | recovery targets |
| PITR 1–35 days (set 35), LTR up to 10 years | Azure SQL backups |
| restore = new database; copy back or switch | recovery mechanics |
| monthly restore drills with verification and timing | proven recovery |
| `SET LOCK_TIMEOUT`, online/resumable indexes, `NOCHECK` FKs | safe migrations |
| `UPDATE TOP (5000)` loops as separate jobs | safe backfills |
| `az sql db copy`; BACPAC only from a copy | exports |
| zone redundancy, GRS backups, failover groups | redundancy |
| backup/restore, pilot light, warm standby, active/active | DR strategies |
| locks, PIM, soft delete, purge protection | human-error defences |
| retention schedule, erasure log re-applied after restore | GDPR and backups |
| TDE, `Encrypt=True`, CMK with purge protection | encryption |
| Bogus synthetic data, anonymised staging copies | non-production data |

## [06 · Incident Response](06-incident-response/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| SEV1–SEV4 by impact; declare early | triage |
| IC, ops, comms, scribe; one channel | roles |
| roll back, flag off, scale, fail over, shed | mitigation first |
| impact → time → operation → dependency → trace | production debugging |
| saved KQL queries, deploy markers | fast diagnosis |
| Service Health alerts, Resource Health | is it Azure? |
| status page on separate infra, updates every 30 min | communication |
| rotations, escalation, < 2 pages per shift | sustainable on-call |
| runbooks: trigger, checks, mitigations, verify | linked from alerts |
| blameless postmortems, owned dated actions | learning |
| tabletops, game days, restore and failover drills | practice |
| preserve evidence, contain; GDPR 72 h | security incidents |
| MTTD, MTTM, customer-detected %, follow-through | improvement metrics |
