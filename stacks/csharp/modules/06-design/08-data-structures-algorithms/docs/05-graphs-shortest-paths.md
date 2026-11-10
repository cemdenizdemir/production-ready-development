---
title: Graphs and shortest paths
tech: C# 14, .NET 10 collections
version: C# 14 / .NET 10
date: 2026-11-09
covers: [11, 12]
---
# Graphs and shortest paths
[← Overview](00-overview.md)

## Why it matters
- Module dependencies formed a cycle (Ordering → Payments → Loyalty → Ordering). Startup registration order broke randomly; a topological sort would have reported the cycle.
- Delivery routes between warehouses and pickup points were chosen by "fewest hops". The cheapest route by cost had more hops; the shop overpaid for shipping for months.
- A "related products" feature followed links recursively without tracking visited nodes and looped forever on a cycle.

## Concepts

### Representing graphs
| Representation | Memory | Edge check | Iterate neighbours | Use |
|:--|:--|:--|:--|:--|
| ⭐ adjacency list (`Dictionary<T, List<T>>`) | O(V + E) | O(degree) | O(degree) | sparse graphs (most real ones) |
| adjacency matrix (`bool[,]`) | O(V²) | O(1) | O(V) | dense, small graphs |
| edge list | O(E) | O(E) | O(E) | Kruskal, input formats |

Directed vs undirected; weighted vs unweighted; cyclic vs acyclic (DAG).

