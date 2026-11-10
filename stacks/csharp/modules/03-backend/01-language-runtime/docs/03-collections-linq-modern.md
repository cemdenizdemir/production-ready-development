---
title: Collections, LINQ, and modern C#
tech: C# 14, .NET 10 BCL, LINQ
version: C# 14, .NET 10
date: 2026-11-09
covers: [6, 7]
---
# Collections, LINQ, and modern C#
[← Overview](00-overview.md)

## Why it matters
- `db.Orders.AsEnumerable().Where(o => o.CustomerId == id)` loads the whole orders table into memory before filtering.
- A method returns `IEnumerable<Order>` built by a LINQ query; three callers enumerate it, and the database is queried three times.
- Code reviews argue about `if/else` chains that a `switch` expression would make exhaustive and checked by the compiler.

## Concepts

### Collections
| Type | Use | Note |
|:--|:--|:--|
| ⭐ `List<T>` | ordered, growable | `O(1)` index, amortized `O(1)` add |
| `T[]` | fixed size | fastest, used by APIs |
| ⭐ `Dictionary<TKey, TValue>` | key lookup `O(1)` | `TryGetValue` |
| `HashSet<T>` | membership, uniqueness | |
| `Queue<T>` / `Stack<T>` / `PriorityQueue<T, P>` | FIFO / LIFO / by priority | 06-design/08 |
| `ImmutableArray<T>`, `ImmutableDictionary` | never changes; safe to share | `System.Collections.Immutable` |
| `FrozenDictionary` / `FrozenSet` | read-optimized, built once | lookup tables (.NET 8+) |
| `ConcurrentDictionary` | thread-safe | caches across requests |

Expose read-only interfaces: return `IReadOnlyList<T>` / `IReadOnlyCollection<T>`, accept `IEnumerable<T>` when you only iterate.

### LINQ
```csharp
var topCustomers = orders
    .Where(o => o.PlacedAt >= since)
    .GroupBy(o => o.CustomerId)
    .Select(g => new { CustomerId = g.Key, Total = g.Sum(o => o.TotalAmount) })
    .OrderByDescending(x => x.Total)
    .Take(10)
    .ToList();
```
| Operator | Does |
|:--|:--|
| `Where`, `Select`, `SelectMany` | filter, project, flatten |
| `OrderBy`/`ThenBy`/`OrderByDescending` | sort |
| `GroupBy`, `CountBy`, `AggregateBy` (.NET 9) | group, count per key |
| `Join`, `LeftJoin`/`RightJoin` (.NET 10) | joins |
| `Any`, `All`, `Contains` | tests |
| `First`/`FirstOrDefault`/`Single`/`SingleOrDefault` | pick (Single throws on duplicates) |
| `Sum`, `Count`, `Min`/`Max`, `MinBy`/`MaxBy` | aggregates |
| `Distinct`, `DistinctBy`, `Chunk`, `Zip`, `Index` (.NET 9) | misc |
| `ToList`, `ToArray`, `ToDictionary`, `ToHashSet` | materialize |

⭐ **Deferred execution**: a query runs when enumerated (`foreach`, `ToList`), every time it's enumerated. Materialize once if you'll use it several times (analyzer CA1851 warns about multiple enumeration).

⭐ **`IEnumerable<T>` vs `IQueryable<T>`**: `IEnumerable` runs in memory (delegates); `IQueryable` builds an expression tree that EF Core translates to SQL. Keep EF Core queries as `IQueryable` until the final `ToListAsync`; anything after `AsEnumerable()` runs in C# on everything loaded so far (03-databases).

### Modern C# you'll read and write
| Feature | Example | Since |
|:--|:--|:--|
| ⭐ pattern matching | `if (result is { Status: "Paid", Amount: > 0 } paid)` | 7–11 |
| ⭐ switch expressions | `var fee = method switch { "card" => 0.3m, "bank" => 0m, _ => throw … };` | 8 |
| relational/logical patterns | `qty is > 0 and <= 1000` | 9 |
| list patterns | `args is [var first, .. var rest]` | 11 |
| records, `with` | lesson 02 | 9 |
| `required`, `init` | `public required string Sku { get; init; }` | 11 / 9 |
| raw string literals | `"""{ "sku": "COF-1" }"""` | 11 |
| ⭐ primary constructors | `public sealed class OrderService(ShopDb db, TimeProvider time)` | 12 |
| ⭐ collection expressions | `List<string> skus = ["COF-1", .. more];` | 12 |
| `params` collections | `void Log(params ReadOnlySpan<string> parts)` | 13 |
| `System.Threading.Lock` | `private readonly Lock _gate = new();` | 13 |
| ⭐ extension members | `extension(Order o) { public bool IsEmpty => o.Lines.Count == 0; }` | 14 |
| `field` keyword | `public string Name { get; set => field = value.Trim(); }` | 14 |
| null-conditional assignment | `order?.Note = note;` | 14 |
| `nameof(List<>)` | unbound generic in `nameof` | 14 |

