---
title: Mediators, mappers, and Clean Architecture templates
tech: Riok.Mapperly, C# 14, ASP.NET Core 10
version: Riok.Mapperly 4.x, .NET 10
date: 2026-11-09
covers: [9, 10]
---
# Mediators, mappers, and Clean Architecture templates
[← Overview](00-overview.md)

## Why it matters
- A new developer pressed F12 on `await mediator.Send(new PlaceOrderCommand(...))` and landed on an interface. Finding the code that runs took ten minutes, through pipeline behaviours registered by assembly scanning.
- AutoMapper mapped `Order.Customer.Email` into a public DTO by naming convention. Customer emails appeared in a public API for a month.
- In 2025, MediatR and AutoMapper moved to commercial licences. Companies on them had to budget, pin old versions, or migrate.

## Concepts

### Mediators
| Option | What you write | Trade-offs |
|:--|:--|:--|
| ⭐ plain handler classes | `PlaceOrderHandler.HandleAsync(cmd, ct)`, injected into the endpoint | F12 goes to the code; explicit; no library |
| endpoint filters / middleware | cross-cutting concerns (validation, logging) around endpoints | built into ASP.NET Core |
| decorators | `LoggingHandler<T>` wrapping a handler | explicit; a few lines of registration |
| MediatR 13+ | `IRequest<T>`, `IRequestHandler<,>`, pipeline behaviours | familiar to many teams; **commercial** licence (free community tier for small companies); indirection |
| source-generated mediators (also seen) | e.g. the MIT `Mediator` package | no reflection; same indirection |
| Wolverine (also seen) | handlers + messaging + outbox | bigger framework |

Mediators are useful for **in-process messaging** (publish an event to many handlers) and for **uniform pipelines** across many handlers. For "endpoint calls one use case", a plain injected handler is clearer.

### Mappers
| Option | How | Trade-offs |
|:--|:--|:--|
| ⭐ manual mapping | constructors, `ToDto()` extension methods, EF Core `Select` projections | explicit, debuggable, compile-time safe |
| ⭐ Mapperly | `[Mapper] partial class` + source generator | MIT, no reflection, compile errors and warnings for unmapped members; generated code is readable |
| AutoMapper 15+ | runtime configuration and conventions | **commercial**; reflection; mapping errors at runtime; hidden data exposure |

Rules for any approach:
| Rule | Why |
|:--|:--|
| ⭐ map explicitly to DTOs per endpoint | never return entities; never let conventions add fields |
| ⭐ treat unmapped members as errors | Mapperly: `RequiredMappingStrategy`, warnings as errors |
| project in the query | `.Select(o => new OrderSummary(...))` reads only needed columns |
| no business logic in mappers | rules belong in the domain |

### Clean Architecture templates in .NET
| Template | Shape |
|:--|:--|
| Jason Taylor's CleanArchitecture (`dotnet new ca-sln`) | Domain, Application, Infrastructure, Web projects; MediatR-style commands; Aspire |
| Ardalis CleanArchitecture | Core, UseCases, Infrastructure, Web; FastEndpoints; Ardalis libraries |

| What they get right | Where they over-engineer (for many apps) |
|:--|:--|
| ⭐ dependency rule: domain independent of frameworks | ⭐ four or more projects for a CRUD app with one team |
| testable use cases | a mediator call for every operation |
| explicit error handling and validation pipelines | repositories and specifications wrapping EF Core |
| a consistent structure across teams | interfaces for every class, used once |
| infrastructure behind abstractions | layers organised by technical role, not by feature |

Take the ideas (dependency rule, testable core, ports for external services), organise by **feature modules**, and add projects and abstractions only when they pay for themselves.

## Example
`src/Modules/Ordering/Shop.Ordering/OrderMapper.cs` (Mapperly)
```csharp
using Riok.Mapperly.Abstractions;

[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Target)]   // every DTO member must be mapped
internal static partial class OrderMapper
{
    [MapProperty(nameof(Order.Total), nameof(OrderDto.TotalMinor), Use = nameof(ToMinor))]
    [MapperIgnoreSource(nameof(Order.CustomerEmail))]                 // explicit: never expose
    public static partial OrderDto ToDto(this Order order);

    public static partial IQueryable<OrderSummary> ProjectToSummary(this IQueryable<Order> q);   // becomes a SQL projection

    private static long ToMinor(Money m) => m.Minor;
}
```
With `<WarningsAsErrors>RMG012;RMG020</WarningsAsErrors>` (unmapped target / source members) in the project file, a new DTO property that nobody mapped fails the build.

Manual mapping is just as good for small DTOs:
```csharp
public static OrderDto ToDto(this Order o) =>
    new(o.Id.Value, o.Status.ToString(), o.Total.Minor, o.Total.Currency, [.. o.Lines.Select(l => l.ToDto())]);
```
A plain handler instead of a mediator:
```csharp
app.MapPost("/orders", (PlaceOrderRequest req, PlaceOrderHandler handler, ClaimsPrincipal user, CancellationToken ct) => ...);
// cross-cutting: validation filter on the route group, logging and tracing from middleware and OpenTelemetry
var orders = app.MapGroup("/orders").AddEndpointFilter<ValidationFilter>();
```

## Production patterns
- Endpoints inject the handler they call. A mediator is added only when in-process publish/subscribe or many uniform pipelines justify it, and with its licence checked.
- DTO mapping is explicit: hand-written or Mapperly with unmapped-member warnings as errors; queries project straight into DTOs.
- Templates are a source of ideas, not a starting point to copy wholesale; the structure follows modules and features.
- Licences of architectural libraries are tracked like any dependency risk (05-practice).

## Mistakes
Wrong: `CreateMap<Order, OrderDto>()` with conventions, returning whatever matches by name.
Right: explicit mapping where a new field must be mapped on purpose.

Wrong: copying a four-project Clean Architecture template for a two-month MVP with one developer.
Right: one project with feature folders, the dependency rule, and ports for external services; split later.

## Check yourself
1. When is a mediator worth its indirection?
2. Why is Mapperly safer than convention-based runtime mapping?
3. Name two ideas worth keeping from Clean Architecture templates and two things to drop.

<details><summary>Answers</summary>

1. When you need in-process publish/subscribe to many handlers, or one pipeline (validation, transactions, logging) applied uniformly across many handlers, and the team accepts the indirection and licence.
2. Mapping code is generated at compile time: you can read it, the build warns (or fails) on unmapped members, nothing is resolved by reflection at runtime, and new fields aren't exposed by accident.
3. Keep: the dependency rule (domain free of frameworks) and testable use cases with ports for external services. Drop (for most apps): one project per layer by default, and a mediator plus repository for every operation.
</details>

## Sources
- [Mapperly documentation](https://mapperly.riok.app/docs/intro/)
- [Jimmy Bogard — AutoMapper and MediatR commercial editions](https://www.jimmybogard.com/automapper-and-mediatr-commercial-editions-launch-today/)
- [Jason Taylor — Clean Architecture template](https://github.com/jasontaylordev/CleanArchitecture)
- [Ardalis — Clean Architecture template](https://github.com/ardalis/CleanArchitecture)
- [Minimal API filters](https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/min-api-filters)
