---
title: "React's model: components, props, state, lists"
tech: React 19.2, TypeScript
version: React 19.2
date: 2026-11-09
covers: [1, 2, 5]
---
# React's model: components, props, state, lists
[← Overview](00-overview.md)

## Why it matters
- A cart stores `items` and `total` in separate state; one update forgets the total, and the header shows the wrong price.
- A list uses array indexes as keys; deleting the second item keeps its input text in the third row.
- The same "selected filter" lives in three components' state; they disagree after a navigation.

## Concepts

### Components and JSX
A component is a function that returns JSX. JSX compiles to function calls; `{}` embeds expressions; `className`, `htmlFor`, camelCase events.
```tsx
type Props = { name: string; priceMinor: number; onAdd: () => void };

export function ProductCard({ name, priceMinor, onAdd }: Props) {
  return (
    <article className="grid gap-2">
      <h3>{name}</h3>
      <p>{formatMoney({ amountMinor: priceMinor, currency: "EUR" }, "en")}</p>
      <button type="button" onClick={onAdd}>Add to cart</button>
    </article>
  );
}
```
Rendering must be **pure**: no fetches, no subscriptions, no mutation of outside variables during render. React may render more than once (Strict Mode does it on purpose in development).

### Props, state, derived values
| Data | Where it lives |
|:--|:--|
| inputs from the parent | props (read-only) |
| values that change over time and only this component cares about | `useState` / `useReducer` |
| values two siblings need | ⭐ lift state to the closest common parent |
| values you can compute from props/state | ⭐ **derive during render**, don't store |
| server data | TanStack Query cache (05-state-management) |
| URL-ish state (filters, page) | search params |

```tsx
const [lines, setLines] = useState<CartLine[]>([]);
const totalMinor = lines.reduce((s, l) => s + l.unitPriceMinor * l.quantity, 0);   // derived, never stale
```

State updates are snapshots: `setCount(count + 1)` twice in one handler adds 1. Use the updater form when the next value depends on the previous one: `setCount(c => c + 1)`. Objects and arrays: replace, never mutate.

### Lists and keys
```tsx
<ul>
  {lines.map((l) => (
    <li key={l.sku}>{l.sku} × {l.quantity}</li>     // stable, unique id from the data
  ))}
</ul>
```
Keys tell React which item is which between renders. Use IDs from the API (`Guid`, SKU), never array indexes for lists that change order or length. Changing a component's `key` resets its state on purpose (`<OrderForm key={orderId} />`).

### Conditional rendering
| Pattern | Use |
|:--|:--|
| `cond ? <A /> : <B />` | either/or |
| `cond && <A />` | only when true; beware `0 && …` renders `0` |
| early `return` | loading/empty/error states |
| `null` | render nothing |

## Example
`web/src/cart/Cart.tsx`
```tsx
import { useState } from "react";

type Line = { sku: string; name: string; quantity: number; unitPriceMinor: number };

export function Cart({ initial }: { initial: Line[] }) {
  const [lines, setLines] = useState(initial);

  const totalMinor = lines.reduce((s, l) => s + l.quantity * l.unitPriceMinor, 0);

  function changeQuantity(sku: string, quantity: number) {
    setLines((prev) =>
      quantity <= 0 ? prev.filter((l) => l.sku !== sku) : prev.map((l) => (l.sku === sku ? { ...l, quantity } : l)),
    );
  }

  if (lines.length === 0) return <p>Your cart is empty.</p>;

  return (
    <section aria-labelledby="cart-title">
      <h2 id="cart-title">Cart</h2>
      <ul>
        {lines.map((l) => (
          <li key={l.sku}>
            {l.name}
            <label>
              Qty
              <input type="number" min={0} value={l.quantity}
                onChange={(e) => changeQuantity(l.sku, e.currentTarget.valueAsNumber)} />
            </label>
          </li>
        ))}
      </ul>
      <p>Total: {(totalMinor / 100).toFixed(2)} €</p>
    </section>
  );
}
```

## Production patterns
- Keep state minimal; compute everything else during render.
- One source of truth per piece of data: server data in the query cache, UI state in the closest owner, filters in the URL.
- Stable keys from domain IDs.
- Small components with typed props; `children` for composition (lesson 03).

## Mistakes
Wrong: storing derived data.
```tsx
const [total, setTotal] = useState(0);
useEffect(() => setTotal(sum(lines)), [lines]);     // extra render, can drift
```
Right: `const total = sum(lines);`

Wrong: `key={index}` for a reorderable list.
Right: `key={line.sku}`.

## Check yourself
1. Why must rendering be pure?
2. Two calls to `setCount(count + 1)` in one click handler: what's the result?
3. When would you change a component's `key` on purpose?

<details><summary>Answers</summary>

1. React may call components several times, pause, or discard renders; side effects during render would run unpredictably.
2. It increases by 1, because both calls read the same snapshot; use `setCount(c => c + 1)` for +2.
3. To reset its state, e.g. a form when switching to a different order.
</details>

## Sources
- [react.dev — Describing the UI](https://react.dev/learn/describing-the-ui)
- [react.dev — Choosing the state structure](https://react.dev/learn/choosing-the-state-structure)
- [react.dev — Sharing state between components](https://react.dev/learn/sharing-state-between-components)
- [react.dev — Rendering lists](https://react.dev/learn/rendering-lists)
- [react.dev — Keeping components pure](https://react.dev/learn/keeping-components-pure)
