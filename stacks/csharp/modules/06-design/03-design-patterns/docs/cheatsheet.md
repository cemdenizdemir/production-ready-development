---
title: Design Patterns cheatsheet
tech: C# 14, ASP.NET Core 10
version: C# 14 / .NET 10, React 19.2 (frontend patterns)
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Design Patterns cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## What a pattern is
| Part | Meaning | Note |
|:--|:--|:--|
| ⭐ problem + forces | recurring situation, pressures | start here |
| ⭐ solution | named structure | |
| ⭐ consequences | gains and costs | indirection |
| vocabulary | shared names | reviews, design docs |

## Creational
| Pattern | Use when | Avoid when / smell |
|:--|:--|:--|
| ⭐ static factory method | validated/named construction | trivial constructors |
| factory method (GoF) | subclass picks product | rarely in modern C# |
| ⭐ abstract factory | families of related objects | one product; use keyed DI |
| ⭐ builder | many optional parts, test data | 3-property types (use `required`) |
| prototype | copy and tweak | — (records `with`) |
| ⭐ singleton | one shared stateless instance via DI | static `Instance`, mutable state |
| ⭐ DI container | object graphs and lifetimes | service locator use |

## Structural
| Pattern | Use when | Avoid when / smell |
|:--|:--|:--|
| ⭐ adapter | foreign API to your interface | APIs already match |
| ⭐ facade | simple entry to a subsystem | one caller, two methods |
| ⭐ decorator | add caching/logging/retries around calls | stacking what middleware does |
| ⭐ proxy | lazy, remote, or protected access | |
| composite | part–whole trees | flat lists |
| bridge | two dimensions vary independently | one dimension |
| flyweight | many objects share immutable state | premature memory tuning |

## Behavioral
| Pattern | Use when | Avoid when / smell |
|:--|:--|:--|
| ⭐ strategy | swap algorithms | one variant forever |
| ⭐ observer | many listeners for an event | cross-module C# `event`s |
| ⭐ command | queue, audit, retry, undo requests | simple direct calls |
| state | lifecycle with transitions | 2 states |
| template method | framework skeletons | your own deep hierarchies |
| chain of responsibility | pipelines of handlers | fixed 2-step logic |
| iterator | traverse/stream data | — (`yield`) |
| mediator | decouple many collaborators | hiding simple calls |
| visitor | operations over hierarchies | modern C# (use `switch`) |

## Modern C# replacements
| Classic | Modern form | Note |
|:--|:--|:--|
| strategy class | `Func<...>` | small, no deps |
| command class | `record` command | |
| visitor | `switch` expression + sealed records | |
| builder | `required` + `init` + `with` | prod types |
| singleton | `AddSingleton<T>()` | |
| factory | DI factory delegate, `IXxxFactory` from .NET | |
| observer | domain events + handlers | outbox across modules |

## Application patterns
| Pattern | Use when | Avoid when / smell |
|:--|:--|:--|
| ⭐ repository (per aggregate) | enforce loading/invariants | generic `IRepository<T>` |
| ⭐ unit of work | commit changes once | wrapping `DbContext` |
| ⭐ data mapper | POCO domain, persistence outside | — (EF Core) |
| active record | | `order.Save()` in .NET |
| ⭐ specification | one rule in queries and memory | single-use rules |
| query object / read model | read paths | |

## Resilience and integration
| Pattern | Use when | In this stack |
|:--|:--|:--|
| ⭐ retry | transient failures | Polly / resilience handler |
| ⭐ circuit breaker | failing dependency | Polly |
| ⭐ bulkhead | isolate resources | limiters, separate pools |
| timeout | bound waits | Polly, request timeouts |
| ⭐ outbox | reliable events | EF Core + publisher |
| inbox | idempotent consumers | `ProcessedMessages` |
| ⭐ saga | multi-step, compensations | orchestrated state |
| ⭐ anti-corruption layer | foreign/legacy models | adapters + translation |
| competing consumers | scale processing | Service Bus |
| claim check | large payloads | Blob + reference |

## Frontend patterns
| Pattern | Use when | Smell |
|:--|:--|:--|
| ⭐ container / presentational | data vs rendering | fetch + markup in one 400-line file |
| ⭐ custom hooks | reusable stateful logic | copy-pasted effects |
| ⭐ composition (children) | flexible UIs | boolean prop explosion |
| compound components | shared implicit state | single-use components |
| ⭐ providers | app-wide state/services | provider for one component |
| server/client split | Next.js App Router | `"use client"` everywhere |

## Anti-patterns
| Anti-pattern | Symptom | Way out |
|:--|:--|:--|
| ⭐ god object | does everything | split by responsibility |
| ⭐ service locator | `sp.GetService<T>()` in logic | constructor injection |
| ⭐ singleton abuse | static mutable state | DI, options |
| ⭐ pattern-itis | Factory/Provider/Manager names | simplest design |
| ⭐ big ball of mud | no boundaries | modules + architecture tests |
| anemic domain | setters + service rules | behaviour on entities |
| generic repository | `GetAll()` everywhere | DbSet / specific repos |
| magic strings | stringly typed | enums, options, `nameof` |
| golden hammer | one tool for all | choose per problem |

## Choosing
| Step | Question | Note |
|:--|:--|:--|
| ⭐ problem first | what change hurts? | |
| ⭐ simplest thing | function / switch / class? | |
| rule of three | real repetition? | |
| ⭐ refactor towards | with tests | separate PR |
| refactor away | forces gone? | |
| team fluency | maintainable? | |

## Built into .NET
| Feature | Pattern | Note |
|:--|:--|:--|
| ⭐ middleware | chain of responsibility | |
| ⭐ `DelegatingHandler` | decorator | HttpClient |
| ⭐ `IOptions<T>` family | options | validation, reload |
| ⭐ DI + factories | factory, singleton | `IHttpClientFactory` |
| `IEnumerable<T>` + `yield` | iterator | |
| `DbContext` / `DbSet<T>` | unit of work, repository | |
| `BackgroundService` | template method | |
| filters | chain / decorator | endpoint, MVC |
| `IObservable<T>` / events | observer | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| pattern before problem | complexity | refactor towards |
| static singletons | captive deps, tests | DI lifetimes |
| generic repository | unbounded queries | specific repos |
| C# events across modules | lifetime leaks | domain events |
| visitor in modern C# | boilerplate | pattern matching |
| stacked decorators | hidden behaviour | pipelines, middleware |
| own middleware/options frameworks | reinventing | built-ins |
| boolean-prop components | combinatorics | composition |

## Sources
| Source | Link |
|:--|:--|
| GoF patterns in C# | https://refactoring.guru/design-patterns/csharp |
| PoEAA catalog | https://martinfowler.com/eaaCatalog/ |
| Cloud design patterns | https://learn.microsoft.com/azure/architecture/patterns/ |
| Options pattern | https://learn.microsoft.com/aspnet/core/fundamentals/configuration/options |
| Middleware | https://learn.microsoft.com/aspnet/core/fundamentals/middleware/ |
| patterns.dev | https://www.patterns.dev/ |
| Service locator anti-pattern | https://blog.ploeh.dk/2010/02/03/ServiceLocatorisanAnti-Pattern/ |
| Specification (Evans/Fowler) | https://martinfowler.com/apsupp/spec.pdf |
