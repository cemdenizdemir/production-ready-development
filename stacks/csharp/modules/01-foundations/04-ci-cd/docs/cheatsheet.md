---
title: CI/CD cheatsheet
tech: GitHub Actions, .NET 10 SDK, pnpm, Docker
version: GitHub Actions (Nov 2026), actions/setup-dotnet v5, .NET SDK 10.0.402, pnpm 10
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
---
# CI/CD cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Concepts
| Term | Means | Note |
|:--|:--|:--|
| ⭐ Continuous integration | small merges to main, auto build + test | |
| ⭐ Continuous delivery | every green commit releasable | human approval |
| Continuous deployment | every green commit released | automated gates only |
| ⭐ Build once, promote | same artifact through environments | |
| Pipeline as code | YAML in the repo | reviewed like code |
| DORA metrics | deploy frequency, lead time, change failure rate, MTTR | 04-shipping/04 |

## Workflow anatomy
| Part | What it is | Example |
|:--|:--|:--|
| workflow | YAML in `.github/workflows/` | `ci.yml` |
| ⭐ `on` | triggers | `pull_request`, `push` |
| ⭐ job | steps on one runner | parallel by default |
| `runs-on` | runner | `ubuntu-latest` |
| ⭐ step `run` / `uses` | command / action | |
| `env` | environment variables | workflow, job, or step level |
| `defaults.run.working-directory` | default folder | `web` |
| `timeout-minutes` | kill hung jobs | default 360 |
| `if:` | condition | `github.ref == 'refs/heads/main'` |
| `$GITHUB_OUTPUT` | step outputs | `echo "k=v" >> "$GITHUB_OUTPUT"` |
| `$GITHUB_STEP_SUMMARY` | Markdown summary | coverage, results |
| `$GITHUB_ENV` | env for later steps | |

## Triggers
| Trigger | Use | Note |
|:--|:--|:--|
| ⭐ `pull_request` | PR CI | forks: no secrets |
| ⭐ `merge_group` | merge queue | required checks need it |
| `push: branches: [main]` | post-merge, CD | |
| `push: tags: ['v*']` | releases | |
| `workflow_dispatch` | manual with inputs | |
| `schedule` | cron (UTC) | nightly scans |
| `workflow_call` | reusable workflow | |
| `paths` / `paths-ignore` | filter by files | not on required workflows |
| `pull_request_target` | base-repo context + secrets | dangerous with PR code |

## .NET in CI
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `actions/setup-dotnet@v5` | install SDK | `global-json-file: global.json` |
| `cache: true` + `cache-dependency-path` | NuGet cache | needs lock files |
| ⭐ `RestorePackagesWithLockFile` | write `packages.lock.json` | `Directory.Build.props` |
| ⭐ `dotnet restore --locked-mode` | fail on lock drift | CI |
| `dotnet restore --force-evaluate` | regenerate lock files | when changing packages |
| ⭐ `dotnet format --verify-no-changes` | format gate | `--no-restore` |
| ⭐ `dotnet build --no-restore -c Release` | compile | warnings as errors |
| ⭐ `dotnet test --no-build` | test without rebuild | |
| `dotnet publish --no-build -o out` | publish output | |
| `ContinuousIntegrationBuild` | deterministic build | when `CI=true` |
| `DOTNET_NOLOGO` / `DOTNET_CLI_TELEMETRY_OPTOUT` | quiet logs | |
| `NUGET_PACKAGES` | NuGet global folder | custom cache path |
| NuGet Audit | vuln warnings NU1901–NU1904 | transitive by default (.NET 10) |
| `-p:Version=…` | stamp version | from tag |

## pnpm in CI
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `pnpm/action-setup@v4` | install pnpm | reads `packageManager` |
| `actions/setup-node@v5` `cache: pnpm` | store cache | `cache-dependency-path` |
| ⭐ `pnpm install --frozen-lockfile` | exact install | |
| `pnpm -r` / `--filter` | workspace commands | |
| `onlyBuiltDependencies` | allowlist install scripts | supply chain |

## Speed and cost
| Technique | Effect | Note |
|:--|:--|:--|
| ⭐ caching | skip downloads | NuGet, pnpm, Docker |
| ⭐ `concurrency` + `cancel-in-progress` | stop stale PR runs | not for deploys |
| parallel jobs | lower wall time | |
| fail fast order | format → build → unit → integration | |
| `timeout-minutes` | cap hung jobs | |
| artifact `retention-days` | storage cost | |
| larger runners | faster heavy jobs | billed per minute |
| test sharding | split suites | matrix |

## Matrix, dependencies, outputs
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `strategy.matrix` | job variations | OS, shards |
| `include` / `exclude` | tweak combos | |
| `fail-fast: false` | see all failures | |
| `max-parallel` | limit | |
| ⭐ `needs` | job order | |
| `needs.<job>.result` | success / failure / skipped | gate jobs |
| `outputs` | pass values between jobs | image ref |
| `if: always()` | run regardless | reports |

## Reuse
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ reusable workflow | shared jobs | `on: workflow_call` |
| `jobs.x.uses: ./.github/workflows/y.yml` | call it | or `org/repo/...@sha` |
| `secrets: inherit` | pass caller secrets | |
| ⭐ composite action | shared steps | `runs: using: composite` |
| `shell:` in composite steps | required | |
| starter workflows | org templates | |

