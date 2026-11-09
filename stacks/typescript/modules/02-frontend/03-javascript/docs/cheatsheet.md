---
title: JavaScript cheatsheet
tech: JavaScript, TypeScript
version: ECMAScript 2025 (+ Baseline 2025 APIs), TypeScript 6.0
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# JavaScript cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Values and equality
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Primitives | string, number, bigint, boolean, undefined, null, symbol | copied by value |
| ⭐ Objects | shared by reference | arrays, functions too |
| ⭐ `===` | strict equality | no coercion |
| `Object.is(a, b)` | like `===`, but `NaN` equals `NaN`, `0 !== -0` | |
| `typeof x` | type string | `typeof null === 'object'` |
| `Array.isArray(x)` | array check | |
| `x == null` | null or undefined | ESLint `eqeqeq` may flag it |
| ⭐ `structuredClone(v)` | deep copy | no functions/prototypes |
| `{ ...o }` / `[...a]` | shallow copy | |
| `Object.freeze(o)` | shallow immutability | |

## Arrays (non-mutating first)
| Method | What it does | Note |
|:--|:--|:--|
| ⭐ `map` / `filter` / `reduce` | transform / select / fold | |
| ⭐ `toSorted(fn)` / `toReversed()` / `toSpliced()` / `with(i, v)` | copy-and-change | ES2023 |
| `sort` / `reverse` / `splice` | mutate in place | avoid on shared data |
| ⭐ `find` / `findIndex` / `findLast` / `findLastIndex` | search | |
| `some` / `every` / `includes` | tests | |
| `at(-1)` | index from the end | |
| `flat()` / `flatMap()` | flatten | |
| `Array.from(iter, fn)` / `Array.of()` | create | |
| `Array.fromAsync(asyncIter)` | collect async iterables | newer |
| ⭐ `Object.groupBy(arr, fn)` / `Map.groupBy` | group | Baseline 2024 |
| `entries()` / `keys()` / `values()` | iterators | |

## Objects, Maps, Sets
| Item | What it does | Note |
|:--|:--|:--|
| `Object.keys` / `values` / `entries` / `fromEntries` | convert | |
| `Object.hasOwn(o, k)` | own property | not `hasOwnProperty` |
| `Object.assign(target, ...src)` | shallow merge | |
| ⭐ `Map` | any-key dictionary, ordered | dynamic keys |
| ⭐ `Set` | unique values | membership |
| Set methods `union` / `intersection` / `difference` / `symmetricDifference` | set algebra | Baseline 2024 |
| `isSubsetOf` / `isSupersetOf` / `isDisjointFrom` | set comparisons | |
| `WeakMap` / `WeakSet` | keys don't prevent GC | metadata for objects |
| `WeakRef` / `FinalizationRegistry` | weak references | rarely needed |

## Syntax
| Syntax | Example | Note |
|:--|:--|:--|
| ⭐ Destructuring + defaults | `const { a = 1, ...rest } = obj` | |
| ⭐ Optional chaining | `a?.b?.[k]?.()` | |
| ⭐ Nullish coalescing | `x ?? fallback` | keeps `0` and `''` |
| Logical assignment | `a ??= b`, `a \|\|= b`, `a &&= b` | |
| Template literals | `` `Hi ${name}` `` | tagged templates exist |
| Spread in calls | `Math.max(...nums)` | |
| Numeric separators | `1_000_000` | |
| Class private fields | `#count`, `#method()` | |
| Static blocks | `static { ... }` | |
| Arrow functions | lexical `this` | |
| Getters / setters | `get total() {}` | |
| Labels / `for...of` / `for...in` | loops | `for...in` iterates keys, incl. inherited |
| `using` declarations | auto-dispose resources at scope end | newer (Node 24+) |

## Scope, closures, this
| Item | What it is | Note |
|:--|:--|:--|
| ⭐ `const` / `let` | block scope | `var` is function scope: avoid |
| TDZ | using `let`/`const` before declaration throws | |
| Hoisting | function declarations usable before definition | |
| ⭐ Closure | function + captured variables | private state, stale values |
| ⭐ `this` | depends on the call site | arrows capture it |
| `bind` / `call` / `apply` | set `this` | |
| Strict mode | default in modules and classes | `this` undefined in plain calls |

## Event loop
| Item | What it is | Note |
|:--|:--|:--|
| ⭐ Task (macrotask) | timers, events, I/O | one per loop turn |
| ⭐ Microtask | promise callbacks, `await`, `queueMicrotask` | drained after each task |
| Rendering | rAF → style → layout → paint | between tasks |
| ⭐ Long task | > 50 ms on the main thread | hurts INP |
| `requestAnimationFrame` | before next paint | visual updates |
| `requestIdleCallback` | when idle | low-priority work |
| `scheduler.yield()` | yield to the browser, keep priority | newer (Chromium, Firefox) |
| `setTimeout(fn, 0)` | next task | ≥ 4 ms clamping when nested |
| Web Worker | parallel thread | no DOM access |
| Node: `process.nextTick` | before promise microtasks | Node only |

