---
title: "Tactical building blocks: entities, value objects, aggregates, events"
tech: TypeScript, Node.js 26
version: TypeScript 6.0, Node.js 26 LTS
date: 2026-11-07
covers: [5, 6, 7]
---
# Tactical building blocks: entities, value objects, aggregates, events
[← Overview](00-overview.md)

## Why it matters
- Order lines are updated directly by a stock job. The order total no longer matches its lines, and invoices disagree with payments.
- An "aggregate" contains the customer, all their orders, and all addresses. Every checkout locks the customer row, and concurrent orders from the same account fail.
- Shipping is triggered by a direct call from ordering into fulfillment inside the payment transaction. A fulfillment error rolls back a successful payment record.

## Concepts

### Entities and value objects
| Block | Identity | Equality | Mutability | Shop examples |
|:--|:--|:--|:--|:--|
| Entity | stable ID | by ID | changes through behavior | Order, Customer, Shipment |
| Value object | none | by value | immutable | Money, Quantity, Address, EmailAddress, DateRange |

Prefer value objects: they're easy to test, safe to share, and carry validation. Many "entities" in early designs turn out to be values.

### Aggregates
An **aggregate** is a cluster of entities and values treated as one unit for changes, with a **root** that guards its **invariants**.
| Rule | Why |
|:--|:--|
| Modify only through the root | invariants are checked in one place |
| One aggregate per transaction | consistency boundary = transaction boundary; avoids locking clusters |
| Reference other aggregates by ID | no object graphs across boundaries |
| Keep aggregates small | less contention, faster loads |
| Invariants inside, eventual consistency outside | other aggregates update via domain events |
| Design for true invariants | "total = sum of lines" belongs inside; "customer has < 5 open orders" may not |

### Domain events
| Kind | Scope | Example |
|:--|:--|:--|
| Domain event | inside a context; raised by an aggregate | `OrderPlaced`, `LineAdded` |
| Integration event | between contexts; published contract | `order.paid` v1 via the outbox |

Events are **past tense**, immutable, and carry what consumers need (IDs plus a few facts). Aggregates record events; the application layer persists them (outbox) in the same transaction as the aggregate.

