---
title: Events between modules and consistency boundaries
tech: EF Core 10, SQL Server 2025, Hangfire, Azure Service Bus
version: EF Core 10
date: 2026-11-09
covers: [8, 13]
---
# Events between modules and consistency boundaries
[← Overview](00-overview.md)

## Why it matters
- `PlaceOrder` called Payments, Shipping, Loyalty, and Email directly. When Loyalty was slow, checkout was slow; when Email threw, the order was rolled back after the card had been charged.
- A use case opened a transaction, called Stripe (2 s), then saved. Under load, row locks were held for seconds and other checkouts deadlocked.
- Two modules updated each other's tables in one transaction. Nobody could change either schema without breaking the other.

## Concepts

### Domain events and integration events
| Kind | Scope | Example | Delivery |
|:--|:--|:--|:--|
| ⭐ domain event | inside one module | `OrderLinesChanged` → recalculate totals | in-process, same transaction |
| ⭐ integration event | between modules (or services) | `OrderPlaced` → Payments, Loyalty, Email | outbox → in-process dispatcher or Service Bus (07-background-jobs) |

Integration events are **public contracts** (in `Shop.Ordering.Contracts`): versioned, past tense, with the data consumers need (`OrderPlaced.v1 { OrderId, CustomerId, TotalMinor, Currency, Lines }`). Domain events are internal and can change freely.

### Eventual consistency
After `OrderPlaced` is committed, Loyalty's points and the confirmation email follow **a little later**. That's fine when:
| OK to be eventual | Must be immediate (same transaction) |
|:--|:--|
| loyalty points, emails, analytics, search index | order lines and order total |
| warehouse notification | stock reservation, if overselling is unacceptable |
| read models / projections | anything an invariant depends on |

Design the UI for it: "Order received, confirmation on its way", not "points added".

### Transactions and consistency boundaries
| Rule | Why |
|:--|:--|
| ⭐ one transaction = one module (ideally one aggregate) | modules stay independent; locks stay small |
| ⭐ the `DbContext` is the unit of work | one `SaveChangesAsync` per use case commits everything together |
| ⭐ no network calls inside a transaction | calls are slow and can't be rolled back; locks are held while you wait |
| side effects after commit, through the outbox | events are published only if the state change committed |
| cross-module changes by events or by a process (saga) | each step is its own transaction; failures compensate (refund, release stock) |
| explicit transactions with retries | wrap in `db.Database.CreateExecutionStrategy().ExecuteAsync(...)` when `EnableRetryOnFailure` is on |

Order of operations in a use case that charges a card:
```mermaid
sequenceDiagram
  participant UC as PlaceOrder use case
  participant DB as Ordering DB
  participant PG as Payment gateway
  UC->>DB: tx 1: save Order (Pending) + outbox OrderPlaced; commit
  UC->>PG: charge (idempotency key), outside any transaction
  alt succeeded
    UC->>DB: tx 2: Order.MarkPaid() + outbox OrderPaid; commit
  else declined
    UC->>DB: tx 2: Order.MarkPaymentFailed(); commit
  end
```
If the process crashes between charge and tx 2, a reconciliation job (or the Stripe webhook, 12-integrations) completes it: the idempotency key and the webhook make it safe.

