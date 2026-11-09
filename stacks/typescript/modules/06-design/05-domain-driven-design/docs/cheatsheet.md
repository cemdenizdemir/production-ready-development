---
title: Domain-Driven Design cheatsheet
tech: TypeScript, Node.js 26, Drizzle ORM, PostgreSQL 18
version: TypeScript 6.0, Node.js 26 LTS, Drizzle ORM 0.45, PostgreSQL 18, Zod 4
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Domain-Driven Design cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Strategic vs tactical
| Part | Tools |
|:--|:--|
| ⭐ Strategic | ubiquitous language, subdomains, bounded contexts, context maps |
| ⭐ Tactical | entities, value objects, aggregates, domain events, repositories, services, factories |
| Discovery | event storming, domain storytelling, example mapping |

## Ubiquitous language
| Practice | Detail |
|:--|:--|
| ⭐ One language per context | people, UI, code, tests |
| Glossary in the repo | `docs/domain/glossary.md` |
| Code names from the language | `order.place()`, `OrderPlaced` |
| Translation friction | signals a missing concept |

## Event storming stickies
| Sticky | Example |
|:--|:--|
| ⭐ Domain event (orange) | Order placed |
| Command (blue) | Place order |
| Actor (small yellow) | customer |
| Aggregate (large yellow) | Order |
| Policy (lilac) | whenever paid → reserve stock |
| External system (pink) | Stripe |
| Read model (green) | order history |
| Hot spot (red) | open question |

## Subdomains
| Type | Strategy | Shop |
|:--|:--|:--|
| ⭐ Core | build, best people, rich model | pricing, ordering |
| Supporting | build simply | fulfillment, returns |
| ⭐ Generic | buy / library | identity, payments, email |

## Context map relationships
| Pattern | Meaning |
|:--|:--|
| Partnership | teams coordinate closely |
| Shared kernel | tiny shared model |
| Customer–supplier | upstream serves downstream needs |
| Conformist | downstream adopts upstream model |
| ⭐ Anti-corruption layer | downstream translates upstream model |
| ⭐ Open host service | well-defined API for many consumers |
| ⭐ Published language | documented shared format (events, OpenAPI) |
| Separate ways | no integration |

## Building blocks
| Block | Key trait |
|:--|:--|
| ⭐ Entity | identity, lifecycle |
| ⭐ Value object | immutable, equality by value |
| ⭐ Aggregate (root) | consistency boundary, invariants |
| ⭐ Domain event | past-tense fact inside a context |
| Integration event | published, versioned contract |
| Domain service | stateless cross-aggregate rule |
| Application service | use-case orchestration |
| Factory | complex creation with invariants |
| ⭐ Repository | per aggregate root, collection-like |
| Policy | event → command reaction |
| Module | cohesive part of a context |

## Aggregate rules
| Rule | Why |
|:--|:--|
| ⭐ Change through the root | invariants in one place |
| ⭐ One aggregate per transaction | consistency = transaction boundary |
| ⭐ Reference others by ID | no cross-boundary graphs |
| Keep small | less contention |
| Eventual consistency between aggregates | via events |
| True invariants inside | ask the business |
| Idempotent commands for external triggers | webhooks repeat |

## Modeling in TypeScript
| Technique | Example |
|:--|:--|
| ⭐ Branded IDs | `z.uuid().brand<'OrderId'>()` |
| ⭐ Smart constructor | `EmailAddress.parse(input)` |
| ⭐ Parse, don't validate | typed values from the edge inward |
| State-specific types | `DraftOrder` / `PlacedOrder` / `PaidOrder` |
| `#private` state + methods | invariants enforced |
| `private constructor` + `restore()` | creation vs rehydration |
| `pullEvents()` | collect recorded events |
| Exhaustive unions | statuses, events |
| Value objects for money | integer cents + currency |

## Where logic lives
| Logic | Place |
|:--|:--|
| ⭐ One aggregate's rules | aggregate methods |
| Value rules | value objects |
| ⭐ Cross-aggregate rules | domain service |
| ⭐ Workflow, transaction, authorization | application service |
| Screen reads | query modules (CQRS-lite) |
| External translation | ACL adapters |

## Persistence
| Practice | Detail |
|:--|:--|
| ⭐ Data mapper | rows ↔ domain in repositories |
| ⭐ Optimistic concurrency | `WHERE id = $1 AND version = $2`, 0 rows → conflict |
| Load/save whole aggregates | one transaction |
| ⭐ Events via outbox | same transaction |
| IDs before save | UUIDv7 or `nextId()` |
| Children | replace or diff |
| Document storage | JSONB or MongoDB fits aggregates (also seen) |
| avoid | ORM decorators on domain classes |

## DDD + clean architecture
| Ring | DDD blocks |
|:--|:--|
| ⭐ Domain | entities, values, aggregates, domain events, domain services, repository interfaces |
| ⭐ Application | use cases, policies, ports, unit of work |
| ⭐ Adapters | Drizzle repositories, ACLs, routes, job handlers, outbox relay |
| Frameworks | Express, Drizzle, BullMQ, SDKs |
| ⭐ Division of labor | DDD: what modules and models · Clean: dependency direction |

## Module layout per context
| Folder | Holds |
|:--|:--|
| `domain/` | model and rules |
| `application/` | use cases, ports |
| `adapters/` | http, jobs, repositories, ACLs |
| `contracts/` | published events and DTOs |
| `queries/` | read slices |
| `index.ts` | public API |

## When not to
| Situation | Use instead |
|:--|:--|
| ⭐ CRUD, few rules | slices, plain types |
| ⭐ Generic subdomain | buy + adapter |
| Prototype | simplest code |
| No domain experts | simple design |
| DDD-lite everywhere | tactical patterns only where rules are rich |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| One enterprise model | breaks every department | model per context |
| Technical names | experts can't follow | ubiquitous language |
| Huge aggregates | contention, slow loads | small, ID references |
| Editing children directly | invariants bypassed | through the root |
| Multi-aggregate transactions | locks, hidden coupling | events |
| Anemic entities + fat services | rules scattered | behavior in the model |
| Primitive obsession | swapped IDs, unit bugs | brands, value objects |
| Last write wins | lost updates | versions |
| Internal events published | consumers break on refactors | integration contracts |
| Shared kernel that grows | coupling | keep tiny |

## Sources
| Source | Link |
|:--|:--|
| DDD Reference (Evans) | https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf |
| Bounded context | https://martinfowler.com/bliki/BoundedContext.html |
| DDD aggregate | https://martinfowler.com/bliki/DDD_Aggregate.html |
| Effective aggregate design | https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf |
| Context mapping (DDD Crew) | https://github.com/ddd-crew/context-mapping |
| Event storming | https://www.eventstorming.com/ |
| Parse, don't validate | https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/ |
