---
title: Infrastructure as Code
module: 04-shipping
tech: Terraform
---
# Infrastructure as Code
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Why infrastructure as code: reviewable, repeatable, recoverable, drift visible
- [ ] ⭐ Terraform basics: providers, resources, data sources, variables, outputs, locals, `for_each`
- [ ] ⭐ State: remote state in S3 with native locking, protecting state, never editing it by hand
- [ ] ⭐ The plan and apply workflow: plans in PRs, applies from CI, reading plans
- [ ] Modules: structure, typed inputs, outputs, versioning, community modules
- [ ] Environments: directory and account per environment, provider roles, default tags
- [ ] Secrets and state: managed passwords, ephemeral resources, write-only arguments
- [ ] Refactoring safely: `moved`, `import`, and `removed` blocks
- [ ] Guardrails and drift: `prevent_destroy`, `check` blocks, policy scans, nightly drift plans
- [ ] Terraform in CI with GitHub Actions and OIDC: plan and apply roles, approvals
- [ ] Keeping the OpenTofu exit open: the compatible feature subset
- [ ] Testing infrastructure code: `terraform test` with mock providers, integration tests

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Terraform basics and modules](docs/01-basics-and-modules.md)
- [02 · State, environments, and secrets](docs/02-state-environments-secrets.md)
- [03 · The plan/apply workflow, CI, and refactoring](docs/03-workflow-ci-refactoring.md)
- [04 · Guardrails, drift, testing, and the OpenTofu exit](docs/04-guardrails-testing-opentofu.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 04-shipping/03-iac mode=tasks` when you are ready to build._
