---
title: JavaScript cheatsheet
tech: JavaScript, TypeScript
version: ECMAScript 2025 (+ Baseline 2025 APIs), TypeScript 6.0
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# JavaScript cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Values and equality
| Item | Meaning | Note |
|:--|:--|:--|
| primitives | string, number, bigint, boolean, undefined, null, symbol | by value |
| ⭐ objects | compared by reference | arrays, functions, Date |
| ⭐ `===` | strict equality | never `==` |
| `Object.is` | `NaN` equal, `±0` distinct | React comparisons |
| ⭐ `structuredClone(x)` | deep copy | no functions |
| `{ ...x }` / `[...xs]` | shallow copy | |
| falsy | `false 0 -0 0n "" null undefined NaN` | |
| `typeof null` | `"object"` | historic quirk |

## Scope and closures
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ `const` / `let` | block scope | no `var` |
| ⭐ closure | function + captured variables | stale values in React |
| `this` | set by call site | arrows inherit |
| `fn.bind(obj)` | fix `this` | |
| IIFE / modules | private scope | modules preferred |

## Modern syntax
| Syntax | Example | Note |
|:--|:--|:--|
| ⭐ `?.` | `a?.b?.c` | |
| ⭐ `??` | `x ?? 0` | keeps 0 / "" |
| `??=` / `\|\|=` / `&&=` | logical assignment | |
| destructuring | `const { a, b = 1, ...rest } = o` | |
| spread | `[...a, x]`, `{ ...o, k: v }` | |
| `Object.groupBy(xs, f)` | group | Baseline |
| ⭐ `toSorted` / `toReversed` / `toSpliced` / `with` | non-mutating | |
| `at(-1)` | last element | |
| `Object.fromEntries` / `entries` | object ↔ pairs | |
| iterator helpers | `.map/.filter/.take/.drop/.toArray()` | ES2025 |
| `Set` methods | `union`, `intersection`, `difference`, `isSubsetOf` | ES2025 |
| `Array.fromAsync` | async iterable → array | |
| numeric separators | `1_000` | |

## Event loop
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ call stack | runs to completion | blocks UI |
| ⭐ microtasks | promises, `await`, `queueMicrotask` | drained after each task |
| tasks | events, timers, I/O | one per turn |
| rendering | between tasks | ~16 ms frames |
| long task | > 50 ms | hurts INP |
| `scheduler.yield()` | yield to the browser | check support |
| Web Worker | off-main-thread compute | |

## Promises and async
| API | Does | C# |
|:--|:--|:--|
| ⭐ `async` / `await` | async functions | same idea, single thread |
| ⭐ `Promise.all` | all or first rejection | `Task.WhenAll` |
| `Promise.allSettled` | all results | |
| `Promise.any` | first success | |
| `Promise.race` | first settled | `Task.WhenAny` |
| `Promise.withResolvers()` | external resolve | `TaskCompletionSource` |
| `Promise.try(fn)` | wrap sync/async | ES2025 |
| `for await (const x of it)` | async iteration | `await foreach` |
| ⭐ `forEach(async …)` | not awaited | use `Promise.all` / `for…of` |

## Cancellation
| API | Does | C# |
|:--|:--|:--|
| ⭐ `AbortController` | source | `CancellationTokenSource` |
| ⭐ `AbortSignal` | token | `CancellationToken` |
| ⭐ `AbortSignal.timeout(ms)` | deadline | `CancelAfter` |
| `AbortSignal.any([a, b])` | combine | linked token source |
| `signal.throwIfAborted()` | check | `ThrowIfCancellationRequested` |
| `fetch(url, { signal })` | cancel request | |

## Errors
| Item | Does | Note |
|:--|:--|:--|
| `class X extends Error` | custom errors | set `name` |
| ⭐ `new Error(msg, { cause })` | keep original | |
| `AggregateError` | many errors | |
| `catch (e: unknown)` | TS-safe catch | narrow |
| `unhandledrejection` event | global async errors | Sentry |
| ⭐ Problem Details → `ApiError` | typed API errors | one fetch wrapper |

## Modules
| Item | Example | Note |
|:--|:--|:--|
| named / default exports | `export function f` / `export default` | |
| ⭐ dynamic import | `await import("./x")` | code splitting |
| `import type` | type-only | erased |
| top-level await | in modules | blocks importers |
| import attributes | `with { type: "json" }` | |
| `import.meta.url` | module URL | |

