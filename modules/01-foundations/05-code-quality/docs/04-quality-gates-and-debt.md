---
title: Quality gates, reviews, and tech debt
tech: ESLint, typescript-eslint, Prettier, TypeScript 6, GitHub Actions
version: ESLint 10, TypeScript 6.0, Prettier 3
date: 2026-11-07
covers: [9, 10, 11, 12]
---
# Quality gates, reviews, and tech debt
[← Overview](00-overview.md)

## Why it matters
- The linter has 1,200 warnings. Nobody reads them, so the one that flags a real bug drowns too.
- A refactor leaves 40 unused exports and three unused dependencies. One of the dependencies has a critical CVE, and you ship it for a year.
- A team wants a new strict rule, but turning it on means fixing 900 files at once, so it never happens.

## Concepts

### The CI gate
| Check | Command | Fails on |
|:--|:--|:--|
| Types | `tsc` (`noEmit`) | any type error |
| Lint | `eslint . --max-warnings 0` | any error or warning |
| Format | `prettier --check .` | any unformatted file |
| Unused suppressions | `reportUnusedDisableDirectives: 'error'` | stale `eslint-disable` comments |

Zero warnings is the only stable number. Anything above zero only grows.

### Review standards: what tools can't check
| Area | Look for |
|:--|:--|
| Naming | names say what, not how: `unpaidInvoices`, not `list2` |
| Function size | one job each; early returns over deep nesting |
| Comments | explain *why* (a constraint, a trade-off, a link to the incident), not *what* |
| Errors | handled at the right level; no swallowed `catch {}` |
| Boundaries | input validated once at the edge (lesson 01) |
| Magic values | named constants: `MAX_UPLOAD_BYTES`, not `10485760` |
| Tests | new behavior has tests; bug fixes have a regression test |
| Scope | the PR does one thing; refactors separate from features |

### Dead code and dependency hygiene
| Tool | Finds |
|:--|:--|
| `noUnusedLocals`, `noUnusedParameters` | unused variables inside files |
| `@typescript-eslint/no-unused-vars` | the same, with ignore patterns |
| `pnpm why <pkg>` | why a package is installed |
| `pnpm outdated` | available updates |
| Dependabot (grouped) | update PRs and security alerts |
| knip | unused files, exports, and dependencies across the project (also seen; not in STACK.md) |

Delete dead code; git remembers it. Every dependency is code you ship, patch, and audit.

### Managing debt
| Technique | Use |
|:--|:--|
| Disable with a reason | `// eslint-disable-next-line rule -- reason, link` |
| `@ts-expect-error reason` over `@ts-ignore` | it errors once the problem is fixed, so it can't go stale |
| ESLint bulk suppressions (ESLint 9.24+) | `eslint --suppress-all` records existing violations in `eslint-suppressions.json`; new code must comply |
| Per-folder overrides | stricter rules for new modules first |
| Codemods | scripted mass changes (`jscodeshift`, `ts-morph`) instead of hand edits |
| Debt tickets with owners | debt you can see and plan, not hidden in comments |
| Boy-scout rule | leave touched code a little better, in a separate commit |

## Example
`.github/workflows/quality.yml` (job excerpt)
```yaml
quality:
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - uses: actions/checkout@v5
    - uses: ./.github/actions/setup          # pnpm + node + install (04-ci-cd lesson 04)
    - run: pnpm typecheck
    - run: pnpm lint
    - run: pnpm format:check
```
Adopting a strict rule in a big codebase without a flag day:
```bash
# 1. Turn the rule on in eslint.config.js, e.g. '@typescript-eslint/no-floating-promises': 'error'
# 2. Record today's violations; they stop failing the build, new ones still fail
pnpm eslint . --suppress-rule @typescript-eslint/no-floating-promises
git add eslint-suppressions.json && git commit -m "chore(lint): adopt no-floating-promises with baseline"
# 3. Fix files over time; shrink the baseline as violations disappear
pnpm eslint . --prune-suppressions
```
A suppression with a reason:
```ts
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- legacy SDK returns any; typed wrapper in PAY-412
const raw = legacyPaymentsSdk.fetchCharge(id);

// @ts-expect-error -- upstream types miss `retryAfter`; remove after @acme/sdk 4.2 (ISSUE-88)
const wait = response.retryAfter;
```

## Production patterns
- **Same commands locally and in CI** (`pnpm typecheck`, `pnpm lint`, `pnpm format:check`), so a green laptop means a green pipeline.
- **The gate is a required check.** Code that fails it can't merge ([04-ci-cd](../../04-ci-cd/README.md) lesson 05).
- **Baselines, not flag days**, for new rules on old code. Tighten one rule at a time.
- **Review checklist in the PR template** for the things tools can't see (naming, scope, tests, why-comments).
- **Monthly hygiene:** merge Dependabot groups, delete unused code and dependencies, prune suppressions.

## Mistakes
Wrong: warnings allowed in CI.
```json
"lint": "eslint ."
```
Right:
```json
"lint": "eslint . --cache --max-warnings 0"
```

Wrong: `@ts-ignore` everywhere.
```ts
// @ts-ignore
const total = order.totl; // typo hidden forever
```
Right: fix the type, or `@ts-expect-error` with a reason so the comment fails once it isn't needed.

Wrong: comments that repeat the code.
```ts
// increment retries by one
retries += 1;
```
Right: comments that explain a decision.
```ts
// Stripe retries webhooks for 3 days; keep idempotency keys 4 days to cover the window.
const IDEMPOTENCY_TTL_SECONDS = 4 * 24 * 60 * 60;
```

Wrong: commenting out old code "in case we need it". Right: delete it; history keeps it.

## Check yourself
1. Why is "zero warnings" a better CI rule than "fewer than 100 warnings"?
2. How do bulk suppressions let you adopt a new rule safely?
3. What is the difference between `@ts-ignore` and `@ts-expect-error`?

<details>
<summary>Answers</summary>

1. Zero is the only threshold that doesn't drift. Above zero, every new warning blends in, and nobody can tell old noise from a new bug.
2. Existing violations are recorded in a file and stop failing the build, while every new violation fails immediately. The team fixes old ones gradually and prunes the file.
3. `@ts-ignore` silences the next line forever, even if there is no error. `@ts-expect-error` silences it only while an error exists, and itself errors when the problem is fixed, so stale suppressions get removed.
</details>

## Sources
- [ESLint — Bulk suppressions](https://eslint.org/docs/latest/use/suppressions)
- [ESLint — Command line interface](https://eslint.org/docs/latest/use/command-line-interface)
- [TypeScript — `@ts-expect-error`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html#-ts-expect-error-comments)
- [Google — Code review developer guide](https://google.github.io/eng-practices/review/)
- [knip](https://knip.dev/)
