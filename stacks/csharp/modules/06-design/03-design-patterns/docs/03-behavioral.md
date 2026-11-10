---
title: Behavioral patterns
tech: C# 14, ASP.NET Core 10
version: C# 14 / .NET 10
date: 2026-11-09
covers: [6, 7]
---
# Behavioral patterns
[← Overview](00-overview.md)

## Why it matters
- Order status rules were `if` chains spread over eight services. A refund on a "Delivered" order was allowed in one path and blocked in another.
- The checkout pipeline (validate → reserve stock → price → charge → confirm) was one 400-line method. Adding fraud checks meant editing the middle of it.
- Undo for admin bulk price changes didn't exist; a wrong update to 2,000 products had to be fixed by hand.

## Concepts

### The main three
| Pattern | Intent | Modern C# form | Shop example |
|:--|:--|:--|:--|
| ⭐ strategy | swap an algorithm behind one interface | interface + DI, or `Func<>` | shipping rates per carrier, discount rules |
| ⭐ observer | notify many listeners of an event | C# `event`, `IObservable<T>`, domain events + handlers | `OrderPlaced` → email, loyalty, analytics |
| ⭐ command | represent a request as an object | records (`PlaceOrder`), Hangfire jobs, messages | queued jobs, undoable admin actions, audit log |

### The others
| Pattern | Intent | Shop example |
|:--|:--|:--|
| state | behaviour depends on state; transitions explicit | order lifecycle Pending → Paid → Shipped → Delivered / Cancelled |
| template method | fixed algorithm skeleton, steps overridden | `BackgroundService.ExecuteAsync`; prefer composition in your own code |
| chain of responsibility | pass a request along handlers until handled | ASP.NET Core middleware, `DelegatingHandler`s, validation pipelines |
| iterator | traverse without exposing structure | `IEnumerable<T>` + `yield return`, `IAsyncEnumerable<T>` |
| mediator | objects talk through a mediator, not each other | in-process event dispatch, MediatR-style (03-backend/11-architecture lesson 05) |
| visitor | add operations over a type hierarchy without changing it | mostly replaced by `switch` expressions over sealed records |

## In our stack
- Strategies via keyed services and dispatch tables: [02-principles lesson 01](../../02-principles/docs/01-coupling-cohesion-srp-ocp.md).
- Observer via domain/integration events and the outbox: [03-backend/11-architecture lesson 04](../../../03-backend/11-architecture/docs/04-events-transactions.md).
- Commands: Hangfire jobs and Service Bus messages ([03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md)).
- Chain of responsibility: middleware and endpoint filters ([03-backend/02-api-design](../../../03-backend/02-api-design/README.md)).
- Iterators: `IAsyncEnumerable<T>` streaming ([03-backend/09-scalability lesson 05](../../../03-backend/09-scalability/docs/05-queues-capacity-payloads.md)).

## When not to
- Don't create `IStrategy` classes for logic with one variant; a method is fine.
- Don't use C# `event` for cross-module communication in a web app; events tie lifetimes together and run synchronously. Use domain events through the outbox.
- Don't implement the classic visitor in modern C#; pattern matching is simpler.
- Don't build a state-machine framework for three states; a method per transition with guard clauses is enough.

