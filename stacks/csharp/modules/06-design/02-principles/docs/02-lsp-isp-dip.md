---
title: LSP, ISP, and DIP
tech: C# 14
version: C# 14 / .NET 10
date: 2026-11-09
covers: [4, 5, 6]
---
# LSP, ISP, and DIP
[← Overview](00-overview.md)

## Why it matters
- `ReadOnlyProductRepository` implemented `IProductRepository` and threw `NotSupportedException` from `Save`. A background job got it from DI and crashed at 02:00.
- `IOrderService` had 34 methods. Every test faked all of them, and every change to one method broke unrelated test fakes.
- Domain code referenced `Stripe.PaymentIntent`. Upgrading Stripe.net touched 40 files across Ordering, Payments, and Notifications.

## Concepts

### Liskov Substitution Principle (LSP)
Objects of a subtype must be usable wherever the base type is expected **without surprising the caller**: same preconditions or weaker, same postconditions or stronger, same invariants, no new exceptions.
| Violation sign | Example |
|:--|:--|
| ⭐ `NotSupportedException` / `NotImplementedException` in an override | read-only repository implementing `Save` |
| type checks on the abstraction | `if (gateway is BankTransferGateway) ...` |
| stricter input rules in a subtype | `Discount` base accepts 0–100, subtype throws above 50 |
| weaker guarantees | a cache that sometimes returns stale data where callers assume fresh |
| classic | `Square : Rectangle` breaking `SetWidth` |

Fix by splitting the abstraction (ISP) or using composition instead of inheritance.

### Interface Segregation Principle (ISP)
Clients shouldn't depend on methods they don't use. Prefer small, **client-specific** interfaces over one big one.
| Smell | Fix |
|:--|:--|
| ⭐ interfaces with 20+ members | split by client: `IOrderQueries`, `IOrderCommands` |
| fakes implementing unused methods | narrower interfaces |
| read-only clients holding write methods | `IReadOnlyList<T>`, query interfaces |

.NET examples: `IReadOnlyCollection<T>` vs `ICollection<T>`, `IAsyncDisposable`, `IParsable<T>`: small, role-based interfaces.

### Dependency Inversion Principle (DIP)
High-level policy shouldn't depend on low-level detail; both depend on abstractions, and **the abstraction is owned by the high-level (core) code**.
| Without DIP | With DIP |
|:--|:--|
| `PlaceOrder` → `StripeGateway` → Stripe.net | `PlaceOrder` → `IPaymentGateway` (in Payments core) ← `StripeGateway` (adapter) |
| core changes when the vendor changes | only the adapter changes |
| hard to test without the vendor | fake implements the port |

DIP ≠ dependency injection. DI is the mechanism that wires implementations to abstractions; DIP is the decision about **who owns** the abstraction and which way source dependencies point (03-backend/11-architecture lesson 01: the dependency rule).

## In our stack
- Ports owned by the core, adapters at the edge: [03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-ports.md).
- Query vs command contracts between modules (`ICatalogQueries`): [03-backend/11-architecture lesson 01](../../../03-backend/11-architecture/docs/01-modular-monolith-layers-modules.md).
- Read-only interfaces on aggregates (`IReadOnlyList<OrderLine>`): [01-paradigms-oop lesson 04](../../01-paradigms-oop/docs/04-entities-values-choosing.md).

## When not to
- Don't create an abstraction for your own `DbContext` just to satisfy DIP; EF Core is already an abstraction, and integration tests with a real database are better.
- Don't split interfaces into one method each; segregate by client needs, not mechanically.
- Don't invert dependencies inside one small module where both sides change together.

