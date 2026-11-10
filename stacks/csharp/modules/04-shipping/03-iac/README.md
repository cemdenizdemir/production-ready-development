---
title: Infrastructure as Code
module: 04-shipping
tech: Bicep, Azure Developer CLI (azd), GitHub Actions
---
# Infrastructure as Code
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Why infrastructure as code: reviewable, repeatable, recoverable, drift visible
- [ ] ⭐ Bicep basics: resources, parameters, variables, outputs, loops, conditions, `existing` resources
- [ ] ⭐ State in Bicep: no state file, Azure Resource Manager as the source of truth, incremental deployments, deployment stacks
- [ ] ⭐ The what-if and deploy workflow: what-if in PRs, deployments from CI, reading the diff
- [ ] Modules: structure, typed parameters and user-defined types, outputs, Azure Verified Modules, registries
- [ ] Environments: `.bicepparam` files, a subscription or resource group per environment, tags
- [ ] Secrets and IaC: `@secure()` parameters, Key Vault references, managed identities instead of passwords
- [ ] Refactoring safely: renaming and moving resources without deleting them; deployment stacks and deny settings
- [ ] Guardrails and drift: resource locks, Azure Policy, the Bicep linter, scheduled what-if runs
- [ ] Bicep in CI with GitHub Actions and OIDC: workload identity federation, approvals
- [ ] ⭐ The Azure Developer CLI: `azd init`, `azd up`, environments, and the Bicep it generates
- [ ] Testing infrastructure code: linting, what-if checks, PSRule for Azure, test deployments
- [ ] Bicep vs Terraform: what transfers, and when Terraform wins

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Why IaC and Bicep basics](docs/01-why-bicep-basics.md)
- [02 · State, what-if, deployment stacks, and safe refactoring](docs/02-state-whatif-stacks.md)
- [03 · Modules, environments, and secrets](docs/03-modules-environments-secrets.md)
- [04 · CI with OIDC, guardrails, and testing](docs/04-ci-guardrails-testing.md)
- [05 · The Azure Developer CLI and Bicep vs Terraform](docs/05-azd-terraform.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/04-shipping/03-iac mode=tasks` when you are ready to build._
