---
title: Modular monolith, layers, and feature modules
tech: ASP.NET Core 10, C# 14, .slnx solutions
version: .NET 10, C# 14
date: 2026-11-09
covers: [1, 2, 3]
---
# Modular monolith, layers, and feature modules
[← Overview](00-overview.md)

## Why it matters
- Code organised as `Controllers/`, `Services/`, `Repositories/`, `Models/`. Changing "how discounts work" means editing files in every folder, and `OrderService` grew to 3,000 lines because everything could call everything.
- Business rules lived in endpoints and SQL. When the mobile app needed the same checkout, the rules were copied, and the copies drifted.
- The team split into four microservices in month two. Every feature now needs three deploys and a contract change.

## Concepts

### What architecture is for
| Goal | Meaning |
|:--|:--|
| ⭐ cheap change | the common changes touch few files in one place |
| team autonomy | teams own modules and can change them without coordinating every PR |
| explicit trade-offs | decisions are written down with their costs (lesson 06) |
| testability | business rules testable without HTTP, SQL, or partners |

**Start with a modular monolith:** one deployable app, split inside into modules with clear boundaries. You get in-process speed and simple operations now, and seams to extract services later if you need them.

### Layers and the dependency rule
| Layer | Holds | May depend on |
|:--|:--|:--|
| routes (endpoints) | HTTP binding, auth policies, status codes | use cases |
| ⭐ use cases (application) | one class or method per operation: `PlaceOrder`, `CancelOrder`; transactions; calls ports | domain, ports |
| ⭐ domain | entities, value objects, rules, domain events | nothing (no EF Core, no HTTP) |
| data / adapters | EF Core `DbContext`, queries, Stripe/email/Blob clients implementing ports | domain, ports |

**Dependency rule:** source code dependencies point inward, toward the domain. The domain never references ASP.NET Core, EF Core, or SDKs. EF Core can map domain types from the outside (fluent configuration).

Pragmatism: with EF Core, a separate repository layer over `DbContext` often adds nothing. Use the `DbContext` in use cases directly (it already is a unit of work and repository), and add repositories only where a query is reused or an aggregate needs protecting.

### Feature modules instead of technical folders
| Technical folders (avoid) | Feature modules (prefer) |
|:--|:--|
| `Controllers/OrdersController.cs` | `Modules/Ordering/PlaceOrder/PlaceOrderEndpoint.cs` |
| `Services/OrderService.cs` | `Modules/Ordering/PlaceOrder/PlaceOrderHandler.cs` |
| `Models/Order.cs` | `Modules/Ordering/Domain/Order.cs` |
| `Repositories/OrderRepository.cs` | `Modules/Ordering/Data/OrderingDb.cs` |

Each module has:
| Part | Purpose |
|:--|:--|
| ⭐ public contracts | the only types other modules may use: interfaces like `ICatalogQueries`, DTOs, integration events |
| internal implementation | everything else is `internal` |
| its own data | its own tables (and schema, `catalog.*`, `ordering.*`); no other module queries them |
| a registration method | `AddOrderingModule(...)` and `MapOrderingEndpoints(...)` |

Inside a module, **vertical slices** (a folder per use case with endpoint, request, handler, and validator) keep a feature in one place.

## Example
Repository layout (`Shop.slnx`)
```text
src/
  Shop.Api/                         # host: Program.cs, composition root, middleware
  Modules/
    Catalog/
      Shop.Catalog.Contracts/       # ICatalogQueries, ProductSummary (public)
      Shop.Catalog/                 # internal: domain, data, endpoints, use cases
    Ordering/
      Shop.Ordering.Contracts/      # OrderPlaced (integration event), IOrderQueries
      Shop.Ordering/
        Domain/Order.cs, OrderLine.cs, Money.cs
        PlaceOrder/PlaceOrderEndpoint.cs, PlaceOrderRequest.cs, PlaceOrderHandler.cs, PlaceOrderValidator.cs
        Data/OrderingDb.cs, OrderConfiguration.cs
        OrderingModule.cs           # AddOrderingModule, MapOrderingEndpoints
    Payments/ ...
  Shared/Shop.SharedKernel/         # Result, Error, Money, IClock (small and stable)
tests/
  Shop.Ordering.Tests/, Shop.Api.Tests/, Shop.ArchitectureTests/
```
`src/Modules/Ordering/Shop.Ordering/PlaceOrder/PlaceOrderEndpoint.cs`
```csharp
internal static class PlaceOrderEndpoint
{
    public static RouteHandlerBuilder MapPlaceOrder(this IEndpointRouteBuilder app) =>
        app.MapPost("/orders", async (PlaceOrderRequest req, PlaceOrderHandler handler, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(req.ToCommand(user.GetUserId()), ct);
            return result.ToHttp(order => TypedResults.Created($"/orders/{order.Number}", order));   // one mapping, lesson 03
        })
        .RequireAuthorization()
        .WithName("PlaceOrder");
}
```
`src/Modules/Ordering/Shop.Ordering/OrderingModule.cs`
```csharp
public static class OrderingModule
{
    public static IServiceCollection AddOrderingModule(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<OrderingDb>(o => o.UseSqlServer(config.GetConnectionString("Shop"),
            sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "ordering")));
        services.AddScoped<PlaceOrderHandler>();
        services.AddScoped<IOrderQueries, OrderQueries>();
        return services;
    }

    public static IEndpointRouteBuilder MapOrderingEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPlaceOrder().WithTags("Orders");
        // app.MapCancelOrder()..., one line per slice
        return app;
    }
}
```
`src/Shop.Api/Program.cs`
```csharp
builder.Services.AddCatalogModule(builder.Configuration)
                .AddOrderingModule(builder.Configuration)
                .AddPaymentsModule(builder.Configuration);
var app = builder.Build();
app.MapCatalogEndpoints().MapOrderingEndpoints().MapPaymentsEndpoints();
```

## Production patterns
- One deployable modular monolith, modules owning their tables (separate schemas) and exposing only contracts.
- Vertical slices inside modules; shared code limited to a small, stable kernel (results, money, clock), never "Common/Utils" dumping grounds.
- Domain types free of framework references; EF Core mappings live in the module's `Data` folder.
- Start with folders, then promote modules to projects when the boundaries prove right (projects make `internal` enforce them, lesson 06).

## Mistakes
Wrong: `OrderingDb` querying `catalog.Products` directly ("it's the same database").
Right: Ordering calls `ICatalogQueries.GetPricesAsync(...)`, or keeps its own copy of the data it needs, updated by events.

Wrong: a `Shared` project that every module references and everyone adds to.
Right: a tiny shared kernel; module-specific types stay in their module.

## Check yourself
1. What does "the dependency rule" say about the domain?
2. What may other modules use from the Ordering module?
3. Why start with a modular monolith instead of microservices?

<details><summary>Answers</summary>

1. The domain depends on nothing outside itself: no ASP.NET Core, EF Core, or SDK types. Outer layers depend on it, never the reverse.
2. Only its public contracts: the `Shop.Ordering.Contracts` interfaces, DTOs, and integration events. Never its internal types or its tables.
3. You get clear boundaries and team ownership while keeping in-process calls, one deploy, one database, and simple debugging. Extraction is still possible later along the module seams, once you know where the boundaries really are.
</details>

## Sources
- [Common web application architectures](https://learn.microsoft.com/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)
- [Jimmy Bogard — Vertical slice architecture](https://www.jimmybogard.com/vertical-slice-architecture/)
- [Robert C. Martin — The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Kamil Grzybek — Modular monolith primer](https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer)
- [Martin Fowler — MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)
