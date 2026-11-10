---
title: Data Structures & Algorithms cheatsheet
tech: C# 14, .NET 10 collections, BenchmarkDotNet
version: C# 14 / .NET 10, BenchmarkDotNet 0.15.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
---
# Data Structures & Algorithms cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Computational thinking
| Skill | Use when | Note |
|:--|:--|:--|
| ⭐ decomposition | any non-trivial task | smaller problems |
| pattern recognition | "this is top-k / BFS / DP" | |
| abstraction | strip irrelevant details | |
| ⭐ pseudocode | branches, loops, edge cases | before C# |
| flowcharts | decisions | Mermaid |

## Complexity classes
| Class | n = 10^6 | Example |
|:--|:--|:--|
| O(1) | 1 | dictionary lookup |
| O(log n) | ~20 | binary search |
| ⭐ O(n) | 10^6 | one pass |
| ⭐ O(n log n) | ~2×10^7 | sorting |
| ⭐ O(n²) | 10^12 | nested loops (too slow) |
| O(2^n) / O(n!) | impossible | brute-force subsets/permutations |
| ⭐ amortised | average over many ops | `List.Add` |

## Hidden O(n) in C#
| Operation | Cost | Instead |
|:--|:--|:--|
| ⭐ `List.Contains` / `IndexOf` | O(n) | `HashSet` |
| `List.Insert(0)` / `RemoveAt(0)` | O(n) | `Queue`, reverse iteration |
| `string +=` in loops | O(n²) | `StringBuilder`, `string.Join` |
| `Count()` on sequences | O(n) | `.Count` on collections |
| multiple enumeration | repeated work | materialise once (CA1851) |
| N+1 queries | n round trips | `Include`, projections |

## Arrays and lists
| Type | Strength | Note |
|:--|:--|:--|
| ⭐ `T[]` | O(1) index, contiguous | fixed size |
| ⭐ `List<T>` | dynamic array | pre-size with capacity |
| ⭐ `Span<T>` | zero-copy slices | `ref struct` |
| `Memory<T>` | storable span | async |
| `ImmutableArray<T>` | safe sharing | |
| `ArrayPool<T>` | buffer reuse | hot paths |
| `LinkedList<T>` | O(1) insert at known node | poor locality |

## Stacks and queues
| Type | Order | Use |
|:--|:--|:--|
| ⭐ `Stack<T>` | LIFO | undo, DFS, brackets |
| ⭐ `Queue<T>` | FIFO | BFS, buffers |
| ⭐ `PriorityQueue<TElement,TPriority>` | min priority | top-k, Dijkstra, scheduling |
| `ConcurrentQueue<T>` | thread-safe FIFO | |
| `Channel<T>` | async producer–consumer | bounded |

## Hash-based
| Type / rule | Does | Note |
|:--|:--|:--|
| ⭐ `Dictionary<TKey,TValue>` | O(1) avg map | |
| ⭐ `HashSet<T>` | O(1) membership, set ops | `ExceptWith`, `IntersectWith` |
| ⭐ `Equals` + `GetHashCode` | must agree | records do it |
| immutable keys | stable hash | no mutation |
| `StringComparer.OrdinalIgnoreCase` | case-insensitive keys | |
| `CollectionsMarshal.GetValueRefOrAddDefault` | single lookup update | |
| `CountBy` / `AggregateBy` | grouping counts | .NET 9+ |

## Sorted and read-optimised
| Type | Structure | Use |
|:--|:--|:--|
| ⭐ `SortedDictionary` | red-black tree | ordered map, O(log n) |
| `SortedList` | sorted arrays | read-mostly ordered map |
| ⭐ `SortedSet` | red-black tree | ranges, min/max |
| ⭐ `FrozenDictionary` / `FrozenSet` | read-optimised | static lookups (.NET 8+) |
| immutable collections | persistent trees | snapshots |
| `SearchValues<T>` | fast any-of | parsing (.NET 8+) |

## Trees
| Concept | Meaning | Note |
|:--|:--|:--|
| ⭐ BST | left < node < right | O(height) |
| ⭐ balanced tree | height O(log n) | red-black, AVL, B-tree |
| degenerate BST | sorted inserts | O(n) |
| ⭐ pre-order | node, children | copy, print |
| ⭐ in-order | left, node, right | sorted output |
| ⭐ post-order | children, node | aggregate, delete |
| ⭐ level-order | BFS with queue | by depth |
| build from flat rows | dictionary by ID | O(n) |

## Heaps and tries
| Concept | Does | Note |
|:--|:--|:--|
| ⭐ binary heap | min/max at top | push/pop O(log n) |
| ⭐ top-k | size-k min-heap | O(n log k) |
| max-heap | reversed comparer | |
| ⭐ trie | prefix tree | O(word length) |
| prefix search | walk + collect | autocomplete |
| radix tree | compressed trie | memory |

