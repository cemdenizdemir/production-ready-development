---
title: "The React model: components, props, state, lists"
tech: React 19.2, TypeScript
version: React 19.2, TypeScript 6.0
date: 2026-11-07
covers: [1, 2, 5]
---
# The React model: components, props, state, lists
[← Overview](00-overview.md)

## Why it matters
- The filtered list is stored in state next to the full list. Someone adds an item, the filtered copy isn't updated, and the UI shows stale data.
- List items use the array index as `key`. After deleting the second row, the third row's half-typed input text appears in what used to be the second row.
- `{items.length && <Badge />}` renders a lone `0` on the page when the cart is empty.

## Concepts

### Rendering
- A component is a function that returns JSX. **Rendering** means React calls it. **Committing** means React applies the minimal DOM changes.
- A component re-renders when its state changes, its parent re-renders, or a context it reads changes.
- Rendering must be **pure**: same props and state → same JSX, no side effects (no fetches, subscriptions, or mutations of outside variables). In development, `<StrictMode>` renders twice to expose impure code.

### Props and state
| | Props | State |
|:--|:--|:--|
| Owned by | the parent | the component |
| Mutable? | never (read-only) | only via the setter |
| Changes cause | re-render of the child | re-render of the owner and its children |

State behaves like a **snapshot** for each render: `setCount(count + 1)` twice in one handler adds 1, not 2. Use updater functions when the next value depends on the previous one: `setCount((c) => c + 1)`. Update objects and arrays immutably.

### One source of truth
- Keep each piece of data in **one** place. When siblings need it, **lift state up** to their closest common parent and pass it down with callbacks to change it.
- **Derive, don't duplicate:** values you can compute from props or state (filtered lists, totals, "is valid") are calculated during render, not stored.

| Question | If yes |
|:--|:--|
| Does it come from the parent? | it's a prop, not state |
| Does it never change? | it's a constant, not state |
| Can you compute it from other state/props? | derive it during render |
| Otherwise | it's state; put it in the lowest common owner |

### Lists, keys, and conditions
- Each list item needs a **stable, unique `key`** from your data (an ID). Keys tell React which item is which across renders.
- Index keys break when items are reordered, inserted, or removed: state and DOM end up attached to the wrong item.
- Changing a component's `key` **resets** it: `<ProfileForm key={userId} />` starts fresh for a new user.
- `cond && <X />` renders `cond` itself when it's `0` or `''`; use `cond > 0 &&` or a ternary.

## Example
`ProductList.tsx`
```tsx
import { useState } from 'react';

type Product = { id: string; name: string; priceCents: number; inStock: boolean };

export function ProductPage({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Derived during render: nothing to keep in sync.
  const visible = products.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) && (!onlyInStock || p.inStock),
  );

  return (
    <section aria-labelledby="products-heading">
      <h2 id="products-heading">Products</h2>
      <Filters
        query={query}
        onQueryChange={setQuery}
        onlyInStock={onlyInStock}
        onOnlyInStockChange={setOnlyInStock}
      />
      {visible.length > 0 ? (
        <ul>
          {visible.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </ul>
      ) : (
        <p>No products match “{query}”.</p>
      )}
    </section>
  );
}

type FiltersProps = {
  query: string;
  onQueryChange: (q: string) => void;
  onlyInStock: boolean;
  onOnlyInStockChange: (v: boolean) => void;
};

function Filters({ query, onQueryChange, onlyInStock, onOnlyInStockChange }: FiltersProps) {
  return (
    <div>
      <label>
        Search <input value={query} onChange={(e) => onQueryChange(e.target.value)} />
      </label>
      <label>
        <input type="checkbox" checked={onlyInStock} onChange={(e) => onOnlyInStockChange(e.target.checked)} />
        In stock only
      </label>
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  const [qty, setQty] = useState(1); // local UI state: stays with this product thanks to the key
  return (
    <li>
      {product.name}{' '}
      <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label={`Quantity of ${product.name}`} />
    </li>
  );
}
```

## Production patterns
- **Keep components pure**; side effects go in event handlers first, effects second (lesson 02).
- **Minimal state, maximal derivation.** Fewer state variables means fewer ways to be inconsistent.
- **Stable IDs from the server as keys**; generate client IDs (`crypto.randomUUID()`) when creating items locally.
- **Model states explicitly**: one `status: 'idle' | 'saving' | 'error'` instead of several booleans that can contradict each other.
- **Use `key` to reset** subtrees when the identity of what they show changes.

## Mistakes
Wrong: storing derived data.
```tsx
const [items, setItems] = useState(products);
const [filtered, setFiltered] = useState(products); // must be kept in sync by hand
```
Right: `const filtered = items.filter(matches);` during render.

Wrong: index keys on a dynamic list.
```tsx
{todos.map((t, i) => <TodoRow key={i} todo={t} />)}
```
Right: `key={t.id}`.

Wrong: mutating state.
```tsx
cart.items.push(item);
setCart(cart); // same reference: React may skip the update
```
Right: `setCart((c) => ({ ...c, items: [...c.items, item] }));`

Wrong: `{count && <Badge count={count} />}` shows `0`. Right: `{count > 0 && <Badge count={count} />}`.

## Check yourself
1. Why does calling `setCount(count + 1)` twice in one click only add 1?
2. When should a value live in the parent instead of the child?
3. What happens to a component's state when its `key` changes?

<details>
<summary>Answers</summary>

1. `count` is the snapshot from this render; both calls compute the same next value. Use `setCount((c) => c + 1)` to build on the latest queued value.
2. When a sibling or the parent also needs to read or change it; lift it to the closest common ancestor and pass it down.
3. React treats it as a different component: the old one unmounts (state discarded) and a new one mounts with fresh state.
</details>

## Sources
- [react.dev — Thinking in React](https://react.dev/learn/thinking-in-react)
- [react.dev — Keeping components pure](https://react.dev/learn/keeping-components-pure)
- [react.dev — State as a snapshot](https://react.dev/learn/state-as-a-snapshot)
- [react.dev — Choosing the state structure](https://react.dev/learn/choosing-the-state-structure)
- [react.dev — Rendering lists](https://react.dev/learn/rendering-lists)
