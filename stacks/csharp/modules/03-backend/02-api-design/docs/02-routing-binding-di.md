---
title: Routing, binding, and dependency injection
tech: ASP.NET Core 10 Minimal APIs, Microsoft.Extensions.DependencyInjection
version: ASP.NET Core 10
date: 2026-11-09
covers: [3, 4]
---
# Routing, binding, and dependency injection
[← Overview](00-overview.md)

## Why it matters
- `/orders/{id}` matches `/orders/export` and fails with "can't convert 'export' to int", returning 400 instead of reaching the export endpoint.
- A singleton `PriceCache` takes `ShopDb` (scoped) in its constructor; the first request's `DbContext` is used forever, across threads. Data corruption follows.
- A service resolves `IServiceProvider` and calls `GetService` everywhere; nobody can tell what it depends on, and tests need half the app.

## Concepts

### Routing
| Template | Matches |
|:--|:--|
| `/orders/{id:guid}` | GUIDs only |
| `/orders/{id:int:min(1)}` | positive ints |
| `/products/{slug:regex(^[a-z0-9-]+$)}` | constrained strings |
| `/files/{*path}` | catch-all |
| `/orders/{id}/lines/{lineId}` | nested |

Constraints are for **routing disambiguation**, not input validation (a failed constraint means 404, not 400). Literal segments beat parameters (`/orders/export` wins over `/orders/{id}`).

### Binding sources (Minimal APIs)
| Source | How | Example |
|:--|:--|:--|
| route | parameter name matches template | `Guid id` |
| query | simple types not in the route | `int page = 1`, `string? q` |
| header | `[FromHeader(Name = "Idempotency-Key")]` | |
| body (JSON) | complex type on POST/PUT/PATCH (one per endpoint) | `CreateOrderRequest body` |
| form | `[FromForm]`, `IFormFile`, `IFormFileCollection` | uploads (antiforgery applies) |
| services | registered types are injected | `OrderService orders` |
| keyed services | `[FromKeyedServices("stripe")] IPaymentGateway gw` | |
| special | `HttpContext`, `HttpRequest`, `ClaimsPrincipal`, `CancellationToken`, `Stream`/`PipeReader` | |
| ⭐ `[AsParameters]` | group many parameters into a record | `[AsParameters] OrderQuery q` |
| custom | `static bool TryParse(string, out T)` or `static ValueTask<T?> BindAsync(HttpContext)` | value objects like `Sku` |

`TypedResults` + `Results<T1, T2, …>` return types document responses (01-foundations/08).

### Dependency injection
ASP.NET Core has a built-in container. Register services with a lifetime; ask for them in constructors (or handler parameters).
| Lifetime | One instance per | Use for | Watch out |
|:--|:--|:--|:--|
| ⭐ Singleton | app | stateless services, caches, `HttpClient` factories, options | must be thread-safe; never hold scoped services |
| ⭐ Scoped | request (or explicit scope) | `DbContext`, unit of work, per-request services | don't use outside a scope (background services create one) |
| Transient | each resolution | lightweight stateless helpers | disposable transients live until the scope ends |

**Captive dependency**: a longer-lived service holding a shorter-lived one (singleton → scoped). In Development, `ValidateScopes` and `ValidateOnBuild` are on and throw at startup; keep them on in tests too.

| API | Use |
|:--|:--|
| `AddSingleton/AddScoped/AddTransient<IFoo, Foo>()` | register |
| `TryAdd*` | register only if missing (libraries) |
| `AddKeyedScoped<IPaymentGateway, StripeGateway>("stripe")` | several implementations by key (.NET 8+) |
| `IServiceScopeFactory.CreateAsyncScope()` | scopes in background work |
| factory registrations `AddScoped(sp => new X(sp.GetRequiredService<Y>()))` | custom construction |
| `IEnumerable<IHandler>` | inject all registrations |
| avoid service locator | don't inject `IServiceProvider` into business code |

Group registrations per feature in extension methods (`services.AddOrderFeature()`), the composition root idea from 03-backend/11-architecture.

## Example
`src/Shop.Api/Features/Orders/OrderQuery.cs`
```csharp
using System.ComponentModel;

namespace Shop.Api.Features.Orders;

public sealed record OrderQuery(
    [property: Description("Filter by status")] OrderStatus? Status,
    [property: Description("Opaque cursor from the previous page")] string? Cursor,
    int Limit = 20);
```
`src/Shop.Api/Features/Catalog/Sku.cs` (custom binding)
```csharp
public readonly record struct Sku(string Value)
{
    public static bool TryParse(string? s, out Sku sku)
    {
        var ok = s is { Length: >= 3 and <= 20 } && s.All(c => char.IsAsciiLetterUpper(c) || char.IsAsciiDigit(c) || c == '-');
        sku = ok ? new Sku(s!) : default;
        return ok;                                        // false → 400 Bad Request
    }
    public override string ToString() => Value;
}
```
`src/Shop.Api/Features/Orders/OrderFeature.cs`
```csharp
namespace Shop.Api.Features.Orders;

public static class OrderFeature
{
    public static IServiceCollection AddOrderFeature(this IServiceCollection services)
    {
        services.AddScoped<OrderService>();                                    // uses ShopDb (scoped)
        services.AddSingleton(TimeProvider.System);
        services.AddKeyedScoped<IPaymentGateway, StripeGateway>("stripe");
        services.AddKeyedScoped<IPaymentGateway, FakeGateway>("fake");
        return services;
    }
}
```
Endpoints using them:
```csharp
g.MapGet("/", ([AsParameters] OrderQuery q, OrderService orders, CancellationToken ct) => orders.ListAsync(q, ct));
app.MapGet("/products/{sku}", (Sku sku, CatalogService catalog, CancellationToken ct) => catalog.GetAsync(sku, ct));
app.MapPost("/payments/test", ([FromKeyedServices("fake")] IPaymentGateway gw) => gw.PingAsync());
```

## Production patterns
- Route constraints only to disambiguate routes; validation happens in the validation layer (lesson 03).
- `[AsParameters]` records for list endpoints with many query parameters; value objects with `TryParse` for typed IDs/SKUs.
- `DbContext` and anything using it scoped; singletons are stateless or thread-safe; scope validation on in Development and tests.
- One registration extension per feature; `Program.cs` just calls them.

## Mistakes
Wrong: singleton depending on scoped.
```csharp
builder.Services.AddSingleton<PriceCache>();      // PriceCache(ShopDb db) → captive DbContext
```
Right: make `PriceCache` use `IServiceScopeFactory` to create a scope when refreshing, or make it scoped.

Wrong: `IServiceProvider` injected everywhere.
Right: constructor parameters for real dependencies; the container stays at the edges.

## Check yourself
1. What happens when a route constraint fails?
2. Why is singleton → scoped a bug?
3. How do you bind a header named `Idempotency-Key`?

<details><summary>Answers</summary>

1. The route doesn't match; if no other route does, the result is 404, not a validation 400.
2. The singleton keeps the first scoped instance forever and shares it across concurrent requests (a disposed or non-thread-safe `DbContext`).
3. `[FromHeader(Name = "Idempotency-Key")] string? key` (or `Guid?`).
</details>

## Sources
- [Routing in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/routing)
- [Parameter binding in Minimal APIs](https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/parameter-binding)
- [Dependency injection in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/dependency-injection)
- [DI guidelines (captive dependencies, scope validation)](https://learn.microsoft.com/dotnet/core/extensions/dependency-injection-guidelines)
- [Keyed services](https://learn.microsoft.com/dotnet/core/extensions/dependency-injection#keyed-services)