### Traversals and classic algorithms
| Algorithm | Does | Complexity | Uses |
|:--|:--|:--|:--|
| ⭐ BFS (queue) | explores by distance in edges | O(V + E) | shortest path in unweighted graphs, levels, "within 2 hops" |
| ⭐ DFS (stack/recursion) | explores deep first | O(V + E) | reachability, components, cycle detection |
| ⭐ topological sort (Kahn's algorithm) | orders a DAG so dependencies come first | O(V + E) | build order, migrations, module startup, task scheduling |
| ⭐ cycle detection | directed: DFS colours or Kahn leftover; undirected: union-find | O(V + E) | dependency validation |

### Shortest paths and spanning trees
| Algorithm | Graph | Complexity | Notes |
|:--|:--|:--|:--|
| BFS | unweighted | O(V + E) | fewest edges |
| ⭐ Dijkstra | non-negative weights | O((V + E) log V) with a heap | `PriorityQueue` |
| Bellman-Ford | negative weights allowed | O(V·E) | detects negative cycles |
| A* | with a heuristic | often faster than Dijkstra | maps, games |
| ⭐ Prim | minimum spanning tree, grows from a node | O(E log V) | cheapest network connecting all points |
| ⭐ Kruskal | minimum spanning tree, sorts edges + union-find | O(E log E) | same |

## In our stack
- Module dependency rules (a DAG) checked by architecture tests: [03-backend/11-architecture lesson 06](../../../03-backend/11-architecture/docs/06-microservices-adrs-boundaries.md).
- Saga steps and job dependencies are small DAGs: [07-distributed-systems lesson 04](../../07-distributed-systems/docs/04-sagas-cqrs-event-sourcing.md).
- Queues and stacks from [lesson 02](02-arrays-lists-stacks-queues.md); `PriorityQueue` from [lesson 04](04-trees-heaps-tries.md).

## When not to
- Don't hand-roll graph algorithms for large graph workloads (recommendations over millions of edges); use a graph database or a library, or precompute offline.
- Don't use recursion-based DFS on very deep graphs in production code; use an explicit stack to avoid stack overflow.
- Don't use an adjacency matrix for sparse graphs; memory grows with V².

## Example
Topological sort with cycle detection (Kahn's algorithm) for module startup order:
```csharp
public static class Topo
{
    public static Result<IReadOnlyList<string>> Sort(IReadOnlyDictionary<string, string[]> dependsOn)
    {
        var nodes = dependsOn.Keys.Concat(dependsOn.Values.SelectMany(v => v)).ToHashSet();
        var indegree = nodes.ToDictionary(n => n, _ => 0);
        var dependents = nodes.ToDictionary(n => n, _ => new List<string>());
        foreach (var (node, deps) in dependsOn)
            foreach (var d in deps) { indegree[node]++; dependents[d].Add(node); }

        var ready = new Queue<string>(indegree.Where(kv => kv.Value == 0).Select(kv => kv.Key).Order());
        var order = new List<string>(nodes.Count);
        while (ready.TryDequeue(out var n))
        {
            order.Add(n);
            foreach (var m in dependents[n])
                if (--indegree[m] == 0) ready.Enqueue(m);
        }
        // explicit Ok/Fail: C# doesn't apply user-defined implicit conversions when T is an interface
        return order.Count == nodes.Count
            ? Result<IReadOnlyList<string>>.Ok(order)
            : Result<IReadOnlyList<string>>.Fail(new Error("graph.cycle",
                $"Cycle among: {string.Join(", ", indegree.Where(kv => kv.Value > 0).Select(kv => kv.Key))}", ErrorType.Validation));
    }
}

var startup = Topo.Sort(new Dictionary<string, string[]>
{
    ["Ordering"] = ["Catalog", "Payments"], ["Payments"] = [], ["Catalog"] = [], ["Loyalty"] = ["Ordering"],
});
// Catalog, Payments, Ordering, Loyalty
```
Dijkstra for the cheapest delivery route:
```csharp
public static (long Cost, List<string> Path)? Cheapest(
    Dictionary<string, List<(string To, long Cost)>> graph, string from, string to)
{
    var dist = new Dictionary<string, long> { [from] = 0 };
    var prev = new Dictionary<string, string>();
    var pq = new PriorityQueue<string, long>();
    pq.Enqueue(from, 0);

    while (pq.TryDequeue(out var node, out var d))
    {
        if (d > dist[node]) continue;                     // stale entry
        if (node == to) break;
        foreach (var (next, cost) in graph.GetValueOrDefault(node, []))
        {
            var nd = d + cost;
            if (nd < dist.GetValueOrDefault(next, long.MaxValue))
            {
                dist[next] = nd; prev[next] = node; pq.Enqueue(next, nd);
            }
        }
    }
    if (!dist.TryGetValue(to, out var total)) return null;
    var path = new List<string> { to };
    for (var n = to; prev.TryGetValue(n, out var p); n = p) path.Add(p);
    path.Reverse();
    return (total, path);
}
```
BFS: products within two "related" hops, safe with cycles:
```csharp
static HashSet<string> WithinHops(Dictionary<string, string[]> related, string start, int maxHops)
{
    var seen = new HashSet<string> { start };
    var queue = new Queue<(string Sku, int Hops)>([(start, 0)]);
    while (queue.TryDequeue(out var cur))
    {
        if (cur.Hops == maxHops) continue;
        foreach (var next in related.GetValueOrDefault(cur.Sku, []))
            if (seen.Add(next)) queue.Enqueue((next, cur.Hops + 1));   // visited set prevents loops
    }
    seen.Remove(start);
    return seen;
}
```

## Production patterns
- Dependencies (modules, jobs, migrations, saga steps) are modelled as DAGs and validated with a topological sort that reports cycles.
- Traversals always track visited nodes; deep traversals use explicit stacks/queues.
- Weighted routing uses Dijkstra with `PriorityQueue`; large graph problems go to dedicated stores or offline precomputation.

## Mistakes
Wrong: recursive "follow related products" without a visited set.
Right: BFS/DFS with a `HashSet<T>` of visited nodes and a depth limit.

Wrong: fewest hops as the cheapest route.
Right: Dijkstra over cost-weighted edges.

## Check yourself
1. When do you use BFS instead of Dijkstra?
2. How does Kahn's algorithm detect a cycle?
3. Why is an adjacency list usually better than a matrix?

<details><summary>Answers</summary>

1. When all edges have the same weight (or you want the fewest edges): BFS finds shortest paths in O(V + E) without a priority queue.
2. It repeatedly removes nodes with no remaining dependencies; if nodes remain with non-zero in-degree when the queue empties, they're part of (or depend on) a cycle.
3. Real graphs are sparse: a list uses O(V + E) memory and iterates only actual neighbours, while a matrix uses O(V²) memory and scans whole rows.
</details>

## Sources
- [Breadth-first search (Wikipedia)](https://en.wikipedia.org/wiki/Breadth-first_search)
- [Topological sorting — Kahn's algorithm](https://en.wikipedia.org/wiki/Topological_sorting#Kahn's_algorithm)
- [Dijkstra's algorithm](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm)
- [Kruskal's algorithm](https://en.wikipedia.org/wiki/Kruskal%27s_algorithm) and [Prim's algorithm](https://en.wikipedia.org/wiki/Prim%27s_algorithm)
- [PriorityQueue<TElement,TPriority>](https://learn.microsoft.com/dotnet/api/system.collections.generic.priorityqueue-2)
