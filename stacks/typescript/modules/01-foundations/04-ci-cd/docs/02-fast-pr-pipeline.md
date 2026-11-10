---
title: A fast PR pipeline with pnpm
tech: GitHub Actions, pnpm
version: GitHub Actions (Nov 2026), pnpm 10, Node.js 26 LTS
date: 2026-11-07
covers: [3, 4, 12]
---
# A fast PR pipeline with pnpm
[← Overview](00-overview.md)

## Why it matters
- `pnpm install` without `--frozen-lockfile` quietly resolves a newer transitive dependency in CI. Tests pass in CI, then a different version ships.
- No dependency cache: every PR spends 3 minutes downloading the same packages. Across a team, hours a day.
- A docs-only change waits 20 minutes for the full E2E suite.

## Concepts

### Order checks by cost
| Stage | Typical time | Fails on |
|:--|:--|:--|
| Install (cached) | 10–30 s | lockfile drift |
| Typecheck | 10–60 s | type errors |
| Lint + format check | 10–60 s | rule violations, unformatted files |
| Unit tests | < 1 min | logic |
| Integration tests | 1–5 min | SQL, HTTP, wiring |
| Build | 1–3 min | bundling, Docker |
| E2E | 3–15 min | broken journeys |

Run cheap checks first or in parallel jobs, so the most common failures report within a couple of minutes. Target: PR feedback under 10 minutes.

### pnpm in CI
| Item | Why |
|:--|:--|
| `packageManager: "pnpm@10.x.y"` in `package.json` | everyone, CI included, uses the same pnpm |
| `pnpm/action-setup` | installs that pnpm version (Corepack isn't bundled with Node 25+) |
| `actions/setup-node` with `cache: pnpm` | caches the pnpm store keyed on `pnpm-lock.yaml` |
| `pnpm install --frozen-lockfile` | fails if `package.json` and the lockfile disagree (default when `CI=true`) |
| `pnpm --filter <pkg>` | run commands for one workspace package |
| `pnpm fetch` | fill the store from the lockfile only; great for Docker layers |

### Caching and artifacts
- **Cache** = speed-up, may be missing, keyed by inputs (`hashFiles('pnpm-lock.yaml')`). Never put secrets or build outputs you depend on in it.
- **Artifact** = a file a later job or a human needs (coverage HTML, test reports, build output). Has a retention period.
- Tools with their own caches (TypeScript `tsBuildInfo`, ESLint `--cache`, Vitest) can share one `actions/cache` entry.

### Skipping work
- `on.pull_request.paths-ignore: ['**.md', 'docs/**']` skips a workflow entirely. Careful with required checks (lesson 05).
- Inside a workflow, detect changes per job with a path filter step and `if:` conditions.
- `concurrency` with `cancel-in-progress` on PRs stops paying for outdated pushes.

## Example
`package.json` (excerpt)
```json
{
  "packageManager": "pnpm@10.18.0",
  "engines": { "node": ">=26" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --cache --max-warnings 0 && prettier --check .",
    "test": "vitest run",
    "build": "tsc -p tsconfig.build.json"
  }
}
```
`.github/workflows/pr.yml`
```yaml
name: pr
on:
  pull_request:
    paths-ignore: ['**/*.md', 'docs/**']

permissions:
  contents: read

concurrency:
  group: pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4          # version comes from packageManager
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache@v4               # tool caches: tsc incremental + eslint
        with:
          path: |
            .eslintcache
            node_modules/.cache
          key: tools-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}
          restore-keys: tools-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test -- --coverage
      - uses: actions/upload-artifact@v4
        if: always()                         # upload reports even when tests fail
        with:
          name: coverage
          path: coverage/
          retention-days: 7
```
The `restore-keys` prefix lets a run start from the newest older cache, while the full key (with the SHA) saves a fresh one.

## Production patterns
- **Fail fast, report everything:** split into parallel jobs (`typecheck`, `lint`, `test`) so one failure doesn't hide the others.
- **Warnings are errors in CI** (`--max-warnings 0`); otherwise they pile up forever.
- **Measure the pipeline.** Look at the slowest job each month; cache it, shard it, or move it later.
- **Larger runners for heavy jobs** when time costs more than minutes. ARM runners (`ubuntu-24.04-arm`) are cheaper and fast for Node.
- **Keep artifacts short-lived** (7 days) unless they are release assets.

## Mistakes
Wrong: a plain install in CI.
```yaml
- run: pnpm install # may update the lockfile if package.json changed without it
```
Right:
```yaml
- run: pnpm install --frozen-lockfile
```

Wrong: `npm i -g pnpm` with no version, so CI uses whatever is newest that day.
Right: `packageManager` in `package.json` plus `pnpm/action-setup`.

Wrong: caching `node_modules` directly with a key that ignores the lockfile.
```yaml
key: deps-${{ runner.os }} # stale modules after a dependency change
```
Right: cache the pnpm store via `setup-node` (`cache: pnpm`), keyed on the lockfile.

Wrong: `paths-ignore` on a workflow whose job is a required check. Docs-only PRs wait forever for a check that never runs.
Right: an always-running aggregator job as the required check (lesson 05).

## Check yourself
1. What does `--frozen-lockfile` protect against?
2. Cache or artifact: (a) the pnpm store, (b) a JUnit report you want to read, (c) the built `dist/` a later job deploys?
3. Your PR job takes 18 minutes. Name three ways to cut it.

<details>
<summary>Answers</summary>

1. CI resolving different dependency versions than the ones reviewed and tested locally; it fails instead of silently changing the lockfile.
2. (a) cache, (b) artifact, (c) artifact (or rebuild it inside the deploy job from the same commit; never rely on a cache).
3. Parallel jobs instead of one long job; shard tests across a matrix; cache tools (`tsc`, ESLint); skip unaffected work with path filters; move E2E to the merge queue or main.
</details>

## Sources
- [pnpm — Continuous integration](https://pnpm.io/continuous-integration)
- [pnpm — `pnpm install --frozen-lockfile`](https://pnpm.io/cli/install#--frozen-lockfile)
- [actions/setup-node — caching](https://github.com/actions/setup-node#caching-global-packages-data)
- [GitHub — Caching dependencies](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows)
- [GitHub — Storing workflow data as artifacts](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow)
