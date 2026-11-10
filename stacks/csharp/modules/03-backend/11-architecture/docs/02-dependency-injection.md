---
title: Dependency injection and the composition root
tech: Microsoft.Extensions.DependencyInjection, ASP.NET Core 10, WebApplicationFactory
version: .NET 10
date: 2026-11-09
covers: [4]
---
# Dependency injection and the composition root
[← Overview](00-overview.md)

## Why it matters
- A singleton cache service took a scoped `DbContext` in its constructor. Every request shared one `DbContext`, and under load it threw "A second operation was started on this context instance".
- Services were created with `new` deep inside handlers, so tests couldn't replace the email sender, and the test suite sent real emails.
- `Program.cs` grew to 900 lines of registrations nobody could read, and a missing registration only failed when a rare endpoint was called in production.

## Concepts

### Lifetimes
| Lifetime | One instance per | Use for | Watch out |
|:--|:--|:--|:--|
| ⭐ singleton | app | stateless services, clients (`ServiceBusClient`, `HybridCache`), options | must be thread-safe; no scoped dependencies |
| ⭐ scoped | request (or explicit scope) | `DbContext`, use-case handlers, unit-of-work state | not from singletons or background threads without a scope |
| transient | resolution | lightweight stateless helpers, typed `HttpClient`s | disposable transients live until their scope ends |

**Captive dependency:** a longer-lived service holding a shorter-lived one (singleton → scoped). `ValidateScopes` catches it. It's on by default in Development; turn on `ValidateOnBuild` too so missing registrations fail at startup.

### The composition root
The one place where the object graph is wired: `Program.cs` (calling each module's `AddXxxModule`). Everything else receives dependencies through constructors.
| Rule | Why |
|:--|:--|
| ⭐ constructor injection | dependencies are explicit and visible |
| no service locator | `IServiceProvider.GetService` inside business code hides dependencies |
| registration per module | `AddOrderingModule()` keeps `Program.cs` short and modules self-contained |
| options pattern | `AddOptions<T>().BindConfiguration(...).ValidateDataAnnotations().ValidateOnStart()` |
| `TryAdd*` | library-style defaults that the host can override |

### Useful container features
| Feature | API |
|:--|:--|
| ⭐ keyed services (.NET 8+) | `AddKeyedScoped<IPaymentGateway, StripeGateway>("stripe")`; `[FromKeyedServices("stripe")] IPaymentGateway gw` |
| factories | `AddScoped<IClock>(sp => ...)` |
| open generics | `AddScoped(typeof(IValidator<>), typeof(...))` |
| multiple implementations | register several; inject `IEnumerable<T>` |
| decorators | not built in; write a wrapper registration or use Scrutor's `Decorate` (also seen) |
| scanning | not built in; Scrutor (also seen), or explicit registration (clearer) |
| `TimeProvider` | `TimeProvider.System` in prod, `FakeTimeProvider` in tests |
| `IServiceScopeFactory` | create scopes in singletons and background services |

### Fakes in tests
| Test type | How |
|:--|:--|
| unit | `new PlaceOrderHandler(fakeDb, fakeClock, Substitute.For<IPaymentGateway>())`, no container |
| ⭐ integration | `WebApplicationFactory` + `ConfigureTestServices(s => s.Replace(...))` |
| replace all | `services.RemoveAll<IEmailSender>(); services.AddSingleton<IEmailSender, FakeEmailSender>();` |

## Example
`src/Modules/Payments/Shop.Payments/PaymentsModule.cs`
```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

public static class PaymentsModule
{
    public static IServiceCollection AddPaymentsModule(this IServiceCollection services, IConfiguration config)
    {
        services.AddOptions<StripeOptions>().BindConfiguration("Payments:Stripe").ValidateDataAnnotations().ValidateOnStart();
        services.AddKeyedScoped<IPaymentGateway, StripeGateway>("stripe");
        services.AddKeyedScoped<IPaymentGateway, BankTransferGateway>("bank-transfer");
        services.AddScoped<IPayments, PaymentsFacade>();   // the module's public contract
        services.TryAddSingleton(TimeProvider.System);
        return services;
    }
}
```
`src/Modules/Payments/Shop.Payments/PaymentsFacade.cs`
```csharp
internal sealed class PaymentsFacade(IServiceProvider sp) : IPayments
{
    public async Task<Result<PaymentId>> ChargeAsync(ChargeRequest req, CancellationToken ct)
    {
        var gateway = sp.GetRequiredKeyedService<IPaymentGateway>(req.Method);   // key chosen at runtime
        return await gateway.ChargeAsync(req, ct);
    }
}
```
Resolving by a runtime key is the one place a provider lookup is fine: the choice depends on data. When the key is fixed, inject with `[FromKeyedServices("stripe")]`.

`src/Shop.Api/Program.cs`
```csharp
builder.Host.UseDefaultServiceProvider(o =>
{
    o.ValidateScopes = true;
    o.ValidateOnBuild = true;   // missing registrations fail at startup, in every environment
});
```
`tests/Shop.Api.Tests/ShopApiFactory.cs`
```csharp
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;

public sealed class ShopApiFactory : WebApplicationFactory<Program>
{
    public FakeTimeProvider Clock { get; } = new(new DateTimeOffset(2026, 11, 9, 10, 0, 0, TimeSpan.Zero));
    public FakeEmailSender Emails { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.ConfigureTestServices(s =>
        {
            s.Replace(ServiceDescriptor.Singleton<TimeProvider>(Clock));
            s.RemoveAll<IEmailSender>();
            s.AddSingleton<IEmailSender>(Emails);
        });
}
```

## Production patterns
- `Program.cs` reads like a table of contents: one `AddXxxModule` and one `MapXxxEndpoints` per module, plus cross-cutting setup.
- `ValidateScopes` and `ValidateOnBuild` on everywhere; options validated at startup.
- Singletons are stateless or thread-safe; background services create scopes per unit of work.
- Tests replace adapters (email, payments, clock) at the container boundary; domain and use cases are tested without a container.

## Mistakes
Wrong:
```csharp
builder.Services.AddSingleton<PriceCache>();            // PriceCache(ShopDb db) → captive DbContext
```
Right: make `PriceCache` scoped, or inject `IServiceScopeFactory` / `IDbContextFactory<ShopDb>` and create a context per use.

Wrong: `var sender = HttpContext.RequestServices.GetService<IEmailSender>()` inside a handler.
Right: constructor injection.

## Check yourself
1. What is a captive dependency, and what catches it?
2. When is resolving from `IServiceProvider` acceptable?
3. How do integration tests swap the email sender?

<details><summary>Answers</summary>

1. A service with a longer lifetime holding a shorter-lived one (for example a singleton holding a scoped `DbContext`), so the shorter-lived one is shared too long. `ValidateScopes` throws when this happens; `ValidateOnBuild` checks the registrations at startup.
2. In the composition root, in factories, in background services creating scopes, and when the implementation depends on runtime data (a keyed service chosen by key). Not as a general replacement for constructor injection.
3. With `WebApplicationFactory` and `ConfigureTestServices`: remove the real `IEmailSender` registration and add a fake singleton the test can inspect.
</details>

## Sources
- [Dependency injection in .NET](https://learn.microsoft.com/dotnet/core/extensions/dependency-injection)
- [DI guidelines](https://learn.microsoft.com/dotnet/core/extensions/dependency-injection-guidelines)
- [Keyed services](https://learn.microsoft.com/dotnet/core/extensions/dependency-injection#keyed-services)
- [Integration tests in ASP.NET Core](https://learn.microsoft.com/aspnet/core/test/integration-tests)
- [Options pattern](https://learn.microsoft.com/dotnet/core/extensions/options)
