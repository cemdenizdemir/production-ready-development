---
title: Software Design & Architecture cheatsheet
date: 2026-11-09
---
# Software Design & Architecture cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · Paradigms & OOP](01-paradigms-oop/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| imperative, OO, functional, declarative mixed in C# | the right style per problem |
| encapsulation: private setters + methods | invalid states can't be set |
| composition over inheritance | variations combine without class explosions |
| `sealed` by default, `internal` across modules | small public surface |
| interfaces for contracts, abstract classes for shared state | choosing abstractions |
| generics with constraints, delegates, dispatch tables | polymorphism without inheritance |
| pure functions, immutability (`record`, `with`) | testable rules |
| sealed record hierarchies + `switch` (C# 15 unions next) | sum types |
| `Result<T>` for expected outcomes, exceptions for the unexpected | error styles |
| entity (by ID) vs value object (by value) vs DTO | three kinds of types |
| functional core, imperative shell | where effects live |

## [02 · Design Principles](02-principles/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| low coupling, high cohesion | the goal behind the rest |
| SRP: one reason to change (one actor) | split by actor |
| OCP: extend by adding code | strategies, events, data-driven rules |
| LSP: no `NotSupportedException` subtypes | substitutable implementations |
| ISP: client-specific interfaces | small contracts |
| DIP: the core owns its ports | dependencies point inward |
| DRY knowledge, KISS, YAGNI, rule of three | economy |
| tell don't ask, Law of Demeter, CQS | object conversations |
| characterisation tests, small steps, tidy first | safe refactoring |
| concrete review comments, spot over-engineering | principles in review |

## [03 · Design Patterns](03-design-patterns/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| static factories, builders for tests, DI lifetimes | creational |
| adapter, facade, decorator, proxy | structural |
| strategy, observer (events), command | behavioral |
| state transitions on aggregates, pipelines (chain) | behavioral in practice |
| `DbContext` = unit of work; repositories per aggregate | application patterns |
| specification shared by queries and memory | one rule, one place |
| retry, breaker, bulkhead, outbox, saga, ACL | resilience and integration |
| container/presentational, hooks, composition, providers | frontend patterns |
| service locator, god object, pattern-itis | anti-patterns |
| middleware, `DelegatingHandler`, `IOptions<T>` | patterns built into .NET |

## [04 · Architecture Styles](04-architecture-styles/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| quality attributes first, recorded in an ADR | why a style |
| layers (code) vs tiers (deployments) | layered and n-tier |
| component-based UI; rules in the backend | UI patterns |
| dependency rule (clean/hexagonal/onion) | framework-free core |
| vertical slices inside feature modules | cohesive features |
| modular monolith with contracts and data per module | default backend style |
| microservices only with a reason; data per service | distributed costs |
| event-carried state; choreography vs orchestration | event-driven |
| CQRS-lite by default; event sourcing rarely | read/write separation |
| BFF (Next.js), gateways (Front Door, APIM, YARP) | edges |
| fitness functions: architecture tests, k6, SLOs | checked decisions |

## [05 · Domain-Driven Design](05-domain-driven-design/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| ubiquitous language + glossary | shared terms in code |
| event storming | discover events, commands, aggregates, hotspots |
| core / supporting / generic subdomains | where to invest |
| bounded contexts + context map | one model per context |
| ACL, customer–supplier, conformist, published language | context relationships |
| small aggregates, one root, references by ID | consistency boundaries |
| domain events → outbox → integration events | reactions |
| strongly typed IDs, parse don't validate | safer models |
| `ComplexProperty`, backing fields, `IsRowVersion()` | EF Core mapping |
| full DDD in the core, DDD-lite elsewhere | when not to |

## [06 · System Design](06-system-design/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| requirements → estimates → API → data → design → deep dives → trade-offs | the method |
| per day ÷ 10^5 = QPS; peak 2–10× | estimation |
| CDN, LB, gateway, cache, queue, blob, search | building blocks |
| relational system of record + specialised stores | storage choices |
| tune → cache → replicas → partition → shard | scaling data |
| consistent hashing, hot key mitigation | partitioning |
| cache-aside + stampede protection | caching |
| queues, topics, streams, fan-out, backpressure | async processing |
| token bucket / sliding window, idempotency keys | API at scale |
| serial vs parallel availability math | reliability |
| URL shortener, feed, chat, notifications, autocomplete | classic designs |
| C4 context + container diagrams | communicating |

## [07 · Distributed Systems](07-distributed-systems/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| fallacies; success / failure / unknown outcomes | partial failure |
| CAP (partitions), PACELC (latency vs consistency) | trade-offs |
| strong, read-your-writes, eventual | consistency per use case |
| single-leader, sync vs async replication, lag | replication |
| aggregate versions, sessions, not wall clocks | ordering |
| SQL app locks, leases, fencing tokens | coordination |
| at-least-once + idempotent consumers | effectively-once |
| orchestrated sagas with compensations and deadlines | distributed transactions |
| snapshots, projections, upcasting | event sourcing |
| concurrent duplicates, permutations, failure paths | testing |

## [08 · Data Structures & Algorithms](08-data-structures-algorithms/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| decompose, pseudocode, examples | computational thinking |
| O(1), O(log n), O(n), O(n log n), O(n²); amortised | complexity |
| `List<T>` (pre-sized), `Span<T>`, `Queue<T>`, `Stack<T>` | linear structures |
| `Dictionary`/`HashSet` with correct `Equals`/`GetHashCode` | hashing |
| `SortedSet`, `FrozenDictionary`, immutable collections | ordered/read-optimised |
| traversals, `PriorityQueue` top-k, tries | trees and heaps |
| BFS, DFS, topological sort, Dijkstra | graphs |
| `OrderBy` stable vs `List.Sort` unstable; `BinarySearch` + `~i` | sorting and searching |
| explicit stacks for deep data; memoisation vs tabulation | recursion and DP |
| two pointers, sliding window, prefix sums, fast/slow | patterns |
| BenchmarkDotNet with realistic sizes | measure, don't guess |
| clarify → examples → brute force → optimise → test | interview method |
