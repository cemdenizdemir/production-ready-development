---
title: Code comments and docs as code
tech: TypeScript (TSDoc), Markdown, GitHub Actions
version: TypeScript 6.0, GitHub Actions (Nov 2026)
date: 2026-11-07
covers: [9, 11]
---
# Code comments and docs as code
[← Overview](00-overview.md)

## Why it matters
- A comment says "retries 3 times"; the code was changed to 5 a year ago. The comment is now a bug report waiting to happen.
- A clever bit-twiddling function has no comment, and the next person "simplifies" it and breaks pricing for edge cases.
- The docs folder is full of dead links after a restructure. Readers hit 404s and stop trusting the docs.

## Concepts

### What deserves a comment
| Comment | Example | Keep? |
|:--|:--|:--|
| Why (constraint, trade-off, business rule) | "Stripe retries webhooks for 3 days, so keys live 4 days" | ✓ |
| Warning | "Order matters: auth must run before rate limiting by user ID" | ✓ |
| Link to context | "See ADR 0007" or the incident ID | ✓ |
| TSDoc on exported APIs | parameters, return value, errors, example | ✓ |
| What the next line does | "increment i" | ✗ rename instead |
| Commented-out code | old implementation | ✗ delete; Git has it |
| TODO without owner | "TODO fix later" | ✗ ticket link or remove |

Prefer code that explains itself: good names, small functions, types that encode rules. Comments explain what code can't: *why*.

### TSDoc
`/** ... */` blocks on exported functions, types, and modules. Editors show them on hover; tools can build reference sites from them.

| Tag | Use |
|:--|:--|
| summary line | what it does, one sentence |
| `@param name` | meaning, units, constraints |
| `@returns` | what comes back |
| `@throws` | which errors and when |
| `@example` | a short usage snippet |
| `@deprecated` | replacement and removal plan; editors strike it through |
| `@see` / `{@link X}` | related code or docs |
| `@remarks` | longer explanation |

### Docs as code
| Practice | How |
|:--|:--|
| Docs live in the repo | Markdown under `docs/`, next to the code |
| Same PR as the change | PR template asks "docs updated?" |
| CODEOWNERS for docs | the owning team reviews |
| CI checks | broken links, generated files up to date (`openapi.json`), spelling (optional) |
| Generated reference | API (OpenAPI), config keys (from the Zod schema), CLI help |
| Freshness | `Last reviewed` dates on runbooks; review quarterly |

## Example
`src/money.ts`
```ts
/**
 * Splits an amount into `parts` integer shares that add up exactly to the total.
 *
 * Remainder cents go to the first shares, so the result is deterministic.
 * Used for split payments; floats would lose cents (see ADR 0004).
 *
 * @param totalCents - Total in cents. Must be a non-negative integer.
 * @param parts - Number of shares. Must be an integer of at least 1.
 * @returns Shares in cents, largest first; their sum equals `totalCents`.
 * @throws RangeError if either argument is out of range.
 * @example
 * splitCents(1000, 3); // [334, 333, 333]
 */
export function splitCents(totalCents: number, parts: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new RangeError('totalCents must be a non-negative integer');
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError('parts must be an integer >= 1');
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** @deprecated Use {@link splitCents}; removal in v3.0. */
export function splitAmount(total: number, parts: number): number[] {
  return splitCents(Math.round(total * 100), parts).map((c) => c / 100);
}
```
`.github/workflows/docs.yml` — keep generated docs current and links working.
```yaml
name: docs
on: [pull_request]
permissions:
  contents: read
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: ./.github/actions/setup
      - name: OpenAPI file is up to date
        run: |
          node scripts/write-openapi.ts
          git diff --exit-code openapi.json || { echo "Run: node scripts/write-openapi.ts and commit"; exit 1; }
      - name: Check Markdown links
        uses: lycheeverse/lychee-action@v2
        with:
          args: --offline --no-progress './**/*.md'
```
`--offline` checks only relative links inside the repo: fast and never flaky. Run a full external link check on a weekly schedule instead.

## Production patterns
- **Comment why, not what.** If you must explain what, first try a better name or a smaller function.
- **TSDoc on every exported function in shared packages**, with units (cents, ms) and thrown errors.
- **`@deprecated` with a replacement and a removal version**; lint flags uses (typescript-eslint `no-deprecated`).
- **Generated docs are checked in CI** so they can't silently fall behind.
- **Docs ownership:** CODEOWNERS on `docs/`, a review date on runbooks, and docs updates in the Definition of Done.

## Mistakes
Wrong: comments that restate code.
```ts
// loop over orders
for (const order of orders) { /* ... */ }
```
Right: no comment, or one about a non-obvious reason.

Wrong: units missing.
```ts
/** Timeout for the payment call. */
export const PAYMENT_TIMEOUT = 5000;
```
Right:
```ts
/** Payment provider timeout in milliseconds; their p99 is 2.1 s (Grafana: payments-latency). */
export const PAYMENT_TIMEOUT_MS = 5_000;
```

Wrong: `// TODO: handle errors`. Right: `// TODO(ORD-231): retry on 503 from the tax service` or fix it now.

Wrong: external link checks on every PR. Third-party sites flap and block your merges.
Right: offline (internal) checks on PRs, external checks on a schedule.

## Check yourself
1. Give two kinds of comments worth keeping and two worth deleting.
2. What should a `@deprecated` tag always contain?
3. Why check generated docs (like `openapi.json`) in CI?

<details>
<summary>Answers</summary>

1. Keep: why-comments (constraints, business rules), warnings about non-obvious ordering or side effects, links to ADRs or incidents. Delete: comments that repeat the code, commented-out code, ownerless TODOs.
2. What to use instead and when the deprecated thing will be removed.
3. So reviewers see API changes in the diff, and so the published reference can never fall behind the code without CI failing.
</details>

## Sources
- [TSDoc](https://tsdoc.org/)
- [TypeScript — JSDoc reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [typescript-eslint — `no-deprecated`](https://typescript-eslint.io/rules/no-deprecated/)
- [Write the Docs — Docs as Code](https://www.writethedocs.org/guide/docs-as-code/)
- [lychee link checker](https://github.com/lycheeverse/lychee)