## Example
`ordering/domain/order.ts` — an aggregate root with invariants and recorded events.
```ts
import { Money } from '#src/shared/money.ts';

export type OrderId = string & { readonly __brand: 'OrderId' };
export type ProductId = string & { readonly __brand: 'ProductId' };
export type OrderStatus = 'draft' | 'placed' | 'paid' | 'cancelled';

export type OrderLine = { readonly productId: ProductId; readonly unitPrice: Money; readonly quantity: number };

export type OrderEvent =
  | { type: 'OrderPlaced'; orderId: OrderId; customerId: string; total: { cents: number; currency: string }; occurredAt: Date }
  | { type: 'OrderPaid'; orderId: OrderId; paymentId: string; occurredAt: Date }
  | { type: 'OrderCancelled'; orderId: OrderId; reason: string; occurredAt: Date };

export class Order {
  static readonly MAX_LINES = 50;
  readonly id: OrderId;
  readonly customerId: string;                   // another aggregate: referenced by ID only
  #status: OrderStatus;
  #lines: OrderLine[];
  #version: number;
  #events: OrderEvent[] = [];

  private constructor(id: OrderId, customerId: string, status: OrderStatus, lines: OrderLine[], version: number) {
    this.id = id; this.customerId = customerId; this.#status = status; this.#lines = lines; this.#version = version;
  }

  static draft(id: OrderId, customerId: string): Order { return new Order(id, customerId, 'draft', [], 0); }
  static restore(s: { id: OrderId; customerId: string; status: OrderStatus; lines: OrderLine[]; version: number }): Order {
    return new Order(s.id, s.customerId, s.status, [...s.lines], s.version);
  }

  get status() { return this.#status; }
  get version() { return this.#version; }
  get lines(): readonly OrderLine[] { return this.#lines; }
  get total(): Money {
    return this.#lines.reduce((sum, l) => sum.add(l.unitPrice.multiply(l.quantity)), Money.zero('EUR'));
  }

  addLine(line: OrderLine): void {
    this.#require('draft', 'add lines');
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) throw new DomainError('order.invalid_quantity', 'Quantity must be 1–99');
    if (this.#lines.length >= Order.MAX_LINES) throw new DomainError('order.too_many_lines', `At most ${Order.MAX_LINES} lines`);
    const existing = this.#lines.find((l) => l.productId === line.productId);
    this.#lines = existing
      ? this.#lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + line.quantity } : l))
      : [...this.#lines, line];
  }

  place(now: Date): void {
    this.#require('draft', 'place');
    if (this.#lines.length === 0) throw new DomainError('order.empty', 'Cannot place an empty order');
    this.#status = 'placed';
    this.#record({ type: 'OrderPlaced', orderId: this.id, customerId: this.customerId, total: { cents: this.total.amountCents, currency: this.total.currency }, occurredAt: now });
  }

  markPaid(paymentId: string, now: Date): void {
    if (this.#status === 'paid') return;                                  // idempotent: webhooks may repeat
    this.#require('placed', 'mark as paid');
    this.#status = 'paid';
    this.#record({ type: 'OrderPaid', orderId: this.id, paymentId, occurredAt: now });
  }

  cancel(reason: string, now: Date): void {
    if (this.#status === 'paid') throw new DomainError('order.paid_cannot_cancel', 'Paid orders are refunded, not cancelled');
    this.#require(['draft', 'placed'], 'cancel');
    this.#status = 'cancelled';
    this.#record({ type: 'OrderCancelled', orderId: this.id, reason, occurredAt: now });
  }

  pullEvents(): OrderEvent[] { const e = this.#events; this.#events = []; return e; }

  #record(e: OrderEvent) { this.#events.push(e); }
  #require(allowed: OrderStatus | OrderStatus[], action: string) {
    const ok = Array.isArray(allowed) ? allowed.includes(this.#status) : this.#status === allowed;
    if (!ok) throw new DomainError('order.invalid_state', `Cannot ${action} an order that is ${this.#status}`);
  }
}
```
Notes: `DomainError` comes from `shared/errors.ts`; `Money` is the value object from [01-paradigms-oop lesson 04](../../01-paradigms-oop/docs/04-polymorphism-and-data.md) with a `zero()` factory added. The total is computed from lines, so it can never disagree with them.

Aggregate boundaries for the shop:
| Aggregate | Contains | References by ID |
|:--|:--|:--|
| Cart | cart lines | customer, products |
| Order | order lines, status, totals | customer, products, payment |
| Payment (payments context) | attempts, status | order |
| Shipment (fulfillment) | parcels, tracking | order |
| StockItem (fulfillment) | on hand, reserved | SKU |

## In our stack
- Domain errors with codes: [03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-transactions.md).
- Events to other contexts via the outbox: [03-backend/07-background-jobs lesson 04](../../../03-backend/07-background-jobs/docs/04-outbox-messaging-monitoring.md).
- Value objects and branded IDs: [01-paradigms-oop lesson 04](../../01-paradigms-oop/docs/04-polymorphism-and-data.md).

## When not to
- No aggregate class for data without invariants (a product description, a log entry): a type and a query are enough.
- Don't put cross-aggregate rules into one giant aggregate to get immediate consistency; ask the business whether eventual consistency is acceptable (it usually is).
- Don't raise domain events nobody consumes.

## Production patterns
- **Small aggregates guarding true invariants**, modified only through the root, one per transaction.
- **IDs between aggregates**, events for cross-aggregate consequences.
- **Idempotent commands** where the outside world repeats messages (`markPaid`).
- **Optimistic concurrency** with a `version` on the root (lesson 04).

## Mistakes
Wrong: changing children directly.
```ts
await db.update(orderLines).set({ quantity: 5 }).where(eq(orderLines.id, lineId)); // the order's rules and totals are bypassed
```
Right: load the order, call `order.changeQuantity(...)`, save the aggregate.

Wrong: huge aggregates (customer with all orders). Every write contends on one root. Right: separate aggregates referenced by ID.

Wrong: calling other contexts synchronously inside the aggregate's transaction. Right: record an event; the outbox delivers it after commit.

## Check yourself
1. What makes something an entity rather than a value object?
2. Why "one aggregate per transaction"?
3. What's the difference between a domain event and an integration event?

<details>
<summary>Answers</summary>

1. An entity has a stable identity that persists while its attributes change (an order is the same order after its status changes); a value object is defined entirely by its values, has no identity, and is replaced rather than changed (two `Money(500, EUR)` are interchangeable).
2. The aggregate is the consistency boundary: its invariants hold after every transaction. Changing several aggregates in one transaction creates large locks and contention and hides boundaries; cross-aggregate consequences go through events and eventual consistency instead.
3. A domain event is raised and used inside one bounded context (in-process, internal shape); an integration event is a published, versioned contract delivered to other contexts (via the outbox and a queue), whose shape is part of the context's public API.
</details>

## Sources
- [Martin Fowler — DDD aggregate](https://martinfowler.com/bliki/DDD_Aggregate.html)
- [Vaughn Vernon — Effective aggregate design, part 1 (PDF)](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf)
- [Martin Fowler — Domain event](https://martinfowler.com/eaaDev/DomainEvent.html)
- [Eric Evans — DDD Reference (PDF)](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