## Example
LSP violation and fix:
```csharp
// Wrong: a subtype that can't honour the contract
public interface IProductStore { Product? Find(Sku sku); void Save(Product p); }
public sealed class CatalogSnapshot : IProductStore
{
    public Product? Find(Sku sku) => /* from a read-only snapshot */ null;
    public void Save(Product p) => throw new NotSupportedException();      // surprises callers
}

// Right: segregate by client need
public interface IProductReader { Product? Find(Sku sku); }
public interface IProductWriter { void Save(Product p); }
public sealed class CatalogSnapshot : IProductReader { public Product? Find(Sku sku) => null; }
public sealed class ProductStore(CatalogDb db) : IProductReader, IProductWriter
{
    public Product? Find(Sku sku) => db.Products.SingleOrDefault(p => p.Sku == sku);
    public void Save(Product p) => db.Products.Update(p);
}
```
ISP: from a fat service to client-specific contracts:
```csharp
// Wrong: every client depends on all 30 members
public interface IOrderService { /* Place, Cancel, Refund, Search, Export, Report..., 30 members */ }

// Right
public interface IOrderQueries { Task<OrderSummary?> FindAsync(long number, CancellationToken ct); }        // used by Support, Loyalty
public interface IOrderRefunds { Task<Result<RefundId>> RefundAsync(long number, Money amount, CancellationToken ct); }   // used by Payments admin
```
DIP: the core owns the port:
```csharp
// Shop.Payments (core): owns the abstraction, speaks domain language
public interface IPaymentGateway { Task<Result<PaymentId>> ChargeAsync(ChargeRequest request, CancellationToken ct); }

// Shop.Payments.Stripe (adapter): depends on the core and on Stripe.net
internal sealed class StripeGateway(StripeClient stripe) : IPaymentGateway
{
    public async Task<Result<PaymentId>> ChargeAsync(ChargeRequest req, CancellationToken ct)
    {
        var intent = await new PaymentIntentService(stripe).CreateAsync(new()
        {
            Amount = req.Amount.Minor, Currency = req.Amount.Currency.ToLowerInvariant(),
            PaymentMethod = req.PaymentMethodToken, Confirm = true,
        }, cancellationToken: ct);
        return new PaymentId(intent.Id);                                   // Stripe types stay in this class
    }
}

// Composition root wires them (DI is the mechanism)
services.AddScoped<IPaymentGateway, StripeGateway>();
```

## Production patterns
- Abstractions are contracts callers can rely on; implementations that can't honour them get a different, narrower interface.
- Interfaces are shaped by their clients (query vs command, reader vs writer) and stay small.
- The core defines ports in its own terms; adapters translate vendor types; source dependencies point inward.

## Mistakes
Wrong:
```csharp
public override void ApplyDiscount(int pct)
{
    if (pct > 50) throw new ArgumentException("Max 50% for gift cards");   // stricter precondition than the base
    base.ApplyDiscount(pct);
}
```
Right: model gift cards so the rule is part of the contract (a different type or an explicit `CanApply` check on the abstraction).

Wrong: `IPaymentGateway` defined in the Stripe adapter project and returning `PaymentIntent`.
Right: defined in the core, returning `Result<PaymentId>`.

## Check yourself
1. What's a quick sign of an LSP violation in C#?
2. Who should own an interface according to DIP?
3. How is DIP different from dependency injection?

<details><summary>Answers</summary>

1. An override or implementation that throws `NotSupportedException`/`NotImplementedException`, or callers that check the concrete type before calling.
2. The high-level (core) code that uses it: the interface lives with the policy and is expressed in its language; low-level adapters implement it.
3. DIP is a design rule about the direction of source dependencies and ownership of abstractions; DI is a technique (often a container) for supplying implementations to code that depends on abstractions.
</details>

## Sources
- [Barbara Liskov & Jeannette Wing — A behavioral notion of subtyping](https://dl.acm.org/doi/10.1145/197320.197383)
- [Interface segregation principle (Wikipedia)](https://en.wikipedia.org/wiki/Interface_segregation_principle)
- [Dependency inversion principle (.NET architecture guide)](https://learn.microsoft.com/dotnet/architecture/modern-web-apps-azure/architectural-principles#dependency-inversion)
- [Architectural principles (.NET)](https://learn.microsoft.com/dotnet/architecture/modern-web-apps-azure/architectural-principles)
- [Mark Seemann — Dependency Injection Principles, Practices, and Patterns](https://www.manning.com/books/dependency-injection-principles-practices-patterns)
