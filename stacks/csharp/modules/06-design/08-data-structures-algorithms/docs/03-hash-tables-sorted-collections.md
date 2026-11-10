---
title: Hash tables and sorted and read-optimised collections
tech: C# 14, .NET 10 collections
version: C# 14 / .NET 10
date: 2026-11-09
covers: [5, 9]
---
# Hash tables and sorted and read-optimised collections
[← Overview](00-overview.md)

## Why it matters
- A custom `Sku` class overrode `Equals` but not `GetHashCode`. `Dictionary<Sku, Stock>` lookups silently missed, and the shop showed "out of stock" for products it had.
- Mutable objects were used as dictionary keys. After a property changed, the key was "lost" inside the dictionary and the entry could never be found or removed.
- Tax rates (200 entries, read millions of times a day) lived in a `Dictionary` rebuilt on every request. A `FrozenDictionary` built once at startup made lookups faster and removed the allocations.

## Concepts

### Hash tables
| Concept | Meaning |
|:--|:--|
| ⭐ hashing | turn a key into an integer; the table uses it to pick a bucket |
| ⭐ collisions | different keys in the same bucket; resolved by chaining (.NET) or probing |
| ⭐ load factor | entries ÷ buckets; the table resizes (rehashes) as it grows, keeping operations O(1) average |
| worst case | O(n) if many keys collide (bad hash or attack); .NET randomises string hashing per process |
| ⭐ `Equals` + `GetHashCode` contract | equal objects must have equal hash codes; hash codes must not change while the key is in the table |

| Type | Use | Costs |
|:--|:--|:--|
| ⭐ `Dictionary<TKey,TValue>` | key → value | add/lookup/remove O(1) average |
| ⭐ `HashSet<T>` | membership, de-duplication, set operations | `Add`/`Contains` O(1); `UnionWith`, `IntersectWith`, `ExceptWith` |
| `ConcurrentDictionary<TKey,TValue>` | thread-safe map | `GetOrAdd`, `AddOrUpdate` |
| ⭐ records / `readonly record struct` keys | value equality and hashing generated | immutable keys |
| `IEqualityComparer<T>` | custom equality | `StringComparer.OrdinalIgnoreCase` for case-insensitive keys |
| `CollectionsMarshal.GetValueRefOrAddDefault` | update a value without double lookup | hot paths |

### Sorted and read-optimised collections
| Type | Structure | Costs | Use |
|:--|:--|:--|:--|
| ⭐ `SortedDictionary<TKey,TValue>` | red-black tree | O(log n) add/lookup/remove; ordered iteration | ordered map with frequent changes |
| `SortedList<TKey,TValue>` | sorted arrays | O(log n) lookup, O(n) insert; less memory | mostly-read ordered map, index access |
| ⭐ `SortedSet<T>` | red-black tree | O(log n); `GetViewBetween(min, max)`, `Min`, `Max` | ordered unique items, range queries |
| ⭐ `FrozenDictionary` / `FrozenSet` (.NET 8+) | optimised at creation for reads | slow to build, fastest lookups | read-only lookup tables (config, tax rates) |
| `ImmutableDictionary` / `ImmutableList` etc. | persistent trees | O(log n); cheap "modified copies" | shared snapshots, thread-safe updates |
| `ImmutableArray<T>` | immutable array | O(1) index | read-only lists |
| `ReadOnlyDictionary` / `IReadOnly*` | read-only wrappers/views | no copy | exposing collections safely |
| `SearchValues<T>` (.NET 8+) | optimised "any of" search | | parsing, validation |

## In our stack
- Records and value objects as keys: [01-paradigms-oop lesson 04](../../01-paradigms-oop/docs/04-entities-values-choosing.md).
- `FrozenDictionary` for static data and dispatch tables: [02-principles lesson 04](../../02-principles/docs/04-smells-refactoring-review.md), [03-backend/09-scalability lesson 02](../../../03-backend/09-scalability/docs/02-benchmarks-dotnet-performance.md).
- Hash rings at system scale: [06-system-design lesson 03](../../06-system-design/docs/03-scaling-data-caching-async.md).

## When not to
- Don't use `SortedDictionary` if you only need lookups; `Dictionary` is faster. Sort once when you need ordered output.
- Don't use `FrozenDictionary` for data that changes; it's built for read-only use.
- Don't override `Equals`/`GetHashCode` by hand when a record gives you correct ones.

