---
title: Recursion, backtracking, and dynamic programming
tech: C# 14
version: C# 14 / .NET 10
date: 2026-11-09
covers: [15, 16]
---
# Recursion, backtracking, and dynamic programming
[← Overview](00-overview.md)

## Why it matters
- A recursive category walker ran on a 10,000-level chain created by a data import bug and crashed the process with a stack overflow, which .NET can't catch.
- "Find the cheapest combination of bags to reach 2 kg" was solved by trying every combination: fine for 5 bag sizes, hopeless for 30. Dynamic programming solves it in milliseconds.
- A memoised function cached results in a static dictionary keyed by mutable objects; it grew forever and returned wrong answers after the objects changed.

## Concepts

### Recursion
| Part | Meaning |
|:--|:--|
| ⭐ base case | the input small enough to answer directly |
| ⭐ recursive case | solve smaller subproblems and combine |
| call stack | each call uses stack memory; default ~1 MB per thread in .NET |
| ⭐ stack overflow | can't be caught in .NET; the process dies; convert deep recursion to iteration with an explicit stack |
| tail calls | C# doesn't guarantee tail-call elimination; don't rely on it |

### Divide and conquer
Split into independent subproblems, solve each, combine: merge sort, quicksort, binary search, parallel aggregation. Complexity often follows the master theorem (merge sort: T(n) = 2T(n/2) + O(n) = O(n log n)).

### Backtracking
Build candidates step by step; abandon (backtrack) as soon as a partial candidate can't lead to a valid solution. Pruning makes it practical.
| Problem | Shop example |
|:--|:--|
| subsets / combinations | gift boxes from products under a budget |
| permutations | tasting-flight orders |
| constraint satisfaction | delivery slot assignment with rules |

### Dynamic programming (DP)
Use when subproblems **overlap** and the problem has **optimal substructure** (the best answer is built from best answers to subproblems).
| Style | How | Notes |
|:--|:--|:--|
| ⭐ memoisation (top-down) | recursion + cache of results | easy from a recursive solution |
| ⭐ tabulation (bottom-up) | fill a table from small to large | no recursion, often less memory |
| state | what uniquely identifies a subproblem | e.g. (item index, remaining budget) |
| transition | how a state is computed from smaller ones | the recurrence |

| Classic problem | Shop version | Complexity |
|:--|:--|:--|
| ⭐ coin change (min coins) | fewest bags to reach exactly N grams | O(N × sizes) |
| ⭐ 0/1 knapsack | best gift box value within a budget | O(items × budget) |
| longest common subsequence / edit distance | "did you mean" for product search typos | O(n × m) |
| Fibonacci / climbing stairs | the teaching example | O(n) |
| longest increasing subsequence | price trend analysis | O(n log n) |

## In our stack
- Tree traversals (recursive and iterative): [lesson 04](04-trees-heaps-tries.md).
- Merge sort (divide and conquer): [lesson 06](06-sorting-searching.md).
- Caching computed results at system level: [03-backend/06-caching](../../../03-backend/06-caching/README.md).

## When not to
- Don't use recursion for depth that depends on user data without a limit; use iteration.
- Don't reach for DP when a greedy rule is provably correct (for standard coin systems, greedy works; for arbitrary bag sizes, it doesn't).
- Don't memoise in static, unbounded caches in a long-running service; scope memoisation to one computation.

