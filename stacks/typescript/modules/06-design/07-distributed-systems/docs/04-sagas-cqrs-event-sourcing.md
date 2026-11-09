---
title: Sagas, CQRS, event sourcing, and testing distributed behavior
tech: PostgreSQL 18, Redis 8, BullMQ
version: PostgreSQL 18, BullMQ 5 (flows), Drizzle ORM 0.45; Temporal, EventStoreDB, Jepsen (also seen)
date: 2026-11-07
covers: [9, 10, 11]
---
# Sagas, CQRS, event sourcing, and testing distributed behavior
[← Overview](00-overview.md)

## Why it matters
- Checkout reserves stock, charges the card, and creates a shipment across three modules. The shipment step fails; stock stays reserved forever and the customer is charged for nothing.
- A team tries a two-phase commit between their database and a payment provider. Providers don't support it, and the coordinator becomes a single point of failure.
- A distributed bug (a race between a webhook and a user action) appears once a week in production and never in tests.

## Concepts

### Distributed transactions: 2PC vs sagas
| Approach | How | Trade-off |
|:--|:--|:--|
| Two-phase commit (2PC) | coordinator asks all participants to prepare, then commit | atomic, but blocking, coordinator-dependent, unsupported by most external services |
| **Saga** | a sequence of local transactions; each failure triggers **compensating** actions | available and loosely coupled; intermediate states are visible; compensations must be designed |

| Saga style | How | Fits |
|:--|:--|:--|
| Choreography | each step reacts to the previous step's event | few steps, simple flows |
| Orchestration | an orchestrator (state machine) sends commands and handles replies | many steps, clear visibility, timeouts |

| Saga design rules | Detail |
|:--|:--|
| Compensations | undo semantically (refund, release stock), not technically (delete rows) |
| Idempotency | every step and compensation may run more than once |
| Pivot step | the point after which the saga only moves forward (e.g. payment captured) |
| Timeouts | stuck steps trigger compensation or alerts |
| Semantic locks | intermediate states (`pending`) tell others the work isn't finished |
| Persisted state | the orchestrator stores progress, survives restarts |

### CQRS and event sourcing in depth
| Concept | Meaning |
|:--|:--|
| Command side | validates commands, changes aggregates |
| Query side | read models optimized per screen |
| Projection | code that updates a read model from events |
| Event store | append-only log of events per aggregate (stream) |
| Rehydration | rebuild state by replaying an aggregate's events |
| Snapshot | saved state at version N to speed up replays |
| Upcasting | convert old event versions when reading |
| Replay | rebuild read models from scratch |
| Eventual consistency | read models lag the write side |

Event sourcing pays off for audit-heavy domains, temporal questions ("what did the cart look like at 14:03?"), and complex workflows. It costs schema evolution of events, tooling, and replays. Also seen: EventStoreDB, Marten, Axon.

### Testing distributed behavior
| Technique | Finds |
|:--|:--|
| Idempotency tests | run every handler twice; state must be identical |
| Reordering tests | deliver events out of order and duplicated |
| Fault injection | timeouts, 5xx, crashes between steps (MSW, Toxiproxy, AWS FIS) |
| Concurrency tests | parallel requests on the same aggregate (version conflicts) |
| Property-based tests | random sequences of commands keep invariants (also seen: fast-check) |
| Jepsen-style analysis | consistency claims of databases under partitions |
| Deterministic simulation | replayable simulations of whole systems (also seen: Antithesis, FoundationDB) |
| Reconciliation in production | detects what tests missed |

