---
title: Guardrails, drift, testing, and the OpenTofu exit
tech: Terraform, GitHub Actions
version: Terraform 1.14 (terraform test with mock providers, check blocks), OpenTofu 1.10+
date: 2026-11-07
covers: [9, 11, 12]
---
# Guardrails, drift, testing, and the OpenTofu exit
[← Overview](00-overview.md)

## Why it matters
- During an incident someone raises a security group rule in the console. Two weeks later a routine apply silently removes it and the incident repeats.
- A module change makes every service public. Nothing checked it, and the plan was 400 lines long.
- The team adopts a brand-new Terraform-only feature, and the option to move to OpenTofu, recorded in STACK.md, quietly disappears.

## Concepts

### Guardrails in code
| Guardrail | Use |
|:--|:--|
| `lifecycle { prevent_destroy = true }` | Terraform refuses to destroy databases, state buckets, key vaults |
| AWS-side protection | RDS `deletion_protection`, S3 versioning/Object Lock: protection even outside Terraform |
| `ignore_changes` | attributes owned by something else (task definition revisions, desired count) |
| `create_before_destroy` | replacements without downtime (certificates, launch configurations) |
| Variable `validation` | reject bad inputs at plan time |
| `precondition` / `postcondition` | assumptions about data sources and results |
| `check` blocks | continuous assertions reported on every plan/apply (endpoints, certificate expiry) |

### Linting and policy
| Tool | Checks |
|:--|:--|
| `terraform fmt -check` | formatting |
| `terraform validate` | syntax, types, references |
| tflint + AWS ruleset (also seen) | invalid instance types, deprecated syntax, naming |
| Checkov / Trivy config scan (also seen) | public buckets, open security groups, missing encryption |
| Plan review checklist | destroys, replacements, IAM changes, security groups, public access |

### Drift
Drift is any difference between code and reality, usually from console changes or other tools.
| Practice | How |
|:--|:--|
| Detect | scheduled `terraform plan -detailed-exitcode` (exit code 2 = changes) per environment, alert on drift |
| Prevent | read-only console access in production; changes go through PRs |
| Emergencies | break-glass change, then codify it in a PR the same day |

### Testing infrastructure code
| Level | Tool |
|:--|:--|
| Static | `fmt`, `validate`, linters, policy scanners |
| Unit (modules) | `terraform test` with `mock_provider`: assertions on plans, no AWS account needed |
| Integration | `terraform test` with real applies in a sandbox account (also seen: Terratest) |
| Environment | staging applies first; smoke checks after every apply |

### Keeping the OpenTofu exit open
| Safe (both tools) | Avoid (Terraform-only) | Also avoid (OpenTofu-only) |
|:--|:--|:--|
| core language, providers, modules | HCP Terraform `cloud {}` block and remote runs | state encryption settings |
| S3 backend with `use_lockfile` | Terraform Stacks | `for_each` on provider blocks |
| `moved`, `import`, `removed`, `check` | `action` blocks (1.14) | OpenTofu-specific language extensions |
| `terraform test` / `tofu test` | list resources and `terraform query` (1.14) | |

Before adopting a new feature, check the other tool's docs. Switching later is then mostly `tofu init -migrate-state` and testing.

## Example
`infra/modules/ecs-service/tests/service.tftest.hcl` — unit tests without AWS.
```hcl
mock_provider "aws" {}

variables {
  name        = "api"
  cluster_arn = "arn:aws:ecs:eu-central-1:123456789012:cluster/test"
  subnet_ids  = ["subnet-1", "subnet-2"]
}

run "services_are_private" {
  command = plan
  assert {
    condition     = aws_ecs_service.this.network_configuration[0].assign_public_ip == false
    error_message = "Services must not get public IPs."
  }
}

run "log_retention_is_set" {
  command = plan
  assert {
    condition     = aws_cloudwatch_log_group.this.retention_in_days > 0
    error_message = "Log groups need a retention period."
  }
}

run "rejects_invalid_cpu" {
  command = plan
  variables {
    cpu = 300
  }
  expect_failures = [var.cpu]
}
```
```bash
cd infra/modules/ecs-service && terraform init && terraform test
```
A `check` block — reported on every plan and apply, without blocking them.
```hcl
check "api_is_healthy" {
  data "http" "ready" {
    url = "https://api.shop.com/health/ready"
  }
  assert {
    condition     = data.http.ready.status_code == 200
    error_message = "api.shop.com/health/ready did not return 200."
  }
}
```
`.github/workflows/terraform-drift.yml` — nightly drift detection.
```yaml
name: terraform-drift
on:
  schedule:
    - cron: '0 5 * * 1-5'
permissions:
  contents: read
  id-token: write
jobs:
  drift:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infra/envs/prod
    steps:
      - uses: actions/checkout@<40-char-commit-sha>
      - uses: hashicorp/setup-terraform@<40-char-commit-sha>
      - uses: aws-actions/configure-aws-credentials@<40-char-commit-sha>
        with:
          role-to-assume: arn:aws:iam::222222222222:role/terraform-plan
          aws-region: eu-central-1
      - run: terraform init -input=false
      - id: plan
        run: terraform plan -input=false -lock=false -detailed-exitcode
        continue-on-error: true
      - if: steps.plan.outputs.exitcode == '2'
        run: |
          echo "::error::Drift detected in prod: reality differs from code"
          exit 1
```

## Production patterns
- **Two layers of protection** for stateful resources: `prevent_destroy` in code and deletion protection in AWS.
- **Static checks, module tests, and policy scans on every PR**; staging applies before production.
- **Nightly drift detection** with alerts, and read-only console access in production.
- **`check` blocks** for things that should always be true after an apply.
- **Features chosen from the common subset** of Terraform and OpenTofu, verified when adopting anything new.

## Mistakes
Wrong: relying on reviewers to spot a dangerous change in a long plan. Right: `prevent_destroy`, policy scans, and tests that fail automatically.

Wrong: fixing production in the console and moving on. The next apply reverts it, or drift hides real problems. Right: codify every emergency change the same day; detect drift nightly.

Wrong: no tests for shared modules. A change to defaults affects every service at once. Right: `terraform test` with mock providers for the rules that matter.

Wrong: adopting Terraform-only features casually. The recorded exit to OpenTofu disappears without a decision. Right: check compatibility first; record exceptions as ADRs.

## Check yourself
1. What's the difference between `prevent_destroy` and RDS deletion protection, and why use both?
2. How does a drift check decide that something changed?
3. What can `terraform test` with a mock provider verify, and what can't it?

<details>
<summary>Answers</summary>

1. `prevent_destroy` makes Terraform refuse any plan that destroys the resource; it only protects against Terraform. Deletion protection is enforced by AWS, so it also stops console clicks, scripts, and other tools. Together they cover both paths.
2. It runs `terraform plan -detailed-exitcode`: exit code 0 means no changes, 1 an error, 2 that the plan contains changes, meaning reality and code differ. The job fails and alerts on 2.
3. It verifies module logic: computed values, conditions, variable validation, which resources and settings the plan would produce. It can't verify that AWS accepts the configuration or that resources behave correctly at runtime; that needs integration tests with real applies in a sandbox account.
</details>

## Sources
- [Terraform — Tests](https://developer.hashicorp.com/terraform/language/tests)
- [Terraform — Mocks](https://developer.hashicorp.com/terraform/language/tests/mocking)
- [Terraform — Checks](https://developer.hashicorp.com/terraform/language/checks)
- [Terraform — The lifecycle meta-argument](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle)
- [OpenTofu — Migrating from Terraform](https://opentofu.org/docs/intro/migration/)
