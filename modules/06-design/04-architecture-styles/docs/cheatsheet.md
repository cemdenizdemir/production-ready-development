---
title: Architecture Styles cheatsheet
tech: TypeScript, Express 5, Next.js 16, React 19.2
version: Node.js 26 LTS, Express 5.2, Next.js 16, React 19.2, BullMQ 5
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Architecture Styles cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Quality attributes
| Attribute | Question |
|:--|:--|
| ⭐ Changeability | cost of a typical change |
| ⭐ Scalability | grow load without redesign |
| ⭐ Availability | behavior when parts fail |
| Performance | latency, throughput |
| Security | trust boundaries |
| ⭐ Testability | rules testable without infrastructure |
| Deployability | release often and safely |
| Observability | understand behavior in production |
| Cost / team fit | can this team build and run it |

## Questions styles answer
| Question | Styles |
|:--|:--|
| ⭐ Where does code run? | 1/2/3/n-tier |
| ⭐ How is code grouped? | layers, vertical slices, feature modules |
| ⭐ Which way do dependencies point? | clean, hexagonal, onion |
| ⭐ How many deployables? | monolith, modular monolith, microservices, serverless |
| ⭐ How do parts talk? | request/response, events, CQRS, event sourcing |
| How is the UI organized? | MVC, MVP, MVVM, component-based, Flux |

## Layers vs tiers
| | Layers | Tiers |
|:--|:--|:--|
| Are | logical code groups | physical deployables |
| Boundary | function calls | network calls |
| Scale | understanding, change | load, isolation |

## Classic layers
| Layer | Holds | Our stack |
|:--|:--|:--|
| Presentation | HTTP, UI | Express routes, Next.js |
| Application | use cases, transactions | use case functions |
| Domain | rules, invariants | domain functions/entities |
| Infrastructure | DB, queues, APIs | repositories, adapters |
| Closed layers | call only the next layer | sinkhole risk |
| Open layers | some layers skippable | read paths |

## UI patterns
| Pattern | Roles | Seen in |
|:--|:--|:--|
| MVC | Model, View, Controller | Rails, Spring MVC; Express routes as controllers |
| MVP | Presenter + passive View | classic Android, WinForms |
| ⭐ MVVM | ViewModel state/commands, View binds | Angular, Vue, SwiftUI; React hooks as ViewModels |
| ⭐ Component-based | components own render + state | React, Vue, Svelte |
| Flux | actions → store → view | Redux, Zustand |

## Dependency-rule styles
| Style | Author | Rings / parts |
|:--|:--|:--|
| ⭐ Hexagonal | Cockburn 2005 | app core, ports, adapters |
| Onion | Palermo 2008 | domain model → domain services → application → infrastructure/UI |
| ⭐ Clean | Martin 2012 | entities → use cases → interface adapters → frameworks |
| ⭐ Shared rule | — | dependencies point inward |

## Ports and adapters vocabulary
| Term | Example |
|:--|:--|
| ⭐ Port | `PaymentGateway`, `OrderRepository` |
| ⭐ Driving (primary) adapter | Express route, BullMQ worker, CLI |
| ⭐ Driven (secondary) adapter | Drizzle repository, Stripe gateway, SES mailer |
| Composition root | wires adapters to ports |
| Use case / interactor | application workflow |
| Presenter | formats output (often just a DTO mapper) |

## Vertical slices
| Aspect | Note |
|:--|:--|
| Unit | feature / request |
| Shared abstractions | few |
| ⭐ Fits | many independent features, CRUD, reads |
| Risk | duplicated rules |
| ⭐ Combine | feature modules outside, rings inside |

## Deployment styles
| Style | Strength | Cost |
|:--|:--|:--|
| Unstructured monolith | simple start | ball of mud |
| ⭐ Modular monolith | simple ops, local transactions | needs enforced boundaries |
| ⭐ Microservices | independent deploy/scale, isolation | network, data, ops cost |
| Macroservices | fewer, larger services | still distributed |
| Serverless | managed scaling, pay per use | cold starts, limits, lock-in |

