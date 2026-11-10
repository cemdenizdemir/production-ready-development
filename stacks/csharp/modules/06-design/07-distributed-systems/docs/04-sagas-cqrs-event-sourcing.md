---
title: Distributed transactions, sagas, CQRS, and event sourcing
tech: Azure Service Bus, SQL Server 2025, EF Core 10, C# 14
version: November 2026
date: 2026-11-09
covers: [9, 10]
---
# Distributed transactions, sagas, CQRS, and event sourcing
[← Overview](00-overview.md)

## Why it matters
- Checkout reserved stock, charged the card, and then failed to create the shipment. Nothing released the stock or refunded the customer; support found out from angry emails.
- A team tried a two-phase commit across SQL and the payment provider. The provider didn't support it; the "transaction" was a hope.
- An event-sourced `Subscription` stream reached 40,000 events for long-time customers. Loading one took seconds, and a renamed event field broke replays of old events.

## Concepts

### Distributed transactions
| Approach | How | Trade-off |
|:--|:--|:--|
| 2PC (two-phase commit) | coordinator asks all participants to prepare, then commit | blocking on coordinator failure; participants must support it; rare across services/SaaS |
| ⭐ saga | a sequence of local transactions; each step has a **compensating** action | eventual consistency; compensations must be designed |
| ⭐ outbox + idempotent consumers | each step's state change and its message commit together | the backbone of reliable sagas |

| Saga style | How | Use when |
|:--|:--|:--|
| ⭐ choreography | services react to each other's events | few steps, simple flows |
| ⭐ orchestration | a coordinator (process manager) sends commands, tracks state, handles timeouts and compensations | checkout-like flows with many steps and failure paths |

Compensation ≠ rollback: a refund is a new action with its own effects (an email, a ledger entry). Some steps can't be compensated (an email sent), so order steps to do those last.

### CQRS and event sourcing in depth
| Concept | Means | Watch out |
|:--|:--|:--|
| ⭐ event store | append-only stream per aggregate (`subscription-42`: v1, v2, ...) | optimistic concurrency on expected version |
| ⭐ rehydration | replay events to rebuild state | slow for long streams |
| ⭐ snapshots | store state every N events; replay from the snapshot | snapshot versioning |
| ⭐ projections | read models built by handling events | eventual consistency; rebuildable |
| ⭐ upcasting | convert old event versions to the current shape when reading | never change stored events |
| replays | rebuild projections from history | idempotent, ordered handling |
| GDPR | erase personal data in immutable logs | crypto-shredding (encrypt per user, delete the key) or store PII outside events |
| tools | Marten (PostgreSQL), EventStoreDB/Kurrent, or a SQL table | this stack: SQL table or don't |

## In our stack
- Outbox, idempotent consumers, Service Bus: [03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md).
- Saga as explicit states on aggregates and a process manager: [03-design-patterns lesson 04](../../03-design-patterns/docs/04-application-integration.md), [03-backend/11-architecture lesson 04](../../../03-backend/11-architecture/docs/04-events-transactions.md).
- CQRS-lite projections: [04-architecture-styles lesson 03](../../04-architecture-styles/docs/03-microservices-events-cqrs.md).

## When not to
- Don't use a saga where one database transaction can do it (both steps in one module).
- Don't adopt event sourcing for CRUD data or "for an audit log"; temporal tables or an audit table are simpler.
- Don't build a saga framework before you have two real sagas.

