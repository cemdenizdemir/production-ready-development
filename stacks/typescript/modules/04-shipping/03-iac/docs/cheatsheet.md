---
title: Infrastructure as Code cheatsheet
tech: Terraform
version: Terraform 1.14, AWS provider 6.x, S3 backend (use_lockfile), OpenTofu-compatible subset
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Infrastructure as Code cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Language
| Construct | Use |
|:--|:--|
| ⭐ `terraform { required_version, required_providers, backend }` | pins and backend |
| ⭐ `resource "type" "name" { }` | managed infrastructure |
| `data "type" "name" { }` | read existing things |
| ⭐ `variable` + `validation` | typed, checked inputs |
| `output` | values for callers |
| `locals` | named expressions |
| ⭐ `module "x" { source, version }` | reuse |
| ⭐ `for_each` | one instance per map key |
| `count` | numeric repetition (avoid for named things) |
| `dynamic "block" { for_each, content }` | optional nested blocks |
| `try(expr, fallback)` | safe lookups |
| `depends_on` | rare explicit dependency |

## Lifecycle
| Setting | Use |
|:--|:--|
| ⭐ `prevent_destroy = true` | refuse to destroy |
| ⭐ `ignore_changes = [task_definition, desired_count]` | attributes owned elsewhere |
| `create_before_destroy = true` | replacement without downtime |
| `replace_triggered_by` | replace when something else changes |
| `precondition` / `postcondition` | assumptions and guarantees |

## Commands
| Command | Use |
|:--|:--|
| ⭐ `terraform init` | providers, modules, backend |
| `terraform init -upgrade` | update within version constraints |
| ⭐ `terraform fmt -recursive` / `-check` | formatting |
| ⭐ `terraform validate` | syntax and types |
| ⭐ `terraform plan -out=tfplan` | saved plan |
| ⭐ `terraform apply tfplan` | apply exactly that plan |
| `terraform plan -detailed-exitcode` | 0 none, 1 error, 2 changes |
| `terraform plan -generate-config-out=generated.tf` | draft code for imports |
| `terraform show tfplan` | readable plan |
| `terraform output` | outputs |
| ⭐ `terraform test` | module tests |
| `terraform state list` / `show` | inspect state |
| `terraform providers lock -platform=…` | lock file for several platforms |
| `-target=…` | emergencies only |

## Plan symbols
| Symbol | Meaning |
|:--|:--|
| `+` | create |
| `~` | update in place |
| ⭐ `-/+` | destroy and recreate |
| ⭐ `-` | destroy |
| `<=` | read data source |

