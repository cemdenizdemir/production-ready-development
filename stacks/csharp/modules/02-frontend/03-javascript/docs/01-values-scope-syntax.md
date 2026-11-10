---
title: Values, equality, scope, closures, and modern syntax
tech: JavaScript, TypeScript
version: ECMAScript 2025
date: 2026-11-09
covers: [1, 2, 6]
---
# Values, equality, scope, closures, and modern syntax
[← Overview](00-overview.md)

## Why it matters
- A React component mutates `cart.items.push(x)`; the reference doesn't change, so nothing re-renders and the cart looks stale.
- `if (order.discount)` treats a discount of `0` as "no discount" and hides the line.
- A click handler captures `count` from the first render; it always sends the old value to the API.

## Concepts

### Primitives vs objects
| Kind | Examples | Compared by | Copied by |
|:--|:--|:--|:--|
| primitives | `string`, `number`, `bigint`, `boolean`, `undefined`, `null`, `symbol` | value | value |
| objects | `{}`, arrays, functions, `Date`, `Map` | **reference** | reference |

C# parallel: primitives behave like value types; objects like classes. There are no JS structs or records with value equality (a `{ id: 1 }` never equals another `{ id: 1 }`).

| Equality | Rule |
|:--|:--|
| ⭐ `===` | no type coercion; objects equal only if same reference |
| `==` | coerces types (`"0" == 0` is true); avoid |
| `Object.is(a, b)` | like `===` but `NaN` equals `NaN`, `+0 ≠ -0` (React uses it) |
| deep compare | write it, or compare IDs |

Copying:
```js
const shallow = { ...order, status: "Paid" };          // nested objects shared
const deep = structuredClone(order);                    // deep copy (no functions)
const next = { ...cart, items: [...cart.items, item] }; // immutable update
```

Falsy values: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`. Use `??` and explicit checks when `0` or `""` are valid.

### Scope, closures, and `this`
- `let`/`const` are block-scoped; `var` is function-scoped (don't use it).
- A **closure** is a function plus the variables it captured. It sees the variable, not a snapshot, unless the variable is recreated per render or iteration.
- `this` depends on how a function is **called**; arrow functions take `this` from where they're defined. In React function components you rarely need `this` at all.

```js
function makeCounter() {
  let n = 0;
  return () => ++n;          // closure over n
}
const next = makeCounter();
next(); next();              // 2
```
C# lambdas capture variables the same way (and have the same loop-capture trap with old `foreach` semantics).

### Modern syntax worth using
| Syntax / API | Example |
|:--|:--|
| destructuring + defaults | `const { id, status = "Placed" } = order;` |
| rest / spread | `const { password, ...safe } = user;` |
| ⭐ optional chaining | `order.customer?.address?.city` |
| ⭐ nullish coalescing | `order.discount ?? 0` (keeps `0`) |
| logical assignment | `opts.limit ??= 20;` |
| `Object.groupBy(items, i => i.category)` | group into an object |
| `arr.toSorted()`, `toReversed()`, `with(i, v)`, `toSpliced()` | non-mutating array methods |
| `arr.at(-1)` | last item |
| `Object.fromEntries(map)` | map → object |
| iterator helpers | `map.values().filter(x => x.active).take(5).toArray()` |
| `Set` methods | `a.union(b)`, `a.intersection(b)`, `a.difference(b)`, `a.isSubsetOf(b)` |
| template literals | `` `Order ${id}` `` |
| numeric separators | `1_000_000` |

## Example
`web/src/cart/cart.ts`
```ts
export type CartLine = { sku: string; quantity: number; unitPriceMinor: number };
export type Cart = { id: string; lines: CartLine[]; couponCode?: string };

export function addLine(cart: Cart, line: CartLine): Cart {
  const existing = cart.lines.find((l) => l.sku === line.sku);
  const lines = existing
    ? cart.lines.map((l) => (l.sku === line.sku ? { ...l, quantity: l.quantity + line.quantity } : l))
    : [...cart.lines, line];
  return { ...cart, lines };                                  // new object → React sees the change
}

export function totalMinor(cart: Cart, discountPercent?: number): number {
  const gross = cart.lines.reduce((sum, l) => sum + l.unitPriceMinor * l.quantity, 0);
  const pct = discountPercent ?? 0;                           // 0 stays 0
  return Math.round(gross * (1 - pct / 100));
}

export const linesByCategory = (lines: (CartLine & { category: string })[]) =>
  Object.groupBy(lines, (l) => l.category);
```

## Production patterns
- Treat state as immutable: return new objects/arrays; prefer `toSorted` and spreads over `sort` and `push` on shared data.
- Compare entities by ID, not by object identity, after fetching fresh data.
- `??` for defaults, `?.` for optional data; explicit `=== undefined` checks where it matters.
- Keep closures small and pass values as arguments when timing matters (React's `useEffectEvent` covers the common case, 04-framework).

## Mistakes
Wrong: mutating shared state.
```js
cart.lines.push(line); setCart(cart);     // same reference, no re-render
```
Right: `setCart(addLine(cart, line))`.

Wrong: `||` for defaults.
```js
const qty = input.quantity || 1;          // 0 becomes 1
```
Right: `input.quantity ?? 1`.

## Check yourself
1. Why is `{ id: 1 } === { id: 1 }` false?
2. What does `structuredClone` copy that a spread doesn't?
3. What is the difference between `||` and `??`?

<details><summary>Answers</summary>

1. Objects compare by reference; these are two different objects.
2. Nested objects and arrays (a deep copy), plus types like `Date`, `Map`, `Set`; spread copies only the top level.
3. `||` falls back on any falsy value (`0`, `""`, `false`); `??` only on `null` or `undefined`.
</details>

## Sources
- [MDN — Equality comparisons and sameness](https://developer.mozilla.org/docs/Web/JavaScript/Equality_comparisons_and_sameness)
- [MDN — Closures](https://developer.mozilla.org/docs/Web/JavaScript/Guide/Closures)
- [MDN — structuredClone](https://developer.mozilla.org/docs/Web/API/Window/structuredClone)
- [MDN — Iterator helpers](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Iterator)
- [MDN — Set methods](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Set)
