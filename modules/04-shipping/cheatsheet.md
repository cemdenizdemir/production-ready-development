---
title: Shipping cheatsheet
date: 2026-11-07
---
# Shipping cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · Containers](01-containers/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Multi-stage build on `node:26-slim` | small images without build tools |
| Lockfile + install before `COPY src` | cached dependency layer |
| `.dockerignore` | no `node_modules`, `.git`, `.env*` in the context |
| `pnpm install --prod --frozen-lockfile` | production dependencies only |
| `USER node`, code owned by root | non-root, code not writable |
| `CMD ["node", "src/server.ts"]` | exec form: signals reach Node |
| `RUN --mount=type=secret,id=…` | build secrets without leaking them |
| `FROM …@sha256:…` + Dependabot | pinned, regularly updated bases |
| `docker scout cves --only-fixed` | actionable vulnerability scan |
| `sha-<git sha>` tags, deploy by digest | immutable, unambiguous images |
| `depends_on.condition: service_healthy` | ordered Compose startup |
| `docker inspect … OOMKilled`, exit 137 | out-of-memory kills |

## [02 · Cloud](02-cloud/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Account per environment, IAM Identity Center | isolation, SSO for people |
| Task role vs execution role | app permissions vs pull/logs/secrets |
| Private subnets, `assignPublicIp: DISABLED` | tasks unreachable from the internet |
| Security groups referencing groups | exact traffic paths |
| S3 gateway endpoint | free private S3 access, less NAT cost |
| Task definition `secrets` (`valueFrom`) | runtime secrets from Secrets Manager |
| Circuit breaker + rollback | failed deploys revert |
| ALB 443 + ACM, Route 53 aliases | TLS and DNS without maintenance |
| RDS Multi-AZ, managed master password, deletion protection | production database basics |
| Separate Valkey clusters (`allkeys-lru` / `noeviction`) | cache vs queues |
| Log group `retention_in_days` | logs don't cost forever |
| Budgets + anomaly detection, `default_tags` | cost visibility |

## [03 · Infrastructure as Code](03-iac/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `required_version`, providers `~> 6.0`, lock file | reproducible runs |
| `backend "s3"` + `use_lockfile = true` | shared, locked state |
| Versioned, encrypted, restricted state bucket | state is secret |
| Directory + account per environment | no cross-environment accidents |
| `for_each` over maps | stable resource addresses |
| `ignore_changes = [task_definition, desired_count]` | CI and autoscaling own those |
| Plan in PRs, apply from CI with OIDC | reviewed infrastructure changes |
| `-/+` and `-` in plans | stop and check |
| `moved`, `import`, `removed` blocks | safe refactors |
| `ephemeral` + write-only arguments | secrets out of state |
| `terraform test` + `mock_provider` | module tests without AWS |
| Nightly `plan -detailed-exitcode` | drift detection |

## [04 · Deployments](04-deployments/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Build once, promote the digest | prod runs what staging ran |
| OIDC roles with exact `sub` | no AWS keys in GitHub |
| `concurrency` with `cancel-in-progress: false` | no half-finished deploys |
| render + deploy task definition, `wait-for-service-stability` | reliable ECS deploys |
| 100/200 capacity + circuit breaker + alarm rollback | safe rolling deploys |
| Migration one-off task with advisory lock | one migrator, visible result |
| Expand now, contract later | rollbacks stay possible |
| GitHub environment `prod` with reviewers | production gate |
| `aws ecs update-service --task-definition <previous>` | rollback |
| Default-off server-side flags | deploy ≠ release |
| Static assets uploaded first, no `--delete` | no broken old clients |
| Grafana annotations, Sentry deploys, DORA metrics | release visibility |

## [05 · Data Safety](05-data-safety/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| RPO / RTO per data store | targets that pick the tools |
| Multi-AZ ≠ backup | availability only |
| RDS PITR, 14–35 days, retained after deletion | main safety net |
| `restore-db-instance-to-point-in-time` | restore beside production |
| Monthly restore drills with checks and timing | proven backups, real RTO |
| Cross-account copies + vault lock | survive account compromise |
| `SET lock_timeout = '5s'` | migrations don't block traffic |
| `CREATE INDEX CONCURRENTLY`, `NOT VALID` + `VALIDATE` | big-table changes without long locks |
| Batched, resumable backfills | no lag, no bloat |
| Deletion protection + `prevent_destroy` + SCPs | no accidental deletes |
| Erasure log replayed after restores | GDPR-safe restores |
| Anonymized staging data | no production data outside production |

## [06 · Incident Response](06-incident-response/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| SEV1–SEV4, declare early | shared urgency |
| Incident commander separate from debuggers | coordinated response |
| One channel per incident with pinned summary | single source of truth |
| "What changed?" first | most incidents follow a change |
| Roll back / flag off before root cause | shortest outages |
| Dashboard → trace → logs by trace ID → Sentry | fast diagnosis |
| `pg_stat_activity`, `pg_blocking_pids()` | database triage |
| Status page outside your infrastructure, scheduled updates | trust during outages |
| Actionable-only paging, weekly rotations | sustainable on-call |
| Runbook per paging alert (`runbook_url`) | fast triage at 3 a.m. |
| Blameless postmortems with owned action items | learning that sticks |
| Security incidents: preserve evidence, GDPR 72 h | different playbook |