## Example
An orchestrated checkout saga as a persisted state machine, driven by BullMQ jobs:
```ts
type SagaState = 'started' | 'stock_reserved' | 'payment_captured' | 'completed' | 'compensating' | 'failed';

const steps = {
  async started(s: CheckoutSaga) {
    await catalog.reserveStock({ reservationId: s.id, lines: s.lines });              // idempotent by reservationId
    return 'stock_reserved' as const;
  },
  async stock_reserved(s: CheckoutSaga) {
    const r = await payments.capture({ orderId: s.orderId, amountCents: s.totalCents, idempotencyKey: `capture-${s.orderId}` });
    if (!r.ok) return 'compensating' as const;
    return 'payment_captured' as const;                                                 // pivot: only forward from here
  },
  async payment_captured(s: CheckoutSaga) {
    await fulfillment.requestShipment({ orderId: s.orderId });                          // retried until it succeeds
    return 'completed' as const;
  },
  async compensating(s: CheckoutSaga) {
    await catalog.releaseStock({ reservationId: s.id });                                // semantic undo, idempotent
    await orders.markPaymentFailed(s.orderId);
    return 'failed' as const;
  },
} satisfies Partial<Record<SagaState, (s: CheckoutSaga) => Promise<SagaState>>>;

new Worker<{ sagaId: string }>('checkout-saga', async (job) => {
  const saga = await sagas.get(job.data.sagaId);
  const step = steps[saga.state as keyof typeof steps];
  if (!step) return;                                                                    // terminal state
  const next = await step(saga);
  await sagas.transition(saga.id, saga.state, next);                                    // optimistic: from → to
  if (next !== 'completed' && next !== 'failed') await sagaQueue.add('advance', { sagaId: saga.id }, { jobId: `saga-${saga.id}-${next}` });
}, { connection, concurrency: 20 });
```
A minimal event-sourced aggregate with a snapshot-free rehydration:
```ts
type CartEvent =
  | { type: 'ItemAdded'; sku: string; qty: number; at: string }
  | { type: 'ItemRemoved'; sku: string; at: string }
  | { type: 'CheckedOut'; at: string };

type CartState = { items: Map<string, number>; checkedOut: boolean };

const evolve = (s: CartState, e: CartEvent): CartState => {
  switch (e.type) {
    case 'ItemAdded': return { ...s, items: new Map(s.items).set(e.sku, (s.items.get(e.sku) ?? 0) + e.qty) };
    case 'ItemRemoved': { const items = new Map(s.items); items.delete(e.sku); return { ...s, items }; }
    case 'CheckedOut': return { ...s, checkedOut: true };
  }
};

export const rehydrate = (events: readonly CartEvent[]) =>
  events.reduce(evolve, { items: new Map(), checkedOut: false } as CartState);

// Append with optimistic concurrency: INSERT INTO cart_events (cart_id, version, type, data) — unique (cart_id, version)
```
An idempotency and reordering test:
```ts
test('applying events twice and out of order yields the same read model', async () => {
  const events = [placed, paid, shipped];
  await applyAll([...events, ...events].reverse());          // duplicated and reversed
  await retryPending();                                       // handlers reject gaps; retries apply in order
  expect(await summary(orderId)).toMatchObject({ status: 'shipped', version: 3 });
});
```

## In our stack
- Checkout transactions around the payment call and reconciliation: [03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-transactions.md), [03-backend/12-integrations lesson 02](../../../03-backend/12-integrations/docs/02-stripe-webhooks-reconciliation.md).
- BullMQ flows for multi-step work: [03-backend/07-background-jobs lesson 03](../../../03-backend/07-background-jobs/docs/03-scheduling-flows-shutdown.md).
- CQRS-lite read models: [04-architecture-styles lesson 04](../../04-architecture-styles/docs/04-cqrs-serverless-combining.md); failure testing: [03-backend/08-reliability lesson 04](../../../03-backend/08-reliability/docs/04-degradation-slos-failure-testing.md).

## When not to
- No saga for steps inside one database: a local transaction is simpler and atomic.
- No event sourcing for CRUD; no orchestrator service for a two-step flow.
- No workflow engine (Temporal, also seen) until hand-rolled sagas become hard to maintain.

## Production patterns
- **Sagas with idempotent steps, semantic compensations, a pivot step, timeouts, and persisted state.**
- **Orchestration for checkout-like flows**, choreography for notifications.
- **Read models as projections**, rebuildable by replay.
- **Duplicate, reorder, and fault tests** for every message handler; reconciliation in production.

## Mistakes
Wrong: compensating by deleting rows (`DELETE FROM payments`). History and audit disappear, and money already moved. Right: semantic compensations (refund, release).

Wrong: sagas without persisted state. A restart forgets where it was. Right: store state transitions; resume from them.

Wrong: testing handlers only with perfect, in-order, single deliveries. Right: duplicates, reordering, and injected failures in tests.

## Check yourself
1. Why are sagas preferred over two-phase commit in service-based systems?
2. What is a pivot step, and why does it matter?
3. Name three tests that catch distributed bugs in message handlers.

<details>
<summary>Answers</summary>

1. 2PC needs every participant to support prepare/commit and blocks while the coordinator is unavailable; external services (payment providers, email) don't support it. Sagas use local transactions plus compensations, stay available, and work with any participant that offers idempotent operations.
2. The step after which the saga can no longer be undone cheaply and only moves forward (e.g. payment captured, goods shipped). Steps before it get compensations; steps after it must be retried until they succeed.
3. Running each handler twice (idempotency), delivering events duplicated and out of order (reordering), and injecting failures between steps (crash after side effect, timeouts), plus concurrent commands on the same aggregate.
</details>

## Sources
- [Hector Garcia-Molina, Kenneth Salem — Sagas (1987)](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf)
- [microservices.io — Saga](https://microservices.io/patterns/data/saga.html)
- [Martin Fowler — Event sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Greg Young — CQRS documents (PDF)](https://cqrs.files.wordpress.com/2010/11/cqrs_documents.pdf)
- [Jepsen — Analyses](https://jepsen.io/analyses)
