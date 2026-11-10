---
title: Trees, heaps, and tries
tech: C# 14, .NET 10 collections
version: C# 14 / .NET 10
date: 2026-11-09
covers: [7, 8, 10]
---
# Trees, heaps, and tries
[← Overview](00-overview.md)

## Why it matters
- "Top 10 bestsellers" sorted 2 million order lines every minute (O(n log n)). A heap of size 10 does it in O(n log 10).
- A category menu was rendered by recursive SQL queries, one per level and node: 300 queries per page. Loading the flat list once and building the tree in memory took one query.
- A home-made binary search tree for price ranges degraded into a linked list because products were inserted in sorted order; lookups became O(n).

## Concepts

### Trees
| Term | Meaning |
|:--|:--|
| ⭐ tree | nodes with children, one root, no cycles |
| ⭐ binary tree | at most two children |
| ⭐ binary search tree (BST) | left < node < right; search/insert O(height) |
| ⭐ balanced trees | keep height O(log n): red-black (`SortedDictionary`/`SortedSet`), AVL, B-trees (database indexes) |
| degenerate tree | inserting sorted data into a plain BST → height n → O(n) |
| height / depth | longest root-to-leaf path / distance from root |

| Traversal | Order | Use |
|:--|:--|:--|
| ⭐ pre-order | node, left, right | copy/serialise a tree, print a menu |
| ⭐ in-order | left, node, right | BST → sorted output |
| ⭐ post-order | left, right, node | delete or aggregate children first (bundle totals) |
| ⭐ level-order (BFS) | level by level with a queue | breadcrumbs by depth, shortest path in unweighted trees |

### Heaps and priority queues
| Concept | Meaning |
|:--|:--|
| ⭐ binary heap | complete binary tree in an array; parent ≤ children (min-heap) |
| operations | peek O(1), push/pop O(log n), build O(n) |
| ⭐ `PriorityQueue<TElement,TPriority>` | .NET min-heap; `Enqueue`, `Dequeue`, `TryPeek`, `EnqueueDequeue` |
| max-heap | use a reversed comparer: `Comparer<int>.Create((a, b) => b.CompareTo(a))` |
| ⭐ top-k | keep a min-heap of size k: O(n log k) |
| scheduling | next job by due time; Dijkstra (lesson 05) |

### Tries (prefix trees)
| Concept | Meaning |
|:--|:--|
| ⭐ trie | each edge is a character; a path from the root spells a prefix |
| insert / lookup | O(length of the word), independent of the number of words |
| ⭐ prefix search | walk to the prefix node, collect words below |
| memory | can be large; compress (radix tree) or limit depth |
| real systems | search engines (Azure AI Search suggesters) do this for you |

## In our stack
- Database indexes are B-trees: [03-backend/03-databases](../../../03-backend/03-databases/README.md).
- `SortedSet`/`SortedDictionary` (red-black trees): [lesson 03](03-hash-tables-sorted-collections.md).
- Autocomplete at system scale: [06-system-design lesson 05](../../06-system-design/docs/05-classic-designs.md).
- Composite bundles (trees of products): [03-design-patterns lesson 02](../../03-design-patterns/docs/02-structural.md).

## When not to
- Don't implement your own balanced tree in production; use `SortedDictionary`/`SortedSet` or the database.
- Don't sort a whole collection to get the top few; use a heap (or `OrderBy(...).Take(k)` for small data, which is fine).
- Don't build a trie service when a search engine's suggester meets the need.

