---
title: Sorting and searching
tech: C# 14, .NET 10 (Array.Sort, List<T>.Sort, LINQ OrderBy, BinarySearch)
version: C# 14 / .NET 10
date: 2026-11-09
covers: [13, 14]
---
# Sorting and searching
[← Overview](00-overview.md)

## Why it matters
- Orders were sorted by status with `List.Sort`, then by date. The second sort scrambled the first, because `List.Sort` isn't stable; support saw orders jump around.
- A price-range lookup scanned 50,000 sorted price points linearly on every request; `BinarySearch` would take 16 comparisons.
- A comparer subtracted two `long` values and cast to `int` (`return (int)(a - b);`). Large differences overflowed and the sort produced nonsense.

## Concepts

### Sorting algorithms
| Algorithm | Time (avg / worst) | Space | Stable | Notes |
|:--|:--|:--|:--|:--|
| insertion sort | O(n²) / O(n²) | O(1) | ✓ | fast for tiny or nearly sorted arrays |
| ⭐ merge sort | O(n log n) / O(n log n) | O(n) | ✓ | predictable; good for linked lists and external sorting |
| ⭐ quick sort | O(n log n) / O(n²) | O(log n) | ✗ | fast in practice; pivot choice matters |
| ⭐ heap sort | O(n log n) / O(n log n) | O(1) | ✗ | guaranteed n log n, in place |
| counting / radix | O(n + k) | O(n + k) | ✓ | small integer key ranges |
| ⭐ introsort | O(n log n) / O(n log n) | O(log n) | ✗ | quicksort + heapsort fallback + insertion sort for small parts |

| .NET API | Algorithm | Stable |
|:--|:--|:--|
| ⭐ `Array.Sort`, `List<T>.Sort`, `Span<T>.Sort` | introsort | ✗ |
| ⭐ LINQ `OrderBy` / `ThenBy` | stable sort | ✓ |
| `Order()` / `OrderDescending()` (.NET 7+) | stable | ✓ |
| SQL `ORDER BY` | database | add a tie-breaker for determinism |

**Stability** = equal keys keep their original relative order. Matters when you sort by several keys in passes, or when users expect a consistent order.

**Comparers:** use `a.CompareTo(b)` or `Comparer<T>.Create(...)`; never subtraction (overflow); for strings choose `StringComparer.Ordinal` (fast, culture-free) or a culture-aware comparer for display.

### Searching
| Technique | Requires | Time |
|:--|:--|:--|
| linear search | nothing | O(n) |
| ⭐ binary search | sorted data | O(log n) |
| ⭐ `Array.BinarySearch` / `List<T>.BinarySearch` | sorted | returns index, or the bitwise complement (`~index`) of the insertion point |
| hash lookup | a hash table | O(1) average (lesson 03) |
| sorted collections | `SortedSet.GetViewBetween` | O(log n + k) |
| ⭐ binary search on the answer | a monotonic yes/no condition | O(log range × check) |

Binary search pitfalls: off-by-one bounds, `mid = (lo + hi) / 2` overflow for huge ints (use `lo + (hi - lo) / 2`), and forgetting the data must be sorted by the same comparer.

## In our stack
- Keyset pagination is "binary search" done by the database index: [03-backend/02-api-design](../../../03-backend/02-api-design/README.md).
- Deterministic `ORDER BY` with tie-breakers: [03-backend/03-databases](../../../03-backend/03-databases/README.md).
- Measuring sort costs: [lesson 08](08-patterns-measuring-interviews.md).

## When not to
- Don't implement your own sort in production; use the built-ins (and know whether they're stable).
- Don't sort in memory what the database can sort with an index (`ORDER BY ... OFFSET/FETCH` or keyset).
- Don't binary search unsorted data, or data sorted with a different comparer.

