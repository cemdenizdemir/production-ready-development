---
title: Functional programming, algebraic data types, and errors
tech: TypeScript 6 (strict)
version: TypeScript 6.0, Node.js 26 LTS (structuredClone, toSorted, Object.groupBy)
date: 2026-11-07
covers: [5, 6, 9]
---
# Functional programming, algebraic data types, and errors
[← Overview](00-overview.md)

## Why it matters
- A helper sorts the array it receives (`items.sort()`). The caller's list order changes, and a dashboard shows the wrong "top 10" for a week.
- Payment results are `{ ok: boolean; error?: string; paymentId?: string }`. Code reads `paymentId` when `ok` is false, and an order is marked paid with `undefined`.
- A new order status is added; three `if` chains silently fall through to "unknown" because nothing forced them to handle it.

## Concepts

### Functional essentials
| Idea | Meaning | TypeScript |
|:--|:--|:--|
| Pure function | same input → same output, no side effects | no I/O, no mutation, no `Date.now()` inside |
| Immutability | never change data in place; create new values | `readonly`, spread, `toSorted()`, `with()` |
| First-class functions | functions as values | callbacks, function types |
| Higher-order functions | take or return functions | `map`, `filter`, `reduce`, factories |
| Closures | functions remember their scope | private state without classes |
| Composition | build behavior from small functions | `pipe(a, b, c)` helpers or plain nesting |
| Referential transparency | an expression can be replaced by its value | makes refactoring safe |

Non-mutating array methods (ES2023+): `toSorted`, `toReversed`, `toSpliced`, `with`. Also `structuredClone` for deep copies and `Object.groupBy` for grouping.

### Algebraic data types (ADTs)
| Kind | Meaning | TypeScript |
|:--|:--|:--|
| Product type | A **and** B | object types `{ a: A; b: B }`, tuples |
| Sum type | A **or** B | discriminated unions `{ kind: 'a' } \| { kind: 'b' }` |
| Exhaustiveness | every variant handled | `switch` + `never` check (`assertNever`) |
| Option | value or nothing | `T \| undefined` with strict null checks |
| Result | success or failure | `{ ok: true; value: T } \| { ok: false; error: E }` |

**Make illegal states unrepresentable**: instead of optional fields that only make sense together, give each state its own variant.

### Errors across paradigms
| Style | Use for | TypeScript |
|:--|:--|:--|
| Exceptions | unexpected failures, bugs, infrastructure errors | `throw`, `try/catch`, `cause` |
| Result values | expected outcomes the caller must handle (declined payment, validation) | union types |
| `null`/`undefined` | "not found" for simple lookups | strict null checks |
| Error codes inside results | stable identifiers for clients | `code: 'payment.declined'` |

Rule of thumb: **expected business outcomes → results; unexpected failures → exceptions.** Don't build elaborate monad libraries in application code; also seen: Effect, neverthrow, fp-ts.

## Example
`src/payment-result.ts` — a sum type that makes misuse impossible.
```ts
export type PaymentResult =
  | { status: 'succeeded'; paymentId: string; amountCents: number }
  | { status: 'declined'; reason: 'insufficient_funds' | 'card_declined' | 'expired_card' }
  | { status: 'requires_action'; clientSecret: string };

export function assertNever(value: never): never {
  throw new Error(`unhandled variant: ${JSON.stringify(value)}`);
}

export function nextStep(result: PaymentResult): string {
  switch (result.status) {
    case 'succeeded': return `paid ${result.paymentId}`;       // paymentId exists only here
    case 'declined': return `show message for ${result.reason}`;
    case 'requires_action': return 'start 3DS challenge';
    default: return assertNever(result);                        // adding a variant breaks the build here
  }
}
```
A small `Result` type with a validating constructor:
```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type Quantity = number & { readonly __brand: 'Quantity' };

export function parseQuantity(input: unknown): Result<Quantity, 'not_integer' | 'out_of_range'> {
  if (typeof input !== 'number' || !Number.isInteger(input)) return err('not_integer');
  if (input < 1 || input > 99) return err('out_of_range');
  return ok(input as Quantity);
}
```
Immutable updates and composition:
```ts
type Line = { readonly sku: string; readonly qty: number; readonly priceCents: number };

const byValueDesc = (lines: readonly Line[]) => lines.toSorted((a, b) => b.qty * b.priceCents - a.qty * a.priceCents);
const top = (n: number) => <T>(xs: readonly T[]) => xs.slice(0, n);
const pipe = <T>(value: T, ...fns: Array<(x: any) => any>) => fns.reduce((acc, fn) => fn(acc), value);

const top3 = pipe(lines, byValueDesc, top(3));                    // `lines` is unchanged
const withQty = (lines: readonly Line[], i: number, qty: number) => lines.with(i, { ...lines[i]!, qty });
```
Exceptions for the unexpected, with a cause chain:
```ts
try {
  await repo.save(order);
} catch (cause) {
  throw new Error(`saving order ${order.id} failed`, { cause });   // keeps the original error
}
```

