---
title: Deployments
module: 04-shipping
tech: GitHub Actions, Docker, AWS ECS
---
# Deployments
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ The deployment pipeline: build once, promote the same image through environments
- [ ] ⭐ Authenticating to AWS from GitHub Actions with OIDC
- [ ] ⭐ Building and pushing images to ECR with immutable tags and digests
- [ ] ⭐ Deploying to ECS: new task definition revision, service update, waiting for stability
- [ ] Rolling deployments, the deployment circuit breaker, alarm-based rollback
- [ ] Blue/green, canary, and linear deployments
- [ ] Database migrations in the pipeline: one-off tasks, locks, expand/contract
- [ ] Environments and approvals: GitHub environments, protection rules, production gates
- [ ] Feature flags: separating deploy from release, rollouts, kill switches, cleanup
- [ ] Rollbacks: previous revisions, redeploying old images, when migrations block rollback
- [ ] Deploying the Next.js frontend: static assets on S3/CloudFront, version skew, shared keys
- [ ] Release hygiene: versions, changelogs, deploy markers, DORA metrics

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · The pipeline, OIDC, and ECR](docs/01-pipeline-oidc-ecr.md)
- [02 · Deploying to ECS: rolling, circuit breaker, blue/green](docs/02-ecs-deploy-strategies.md)
- [03 · Migrations, environments, and rollbacks](docs/03-migrations-environments-rollbacks.md)
- [04 · Feature flags, frontend deploys, and release hygiene](docs/04-flags-frontend-releases.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 04-shipping/04-deployments mode=tasks` when you are ready to build._
