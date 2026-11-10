---
title: Classes, composition, interfaces, and polymorphism
tech: C# 14
version: C# 14 / .NET 10
date: 2026-11-09
covers: [3, 4, 7]
---
# Classes, composition, interfaces, and polymorphism
[← Overview](00-overview.md)

## Why it matters
- `NotificationService` had subclasses `EmailNotificationService`, `SmsNotificationService`, and `EmailAndSmsNotificationService`. Adding push notifications needed four more classes.
- A base class added a `virtual` method that one subclass overrode in a surprising way; a change in the base broke checkout in a subclass nobody remembered.
- A `public` field on a settings class was changed at runtime by a background job, and all requests saw half-updated values.

## Concepts

### Class building blocks in C#
| Feature | Use |
|:--|:--|
| ⭐ access modifiers | `public` (API), `internal` (assembly/module), `private` (default for members), `protected`, `private protected`, `file` (file-local types) |
| ⭐ properties | `{ get; private set; }`, `{ get; init; }` (set once at creation), `required` members |
| `field` keyword (C# 14) | add logic to an auto-property without a manual backing field |
| ⭐ `readonly` | fields set only in the constructor; `readonly struct` / `readonly record struct` |
| `static` | type-level members; static classes for pure helpers |
| ⭐ `sealed` | no inheritance (default for most of your classes; also faster virtual calls) |
| `virtual` / `override` / `abstract` | extension points in a base class |
| primary constructors | `class OrderService(ShopDb db, TimeProvider time)` |
| extension members (C# 14) | `extension(Order o) { public bool IsPaid => ...; }` |

### Composition over inheritance
| Inheritance ("is a") | Composition ("has a") |
|:--|:--|
| reuse by extending a base class | reuse by holding collaborators |
| fixed at compile time | combine and swap at runtime / in DI |
| couples to base internals (fragile base class) | couples to an interface |
| combinatorial explosion for variations | variations combine freely |

Use inheritance for true "is-a" relationships with a stable base (exceptions, framework base classes like `BackgroundService`, `DbContext`). Use composition for everything else.

### Interfaces vs abstract classes
| | Interface | Abstract class |
|:--|:--|:--|
| ⭐ purpose | a contract (what) | a partial implementation (shared how) |
| multiple | a class can implement many | only one base class |
| state | no instance fields | fields and constructors |
| default interface methods | allowed (C# 8+); mainly to evolve published interfaces | n/a |
| static abstract members | yes (generic math, factories) | n/a |
| use in the shop | ports, strategies, test seams | framework bases (`BackgroundService`) |

### Polymorphism beyond inheritance
| Mechanism | Example | Good for |
|:--|:--|:--|
| ⭐ interfaces | `IShippingRateProvider` implementations | runtime variation, DI |
| ⭐ generics with constraints | `T Max<T>(T a, T b) where T : IComparable<T>` | reuse across types without boxing |
| static abstract interface members | `where T : IParsable<T>` → `T.Parse(...)` | type-level operations |
| ⭐ delegates / lambdas | `Func<Order, bool>` predicates, `Func<decimal, decimal>` pricing rules | small strategies |
| ⭐ dispatch tables | `Dictionary<string, Func<...>>` keyed by type or name | replacing big `switch`es on strings |
| pattern matching | `shape switch { Circle c => ..., Square s => ... }` | closed sets of types (lesson 03) |
| keyed DI services | `[FromKeyedServices("stripe")]` | choose implementation by key |

## In our stack
- Composition in the composition root: modules register collaborators ([03-backend/11-architecture lesson 02](../../../03-backend/11-architecture/docs/02-dependency-injection.md)).
- Inheritance where the framework wants it: `BackgroundService`, `DbContext`, `IdentityDbContext`, exceptions.
- Strategies as interfaces + keyed services: payment gateways ([03-backend/11-architecture lesson 02](../../../03-backend/11-architecture/docs/02-dependency-injection.md)).
- Decorators through DI and handler composition: resilience handlers on `HttpClient` ([03-backend/08-reliability](../../../03-backend/08-reliability/README.md)).

## When not to
- Don't add an interface for every class "for testability" when there's one implementation and it's not an external dependency.
- Don't use `abstract` base classes to share two helper methods; use a static helper or composition.
- Don't use default interface methods to add behaviour to your own app's interfaces; they hide where code lives.

## Example
`Notifications.cs` (composition instead of a subclass per combination)
```csharp
public interface INotificationChannel
{
    Task SendAsync(Notification n, CancellationToken ct);
}

public sealed class EmailChannel(IEmailSender email) : INotificationChannel
{
    public Task SendAsync(Notification n, CancellationToken ct) => email.SendAsync(n.ToEmail(), ct);
}

public sealed class SmsChannel(ISmsSender sms) : INotificationChannel
{
    public Task SendAsync(Notification n, CancellationToken ct) => sms.SendAsync(n.Phone!, n.ShortText, ct);
}

public sealed class Notifier(IEnumerable<INotificationChannel> channels)        // any combination via DI
{
    public Task NotifyAsync(Notification n, CancellationToken ct) =>
        Task.WhenAll(channels.Select(c => c.SendAsync(n, ct)));
}
```
Generics with constraints and static abstract members:
```csharp
public static class Parsing
{
    public static IReadOnlyList<T> ParseAll<T>(IEnumerable<string> values) where T : IParsable<T> =>
        [.. values.Select(v => T.Parse(v, CultureInfo.InvariantCulture))];
}

var quantities = Parsing.ParseAll<int>(["1", "2", "3"]);
var dates = Parsing.ParseAll<DateOnly>(["2026-11-09"]);
```
A dispatch table replacing a string `switch`:
```csharp
private static readonly Dictionary<string, Func<Money, Money>> ShippingRules = new()
{
    ["standard"] = total => total.Minor >= 50_00 ? Money.Zero(total.Currency) : new Money(4_90, total.Currency),
    ["express"]  = total => new Money(12_90, total.Currency),
    ["pickup"]   = total => Money.Zero(total.Currency),
};

public static Money ShippingFor(string method, Money total) =>
    ShippingRules.TryGetValue(method, out var rule) ? rule(total) : throw new ArgumentOutOfRangeException(nameof(method));
```
`init`, `required`, and the `field` keyword:
```csharp
public sealed class ShippingAddress
{
    public required string Name { get; init; }
    public required string Country
    {
        get;
        init => field = value.Length == 2 ? value.ToUpperInvariant() : throw new ArgumentException("ISO 3166-1 alpha-2 code");
    }
}
```

## Production patterns
- Classes are `sealed` by default; inheritance is a deliberate choice for framework bases and true is-a relationships.
- Variation is modelled with interfaces, delegates, or dispatch tables and assembled by composition (DI).
- Members are as private as possible: `internal` across module boundaries, `init`/`required` for construction, no public mutable fields.

## Mistakes
Wrong:
```csharp
public class EmailAndSmsNotificationService : EmailNotificationService { /* override + call SMS */ }
```
Right: a `Notifier` composed of `INotificationChannel`s.

Wrong: `public interface IOrderService` with one implementation and no external dependency, mocked in every test.
Right: test the concrete class with real collaborators; add an interface when a second implementation or an external boundary appears.

## Check yourself
1. When is inheritance the right choice?
2. What can an abstract class do that an interface can't?
3. Name three ways to get polymorphism in C# without inheritance.

<details><summary>Answers</summary>

1. For a genuine, stable is-a relationship, especially when a framework expects it (`BackgroundService`, `DbContext`, custom exceptions).
2. Hold instance state (fields), define constructors, and provide protected shared implementation for subclasses.
3. Interfaces, generics with constraints (including static abstract members), delegates/lambdas, dispatch tables, and pattern matching over closed sets of types.
</details>

## Sources
- [Classes, structs, and records](https://learn.microsoft.com/dotnet/csharp/fundamentals/object-oriented/)
- [Access modifiers](https://learn.microsoft.com/dotnet/csharp/programming-guide/classes-and-structs/access-modifiers)
- [Interfaces (C#)](https://learn.microsoft.com/dotnet/csharp/fundamentals/types/interfaces)
- [Static abstract members in interfaces](https://learn.microsoft.com/dotnet/csharp/whats-new/tutorials/static-virtual-interface-members)
- [The field keyword (C# 14)](https://learn.microsoft.com/dotnet/csharp/language-reference/keywords/field)
- [Gang of Four — composition over inheritance (Design Patterns, 1994)](https://en.wikipedia.org/wiki/Composition_over_inheritance)