## Example
Recursion vs explicit stack for deep trees:
```csharp
// recursive: elegant, but depth = stack usage
static int CountRecursive(Category c) => 1 + c.Children.Sum(CountRecursive);

// iterative: safe for any depth
static int CountIterative(Category root)
{
    var count = 0;
    var stack = new Stack<Category>([root]);
    while (stack.TryPop(out var c))
    {
        count++;
        foreach (var child in c.Children) stack.Push(child);
    }
    return count;
}
```
Coin change: fewest bags to reach exactly N grams (tabulation):
```csharp
static int? FewestBags(int targetGrams, int[] bagSizes)
{
    var best = new int[targetGrams + 1];                    // best[g] = fewest bags for g grams
    Array.Fill(best, int.MaxValue);
    best[0] = 0;
    for (var g = 1; g <= targetGrams; g++)
        foreach (var size in bagSizes)
            if (size <= g && best[g - size] != int.MaxValue)
                best[g] = Math.Min(best[g], best[g - size] + 1);
    return best[targetGrams] == int.MaxValue ? null : best[targetGrams];
}
// FewestBags(2000, [250, 500, 1000]) → 2; FewestBags(1100, [250, 500, 1000]) → null (impossible)
// FewestBags(600, [100, 300, 400]): greedy takes 400+100+100 = 3 bags; DP finds 300+300 = 2
```
0/1 knapsack: best gift box within a budget (memoisation):
```csharp
static long BestValue(IReadOnlyList<(long PriceMinor, long Value)> items, long budgetMinor)
{
    var memo = new Dictionary<(int, long), long>();         // scoped to this call
    long Go(int i, long budget)
    {
        if (i == items.Count || budget <= 0) return 0;
        if (memo.TryGetValue((i, budget), out var cached)) return cached;
        var skip = Go(i + 1, budget);
        var take = items[i].PriceMinor <= budget ? items[i].Value + Go(i + 1, budget - items[i].PriceMinor) : 0;
        return memo[(i, budget)] = Math.Max(skip, take);
    }
    return Go(0, budgetMinor);
}
```
Edit distance for "did you mean":
```csharp
static int EditDistance(string a, string b)
{
    var prev = new int[b.Length + 1];
    var cur = new int[b.Length + 1];
    for (var j = 0; j <= b.Length; j++) prev[j] = j;
    for (var i = 1; i <= a.Length; i++)
    {
        cur[0] = i;
        for (var j = 1; j <= b.Length; j++)
            cur[j] = Math.Min(Math.Min(prev[j] + 1, cur[j - 1] + 1), prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
        (prev, cur) = (cur, prev);
    }
    return prev[b.Length];
}
// EditDistance("etiopia", "ethiopia") → 1
```
Backtracking: gift boxes of exactly 3 products under a budget (with pruning):
```csharp
static List<List<string>> GiftBoxes(IReadOnlyList<(string Sku, long Price)> products, long budget, int size = 3)
{
    var sorted = products.OrderBy(p => p.Price).ToList();
    var results = new List<List<string>>();
    var current = new List<string>();
    void Go(int start, long remaining)
    {
        if (current.Count == size) { results.Add([.. current]); return; }
        for (var i = start; i < sorted.Count; i++)
        {
            if (sorted[i].Price > remaining) break;          // prune: sorted, so the rest are too expensive
            current.Add(sorted[i].Sku);
            Go(i + 1, remaining - sorted[i].Price);
            current.RemoveAt(current.Count - 1);             // backtrack
        }
    }
    Go(0, budget);
    return results;
}
```

## Production patterns
- Recursion for naturally recursive structures with bounded depth; explicit stacks/queues when depth depends on data.
- DP when subproblems overlap: define the state and recurrence, start with memoisation, switch to tabulation for memory or speed; keep caches scoped to the computation.
- Backtracking with strong pruning and limits on the search space (and a timeout) for anything user-driven.

## Mistakes
Wrong: greedy "largest bag first" for arbitrary bag sizes.
Right: DP, or prove greedy correct for your specific sizes.

Wrong: `static Dictionary<Order, decimal> _memo` that lives forever.
Right: a memo local to one computation, keyed by immutable values.

## Check yourself
1. What two properties make a problem suitable for dynamic programming?
2. Why convert deep recursion to iteration in .NET?
3. What's the difference between memoisation and tabulation?

<details><summary>Answers</summary>

1. Overlapping subproblems (the same subproblem is solved many times) and optimal substructure (the best solution can be built from best solutions to subproblems).
2. Each call uses stack space; deep recursion can overflow the stack, and in .NET a `StackOverflowException` can't be caught, so the process crashes. An explicit stack or queue on the heap has no such limit.
3. Memoisation is top-down: recursion plus a cache of computed results. Tabulation is bottom-up: fill a table iteratively from the smallest subproblems to the target, with no recursion.
</details>

## Sources
- [Recursion (C# programming guide examples)](https://learn.microsoft.com/dotnet/csharp/programming-guide/classes-and-structs/local-functions)
- [Dynamic programming (Wikipedia)](https://en.wikipedia.org/wiki/Dynamic_programming)
- [Knapsack problem](https://en.wikipedia.org/wiki/Knapsack_problem)
- [Levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance)
- [StackOverflowException (can't be caught)](https://learn.microsoft.com/dotnet/api/system.stackoverflowexception)
- [Backtracking](https://en.wikipedia.org/wiki/Backtracking)
