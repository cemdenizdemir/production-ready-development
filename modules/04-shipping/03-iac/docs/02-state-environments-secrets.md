---
title: State, environments, and secrets
tech: Terraform, AWS S3
version: Terraform 1.14 (S3 native locking, ephemeral resources, write-only arguments), AWS provider 6.x, random provider 3.7
date: 2026-11-07
covers: [3, 6, 7]
---
# State, environments, and secrets
[← Overview](00-overview.md)

## Why it matters
- State lives on one developer's laptop. They leave the company, and nobody can change production safely any more.
- Two people apply at the same time without a lock. State ends up half-written, and Terraform tries to recreate a running database.
- A `random_password` for the database sits in plaintext in the state file, in a bucket half the company can read.

## Concepts

### What state is
| Fact | Consequence |
|:--|:--|
| Maps configuration addresses to real resource IDs | without it, Terraform doesn't know what it owns |
| Stores every attribute Terraform read or set | including passwords, tokens, private keys |
| Is the base for every plan | stale or corrupted state means wrong plans |
| Must be shared and locked | one writer at a time |

### Remote state in S3
| Practice | How |
|:--|:--|
| Remote backend | `backend "s3"` per environment and component |
| Locking | `use_lockfile = true` (native S3 lock file; no DynamoDB table) |
| Bucket protection | versioning (recover old states), SSE-KMS, Block Public Access, `prevent_destroy` |
| Access | only CI roles and a few admins; read access = secret access |
| Split state | `network`, `data`, `services` per environment: smaller blast radius and faster plans |
| Never edit by hand | refactor with `moved`/`import`/`removed` blocks ([lesson 03](03-workflow-ci-refactoring.md)) |
| Bootstrap | the state buckets and CI roles live in a tiny separate configuration |

### Environments
| Approach | Good for | Watch out |
|:--|:--|:--|
| **Directory per environment** (`envs/dev`, `envs/staging`, `envs/prod`) | separate accounts, backends, and approvals | some repetition in root modules (keep them thin) |
| Workspaces | short-lived copies of one environment (feature stacks) | one backend and role for all; easy to apply to the wrong one |
| Separate repositories | very large organizations | harder to share modules and review changes together |

Each environment's root module calls the same modules with its own sizes and settings, assumes a role in its own account, and has its own state.

### Secrets and state
| Source of secrets in state | Mitigation |
|:--|:--|
| `random_password` resources | `ephemeral "random_password"` + write-only arguments |
| Database master passwords | RDS `manage_master_user_password = true` (password stays in Secrets Manager) |
| Reading secrets with `data` sources | `ephemeral` resources (values never persisted) |
| Secret values in variables | mark `sensitive = true` (hides output only) and pass via CI secrets, or avoid entirely |
| Everything else | treat state as secret: encryption, strict access, no local copies |

`sensitive = true` only hides values in CLI output; they're still in state. OpenTofu can encrypt state itself; Terraform relies on the backend's encryption and access control.

## Example
`infra/envs/prod/backend.tf`
```hcl
terraform {
  backend "s3" {
    bucket       = "shop-terraform-state-prod"
    key          = "services/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true        # native S3 locking (Terraform 1.10+)
  }
}
```
`infra/bootstrap/state.tf` — applied once by an admin, per account.
```hcl
resource "aws_s3_bucket" "state" {
  bucket = "shop-terraform-state-prod"
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.state.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```
`infra/envs/prod/providers.tf` — each environment assumes a role in its own account.
```hcl
provider "aws" {
  region = "eu-central-1"
  assume_role {
    role_arn = "arn:aws:iam::222222222222:role/terraform-deploy"
  }
  default_tags {
    tags = { Environment = "prod", Service = "shop", ManagedBy = "terraform" }
  }
}
```
The layout:
```text
infra/
  bootstrap/          state buckets, KMS keys, GitHub OIDC provider, CI roles
  modules/
    network/  ecs-service/  data/  cdn/
  envs/
    dev/       backend.tf  providers.tf  main.tf  terraform.tfvars
    staging/   …
    prod/      …
```
A generated secret that never touches state:
```hcl
ephemeral "random_password" "db_app" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_app" {
  name = "prod/shop/db-app-password"
}

resource "aws_secretsmanager_secret_version" "db_app" {
  secret_id                = aws_secretsmanager_secret.db_app.id
  secret_string_wo         = ephemeral.random_password.db_app.result   # write-only: sent to AWS, not stored
  secret_string_wo_version = 1                                          # bump to rotate
}
```

## Production patterns
- **Remote, versioned, encrypted, locked state** per environment and component, readable only by CI and admins.
- **Directory per environment**, thin root modules, one AWS account and role per environment.
- **Secrets kept out of state**: RDS-managed passwords, ephemeral resources, write-only arguments.
- **A separate bootstrap configuration** for state buckets and CI roles, changed rarely and carefully.
- **No local state, no hand edits**; refactors through blocks in reviewed code.

## Mistakes
Wrong: local state or state in git.
```bash
git add terraform.tfstate   # secrets in history forever, no locking, conflicts
```
Right: the S3 backend with locking; `*.tfstate*` in `.gitignore`.

Wrong: workspaces for dev and prod in one account with one role. One wrong `terraform workspace select` and dev changes hit production. Right: directories, accounts, and roles per environment.

Wrong: believing `sensitive = true` protects secrets. It only hides CLI output. Right: keep secrets out of state, and protect state like a secret.

Wrong: one giant state for everything. Every plan takes minutes and every apply risks everything. Right: split by component and environment.

## Check yourself
1. Why must state be locked, and how does the S3 backend do it now?
2. Why use a directory per environment instead of workspaces?
3. Name two ways to keep a database password out of Terraform state.

<details>
<summary>Answers</summary>

1. Two concurrent applies could both read the same state and write conflicting results, corrupting it. With `use_lockfile = true`, Terraform creates a lock object next to the state in S3 using conditional writes; a second run fails to get the lock and waits or errors.
2. Directories give each environment its own backend, AWS account, role, variables, and approval path, so a mistake in one can't reach another. Workspaces share one configuration, backend, and usually one set of credentials, which makes cross-environment accidents easy.
3. Let RDS manage the master password (`manage_master_user_password = true`), or generate passwords with an `ephemeral` resource and pass them through write-only arguments (`secret_string_wo`, `password_wo`). Neither value is persisted in state.
</details>

## Sources
- [Terraform — State](https://developer.hashicorp.com/terraform/language/state)
- [Terraform — S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [Terraform — Ephemeral resources](https://developer.hashicorp.com/terraform/language/resources/ephemeral)
- [Terraform — Write-only arguments](https://developer.hashicorp.com/terraform/language/resources/ephemeral/write-only)
- [Terraform — Workspaces](https://developer.hashicorp.com/terraform/language/state/workspaces)
- [OpenTofu — State encryption](https://opentofu.org/docs/language/state/encryption/)