## Modules
| Practice | Detail |
|:--|:--|
| Files | `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, `README.md` |
| ⭐ Small and focused | network, ecs-service, data, cdn |
| ⭐ Pinned versions | registry `version` or `?ref=v1.4.0` |
| No provider blocks inside | root configures providers |
| Community | `terraform-aws-modules/vpc/aws`, `…/alb/aws`, `…/rds/aws` |

## State
| Practice | How |
|:--|:--|
| ⭐ Remote | `backend "s3"` |
| ⭐ Locking | `use_lockfile = true` (DynamoDB locking deprecated) |
| ⭐ Bucket | versioning, SSE-KMS, Block Public Access, `prevent_destroy` |
| ⭐ Access | CI roles and admins only: state = secrets |
| Split | per environment and component |
| Never | local state, state in git, hand edits |
| Bootstrap | separate config for buckets, OIDC provider, CI roles |

## Environments
| Approach | Use |
|:--|:--|
| ⭐ Directory per environment | `envs/dev`, `envs/staging`, `envs/prod` |
| Account per environment | `assume_role { role_arn = … }` in the provider |
| `default_tags` | tags on every resource |
| `terraform.tfvars` | environment values (no secrets) |
| Workspaces | short-lived copies only |

## Secrets
| Technique | Detail |
|:--|:--|
| ⭐ `manage_master_user_password = true` | RDS password not in state |
| ⭐ `ephemeral "random_password"` | generated, never stored |
| ⭐ Write-only args (`secret_string_wo`, `password_wo` + `_version`) | sent, not stored |
| `ephemeral` data reads | read secrets without persisting |
| `sensitive = true` | hides output only |
| State encryption | OpenTofu-only feature |

## CI with OIDC
| Piece | Setting |
|:--|:--|
| ⭐ OIDC provider | `token.actions.githubusercontent.com`, aud `sts.amazonaws.com` |
| ⭐ Plan role | read-only, `sub` `repo:org/repo:pull_request` |
| ⭐ Apply role | write, `sub` `repo:org/repo:environment:prod` |
| Permissions | `id-token: write`, `contents: read` |
| Actions | `hashicorp/setup-terraform`, `aws-actions/configure-aws-credentials` (pinned SHAs) |
| ⭐ Environments | prod requires reviewers |
| Concurrency | `terraform-<env>` |
| Plan output | `$GITHUB_STEP_SUMMARY` or PR comment |

## Refactoring blocks
| Block | Use |
|:--|:--|
| ⭐ `moved { from = …, to = … }` | rename / move into a module |
| ⭐ `import { to = …, id = "…" }` | adopt existing resources |
| ⭐ `removed { from = …; lifecycle { destroy = false } }` | stop managing without deleting |
| `terraform state mv` / `rm` | legacy CLI equivalents |

## Guardrails and policy
| Tool | Checks |
|:--|:--|
| ⭐ `prevent_destroy` + AWS deletion protection | double protection |
| `check "name" { data …; assert { … } }` | continuous assertions |
| tflint (also seen) | provider-aware linting |
| Checkov / Trivy (also seen) | misconfigurations |
| Plan review checklist | destroys, replacements, IAM, SGs, public access |

## Drift
| Practice | How |
|:--|:--|
| ⭐ Nightly plan | `-detailed-exitcode`, alert on exit 2 |
| `-lock=false` | read-only drift checks don't block applies |
| Prevent | read-only console in prod |
| Emergency changes | codify the same day |

## Testing
| Level | Tool |
|:--|:--|
| Static | `fmt`, `validate`, linters |
| ⭐ Unit | `terraform test` + `mock_provider "aws" {}` |
| `run { command = plan; assert { … } }` | plan assertions |
| `expect_failures = [var.cpu]` | validation tests |
| Integration | real applies in a sandbox (Terratest also seen) |

## OpenTofu compatibility
| Status | Features |
|:--|:--|
| ⭐ Safe | core language, providers, modules, S3 `use_lockfile`, `moved`/`import`/`removed`/`check`, tests |
| Avoid (Terraform-only) | `cloud {}`, Stacks, `action` blocks, list/query (1.14) |
| Avoid (OpenTofu-only) | state encryption, provider `for_each` |
| Migration | `tofu init -migrate-state`, then plan and test |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `count` over names | removals shift indexes, replacements | `for_each` |
| Unpinned providers | surprise major upgrades | `~> 6.0` + lock file |
| Applying from laptops | unreviewed changes | CI only |
| Reading the diff, not the plan | hidden `-/+` | review plans |
| `sensitive = true` as protection | still in state | keep secrets out |
| Workspaces for prod/dev | wrong workspace = prod change | directories + accounts |
| Terraform and CI both own task defs | rollbacks on apply | `ignore_changes` |
| Console hotfixes | reverted on next apply | codify, detect drift |
| `-target` habit | partial, inconsistent applies | full plans |
| Terraform-only features | OpenTofu exit lost | check compatibility |

## Sources
| Source | Link |
|:--|:--|
| Terraform language | https://developer.hashicorp.com/terraform/language |
| S3 backend | https://developer.hashicorp.com/terraform/language/backend/s3 |
| Ephemeral resources | https://developer.hashicorp.com/terraform/language/resources/ephemeral |
| Refactoring (moved) | https://developer.hashicorp.com/terraform/language/modules/develop/refactoring |
| Tests | https://developer.hashicorp.com/terraform/language/tests |
| GitHub OIDC with AWS | https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services |
| OpenTofu | https://opentofu.org/docs/ |
