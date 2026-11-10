---
title: Paradigms & OOP cheatsheet
tech: TypeScript 6 (strict)
version: TypeScript 6.0 (erasableSyntaxOnly), Node.js 26 LTS
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
---
# Paradigms & OOP cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Paradigms
| Paradigm | Idea | Use when |
|:--|:--|:--|
| Imperative | step-by-step state changes | hot loops, low-level control |
| Procedural | procedures over data | scripts, simple flows |
| ⭐ Object-oriented | state + behavior behind an interface | identity, lifecycle, invariants |
| ⭐ Functional | pure functions, immutable data | transformations, decisions |
| ⭐ Declarative | describe what, not how | SQL, JSX, Zod, Terraform |
| Reactive | values over time | UIs, live data |
| Event-driven | react to events | I/O, integration |
| Logic | facts and rules | rule engines (also seen: Prolog, Datalog) |

## Choosing a style
| Situation | Prefer |
|:--|:--|
| ⭐ Rules + identity + lifecycle | class with `#private` state, or closure |
| ⭐ Data in → data out | pure function |
| ⭐ One of several shapes | discriminated union |
| Swappable behavior | interface or function type |
| Resources (pool, server) | object with `start`/`close` |
| ⭐ Business logic + I/O | functional core, imperative shell |

## OOP pillars
| Pillar | Meaning | Tool |
|:--|:--|:--|
| ⭐ Encapsulation | hide state, change via methods | `#private`, closures |
| ⭐ Abstraction | expose what, hide how | interfaces, small APIs |
| Inheritance | specialize a base | `extends`, `super` |
| ⭐ Polymorphism | one interface, many implementations | interfaces, overriding |

## Composition vs inheritance
| Aspect | Inheritance | Composition |
|:--|:--|:--|
| Relationship | is-a | has-a / uses-a |
| Variation | one axis, fixed | many axes, runtime |
| Coupling | to base internals | to small interfaces |
| Risk | fragile base class | more wiring |
| ⭐ Default | stable shallow hierarchies, errors | business variation |

## TypeScript class features (Node type stripping)
| Feature | Status |
|:--|:--|
| ⭐ `#field`, `#method()` | ✓ runtime privacy |
| `private` / `protected` | ✓ compile-time only |
| `readonly` | ✓ compile-time |
| `static`, `static {}` blocks | ✓ |
| `private constructor` + static factory | ✓ (type-level modifier) |
| `abstract class` / `abstract` members | ✓ |
| `implements Interface` | ✓ |
| Getters / setters | ✓ keep cheap, no side effects |
| ⭐ Parameter properties `constructor(private x)` | ✗ not erasable |
| ⭐ `enum` | ✗ use unions or `as const` objects |
| Decorators | ✗ need a build step |
| `accessor` keyword | ✓ (auto-accessors) |
| `override` keyword | ✓ with `noImplicitOverride` |

## Contracts
| Tool | Use |
|:--|:--|
| ⭐ `interface` / `type` | contract without implementation |
| Function type | one-method contracts |
| `abstract class` | shared implementation + holes |
| Mixins | rare; prefer composition |
| `satisfies` | check a value against a type, keep its literal type |

## Functional programming
| Idea | TypeScript |
|:--|:--|
| ⭐ Pure function | no I/O, no mutation, no clock inside |
| ⭐ Immutability | `readonly`, spread, non-mutating methods |
| Higher-order functions | `map`, `filter`, `reduce`, factories |
| Closures | private state without classes |
| Composition | `pipe(a, b, c)`, or named steps |
| Currying / partial application | `top(3)(items)` |
| Referential transparency | safe refactoring |
| Recursion | trees; watch stack depth |

## Non-mutating built-ins
| API | Replaces |
|:--|:--|
| ⭐ `toSorted()` (ES2023) | `sort()` |
| `toReversed()` | `reverse()` |
| `toSpliced()` | `splice()` |
| `with(i, v)` | `arr[i] = v` |
| `structuredClone()` | manual deep copy |
| `Object.groupBy()` / `Map.groupBy()` | reduce-based grouping |
| `Object.freeze()` | shallow runtime immutability |

## Algebraic data types
| Kind | TypeScript |
|:--|:--|
| Product | `{ a: A; b: B }`, tuples |
| ⭐ Sum | `{ kind: 'a' } \| { kind: 'b' }` |
| ⭐ Exhaustiveness | `switch` + `default: assertNever(x)` |
| Option | `T \| undefined` (strict null checks) |
| ⭐ Result | `{ ok: true; value } \| { ok: false; error }` |
| Branded type | `string & { readonly __brand: 'Email' }` |
| ⭐ Rule | make illegal states unrepresentable |

## Error styles
| Style | Use for |
|:--|:--|
| ⭐ Exceptions | unexpected failures, bugs, infrastructure |
| ⭐ Results | expected business outcomes |
| `undefined` | simple "not found" |
| `new Error(msg, { cause })` | keep the original error |
| Error codes | stable IDs for clients |
| Libraries | Effect, neverthrow, fp-ts (also seen) |

## Polymorphism
| Kind | Example |
|:--|:--|
| ⭐ Subtype | interface implementations |
| ⭐ Structural | shapes match → compatible |
| Parametric | generics `Repository<T>` |
| Ad hoc | overloads |
| ⭐ Dispatch table | `handlers[event.type](event)` typed from the union |
| Mapped types | `{ [K in Union]: Handler<K> }` |

## Objects and data
| Kind | Identity | Equality | Mutability |
|:--|:--|:--|:--|
| ⭐ Entity | ID | by ID | through methods |
| ⭐ Value object | none | by value | immutable |
| ⭐ DTO | none | — | plain data |
| Row | primary key | — | persistence shape |

## Immutability tools
| Tool | Effect |
|:--|:--|
| `readonly`, `Readonly<T>` | compile-time |
| `ReadonlyArray<T>` / `readonly T[]` | no push/sort |
| `as const` | readonly literal types |
| `Object.freeze` | shallow runtime |
| Spread `{ ...o, x }` | shallow copy with change |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Class wrapping one function | ceremony | function |
| Public mutable fields | rules bypassed | methods + `#private` |
| `private` as security | erased at runtime | `#private` |
| Deep inheritance | fragile base class | composition |
| Parameter properties, `enum` | Node type stripping fails | fields + unions |
| `sort()` on inputs | mutates caller data | `toSorted()` |
| Optional fields for states | invalid combinations compile | discriminated union |
| No `assertNever` | new variants fall through | exhaustive switch |
| `===` on value objects | reference comparison | `equals()` |
| Returning rows as JSON | leaked columns | DTO mappers |
| `structuredClone` on class instances | prototype lost | factories / copy methods |

## Sources
| Source | Link |
|:--|:--|
| TypeScript classes | https://www.typescriptlang.org/docs/handbook/2/classes.html |
| Narrowing and unions | https://www.typescriptlang.org/docs/handbook/2/narrowing.html |
| Private properties (MDN) | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties |
| Node type stripping | https://nodejs.org/api/typescript.html#type-stripping |
| Designing with types | https://fsharpforfunandprofit.com/series/designing-with-types/ |
| Value object | https://martinfowler.com/bliki/ValueObject.html |
| Functional core, imperative shell | https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell |
