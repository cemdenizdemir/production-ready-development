---
title: Programming paradigms and choosing a style
tech: TypeScript 6 (strict)
version: TypeScript 6.0, Node.js 26 LTS
date: 2026-11-07
covers: [1, 10]
---
# Programming paradigms and choosing a style
[← Overview](00-overview.md)

## Why it matters
- A Java-style codebase in TypeScript: `OrderManager`, `OrderManagerFactory`, `AbstractOrderProcessor`. Simple changes touch five classes, and nobody can find where prices are calculated.
- The opposite: one 900-line file of functions passing a mutable `ctx` object around. Every function can change anything, and bugs appear far from their cause.
- A React team mixes class components, hooks, and Redux reducers without a reason. New developers can't tell which style to follow.

## Concepts

### The main paradigms
| Paradigm | Idea | In TypeScript | Good at |
|:--|:--|:--|:--|
| Imperative | step-by-step state changes | `for` loops, assignments | low-level control, performance hot spots |
| Procedural | imperative code grouped into procedures | plain functions | scripts, simple workflows |
| Object-oriented | objects bundle state and behavior behind an interface | classes, closures, interfaces | identity, lifecycle, protecting invariants |
| Functional | pure functions over immutable data, composition | arrow functions, `map`/`filter`/`reduce`, unions | transformations, testability, concurrency safety |
| Declarative | describe *what*, not *how* | SQL, JSX, Zod schemas, CSS | queries, UIs, validation, config |
| Reactive | values over time, change propagation | React state, signals, event streams | UIs, live data |
| Event-driven | react to events | Node `EventEmitter`, queues | I/O, integration |

TypeScript is **multi-paradigm**. Real code mixes them: a React component (declarative) calls hooks (reactive) that run a pure `priceOrder` function (functional) on data from a repository class (object-oriented), triggered by a click event (event-driven).

### Choosing a style
| Situation | Prefer | Why |
|:--|:--|:--|
| Something with identity and rules (an order, a cart, a connection pool) | object or closure with private state | protects invariants; one place for the rules |
| Data in, data out (pricing, formatting, mapping) | pure functions | trivial to test, no hidden state |
| "One of several shapes" (payment result, event types) | discriminated union | the compiler checks every case |
| Swappable behavior (payment providers, strategies) | interface or function type | substitute without `if` chains |
| Long-lived resources (DB pool, HTTP server) | object with clear lifecycle (`start`, `close`) | explicit setup and teardown |
| Configuration, schemas, queries | declarative definitions | readable, checkable, reusable |
| Hot loops with measured performance needs | imperative | avoid allocations |

Guidelines that work in TypeScript codebases:
- **Functional core, imperative shell**: pure decision logic inside; I/O (database, HTTP, time) at the edges.
- **Classes for things, functions for actions**: don't wrap a single function in a class.
- **Data is plain**: DTOs and records are types, not classes with getters.
- **Consistency within a module** beats personal preference.

## Example
`src/pricing.ts` — functional core: pure, deterministic, easy to test.
```ts
export type Line = { readonly productId: string; readonly unitPriceCents: number; readonly quantity: number };
export type Discount = { readonly kind: 'percent'; readonly percent: number } | { readonly kind: 'fixed'; readonly cents: number };

export const subtotal = (lines: readonly Line[]): number =>
  lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);

export function applyDiscount(amountCents: number, discount: Discount | undefined): number {
  if (!discount) return amountCents;
  switch (discount.kind) {
    case 'percent': return Math.round(amountCents * (1 - discount.percent / 100));
    case 'fixed': return Math.max(0, amountCents - discount.cents);
  }
}
```
`src/checkout.ts` — imperative shell: I/O around the core.
```ts
import { applyDiscount, subtotal } from './pricing.ts';

export async function checkout(cartId: string, deps: { carts: CartRepo; orders: OrderRepo; now: () => Date }) {
  const cart = await deps.carts.get(cartId);                        // I/O
  const total = applyDiscount(subtotal(cart.lines), cart.discount); // pure decision
  return deps.orders.create({ cartId, total, createdAt: deps.now() }); // I/O
}
```
`src/pool.ts` — an object where identity, lifecycle, and invariants matter.
```ts
export class ConnectionPool {
  readonly #max: number;
  #free: Connection[] = [];
  #closed = false;

  constructor(max: number) {
    if (max < 1) throw new RangeError('max must be at least 1');
    this.#max = max;
  }

  get size(): number { return this.#free.length; }

  async close(): Promise<void> {
    this.#closed = true;
    await Promise.all(this.#free.map((c) => c.end()));
    this.#free = [];
  }
}
```

## In our stack
- Functional core: domain functions such as `priceOrder` in [03-backend/11-architecture lesson 01](../../../03-backend/11-architecture/docs/01-goals-layers-modules.md).
- Objects with lifecycle: the `pg` pool, Redis clients, BullMQ workers, the HTTP server ([03-backend/01-language-runtime](../../../03-backend/01-language-runtime/README.md)).
- Declarative: Zod schemas, Drizzle table definitions, JSX, Terraform.
- Reactive: React state and TanStack Query caches ([02-frontend/05-state-management](../../../02-frontend/05-state-management/README.md)).

## When not to
- Don't build class hierarchies "for the future". Start with functions and types; introduce an object when state and invariants appear.
- Don't force pure functional style onto I/O-heavy glue code; a few clear `await`s are easier to read than monad-like wrappers.
- Don't mix styles inside one module without a reason.

## Production patterns
- **Functional core, imperative shell** for business logic.
- **Small objects with private state** for resources and rule-heavy concepts.
- **Discriminated unions** for variants; exhaustive `switch` statements.
- **Declarative definitions** (schemas, tables) as the single source of truth.

## Mistakes
Wrong: a class with no state, wrapping one function.
```ts
class PriceCalculator { calculate(lines: Line[]) { return lines.reduce(/* … */ 0); } }
new PriceCalculator().calculate(lines);
```
Right: `export const subtotal = (lines) => …`.

Wrong: parameter properties (`constructor(private max: number)`). Node's type stripping can't run them. Right: declare the field and assign it in the constructor.

Wrong: business rules mixed into I/O code, so testing pricing needs a database. Right: pure core, I/O shell.

## Check yourself
1. What does "functional core, imperative shell" mean, and why does it help testing?
2. When is a class a better choice than a set of functions?
3. Name three paradigms used together in a typical React + Express feature.

<details>
<summary>Answers</summary>

1. Decisions (pricing, validation, state transitions) live in pure functions without I/O; the shell around them reads inputs, calls the core, and performs side effects. The core can be tested with plain inputs and outputs, no mocks, and the shell stays thin.
2. When something has identity, a lifecycle, or invariants to protect over time (a pool, a cart with rules, a connection), so state and the rules that change it belong together behind a small interface.
3. Declarative (JSX, SQL, Zod), reactive (React state, query caches), functional (pure transformations), object-oriented (clients, repositories), and event-driven (handlers, queues) — any three.
</details>

## Sources
- [Gary Bernhardt — Functional core, imperative shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell)
- [TypeScript Handbook — Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html)
- [Node.js — TypeScript type stripping](https://nodejs.org/api/typescript.html#type-stripping)
- [MDN — First-class functions](https://developer.mozilla.org/en-US/docs/Glossary/First-class_Function)
