---
title: CI/CD
module: 01-foundations
tech: GitHub Actions, pnpm, Docker
---
# CI/CD
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ CI vs continuous delivery vs continuous deployment, and what a pipeline is for
- [ ] ⭐ GitHub Actions anatomy: workflows, triggers, jobs, steps, runners
- [ ] ⭐ A fast PR pipeline: install, typecheck, lint, test, build, with caching
- [ ] pnpm in CI: `--frozen-lockfile`, store caching, `pnpm/action-setup`
- [ ] Matrix builds, job dependencies (`needs`), and concurrency groups
- [ ] ⭐ Secrets, variables, and OIDC instead of long-lived cloud keys
- [ ] ⭐ Hardened workflows: least-privilege `permissions`, SHA-pinned actions, no script injection
- [ ] Building and pushing Docker images in CI: Buildx, layer cache, SHA tags, provenance
- [ ] Reusable workflows and composite actions
- [ ] ⭐ Required checks, merge queue, and keeping main green
- [ ] Environments, approvals, and promotion: preview → staging → production
- [ ] Pipeline speed and cost: caching, path filters, cancel-in-progress, artifacts

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Pipelines and GitHub Actions anatomy](docs/01-pipelines-and-actions.md)
- [02 · A fast PR pipeline with pnpm](docs/02-fast-pr-pipeline.md)
- [03 · Secrets, OIDC, and hardened workflows](docs/03-secure-workflows.md)
- [04 · Docker images and reusable workflows](docs/04-docker-and-reuse.md)
- [05 · Green main, environments, and approvals](docs/05-green-main-and-environments.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn typescript/01-foundations/04-ci-cd mode=tasks` when you are ready to build._