## Example
State: transitions as methods on the aggregate, rules in one place
```csharp
public enum OrderStatus { Pending, Paid, Shipped, Delivered, Cancelled, Refunded }

public sealed partial class Order
{
    private static readonly Dictionary<OrderStatus, OrderStatus[]> Allowed = new()
    {
        [OrderStatus.Pending] = [OrderStatus.Paid, OrderStatus.Cancelled],
        [OrderStatus.Paid] = [OrderStatus.Shipped, OrderStatus.Refunded],
        [OrderStatus.Shipped] = [OrderStatus.Delivered],
        [OrderStatus.Delivered] = [OrderStatus.Refunded],
    };

    private Result<Order> MoveTo(OrderStatus next)
    {
        if (!Allowed.TryGetValue(Status, out var targets) || !targets.Contains(next))
            return Error.Conflict("order.invalid_transition", $"Can't go from {Status} to {next}.");
        Status = next;
        return this;
    }

    public Result<Order> MarkPaid() => MoveTo(OrderStatus.Paid);
    public Result<Order> Ship() => MoveTo(OrderStatus.Shipped);
    public Result<Order> Refund() => MoveTo(OrderStatus.Refunded);
}
```
Chain of responsibility: a checkout pipeline that's easy to extend
```csharp
public sealed class CheckoutPipeline(IEnumerable<ICheckoutStep> steps)      // registered in order
{
    public async Task<Result<CheckoutContext>> RunAsync(CheckoutContext ctx, CancellationToken ct)
    {
        foreach (var step in steps)
        {
            var result = await step.ExecuteAsync(ctx, ct);
            if (!result.IsSuccess) return result;                          // stop the chain
            ctx = result.Value!;
        }
        return ctx;
    }
}

public interface ICheckoutStep { Task<Result<CheckoutContext>> ExecuteAsync(CheckoutContext ctx, CancellationToken ct); }
// ValidateCart → ReserveStock → Price → FraudCheck (new, one class + one registration) → Charge
```
Command with undo (admin bulk price change)
```csharp
public sealed record ChangePrices(IReadOnlyList<PriceChange> Changes, string Reason);
public sealed record PriceChange(Sku Sku, long OldPriceMinor, long NewPriceMinor);

public sealed class PriceChangeHandler(CatalogDb db, AuditLog audit)
{
    public async Task ExecuteAsync(ChangePrices cmd, CancellationToken ct)
    {
        foreach (var c in cmd.Changes)
            await db.Products.Where(p => p.Sku == c.Sku && p.PriceMinor == c.OldPriceMinor)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.PriceMinor, c.NewPriceMinor), ct);
        await audit.RecordAsync(cmd, ct);                                     // the command itself is the audit record
    }

    public Task UndoAsync(ChangePrices cmd, CancellationToken ct) =>
        ExecuteAsync(cmd with { Changes = [.. cmd.Changes.Select(c => c with { OldPriceMinor = c.NewPriceMinor, NewPriceMinor = c.OldPriceMinor })],
                                Reason = $"undo: {cmd.Reason}" }, ct);
}
```
Iterator with `yield`: stream all orders in pages without loading everything
```csharp
public static async IAsyncEnumerable<Order> AllOrdersAsync(OrderingDb db, [EnumeratorCancellation] CancellationToken ct = default)
{
    long after = 0;
    while (true)
    {
        var page = await db.Orders.AsNoTracking().Where(o => o.Number > after).OrderBy(o => o.Number).Take(500).ToListAsync(ct);
        if (page.Count == 0) yield break;
        foreach (var o in page) yield return o;
        after = page[^1].Number;
    }
}
```
Visitor replaced by pattern matching:
```csharp
static int CountProducts(CatalogItem item) => item switch     // CatalogItem from lesson 02
{
    SingleProduct => 1,
    Bundle b => b.Items.Sum(CountProducts),
    _ => throw new UnreachableException(),
};
```

## Production patterns
- Lifecycles are explicit state machines on the aggregate (allowed transitions in one table), tested exhaustively.
- Extensible processes are pipelines of small steps (chain of responsibility) registered in DI.
- Requests that are queued, audited, retried, or undone are modelled as command records.
- Observers across modules are event handlers fed by the outbox, not in-memory C# events.

## Mistakes
Wrong: `if (order.Status == "Paid" || order.Status == "Shipped" && !order.IsGift ...)` in every service.
Right: transition methods on `Order` with one allowed-transitions table.

Wrong: `public event EventHandler<OrderPlaced>? Placed;` on a scoped service, subscribed by singletons.
Right: domain events dispatched through the outbox to registered handlers.

## Check yourself
1. When is a `Func<>` enough instead of a strategy interface?
2. Which ASP.NET Core features are chains of responsibility?
3. Why does modern C# rarely need the visitor pattern?

<details><summary>Answers</summary>

1. When the strategy is a single small function without dependencies or state; once it needs injected services, configuration, or several members, an interface with DI is clearer.
2. The middleware pipeline, `HttpClient` `DelegatingHandler`s, endpoint filters, and (in Polly) resilience pipelines.
3. Switch expressions with type and property patterns over sealed record hierarchies add new operations without changing the types, with less code and compile-time help.
</details>

## Sources
- [Refactoring.Guru — behavioral patterns](https://refactoring.guru/design-patterns/behavioral-patterns)
- [ASP.NET Core middleware](https://learn.microsoft.com/aspnet/core/fundamentals/middleware/)
- [Iterators (C#)](https://learn.microsoft.com/dotnet/csharp/iterators)
- [Domain events (.NET guide)](https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation)
- [Martin Fowler — Event-driven patterns](https://martinfowler.com/articles/201701-event-driven.html)
