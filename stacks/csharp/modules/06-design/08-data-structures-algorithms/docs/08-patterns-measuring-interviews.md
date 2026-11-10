---
title: Problem-solving patterns, measuring, and the interview method
tech: C# 14, BenchmarkDotNet, xUnit v3
version: C# 14 / .NET 10, BenchmarkDotNet 0.15.x
date: 2026-11-09
covers: [17, 18, 19]
---
# Problem-solving patterns, measuring, and the interview method
[← Overview](00-overview.md)

## Why it matters
- "Busiest 60-minute window of orders" was computed by re-summing every window from scratch (O(n·w)). A sliding window does it in one pass.
- A developer replaced `List<T>` with `LinkedList<T>` "because Big-O says inserts are cheaper". A benchmark showed the change was 4× slower in their real workload.
- In an interview, a strong engineer jumped into code, got stuck on an edge case, and ran out of time; a candidate who clarified, wrote a brute force, then optimised, finished.

## Concepts

### Problem-solving patterns
| Pattern | Recognise when | Complexity |
|:--|:--|:--|
| ⭐ two pointers | sorted array/list; pairs or partitions; in-place compaction | O(n) |
| ⭐ sliding window | contiguous ranges with a constraint (max sum, longest without repeats, time windows) | O(n) |
| ⭐ prefix sums | many range-sum queries on static data | O(n) build, O(1) per query |
| ⭐ fast and slow pointers | cycles in linked structures, middle of a list | O(n), O(1) space |
| hash map counting | frequencies, duplicates, pair sums in unsorted data | O(n) |
| monotonic stack / deque | next greater element, sliding window max | O(n) |
| binary search on answer | minimise/maximise with a monotonic check | O(log range × check) |
| BFS / DFS | grids, graphs, trees | O(V + E) |
| heap | top-k, merge k sorted lists, scheduling | O(n log k) |
| DP | overlapping subproblems | varies |

### Measuring, not guessing
| Fact | Implication |
|:--|:--|
| ⭐ Big-O ignores constants and memory layout | for small n, an O(n) array scan can beat an O(1) hash lookup |
| ⭐ cache locality | contiguous arrays beat pointer-based structures in practice |
| ⭐ allocations | GC pressure often dominates; `[MemoryDiagnoser]` shows it |
| realistic inputs | benchmark with production-like sizes and distributions |
| BenchmarkDotNet rules | Release build, `[Params]` for sizes, return results, compare to a baseline (03-backend/09-scalability lesson 02) |

### The interview method
| Step | Do |
|:--|:--|
| ⭐ 1. clarify | inputs, sizes, types, edge cases (empty, duplicates, negatives), expected output, constraints |
| ⭐ 2. examples | work 2–3 examples by hand, including an edge case |
| ⭐ 3. brute force | state it and its complexity; it proves you understand the problem |
| ⭐ 4. optimise | which pattern fits? what's repeated work? trade space for time |
| 5. code | clean names, small helpers, talk while coding |
| ⭐ 6. test | run examples through the code; edge cases; fix off-by-ones |
| ⭐ 7. trade-offs | time/space; what changes at 100× input; alternatives |

## In our stack
- BenchmarkDotNet and allocation tuning: [03-backend/09-scalability lesson 02](../../../03-backend/09-scalability/docs/02-benchmarks-dotnet-performance.md).
- Rate-limit windows are sliding windows at system level: [06-system-design lesson 04](../../06-system-design/docs/04-limits-availability-security-cost.md).
- Interviews for system design: [06-system-design lesson 01](../../06-system-design/docs/01-method-estimation-communication.md).

## When not to
- Don't micro-optimise code paths a profile hasn't flagged.
- Don't memorise solutions; learn to recognise the patterns and reason about trade-offs.
- Don't present only the optimal solution in an interview without explaining how you got there.

