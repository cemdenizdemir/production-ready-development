---
title: The pipeline, OIDC, and ECR
tech: GitHub Actions, Docker, Amazon ECR
version: GitHub Actions, aws-actions/configure-aws-credentials, aws-actions/amazon-ecr-login, docker/build-push-action, Amazon ECR
date: 2026-11-07
covers: [1, 2, 3]
---
# The pipeline, OIDC, and ECR
[← Overview](00-overview.md)

## Why it matters
- Staging and production each build their own image from the same commit. A new base image layer lands in between, and production crashes on something staging never ran.
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` live in repository secrets with admin rights. A compromised third-party action reads them.
- Images are tagged `latest` and `staging`. After an incident nobody can say which commit production was running.

## Concepts

### Build once, promote
| Principle | Practice |
|:--|:--|
| One artifact per commit | build, test, scan, push once on `main` |
| Immutable identity | tag `sha-<git sha>`, deploy by digest |
| Promotion | staging and production get the same digest |
| Configuration outside | environment variables and secrets per environment |
| Small, frequent deploys | every merge can go to production |

### OIDC from GitHub Actions to AWS
| Piece | Detail |
|:--|:--|
| Identity provider | `token.actions.githubusercontent.com` registered in each AWS account |
| Workflow permission | `id-token: write` |
| Role trust policy | `aud` = `sts.amazonaws.com`, `sub` restricted to repo + environment or branch |
| Credentials | short-lived (default 1 hour), nothing stored in GitHub |
| Separate roles | `ecr-push` (build account), `deploy-staging`, `deploy-prod` |

| `sub` claim | Matches |
|:--|:--|
| `repo:acme/shop:ref:refs/heads/main` | jobs on `main` without an environment |
| `repo:acme/shop:environment:prod` | jobs using the `prod` environment |
| `repo:acme/shop:pull_request` | pull request jobs |

### ECR
| Setting | Value |
|:--|:--|
| Repositories | one per image: `shop-api`, `shop-web` |
| Tag immutability | on |
| Scan on push | enhanced scanning |
| Lifecycle policy | expire untagged, keep the last N SHA tags |
| Cross-account pulls | repository policy allows the staging/prod accounts' execution roles |

## Example
`.github/workflows/deploy.yml` — part 1: build and push once.
```yaml
name: deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      sha:
        description: Redeploy an existing image (rollback)
        required: false

permissions:
  contents: read
  id-token: write

concurrency:
  group: deploy-main
  cancel-in-progress: false            # never cancel a deploy halfway

env:
  AWS_REGION: eu-central-1
  REGISTRY: 111111111111.dkr.ecr.eu-central-1.amazonaws.com

jobs:
  build:
    if: inputs.sha == ''
    runs-on: ubuntu-24.04-arm            # native arm64 build for Graviton
    outputs:
      image: ${{ steps.out.outputs.image }}
    steps:
      - uses: actions/checkout@<40-char-commit-sha>
      - uses: ./.github/actions/setup                     # pnpm + node + install (01-foundations/04-ci-cd)
      - run: pnpm typecheck && pnpm lint && pnpm test
      - uses: aws-actions/configure-aws-credentials@<40-char-commit-sha>
        with:
          role-to-assume: arn:aws:iam::111111111111:role/ecr-push
          aws-region: ${{ env.AWS_REGION }}
      - uses: aws-actions/amazon-ecr-login@<40-char-commit-sha>
      - uses: docker/setup-buildx-action@<40-char-commit-sha>
      - id: build
        uses: docker/build-push-action@<40-char-commit-sha>
        with:
          context: .
          platforms: linux/arm64
          push: true
          tags: ${{ env.REGISTRY }}/shop-api:sha-${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: mode=max
          sbom: true
      - id: out
        run: echo "image=${{ env.REGISTRY }}/shop-api@${{ steps.build.outputs.digest }}" >> "$GITHUB_OUTPUT"
```
The deploy jobs that consume `needs.build.outputs.image` are in [lesson 02](02-ecs-deploy-strategies.md) and [lesson 03](03-migrations-environments-rollbacks.md).

Trust policy for the `ecr-push` role — only workflow runs on `main` of this repository.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "arn:aws:iam::111111111111:oidc-provider/token.actions.githubusercontent.com" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:acme/shop:ref:refs/heads/main"
        }
      }
    }
  ]
}
```
`infra/bootstrap/github-oidc.tf`
```hcl
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_ecr_repository" "api" {
  name                 = "shop-api"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}
```

## Production patterns
- **One image per commit**, tested and scanned before it's pushed, deployed everywhere by digest.
- **OIDC roles per purpose and environment**, trust scoped by `sub`; no AWS keys in GitHub.
- **Immutable ECR tags** with lifecycle policies; cross-account pull permissions instead of copying images.
- **Concurrency groups** so two deploys never interleave, and deploys are never cancelled halfway.
- **A manual "redeploy this SHA" entry point** (`workflow_dispatch`) for rollbacks.

## Mistakes
Wrong: building per environment.
```yaml
deploy-prod:
  steps:
    - run: docker build -t api:prod . && docker push …   # not the image staging tested
```
Right: build once; promote `needs.build.outputs.image`.

Wrong: static AWS keys in repository secrets. Right: OIDC with short-lived credentials.

Wrong: a trust policy with `sub: repo:acme/*` or only `aud`. Any branch, or any repository in the org, can assume the deploy role. Right: exact repository plus environment or branch.

Wrong: `cancel-in-progress: true` on deploy workflows. A new merge kills a deploy halfway through migrations. Right: queue deploys (`cancel-in-progress: false`).

## Check yourself
1. Why deploy by digest instead of by tag?
2. What does the `sub` condition in an OIDC trust policy protect against?
3. Why must the deploy workflow never cancel an in-progress run?

<details>
<summary>Answers</summary>

1. A digest identifies exact image bytes and can't be changed; tags are labels that can move (unless immutability is enforced everywhere). Deploying by digest guarantees production runs exactly what staging ran, and makes "what is running" unambiguous.
2. It limits which workflows can assume the role: a specific repository and a specific branch or environment. Without it, other repositories, forks, pull requests, or feature branches could get production credentials.
3. A cancelled run can stop between migration and deployment, or in the middle of a rollout, leaving environments half-updated. Queuing lets each deploy finish (or roll back) before the next starts.
</details>

## Sources
- [GitHub — About security hardening with OpenID Connect](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)
- [aws-actions/amazon-ecr-login](https://github.com/aws-actions/amazon-ecr-login)
- [docker/build-push-action](https://github.com/docker/build-push-action)
- [Amazon ECR — Repository policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-policies.html)
