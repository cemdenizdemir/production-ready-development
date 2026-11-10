---
title: Coupling, cohesion, SRP, and OCP
tech: C# 14
version: C# 14 / .NET 10
date: 2026-11-09
covers: [1, 2, 3]
---
# Coupling, cohesion, SRP, and OCP
[← Overview](00-overview.md)

## Why it matters
- `OrderService` handled pricing, stock, payment, emails, PDFs, and analytics. Any change by any team touched it, merge conflicts were daily, and a PDF bug broke checkout.
- Adding a new shipping carrier meant editing a 300-line `switch` in four places. One place was missed, and those orders shipped free.
- The Loyalty module read Ordering's tables directly. Renaming one column broke loyalty points silently.

## Concepts

### Coupling and cohesion
| Measure | Meaning | Good | Bad |
|:--|:--|:--|:--|
| ⭐ coupling | how much one part depends on another's details | few, narrow dependencies on stable contracts | reaching into internals, shared tables, long dependency lists |
| ⭐ cohesion | how strongly the things inside one part belong together | everything changes for the same reason | unrelated responsibilities in one class |

| Coupling kind (worst → best) | Example |
|:--|:--|
| content | reading another module's private data or tables |
| common / global | shared mutable static state |
| control | passing flags that change what the callee does (`Save(order, sendEmail: true)`) |
| stamp | passing a whole object when the callee needs one field |
| ⭐ data | passing only the data needed |
| ⭐ message / event | publishing an event others may react to |

Signs of coupling in .NET: a constructor with 10 dependencies, `using` lines from many modules, `InternalsVisibleTo` everywhere, many files changed per feature.

### Single Responsibility Principle (SRP)
"A module should have one, and only one, reason to change" — one **actor** (stakeholder) whose requests change it. Not "do one thing".
| Smell | Split by |
|:--|:--|
| class changes for finance, marketing, and ops requests | actor: pricing rules, campaign rules, fulfilment |
| methods using disjoint sets of fields | cohesion: they're two classes |
| "and" in the name (`OrderAndInvoiceService`) | responsibility |

### Open/Closed Principle (OCP)
"Open for extension, closed for modification": add behaviour by **adding** code (a new class, a new registration) rather than editing working code in many places.
| Tool | Shop example |
|:--|:--|
| strategy interface + DI | new carrier = new `IShippingRateProvider` class |
| dispatch table | new payment method = new dictionary entry |
| events | new reaction to `OrderPlaced` = new handler |
| configuration | new discount tier = data, not code |

OCP is a goal for the parts that **actually** vary often. Don't pre-build extension points for variation you haven't seen (YAGNI, lesson 03).

## In our stack
- Module boundaries with contracts and events lower coupling: [03-backend/11-architecture](../../../03-backend/11-architecture/README.md).
- Vertical slices raise cohesion (everything for "place order" in one folder): [03-backend/11-architecture lesson 01](../../../03-backend/11-architecture/docs/01-modular-monolith-layers-modules.md).
- OCP via keyed services and integration event handlers: [03-backend/11-architecture lessons 02 and 04](../../../03-backend/11-architecture/docs/04-events-transactions.md).

## When not to
- Don't split a 120-line class into five classes because "SRP"; if one actor changes it and it reads clearly, it's cohesive.
- Don't add a strategy interface for a rule that has had one implementation for two years.
- Don't decouple with events where a direct call inside one module is simpler and needs to be immediate.

