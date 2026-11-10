---
title: A fast PR pipeline for .NET and pnpm
tech: GitHub Actions, .NET 10 SDK, NuGet, pnpm
version: actions/setup-dotnet v5, .NET SDK 10.0.402, pnpm 10
date: 2026-11-09
covers: [3, 4, 5, 13]
---
# A fast PR pipeline for .NET and pnpm
[← Overview](00-overview.md)

## Why it matters
- Restore downloads 400 MB of NuGet packages on every run; the pipeline takes 14 minutes, 6 of them restoring.
- A transitive package resolves to a different version in CI than on laptops; a bug appears only in the deployed build.
- The format check runs after a 9-minute integration test job, so a missing space fails the PR 9 minutes late.

## Concepts

### Order the PR pipeline: cheap and likely-to-fail first
| Step | .NET | Frontend |
|:--|:--|:--|
| 1. checkout | `actions/checkout@v5` | same |
| 2. toolchain | `setup-dotnet` with `global.json` | `pnpm/action-setup` + `setup-node` |
| 3. restore (cached, locked) | `dotnet restore --locked-mode` | `pnpm install --frozen-lockfile` |
| 4. format / lint | `dotnet format --verify-no-changes --no-restore` | `pnpm lint`, `pnpm format:check` |
| 5. build | `dotnet build --no-restore -c Release` (warnings as errors) | `pnpm typecheck`, `pnpm build` |
| 6. unit tests | `dotnet test --no-build` on unit projects | `pnpm test` |
| 7. integration tests | separate job (Docker, SQL Server container) | Playwright job |
| 8. publish | `dotnet publish --no-build` (only when something consumes it) | — |

### .NET in CI
| Item | Setting | Why |
|:--|:--|:--|
| ⭐ pin the SDK | `global.json` + `setup-dotnet` `global-json-file` | same SDK everywhere |
| ⭐ lock files | `<RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>` in `Directory.Build.props` | exact transitive versions |
| ⭐ locked restore | `dotnet restore --locked-mode` | fail if lock files are out of date |
| NuGet cache | `setup-dotnet` `cache: true` + `cache-dependency-path: '**/packages.lock.json'` | skip downloads |
| central versions | `Directory.Packages.props` | one place for versions |
| telemetry/noise off | `DOTNET_NOLOGO=1`, `DOTNET_CLI_TELEMETRY_OPTOUT=1` | cleaner logs |
| reuse work | `--no-restore`, `--no-build` | each step does one thing |
| NuGet Audit | on by default; `NU1903`/`NU1904` warnings | break on high/critical in CI (06-security) |

`Directory.Build.props`
```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
    <ContinuousIntegrationBuild Condition="'$(CI)' == 'true'">true</ContinuousIntegrationBuild>
  </PropertyGroup>
</Project>
```
`ContinuousIntegrationBuild` makes builds deterministic (normalized paths in PDBs). GitHub sets `CI=true`.

### pnpm in CI
| Item | Setting |
|:--|:--|
| pnpm version | `packageManager` field in `package.json`, read by `pnpm/action-setup@v4` |
| cache | `setup-node` `cache: pnpm` with `cache-dependency-path` |
| exact install | `pnpm install --frozen-lockfile` |
| install scripts | allowlist only what needs them (`onlyBuiltDependencies`) |

### Speed and cost
| Technique | Effect |
|:--|:--|
| caching (NuGet, pnpm store, Docker layers) | minutes saved per run |
| `concurrency` with `cancel-in-progress` | old runs on a PR stop when you push again |
| parallel jobs (api, web, integration) | wall time = slowest job |
| `paths` filters on non-required workflows | skip work for docs-only changes |
| `--no-restore` / `--no-build` chaining | no repeated work |
| artifacts only when needed, short retention | storage cost |
| `timeout-minutes` on every job | hung jobs don't burn 6 hours |
| larger runners only for the slowest job | cost where it matters |

## Example
`.github/workflows/ci.yml` (API job)
```yaml
env:
  DOTNET_NOLOGO: 1
  DOTNET_CLI_TELEMETRY_OPTOUT: 1

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  api:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-dotnet@v5
        with:
          global-json-file: global.json
          cache: true
          cache-dependency-path: '**/packages.lock.json'
      - run: dotnet restore --locked-mode
      - run: dotnet format --verify-no-changes --no-restore
      - run: dotnet build --no-restore -c Release
      - run: dotnet test --no-build -c Release --filter "Category!=Integration"

  api-integration:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-dotnet@v5
        with:
          global-json-file: global.json
          cache: true
          cache-dependency-path: '**/packages.lock.json'
      - run: dotnet test tests/Shop.Api.IntegrationTests -c Release   # Testcontainers uses the runner's Docker
```

## Production patterns
- Fail fast: format and build before tests; unit tests before integration tests.
- Commit lock files and restore in locked mode; update them with `dotnet restore --force-evaluate` in the PR that changes packages.
- Keep the PR pipeline under ~10 minutes. Measure it; the slowest job is the one to fix.
- Run exactly the commands developers run locally, so a red build can be reproduced in one step.

## Mistakes
Wrong: floating SDK and floating packages.
```yaml
- uses: actions/setup-dotnet@v5
  with:
    dotnet-version: 10.x
- run: dotnet restore
```
Right: `global-json-file: global.json` and `dotnet restore --locked-mode`.

Wrong: one giant job that restores, builds, and tests three times (`dotnet test` without `--no-build` rebuilds).
Right: restore once, build once, test with `--no-build`.

## Check yourself
1. What does `dotnet restore --locked-mode` do when `packages.lock.json` doesn't match the project?
2. Why does `cancel-in-progress` only make sense for PR runs, not for `main`?
3. Which MSBuild property makes CI builds deterministic?

<details><summary>Answers</summary>

1. It fails the restore instead of updating the lock file.
2. On `main`, every commit should be built and possibly deployed; cancelling could skip a commit's deploy. On PRs, only the latest push matters.
3. `ContinuousIntegrationBuild=true`.
</details>

## Sources
- [actions/setup-dotnet — caching](https://github.com/actions/setup-dotnet#caching-nuget-packages)
- [NuGet — Lock files and locked mode](https://learn.microsoft.com/nuget/consume-packages/package-references-in-project-files#locking-dependencies)
- [dotnet format](https://learn.microsoft.com/dotnet/core/tools/dotnet-format)
- [GitHub Actions — Concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [pnpm — Continuous Integration](https://pnpm.io/continuous-integration)
