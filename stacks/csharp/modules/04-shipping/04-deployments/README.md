---
title: Deployments
module: 04-shipping
tech: GitHub Actions, Docker, Azure Container Registry, Azure Container Apps, azd
---
# Deployments
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ The deployment pipeline: build once, promote the same image through environments
- [ ] ⭐ Authenticating to Azure from GitHub Actions with OIDC (workload identity federation)
- [ ] ⭐ Building and pushing images to Azure Container Registry with immutable tags and digests
- [ ] ⭐ Deploying to Container Apps: new revisions, revision modes, health probes, waiting for readiness
- [ ] Rolling deployments and rollback with revisions; alert-based rollback
- [ ] Blue/green, canary, and linear deployments
- [ ] Database migrations in the pipeline: EF Core migration bundles, Container Apps jobs, expand/contract
- [ ] Environments and approvals: GitHub environments, protection rules, production gates
- [ ] Feature flags: separating deploy from release, rollouts, kill switches, cleanup
- [ ] Rollbacks: previous revisions, redeploying old images, when migrations block rollback
- [ ] Deploying the Next.js frontend: its own Container App, static assets behind Azure Front Door, version skew
- [ ] Deployment scripts: Azure CLI and PowerShell for one-off and repeatable tasks
- [ ] Release hygiene: versions, changelogs, deploy markers, DORA metrics

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · The pipeline: build once, OIDC, and ACR](docs/01-pipeline-oidc-acr.md)
- [02 · Deploying to Container Apps, rolling updates, and rollbacks](docs/02-container-apps-rollouts-rollbacks.md)
- [03 · Blue/green, canary, and feature flags](docs/03-bluegreen-canary-flags.md)
- [04 · Database migrations, environments, and approvals](docs/04-migrations-environments.md)
- [05 · Frontend deploys, scripts, and release hygiene](docs/05-frontend-scripts-release.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/04-shipping/04-deployments mode=tasks` when you are ready to build._