## Graphs
| Algorithm | Use | Complexity |
|:--|:--|:--|
| ⭐ adjacency list | sparse graphs | O(V + E) memory |
| adjacency matrix | dense, small | O(V²) |
| ⭐ BFS | unweighted shortest path | O(V + E) |
| ⭐ DFS | reachability, cycles | O(V + E) |
| ⭐ topological sort (Kahn) | dependency order, cycle detection | O(V + E) |
| ⭐ Dijkstra | non-negative weights | O((V + E) log V) |
| Bellman-Ford | negative weights | O(V·E) |
| Prim / Kruskal | minimum spanning tree | O(E log V) |
| union-find | connectivity | ~O(1) amortised |
| visited set | avoid cycles | always |

## Sorting
| Algorithm | Avg / worst | Stable |
|:--|:--|:--|
| insertion | O(n²) | ✓ |
| ⭐ merge | O(n log n) | ✓ |
| ⭐ quick | O(n log n) / O(n²) | ✗ |
| ⭐ heap | O(n log n) | ✗ |
| counting / radix | O(n + k) | ✓ |
| ⭐ `Array.Sort` / `List.Sort` | introsort | ✗ |
| ⭐ LINQ `OrderBy` / `ThenBy` | stable | ✓ |
| comparers | `CompareTo`, never subtraction | overflow |

## Searching
| Technique | Requires | Time |
|:--|:--|:--|
| linear | nothing | O(n) |
| ⭐ binary | sorted | O(log n) |
| ⭐ `BinarySearch` negative result | `~i` = insertion point | |
| `lo + (hi - lo) / 2` | overflow-safe mid | |
| binary search on answer | monotonic check | |
| hash lookup | hash table | O(1) |

## Recursion and DP
| Concept | Means | Note |
|:--|:--|:--|
| ⭐ base case | stop condition | |
| ⭐ stack overflow | uncatchable in .NET | iterate for deep data |
| divide and conquer | split, solve, combine | merge sort |
| ⭐ backtracking | build, prune, undo | combinations |
| ⭐ memoisation | top-down cache | scoped memo |
| ⭐ tabulation | bottom-up table | no recursion |
| state + transition | define the subproblem | |
| coin change, knapsack, edit distance | classic DP | |

## Problem-solving patterns
| Pattern | Recognise | Note |
|:--|:--|:--|
| ⭐ two pointers | sorted pairs, partitions | O(n) |
| ⭐ sliding window | contiguous ranges | O(n) |
| ⭐ prefix sums | many range sums | O(1) query |
| ⭐ fast/slow pointers | cycles, middle | O(1) space |
| hash counting | frequencies, duplicates | |
| monotonic stack | next greater | |
| heap | top-k, merge k lists | |
| BFS/DFS | grids, graphs | |

## Measuring
| Practice | Why | Note |
|:--|:--|:--|
| ⭐ BenchmarkDotNet | real numbers | Release |
| ⭐ `[Params]` sizes | small vs large n | |
| ⭐ `[MemoryDiagnoser]` | allocations | GC |
| cache locality | arrays win | |
| baseline | ratios | |

## Interview method
| Step | Do | Note |
|:--|:--|:--|
| ⭐ clarify | inputs, sizes, edge cases | |
| ⭐ examples | by hand | |
| ⭐ brute force | + complexity | |
| ⭐ optimise | pattern, space for time | |
| code | talk through it | |
| ⭐ test | edge cases | off-by-one |
| trade-offs | at 100× | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| nested loops on big data | O(n²) | hash lookups |
| `Equals` without `GetHashCode` | broken dictionaries | records |
| mutable keys | lost entries | immutable keys |
| `LinkedList` by default | slow iteration | `List<T>` |
| `List.Sort` for multi-key | unstable | `OrderBy().ThenBy()` |
| subtraction comparers | overflow | `CompareTo` |
| deep recursion on data | process crash | explicit stack |
| no visited set | infinite loops | `HashSet` |
| static unbounded memo | leaks, stale | scoped memo |
| Big-O without measuring | wrong choice | benchmark |

## Sources
| Source | Link |
|:--|:--|
| .NET collections | https://learn.microsoft.com/dotnet/standard/collections/ |
| Collection complexity | https://learn.microsoft.com/dotnet/standard/collections/#algorithmic-complexity-of-collections |
| PriorityQueue | https://learn.microsoft.com/dotnet/api/system.collections.generic.priorityqueue-2 |
| Frozen collections | https://learn.microsoft.com/dotnet/api/system.collections.frozen |
| Array.Sort | https://learn.microsoft.com/dotnet/api/system.array.sort |
| Big-O cheat sheet | https://www.bigocheatsheet.com/ |
| CLRS | https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/ |
| BenchmarkDotNet | https://benchmarkdotnet.org/ |