## Example
Sliding window: busiest 60-minute window (orders sorted by time)
```csharp
static (DateTimeOffset Start, int Count) BusiestWindow(IReadOnlyList<DateTimeOffset> times, TimeSpan window)
{
    var best = (Start: DateTimeOffset.MinValue, Count: 0);
    var left = 0;
    for (var right = 0; right < times.Count; right++)
    {
        while (times[right] - times[left] >= window) left++;      // shrink until inside the window
        var count = right - left + 1;
        if (count > best.Count) best = (times[left], count);
    }
    return best;
}
```
Two pointers: pairs of products that exactly use a gift-card value (prices sorted)
```csharp
static List<(long A, long B)> PairsSumming(long[] sortedPrices, long target)
{
    var pairs = new List<(long, long)>();
    int i = 0, j = sortedPrices.Length - 1;
    while (i < j)
    {
        var sum = sortedPrices[i] + sortedPrices[j];
        if (sum == target) { pairs.Add((sortedPrices[i], sortedPrices[j])); i++; j--; }
        else if (sum < target) i++;
        else j--;
    }
    return pairs;
}
```
Prefix sums: revenue between any two days in O(1)
```csharp
static long[] Prefix(long[] dailyRevenue)
{
    var p = new long[dailyRevenue.Length + 1];
    for (var i = 0; i < dailyRevenue.Length; i++) p[i + 1] = p[i] + dailyRevenue[i];
    return p;
}
static long RevenueBetween(long[] prefix, int fromDay, int toDayInclusive) => prefix[toDayInclusive + 1] - prefix[fromDay];
```
Fast and slow pointers: detect a cycle in a "next recommended product" chain
```csharp
static bool HasCycle(IReadOnlyDictionary<string, string> next, string start)
{
    string? slow = start, fast = start;
    while (fast is not null && next.TryGetValue(fast, out var f1) && next.TryGetValue(f1, out var f2))
    {
        slow = next[slow!];
        fast = f2;
        if (slow == fast) return true;
    }
    return false;
}
```
Measuring a data-structure choice:
```csharp
[MemoryDiagnoser]
public class LookupBenchmarks
{
    [Params(8, 64, 10_000)] public int N;
    private string[] _array = [];
    private HashSet<string> _set = [];
    private string _probe = "";

    [GlobalSetup]
    public void Setup()
    {
        _array = [.. Enumerable.Range(0, N).Select(i => $"SKU-{i:D5}")];
        _set = [.. _array];
        _probe = _array[N / 2];
    }

    [Benchmark(Baseline = true)] public bool ArrayContains() => Array.IndexOf(_array, _probe) >= 0;
    [Benchmark] public bool HashSetContains() => _set.Contains(_probe);
}
// Typical result: for N = 8 the array is competitive; for N = 10,000 the HashSet wins by orders of magnitude.
```
A worked interview answer outline:
```text
Problem: "Given today's order timestamps, find the busiest hour."
Clarify: sorted? (yes) time zone? (UTC) ties? (earliest) n? (up to 10^6)
Examples: [10:00, 10:20, 10:59, 11:30] → window starting 10:00 has 3
Brute force: for each order, count orders within 60 min → O(n²) = 10^12 → too slow
Optimise: sorted + contiguous range → sliding window → O(n), O(1) space
Code: BusiestWindow above
Test: empty list, one order, all at the same second, exactly 60-minute gap (exclusive end)
Trade-offs: unsorted input → sort first O(n log n); streaming input → deque of timestamps
```

## Production patterns
- Recognise the shape (contiguous range → sliding window; sorted pairs → two pointers; repeated range sums → prefix sums) before coding.
- Measure data-structure and algorithm choices with BenchmarkDotNet on realistic sizes before and after; keep the benchmark in the repo.
- Use the interview method at work too: clarify, examples, simple version, optimise with evidence, test edge cases, explain trade-offs.

## Mistakes
Wrong: recomputing each window's sum from scratch (O(n·w)).
Right: slide the window, adding the new element and removing the old one.

Wrong: "HashSet is O(1), so it's always faster."
Right: benchmark with your sizes; for tiny collections an array can win.

## Check yourself
1. Which pattern fits "longest stretch of days with revenue above target"?
2. Why can an O(n) array scan beat an O(1) hash lookup?
3. What are the first two steps of the interview method, and why?

<details><summary>Answers</summary>

1. A sliding window (or a single pass tracking the current run length): it's a contiguous range with a condition.
2. For small n, the array is contiguous and cache-friendly with no hashing cost, while the hash lookup computes a hash and may touch scattered memory; Big-O hides these constant factors.
3. Clarify the problem (inputs, sizes, edge cases, output) and work examples by hand. They prevent solving the wrong problem and reveal edge cases and the right pattern before any code is written.
</details>

## Sources
- [Sliding window technique](https://www.geeksforgeeks.org/window-sliding-technique/)
- [Prefix sum (Wikipedia)](https://en.wikipedia.org/wiki/Prefix_sum)
- [Floyd's cycle detection](https://en.wikipedia.org/wiki/Cycle_detection#Floyd's_tortoise_and_hare)
- [BenchmarkDotNet — good practices](https://benchmarkdotnet.org/articles/guides/good-practices.html)
- [Gayle Laakmann McDowell — Cracking the Coding Interview](https://www.crackingthecodinginterview.com/)
