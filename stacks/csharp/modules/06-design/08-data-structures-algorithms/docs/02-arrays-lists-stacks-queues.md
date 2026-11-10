---
title: Arrays, lists, linked lists, stacks, and queues
tech: C# 14, .NET 10 collections
version: C# 14 / .NET 10
date: 2026-11-09
covers: [3, 4, 6]
---
# Arrays, lists, linked lists, stacks, and queues
[← Overview](00-overview.md)

## Why it matters
- A "recently viewed products" feature removed the oldest item with `list.RemoveAt(0)` on every view. Each removal shifted the whole list: O(n) per view, and the endpoint slowed as lists grew.
- A developer chose `LinkedList<T>` for an order queue "because inserts are O(1)". Iterating it was 5× slower than a `List<T>` because of cache misses, and they never inserted in the middle.
- An undo feature for the admin price editor used a `List` and indexes; off-by-one bugs undid the wrong change. A `Stack<T>` would have made it obvious.

## Concepts

### Arrays and lists
| Type | What | Key costs |
|:--|:--|:--|
| ⭐ `T[]` | fixed-size contiguous memory | index O(1); resize = new array + copy |
| ⭐ `List<T>` | dynamic array (capacity doubles) | index O(1), `Add` O(1) amortised, `Insert`/`RemoveAt(0)` O(n), `Contains` O(n) |
| ⭐ `Span<T>` / `ReadOnlySpan<T>` | a view over contiguous memory (array slice, stack, native) | slicing O(1), no allocation; stack-only (`ref struct`) |
| `Memory<T>` | like span but storable (heap, async) | for async APIs |
| `ImmutableArray<T>` | immutable array | safe sharing |
| `ArrayPool<T>` | rent/return buffers | avoids GC churn (03-backend/09-scalability) |

Contiguous memory is fast: the CPU prefetches neighbouring elements (cache locality). That's why arrays and `List<T>` usually beat node-based structures in practice.

### Linked lists
| Type | What | Key costs |
|:--|:--|:--|
| singly linked | each node points to the next | insert/remove after a known node O(1); index O(n) |
| ⭐ doubly linked (`LinkedList<T>`) | nodes point both ways | insert/remove at a known node O(1); find O(n); poor cache locality, one allocation per node |

Use `LinkedList<T>` when you hold node references and insert/remove in the middle often (LRU caches combine a dictionary of nodes with a linked list). Otherwise, prefer `List<T>` or a `Queue<T>`.

### Stacks and queues
| Type | Order | Operations | Classic uses |
|:--|:--|:--|:--|
| ⭐ `Stack<T>` | LIFO | `Push`, `Pop`, `Peek`, `TryPop` all O(1) | undo, DFS, parsing brackets, call stacks |
| ⭐ `Queue<T>` | FIFO | `Enqueue`, `Dequeue`, `Peek`, `TryDequeue` O(1) (circular buffer) | BFS, task queues, rate windows |
| `PriorityQueue<TElement,TPriority>` | by priority | O(log n) | scheduling, top-k (lesson 04) |
| `ConcurrentQueue<T>` / `Channel<T>` | thread-safe FIFO | lock-free / async | producer–consumer (03-backend/07-background-jobs) |
| deque | both ends | — (no built-in; `LinkedList<T>` or a circular buffer) | sliding window maximum |

## In our stack
- `Span<T>`, `ArrayPool<T>`, allocations: [03-backend/09-scalability lesson 02](../../../03-backend/09-scalability/docs/02-benchmarks-dotnet-performance.md).
- `Channel<T>` as a bounded producer–consumer queue: [03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md).
- Undo with commands on a stack: [03-design-patterns lesson 03](../../03-design-patterns/docs/03-behavioral.md).

## When not to
- Don't use `LinkedList<T>` as a general-purpose list; it's slower for iteration and indexing.
- Don't use `List<T>` as a queue (`RemoveAt(0)`); use `Queue<T>`.
- Don't reach for `Span<T>` in ordinary business code; use it in hot paths a profile points to.