## Promises and async
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `async` / `await` | write async code sequentially | pauses the function only |
| ⭐ `Promise.all` | all fulfill, or first rejection | parallel |
| ⭐ `Promise.allSettled` | all results with status | partial failure OK |
| `Promise.any` | first fulfillment | `AggregateError` if all fail |
| `Promise.race` | first settlement | timeouts (prefer AbortSignal) |
| `Promise.withResolvers()` | external resolve/reject | Baseline 2024 |
| `Promise.try(fn)` | wrap sync or async uniformly | Baseline 2025 |
| `for await (const x of iter)` | async iteration | streams, paginated APIs |
| ⭐ `AbortController` / `signal` | cancellation | fetch, listeners |
| ⭐ `AbortSignal.timeout(ms)` | deadline signal | |
| `AbortSignal.any([a, b])` | combine signals | Baseline 2024 |
| `unhandledrejection` event | global safety net | report to Sentry |

## Errors
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `throw new Error(msg)` | error with stack | never throw strings |
| ⭐ `new Error(msg, { cause })` | wrap and keep the original | |
| Subclass | `class HttpError extends Error` | set `name` |
| `AggregateError` | many errors at once | `Promise.any` |
| `try` / `catch` / `finally` | handle / cleanup | |
| `catch` without binding | `catch { ... }` | when the error isn't needed |
| `Error.isError(x)` | reliable error check across realms | newer |
| `error.stack` | stack trace | source maps for minified code |

## Modules
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Named exports | `export const x` | preferred |
| Default export | `export default` | avoid in shared code |
| ⭐ `import()` | dynamic import, code splitting | returns a promise |
| Top-level `await` | await in module scope | blocks importers |
| Import attributes | `with { type: 'json' }` | JSON modules (ES2025) |
| `import.meta.url` / `import.meta.env` | module URL / Vite env | |
| Import maps | `<script type="importmap">` | map bare specifiers in browsers |
| `"type": "module"` | `.js` files are ESM | package.json |
| Circular imports | values may be `undefined` at load | keep dependencies one-way |

## DOM and events
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `querySelector` / `querySelectorAll` | find elements | |
| ⭐ `closest(sel)` | nearest ancestor match | delegation |
| ⭐ `textContent` | set text safely | not `innerHTML` with data |
| `classList.add/remove/toggle` | classes | |
| `dataset` | `data-*` attributes | |
| `append` / `prepend` / `replaceChildren` / `remove` | DOM changes | |
| `<template>` + `cloneNode(true)` | fast repeated markup | |
| ⭐ `addEventListener(t, fn, { signal, once, passive })` | listeners | `passive` for scroll/touch |
| ⭐ Event delegation | one listener for many children | |
| `event.preventDefault()` | cancel default | form submit, link |
| `event.stopPropagation()` | stop bubbling | rarely right |
| `CustomEvent(name, { detail })` | app events | |
| `getBoundingClientRect()` | size and position | forces layout |

## Browser APIs
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `fetch` | HTTP | check `res.ok` |
| ⭐ `URL` / `URLSearchParams` | build/parse URLs | `URL.parse()` returns null on error |
| `localStorage` / `sessionStorage` | small string storage | sync; no secrets |
| IndexedDB | structured async storage | offline data |
| `IntersectionObserver` | visibility | lazy load, infinite scroll |
| `ResizeObserver` | element size | |
| `MutationObserver` | DOM changes | |
| `navigator.clipboard.writeText` | copy | needs user gesture/permission |
| `navigator.sendBeacon` | send data on page hide | analytics |
| `BroadcastChannel` | cross-tab messages | |
| `crypto.randomUUID()` | UUID v4 | |
| `crypto.subtle` | Web Crypto | hashing, signing |
| `history.pushState` / Navigation API | client-side routing | frameworks handle it |
| `matchMedia(query)` | media queries in JS | |
| `performance.now()` / `mark` / `measure` | timing | |
| `visibilitychange` event | tab hidden/visible | pause work |

## Memory and performance
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Remove listeners | `signal` + `abort()` | SPAs |
| ⭐ Clear timers | `clearInterval` / `clearTimeout` | |
| Disconnect observers | `observer.disconnect()` | |
| Detached DOM nodes | removed but referenced | heap snapshot "Detached" |
| ⭐ Debounce | run after a pause | search input |
| ⭐ Throttle | run at most every N ms | scroll, resize |
| Heap snapshot | find leaks | DevTools Memory |
| Performance panel | find long tasks | DevTools |

