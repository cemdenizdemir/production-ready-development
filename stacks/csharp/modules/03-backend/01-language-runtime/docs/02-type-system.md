---
title: "The C# type system: values, references, records, nullability, generics"
tech: C# 14, .NET 10
version: C# 14
date: 2026-11-09
covers: [3, 4, 5]
---
# The C# type system: values, references, records, nullability, generics
[← Overview](00-overview.md)

## Why it matters
- A `struct OrderLine` is modified inside a `foreach` over a list; the change is lost because the loop worked on a copy.
- Two `Money` objects with the same amount and currency aren't equal because `Money` is a class; a dictionary lookup fails.
- Prices are stored as `double`; `0.1 + 0.2` shows up as `0.30000000000000004` on an invoice.

## Concepts

### Value types and reference types
| | Value types | Reference types |
|:--|:--|:--|
| examples | `int`, `long`, `decimal`, `bool`, `DateTime`, `DateOnly`, `Guid`, `enum`, `struct`, `record struct` | `class`, `record` (class), `string`, arrays, interfaces, delegates |
| variable holds | the value itself | a reference to an object on the heap |
| assignment copies | the value | the reference |
| default | zeroed (`0`, `false`) | `null` |
| equality (`==`) | value (for built-ins) | reference, unless overloaded (`string`, records) |

Boxing: converting a value type to `object` or an interface allocates a box on the heap. Avoid it in hot paths (generics avoid it).

Numbers: `int` (32-bit), `long` (64-bit), `double` (binary float, fast, inexact), ⭐ `decimal` (128-bit base-10, exact for money). Overflow wraps silently unless `checked`.

Strings are immutable reference types with value equality; use `StringBuilder` for building in loops, `StringComparison.Ordinal` for identifiers (01-foundations/05).

### Classes, structs, records
| Kind | Use | Equality |
|:--|:--|:--|
| `class` | entities with identity and behavior (`Order`) | reference |
| ⭐ `record` (class) | immutable data: DTOs, value objects, messages | value (generated `Equals`, `GetHashCode`, `ToString`) |
| `struct` | small, short-lived values (≤ ~16 bytes) | value (slow reflection-based unless overridden) |
| `readonly record struct` | small immutable values (`Money`, `Sku`) | value, no allocations |

```csharp
public sealed record Money(decimal Amount, string Currency);
var price = new Money(13.50m, "EUR");
var discounted = price with { Amount = 12.15m };     // non-destructive copy
Console.WriteLine(price == new Money(13.50m, "EUR")); // True
```

### Nullability (recap)
Nullable value types: `int?` is `Nullable<int>` (`.HasValue`, `.Value`, `?? 0`). Nullable reference types are compile-time annotations: `string?` may be null, `string` shouldn't be (01-foundations/05-code-quality lesson 02). Use `required` members, null checks, `?.`, `??`, and `ArgumentNullException.ThrowIfNull`.

