---
title: Design Principles & SOLID cheatsheet
tech: TypeScript 6 (strict)
version: TypeScript 6.0, Node.js 26 LTS, ESLint 10
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Design Principles & SOLID cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Core measures
| Measure | Goal | Note |
|:--|:--|:--|
| ⭐ Coupling | low | dependency on others' details |
| ⭐ Cohesion | high | parts belong together |
| Connascence | weaker, more local | name → type → meaning → position → algorithm… |
| Deep modules | simple interface, much behind it | Ousterhout |

## Coupling types (worst → best)
| Type | Example |
|:--|:--|
| Content | touching another module's internals or tables |
| Common | shared mutable globals |
| External | shared formats/devices |
| Control | flag arguments |
| Stamp | passing whole objects for two fields |
| ⭐ Data | only needed values |
| ⭐ Message | events, narrow interfaces |

## Cohesion types (worst → best)
| Type | Example |
|:--|:--|
| Coincidental | `utils.ts` |
| Logical | all handlers in one file |
| Temporal | "startup things" |
| Procedural / communicational | steps that share data |
| Sequential | output of one feeds the next |
| ⭐ Functional | everything for one responsibility |

## SOLID
| Principle | One line | Smell when violated |
|:--|:--|:--|
| ⭐ S — Single Responsibility | one reason (actor) to change | divergent change |
| ⭐ O — Open/Closed | extend by adding, not editing | growing `switch` over variants |
| L — Liskov Substitution | implementations keep the contract | "not supported" throws, type checks on subtypes |
| I — Interface Segregation | small client-specific interfaces | fat interfaces, unused methods |
| ⭐ D — Dependency Inversion | core owns abstractions, details implement | core imports SDKs and frameworks |

## LSP rules
| A substitute must not | Example |
|:--|:--|
| strengthen preconditions | require non-empty input |
| weaken postconditions | return `undefined` instead of a value |
| throw unexpected errors | `set()` throws in a "cache" |
| break invariants | Square/Rectangle |
| change side effects/timing unexpectedly | network calls in an "in-memory" store |

## DIP vs DI vs IoC
| Term | Meaning |
|:--|:--|
| ⭐ Dependency inversion | abstraction owned by the high-level side |
| ⭐ Dependency injection | implementation passed in (parameters, constructor) |
| Inversion of control | framework calls your code |
| Composition root | one place wires implementations |
| Service locator | global lookup of dependencies (avoid) |

## Simplicity principles
| Principle | Meaning | Misuse |
|:--|:--|:--|
| ⭐ DRY | one home per piece of knowledge | merging look-alike code |
| ⭐ KISS | simplest design that works | skipping validation/tests |
| ⭐ YAGNI | no speculative features | skipping current needs |
| Rule of three | abstract on the third case | — |
| AHA | duplication over the wrong abstraction | — |
| Beck's simple design | tests pass · intention · no duplication · fewest elements | — |

## Object interaction principles
| Principle | Meaning |
|:--|:--|
| ⭐ Law of Demeter | talk to friends, not strangers' internals |
| ⭐ Tell, don't ask | let the object enforce its rules |
| ⭐ CQS | commands change state, queries return data |
| Least astonishment | behave as readers expect |
| Fail fast | reject invalid states early |
| Information hiding | hide decisions likely to change |
| Separation of concerns | HTTP, rules, persistence, presentation apart |
| Policy vs detail | rules don't depend on mechanisms |
| Hollywood principle | "don't call us, we'll call you" (IoC) |
| Postel's law | liberal in input, strict in output (careful with security) |

## Code smells → refactorings
| Smell | Refactoring |
|:--|:--|
| ⭐ Long function | Extract Function |
| ⭐ God object | Extract Class / split module |
| Long parameter list | Parameter Object |
| ⭐ Feature envy | Move Function |
| ⭐ Shotgun surgery | consolidate knowledge |
| Divergent change | split by reason to change |
| ⭐ Primitive obsession | value object, branded type |
| Data clumps | value object |
| ⭐ Switch on type | polymorphism / dispatch table |
| Message chains | Hide Delegate |
| Speculative generality | Inline, Collapse Hierarchy |
| Flag argument | split function |
| Comments for unclear code | Rename, Extract |
| Dead code | Delete |
| Temporary field | Extract Class |
| Middle man | Remove Middle Man |

## Refactoring practice
| Practice | Detail |
|:--|:--|
| ⭐ Characterization tests | pin current behavior first |
| ⭐ Small green steps | commit often |
| ⭐ Separate refactor PRs | no behavior changes mixed in |
| IDE refactorings | rename, extract, move, inline |
| Prefactoring | make the change easy, then make it |
| Strangler | new beside old, switch, delete |
| Boy scout rule | leave code a bit better |

## Lint support
| Rule | Flags |
|:--|:--|
| `complexity` | cyclomatic complexity |
| `max-depth` | nesting |
| `max-params` | long parameter lists |
| `max-lines-per-function` | long functions |
| `no-restricted-imports` | dependency direction, boundaries |
| `@typescript-eslint/switch-exhaustiveness-check` | missing union cases |

## Principles in review
| Weak comment | Strong comment |
|:--|:--|
| "violates SRP" | names the two reasons to change and where to move code |
| "use an interface" | names the test or swap that needs it |
| "too complex" | names the nested rule and the extraction |
| "not DRY" | names the rule that disagrees between copies |
| ⭐ Over-engineering | is a finding: abstractions without a second use |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| SRP as one method per class | fragmentation | one reason to change |
| Interface per class | ceremony | ports at real boundaries |
| DRYing look-alike code | coupled unrelated changes | duplicate until the third real case |
| Plugin systems for imagined needs | months lost | YAGNI |
| Port mirrors the vendor's API | core still coupled | core vocabulary |
| Fat repository interfaces | every client depends on everything | role interfaces |
| Refactoring without tests | silent behavior changes | characterization tests |
| Big-bang rewrites | never finish | incremental refactoring |
| Getters with side effects | surprises | CQS |

## Sources
| Source | Link |
|:--|:--|
| SRP (Robert C. Martin) | https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html |
| Refactoring catalog | https://refactoring.com/catalog/ |
| Code smells | https://refactoring.guru/refactoring/smells |
| The wrong abstraction | https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction |
| Tell don't ask | https://martinfowler.com/bliki/TellDontAsk.html |
| Command query separation | https://martinfowler.com/bliki/CommandQuerySeparation.html |
| Connascence | https://connascence.io/ |