Primary constructor parameters are captured as private state, not readonly fields; assign them to `readonly` fields if you need that guarantee.

## Example
`src/Shop.Domain/Pricing/ShippingCalculator.cs`
```csharp
namespace Shop.Domain.Pricing;

public enum ShippingMethod { Standard, Express, Pickup }

public static class ShippingCalculator
{
    public static decimal Fee(ShippingMethod method, decimal orderTotal, string country) => (method, country) switch
    {
        (ShippingMethod.Pickup, _) => 0m,
        (ShippingMethod.Standard, "TR") when orderTotal >= 500m => 0m,
        (ShippingMethod.Standard, "TR") => 49.90m,
        (ShippingMethod.Standard, _) => 9.90m,
        (ShippingMethod.Express, _) => 19.90m,
    };   // no discard for method: adding an enum member triggers CS8509 (not exhaustive)
}
```
Enums can hold unnamed values (`(ShippingMethod)42`), so the compiler also reports CS8524. Teams that want exhaustiveness checks on named members set `dotnet_diagnostic.CS8524.severity = none` in `.editorconfig` and keep CS8509 as an error; otherwise add `_ => throw new ArgumentOutOfRangeException(nameof(method))`.
`src/Shop.Domain/Orders/OrderExtensions.cs` (C# 14 extension members)
```csharp
namespace Shop.Domain.Orders;

public static class OrderExtensions
{
    extension(Order order)
    {
        public bool IsEmpty => order.Lines.Count == 0;                 // extension property
        public int ItemCount => order.Lines.Sum(l => l.Quantity);
    }

    extension(IEnumerable<Order> orders)
    {
        public IEnumerable<Order> PlacedSince(DateTimeOffset since) => orders.Where(o => o.PlacedAt >= since);
    }
}
```
Lookup table built once:
```csharp
private static readonly FrozenDictionary<string, decimal> VatByCountry =
    new Dictionary<string, decimal> { ["TR"] = 0.20m, ["DE"] = 0.19m, ["NL"] = 0.21m }.ToFrozenDictionary();
```

## Production patterns
- Return `IReadOnlyList<T>` from domain and application services; materialize queries once.
- EF Core queries stay `IQueryable` until `ToListAsync`/`FirstOrDefaultAsync`; project with `Select` to DTOs in the query.
- Switch expressions over enums and records for business rules; keep the compiler's exhaustiveness warnings as errors.
- Frozen collections for static lookup tables; concurrent collections only when shared across threads.

## Mistakes
Wrong: filtering in memory.
```csharp
var mine = db.Orders.AsEnumerable().Where(o => o.CustomerId == id).ToList();   // loads every order
```
Right:
```csharp
var mine = await db.Orders.Where(o => o.CustomerId == id).ToListAsync(ct);
```

Wrong: returning a lazy query and enumerating it repeatedly.
Right: `.ToList()` once, return `IReadOnlyList<T>`.

## Check yourself
1. What is deferred execution, and why does it matter?
2. What's the practical difference between `IEnumerable<T>` and `IQueryable<T>` with EF Core?
3. What does a collection expression `[.. a, x]` produce?

<details><summary>Answers</summary>

1. A LINQ query runs only when enumerated, and again each time; repeated enumeration repeats the work (or database query).
2. `IQueryable` is translated to SQL and runs in the database; `IEnumerable` runs in memory on data already loaded.
3. A new collection of the target type containing all items of `a` followed by `x`.
</details>

## Sources
- [Collections in .NET](https://learn.microsoft.com/dotnet/standard/collections/)
- [LINQ overview](https://learn.microsoft.com/dotnet/csharp/linq/)
- [Pattern matching](https://learn.microsoft.com/dotnet/csharp/fundamentals/functional/pattern-matching)
- [Extension members (C# 14)](https://learn.microsoft.com/dotnet/csharp/programming-guide/classes-and-structs/extension-methods)
- [Collection expressions](https://learn.microsoft.com/dotnet/csharp/language-reference/operators/collection-expressions)
- [What's new in C# 14](https://learn.microsoft.com/dotnet/csharp/whats-new/csharp-14)
