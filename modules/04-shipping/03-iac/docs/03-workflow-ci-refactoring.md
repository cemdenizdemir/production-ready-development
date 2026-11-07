---
title: The plan/apply workflow, CI, and refactoring
tech: Terraform, GitHub Actions, AWS IAM
version: Terraform 1.14, hashicorp/setup-terraform, aws-actions/configure-aws-credentials (OIDC), import/moved/removed blocks
date: 2026-11-07
covers: [4, 8, 10]
---
# The plan/apply workflow, CI, and refactoring
[← Overview](00-overview.md)

## Why it matters
- Someone applies from a laptop with uncommitted changes. Production now matches code that exists nowhere else.
- A reviewer approves a PR that renames a resource. Nobody read the plan: `-/+ destroy and then create replacement` on the production database.
- A bucket created by hand years ago has to come under Terraform. Someone deletes and recreates it, losing its objects.

## Concepts

### The workflow
| Step | Where | What |
|:--|:--|:--|
| 1. Change | branch + PR | `.tf` changes only |
| 2. Check | CI on the PR | `fmt -check`, `validate`, `terraform test`, linters |
| 3. Plan | CI on the PR | plan per affected environment, shown in the job summary or a PR comment |
| 4. Review | humans | read the plan, not just the diff |
| 5. Apply | CI after merge | staging automatically, production after an environment approval |
| 6. Verify | CI / humans | smoke checks; next plan shows "No changes" |

| Plan symbol | Meaning | Reaction |
|:--|:--|:--|
| `+` | create | fine |
| `~` | update in place | check what |
| `-/+` | destroy and recreate | stop and check: data loss or downtime? |
| `-` | destroy | must be intended |
| `<=` | read (data source) | fine |

Only CI applies to shared environments. Laptops can run `plan` with a read-only role. `-target` is for emergencies, never for routine work.

### CI with OIDC
| Piece | Setting |
|:--|:--|
| GitHub OIDC provider in each account | `token.actions.githubusercontent.com`, audience `sts.amazonaws.com` |
| Plan role | read-only; trust `sub` = `repo:acme/shop:pull_request` |
| Apply role | write; trust `sub` = `repo:acme/shop:environment:prod` |
| Workflow permissions | `id-token: write`, `contents: read` |
| Environments | `staging` (auto), `prod` (required reviewers) |
| Concurrency | one apply per environment at a time |

### Refactoring safely
| Block | Use |
|:--|:--|
| `moved { from, to }` | rename a resource or move it into a module, without recreating it |
| `import { to, id }` | adopt an existing resource; `terraform plan -generate-config-out=generated.tf` drafts the code |
| `removed { from; lifecycle { destroy = false } }` | stop managing a resource without deleting it |
| `terraform state mv/rm/list/show` | older CLI equivalents; prefer blocks (reviewed in PRs, applied by CI) |

## Example
`.github/workflows/terraform.yml`
```yaml
name: terraform
on:
  pull_request:
    paths: ['infra/**']
  push:
    branches: [main]
    paths: ['infra/**']

permissions:
  contents: read
  id-token: write

jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - env: staging
            role: arn:aws:iam::111111111111:role/terraform-plan
          - env: prod
            role: arn:aws:iam::222222222222:role/terraform-plan
    defaults:
      run:
        working-directory: infra/envs/${{ matrix.env }}
    steps:
      - uses: actions/checkout@<40-char-commit-sha>
      - uses: hashicorp/setup-terraform@<40-char-commit-sha>
        with:
          terraform_version: 1.14.0
      - uses: aws-actions/configure-aws-credentials@<40-char-commit-sha>
        with:
          role-to-assume: ${{ matrix.role }}
          aws-region: eu-central-1
      - run: terraform fmt -check -recursive
      - run: terraform init -input=false
      - run: terraform validate
      - run: terraform plan -input=false -no-color -out=tfplan
      - run: |
          echo "### Plan: ${{ matrix.env }}" >> "$GITHUB_STEP_SUMMARY"
          echo '```' >> "$GITHUB_STEP_SUMMARY"
          terraform show -no-color tfplan >> "$GITHUB_STEP_SUMMARY"
          echo '```' >> "$GITHUB_STEP_SUMMARY"

  apply:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    strategy:
      max-parallel: 1                         # staging first, then prod
      matrix:
        include:
          - env: staging
            role: arn:aws:iam::111111111111:role/terraform-apply
          - env: prod
            role: arn:aws:iam::222222222222:role/terraform-apply
    environment: ${{ matrix.env }}            # prod waits for an approval
    concurrency: terraform-${{ matrix.env }}
    defaults:
      run:
        working-directory: infra/envs/${{ matrix.env }}
    steps:
      - uses: actions/checkout@<40-char-commit-sha>
      - uses: hashicorp/setup-terraform@<40-char-commit-sha>
        with:
          terraform_version: 1.14.0
      - uses: aws-actions/configure-aws-credentials@<40-char-commit-sha>
        with:
          role-to-assume: ${{ matrix.role }}
          aws-region: eu-central-1
      - run: terraform init -input=false
      - run: terraform plan -input=false -out=tfplan
      - run: terraform apply -input=false tfplan
