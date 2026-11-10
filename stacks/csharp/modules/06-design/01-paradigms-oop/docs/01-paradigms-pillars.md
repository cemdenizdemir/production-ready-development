---
title: Paradigms and the four OOP pillars
tech: C# 14
version: C# 14 / .NET 10
date: 2026-11-09
covers: [1, 2]
---
# Paradigms and the four OOP pillars
[← Overview](00-overview.md)

## Why it matters
- An `Order` class had public setters for `Status` and `Total`. Five services changed them in five ways, and orders appeared as "Shipped" with a total of zero.
- A deep `BaseRepository<T> → AuditedRepository<T> → OrderRepository` hierarchy made a one-line change to auditing ripple through 30 classes.
- A pricing routine mixed loops, mutation, database calls, and logging in 200 lines. Rewritten as a LINQ pipeline over immutable data, it became 25 lines and testable without a database.

## Concepts

### Paradigms
| Paradigm | Idea | In C# |
|:--|:--|:--|
| ⭐ imperative | step-by-step statements that change state | `for`, assignments, `if` |
| procedural | imperative code organised into procedures | `static` methods, helpers |
| ⭐ object-oriented | objects bundle state and behaviour behind boundaries | classes, interfaces, inheritance |
| ⭐ functional | compute with pure functions over immutable data | lambdas, LINQ, records, pattern matching |
| ⭐ declarative | say *what*, not *how* | LINQ, SQL, attributes, Bicep |
| reactive | react to streams of events over time | `IAsyncEnumerable<T>`, `IObservable<T>` (Rx.NET), channels |

C# mixes them freely: a Minimal API endpoint (declarative routing) calls a use case (object-oriented) that runs a LINQ query (declarative/functional) and a pricing function (pure).

### The four OOP pillars
| Pillar | Meaning | C# tools | Shop example |
|:--|:--|:--|:--|
| ⭐ encapsulation | hide state; expose behaviour that keeps it valid | `private` fields, private setters, methods | `order.Cancel(now)` instead of `order.Status = "Cancelled"` |
| ⭐ abstraction | show what something does, hide how | interfaces, abstract classes, public API | `IPaymentGateway.ChargeAsync(...)` |
| ⭐ inheritance | reuse and specialise a base type | `class B : A`, `virtual`/`override` | `Exception` hierarchies; rarely for domain code |
| ⭐ polymorphism | one call, different behaviour per type | interfaces, overrides, generics, pattern matching | `IShippingRateProvider` per carrier |

Encapsulation is the pillar that pays most in business code. Inheritance is the most overused: prefer composition (lesson 02).

## In our stack
- Encapsulated aggregates with methods (`Order.Cancel`, `TryMarkSucceeded`): [03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-ports.md).
- Abstraction through ports (`IPaymentGateway`, `IEmailSender`): [03-backend/12-integrations](../../../03-backend/12-integrations/README.md).
- Declarative style: LINQ to EF Core ([03-backend/03-databases](../../../03-backend/03-databases/README.md)), Minimal API routing, Bicep ([04-shipping/03-iac](../../../04-shipping/03-iac/README.md)).
- Reactive style: `IAsyncEnumerable<T>` streaming responses and `Channel<T>` workers ([03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md)).

## When not to
- Don't wrap simple data in objects with getters and setters "for encapsulation": a `record` DTO with no behaviour is fine.
- Don't build inheritance hierarchies to share a few lines; a helper function or composition is simpler.
- Don't force functional style (monads, point-free chains) where a plain loop is clearer to the team.

## Example
`Pricing.cs` (the same calculation in two paradigms)
```csharp
public sealed record CartLine(string Sku, int Quantity, long UnitPriceMinor);

public static class Pricing
{
    // imperative
    public static long TotalImperative(IReadOnlyList<CartLine> lines, int discountPercent)
    {
        long total = 0;
        foreach (var line in lines)
        {
            if (line.Quantity <= 0) continue;
            total += line.Quantity * line.UnitPriceMinor;
        }
        return total - total * discountPercent / 100;
    }

    // functional / declarative
    public static long Total(IEnumerable<CartLine> lines, int discountPercent)
    {
        var subtotal = lines.Where(l => l.Quantity > 0).Sum(l => l.Quantity * l.UnitPriceMinor);
        return subtotal - subtotal * discountPercent / 100;
    }
}
```
Encapsulation in an entity:
```csharp
public sealed class Cart
{
    private readonly List<CartLine> _lines = [];
    public IReadOnlyList<CartLine> Lines => _lines;

    public void Add(string sku, int quantity, long unitPriceMinor)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(quantity);
        if (_lines.Count >= 50) throw new InvalidOperationException("A cart holds at most 50 lines.");
        var existing = _lines.FindIndex(l => l.Sku == sku);
        if (existing >= 0) _lines[existing] = _lines[existing] with { Quantity = _lines[existing].Quantity + quantity };
        else _lines.Add(new CartLine(sku, quantity, unitPriceMinor));
    }
}
```
Polymorphism through an interface:
```csharp
public interface IShippingRateProvider { string Carrier { get; } long QuoteMinor(int grams, string country); }
public sealed class FlatRate : IShippingRateProvider { public string Carrier => "flat"; public long QuoteMinor(int g, string c) => 4_90; }
public sealed class ByWeight : IShippingRateProvider { public string Carrier => "weight"; public long QuoteMinor(int g, string c) => 2_00 + g / 100 * 50; }

long Cheapest(IEnumerable<IShippingRateProvider> providers, int grams, string country) =>
    providers.Min(p => p.QuoteMinor(grams, country));
```

## Production patterns
- Business rules live behind methods that keep objects valid (encapsulation), not in setters called from services.
- Calculations are pure functions over immutable inputs; I/O stays at the edges.
- Abstractions exist where implementations really vary or need faking (ports); everything else is concrete.
- Teams agree on idioms (LINQ vs loops, records vs classes) in their coding guidelines.

## Mistakes
Wrong:
```csharp
public class Order { public string Status { get; set; } public decimal Total { get; set; } }   // anyone can break it
```
Right: private setters and methods such as `Cancel`, `MarkPaid`, with rules inside.

Wrong: `class DiscountedOrder : Order`, `class GiftOrder : DiscountedOrder`... to model variations.
Right: composition (an order *has* discounts, gift options) or a closed set of record types (lesson 03).

## Check yourself
1. Which OOP pillar prevents "orders shipped with total 0"?
2. Is LINQ object-oriented, functional, or declarative?
3. Why is inheritance the pillar to use most carefully?

<details><summary>Answers</summary>

1. Encapsulation: state changes only through methods that enforce the rules, so invalid combinations can't be set from outside.
2. Declarative and functional: you describe what you want with higher-order functions over sequences (and EF Core translates it to SQL), even though it's implemented with objects and interfaces.
3. It couples subclasses tightly to base-class internals, hierarchies are hard to change, and most reuse needs are better served by composition or interfaces.
</details>

## Sources
- [Object-oriented programming (C#)](https://learn.microsoft.com/dotnet/csharp/fundamentals/tutorials/oop)
- [Inheritance in C#](https://learn.microsoft.com/dotnet/csharp/fundamentals/object-oriented/inheritance)
- [Language Integrated Query (LINQ)](https://learn.microsoft.com/dotnet/csharp/linq/)
- [Functional vs procedural programming (.NET)](https://learn.microsoft.com/dotnet/standard/linq/concepts-terminology-functional-transformation)
- [Martin Fowler — Anemic domain model](https://martinfowler.com/bliki/AnemicDomainModel.html)
