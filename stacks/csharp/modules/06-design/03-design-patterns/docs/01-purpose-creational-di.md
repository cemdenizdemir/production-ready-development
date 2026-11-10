---
title: What patterns are for, creational patterns, and DI
tech: C# 14, Microsoft.Extensions.DependencyInjection
version: C# 14 / .NET 10
date: 2026-11-09
covers: [1, 2, 3]
---
# What patterns are for, creational patterns, and DI
[← Overview](00-overview.md)

## Why it matters
- A hand-written `static PaymentGatewaySingleton.Instance` held a scoped `DbContext`. Concurrent requests corrupted its change tracker.
- Test orders were built with 14-argument constructors copy-pasted across 60 tests. Adding one required field broke all of them.
- `new StripeGateway(new HttpClient(), config["Stripe:Key"])` was scattered through handlers, so tests hit the real Stripe sandbox.

## Concepts

### What patterns are for
| Part of a pattern | Meaning |
|:--|:--|
| ⭐ problem and forces | the recurring situation and the pressures (variation, coupling, lifecycle) |
| ⭐ solution | a named arrangement of objects/functions |
| ⭐ consequences | what you gain and pay (indirection, more types) |
| vocabulary | shared names make design discussions short |

In modern C#, many patterns shrink to a few lines: a strategy can be a `Func<>`, a factory can be a static method or a DI registration.

### Creational patterns
| Pattern | Solves | Modern C# form |
|:--|:--|:--|
| ⭐ factory function / static factory method | validated or named construction | `Order.Create(...)`, `Money.Parse(...)`, returning `Result<T>` |
| factory method (GoF) | subclasses decide which object to create | rarely needed; a `Func<T>` or DI factory |
| ⭐ abstract factory | create families of related objects | an interface returning related products, or keyed services |
| ⭐ builder | many optional parts, step-by-step construction, readable tests | fluent test data builders; records + `with` + `required` often enough |
| prototype | copy and tweak | records: `original with { Status = ... }` |
| ⭐ singleton | one instance for the app | `services.AddSingleton<T>()`, never a hand-rolled static |

| Singleton risk | Why |
|:--|:--|
| ⭐ hidden global state | any code can reach it; hard to test |
| ⭐ captive dependencies | holding scoped services (DbContext) |
| thread safety | shared across requests |
| lifetime control | can't reset in tests |

### DI and the composition root
The DI container is the modern creational pattern: it decides **what** to create, **when**, and for **how long** (lifetimes), from registrations in one place (03-backend/11-architecture lesson 02).
| Need | DI form |
|:--|:--|
| one instance | `AddSingleton<T>()` |
| per request | `AddScoped<T>()` |
| choose by key | `AddKeyedScoped<IPaymentGateway, StripeGateway>("stripe")` |
| complex construction | `AddScoped<T>(sp => ...)` factory delegate |
| create on demand | inject `IServiceScopeFactory`, `IDbContextFactory<T>`, `IHttpClientFactory`, or `Func<T>` (manual registration) |

## In our stack
- Static factories returning results (`Order.Place`, `Email.Parse`): [01-paradigms-oop lesson 03](../../01-paradigms-oop/docs/03-functional-adts-results.md).
- Factories in .NET: `IHttpClientFactory`, `IDbContextFactory<T>`, `IMeterFactory`, `ILoggerFactory`.
- Keyed services as an abstract-factory replacement: [03-backend/11-architecture lesson 02](../../../03-backend/11-architecture/docs/02-dependency-injection.md).
- Builders for test data: [01-foundations/03-testing](../../../01-foundations/03-testing/README.md).

## When not to
- Don't write `IOrderFactory` for objects a constructor or a static method creates fine.
- Don't build fluent builders for production types with three properties; use `required` init properties.
- Never hand-roll singletons with static `Instance` properties in application code; use DI lifetimes.

## Example
Static factory with validation:
```csharp
public sealed record Sku
{
    public string Value { get; }
    private Sku(string value) => Value = value;

    public static Result<Sku> Parse(string input) =>
        Regex.IsMatch(input, "^[A-Z]{3}-[0-9]{4}$")
            ? new Sku(input)
            : new Error("sku.invalid", "SKU looks like ABC-1234.", ErrorType.Validation);
}
```
Test data builder (tests read like the scenario):
```csharp
public sealed class OrderBuilder
{
    private readonly List<OrderLine> _lines = [new(Sku.Parse("TST-0001").Value!, 1, 10_00)];
    private string _currency = "EUR";
    private OrderStatus _status = OrderStatus.Pending;

    public OrderBuilder WithLine(string sku, int qty, long priceMinor) { _lines.Add(new(Sku.Parse(sku).Value!, qty, priceMinor)); return this; }
    public OrderBuilder InCurrency(string currency) { _currency = currency; return this; }
    public OrderBuilder Shipped() { _status = OrderStatus.Shipped; return this; }
    public Order Build() => Order.Rehydrate(OrderId.New(), _lines, _currency, _status);
}

var order = new OrderBuilder().WithLine("ETH-0250", 2, 14_90).Shipped().Build();
```
Records as prototypes, `required` instead of a builder:
```csharp
public sealed record EmailMessageSpec
{
    public required string To { get; init; }
    public required string Subject { get; init; }
    public string? ReplyTo { get; init; }
}

var confirmation = new EmailMessageSpec { To = customer.Email, Subject = "Your order" };
var copyToSupport = confirmation with { To = "support@shop.example" };
```
Abstract factory via keyed DI (families per payment provider):
```csharp
services.AddKeyedScoped<IPaymentGateway, StripeGateway>("stripe");
services.AddKeyedScoped<IRefundGateway, StripeRefunds>("stripe");
services.AddKeyedScoped<IPaymentGateway, BankTransferGateway>("bank");
services.AddKeyedScoped<IRefundGateway, BankTransferRefunds>("bank");

public sealed class RefundOrder([FromKeyedServices("stripe")] IRefundGateway refunds) { /* ... */ }
```

## Production patterns
- Construction rules live in static factories or constructors that return valid objects (or results).
- Object graphs and lifetimes are the DI container's job; singletons exist only as DI registrations with thread-safe, stateless implementations.
- Builders are used where they pay most: test data and complex optional configuration.

## Mistakes
Wrong:
```csharp
public sealed class Settings { public static Settings Instance { get; } = Load(); public string StripeKey { get; set; } = ""; }
```
Right: `IOptions<StripeOptions>` from configuration, validated at startup, injected.

Wrong: `new SmtpEmailSender(...)` inside a use case.
Right: inject `IEmailSender`; the composition root chooses the implementation.

## Check yourself
1. What three parts make a pattern useful to know?
2. What are the risks of a hand-rolled singleton?
3. When is a builder worth it in C#?

<details><summary>Answers</summary>

1. The problem and its forces, the solution structure, and the consequences (benefits and costs), plus the name as shared vocabulary.
2. Hidden global state, hard-to-test code, thread-safety bugs, captive dependencies on shorter-lived services, and no lifetime control.
3. When objects have many optional parts or need step-by-step construction, especially test data; for simple types, `required`/`init` properties and `with` expressions are enough.
</details>

## Sources
- [Refactoring.Guru — creational patterns](https://refactoring.guru/design-patterns/creational-patterns)
- [Dependency injection in .NET](https://learn.microsoft.com/dotnet/core/extensions/dependency-injection)
- [Keyed services](https://learn.microsoft.com/dotnet/core/extensions/dependency-injection#keyed-services)
- [Options pattern](https://learn.microsoft.com/dotnet/core/extensions/options)
- [Test Data Builders (Nat Pryce)](http://www.natpryce.com/articles/000714.html)