## Example
Stable multi-key ordering:
```csharp
var queue = orders
    .OrderBy(o => o.Status)                 // stable
    .ThenByDescending(o => o.PlacedAt)
    .ThenBy(o => o.Number)                  // tie-breaker: deterministic
    .ToList();
```
A safe comparer (no subtraction):
```csharp
var byPrice = Comparer<Product>.Create((a, b) =>
{
    var c = a.PriceMinor.CompareTo(b.PriceMinor);
    return c != 0 ? c : string.CompareOrdinal(a.Sku, b.Sku);
});
products.Sort(byPrice);
```
Merge sort from scratch (stable, O(n log n)):
```csharp
public static void MergeSort<T>(T[] items, IComparer<T>? comparer = null)
{
    comparer ??= Comparer<T>.Default;
    var buffer = new T[items.Length];
    Sort(0, items.Length);

    void Sort(int lo, int hi)                       // [lo, hi)
    {
        if (hi - lo < 2) return;
        var mid = lo + (hi - lo) / 2;
        Sort(lo, mid);
        Sort(mid, hi);
        int i = lo, j = mid, k = lo;
        while (i < mid && j < hi) buffer[k++] = comparer.Compare(items[j], items[i]) < 0 ? items[j++] : items[i++];   // ties take the left item: stable
        while (i < mid) buffer[k++] = items[i++];
        while (j < hi) buffer[k++] = items[j++];
        Array.Copy(buffer, lo, items, lo, hi - lo);
    }
}
```
Binary search for a shipping price band:
```csharp
long[] bandUpperGrams = [500, 1_000, 2_000, 5_000, 10_000];    // sorted
long[] bandPriceMinor = [4_90, 5_90, 7_90, 11_90, 16_90];

static long PriceFor(long grams, long[] uppers, long[] prices)
{
    var i = Array.BinarySearch(uppers, grams);
    if (i < 0) i = ~i;                                          // first band whose upper bound >= grams
    if (i == uppers.Length) throw new ArgumentOutOfRangeException(nameof(grams), "Too heavy for parcel shipping");
    return prices[i];
}
// PriceFor(750, ...) → 5_90; PriceFor(1_000, ...) → 5_90; PriceFor(1_001, ...) → 7_90
```
Binary search on the answer: smallest batch size that finishes the nightly export in time
```csharp
static int SmallestBatch(int min, int max, Func<int, bool> finishesInTime)    // finishesInTime is monotonic
{
    int lo = min, hi = max;
    while (lo < hi)
    {
        var mid = lo + (hi - lo) / 2;
        if (finishesInTime(mid)) hi = mid; else lo = mid + 1;
    }
    return lo;
}
```

## Production patterns
- Built-in sorts with explicit comparers; LINQ `OrderBy`/`ThenBy` when stability or multi-key ordering matters; tie-breakers for determinism.
- Sorted reference data searched with `BinarySearch`; dynamic ordered data in sorted collections; large data sorted by the database with indexes.
- Comparers use `CompareTo`, never subtraction; string comparisons state ordinal vs culture explicitly.

## Mistakes
Wrong: `list.Sort((a, b) => (int)(a.PriceMinor - b.PriceMinor));`
Right: `list.Sort((a, b) => a.PriceMinor.CompareTo(b.PriceMinor));`

Wrong: sorting by date, then calling `List.Sort` by status and expecting dates to stay ordered within each status.
Right: `OrderBy(status).ThenByDescending(date)` (or one comparer with both keys).

## Check yourself
1. Which .NET sorts are stable?
2. What does a negative result from `Array.BinarySearch` mean?
3. Why is merge sort a good fit for linked lists and external sorting?

<details><summary>Answers</summary>

1. LINQ `OrderBy`/`OrderByDescending`/`ThenBy` and `Order()`/`OrderDescending()`. `Array.Sort`, `List<T>.Sort`, and `Span<T>.Sort` (introsort) are not stable.
2. The item wasn't found; its bitwise complement (`~result`) is the index where it would be inserted to keep the array sorted (the first element larger than it).
3. It only needs sequential access (merging two sorted runs), doesn't need random access like quicksort, and works on chunks that don't fit in memory, merging sorted runs from disk.
</details>

## Sources
- [Array.Sort (introsort)](https://learn.microsoft.com/dotnet/api/system.array.sort)
- [Enumerable.OrderBy (stable)](https://learn.microsoft.com/dotnet/api/system.linq.enumerable.orderby)
- [Array.BinarySearch](https://learn.microsoft.com/dotnet/api/system.array.binarysearch)
- [Sorting algorithm stability (Wikipedia)](https://en.wikipedia.org/wiki/Sorting_algorithm#Stability)
- [Comparing strings in .NET](https://learn.microsoft.com/dotnet/standard/base-types/comparing)
