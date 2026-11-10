---
title: Design Principles cheatsheet
tech: C# 14
version: C# 14 / .NET 10
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Design Principles cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Coupling and cohesion
| Measure | Good sign | Smell |
|:--|:--|:--|
| ⭐ low coupling | narrow dependencies on stable contracts | 10-dependency constructors, shared tables |
| ⭐ high cohesion | things that change together live together | feature spread over many folders |
| data coupling | pass only needed data | passing whole objects for one field |
| message coupling | events between modules | synchronous call chains |
| control coupling | | `bool` flags steering behaviour |
| content coupling | | reading another module's internals |

## SOLID
| Principle | Use when | Smell / overuse |
|:--|:--|:--|
| ⭐ SRP | a class changes for several actors | "SRP" splitting into 15 tiny classes |
| ⭐ OCP | the same variation keeps arriving | extension points nobody uses |
| LSP | designing hierarchies/implementations | `NotSupportedException` in overrides |
| ISP | many clients use different parts | one-method interfaces everywhere |
| ⭐ DIP | core depends on vendors/frameworks | interface over your own `DbContext` |

## SRP signals
| Signal | Means | Fix |
|:--|:--|:--|
| different stakeholders request changes | several responsibilities | split by actor |
| disjoint field use | two classes in one | extract class |
| "And/Manager/Helper" names | unclear responsibility | rename/split |
| frequent merge conflicts in one file | hot spot | split by change |

## OCP tools
| Tool | Use when | Example |
|:--|:--|:--|
| ⭐ strategy interface + DI | variants with behaviour | `IShippingRateProvider` |
| dispatch table | simple named variants | `Dictionary<string, Func<...>>` |
| ⭐ events | new reactions | `OrderPlaced` handlers |
| data-driven rules | variants are data | zones, tiers in config/DB |
| sum types | closed known set | `switch` on sealed records |

## LSP checks
| Check | Violation | Note |
|:--|:--|:--|
| preconditions | subtype demands more | stricter validation |
| postconditions | subtype guarantees less | stale/partial results |
| invariants | subtype breaks rules | |
| exceptions | new unexpected exceptions | `NotSupportedException` |
| callers type-check | `if (x is Special)` | |

## ISP and DIP
| Practice | How | Note |
|:--|:--|:--|
| ⭐ client-specific interfaces | reader/writer, queries/commands | |
| `IReadOnlyList<T>` / `IReadOnlyCollection<T>` | read-only views | .NET ISP |
| ⭐ core owns the port | interface in core, adapter outside | dependency rule |
| domain language in ports | `Result<PaymentId>`, not vendor types | |
| DIP ≠ DI | ownership vs wiring | |

## DRY, KISS, YAGNI
| Principle | Use when | Misuse |
|:--|:--|:--|
| ⭐ DRY | same knowledge in several places | merging look-alike code with different reasons to change |
| ⭐ KISS | always the default | refusing any abstraction |
| ⭐ YAGNI | speculative features/abstractions | ignoring committed requirements |
| rule of three | extract on the third occurrence | |
| wrong abstraction | | flags and special cases in shared code |

## Object conversations
| Principle | Means | Smell |
|:--|:--|:--|
| ⭐ Law of Demeter | talk to direct collaborators | `a.B.C.D.Do()` on behaviour objects |
| ⭐ tell, don't ask | object decides and protects rules | getters + decisions outside |
| ⭐ CQS | commands change, queries read | `GetX()` that writes |
| fluent APIs / LINQ | allowed | |

## Separation of concerns
| Principle | Means | In C# |
|:--|:--|:--|
| ⭐ separation of concerns | HTTP, rules, data apart | endpoints / domain / data |
| ⭐ information hiding | hide changeable decisions | `internal`, modules, ports |
| policy vs detail | business above infrastructure | dependency rule |
| cross-cutting | around code, not in it | middleware, filters, decorators |

## Code smells
| Smell | Refactoring | Note |
|:--|:--|:--|
| ⭐ long method | extract method | |
| ⭐ large class | extract class | by reason to change |
| ⭐ long parameter list | parameter object | records |
| ⭐ feature envy | move method | |
| primitive obsession | value object | `Money`, `Email` |
| ⭐ repeated switch | polymorphism / table / sum type | |
| shotgun surgery | move together | |
| divergent change | split | |
| data clumps | introduce type | |
| speculative generality | inline, delete | YAGNI |
| dead code | delete | IDE0051/IDE0052 |
| temporal coupling | enforce order in constructor | |

## Safe refactoring
| Practice | How | Note |
|:--|:--|:--|
| ⭐ characterisation tests | pin current behaviour | before changes |
| ⭐ small steps | compile + test each step | commit often |
| ⭐ IDE refactorings | rename, extract, change signature | |
| ⭐ tidy first | refactor PR, then feature PR | |
| preparatory refactoring | make the change easy | Kent Beck |
| hotspots | churn × complexity | prioritise |
| analyzers | CA1502 complexity, CA1506 coupling | metrics |

## Review phrasing
| Instead of | Write | Note |
|:--|:--|:--|
| "violates SOLID" | the reason to change + consequence + alternative | |
| "too complex" | specific simplification | |
| "use pattern X" | the variation it solves | |
| blocking? | label it | Conventional Comments |

## Over-engineering signs
| Sign | Do instead | Note |
|:--|:--|:--|
| ⭐ `IFoo`/`Foo` pairs everywhere | concrete classes | interfaces at boundaries |
| ⭐ frameworks for 2 cases | sum type, simple code | |
| forwarding layers | remove the layer | |
| config for constants | constants | |
| pattern names in class names | name by domain role | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| splitting by line count | fragmentation | split by reason to change |
| abstraction on first occurrence | wrong abstraction | rule of three |
| flags in shared methods | control coupling | separate methods |
| subtype throwing NotSupported | LSP break | narrower interface |
| vendor types in core | upgrade ripple | ports |
| deep property chains | coupling to structure | tell, don't ask |
| refactor + feature mixed | hidden behaviour change | separate PRs |
| refactoring without tests | regressions | characterisation tests |

## Sources
| Source | Link |
|:--|:--|
| .NET architectural principles | https://learn.microsoft.com/dotnet/architecture/modern-web-apps-azure/architectural-principles |
| Refactoring catalog | https://refactoring.com/catalog/ |
| SRP (Uncle Bob) | https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html |
| The wrong abstraction | https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction |
| Yagni | https://martinfowler.com/bliki/Yagni.html |
| TellDontAsk | https://martinfowler.com/bliki/TellDontAsk.html |
| Code smells | https://refactoring.guru/refactoring/smells |
| Code metrics | https://learn.microsoft.com/visualstudio/code-quality/code-metrics-values |