## Example
Before: one class, many reasons to change (`OrderService.cs`, shortened)
```csharp
public sealed class OrderService(ShopDb db, IEmailSender email, IPdfRenderer pdf, IAnalytics analytics)
{
    public async Task PlaceAsync(PlaceOrder cmd, CancellationToken ct)
    {
        var total = 0m;
        foreach (var l in cmd.Lines) total += l.Price * l.Quantity;              // pricing (finance)
        if (cmd.Country == "TR") total *= 1.20m; else if (cmd.Country == "DE") total *= 1.19m;   // tax (finance)
        var shipping = cmd.Carrier switch { "dhl" => 5.9m, "ups" => 7.5m, _ => 0m };          // carriers (ops)
        db.Orders.Add(new Order(cmd.CustomerId, total + shipping));
        await db.SaveChangesAsync(ct);
        await email.SendAsync(/* template */ default!, ct);                     // messaging (marketing)
        var invoice = await pdf.RenderAsync(/* ... */ default!, ct);            // invoicing (finance)
        await analytics.TrackAsync("order_placed", ct);                          // analytics (marketing)
    }
}
```
After: cohesive pieces, extension by addition
```csharp
public interface IShippingRateProvider { string Carrier { get; } Money Quote(Cart cart, Address to); }
public sealed class DhlRates : IShippingRateProvider { public string Carrier => "dhl"; public Money Quote(Cart c, Address a) => new(5_90, "EUR"); }
public sealed class UpsRates : IShippingRateProvider { public string Carrier => "ups"; public Money Quote(Cart c, Address a) => new(7_50, "EUR"); }

public sealed class ShippingQuotes(IEnumerable<IShippingRateProvider> providers)
{
    private readonly Dictionary<string, IShippingRateProvider> _byCarrier = providers.ToDictionary(p => p.Carrier);
    public Money Quote(string carrier, Cart cart, Address to) =>
        _byCarrier.TryGetValue(carrier, out var p) ? p.Quote(cart, to) : throw new ArgumentOutOfRangeException(nameof(carrier));
}

public sealed class PlaceOrderHandler(OrderingDb db, Pricing pricing, ShippingQuotes shipping, IDomainEvents events)
{
    public async Task<Result<OrderId>> HandleAsync(PlaceOrder cmd, CancellationToken ct)
    {
        var total = pricing.Total(cmd.Cart, cmd.ShipTo) + shipping.Quote(cmd.Carrier, cmd.Cart, cmd.ShipTo);
        var order = Order.Place(cmd.CustomerId, cmd.Cart, total);
        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);                    // OrderPlaced recorded → outbox
        return order.Id;
    }
}
// Email, invoice PDF, and analytics are handlers of OrderPlaced in their own modules.
```
Adding a carrier is now one new class and one registration; no existing code changes.

## Production patterns
- Measure change: when one feature touches many files or teams collide in one class, look for low cohesion and high coupling.
- Split by reason to change (actor), not by line count.
- Extension points (strategies, events, data-driven rules) where variation is real and frequent.

## Mistakes
Wrong: `public Task SaveAsync(Order o, bool sendEmail, bool generatePdf, bool track)` (control coupling).
Right: save in the use case; other concerns react to an event or are separate calls.

Wrong: one interface and class per method ("SRP") so a feature spans 15 files.
Right: cohesive slices; split when different actors drive changes.

## Check yourself
1. What's the difference between coupling and cohesion?
2. How does SRP define "responsibility"?
3. How do you know OCP is worth applying to a piece of code?

<details><summary>Answers</summary>

1. Coupling is how much a part depends on others (lower is better); cohesion is how much the parts inside belong together (higher is better).
2. As a reason to change, tied to one actor or stakeholder group whose needs drive changes to that code.
3. When that kind of variation has already happened repeatedly (new carriers, payment methods) and each change required editing existing, working code in several places.
</details>

## Sources
- [Robert C. Martin — The Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html)
- [Martin Fowler — Coupling and cohesion (Refactoring)](https://refactoring.com/)
- [Bertrand Meyer — Open/Closed (Wikipedia)](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle)
- [Class coupling metric (Visual Studio)](https://learn.microsoft.com/visualstudio/code-quality/code-metrics-class-coupling)
- [Coupling types (Wikipedia)](https://en.wikipedia.org/wiki/Coupling_(computer_programming))
