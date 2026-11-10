---
title: Software Design & Architecture cheatsheet
date: 2026-11-07
---
# Software Design & Architecture cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · Paradigms & OOP](01-paradigms-oop/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Functional core, imperative shell | pure decisions, I/O at the edges |
| Classes for things with rules and lifecycle | encapsulated invariants |
| `#private` fields | real runtime privacy |
| Composition over inheritance | many axes of variation |
| No parameter properties, no `enum` | Node type stripping compatible |
| Pure functions + immutability (`toSorted`, spread) | testable, no hidden state |
| Discriminated unions + `assertNever` | exhaustive variant handling |
| Results for expected outcomes, exceptions for bugs | clear error styles |
| Dispatch tables typed from unions | polymorphism without classes |
| Entity vs value object vs DTO | identity, value equality, boundary shapes |
| Branded types | no mixed-up IDs |

## [02 · Design Principles & SOLID](02-principles/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Low coupling, high cohesion | cheap, safe changes |
| SRP: one reason (actor) to change | separate what changes for different reasons |
| OCP: extend by adding | registries, strategies |
| LSP: keep the contract | no "not supported" throws |
| ISP: role interfaces | clients depend on what they use |
| DIP: core owns abstractions | ports and adapters |
| DRY = knowledge, not text | one home per rule |
| KISS, YAGNI, rule of three | no speculative design |
| Law of Demeter, tell don't ask | short chains, objects enforce rules |
| CQS | commands change, queries return |
| Smell → refactoring, tests first | safe improvement |
| Over-engineering is a finding | reviews cut both ways |

## [03 · Design Patterns](03-design-patterns/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Factory function + composition root | construction and wiring |
| Builder / options object | readable complex construction |
| Adapter | fit an external interface |
| Decorator | retry, timeout, cache, metrics, same interface |
| Facade | simple entry to a workflow |
| Strategy | swappable rules |
| Observer / domain events | decoupled reactions |
| Command | requests as data (jobs) |
| State machine | legal transitions only |
| Chain of responsibility | middleware |
| Repository + unit of work | aggregate persistence in one transaction |
| Specification | one rule for SQL and memory |
| Avoid: singletons, service locator, pattern-itis | anti-patterns |

## [04 · Architecture Styles](04-architecture-styles/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Quality attributes first | styles chosen by forces |
| Layers (code) vs tiers (deployables) | precise vocabulary |
| MVC / MVP / MVVM | React hooks as ViewModels, routes as controllers |
| Clean / hexagonal / onion | dependencies point inward |
| Driving vs driven adapters | routes/jobs vs DB/APIs |
| Vertical slices | feature-first organization |
| Modular monolith first | boundaries without distribution |
| Microservices with a reason | scaling, isolation, team friction |
| Choreography vs orchestration | events vs coordinator |
| CQRS-lite, event sourcing rarely | read models where reads hurt |
| ADRs + fitness functions | decisions recorded and checked |
| DDD = what modules; clean = dependency direction | combining styles |

## [05 · Domain-Driven Design](05-domain-driven-design/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Ubiquitous language + glossary | one meaning per word per context |
| Event storming | discover events, commands, policies |
| Core / supporting / generic subdomains | where to invest |
| Bounded contexts + context map | model boundaries and integrations |
| Anti-corruption layer | protect the model from external ones |
| Entities, value objects | identity vs value |
| Aggregates: root, invariants, one per transaction | consistency boundaries |
| References by ID, events between aggregates | loose coupling |
| Domain vs integration events | internal vs published contracts |
| Branded IDs, smart constructors, parse don't validate | illegal states unrepresentable |
| Optimistic concurrency with versions | no lost updates |
| Domain at the center, adapters outside | DDD inside clean architecture |

## [06 · System Design](06-system-design/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Requirements → estimates → API → data → design → deep dives | the method |
| 1M/day ≈ 12/s, peak 2–5× | estimation |
| Same-AZ ~0.5 ms, Redis ~1 ms, cross-continent ~150 ms | latency orders |
| Postgres + S3 + Redis by default | storage choices |
| CDN → Redis → database | caching layers |
| Replicas, partitioning, sharding | scaling data |
| Consistent hashing | rebalancing-friendly shards |
| Hybrid fan-out | feeds at scale |
| Idempotency keys, rate limits, cursor pagination | APIs at scale |
| Series availability multiplies | critical-path math |
| C4 diagrams + design docs | communicating designs |
| `/design "<problem>"` | practice |

## [07 · Distributed Systems](07-distributed-systems/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Timeout = unknown outcome | resolve, don't blindly retry |
| CAP / PACELC | consistency vs availability / latency |
| Consistency per operation | linearizable where needed, eventual elsewhere |
| Sync vs async replication | durability vs latency |
| Read-your-writes routing | no stale own data |
| Per-aggregate versions, not clocks | ordering |
| Advisory locks, unique claims | correctness from the database |
| Redis locks are leases; fencing tokens | safe coordination |
| At-least-once + idempotent consumers | effectively-once |
| Sagas with compensations | no distributed transactions |
| Projections, replays | CQRS and event sourcing |
| Duplicate/reorder/fault tests | catch distributed bugs |
