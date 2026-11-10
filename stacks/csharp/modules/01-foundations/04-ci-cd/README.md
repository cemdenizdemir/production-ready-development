---
title: CI/CD
module: 01-foundations
tech: GitHub Actions, .NET 10 SDK, pnpm, Docker
---
# CI/CD
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ CI vs continuous delivery vs continuous deployment, and what a pipeline is for
- [ ] ⭐ GitHub Actions anatomy: workflows, triggers, jobs, steps, runners
- [ ] ⭐ A fast PR pipeline: restore, build, format check, test, publish, with caching
- [ ] ⭐ .NET in CI: `actions/setup-dotnet`, `global.json`, NuGet lock files in locked mode, NuGet cache
- [ ] pnpm in CI: `--frozen-lockfile`, store caching, `pnpm/action-setup`
- [ ] Matrix builds, job dependencies (`needs`), and concurrency groups
- [ ] ⭐ Secrets, variables, and OIDC instead of long-lived cloud keys
- [ ] ⭐ Hardened workflows: least-privilege `permissions`, SHA-pinned actions, no script injection
- [ ] Building and pushing Docker images in CI: Buildx, layer cache, SHA tags, provenance
- [ ] Reusable workflows and composite actions
- [ ] ⭐ Required checks, merge queue, and keeping main green
- [ ] Environments, approvals, and promotion: preview → staging → production
- [ ] Pipeline speed and cost: caching, path filters, cancel-in-progress, artifacts
- [ ] Reading Azure Pipelines YAML: stages, jobs, templates, service connections; mapping it to GitHub Actions

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Pipelines and GitHub Actions anatomy](docs/01-pipelines-actions-anatomy.md)
- [02 · A fast PR pipeline for .NET and pnpm](docs/02-fast-pr-pipeline.md)
- [03 · Matrix builds, reuse, and required checks](docs/03-matrix-reuse-required-checks.md)
- [04 · Secrets, OIDC to Azure, and hardened workflows](docs/04-secrets-oidc-hardening.md)
- [05 · Images, environments, promotion, and Azure Pipelines](docs/05-images-environments-azure-pipelines.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/01-foundations/04-ci-cd mode=tasks` when you are ready to build._
