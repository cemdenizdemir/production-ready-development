---
title: Design Patterns cheatsheet
tech: TypeScript 6 (strict), Node.js 26
version: TypeScript 6.0, Node.js 26 LTS, React 19.2, Drizzle ORM 0.45
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Design Patterns cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Pattern anatomy
| Part | Meaning |
|:--|:--|
| Name | shared vocabulary |
| Problem | recurring situation |
| Forces | competing concerns |
| Solution | roles and relationships |
| ⭐ Consequences | trade-offs and costs |

## Creational
| Pattern | Use when | TypeScript form |
|:--|:--|:--|
| ⭐ Factory function | hide construction, validate config | `createX(opts)` |
| Factory method | caller decides what to create | function parameter |
| Abstract factory | consistent families (prod/local/test) | object of factories |
| ⭐ Builder | stepwise, validated construction | fluent builder or options object |
| Prototype | clone a template | `structuredClone`, spread |
| Singleton | one instance | create at the composition root, avoid global access |
| Object pool | reuse expensive objects | `pg` pool, worker pool |
| ⭐ Dependency injection | decouple creation from use | parameters + composition root |
| Service locator | — | avoid: hidden dependencies |

## Structural
| Pattern | Use when | Example |
|:--|:--|:--|
| ⭐ Adapter | interface mismatch | Stripe → `PaymentGateway` |
| ⭐ Facade | simplify a subsystem | `checkout()` |
| ⭐ Decorator | add behavior, same interface | retry, timeout, cache, metrics |
| Proxy | control access, same interface | lazy load, auth, CloudFront → S3 |
| Composite | uniform trees | bundles, categories, component trees |
| Bridge | two independent dimensions | notification type × channel |
| Flyweight | share immutable state | interned values, cached `Intl` formatters |

## Adapter vs decorator vs proxy vs facade
| Pattern | Interface | Purpose |
|:--|:--|:--|
| Adapter | changes it | make it fit |
| Decorator | same | add behavior |
| Proxy | same | control access |
| Facade | new, simpler | hide complexity |

## Behavioral
| Pattern | Use when | Example |
|:--|:--|:--|
| ⭐ Strategy | swappable algorithms | shipping, pricing, backoff |
| ⭐ Observer | notify many listeners | `EventEmitter`, domain events |
| ⭐ Command | requests as data | BullMQ jobs, actions |
| ⭐ State | rules depend on state | order lifecycle transition table |
| Template method | fixed steps, variable parts | import pipelines |
| ⭐ Chain of responsibility | handlers pass along | Express middleware |
| Iterator | traverse lazily | generators, `for await`, pagination |
| Mediator | coordinate many objects | form coordination, event bus |
| Memento | save/restore | undo, drafts |
| Visitor | operations over a type family | exhaustive `switch` over a union |
| Interpreter | small language | rule DSLs (rarely needed) |

## JavaScript built-ins that are patterns
| Built-in | Pattern |
|:--|:--|
| `EventEmitter`, `EventTarget` | observer |
| `function*`, `Symbol.asyncIterator` | iterator |
| `Proxy`, `Reflect` | proxy |
| `AbortController` / `AbortSignal` | cancellation token (observer) |
| `Promise.all` / `allSettled` | composite of tasks |
| `Intl.*Format` instances | flyweight when cached |
| Middleware arrays | chain of responsibility |

## Application patterns
| Pattern | Use when |
|:--|:--|
| ⭐ Repository | collection-like access to aggregates |
| ⭐ Unit of work | several changes commit together (`tx`) |
| ⭐ Data mapper | domain separate from tables (Drizzle) |
| Active record | simple CRUD objects that save themselves (Mongoose) |
| Table data gateway | thin per-table access |
| ⭐ Specification | reusable, composable rules |
| Query object / read model | screen-specific reads |
| Service layer / use case | workflows |
| DTO + mapper | boundary shapes |
| Identity map | one object per row (ORMs) |
| Lazy load | defer loading (watch N+1) |

## Resilience and integration patterns
| Pattern | Purpose |
|:--|:--|
| ⭐ Timeout | bound waiting |
| ⭐ Retry + backoff + jitter | survive transient failures |
| ⭐ Circuit breaker | fail fast on broken dependencies |
| Bulkhead | isolate resources |
| Load shedding | protect under overload |
| ⭐ Cache-aside | read offloading |
| ⭐ Transactional outbox | no dual writes |
| ⭐ Idempotent consumer | safe redelivery |
| Saga | multi-step consistency with compensation |
| Anti-corruption layer | protect the model from external ones |
| Strangler fig | incremental replacement |
| Sidecar | cross-cutting concerns next to the app (Alloy) |

## Frontend patterns (React)
| Pattern | Use |
|:--|:--|
| ⭐ Container / presentational | data vs display |
| ⭐ Custom hooks | reusable behavior |
| ⭐ Composition (children, slots) | flexible layouts |
| Compound components | shared implicit state |
| Provider (context) | app-wide dependencies |
| Render props | library APIs (mostly replaced by hooks) |
| HOCs | legacy |
| Server/client split | Next.js data on server, small client islands |
| Controlled vs uncontrolled inputs | forms |

## Anti-patterns
| Anti-pattern | Fix |
|:--|:--|
| ⭐ God object | split responsibilities |
| ⭐ Service locator | inject |
| Singleton abuse | composition root |
| ⭐ Pattern-itis | inline, delete |
| Anemic model (rich domain) | move rules into the model |
| Big ball of mud | modules + boundaries |
| Lava flow | test, then delete |
| Golden hammer | choose per problem |
| Leaky abstraction | redesign interface |
| Premature optimization | measure first |
| Generic repository for everything | per-aggregate repositories |

## Choosing
| Step | Question |
|:--|:--|
| 1 | what is the force: variation, coupling, lifecycle, failure? |
| 2 | does a function, union, or parameter solve it? |
| 3 | is the pain repeating? refactor towards the pattern |
| 4 | did the variation disappear? refactor away |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Global singletons | hidden state, test coupling | composition root |
| Adapter returns vendor types | core still coupled | core types |
| Decorator changes semantics | surprises callers | same contract |
| Decorator order ignored | wrong caching/timeout behavior | order deliberately |
| `Promise.race` timeouts | inner call keeps running | `AbortSignal` |
| In-memory events for must-happen work | lost on crash | outbox + queue |
| Status booleans | invalid combinations | state machine |
| Visitor class hierarchies in TS | ceremony | exhaustive switch |
| `Proxy` in business logic | hidden behavior | explicit wrappers |
| Strategy with one implementation | indirection | wait for variation |

## Sources
| Source | Link |
|:--|:--|
| refactoring.guru patterns | https://refactoring.guru/design-patterns |
| PoEAA catalog | https://martinfowler.com/eaaCatalog/ |
| patterns.dev | https://www.patterns.dev/ |
| Cloud design patterns | https://learn.microsoft.com/en-us/azure/architecture/patterns/ |
| Composition root | https://blog.ploeh.dk/2011/07/28/CompositionRoot/ |
| Node.js events | https://nodejs.org/api/events.html |
| Anemic domain model | https://martinfowler.com/bliki/AnemicDomainModel.html |
