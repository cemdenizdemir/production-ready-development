---
title: CI/CD cheatsheet
tech: GitHub Actions, pnpm, Docker
version: GitHub Actions (Nov 2026, node24 runtime), pnpm 10, Docker Buildx
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# CI/CD cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Concepts
| Term | What it means | Note |
|:--|:--|:--|
| ⭐ Continuous integration | merge small changes often; verify each automatically | main stays green |
| ⭐ Continuous delivery | main is always releasable; release on demand | human gate |
| Continuous deployment | every green main commit deploys | pipeline is the gate |
| ⭐ Build once, deploy many | same artifact promoted through environments | never rebuild for prod |
| Pipeline as code | workflows versioned and reviewed | CODEOWNERS on `.github/` |
| Shift left | catch problems earlier (PR, pre-commit) | cheaper fixes |
| DORA metrics | deploy frequency, lead time, change fail rate, recovery time | delivery health |
| Trunk-based development | short branches merged daily | see 01-git |

## Workflow anatomy
| Key | What it does | Example |
|:--|:--|:--|
| ⭐ `on:` | triggers | `pull_request`, `push`, `merge_group` |
| `on.push.branches` / `tags` | filter by ref | `branches: [main]`, `tags: ['v*']` |
| `on.*.paths` / `paths-ignore` | filter by changed files | `paths-ignore: ['**.md']` |
| `workflow_dispatch` | manual run with `inputs` | buttons in the Actions tab |
| `schedule` | cron (UTC) | `- cron: '0 3 * * 1'` |
| `workflow_call` | makes the workflow reusable | inputs, secrets, outputs |
| `workflow_run` | run after another workflow | runs with base repo secrets: be careful |
| ⭐ `jobs.<id>.runs-on` | runner label | `ubuntu-latest`, `ubuntu-24.04-arm` |
| ⭐ `needs` | job dependencies | `needs: [test]` |
| ⭐ `if` | condition | `if: github.ref == 'refs/heads/main'` |
| `strategy.matrix` | job per combination | `node: [24, 26]` |
| `strategy.fail-fast` | cancel siblings on failure | `false` to see all failures |
| `include` / `exclude` | add or drop matrix combos | |
| `max-parallel` | limit concurrent matrix jobs | |
| ⭐ `timeout-minutes` | job or step limit | default 360 |
| `continue-on-error` | job/step failure doesn't fail the run | experiments only |
| `defaults.run.shell` / `working-directory` | defaults for `run` | monorepo packages |
| `env` | environment variables at workflow/job/step level | |
| `outputs` | small values for later jobs | `needs.build.outputs.version` |
| `services` | sidecar containers for a job | Postgres for tests |
| `container` | run the whole job in a container | |

## Expressions and contexts
| Item | What it gives | Example |
|:--|:--|:--|
| `${{ github.sha }}` / `github.ref` / `github.ref_name` | commit / full ref / short ref | |
| `github.event_name` | trigger name | `pull_request` |
| `github.event.*` | full event payload | ⭐ untrusted: pass via `env` |
| `github.repository` / `github.actor` | `owner/repo` / who triggered | |
| `secrets.NAME` / `vars.NAME` | secrets / variables | |
| `matrix.*` / `needs.*` / `steps.<id>.outputs.*` | job data | |
| `runner.os` / `runner.temp` | runner info | cache keys |
| `hashFiles('pnpm-lock.yaml')` | hash of files | cache keys |
| `success()` / `failure()` / `always()` / `cancelled()` | status functions | `if: always()` for reports |
| `contains()` / `startsWith()` / `format()` / `toJSON()` / `fromJSON()` | functions | `fromJSON` for dynamic matrices |
| `$GITHUB_OUTPUT` | set step outputs | `echo "k=v" >> "$GITHUB_OUTPUT"` |
| `$GITHUB_ENV` | env for later steps | |
| `$GITHUB_STEP_SUMMARY` | Markdown summary on the run page | test results, links |
| `$GITHUB_PATH` | add to PATH | |
| `::add-mask::value` | mask a value in logs | derived secrets |
| `::error file=a.ts,line=3::msg` | annotation on the PR | also `::warning`, `::notice` |
| `::group::` / `::endgroup::` | collapsible log section | |

