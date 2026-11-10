---
title: Clean and hexagonal architecture, vertical slices, and the modular monolith
tech: C#, ASP.NET Core 10
version: .NET 10
date: 2026-11-09
covers: [4, 5, 6]
---
# Clean and hexagonal architecture, vertical slices, and the modular monolith
[← Overview](00-overview.md)

## Why it matters
- The domain project referenced EF Core and ASP.NET Core "just for attributes". Switching a table mapping required changing domain classes, and domain tests needed a database.
- A feature for "gift wrapping" touched `Controllers/`, `Services/`, `Repositories/`, `Models/`, `Validators/`, and `Mappings/`: six folders, nine files, and three reviewers.
- The "modular" monolith had modules, but they all shared one `DbContext` with every table. Within a year, every module queried every other module's tables.

## Concepts

### Clean, hexagonal, and onion: the dependency rule
| Style | Picture | Core idea |
|:--|:--|:--|
| ⭐ hexagonal (ports and adapters, Cockburn) | the app in the middle, ports on its edges, adapters outside (HTTP, DB, Stripe) | the app talks to the world only through ports it owns |
| onion (Palermo) | concentric rings: domain model → domain services → application services → infrastructure/UI | inner rings know nothing of outer rings |
| ⭐ clean (Martin) | entities → use cases → interface adapters → frameworks & drivers | **source dependencies point inward** |

All three say the same thing: business rules don't depend on frameworks, databases, or vendors; those depend on the core through interfaces the core defines (DIP, 02-principles lesson 02).

| Ring | Shop content | May reference |
|:--|:--|:--|
| domain | `Order`, `Money`, `OrderPlaced` | nothing |
| application / use cases | `PlaceOrderHandler`, ports `IPaymentGateway` | domain |
| adapters | endpoints, EF Core configurations, `StripeGateway` | application, domain |
| frameworks | ASP.NET Core, EF Core, Stripe.net | — |

### Vertical slice architecture and feature modules
| Organise by | Unit | Strength |
|:--|:--|:--|
| technical layer | Controllers / Services / Repositories | consistent places for kinds of code |
| ⭐ vertical slice | one folder per use case (endpoint + request + handler + validator + tests) | one feature in one place; slices can choose their own approach |
| ⭐ feature module | a group of slices around a domain area with a public contract | team ownership, boundaries |

Slices and clean architecture combine well: slices organise use cases, the dependency rule keeps the domain clean, and modules draw the boundaries.

### Modular monolith
| Property | Practice |
|:--|:--|
| ⭐ one deployable | one API process; in-process calls |
| ⭐ modules with public contracts | `Shop.Ordering.Contracts`; everything else `internal` |
| ⭐ data ownership per module | own schema, own `DbContext`; no cross-module table access |
| communication | contract calls for queries; integration events (outbox) for reactions |
| enforcement | project references, `internal`, architecture tests, CODEOWNERS |
| evolution | a module can become a service later along its contract |

## In our stack
- The full modular monolith with clean-architecture modules and slices: [03-backend/11-architecture lessons 01, 03, 06](../../../03-backend/11-architecture/README.md).
- Ports and adapters for partners: [03-backend/12-integrations](../../../03-backend/12-integrations/README.md).
- Data ownership with schemas per module: [03-backend/03-databases](../../../03-backend/03-databases/README.md).

## When not to
- Don't create four projects (Domain, Application, Infrastructure, Web) for a small app; folders with the dependency rule checked by a test give most of the benefit.
- Don't put ports around things you'll never replace or fake (your own `DbContext`).
- Don't split modules finer than your domain understanding; wrong boundaries are expensive to move. Start with a few coarse modules.

## Example
One slice inside the Ordering module:
```text
src/Modules/Ordering/Shop.Ordering/
  GiftWrap/
    AddGiftWrapEndpoint.cs        // HTTP adapter
    AddGiftWrapRequest.cs         // DTO
    AddGiftWrapHandler.cs         // use case
    AddGiftWrapValidator.cs
  Domain/Order.cs                 // Order.AddGiftWrap(...) rule lives here
  Data/OrderingDb.cs              // ordering.* schema only
```
`AddGiftWrapHandler.cs`
```csharp
internal sealed class AddGiftWrapHandler(OrderingDb db, ICatalogQueries catalog, TimeProvider time)
{
    public async Task<Result<OrderDto>> HandleAsync(AddGiftWrap cmd, CancellationToken ct)
    {
        var order = await db.Orders.Include(o => o.Lines).SingleOrDefaultAsync(o => o.Number == cmd.OrderNumber, ct);
        if (order is null) return Error.NotFound("order.not_found", "Order not found.");

        var wrap = await catalog.GiftWrapPriceAsync(order.Currency, ct);       // other module via its contract
        var result = order.AddGiftWrap(wrap, cmd.Message, time.GetUtcNow());  // rule in the domain
        if (!result.IsSuccess) return result.Error!;

        await db.SaveChangesAsync(ct);
        return order.ToDto();
    }
}
```
Dependency rule as an architecture test:
```csharp
[Fact]
public void Ordering_domain_depends_on_nothing_outside()
{
    var result = Types.InAssembly(typeof(OrderingModule).Assembly)
        .That().ResideInNamespace("Shop.Ordering.Domain")
        .ShouldNot().HaveDependencyOnAny("Microsoft.EntityFrameworkCore", "Microsoft.AspNetCore", "Stripe", "Shop.Ordering.Data")
        .GetResult();
    result.IsSuccessful.ShouldBeTrue();
}
```

## Production patterns
- The dependency rule everywhere: domain free of frameworks; adapters at the edge; checked by tests.
- Code organised by feature (slices) inside modules; modules own their data and expose contracts.
- Start as a modular monolith; module seams make later extraction possible without paying distributed costs now.

## Mistakes
Wrong: `[Table("Orders")]` and `[JsonPropertyName]` attributes on domain entities.
Right: EF Core fluent configuration in the data folder; DTOs for JSON.

Wrong: one shared `ShopDbContext` with every module's tables.
Right: a `DbContext` per module with its own schema.

## Check yourself
1. What do clean, hexagonal, and onion architecture have in common?
2. How do vertical slices and clean architecture fit together?
3. What makes a monolith "modular"?

<details><summary>Answers</summary>

1. The dependency rule: business rules sit at the centre and depend on nothing external; frameworks, databases, and vendors are outer details that depend on the core through interfaces the core owns.
2. Slices organise use cases by feature (everything for one operation together), while the dependency rule governs what each slice's code may depend on: the domain stays framework-free and adapters stay at the edge.
3. Enforced boundaries: modules with public contracts and internal implementations, each owning its data, communicating through contracts and events, with the boundaries checked by the compiler and tests.
</details>

## Sources
- [Alistair Cockburn — Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Jeffrey Palermo — The onion architecture](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/)
- [Robert C. Martin — The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Jimmy Bogard — Vertical slice architecture](https://www.jimmybogard.com/vertical-slice-architecture/)
- [Kamil Grzybek — Modular monolith](https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer)