## TypeScript essentials
| Item | What it does | Example |
|:--|:--|:--|
| ⭐ Union / literal types | allowed values | `'pending' \| 'paid'` |
| ⭐ Narrowing | refine types by checks | `typeof`, `in`, `instanceof` |
| ⭐ Discriminated union | tagged states | `{ ok: true; data } \| { ok: false; error }` |
| ⭐ Generics | reusable typed functions | `<T extends { id: string }>` |
| `keyof` / `typeof` / `T['k']` | type operators | `keyof typeof MAP` |
| ⭐ Utility types | `Partial`, `Pick`, `Omit`, `Record`, `ReturnType`, `Awaited` | |
| `as const` | literal readonly values | enum replacement |
| ⭐ `satisfies` | check without widening | config objects |
| ⭐ `unknown` | must narrow first | not `any` |
| `never` | impossible value | exhaustive checks |
| Type predicates | `x is User` | custom guards |
| Template literal types | `` `on${string}` `` | |
| Mapped / conditional types | `{ [K in keyof T]: … }`, `T extends U ? X : Y` | libraries |
| `import type` | type-only import | `verbatimModuleSyntax` |
| `enum` / `namespace` | avoid | not erasable |

## Numbers and math
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Floating point | `0.1 + 0.2 !== 0.3` | money in integer cents |
| `Number.isInteger` / `isSafeInteger` / `isFinite` | checks | |
| `Number.MAX_SAFE_INTEGER` | 2^53 − 1 | bigger → BigInt/string |
| `BigInt` | arbitrary-size integers | `123n`; no mixing with numbers |
| `parseInt(s, 10)` / `Number(s)` | parsing | `Number('')` is 0 |
| `toFixed(2)` | string with rounding | display only |
| `Math.round` / `trunc` / `sign` | rounding | |
| `Math.sumPrecise(nums)` | exact float sum | newer |

## Dates and Intl
| API | What it does | Note |
|:--|:--|:--|
| ⭐ ISO 8601 UTC strings | `2026-11-07T09:30:00Z` | store and transfer |
| `Date` | timestamp in ms | months 0-based, local-time display |
| `Date.parse(nonIso)` | unreliable | don't |
| ⭐ `Temporal.Instant` / `ZonedDateTime` | exact moment / moment + zone | Node 26, Firefox, Chrome |
| ⭐ `Temporal.PlainDate` | calendar date, no zone | birthdays, delivery days |
| `Temporal.Duration` | lengths of time | |
| ⭐ `Intl.NumberFormat` | numbers, currency, units, compact | |
| ⭐ `Intl.DateTimeFormat` | dates with `timeZone` | |
| `Intl.RelativeTimeFormat` | "3 days ago" | |
| `Intl.PluralRules` | plural categories | i18n |
| `Intl.ListFormat` | "A, B, and C" | |
| `Intl.Collator` | locale-aware sorting | `localeCompare` |
| `Intl.Segmenter` | graphemes, words, sentences | emoji-safe length |
| `Intl.DisplayNames` | country/language names | |
| `Intl.DurationFormat` | "1 hr 5 min" | newer |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `fetch` resolves on 500 | error page parsed as JSON | check `res.ok` |
| `sort()` mutates | shared data reordered | `toSorted()` |
| Spread is shallow | nested objects shared | immutable updates / `structuredClone` |
| `\|\|` for defaults | `0`/`''` replaced | `??` |
| `await` in loops | serial requests | `Promise.all` |
| `forEach(async …)` | nothing awaited | `for...of` / `Promise.all` |
| Lost `this` | method passed as callback | arrow field / `bind` |
| Floats for money | rounding drift | integer cents |
| Date-only via `Date` | off by one day | string / `PlainDate` |
| `typeof null` | `'object'` | `x === null` |
| String-built URLs | broken params | `URLSearchParams` |
| Listeners never removed | leaks | `signal` |
| `innerHTML` with data | XSS | `textContent` |

## Sources
| Source | Link |
|:--|:--|
| MDN JavaScript reference | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference |
| MDN Web APIs | https://developer.mozilla.org/en-US/docs/Web/API |
| TC39 finished proposals | https://github.com/tc39/proposals/blob/main/finished-proposals.md |
| javascript.info | https://javascript.info/ |
| TypeScript Handbook | https://www.typescriptlang.org/docs/handbook/intro.html |
| Temporal docs | https://tc39.es/proposal-temporal/docs/ |
| web.dev Baseline | https://web.dev/baseline |
