---
title: Coverage, flaky tests, and CI
tech: Vitest 4, GitHub Actions
version: Vitest 4.x, @vitest/coverage-v8, GitHub Actions (Nov 2026)
date: 2026-11-07
covers: [10, 11, 13]
---
# Coverage, flaky tests, and CI
[← Overview](00-overview.md)

## Why it matters
- A team mandates 100% coverage. People write tests that execute code without asserting anything, and the number goes up while confidence doesn't.
- One flaky test fails 1 run in 20. With 15 such tests, most CI runs are red, people press "re-run" by reflex, and a real failure slips through.
- A 25-minute test job means developers batch changes and merge less often.

## Concepts

### What coverage measures
| Metric | Counts | Notes |
|:--|:--|:--|
| Statements / lines | executed statements | easiest to inflate |
| Branches | each side of `if`, `?:`, `&&`, `??` | the most useful number |
| Functions | functions called at least once | finds dead or untested exports |

Coverage proves code *ran*, not that it was *checked*. Use it to find untested risky code (payment paths, auth checks, error handling), not as a target. A floor like 80% lines / 75% branches stops regressions without rewarding junk tests.

also seen: mutation testing (Stryker) changes your code and checks that some test fails. It measures assertion quality, at a large CPU cost.

### Why tests flake
| Cause | Symptom | Fix |
|:--|:--|:--|
| Real time and dates | fails at midnight, month end, in CI's time zone | inject the clock, fake timers, `TZ=UTC` |
| Order dependence | fails only with other files | isolate state; run with `--sequence.shuffle` |
| Shared data | unique-constraint errors, wrong counts | factories with unique values, cleanup per test |
| Fixed sleeps | `setTimeout(500)` too short on slow CI | wait for the condition, not a duration |
| Un-awaited promises | assertions after the test ended | `await` everything; lint `no-floating-promises` |
| Real network | third-party outages fail your build | MSW or stubs at the edge |
| Randomness | rare inputs fail | seed it, and log the seed on failure |
| Resource limits | timeouts under parallel load | raise `testTimeout` for integration only, limit workers |

Policy: when a test flakes, **quarantine it** (skip with a linked issue and an owner), fix the root cause within days, then restore it. Automatic retries hide flakiness; use them only as a short-term measure for E2E.

### Tests in CI
| Practice | Why |
|:--|:--|
| Run on every PR and on `main` | catch breaks before and after merge |
| Fast checks first (types, lint, unit), slow later (integration, E2E) | quick feedback |
| Fail on `.only`, missing coverage floor, or snapshot drift | keep the suite honest |
| Shard long suites: `--shard=1/3` across a matrix | wall time drops roughly linearly |
| JUnit report + job summary | readable failures in the PR |
| Cache the pnpm store | install time down to seconds |
| `timeout-minutes` on the job | a hung test can't burn hours |

## Example
`vitest.config.ts` with coverage and CI-friendly settings:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    restoreMocks: true,
    sequence: { shuffle: true }, // exposes order-dependent tests early
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/server.ts'],
      thresholds: { lines: 80, branches: 75, functions: 80 },
      reporter: ['text', 'html', 'json-summary'],
    },
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'reports/junit.xml' },
  },
});
```
`pnpm add -D @vitest/coverage-v8`, then `pnpm vitest run --coverage`.

`.github/workflows/test.yml` (pin actions to commit SHAs in real repos; see [04-ci-cd](../../04-ci-cd/README.md)):
```yaml
name: test
on: [pull_request, push]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest run --shard=${{ matrix.shard }}/3
        env:
          TZ: UTC
```
Docker is preinstalled on Ubuntu runners, so Testcontainers works without extra setup.

## Production patterns
- **Coverage floor, not a target.** Ratchet it up as the suite matures; review uncovered branches in risky files.
- **Zero tolerance for known flakes on main.** Quarantine within a day, with an owner and a ticket.
- **Wait for conditions:** `expect.poll(() => getStatus()).toBe('done')` or `vi.waitFor`, never fixed sleeps.
- **Reproduce CI failures locally** with the same seed and env: `TZ=UTC pnpm vitest run --sequence.seed=<seed>`.
- **Track suite time.** When the PR job passes ~10 minutes, shard or split integration tests.

## Mistakes
Wrong: a test written only to raise coverage.
```ts
it('covers formatPrice', () => {
  formatPrice(100); // runs the code, asserts nothing
});
```
Right:
```ts
it('formats cents as euros', () => {
  expect(formatPrice(1999, 'EUR', 'de-DE')).toBe('19,99 €');
});
```

Wrong: retries as the fix.
```ts
test('syncs inventory', { retry: 3 }, async () => { /* flaky because of a race */ });
```
Right: find the race (un-awaited promise, shared data), fix it, then remove the retry.

Wrong: sleeping for async work.
```ts
await new Promise((r) => setTimeout(r, 1000));
expect(job.status).toBe('done');
```
Right:
```ts
await expect.poll(() => getJob(id).then((j) => j.status), { timeout: 5_000 }).toBe('done');
```

## Check yourself
1. Why is branch coverage more useful than line coverage?
2. A test fails only in CI, around 00:00 UTC. What do you suspect?
3. What is the cost of auto-retrying failed tests?

<details>
<summary>Answers</summary>

1. A line like `if (a && b) refund()` can be fully "covered" by one test, while the `a && !b` path never runs. Branch coverage shows untested decisions.
2. Date or time-zone handling: the code or test uses the real clock, and "today" differs between the developer's zone and UTC. Inject the clock or fake timers and set `TZ=UTC`.
3. It hides real intermittent bugs (races that also happen in production), slows the pipeline, and trains people to ignore red builds.
</details>

## Sources
- [Vitest — Coverage](https://vitest.dev/guide/coverage.html)
- [Vitest — CLI (`--shard`, `--sequence.shuffle`)](https://vitest.dev/guide/cli.html)
- [Vitest — Reporters](https://vitest.dev/guide/reporters.html)
- [Google Testing Blog — Flaky tests at Google](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html)
- [GitHub Docs — Building and testing Node.js](https://docs.github.com/en/actions/use-cases-and-examples/building-and-testing/building-and-testing-nodejs)
