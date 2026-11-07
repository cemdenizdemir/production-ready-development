---
title: Values, scope, closures, and modern syntax
tech: JavaScript, TypeScript
version: ECMAScript 2025, Baseline 2025
date: 2026-11-07
covers: [1, 2, 6]
---
# Values, scope, closures, and modern syntax
[← Overview](00-overview.md)

## Why it matters
- A "copy" of the cart made with spread still shares nested item objects. Editing a line in the preview changes the real cart.
- `array.sort()` sorts in place: a component sorts a list from props and silently reorders the parent's data.
- A class method passed as a click handler loses `this` and throws "Cannot read properties of undefined" only in production paths nobody clicked in tests.

## Concepts

### Primitives vs references
| | Primitives | Objects (incl. arrays, functions) |
|:--|:--|:--|
| Types | string, number, bigint, boolean, undefined, null, symbol | everything else |
| Assignment copies | the value | the reference (both names point to one object) |
| `===` compares | values | identity (same object?) |

Equality: `===` (no coercion) for everything; `Object.is` also distinguishes `NaN` (equal to itself) and `-0`. Avoid `==`.

| Copy | Depth | Keeps |
|:--|:--|:--|
| `{ ...obj }`, `[...arr]`, `Object.assign` | shallow | nested objects shared |
| `structuredClone(value)` | deep | Dates, Maps, Sets, typed arrays; not functions or class prototypes |
| `JSON.parse(JSON.stringify(x))` | deep, lossy | drops `undefined`, functions; Dates become strings: avoid |

Non-mutating array methods return new arrays: `toSorted`, `toReversed`, `toSpliced`, `with(index, value)`. Mutating ones: `sort`, `reverse`, `splice`, `push`, `pop`, `shift`, `unshift`, `fill`.

### Scope and closures
- `const`/`let` are block-scoped; `var` is function-scoped and hoisted (don't use it).
- Accessing `let`/`const` before declaration throws (temporal dead zone).
- A **closure** is a function plus the variables it captured from where it was created. It keeps them alive as long as the function lives.
- Uses: private state, factories, callbacks, memoization. Risk: capturing an old value (stale closures, a classic React bug) or keeping large objects alive.

### `this`
| Call | `this` is |
|:--|:--|
| `obj.method()` | `obj` |
| `fn()` (strict mode, modules) | `undefined` |
| `new Fn()` | the new object |
| `fn.call(x)` / `fn.apply(x)` / `fn.bind(x)` | `x` |
| Arrow function | `this` of the surrounding scope (never rebinds) |

`this` depends on **how** a function is called, not where it is defined (except arrows).

### Modern syntax and built-ins
| Feature | Example |
|:--|:--|
| Destructuring + defaults | `const { id, role = 'member' } = user` |
| Rest / spread | `const { password, ...safe } = user` |
| Optional chaining | `user?.address?.city` |
| Nullish coalescing | `limit ?? 20` (keeps `0`, unlike `\|\|`) |
| Logical assignment | `cache[key] ??= compute()` |
| `Object.groupBy` | `Object.groupBy(orders, (o) => o.status)` |
| `Map.groupBy` | same, keyed by any value |
| `array.at(-1)` | last element |
| `findLast` / `findLastIndex` | search from the end |
| Set methods | `a.union(b)`, `a.intersection(b)`, `a.difference(b)`, `a.isSubsetOf(b)` |
| Iterator helpers | `map.values().filter(isActive).take(10).toArray()` |
| `Object.hasOwn(obj, key)` | own-property check |
| Numeric separators | `1_000_000` |
| Private fields | `class Cart { #items = [] }` |

## Example
`cart.ts`
```ts
type Item = { sku: string; qty: number; priceCents: number };
type Cart = { id: string; items: Item[] };

// Immutable update: new objects on the changed path, shared objects elsewhere.
export function setQty(cart: Cart, sku: string, qty: number): Cart {
  return {
    ...cart,
    items: cart.items.map((item) => (item.sku === sku ? { ...item, qty } : item)),
  };
}

export function sortedByPrice(items: readonly Item[]): Item[] {
  return items.toSorted((a, b) => a.priceCents - b.priceCents); // input untouched
}

export function summary(items: Item[]) {
  const bySku = Object.groupBy(items, (i) => i.sku);
  const totalCents = items.reduce((sum, i) => sum + i.qty * i.priceCents, 0);
  return { skus: Object.keys(bySku).length, totalCents };
}

// A closure as private state: nothing outside can touch `count`.
export function createRateCounter(limit: number) {
  let count = 0;
  return {
    hit: () => ++count <= limit,
    reset: () => { count = 0; },
  };
}

export class Toolbar {
  #clicks = 0;
  handleClick = () => {           // arrow class field: `this` is always the instance
    this.#clicks += 1;
  };
}

const original: Cart = { id: 'c1', items: [{ sku: 'desk', qty: 1, priceCents: 34_900 }] };
const draft = structuredClone(original); // deep copy for a "preview" that may be discarded
draft.items[0]!.qty = 5;
console.log(original.items[0]!.qty);      // 1: the original is untouched
```

## Production patterns
- **Treat data as immutable** in UI code: copy on write with spread/`map`, use `toSorted` and friends. React relies on new references to detect changes.
- **`structuredClone` for deep copies**, never the JSON round trip.
- **Arrow functions for callbacks and class-field handlers**; regular functions for methods that use `this` from the call site.
- **`??` for defaults, not `||`**, so `0` and `''` survive.
- **Prefer `Map`/`Set`** for dynamic keys and membership; objects for fixed shapes.

## Mistakes
Wrong: in-place sort of shared data.
```ts
const sorted = props.items.sort(byPrice); // mutates the parent's array
```
Right:
```ts
const sorted = props.items.toSorted(byPrice);
```

Wrong: shallow copy, deep mutation.
```ts
const copy = { ...cart };
copy.items[0].qty = 3; // also changes cart.items[0]
```
Right: update immutably along the path, or `structuredClone` when you need an independent copy.

Wrong: losing `this`.
```ts
button.addEventListener('click', toolbar.onClick); // regular method: `this` is the button, not toolbar
```
Right: arrow class fields, or `toolbar.onClick.bind(toolbar)`.

Wrong: `const limit = input || 20;` turns a valid `0` into 20. Right: `input ?? 20`.

## Check yourself
1. Why does `[1] === [1]` evaluate to `false`?
2. What does a closure keep alive, and how can that cause a memory leak?
3. What is `this` inside an arrow function defined in a class field?

<details>
<summary>Answers</summary>

1. Each literal creates a new array object; `===` on objects compares identity, and they are two different objects.
2. Every variable it captured from its creating scope. A long-lived closure (an event listener, a timer, a cache entry) that captured a large object or DOM node keeps it from being garbage-collected.
3. The class instance: arrows take `this` from the scope where they're created, and class field initializers run with `this` bound to the new instance.
</details>

## Sources
- [MDN — Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness)
- [MDN — `structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)
- [MDN — Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures)
- [MDN — `this`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this)
- [MDN — Iterator helpers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator)