## DOM and events
| Item | Does | Note |
|:--|:--|:--|
| delegation | one listener, `closest()` | lists |
| ⭐ `{ signal }` option | remove with `abort()` | cleanup |
| `{ passive: true }` | no `preventDefault` | scroll perf |
| `{ once: true }` | auto-remove | |
| `CustomEvent` | app events | `detail` |
| `preventDefault` / `stopPropagation` | default / bubbling | |

## Browser APIs
| API | Use | Note |
|:--|:--|:--|
| ⭐ `fetch` | HTTP | `credentials: "include"` for cookies |
| ⭐ `URL` / `URLSearchParams` | build URLs | encoding |
| `localStorage` | small prefs | never tokens |
| IndexedDB | large offline data | |
| `IntersectionObserver` | visibility | lazy, infinite scroll |
| `ResizeObserver` | element size | |
| `BroadcastChannel` | cross-tab messages | |
| ⭐ `crypto.randomUUID()` | UUIDs | idempotency keys |
| `navigator.clipboard` / `share` | copy / share | |

## Memory and performance
| Item | Does | Note |
|:--|:--|:--|
| ⭐ debounce | after pause | search input |
| ⭐ throttle | at most every N ms | scroll |
| `requestAnimationFrame` | per frame | visual updates |
| cleanup | listeners, timers, observers | effects |
| heap snapshot | find leaks | DevTools Memory |
| Performance panel | long tasks | |

## TypeScript
| Feature | Example | Note |
|:--|:--|:--|
| ⭐ union | `"Placed" \| "Paid"` | |
| ⭐ narrowing | `typeof`, `in`, `instanceof`, discriminant | |
| discriminated union | `{ kind: "a" } \| { kind: "b" }` | |
| ⭐ `never` exhaustiveness | `const _: never = x` | |
| generics | `<T,>(x: T) => T` | |
| `Partial` / `Pick` / `Omit` / `Record` / `Readonly` | utility types | |
| `ReturnType` / `Awaited` / `Parameters` | derived types | |
| `satisfies` | check without widening | |
| `unknown` | must narrow | not `any` |
| `as const` | literal readonly | |
| generated types | Orval from OpenAPI | + Zod schemas |

## Numbers and money
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ `number` is float64 | `0.1 + 0.2 ≠ 0.3` | |
| `Number.MAX_SAFE_INTEGER` | 2⁵³−1 | big `long` IDs as strings |
| `bigint` | arbitrary integers | `123n` |
| ⭐ minor units | `amountMinor: 1210` | exact money |
| decimal strings | `"12.10"` | exact, parse to compute |
| C# `decimal` as JSON number | float in JS | agree on a wire format |
| `Math.round` / `toFixed` | display only | not money math |

## Dates and Intl
| Item | Use | Note |
|:--|:--|:--|
| ⭐ ISO 8601 with offset | instants from `DateTimeOffset` | |
| `DateOnly` `"2026-11-10"` | calendar dates | not `new Date(s)` |
| `Temporal.Instant` / `PlainDate` / `ZonedDateTime` / `Duration` | Temporal types | check Baseline / polyfill |
| `Date` | legacy instant | local-time traps |
| ⭐ `Intl.NumberFormat` | currency, units | locale |
| ⭐ `Intl.DateTimeFormat` | dates with `timeZone` | |
| `Intl.RelativeTimeFormat` | "in 3 days" | |
| `Intl.PluralRules` / `ListFormat` / `Collator` / `Segmenter` | i18n helpers | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| mutating state | no re-render | new objects |
| `\|\|` for defaults | 0/"" lost | `??` |
| sequential independent awaits | slow | `Promise.all` |
| async `forEach` | unawaited | `Promise.all` / `for…of` |
| string-built URLs | encoding bugs | `URLSearchParams` |
| float money | rounding | minor units |
| `new Date("YYYY-MM-DD")` | UTC shift | PlainDate |
| listeners without cleanup | leaks | `signal` |
| `any` | hides bugs | `unknown` + narrowing |

## Sources
| Source | Link |
|:--|:--|
| MDN JavaScript | https://developer.mozilla.org/docs/Web/JavaScript |
| ECMAScript 2025 | https://tc39.es/ecma262/2025/ |
| Event loop | https://developer.mozilla.org/docs/Web/JavaScript/Event_loop |
| AbortController | https://developer.mozilla.org/docs/Web/API/AbortController |
| TypeScript handbook | https://www.typescriptlang.org/docs/handbook/intro.html |
| Temporal | https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal |
| Intl | https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl |
| Long tasks | https://web.dev/articles/optimize-long-tasks |
