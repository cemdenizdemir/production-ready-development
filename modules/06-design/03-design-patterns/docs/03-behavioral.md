---
title: Behavioral patterns
tech: TypeScript 6 (strict), Node.js 26
version: TypeScript 6.0, Node.js 26 LTS (EventEmitter, async iterators)
date: 2026-11-07
covers: [6, 7]
---
# Behavioral patterns
[← Overview](00-overview.md)

## Why it matters
- Shipping cost logic is a nested `if` tree keyed by country, weight, and membership. Every promotion adds a branch, and one branch silently overrides another.
- Order status changes are scattered booleans (`isPaid`, `isShipped`, `isCancelled`). An order ends up both cancelled and shipped.
- After placing an order, the service calls email, analytics, loyalty, and search directly. A slow analytics call slows every checkout.

## Concepts

| Pattern | Problem | TypeScript form | Everyday example |
|:--|:--|:--|:--|
| Strategy | choose an algorithm at runtime | function or object implementing an interface | pricing rules, shipping calculators, sort orders |
| Observer | notify many listeners of changes | `EventEmitter`, `EventTarget`, callbacks | domain events, UI subscriptions, BullMQ worker events |
| Command | represent a request as an object | `{ type, payload }` plus a handler; queue it, log it, undo it | BullMQ jobs, Redux actions, CLI commands |
| State | behavior depends on state; transitions have rules | state machine: union + transition table | order lifecycle, payment status, connection state |
| Template method | fixed algorithm, variable steps | function taking step functions (or a base class) | import pipelines: parse → validate → save |
| Chain of responsibility | pass a request through handlers that may handle or forward it | middleware arrays | Express middleware, validation pipelines |
| Iterator | traverse without exposing internals | generators, `for…of`, async iterators | paginated APIs, streams, DB cursors |
| Mediator | many objects talk through a central coordinator | coordinator object or event bus | form field coordination, chat rooms |
| Memento | save and restore state | snapshots (`structuredClone`) | undo, drafts |
| Visitor | add operations over a structure of types | `switch` over a union (TypeScript's natural form) | AST transforms, report exporters |
| Interpreter | evaluate a small language | parser + evaluator | rule DSLs (rarely needed) |

## Example
Strategy: shipping cost rules chosen at runtime.
```ts
type ShippingInput = { totalCents: number; weightGrams: number; country: string; member: boolean };
type ShippingStrategy = (input: ShippingInput) => number;

const standard: ShippingStrategy = ({ weightGrams }) => (weightGrams <= 2_000 ? 499 : 899);
const freeForMembers: ShippingStrategy = (i) => (i.member ? 0 : standard(i));
const freeOver = (thresholdCents: number, fallback: ShippingStrategy): ShippingStrategy =>
  (i) => (i.totalCents >= thresholdCents ? 0 : fallback(i));

// Campaigns compose strategies instead of adding branches
export const shippingForCampaign = (campaign: 'none' | 'black-friday'): ShippingStrategy =>
  campaign === 'black-friday' ? freeOver(2_000, freeForMembers) : freeOver(5_000, freeForMembers);
```
State: an order lifecycle where illegal transitions can't happen.
```ts
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type OrderEvent = 'pay' | 'ship' | 'deliver' | 'cancel' | 'refund';

const transitions: Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>> = {
  pending: { pay: 'paid', cancel: 'cancelled' },
  paid: { ship: 'shipped', cancel: 'cancelled', refund: 'refunded' },
  shipped: { deliver: 'delivered' },
  delivered: { refund: 'refunded' },
  cancelled: {},
  refunded: {},
};

export function transition(status: OrderStatus, event: OrderEvent): OrderStatus {
  const next = transitions[status][event];
  if (!next) throw new Error(`cannot ${event} an order that is ${status}`);
  return next;
}
```
Observer: typed domain events in-process (for side effects that must happen, use the outbox).
```ts
type Events = { 'order.paid': { orderId: string; totalCents: number }; 'order.cancelled': { orderId: string } };

export function createEventBus() {
  const listeners: { [K in keyof Events]?: Array<(e: Events[K]) => void | Promise<void>> } = {};
  return {
    on<K extends keyof Events>(type: K, fn: (e: Events[K]) => void | Promise<void>) {
      (listeners[type] ??= []).push(fn);
      return () => { listeners[type] = listeners[type]!.filter((l) => l !== fn) as never; }; // unsubscribe
    },
    async emit<K extends keyof Events>(type: K, event: Events[K]) {
      const results = await Promise.allSettled((listeners[type] ?? []).map((fn) => fn(event)));
      return results.filter((r) => r.status === 'rejected');                               // one failing listener doesn't stop the others
    },
  };
}
```
Command: a request as data, queued and handled elsewhere.
```ts
type Command =
  | { type: 'SendInvoice'; orderId: string }
  | { type: 'RecalculateLoyalty'; customerId: string };

const handlers: { [C in Command as C['type']]: (cmd: C) => Promise<void> } = {
  SendInvoice: async ({ orderId }) => invoices.send(orderId),
  RecalculateLoyalty: async ({ customerId }) => loyalty.recalculate(customerId),
};

await commandQueue.add('SendInvoice', { type: 'SendInvoice', orderId }); // BullMQ job = a serialized command
```
Chain of responsibility and iterator in the stack you already use:
```ts
app.use(requestId, logger, helmet(), express.json({ limit: '100kb' }), authenticate, router); // each handles or calls next()

async function* allOrders(client: ApiClient) {                                                  // iterator over pages
  let cursor: string | undefined;
  do {
    const page = await client.listOrders({ cursor, limit: 100 });
    yield* page.items;
    cursor = page.nextCursor;
  } while (cursor);
}
for await (const order of allOrders(client)) await sync(order);
```

## In our stack
- Strategy: discount rules, retry/backoff strategies (`backoffStrategy` in BullMQ).
- State machines: order and payment transitions guarded in webhooks ([03-backend/12-integrations lesson 02](../../../03-backend/12-integrations/docs/02-stripe-webhooks-reconciliation.md)).
- Observer: domain events, BullMQ `worker.on('failed')`, React state subscriptions.
- Command: BullMQ jobs; chain of responsibility: Express middleware; iterator: Stripe auto-pagination, Postgres cursors.

## When not to
- No strategy object for a rule that never varies.
- No in-process observer for side effects that must not be lost (emails, payments): use the outbox and a queue.
- No visitor class hierarchy in TypeScript: an exhaustive `switch` over a union does the job.

## Production patterns
- **Strategies as functions**, composed for campaigns and variants.
- **Explicit state machines** (transition tables) for lifecycles; illegal transitions throw.
- **Commands as serializable data** handled by workers, with idempotent handlers.
- **Events with isolated listeners** (failures contained) and durable delivery where it matters.

## Mistakes
Wrong: status booleans.
```ts
type Order = { isPaid: boolean; isShipped: boolean; isCancelled: boolean }; // 8 combinations, most invalid
```
Right: one `status` union plus a transition table.

Wrong: nested conditionals for every pricing variant. Right: strategies selected or composed by configuration.

Wrong: an in-memory event bus for "send the invoice". A crash after commit loses the email. Right: outbox → queue → idempotent handler.

## Check yourself
1. How does the state pattern prevent an order from being both cancelled and shipped?
2. What's the difference between a command and an event?
3. Which pattern is Express middleware, and what does `next()` represent?

<details>
<summary>Answers</summary>

1. The order has exactly one status value, and changes only happen through `transition()`, which looks up allowed moves in a table. There's no "cancel" entry from `shipped`, so the call throws instead of creating an invalid state.
2. A command asks for something to be done ("SendInvoice") and has one handler that may refuse; an event states that something happened ("OrderPaid") and can have zero or many listeners, none of which can undo it.
3. Chain of responsibility: each middleware either handles the request (sends a response or throws) or passes it to the next handler in the chain by calling `next()`.
</details>

## Sources
- [refactoring.guru — Behavioral patterns](https://refactoring.guru/design-patterns/behavioral-patterns)
- [Node.js — Events (EventEmitter)](https://nodejs.org/api/events.html)
- [MDN — Iterators and generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_generators)
- [Martin Fowler — Event-driven: event notification vs commands](https://martinfowler.com/articles/201701-event-driven.html)