## Example
Orchestrated checkout saga (process manager persisted in SQL):
```csharp
public enum CheckoutStep { Started, StockReserved, PaymentCaptured, ShipmentCreated, Completed, Compensating, Failed }

public sealed class CheckoutSaga
{
    public Guid Id { get; private set; }
    public long OrderNumber { get; private set; }
    public CheckoutStep Step { get; private set; } = CheckoutStep.Started;
    public DateTimeOffset DeadlineAt { get; private set; }

    public IEnumerable<object> Handle(object evt, DateTimeOffset now) => (Step, evt) switch
    {
        (CheckoutStep.Started, StockReserved e) => Advance(CheckoutStep.StockReserved, new CapturePayment(OrderNumber, e.Total)),
        (CheckoutStep.StockReserved, PaymentCaptured _) => Advance(CheckoutStep.PaymentCaptured, new CreateShipment(OrderNumber)),
        (CheckoutStep.PaymentCaptured, ShipmentCreated _) => Advance(CheckoutStep.Completed),
        (CheckoutStep.StockReserved, PaymentFailed _) => Compensate(new ReleaseStock(OrderNumber)),
        (CheckoutStep.PaymentCaptured, ShipmentFailed _) => Compensate(new RefundPayment(OrderNumber), new ReleaseStock(OrderNumber)),
        _ when now > DeadlineAt && Step is not (CheckoutStep.Completed or CheckoutStep.Failed) => Compensate(new ReleaseStock(OrderNumber)),
        _ => [],                                                    // duplicate or out-of-order event: ignore
    };

    private IEnumerable<object> Advance(CheckoutStep next, params object[] commands) { Step = next; return commands; }
    private IEnumerable<object> Compensate(params object[] commands) { Step = CheckoutStep.Compensating; return commands; }
}
// The handler loads the saga, calls Handle, saves the saga and the outgoing commands (outbox) in one transaction.
```
An event-sourced aggregate with snapshots and upcasting (SQL-backed sketch):
```csharp
public abstract record SubscriptionEvent;
public sealed record Activated(DateOnly FirstRoast, int EveryWeeks) : SubscriptionEvent;
public sealed record Paused(DateOnly ResumesOn) : SubscriptionEvent;
public sealed record FrequencyChanged(int EveryWeeks) : SubscriptionEvent;

public sealed class SubscriptionAggregate
{
    public int Version { get; private set; }
    public int EveryWeeks { get; private set; }
    public bool IsActive { get; private set; }

    public void Apply(SubscriptionEvent e)
    {
        switch (e)
        {
            case Activated a: IsActive = true; EveryWeeks = a.EveryWeeks; break;
            case Paused: IsActive = false; break;
            case FrequencyChanged f: EveryWeeks = f.EveryWeeks; break;
        }
        Version++;
    }
}

// upcasting: v1 stored "Interval" in days; v2 uses EveryWeeks
static SubscriptionEvent Upcast(string type, int schemaVersion, JsonElement data) => (type, schemaVersion) switch
{
    ("FrequencyChanged", 1) => new FrequencyChanged(data.GetProperty("Interval").GetInt32() / 7),
    ("FrequencyChanged", 2) => data.Deserialize<FrequencyChanged>()!,
    ("Activated", _) => data.Deserialize<Activated>()!,
    ("Paused", _) => data.Deserialize<Paused>()!,
    _ => throw new NotSupportedException(type),
};
// Append: INSERT ... WHERE NOT EXISTS (stream, version) → unique (StreamId, Version) gives optimistic concurrency.
// Load: latest snapshot (if any) + events after its version.
```

## Production patterns
- Cross-service workflows are sagas: local transactions, outbox messages, idempotent steps, compensations, timeouts, and a visible state (orchestration for anything non-trivial).
- Irreversible steps (emails, shipments to carriers) run last; compensations are business actions with their own records.
- Event sourcing only for aggregates where history is the point; with versioned events, upcasting on read, snapshots for long streams, and projections that can be rebuilt.

## Mistakes
Wrong: reserve → charge → ship with no handling for failures after step 1.
Right: a saga with compensations (release stock, refund) and a deadline.

Wrong: editing stored events to rename a field.
Right: a new schema version and an upcaster; stored events stay immutable.

## Check yourself
1. Why are sagas used instead of 2PC across services?
2. What's a compensating action, and why isn't it a rollback?
3. How do snapshots and upcasting help event-sourced systems?

<details><summary>Answers</summary>

1. 2PC needs every participant to support it, blocks when the coordinator fails, and couples services tightly; most SaaS APIs (like payment providers) don't support it. Sagas use local transactions and compensations instead.
2. A new action that semantically undoes an earlier step (refund for a charge, release for a reservation). It's not a rollback because the original step happened and may have had visible effects; the compensation is recorded as its own business event.
3. Snapshots avoid replaying entire long streams by starting from a saved state; upcasting converts old event versions to the current shape on read, so the model can evolve without rewriting stored events.
</details>

## Sources
- [Saga distributed transactions pattern (Azure)](https://learn.microsoft.com/azure/architecture/reference-architectures/saga/saga)
- [Compensating transaction pattern](https://learn.microsoft.com/azure/architecture/patterns/compensating-transaction)
- [Event sourcing pattern](https://learn.microsoft.com/azure/architecture/patterns/event-sourcing)
- [Greg Young — Versioning in an event sourced system](https://leanpub.com/esversioning)
- [Hector Garcia-Molina & Kenneth Salem — Sagas (1987)](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf)