## Example
Correct keys: records instead of hand-written equality
```csharp
public readonly record struct SkuKey(string Origin, int Grams);          // Equals + GetHashCode generated

var stock = new Dictionary<SkuKey, int> { [new("ETH", 250)] = 40, [new("COL", 1000)] = 7 };
Console.WriteLine(stock[new SkuKey("ETH", 250)]);                          // 40: equal value, equal hash
```
If you must write equality by hand:
```csharp
public sealed class Sku(string value) : IEquatable<Sku>
{
    public string Value { get; } = value;
    public bool Equals(Sku? other) => other is not null && string.Equals(Value, other.Value, StringComparison.OrdinalIgnoreCase);
    public override bool Equals(object? obj) => Equals(obj as Sku);
    public override int GetHashCode() => StringComparer.OrdinalIgnoreCase.GetHashCode(Value);   // consistent with Equals
}
```
Counting with one lookup per item:
```csharp
using System.Runtime.InteropServices;

static Dictionary<string, int> CountBySku(IEnumerable<string> skus)
{
    var counts = new Dictionary<string, int>();
    foreach (var sku in skus)
        CollectionsMarshal.GetValueRefOrAddDefault(counts, sku, out _)++;   // no second lookup
    return counts;
}
// simpler and fine for most code: skus.CountBy(s => s) (.NET 9+), or GroupBy(...).ToDictionary(...)
```
Set operations for "customers who bought A but not B":
```csharp
var boughtEthiopia = new HashSet<Guid>(ordersEth.Select(o => o.CustomerId));
var boughtColombia = ordersCol.Select(o => o.CustomerId);
boughtEthiopia.ExceptWith(boughtColombia);           // O(n + m)
```
Read-optimised lookup table built once:
```csharp
using System.Collections.Frozen;

public sealed class TaxRates
{
    private readonly FrozenDictionary<string, int> _basisPoints;
    public TaxRates(IEnumerable<(string Country, int Bps)> rates) =>
        _basisPoints = rates.ToFrozenDictionary(r => r.Country, r => r.Bps, StringComparer.OrdinalIgnoreCase);
    public int For(string country) => _basisPoints.TryGetValue(country, out var bps) ? bps : 0;
}
```
Range queries with `SortedSet<T>`:
```csharp
var deliverySlots = new SortedSet<DateTimeOffset>(availableSlots);
var thisAfternoon = deliverySlots.GetViewBetween(today.AddHours(12), today.AddHours(18));   // O(log n + k)
```

## Production patterns
- Lookups and de-duplication use `Dictionary`/`HashSet` with immutable keys (records, strings) and explicit comparers for case-insensitivity.
- Static reference data is a `FrozenDictionary`/`FrozenSet` built at startup; shared snapshots use immutable collections.
- Ordered structures only when ordering or range queries are actually needed.

## Mistakes
Wrong:
```csharp
public override bool Equals(object? o) => o is Sku s && s.Value == Value;   // no GetHashCode override → broken dictionary keys
```
Right: override both consistently, or use a record.

Wrong: `var key = cart; dict[key] = total; cart.Lines.Add(...)` (mutating a key).
Right: immutable keys (IDs, records).

## Check yourself
1. What's the `Equals`/`GetHashCode` contract?
2. When is `FrozenDictionary` the right choice?
3. What does `SortedSet<T>` give you that `HashSet<T>` doesn't?

<details><summary>Answers</summary>

1. If two objects are equal, they must return the same hash code; and an object's hash code must not change while it's used as a key. (Unequal objects may share hash codes; that's a collision.)
2. For data that's built once and read many times without changes (configuration, tax rates, dispatch tables), where faster lookups are worth a slower build.
3. Ordered iteration, `Min`/`Max`, and range queries (`GetViewBetween`) in O(log n), at the cost of O(log n) instead of O(1) for add and contains.
</details>

## Sources
- [Dictionary<TKey,TValue>](https://learn.microsoft.com/dotnet/api/system.collections.generic.dictionary-2)
- [Object.GetHashCode remarks](https://learn.microsoft.com/dotnet/api/system.object.gethashcode)
- [Frozen collections](https://learn.microsoft.com/dotnet/api/system.collections.frozen)
- [SortedSet<T>](https://learn.microsoft.com/dotnet/api/system.collections.generic.sortedset-1)
- [Immutable collections](https://learn.microsoft.com/dotnet/api/system.collections.immutable)
- [CollectionsMarshal](https://learn.microsoft.com/dotnet/api/system.runtime.interopservices.collectionsmarshal)