## Example
Category tree from a flat list (one query), with traversals:
```csharp
public sealed record CategoryRow(int Id, int? ParentId, string Name);
public sealed class Category(int id, string name)
{
    public int Id { get; } = id;
    public string Name { get; } = name;
    public List<Category> Children { get; } = [];
}

public static class CategoryTree
{
    public static IReadOnlyList<Category> Build(IEnumerable<CategoryRow> rows)       // O(n)
    {
        var rowList = rows.ToList();
        var byId = rowList.ToDictionary(r => r.Id, r => new Category(r.Id, r.Name));
        var roots = new List<Category>();
        foreach (var r in rowList)
            if (r.ParentId is int p && byId.TryGetValue(p, out var parent)) parent.Children.Add(byId[r.Id]);
            else roots.Add(byId[r.Id]);
        return roots;
    }

    public static IEnumerable<(Category Node, int Depth)> PreOrder(Category node, int depth = 0)
    {
        yield return (node, depth);
        foreach (var child in node.Children)
            foreach (var x in PreOrder(child, depth + 1)) yield return x;
    }

    public static IEnumerable<Category> LevelOrder(Category root)
    {
        var queue = new Queue<Category>([root]);
        while (queue.TryDequeue(out var n))
        {
            yield return n;
            foreach (var c in n.Children) queue.Enqueue(c);
        }
    }
}
```
Top-k bestsellers with a min-heap of size k:
```csharp
public static IReadOnlyList<(string Sku, int Sold)> TopK(IEnumerable<(string Sku, int Sold)> items, int k)
{
    var heap = new PriorityQueue<(string Sku, int Sold), int>(k + 1);
    foreach (var item in items)
    {
        heap.Enqueue(item, item.Sold);
        if (heap.Count > k) heap.Dequeue();                 // drop the smallest: O(log k)
    }
    var result = new List<(string, int)>(heap.Count);
    while (heap.TryDequeue(out var x, out _)) result.Add(x);
    result.Reverse();                                       // largest first
    return result;
}
```
A trie for product-name prefixes:
```csharp
public sealed class Trie
{
    private sealed class Node { public readonly Dictionary<char, Node> Next = []; public bool IsWord; }
    private readonly Node _root = new();

    public void Insert(string word)
    {
        var n = _root;
        foreach (var c in word.ToLowerInvariant())
        {
            if (!n.Next.TryGetValue(c, out var next)) n.Next[c] = next = new Node();
            n = next;
        }
        n.IsWord = true;
    }

    public IEnumerable<string> StartingWith(string prefix, int limit = 10)
    {
        var n = _root;
        foreach (var c in prefix.ToLowerInvariant())
        {
            if (!n.Next.TryGetValue(c, out var next)) return [];
            n = next;
        }
        var results = new List<string>();
        Collect(n, new StringBuilder(prefix.ToLowerInvariant()), results, limit);
        return results;
    }

    private static void Collect(Node n, StringBuilder path, List<string> results, int limit)
    {
        if (results.Count >= limit) return;
        if (n.IsWord) results.Add(path.ToString());
        foreach (var (c, child) in n.Next.OrderBy(kv => kv.Key))
        {
            path.Append(c);
            Collect(child, path, results, limit);
            path.Length--;
        }
    }
}
```

## Production patterns
- Hierarchies load as flat rows once and are assembled in memory with a dictionary (O(n)); traversals pick the order the use case needs.
- Top-k and scheduling use `PriorityQueue`; ordered maps use the built-in balanced trees.
- Prefix search is delegated to the search engine at scale; a trie is fine for small in-memory sets.

## Mistakes
Wrong: one SQL query per tree node (N+1 for hierarchies).
Right: load all rows (or use a recursive CTE once) and build the tree in memory.

Wrong: `items.OrderByDescending(i => i.Sold).Take(10)` over millions of rows in memory every minute.
Right: a size-k heap (or let SQL do `TOP (10) ... ORDER BY` with an index).

## Check yourself
1. Why can a plain BST become O(n)?
2. What's the complexity of top-k with a size-k min-heap?
3. Which traversal gives sorted output from a BST, and which uses a queue?

<details><summary>Answers</summary>

1. Without balancing, inserting keys in sorted (or nearly sorted) order makes every node have only one child, so the tree's height equals n and every operation walks the whole chain.
2. O(n log k) time and O(k) space: each of the n items costs at most one push and one pop on a heap of size k.
3. In-order traversal yields sorted keys; level-order (breadth-first) traversal uses a queue.
</details>

## Sources
- [PriorityQueue<TElement,TPriority>](https://learn.microsoft.com/dotnet/api/system.collections.generic.priorityqueue-2)
- [SortedDictionary (red-black tree)](https://learn.microsoft.com/dotnet/api/system.collections.generic.sorteddictionary-2)
- [Tree traversal (Wikipedia)](https://en.wikipedia.org/wiki/Tree_traversal)
- [Binary heap (Wikipedia)](https://en.wikipedia.org/wiki/Binary_heap)
- [Trie (Wikipedia)](https://en.wikipedia.org/wiki/Trie)
- [SQL Server index architecture (B-trees)](https://learn.microsoft.com/sql/relational-databases/sql-server-index-design-guide)