## Example
Recently viewed (bounded, newest first) with a `Queue<T>` instead of `RemoveAt(0)`:
```csharp
public sealed class RecentlyViewed(int capacity = 20)
{
    private readonly Queue<string> _skus = new(capacity);
    private readonly HashSet<string> _present = [];

    public void View(string sku)
    {
        if (!_present.Add(sku)) return;                    // already in the list (simple version: keep first view)
        if (_skus.Count == capacity) _present.Remove(_skus.Dequeue());
        _skus.Enqueue(sku);
    }

    public IReadOnlyList<string> NewestFirst() => [.. _skus.Reverse()];
}
```
Balanced brackets with a `Stack<T>` (validating a discount-rule expression):
```csharp
public static bool IsBalanced(ReadOnlySpan<char> text)
{
    var stack = new Stack<char>();
    foreach (var c in text)
    {
        switch (c)
        {
            case '(' or '[' or '{': stack.Push(c); break;
            case ')' when !stack.TryPop(out var o) || o != '(': return false;
            case ']' when !stack.TryPop(out var o) || o != '[': return false;
            case '}' when !stack.TryPop(out var o) || o != '{': return false;
        }
    }
    return stack.Count == 0;
}
```
A singly linked list from scratch (to understand the costs):
```csharp
public sealed class SinglyLinkedList<T>
{
    private sealed class Node(T value) { public T Value = value; public Node? Next; }
    private Node? _head;
    public int Count { get; private set; }

    public void AddFirst(T value) { _head = new Node(value) { Next = _head }; Count++; }      // O(1)

    public bool Remove(T value)                                                             // O(n)
    {
        Node? prev = null;
        for (var n = _head; n is not null; prev = n, n = n.Next)
        {
            if (!EqualityComparer<T>.Default.Equals(n.Value, value)) continue;
            if (prev is null) _head = n.Next; else prev.Next = n.Next;
            Count--;
            return true;
        }
        return false;
    }

    public void Reverse()                                                                   // O(n), O(1) space
    {
        Node? prev = null, current = _head;
        while (current is not null) (current.Next, prev, current) = (prev, current, current.Next);
        _head = prev;
    }
}
```
Slicing without copying:
```csharp
ReadOnlySpan<char> sku = "ETH-0250-WB".AsSpan();
var origin = sku[..3];                // "ETH", no allocation
var grams = int.Parse(sku[4..8]);     // 250
```

## Production patterns
- Default to `List<T>` (pre-sized when you know the count) and arrays; switch structure when an operation profile demands it.
- Use `Queue<T>`/`Stack<T>` for FIFO/LIFO; `Channel<T>` for async producer–consumer; never `RemoveAt(0)` on big lists.
- Use spans and pooled arrays in measured hot paths only.

## Mistakes
Wrong: `if (!list.Contains(x)) list.Add(x);` for de-duplication of large data.
Right: a `HashSet<T>` (lesson 03).

Wrong: `list.Insert(0, item)` to keep newest first.
Right: append and iterate in reverse, or a deque/circular buffer.

## Check yourself
1. Why is `List<T>` usually faster to iterate than `LinkedList<T>`?
2. Which structure fits undo, and which fits BFS?
3. What does `Span<T>` give you, and what's its main restriction?

<details><summary>Answers</summary>

1. Its elements are contiguous in memory, so the CPU cache and prefetcher work well; linked list nodes are scattered allocations, causing cache misses and extra pointer chasing.
2. Undo: a stack (last change undone first). BFS: a queue (visit in order of discovery).
3. A zero-copy, allocation-free view over contiguous memory (arrays, strings, stack memory) with fast slicing; it's a `ref struct`, so it can't be stored on the heap, captured in lambdas, or used across `await`.
</details>

## Sources
- [List<T> remarks and performance](https://learn.microsoft.com/dotnet/api/system.collections.generic.list-1)
- [LinkedList<T>](https://learn.microsoft.com/dotnet/api/system.collections.generic.linkedlist-1)
- [Stack<T>](https://learn.microsoft.com/dotnet/api/system.collections.generic.stack-1) and [Queue<T>](https://learn.microsoft.com/dotnet/api/system.collections.generic.queue-1)
- [Memory and spans](https://learn.microsoft.com/dotnet/standard/memory-and-spans/)
- [Algorithmic complexity of collections](https://learn.microsoft.com/dotnet/standard/collections/#algorithmic-complexity-of-collections)