## Example
`src/Modules/Ordering/Shop.Ordering.Contracts/OrderPlaced.cs`
```csharp
public sealed record OrderPlaced(long OrderId, Guid CustomerId, long TotalMinor, string Currency,
                                 IReadOnlyList<OrderPlacedLine> Lines, DateTimeOffset PlacedAt) : IIntegrationEvent;
public sealed record OrderPlacedLine(string Sku, int Quantity, long UnitPriceMinor);
```
`src/Modules/Loyalty/Shop.Loyalty/Handlers/AwardPointsOnOrderPlaced.cs`
```csharp
internal sealed class AwardPointsOnOrderPlaced(LoyaltyDb db) : IIntegrationEventHandler<OrderPlaced>
{
    public async Task HandleAsync(OrderPlaced evt, Guid messageId, CancellationToken ct)
    {
        const string handler = nameof(AwardPointsOnOrderPlaced);
        if (await db.ProcessedMessages.AnyAsync(m => m.MessageId == messageId && m.Handler == handler, ct)) return;   // inbox
        db.Ledger.Add(LedgerEntry.ForOrder(evt.CustomerId, evt.OrderId, points: evt.TotalMinor / 100));
        db.ProcessedMessages.Add(new ProcessedMessage(messageId, handler));
        await db.SaveChangesAsync(ct);                                                  // one transaction, Loyalty only
    }
}
```
`src/Shop.Infrastructure/Outbox/EventTypeRegistry.cs` (modular monolith: same outbox, in-process delivery)
```csharp
public sealed class EventTypeRegistry
{
    public sealed record Entry(Type Type, Func<IServiceProvider, object, Guid, CancellationToken, Task> Dispatch);
    private readonly Dictionary<string, Entry> _entries = [];

    public EventTypeRegistry Register<T>(string name) where T : IIntegrationEvent
    {
        _entries[name] = new(typeof(T), async (sp, evt, messageId, ct) =>
        {
            foreach (var handler in sp.GetServices<IIntegrationEventHandler<T>>())
                await handler.HandleAsync((T)evt, messageId, ct);
        });
        return this;
    }

    public Entry Resolve(string name) => _entries[name];
}

internal sealed class InProcessOutboxDispatcher(IServiceScopeFactory scopes, EventTypeRegistry types) : IOutboxDispatcher
{
    public async Task DispatchAsync(OutboxMessage m, CancellationToken ct)
    {
        var entry = types.Resolve(m.Type);
        var evt = JsonSerializer.Deserialize(m.Payload, entry.Type)!;
        await using var scope = scopes.CreateAsyncScope();
        await entry.Dispatch(scope.ServiceProvider, evt, m.Id, ct);
    }
}
```
Registration: `services.AddSingleton(new EventTypeRegistry().Register<OrderPlaced>("OrderPlaced.v1"))`. The generic `Register<T>` captures the handler type once, so dispatch needs no reflection or `dynamic`. The outbox publisher from 07-background-jobs calls `IOutboxDispatcher`. Swap this dispatcher for the Service Bus sender when a module moves out, and the handlers don't change.

Explicit transaction with retries enabled:
```csharp
var strategy = db.Database.CreateExecutionStrategy();
await strategy.ExecuteAsync(async () =>
{
    await using var tx = await db.Database.BeginTransactionAsync(ct);
    order.MarkPaid(paymentId);
    await db.SaveChangesAsync(ct);
    await tx.CommitAsync(ct);
});
```

## Production patterns
- Modules react to each other through integration events from the outbox, delivered in-process now and through Service Bus later.
- Each handler is idempotent (inbox) and commits only its own module's data.
- Transactions are short and local: no HTTP, Stripe, email, or Service Bus calls inside them.
- Multi-step processes (order → payment → shipping) are explicit: states on the aggregate, timeouts, compensations, and a reconciliation job.

## Mistakes
Wrong:
```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);
db.Orders.Add(order); await db.SaveChangesAsync(ct);
await stripe.ChargeAsync(order, ct);        // network call holding locks
await emails.SendAsync(order, ct);          // failure rolls back a paid order
await tx.CommitAsync(ct);
```
Right: commit the order with an outbox event; charge outside the transaction; email from an event handler.

Wrong: `LoyaltyDb` and `OrderingDb` changes in one `TransactionScope`.
Right: Ordering commits and publishes; Loyalty handles the event in its own transaction.

## Check yourself
1. What's the difference between a domain event and an integration event?
2. Why must network calls stay outside database transactions?
3. When is eventual consistency not acceptable?

<details><summary>Answers</summary>

1. Domain events are internal to one module and handled in the same transaction. Integration events are public, versioned contracts between modules, delivered after commit through the outbox, so consumers process them in their own transactions.
2. They're slow and unpredictable, so locks are held during the wait, which causes contention and deadlocks. They also can't be rolled back: if the transaction fails after a successful charge, the database and the provider disagree.
3. When an invariant depends on it: data that must be correct together at every moment, such as order lines and totals, or stock reservation if overselling isn't allowed. Those belong inside one aggregate and one transaction.
</details>

## Sources
- [Domain events: design and implementation (.NET)](https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation)
- [Integration events (.NET microservices guide)](https://learn.microsoft.com/dotnet/architecture/microservices/multi-container-microservice-net-applications/integration-event-based-microservice-communications)
- [Connection resiliency and execution strategies (EF Core)](https://learn.microsoft.com/ef/core/miscellaneous/connection-resiliency)
- [Saga pattern (Azure Architecture Center)](https://learn.microsoft.com/azure/architecture/reference-architectures/saga/saga)
- [Vaughn Vernon — Effective aggregate design](https://www.dddcommunity.org/library/vernon_2011/)