### Generics
Unlike TypeScript, generics are real at runtime: `List<int>` stores ints without boxing; `typeof(T)` works.
| Constraint | Meaning |
|:--|:--|
| `where T : class` / `struct` | reference / value type |
| `where T : notnull` | non-nullable |
| `where T : new()` | has a parameterless constructor |
| `where T : IEntity` | implements an interface |
| `where T : INumber<T>` | generic math (.NET 7+) |
| `where T : allows ref struct` | can be a ref struct (C# 13) |

Variance: `IEnumerable<out T>` (covariant: `IEnumerable<string>` is an `IEnumerable<object>`), `Action<in T>` (contravariant).

### Interfaces, delegates, lambdas, events
| Feature | Example | Note |
|:--|:--|:--|
| interface | `public interface IPaymentGateway { Task<ChargeResult> ChargeAsync(Money m, CancellationToken ct); }` | contracts for DI and tests |
| default interface members | method bodies in interfaces | use sparingly |
| static abstract members | `static abstract T Parse(string s)` | generic math, factories |
| delegate types | `Func<int, bool>`, `Action<string>`, `Predicate<T>` | function values |
| lambdas | `x => x.Total > 100` | capture variables (closures) |
| events | `public event EventHandler<OrderPlaced>? Placed;` | `+=` / `-=`; forgetting `-=` leaks |

## Example
`src/Shop.Domain/Money.cs`
```csharp
namespace Shop.Domain;

public readonly record struct Money(decimal Amount, string Currency)
{
    public static Money Zero(string currency) => new(0m, currency);

    public static Money operator +(Money a, Money b) =>
        a.Currency == b.Currency
            ? new Money(a.Amount + b.Amount, a.Currency)
            : throw new InvalidOperationException($"Currency mismatch: {a.Currency} vs {b.Currency}");

    public Money Round() => this with { Amount = Math.Round(Amount, 2, MidpointRounding.AwayFromZero) };
}
```
`src/Shop.Domain/Order.cs`
```csharp
namespace Shop.Domain;

public sealed class Order(Guid customerId)          // class: identity + behavior
{
    private readonly List<OrderLine> _lines = [];
    public Guid Id { get; } = Guid.CreateVersion7();
    public Guid CustomerId { get; } = customerId;
    public IReadOnlyList<OrderLine> Lines => _lines;

    public void AddLine(string sku, int quantity, Money unitPrice)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(quantity);
        _lines.Add(new OrderLine(sku, quantity, unitPrice));
    }

    public Money Total(string currency) =>
        _lines.Aggregate(Money.Zero(currency), (sum, l) => sum + l.UnitPrice with { Amount = l.UnitPrice.Amount * l.Quantity });
}

public sealed record OrderLine(string Sku, int Quantity, Money UnitPrice);   // record: data
```
A generic helper with a constraint:
```csharp
public static T MaxBy<T, TKey>(IEnumerable<T> items, Func<T, TKey> key) where TKey : IComparable<TKey> =>
    items.Aggregate((best, x) => key(x).CompareTo(key(best)) > 0 ? x : best);
```

## Production patterns
- `decimal` for money, `DateTimeOffset` for instants, `DateOnly` for calendar dates, `Guid` or `long` for IDs. `Guid.CreateVersion7()` is time-ordered in .NET and PostgreSQL but **not** in SQL Server's `uniqueidentifier` sort order; for SQL Server clustered keys see 03-databases lesson 01.
- Records for DTOs, messages, and value objects; sealed classes for entities.
- Small value objects as `readonly record struct` to avoid allocations.
- Interfaces at boundaries you substitute (payments, email, clock); not for every class.

## Mistakes
Wrong: mutable structs.
```csharp
public struct Counter { public int Value; }
foreach (var c in counters) c.Value++;     // compile error / modifies a copy
```
Right: immutable value types (`readonly record struct`) or classes for mutable state.

Wrong: `double` for money.
Right: `decimal` (and minor units or decimal strings on the wire to JavaScript).

## Check yourself
1. What gets copied when you assign a `record` variable? A `record struct` variable?
2. Why are C# generics different from TypeScript generics?
3. When should something be a `class` rather than a `record`?

<details><summary>Answers</summary>

1. A `record` (class): the reference (both variables point to the same object). A `record struct`: the whole value.
2. They exist at runtime: the runtime knows `T`, value types aren't boxed, and reflection can inspect them. TypeScript erases generic types.
3. When the object has identity and changing state over time (an entity like `Order`), rather than being defined by its values.
</details>

## Sources
- [Value types](https://learn.microsoft.com/dotnet/csharp/language-reference/builtin-types/value-types) · [Reference types](https://learn.microsoft.com/dotnet/csharp/language-reference/keywords/reference-types)
- [Records](https://learn.microsoft.com/dotnet/csharp/language-reference/builtin-types/record)
- [Choosing between class and struct](https://learn.microsoft.com/dotnet/standard/design-guidelines/choosing-between-class-and-struct)
- [Generics](https://learn.microsoft.com/dotnet/csharp/fundamentals/types/generics) · [Constraints](https://learn.microsoft.com/dotnet/csharp/programming-guide/generics/constraints-on-type-parameters)
- [Floating-point vs decimal](https://learn.microsoft.com/dotnet/csharp/language-reference/builtin-types/floating-point-numeric-types)
