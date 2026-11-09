---
title: DRY, KISS, YAGNI, Demeter, tell don't ask, CQS
tech: TypeScript 6 (strict)
version: TypeScript 6.0, Node.js 26 LTS
date: 2026-11-07
covers: [7, 8]
---
# DRY, KISS, YAGNI, Demeter, tell don't ask, CQS
[← Overview](00-overview.md)

## Why it matters
- Two endpoints share a `formatAddress()` helper because the code looked the same. Shipping labels need a new format; invoices must not change. The shared helper grows a `mode` flag and breaks both.
- A team builds a generic rules engine for discounts "in case marketing needs it". Marketing needs two kinds of coupon; the engine costs a month and nobody understands it.
- `order.customer.account.billing.address.country` appears in 30 places. A change to how billing is modeled touches all of them.

## Concepts

### DRY, KISS, YAGNI
| Principle | Meaning | Misuse |
|:--|:--|:--|
| DRY (Don't Repeat Yourself) | every piece of **knowledge** has one authoritative place | merging code that merely looks alike |
| KISS (Keep It Simple) | the simplest design that works | "simple" hacks that skip validation or tests |
| YAGNI (You Aren't Gonna Need It) | don't build for imagined future needs | skipping things you do need now (logging, security) |
| Rule of three | abstract after the third real repetition | abstracting on the first copy |
| AHA (Avoid Hasty Abstractions) | prefer duplication over the wrong abstraction | — |

DRY is about **knowledge**, not text. Two identical-looking functions that change for different reasons aren't duplication; one business rule implemented in three places is, even if the code differs.

Beck's four rules of simple design, in priority order: passes the tests · reveals intention · no duplication (of knowledge) · fewest elements.

### Law of Demeter, tell don't ask, CQS
| Principle | Meaning | Example |
|:--|:--|:--|
| Law of Demeter ("talk to friends") | a method calls methods of itself, its parameters, objects it creates, its fields; not of their internals | avoid `a.b().c().d()` chains into others' structures |
| Tell, don't ask | tell an object to do something instead of pulling its data and deciding for it | `cart.add(item)` rather than reading `cart.lines` and pushing |
| Command–query separation (CQS) | a function either changes state (command) or returns data (query), not both | `stack.pop()` is a known exception |
| Principle of least astonishment | code behaves the way readers expect | a getter that writes to the database surprises |
| Fail fast | detect invalid states early and loudly | validate at boundaries and in constructors |

Fluent builders (`query.where().orderBy()`) and data transformations (`items.filter().map()`) don't violate Demeter: they return the same kind of object, not someone else's internals.

## Example
DRY by knowledge, not by shape:
```ts
// Two formatters that look alike but serve different actors: keep them separate
export const formatShippingLabelAddress = (a: Address) => [a.name, a.line1, `${a.postalCode} ${a.city}`, a.country.toUpperCase()].join('\n');
export const formatInvoiceAddress = (a: Address) => [a.name, a.line1, `${a.postalCode} ${a.city}`, countryName(a.country)].join(', ');

// One rule, one place: VAT rates used by checkout, invoices, and reports
export const VAT_RATES = { DE: 0.19, AT: 0.2, FR: 0.2 } as const satisfies Record<string, number>;
```
YAGNI: two coupon types today, a union is enough.
```ts
type Coupon = { kind: 'percent'; percent: number } | { kind: 'fixed'; cents: number };
// No rule engine, DSL, or plugin system until real requirements exist
```
Law of Demeter and tell don't ask:
```ts
// Wrong: digging through other objects' structure
if (order.customer.account.billing.address.country === 'DE') applyGermanVat(order);

// Right: ask the object that owns the knowledge
if (order.billingCountry() === 'DE') applyGermanVat(order);

// Wrong: ask, then decide for the object
if (cart.lines.length < 50 && !cart.checkedOut) cart.lines.push(line);

// Right: tell it; the cart enforces its own rules
cart.add(line);
```
CQS:
```ts
// Wrong: a query with a side effect
function getNextInvoiceNumber() { return ++counter; }   // reading it twice skips a number

// Right: separate command and query
function reserveInvoiceNumber(): number { counter += 1; return counter; } // named as a command
function peekNextInvoiceNumber(): number { return counter + 1; }
```

## In our stack
- One source of truth for knowledge: Zod schemas shared by form and API ([02-frontend/10-forms](../../../02-frontend/10-forms/README.md)); `priceOrder` in the domain module used by checkout and reconciliation.
- Tell don't ask: domain objects enforce their rules (`assertCancellable`, `cart.add`) in [03-backend/11-architecture](../../../03-backend/11-architecture/README.md).
- CQS at the API level: GET is safe, POST/PATCH change state ([03-backend/02-api-design](../../../03-backend/02-api-design/README.md)); CQRS extends the idea to whole models ([07-distributed-systems](../../07-distributed-systems/README.md)).

## When not to
- Don't de-duplicate test setup so aggressively that each test becomes unreadable; tests favor clarity over DRY.
- Don't apply Demeter to plain data structures (DTOs, config objects); reading fields of data is fine.
- KISS and YAGNI don't excuse skipping security, validation, or observability: those are current requirements.

## Production patterns
- **One home for every business rule**, imported everywhere it's needed.
- **Duplicate first, abstract on the third real case**, and only when the copies change for the same reason.
- **Objects that enforce their own rules** (tell, don't ask) and short call chains.
- **Commands and queries named and separated**, especially across APIs.

## Mistakes
Wrong: a shared helper with mode flags after "DRYing" unrelated code.
```ts
formatAddress(a, { forInvoice: true, upper: false, includeCountryName: true }); // two concerns welded together
```
Right: two functions, each owned by its use case.

Wrong: speculative generality: abstract base classes, plugin hooks, and config options nobody uses. Right: the simplest code for today's requirements, refactored when a new requirement arrives.

Wrong: getters with side effects (`get total() { this.recalculateAndSave(); … }`). Right: queries don't change state.

## Check yourself
1. When is duplicated-looking code not a DRY violation?
2. What does the Law of Demeter protect against?
3. Give an example of a CQS violation and its fix.

<details>
<summary>Answers</summary>

1. When the copies represent different knowledge that changes for different reasons (shipping label vs invoice format). Merging them couples unrelated changes; DRY is about one authoritative place per piece of knowledge, not identical text.
2. Coupling to the internal structure of distant objects: long chains break whenever any object in the chain changes its structure. Asking the nearest object for what you need keeps that knowledge in one place.
3. A function that returns the next invoice number and also increments the counter: calling it twice to "check" skips a number. Split it into a command (`reserveInvoiceNumber`) and a side-effect-free query (`peekNextInvoiceNumber`).
</details>

## Sources
- [Martin Fowler — Beck design rules](https://martinfowler.com/bliki/BeckDesignRules.html)
- [Sandi Metz — The wrong abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)
- [Martin Fowler — Tell don't ask](https://martinfowler.com/bliki/TellDontAsk.html)
- [Martin Fowler — Command query separation](https://martinfowler.com/bliki/CommandQuerySeparation.html)
- [Martin Fowler — Yagni](https://martinfowler.com/bliki/Yagni.html)