## When to split into services
| Signal | ✓ / ✗ |
|:--|:--|
| ⭐ Different resource/scaling needs | ✓ |
| Team friction on one deployable | ✓ |
| Isolation (security, compliance) | ✓ |
| Different tech needs | ✓ |
| Stable module API for months | ✓ |
| "Cleaner code", trends | ✗ |
| Boundaries not understood yet | ✗ |
| ⭐ Distributed monolith signs | shared tables, deploy together, sync chains |

## Event-driven
| Concept | Meaning |
|:--|:--|
| ⭐ Event | past-tense fact |
| Event notification | IDs only, consumers fetch |
| Event-carried state | data in the event |
| ⭐ Choreography | react to events, no coordinator |
| ⭐ Orchestration | coordinator drives steps |
| Broker | BullMQ, SQS/SNS/EventBridge, Kafka |
| Eventual consistency | consumers catch up |
| ⭐ Outbox | events only for committed changes |

## CQRS and event sourcing
| Style | Use when |
|:--|:--|
| ⭐ CQRS-lite | query code separate from domain writes |
| CQRS + read models | heavy reads, dashboards, search |
| Event sourcing | audit/temporal needs, complex workflows |
| Projection | read model built from events |
| Snapshot | speed up replays |
| Upcaster | migrate old event versions |

## Edge and delivery styles
| Style | Use |
|:--|:--|
| API gateway | routing, auth, rate limits for many services |
| BFF | per-client API layer; Next.js server for the web UI |
| Serverless functions | spiky, event-triggered work |
| Sidecar | cross-cutting concerns next to the app |
| Service mesh | service-to-service traffic, mTLS (also seen) |

## Decisions
| Tool | Use |
|:--|:--|
| ⭐ ADR | context, decision, consequences, alternatives |
| ⭐ Fitness function | automated check of an architectural property |
| Quality attribute scenario | measurable requirement |
| C4 diagrams | context, containers, components, code |
| Architecture review | revisit decisions against forces |

## Combining styles (the shop)
| Question | Answer |
|:--|:--|
| Tiers | browser · CDN · Next.js · Express API · Postgres/Redis · workers |
| Deployables | modular monolith (API + worker processes) |
| Modules | DDD bounded contexts |
| Inside modules | clean/hexagonal |
| Features | modules + read slices |
| Communication | calls for queries, outbox events for side effects |
| Reads | CQRS-lite, a few read models |
| UI | components + hooks (MVVM), routes as controllers (MVC) |
| ⭐ Rule | DDD decides what the modules are; clean decides dependency direction |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Layers called tiers | wrong scaling decisions | name them precisely |
| Domain imports the ORM | core coupled to infrastructure | dependency inversion |
| Clean template for CRUD | ceremony | vertical slices |
| Ports for the database "to switch later" | unused abstraction | ports at real boundaries |
| Microservices first | ops cost, unknown boundaries | modular monolith |
| Shared tables between services | distributed monolith | data ownership |
| Synchronous chains | availability multiplies down | fewer hops, events |
| Event sourcing for CRUD | complexity without benefit | state tables + audit log |
| Rules in BFFs/Server Actions | duplicated logic | rules in the API domain |
| Style debates as either/or | circular arguments | one question per style |

## Sources
| Source | Link |
|:--|:--|
| Architecture styles (Microsoft) | https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/ |
| Clean architecture | https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html |
| Hexagonal architecture | https://alistair.cockburn.us/hexagonal-architecture/ |
| GUI architectures | https://martinfowler.com/eaaDev/uiArchs.html |
| Vertical slice architecture | https://www.jimmybogard.com/vertical-slice-architecture/ |
| Microservices | https://martinfowler.com/articles/microservices.html |
| CQRS | https://martinfowler.com/bliki/CQRS.html |
