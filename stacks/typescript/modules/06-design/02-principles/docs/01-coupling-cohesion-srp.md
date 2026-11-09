---
title: Coupling, cohesion, SRP, and separation of concerns
tech: TypeScript 6 (strict)
version: TypeScript 6.0, Node.js 26 LTS
date: 2026-11-07
covers: [1, 2, 9]
---
# Coupling, cohesion, SRP, and separation of concerns
[← Overview](00-overview.md)

## Why it matters
- Changing the invoice PDF layout breaks order confirmation emails, because both live in one `OrderService` that also reads the orders table directly.
- A `utils.ts` with 80 unrelated helpers is imported by every module. Any change triggers a full test run and frequent merge conflicts.
- The checkout route validates input, computes prices, writes SQL, calls Stripe, and sends email. Nobody dares to touch it.

## Concepts

### Coupling and cohesion
| Measure | Meaning | Goal |
|:--|:--|:--|
| Coupling | how much a unit depends on other units' details | low |
| Cohesion | how strongly the parts of a unit belong together | high |

| Coupling type (worst → better) | Example |
|:--|:--|
| Content | reaching into another module's private data or tables |
| Common / global | shared mutable globals, a shared `ctx` object |
| Control | passing flags that select behavior (`save(order, true, false)`) |
| Stamp | passing a whole object when two fields are needed |
| Data | passing only the values needed |
| Message / event | communicating through events or narrow interfaces |

| Cohesion type (worst → better) | Example |
|:--|:--|
| Coincidental | `utils.ts` with unrelated helpers |
| Logical | `handlers.ts` grouping all handlers by technical kind |
| Temporal | "things that run at startup" |
| Functional | everything needed for one responsibility (`pricing`) |

### Single Responsibility Principle (SRP)
"A module should have one, and only one, **reason to change**", where a reason is usually an **actor**: a group of people who request changes (finance, marketing, operations). Code that changes for different actors at different times should be separated.

| Responsibility (actor) | Belongs in |
|:--|:--|
| Order pricing (product/finance) | `orders/pricing.ts` |
| Invoice layout (finance/legal) | `invoices/render.ts` |
| Email wording (marketing) | `notifications/templates/` |
| Persistence (engineering) | `orders/orders.repo.ts` |

SRP is not "one function per file" or "classes with one method". It's about grouping what changes together and separating what changes for different reasons.

### Separation of concerns and information hiding
| Principle | Meaning |
|:--|:--|
| Separation of concerns | each part handles one concern: HTTP, business rules, persistence, presentation |
| Information hiding (Parnas) | hide design decisions likely to change behind a stable interface |
| Policy vs detail | high-level rules (policy) shouldn't depend on low-level mechanisms (detail) |
| Deep modules (Ousterhout) | simple interface, substantial functionality behind it |

## Example
Before: one class, many reasons to change.
```ts
class OrderService {
  async placeOrder(req: Request) {
    const body = JSON.parse(req.body);                                  // HTTP concern
    const total = body.items.reduce((s, i) => s + i.price * i.qty, 0); // pricing (and trusts client prices)
    await db.query('INSERT INTO orders …', [total]);                   // persistence
    await stripe.paymentIntents.create({ amount: total });             // payments
    await ses.send(renderEmail(body.email, total));                    // marketing copy
    return generatePdf(total);                                          // invoice layout
  }
}
```
After: each part has one reason to change; the use case composes them.
```ts
// orders/pricing.ts — changes when pricing rules change
export function priceOrder(lines: readonly PricedLine[], discount?: Discount): number {
  return applyDiscount(subtotal(lines), discount);
}

// orders/place-order.ts — changes when the checkout workflow changes
export function createPlaceOrder(deps: {
  catalog: CatalogReader; orders: OrderWriter; payments: PaymentGateway; events: EventPublisher;
}) {
  return async function placeOrder(cmd: PlaceOrderCommand) {
    const lines = await deps.catalog.priceLines(cmd.items);       // prices from the catalog, not the client
    const total = priceOrder(lines, cmd.discount);
    const order = await deps.orders.create({ customerId: cmd.customerId, lines, total });
    const payment = await deps.payments.charge({ orderId: order.id, amountCents: total, idempotencyKey: `order-${order.id}` });
    if (!payment.ok) return { ok: false as const, reason: payment.reason };
    await deps.events.publish({ type: 'order.paid', orderId: order.id }); // emails and invoices react elsewhere
    return { ok: true as const, orderId: order.id };
  };
}
```
The route (HTTP), the email templates (marketing), and the invoice renderer (finance) live in their own modules and react to `order.paid`.

## In our stack
- Layers inside a module (routes, use cases, domain, repositories) are separation of concerns: [03-backend/11-architecture lesson 01](../../../03-backend/11-architecture/docs/01-goals-layers-modules.md).
- Feature modules with public `index.ts` files keep coupling low and cohesion high.
- Events through the outbox decouple orders from notifications ([03-backend/07-background-jobs lesson 04](../../../03-backend/07-background-jobs/docs/04-outbox-messaging-monitoring.md)).

## When not to
- Don't split a 40-line script into six files "for SRP". Split when parts change for different reasons, or when they become hard to understand together.
- Don't create shallow wrappers (a "service" that only forwards calls); they add coupling without hiding anything.

## Production patterns
- **Group by feature**, separate by reason to change.
- **Narrow parameters** (data coupling) and events between modules (message coupling).
- **No `utils` dumping grounds**: helpers live in the module that owns the concept.
- **Deep modules**: small interfaces hiding real complexity (pricing, payments).

## Mistakes
Wrong: flag arguments.
```ts
saveOrder(order, true, false); // what do true and false mean? two behaviors in one function
```
Right: two functions (`saveDraft`, `submitOrder`) or an options object with named fields.

Wrong: reaching into another module's tables (`SELECT … FROM payments` inside orders). Right: ask the payments module through its public API.

Wrong: SRP read as "one method per class". Dozens of tiny classes with no cohesion. Right: one reason to change per unit.

## Check yourself
1. What's the difference between coupling and cohesion?
2. How do you decide whether two pieces of code violate SRP by living together?
3. Why are flag arguments a coupling smell?

<details>
<summary>Answers</summary>

1. Coupling measures dependencies between units (lower is better); cohesion measures how well the contents of one unit belong together (higher is better). Good modules are cohesive inside and loosely coupled outside.
2. Ask who requests changes to each piece and when. If different actors (finance, marketing, engineering) change them for different reasons, they should be separated; if they always change together, they belong together.
3. The caller controls the callee's internal flow (control coupling): it must know which internal behavior each flag selects, and the function mixes several behaviors that change independently.
</details>

## Sources
- [Robert C. Martin — The Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html)
- [David Parnas — On the criteria to be used in decomposing systems into modules](https://dl.acm.org/doi/10.1145/361598.361623)
- [John Ousterhout — A Philosophy of Software Design](https://web.stanford.edu/~ouster/cgi-bin/book.php)
- [Wikipedia — Coupling (computer programming)](https://en.wikipedia.org/wiki/Coupling_(computer_programming))