## In our stack
- Results for expected outcomes: the `PaymentGateway.charge()` result in [03-backend/11-architecture lesson 02](../../../03-backend/11-architecture/docs/02-di-ports-adapters.md).
- Exhaustive unions: problem types, job names, webhook event types ([03-backend/12-integrations lesson 02](../../../03-backend/12-integrations/docs/02-stripe-webhooks-reconciliation.md)).
- Immutability: React state updates and TanStack Query caches ([02-frontend/04-framework](../../../02-frontend/04-framework/README.md)).
- Zod `safeParse` returns a result type: validation at the edge.

## When not to
- Don't replace every exception with results; infrastructure failures are better as exceptions caught at the boundary.
- Don't write point-free pipelines that nobody can read; named intermediate values are fine.
- Don't deep-clone large structures in hot paths "for safety"; share immutable data instead.

## Production patterns
- **Discriminated unions with exhaustive `switch`** for every set of variants.
- **Results for expected business outcomes**, exceptions with `cause` for unexpected ones.
- **Non-mutating array methods** and `readonly` types by default.
- **Pure functions** for anything that decides; side effects pushed to the edges.

## Mistakes
Wrong: optional fields for states.
```ts
type Payment = { ok: boolean; paymentId?: string; error?: string }; // ok:false with a paymentId compiles fine
```
Right: one variant per state, each with exactly its fields.

Wrong: mutating arguments.
```ts
function topSellers(items: Item[]) { return items.sort(bySales).slice(0, 10); } // sorts the caller's array
```
Right: `items.toSorted(bySales).slice(0, 10)`.

Wrong: `if/else` chains over variants without a `default: assertNever(x)`. Right: exhaustive `switch` so new variants fail the build.

## Check yourself
1. What makes a function pure, and why does it matter for tests?
2. How does a discriminated union prevent reading `paymentId` from a declined payment?
3. When should you return a result instead of throwing?

<details>
<summary>Answers</summary>

1. It returns the same output for the same input and has no side effects (no I/O, no mutation, no clock or randomness inside). Tests are plain input/output assertions with no setup or mocks, and results never depend on test order.
2. `paymentId` exists only on the `succeeded` variant. TypeScript lets you access it only after narrowing on `status === 'succeeded'`, so code for other variants doesn't compile.
3. When the failure is an expected business outcome the caller must handle (declined payment, invalid quantity, out of stock). Unexpected failures (bugs, network or database errors) stay exceptions handled at the boundary.
</details>

## Sources
- [TypeScript Handbook — Discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- [MDN — Array.prototype.toSorted()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted)
- [MDN — Error: cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)
- [Scott Wlaschin — Making illegal states unrepresentable](https://fsharpforfunandprofit.com/posts/designing-with-types-making-illegal-states-unrepresentable/)
- [Scott Wlaschin — Railway oriented programming](https://fsharpforfunandprofit.com/rop/)
