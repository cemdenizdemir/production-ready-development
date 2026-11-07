---
title: Deployments cheatsheet
tech: GitHub Actions, Docker, AWS ECS
version: GitHub Actions (OIDC, environments), Docker Buildx, Amazon ECR, Amazon ECS deployments, drizzle-orm migrator, Next.js 16
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Deployments cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Pipeline shape
| Stage | Detail |
|:--|:--|
| ⭐ Build once | test, scan, push `sha-<git sha>` on `main` |
| Migrate staging | one-off task, expand-only |
| ⭐ Deploy staging | same digest, wait for stability |
| Smoke tests | k6 smoke, Playwright happy path |
| ⭐ Approval | GitHub environment `prod` |
| Migrate + deploy prod | same digest |
| Mark | Grafana annotation, Sentry deploy, team notification |

## OIDC to AWS
| Item | Value |
|:--|:--|
| ⭐ Permission | `id-token: write` |
| Provider | `token.actions.githubusercontent.com`, aud `sts.amazonaws.com` |
| ⭐ `sub` for main | `repo:org/repo:ref:refs/heads/main` |
| ⭐ `sub` for environment | `repo:org/repo:environment:prod` |
| `sub` for PRs | `repo:org/repo:pull_request` |
| Action | `aws-actions/configure-aws-credentials` with `role-to-assume` |
| Roles | `ecr-push`, `deploy-staging`, `deploy-prod` |

## Actions used
| Action | Use |
|:--|:--|
| `aws-actions/amazon-ecr-login` | registry login |
| `docker/setup-buildx-action` | BuildKit |
| ⭐ `docker/build-push-action` | build, cache, push; `outputs.digest` |
| ⭐ `aws-actions/amazon-ecs-render-task-definition` | put the image into a task definition |
| ⭐ `aws-actions/amazon-ecs-deploy-task-definition` | register + update service, `wait-for-service-stability` |
| Pinning | every action by 40-char commit SHA |

## Workflow settings
| Setting | Use |
|:--|:--|
| ⭐ `concurrency: { group: deploy-main, cancel-in-progress: false }` | queue deploys, never cancel |
| ⭐ `environment: prod` | approvals, env vars and secrets |
| `needs.build.outputs.image` | pass the digest between jobs |
| `workflow_dispatch` with `sha` input | redeploy an old image (rollback) |
| `runs-on: ubuntu-24.04-arm` | native arm64 builds |

## ECR
| Setting | Value |
|:--|:--|
| ⭐ `image_tag_mutability = "IMMUTABLE"` | tags can't move |
| Scan on push | enhanced scanning |
| Lifecycle policy | expire untagged, keep last N |
| Repository policy | cross-account pulls |

## ECS deployment settings
| Setting | Value |
|:--|:--|
| ⭐ `deployment_minimum_healthy_percent` | 100 |
| ⭐ `deployment_maximum_percent` | 200 |
| ⭐ Circuit breaker | `enable = true`, `rollback = true` |
| Alarm rollback | `alarms { enable, rollback, alarm_names }` |
| `health_check_grace_period_seconds` | 30–90 |
| ALB deregistration delay | 30–60 s |

## Strategies
| Strategy | Use |
|:--|:--|
| ⭐ Rolling | default |
| Blue/green (ECS built-in) | instant switch and rollback, bake time |
| Canary | small % first |
| Linear | equal steps |
| ⭐ Flags | release separately from deploy |

## Deploy failure reasons
| Message | Cause |
|:--|:--|
| Essential container exited | crash on boot (config, secrets, code) |
| Health checks failed | port/path, slow boot, readiness |
| `CannotPullContainerError` | image ref, ECR permissions, network |
| `ResourceInitializationError` | secrets fetch failed (role, endpoint/NAT) |
| `OutOfMemoryError` | task memory too small |

## Diagnosing commands
| Command | Shows |
|:--|:--|
| ⭐ `aws ecs describe-services … --query 'services[0].deployments'` | rollout state |
| `… --query 'services[0].events[:10].message'` | recent service events |
| `aws ecs list-tasks --desired-status STOPPED` | stopped tasks |
| ⭐ `aws ecs describe-tasks --tasks <arn>` | `stoppedReason`, exit codes |
| `aws ecs wait services-stable` | block until stable |

