---
title: Entities, value objects, aggregates, and domain events
tech: C# 14, EF Core 10
version: C# 14 / .NET 10, EF Core 10
date: 2026-11-09
covers: [5, 6, 7]
---
# Entities, value objects, aggregates, and domain events
[← Overview](00-overview.md)

## Why it matters
- Order lines were updated directly through `db.OrderLines`. The order's total wasn't recalculated, so invoices disagreed with payments.
- The `Customer` aggregate held every order the customer ever placed. Loading a loyal customer took 3 seconds and two concurrent orders conflicted on the same aggregate.
- A handler sent the confirmation email inside `SaveChangesAsync`'s transaction. When the transaction rolled back, the customer still got an email for an order that didn't exist.

## Concepts

### Entities and value objects (recap in DDD terms)
| Building block | Identity | Equality | Rules |
|:--|:--|:--|:--|
| ⭐ entity | yes, stable over time | by ID | changes through methods that protect invariants |
| ⭐ value object | no | by value | immutable, validated on creation, side-effect-free behaviour |

Prefer value objects: they're easier to reason about, test, and share. Make something an entity only when its identity matters over time (01-paradigms-oop lesson 04).

### Aggregates
| Rule | Means |
|:--|:--|
| ⭐ an aggregate is a consistency boundary | invariants inside it are always true after each transaction |
| ⭐ one root | outside code holds references only to the root (`Order`), never to inner entities (`OrderLine`) |
| ⭐ change through the root | `order.AddLine(...)`, not `db.OrderLines.Add(...)` |
| ⭐ reference other aggregates by ID | `CustomerId`, not a `Customer` object |
| ⭐ one aggregate per transaction (ideally) | others updated eventually through domain events |
| ⭐ small aggregates | only what's needed for the invariants; large aggregates cause contention and slow loads |
| concurrency | optimistic concurrency on the root (`rowversion`) |

| Invariant | Aggregate |
|:--|:--|
| order total = sum of lines − discounts; 1–50 lines | `Order` (with `OrderLine`) |
| reserved stock ≤ on hand | `StockItem` |
| a code is used at most N times | `DiscountCode` |
| a customer's loyalty balance never goes negative | `LoyaltyAccount` |

"Customer has orders" doesn't make orders part of the `Customer` aggregate: no invariant spans them.

### Domain events
| Kind | Scope | Example | Delivery |
|:--|:--|:--|:--|
| ⭐ domain event | inside the context | `OrderLineAdded`, `OrderPlaced` | raised by the aggregate, dispatched on save |
| ⭐ integration event | across contexts | `OrderPlacedV1` (published language) | outbox → other modules/services |

Aggregates **record** events while changing state; the infrastructure dispatches them after (or as part of) saving, never in the middle of a method. Side effects (email, other aggregates) happen in handlers, through the outbox when they cross boundaries (03-backend/11-architecture lesson 04).

## In our stack
- Aggregates with private collections and transition methods: [03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-ports.md), [03-design-patterns lesson 03](../../03-design-patterns/docs/03-behavioral.md).
- Optimistic concurrency with `rowversion`: [03-backend/03-databases](../../../03-backend/03-databases/README.md).
- Domain events → outbox → integration events: [03-backend/07-background-jobs lesson 04](../../../03-backend/07-background-jobs/docs/04-outbox.md).

## When not to
- Don't create aggregates for data with no invariants (a product's marketing description); a simple entity or record is enough.
- Don't load and save an aggregate to change one field nobody else depends on; a targeted update (`ExecuteUpdateAsync`) is fine outside the core.
- Don't raise domain events nobody handles "just in case".