## Required checks and merge queue
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ required status checks | block merge until green | ruleset |
| check name = job name | renames break rulesets | |
| ⭐ gate job | single required check | `needs: [...]` + result test |
| skipped job | counts as success | |
| never-run job | blocks merge | `paths` filters |
| ⭐ merge queue | test PR + main + queue | `merge_group` trigger |

## Secrets, variables, OIDC
| Item | What it does | Note |
|:--|:--|:--|
| repository secret | encrypted value | masked in logs |
| ⭐ environment secret | per environment | behind approvals |
| `vars.X` | non-secret config | client/tenant IDs |
| ⭐ `GITHUB_TOKEN` | per-run token | scoped by `permissions` |
| ⭐ `id-token: write` | request OIDC token | |
| ⭐ `azure/login@v2` | OIDC login to Azure | `client-id`, `tenant-id`, `subscription-id` |
| federated credential | trust GitHub tokens | on a managed identity |
| subject `repo:o/r:environment:prod` | who may log in | prefer environments |
| audience `api://AzureADTokenExchange` | Azure default | |
| `::add-mask::value` | mask derived values | |

## Hardening
| Risk | Control | Note |
|:--|:--|:--|
| ⭐ broad token | `permissions: contents: read` | top of workflow |
| ⭐ moved tags | pin actions to full SHA | `# v5.0.0` comment |
| ⭐ script injection | untrusted input via `env:` | never `${{ }}` in `run` |
| `pull_request_target` | no PR code checkout | |
| fork PRs | no secrets by default | keep it |
| self-hosted on public repos | untrusted code runs | avoid |
| action allowlist | org policy | |
| Dependabot `github-actions` | bump pinned SHAs | |
| zizmor / harden-runner / Scorecard | lint, egress, posture | also seen |

## Images
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `docker/setup-buildx-action@v3` | Buildx builder | |
| ⭐ `docker/build-push-action@v6` | build + push | |
| `cache-from/to: type=gha` | layer cache | `mode=max` |
| `provenance: mode=max` / `sbom: true` | attestations | |
| `actions/attest-build-provenance` | signed provenance | |
| ⭐ tag `:<sha>` | immutable | never deploy `latest` |
| deploy by digest | exact image | `@sha256:…` |
| `az acr login` / `az acr build` | ACR auth / remote build | after `azure/login` |
| `dotnet publish /t:PublishContainer` | image without Dockerfile | `ContainerRegistry` property |

## Environments and promotion
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `environment: production` | protected deploy target | |
| required reviewers | manual approval | |
| wait timer | delay before deploy | |
| deployment branches/tags | who may deploy | `main` only |
| environment URL | link to running app | `environment: { name, url }` |
| ⭐ concurrency per environment | one deploy at a time | `cancel-in-progress: false` |
| smoke tests | verify after deploy | before promotion |

## Azure Pipelines ↔ GitHub Actions
| Azure Pipelines | GitHub Actions | Note |
|:--|:--|:--|
| `trigger` / `pr` | `on: push` / `pull_request` | |
| `pool: vmImage` | `runs-on` | |
| `stages` / `jobs` / `steps` | jobs + `needs` / steps | |
| `UseDotNet@2` | `actions/setup-dotnet` | `useGlobalJson: true` |
| `DotNetCoreCLI@2` | `run: dotnet …` | |
| `script` / `bash` / `pwsh` | `run` + `shell` | |
| `variables`, variable groups | `env`, `vars` | |
| `$(Build.SourceVersion)` | `${{ github.sha }}` | |
| `template:` | composite action / reusable workflow | |
| ⭐ service connection | `azure/login` OIDC | workload identity federation |
| `AzureCLI@2` | `azure/login` + `az` | |
| ⭐ `environment` + approvals/checks | GitHub environment | |
| `deployment` job + `strategy` | deploy job | `runOnce`, `rolling`, `canary` |
| `PublishPipelineArtifact` | `actions/upload-artifact` | |
| `condition: succeeded()` | `if: success()` | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| No `merge_group` trigger | queue never merges | add it |
| `paths` on required workflow | PRs blocked | gate job |
| Floating SDK | CI ≠ laptops | `global.json` |
| `dotnet test` without `--no-build` | rebuilds | chain flags |
| `cancel-in-progress` on deploys | half-finished deploy | false for deploys |
| Tags instead of SHAs for actions | tag can move | pin SHA |
| `${{ github.event.* }}` in `run` | script injection | `env:` |
| Client secrets for Azure | leak, no rotation | OIDC |
| Rebuilding per environment | untested artifact | build once |
| `:latest` | ambiguous rollbacks | `:sha` |

## Sources
| Source | Link |
|:--|:--|
| GitHub Actions docs | https://docs.github.com/en/actions |
| Workflow syntax | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax |
| Security hardening | https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions |
| setup-dotnet | https://github.com/actions/setup-dotnet |
| NuGet lock files | https://learn.microsoft.com/nuget/consume-packages/package-references-in-project-files#locking-dependencies |
| Azure OIDC from GitHub | https://learn.microsoft.com/azure/developer/github/connect-from-azure-openid-connect |
| docker/build-push-action | https://github.com/docker/build-push-action |
| Azure Pipelines YAML | https://learn.microsoft.com/azure/devops/pipelines/yaml-schema/ |