## Migrations
| Rule | Detail |
|:--|:--|
| ⭐ Separate step before deploy | one-off ECS task, release image |
| ⭐ `pg_advisory_lock` + `lock_timeout` | one migrator, no hanging |
| Migration role | DDL; app role can't change schema |
| ⭐ Expand only | previous version keeps working |
| Contract later | drop in a later release |
| Runner | `migrate(drizzle({ client }), { migrationsFolder })` from `drizzle-orm/node-postgres/migrator` |
| Exit code check | `aws ecs wait tasks-stopped` + `describe-tasks` |
| avoid | migrating at app startup |

## Expand/contract rename
| Release | Change |
|:--|:--|
| 1 | add new column; write both |
| 2 | backfill; read new |
| 3 | stop writing old |
| 4 | drop old column |

## GitHub environments
| Feature | Use |
|:--|:--|
| ⭐ Required reviewers | prod approval |
| ⭐ Deployment branches | `main` only |
| Wait timer | optional delay |
| Env vars/secrets | role ARNs, clusters |
| History | who deployed what |

## Rollbacks
| Option | Speed |
|:--|:--|
| ⭐ Flag off | seconds |
| Circuit breaker | automatic during deploy |
| ⭐ Previous revision: `aws ecs update-service --task-definition shop-api:41` | minutes |
| Pipeline redeploy of an old SHA | minutes |
| Roll forward | tens of minutes |
| Restore data | last resort |

## Feature flags
| Practice | Detail |
|:--|:--|
| ⭐ Types | release, ops/kill switch, experiment, permission |
| ⭐ Default off, server-side | safe when unknown |
| Sticky rollout | hash `flag:userId` % 100 |
| Owner + removal date | flags are debt |
| Tools | table/Parameter Store; Unleash, Flagsmith, LaunchDarkly, OpenFeature (also seen) |

## Next.js deploys
| Step | Detail |
|:--|:--|
| ⭐ Upload `.next/static` first | `aws s3 sync … --cache-control "public, max-age=31536000, immutable"` |
| ⭐ No `--delete` | old clients need old chunks |
| `assetPrefix` | CDN URL |
| `deploymentId` | version skew detection |
| ⭐ `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | same on all instances |
| `NEXT_PUBLIC_*` | build-time, same everywhere |

## Release hygiene
| Practice | Tool |
|:--|:--|
| Version | git SHA (services), semver (libraries) |
| Changelog | Conventional Commits; Release Please/Changesets (also seen) |
| ⭐ Deploy markers | Grafana `POST /api/annotations`, `sentry-cli releases deploys` |
| Notifications | team channel |

## DORA metrics
| Metric | Measures |
|:--|:--|
| ⭐ Deployment frequency | how often |
| ⭐ Lead time for changes | commit → production |
| ⭐ Change failure rate | deploys causing problems |
| ⭐ Failed deployment recovery time | time to restore |
| Rework rate | unplanned fix deploys |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Rebuilding per environment | prod runs untested bytes | promote the digest |
| Static AWS keys in CI | leak = account access | OIDC |
| Loose `sub` conditions | any branch can deploy | exact repo + environment |
| `cancel-in-progress: true` | half-finished deploys | queue |
| Not waiting for stability | green pipeline, broken prod | `wait-for-service-stability` |
| `minimumHealthyPercent: 0` | outage on each deploy | 100/200 |
| Migrations at startup | races, slow boots | one-off task |
| Destructive migration with the code change | no rollback, broken old tasks | expand/contract |
| `s3 sync --delete` for assets | old clients break | keep old assets |
| Flags never removed | dead code | removal dates |

## Sources
| Source | Link |
|:--|:--|
| GitHub OIDC in AWS | https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services |
| GitHub environments | https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment |
| ECS deployment types | https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-types.html |
| ECS circuit breaker | https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html |
| amazon-ecs-deploy-task-definition | https://github.com/aws-actions/amazon-ecs-deploy-task-definition |
| Feature toggles | https://martinfowler.com/articles/feature-toggles.html |
| DORA metrics | https://dora.dev/guides/dora-metrics-four-keys/ |
