---
title: Paradigms & OOP cheatsheet
tech: C# 14
version: C# 14 / .NET 10 (C# 15 / .NET 11 noted where relevant)
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
---
# Paradigms & OOP cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Paradigms
| Paradigm | Use when | Smell |
|:--|:--|:--|
| ⭐ imperative | simple step-by-step logic, hot loops | long methods mutating many variables |
| procedural | small helpers, scripts | static god-helpers with hidden state |
| ⭐ object-oriented | identity, lifecycles, protected state, varying collaborators | anemic classes with public setters |
| ⭐ functional | calculations, transformations, rules | monad chains nobody can read |
| ⭐ declarative | queries (LINQ, SQL), config, IaC | clever LINQ hiding N+1 queries |
| reactive | event streams over time | Rx for one-off async calls |

## OOP pillars
| Pillar | C# tools | Smell when missing/overused |
|:--|:--|:--|
| ⭐ encapsulation | private fields, private setters, methods | `order.Status = "x"` from services |
| ⭐ abstraction | interfaces, public API | interface per class, one implementation |
| ⭐ inheritance | `: Base`, `virtual`, `override` | deep hierarchies, fragile base class |
| ⭐ polymorphism | interfaces, overrides, generics, patterns | `switch` on type strings everywhere |

## Class features
| Feature | Use when | Avoid when |
|:--|:--|:--|
| ⭐ `sealed` | default for classes | designing a real extension point |
| ⭐ `internal` | hide module internals | type is the module's contract |
| `file` | file-local helper types | |
| ⭐ `{ get; private set; }` | state changed by methods | DTOs |
| ⭐ `init` / `required` | set-once construction | values that change |
| `field` keyword | validation in auto-property | C# 13 or older |
| `readonly` fields / structs | immutability | |
| `static` class | pure helpers | hidden mutable static state |
| `abstract` / `virtual` | framework-style extension points | sharing two helpers |
| primary constructors | DI services, small types | complex validation |
| extension members | add APIs to types you don't own | hiding domain logic |

## Composition vs inheritance
| Choose | Use when | Smell |
|:--|:--|:--|
| ⭐ composition | variations combine; behaviour swaps | — |
| inheritance | stable is-a, framework bases | `EmailAndSmsService : EmailService` |
| decorator | add behaviour around a call | subclass to add logging |
| delegation | reuse another object's behaviour | protected helpers in a base class |

## Interfaces vs abstract classes
| Feature | Interface | Abstract class |
|:--|:--|:--|
| ⭐ role | contract | partial implementation |
| multiple | yes | one base |
| state / constructors | no | yes |
| default methods | yes (C# 8+, for evolving APIs) | n/a |
| static abstract members | yes | no |

## Polymorphism without inheritance
| Mechanism | Use when | Example |
|:--|:--|:--|
| ⭐ interfaces | runtime variation, DI, fakes | `IShippingRateProvider` |
| ⭐ generics + constraints | reuse across types | `where T : IComparable<T>` |
| static abstract members | type-level operations | `T.Parse(...)` with `IParsable<T>` |
| ⭐ delegates | small strategies | `Func<Money, Money>` |
| dispatch table | many named variants | `Dictionary<string, Func<...>>` |
| pattern matching | closed set of types | `switch` expression |
| keyed DI | choose by key | `[FromKeyedServices("stripe")]` |

## Functional essentials
| Idea | C# | Smell |
|:--|:--|:--|
| ⭐ pure function | `static` calc, inputs → output | reads `DateTime.Now`, config, DB |
| ⭐ immutability | `record`, `with`, `readonly`, `ImmutableArray<T>` | shared mutable objects |
| ⭐ higher-order functions | `Func<>`, LINQ | — |
| ⭐ closures | lambdas capturing locals | capturing `DbContext` in long-lived lambdas |
| composition | LINQ pipelines, `f(g(x))` | 15-step chains |
| side effects at edges | `TimeProvider`, results out | I/O in calculations |

## Algebraic data types
| Kind | C# 14 | Note |
|:--|:--|:--|
| ⭐ product | `record Address(string Street, string City)` | AND |
| ⭐ sum | abstract record, private ctor, sealed nested cases | OR, closed set |
| matching | `switch` expression, property patterns | CS8509 warns |
| C# 15 unions | `public union Pet(Cat, Dog);` | .NET 11, exhaustive |
| illegal states unrepresentable | case-specific fields | no "nullable everything" |

## Error handling
| Style | Use when | Avoid when |
|:--|:--|:--|
| ⭐ exceptions | bugs, infrastructure failures, broken invariants | expected outcomes, flow control |
| ⭐ `Result<T>` | expected business outcomes | truly unexpected failures |
| `TryX(out T)` | parse-like operations | needing a reason |
| nullable return | "maybe absent", no reason | callers need why |
| global handler | one place to map exceptions | catching everywhere |

## Entities, values, DTOs
| Kind | Equality | C# |
|:--|:--|:--|
| ⭐ entity | by ID | `sealed class`, private setters |
| ⭐ value object | by value | `readonly record struct`, validated ctor |
| ⭐ DTO | by value | `sealed record`, data only |
| strongly typed ID | by value | `readonly record struct OrderId(long Value)` |
| event / message | by value | immutable record |

## Choosing a style
| Situation | Prefer | Note |
|:--|:--|:--|
| ⭐ rules and calculations | pure functions, values | functional core |
| ⭐ I/O, orchestration | use cases, DI | imperative shell |
| identity + lifecycle | entity class | |
| boundaries | DTO records | |
| simple CRUD | records + DbContext | skip rich model |
| hot loops | local mutation | measure |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| public setters on entities | invalid states | methods |
| mutable shared values | spooky changes | immutable values |
| `DateTime.Now` in logic | flaky tests | `TimeProvider` |
| string statuses | typos, unhandled states | enums / sum types |
| exceptions by message text | breaks on rewording | results + codes |
| entity equality by reference | duplicates | equality by ID |
| interface for everything | noise | interfaces at boundaries |
| deep inheritance | fragile | composition |
| closures capturing loop/async state | surprises, leaks | copy locals, short lifetimes |
| entities as API responses | data leaks | DTOs |

## Sources
| Source | Link |
|:--|:--|
| C# docs | https://learn.microsoft.com/dotnet/csharp/ |
| OOP in C# | https://learn.microsoft.com/dotnet/csharp/fundamentals/tutorials/oop |
| Pattern matching | https://learn.microsoft.com/dotnet/csharp/fundamentals/functional/pattern-matching |
| Records | https://learn.microsoft.com/dotnet/csharp/language-reference/builtin-types/record |
| What's new in C# 14 | https://learn.microsoft.com/dotnet/csharp/whats-new/csharp-14 |
| C# 15 union types | https://devblogs.microsoft.com/dotnet/csharp-15-union-types/ |
| Value objects (.NET guide) | https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/implement-value-objects |
| Designing with types | https://fsharpforfunandprofit.com/series/designing-with-types/ |