## Common actions
| Action | Use | Note |
|:--|:--|:--|
| ⭐ `actions/checkout` | clone the repo | `fetch-depth: 0` for full history; `persist-credentials: false` |
| ⭐ `actions/setup-node` | install Node, cache deps | `node-version-file: .nvmrc`, `cache: pnpm` |
| ⭐ `pnpm/action-setup` | install pnpm | reads `packageManager` |
| `actions/cache` | generic cache | key + `restore-keys` |
| ⭐ `actions/upload-artifact` / `download-artifact` | pass files between jobs | `retention-days` |
| `actions/github-script` | JS with an authenticated Octokit | comments, labels |
| `docker/setup-buildx-action` | BuildKit builder | |
| `docker/login-action` | registry login | GHCR, ECR, Docker Hub |
| `docker/metadata-action` | tags + labels from git | `type=sha`, `type=semver` |
| ⭐ `docker/build-push-action` | build, cache, push | `cache-from: type=gha` |
| `aws-actions/configure-aws-credentials` | AWS creds via OIDC | `role-to-assume` |
| `aws-actions/amazon-ecr-login` | ECR login | |
| `actions/attest-build-provenance` | signed provenance | `gh attestation verify` |
| `dorny/paths-filter` | per-job change detection | outputs per filter |
| `github/codeql-action` | code scanning | see 06-security |

## pnpm in CI
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `packageManager` field | pins pnpm version | `"pnpm@10.18.0"` |
| ⭐ `pnpm install --frozen-lockfile` | fail on lockfile drift | default when `CI=true` |
| `cache: pnpm` (setup-node) | caches the store | keyed on `pnpm-lock.yaml` |
| `pnpm store path` | where the store lives | custom cache setups |
| `pnpm fetch` | populate store from lockfile only | Docker layer caching |
| `pnpm install --offline` | install from store only | after `fetch` |
| `pnpm --filter <pkg> <cmd>` | one workspace package | `--filter ...[origin/main]` = changed |
| `pnpm -r run build` | run in all packages | topological order |
| `pnpm deploy --prod <dir>` | portable prod bundle of one package | Docker images |
| `pnpm audit` | vulnerability report | prefer Dependabot alerts |
| `pnpm dedupe --check` | fail if lockfile can be deduped | |
| `pnpm licenses list` | license overview | compliance |

## Secrets and identity
| Item | What it does | Note |
|:--|:--|:--|
| Repository secret | encrypted value for workflows | not sent to fork PRs |
| ⭐ Environment secret | only for jobs in that environment | production creds |
| Organization secret | shared across selected repos | |
| Variables (`vars`) | non-secret config | region, account ID |
| ⭐ `GITHUB_TOKEN` | per-run token | scope with `permissions:` |
| ⭐ OIDC (`id-token: write`) | short-lived cloud credentials | no stored keys |
| `sub` claim | `repo:org/repo:environment:prod` | match exactly in IAM trust |
| `aud` claim | `sts.amazonaws.com` for AWS | |
| Fine-grained PAT / GitHub App token | cross-repo automation | prefer Apps (`actions/create-github-app-token`) |
| npm trusted publishing | publish packages via OIDC | no npm token |

## Hardening
| Control | Why | Note |
|:--|:--|:--|
| ⭐ `permissions: {}` at top | least privilege | grant per job |
| ⭐ SHA-pin third-party actions | tags can be repointed | `@<sha> # v1.2.3` |
| ⭐ Untrusted input via `env:` | prevents script injection | titles, branch names, bodies |
| Dependabot `github-actions` | updates pins | weekly |
| Avoid `pull_request_target` + PR checkout | secrets exposed to fork code | |
| `persist-credentials: false` | no token left in `.git` | unless you push |
| CODEOWNERS for `.github/workflows/` | review workflow changes | |
| Default token read-only (repo setting) | safe default | |
| Allowed-actions policy | allowlist, can require SHA pins | org/repo settings |
| No self-hosted runners on public repos | fork code runs on your hardware | |
| `zizmor` | security linter for workflows | finds injection, unpinned actions |
| `actionlint` | syntax and shellcheck for workflows | |
| `harden-runner` | egress monitoring on runners | also seen |

## Docker in CI
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Tag with commit SHA | exact, traceable images | `type=sha` |
| ⭐ Deploy by digest | immutable reference | `image@sha256:...` |
| `cache-from/to: type=gha` | layer cache in Actions cache | `mode=max` caches all stages |
| `type=registry` cache | cache in the registry | shared across workflows |
| `platforms: linux/amd64,linux/arm64` | multi-arch | QEMU or native ARM runners |
| `provenance: mode=max` / `sbom: true` | supply-chain attestations | |
| `push: false` on PRs | build check without publishing | |
| GHCR | `ghcr.io/owner/repo` | `packages: write` |
| `gh attestation verify` | verify provenance | before deploy |
| Image scanning | Trivy, Docker Scout, ECR scanning | fail on criticals |