## Example
`Order.cs` (aggregate root)
```csharp
public sealed class Order : IHasDomainEvents
{
    private readonly List<OrderLine> _lines = [];
    private readonly List<IDomainEvent> _events = [];

    public OrderId Id { get; private set; }
    public CustomerId CustomerId { get; private set; }          // other aggregate by ID
    public OrderStatus Status { get; private set; } = OrderStatus.Draft;
    public string Currency { get; private set; } = "EUR";
    public Money Total { get; private set; }
    public IReadOnlyList<OrderLine> Lines => _lines;
    public byte[] Version { get; private set; } = [];           // rowversion

    private Order() { }                                         // EF Core
    public static Order Start(OrderId id, CustomerId customer, string currency) =>
        new() { Id = id, CustomerId = customer, Currency = currency, Total = Money.Zero(currency) };

    public Result<Order> AddLine(Sku sku, Quantity quantity, Money unitPrice)
    {
        if (Status != OrderStatus.Draft) return Error.Conflict("order.not_editable", "Only draft orders can change.");
        if (_lines.Count >= 50) return Error.Conflict("order.too_many_lines", "At most 50 lines.");
        if (unitPrice.Currency != Currency) return Error.Conflict("order.currency_mismatch", "Currency mismatch.");

        var existing = _lines.Find(l => l.Sku == sku);
        if (existing is null) _lines.Add(new OrderLine(sku, quantity, unitPrice));
        else existing.Increase(quantity);

        Total = _lines.Aggregate(Money.Zero(Currency), (sum, l) => sum + l.Subtotal);   // invariant kept here
        return this;
    }

    public Result<Order> Place(DateTimeOffset now)
    {
        if (_lines.Count == 0) return Error.Conflict("order.empty", "An order needs at least one line.");
        if (Status != OrderStatus.Draft) return Error.Conflict("order.already_placed", "Order already placed.");
        Status = OrderStatus.Placed;
        _events.Add(new OrderPlaced(Id, CustomerId, Total, now));
        return this;
    }

    public IReadOnlyList<IDomainEvent> DequeueEvents() { var e = _events.ToList(); _events.Clear(); return e; }
}

public sealed class OrderLine                                 // inner entity: only reachable through Order
{
    internal OrderLine(Sku sku, Quantity quantity, Money unitPrice) => (Sku, Quantity, UnitPrice) = (sku, quantity, unitPrice);
    private OrderLine() { }
    public Sku Sku { get; private set; } = default!;
    public Quantity Quantity { get; private set; }
    public Money UnitPrice { get; private set; }
    public Money Subtotal => new(UnitPrice.Minor * Quantity.Value, UnitPrice.Currency);
    internal void Increase(Quantity by) => Quantity = Quantity.Add(by);
}

public sealed record OrderPlaced(OrderId OrderId, CustomerId CustomerId, Money Total, DateTimeOffset At) : IDomainEvent;
```
Using it in a use case (one aggregate per transaction; reactions through events):
```csharp
var order = await db.Orders.Include(o => o.Lines).SingleAsync(o => o.Id == id, ct);
var placed = order.Place(time.GetUtcNow());
if (!placed.IsSuccess) return placed.Error!;
await db.SaveChangesAsync(ct);    // interceptor turns OrderPlaced into an outbox row in the same transaction
```

## Production patterns
- Aggregates are small, designed around real invariants, changed only through their root, and reference others by ID.
- One aggregate per transaction; other aggregates and contexts update through domain/integration events.
- Aggregates record events; infrastructure dispatches them through the outbox after the state change is committed.
- Optimistic concurrency on aggregate roots; conflicts surface as 409s with a retry path.

## Mistakes
Wrong:
```csharp
db.OrderLines.Add(new OrderLine { OrderId = id, Sku = sku, Quantity = 2 });   // bypasses Order's invariants
await db.SaveChangesAsync(ct);
```
Right: load the `Order` and call `order.AddLine(...)`.

Wrong: `class Customer { public List<Order> Orders { get; } }` as one aggregate.
Right: `Order` references `CustomerId`; queries for "customer's orders" use a read model.

## Check yourself
1. What is an aggregate, in one sentence?
2. Why reference other aggregates by ID?
3. Where should the "send confirmation email" side effect happen?

<details><summary>Answers</summary>

1. A cluster of objects treated as one unit for changes, with a root that enforces its invariants so they hold after every transaction.
2. It keeps aggregates small and independent: loading one doesn't load others, transactions stay local, and contention and coupling stay low.
3. In a handler of the `OrderPlaced` event, run after the order is committed (through the outbox), never inside the aggregate method or the save transaction.
</details>

## Sources
- [Vaughn Vernon — Effective aggregate design (parts 1–3)](https://www.dddcommunity.org/library/vernon_2011/)
- [Martin Fowler — DDD Aggregate](https://martinfowler.com/bliki/DDD_Aggregate.html)
- [Domain events (.NET microservices guide)](https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation)
- [Seedwork and aggregates (.NET guide)](https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/microservice-domain-model)
- [EF Core concurrency tokens](https://learn.microsoft.com/ef/core/saving/concurrency)