```
Trust policy of the production apply role — only the `prod` environment of this repository.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "arn:aws:iam::222222222222:oidc-provider/token.actions.githubusercontent.com" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:acme/shop:environment:prod"
        }
      }
    }
  ]
}
```
Refactoring with blocks (kept in a `refactor.tf` until applied everywhere, then removed):
```hcl
# The api service moved into the ecs-service module: same resource, new address
moved {
  from = aws_ecs_service.api
  to   = module.service["api"].aws_ecs_service.this
}

# A bucket created by hand years ago comes under management
import {
  to = aws_s3_bucket.legacy_uploads
  id = "shop-legacy-uploads"
}

# An old log group is handed over to another team's configuration
removed {
  from = aws_cloudwatch_log_group.old_api
  lifecycle {
    destroy = false
  }
}
```
```bash
terraform plan -generate-config-out=generated.tf   # drafts resource blocks for import targets
```

## Production patterns
- **Plan on every PR, apply only from CI after merge**, staging before production with an approval gate.
- **Separate plan and apply roles** with OIDC trust scoped to PRs and environments.
- **Plans are reviewed**, with extra care for `-/+` and `-` on stateful resources.
- **Refactors through `moved`/`import`/`removed` blocks** in normal PRs.
- **One apply at a time per environment** (`concurrency`), and the next plan should be empty.

## Mistakes
Wrong: applying from a laptop to production. Unreviewed, unreproducible, and with personal credentials. Right: CI applies; laptops plan with read-only roles.

Wrong: approving based on the code diff alone. A harmless-looking rename can recreate a database. Right: read the plan; `moved` blocks for renames.

Wrong: `terraform state rm` and re-importing by hand during a refactor. Easy to get wrong, invisible to reviewers. Right: `moved`, `import`, `removed` blocks.

Wrong: one IAM role with admin rights for plans from any branch. Any PR could change production. Right: read-only plan role for PRs, apply role only for the protected environment.

## Check yourself
1. Which plan symbol should make you stop and think, and why?
2. How do you rename a resource without Terraform recreating it?
3. Why separate the plan role from the apply role?

<details>
<summary>Answers</summary>

1. `-/+` (destroy and recreate) and `-` (destroy), especially on databases, buckets, and anything holding data or traffic. They can mean data loss or downtime caused by a change that looked cosmetic.
2. Add a `moved` block from the old address to the new one. Terraform updates the address in state on the next apply instead of destroying the old resource and creating a new one.
3. Plans run on untrusted branches (any PR), so they should only be able to read. Applies change infrastructure, so their role must be assumable only from the protected environment after review and approval.
</details>

## Sources
- [Terraform — Running Terraform in automation](https://developer.hashicorp.com/terraform/tutorials/automation/automate-terraform)
- [GitHub — Configuring OpenID Connect in AWS](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [Terraform — Refactoring with moved blocks](https://developer.hashicorp.com/terraform/language/modules/develop/refactoring)
- [Terraform — Import blocks](https://developer.hashicorp.com/terraform/language/import)
- [Terraform — Removing resources](https://developer.hashicorp.com/terraform/language/resources/syntax#removing-resources)