## Reuse
| Item | What it is | Note |
|:--|:--|:--|
| ⭐ Reusable workflow | `on: workflow_call`, called as a job | `uses: org/repo/.github/workflows/x.yml@<sha>` |
| `secrets: inherit` | pass all caller secrets | convenient; explicit is safer |
| Workflow outputs | values back to caller | `on.workflow_call.outputs` |
| ⭐ Composite action | `runs.using: composite`, called as a step | `shell:` required on `run` |
| JavaScript action | `runs.using: node24` | node20 removed Sep 2026 |
| Docker action | `runs.using: docker` | Linux runners only |
| Starter workflows | org templates in `.github` repo | |
| Nesting limits | reusable workflows nest up to 10 levels; 50 per run (2025 limits) | verify for your plan |

## Keeping main green
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Required status checks | named checks gate merging | via rulesets |
| ⭐ Aggregator job (`ci-ok`) | single stable required check | `if: always()` + check `needs.*.result` |
| Merge queue | test PRs combined before merge | needs `merge_group` trigger |
| Require up-to-date branches | PR must contain latest main | rebase churn on busy repos |
| Auto-merge | merge when checks and reviews pass | `gh pr merge --auto` |
| Revert first | main broken → revert, then fix | unblock the team |
| Flaky test quarantine | skip with owner + issue | see 03-testing |

## Environments and deploys
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `environment: production` | ties a job to an environment | secrets + rules + history |
| ⭐ Required reviewers | manual approval | up to 6 people/teams |
| Prevent self-review | triggerer can't approve | |
| Wait timer | delay before job starts | minutes |
| Deployment branches/tags | which refs may deploy | `main`, `v*` |
| Environment URL | link shown on the run and PR | `environment.url` |
| ⭐ Deploy concurrency | `cancel-in-progress: false` | finish running deploys |
| Preview environments | one per PR | destroy on close |
| Smoke tests after deploy | stop promotion on failure | |
| `workflow_dispatch` inputs | manual deploy / rollback by SHA | |

## Speed and cost
| Lever | Effect | Note |
|:--|:--|:--|
| ⭐ Dependency cache | installs in seconds | `cache: pnpm` |
| Tool caches | faster tsc/eslint | `.eslintcache`, `tsBuildInfo` |
| ⭐ Parallel jobs | wall time = slowest job | typecheck, lint, test |
| Test sharding | split suite across matrix | `--shard=i/n` |
| ⭐ `cancel-in-progress` on PRs | stop outdated runs | |
| Path filters | skip unaffected work | with aggregator check |
| ARM runners | cheaper, fast for Node | `ubuntu-24.04-arm` |
| Larger runners | more CPU/RAM | paid |
| Artifact retention | storage cost | 7 days default for reports |
| Docker layer cache | skip unchanged layers | order Dockerfile well |

## Useful gh commands
| Command | What it does |
|:--|:--|
| `gh run list` / `gh run view <id> --log-failed` | recent runs / failed step logs |
| `gh run watch` | follow a run live |
| `gh run rerun <id> --failed` | rerun failed jobs |
| `gh workflow run deploy.yml -f sha=abc123` | trigger `workflow_dispatch` |
| `gh workflow list` / `disable` | manage workflows |
| `gh secret set NAME --env production` | set an environment secret |
| `gh variable set AWS_REGION --body eu-central-1` | set a variable |
| `gh cache list` / `gh cache delete <key>` | inspect caches |
| `gh attestation verify oci://<image> --owner <org>` | verify provenance |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `${{ github.event.* }}` in `run:` | script injection | `env:` then `"$VAR"` |
| Tag-pinned third-party actions | tags can be repointed | SHA pins + Dependabot |
| Required check skipped by paths | PR blocked forever | aggregator job |
| No `merge_group` trigger | queue waits forever | add the trigger |
| Jobs share nothing | missing files in later jobs | artifacts / outputs |
| Cache treated as storage | evicted (10 GB per repo, LRU) | artifacts for needed files |
| Default 6 h timeout | runaway bills | `timeout-minutes` |
| `cancel-in-progress` on deploys | half-finished deploys | `false` for deploys |
| Secrets in fork PRs | empty secrets, failing jobs | design PR checks without secrets |
| Masking only exact strings | transformed secrets leak | `::add-mask::` derived values |
| `schedule` on inactive repos | disabled after 60 days without activity (public repos) | keep-alive or manual trigger |
| Old action majors on node20 | fail since Sep 2026 | update to node24 majors |

## Sources
| Source | Link |
|:--|:--|
| GitHub Actions docs | https://docs.github.com/en/actions |
| Workflow syntax | https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions |
| Security hardening | https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions |
| OIDC with AWS | https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services |
| pnpm CI | https://pnpm.io/continuous-integration |
| Docker GitHub Actions | https://docs.docker.com/build/ci/github-actions/ |
| Merge queue | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue |
| zizmor | https://docs.zizmor.sh/ |
