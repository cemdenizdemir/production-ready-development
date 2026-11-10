---
title: "Runtime: INP, CLS, and React rendering"
tech: React 19.2, Next.js 16, React Compiler
version: React 19.2, React Compiler 1.0
date: 2026-11-09
covers: [7, 8, 9]
---
# Runtime: INP, CLS, and React rendering
[← Overview](00-overview.md)

## Why it matters
- Clicking a filter takes 700 ms to show anything: the handler filters 3,000 products and re-renders all of them synchronously.
- A cookie banner inserted above the content pushes the "Add to cart" button down just as the user taps; they tap the wrong product.
- Order history with 5,000 rows renders every row; scrolling stutters and memory climbs.

## Concepts

### INP: interaction latency
INP = input delay + processing time + presentation delay, for (nearly) the slowest interaction in a visit.
| Phase | Cause | Fix |
|:--|:--|:--|
| input delay | main thread busy (long tasks, hydration, third parties) | less JS, break long tasks, defer third parties |
| processing | slow event handlers, big re-renders | do less in the handler; transitions for non-urgent updates |
| presentation | large DOM updates, layout/paint | smaller DOM, virtualization, `content-visibility` |

Tools: `startTransition` for non-urgent state, `useDeferredValue` for expensive derived UI, `scheduler.yield()`/`setTimeout` to split work, Web Workers for heavy computation, immediate visual feedback (pressed state, spinner) before the expensive part.

### React rendering performance
| Problem | Fix |
|:--|:--|
| re-rendering too much | ⭐ React Compiler (auto-memoization); state placed close to where it's used |
| context change re-renders everything | split contexts; select only what you need |
| huge lists | ⭐ virtualization (`@tanstack/react-virtual`), pagination |
| expensive render work | `useDeferredValue`, move work to the server |
| unnecessary client components | Server Components |
| measuring | React DevTools Profiler ("why did this render?"), Performance panel React track |

### CLS: layout stability
| Cause | Fix |
|:--|:--|
| images/iframes without dimensions | `width`/`height`, `aspect-ratio`, `next/image` |
| late content inserted above existing content | reserve space (skeletons with fixed size), insert below, or overlay (toasts, banners as fixed overlays) |
| web fonts swapping | `next/font` fallback metrics (`size-adjust`) |
| animations of layout properties | animate `transform` |
| ads/embeds | fixed-size containers |

Layout shifts within 500 ms of a user input don't count; shifts the user didn't cause do.

## Example
`web/src/features/catalog/ProductFilter.tsx`
```tsx
"use client";
import { useDeferredValue, useState } from "react";

export function ProductFilter({ products }: { products: ProductDto[] }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);                 // input stays responsive
  const visible = products.filter((p) => p.name.toLowerCase().includes(deferred.toLowerCase()));
  const stale = query !== deferred;

  return (
    <>
      <label htmlFor="q">Filter</label>
      <input id="q" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul style={{ opacity: stale ? 0.6 : 1 }}>
        {visible.map((p) => <li key={p.sku}>{p.name}</li>)}
      </ul>
    </>
  );
}
```
`web/src/features/orders/OrderHistory.tsx` (virtualized)
```tsx
"use client";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function OrderHistory({ orders }: { orders: OrderSummaryDto[] }) {
  const parent = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: orders.length, getScrollElement: () => parent.current, estimateSize: () => 56 });
  return (
    <div ref={parent} style={{ blockSize: "70dvh", overflow: "auto" }}>
      <ul style={{ blockSize: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((row) => (
          <li key={orders[row.index].id} style={{ position: "absolute", insetBlockStart: row.start, blockSize: row.size }}>
            #{orders[row.index].id} · {orders[row.index].status}
          </li>
        ))}
      </ul>
    </div>
  );
}
```
Cookie banner without CLS: render it as a fixed overlay at the bottom (`position: fixed; inset-block-end: 0`), not as a block pushing content down.

## Production patterns
- Track INP and CLS in RUM with attribution; fix the interactions and elements reported most.
- Every interaction gives feedback within 100 ms, even if the full result takes longer.
- Virtualize or paginate lists over ~200 rows; prefer server-side pagination from the API.
- Banners, toasts, and consent dialogs are overlays; skeletons have the size of the content they replace.

## Mistakes
Wrong: heavy synchronous work in a click handler.
```tsx
onClick={() => setResults(expensiveSearch(allProducts, query))}
```
Right: transition or deferred value, server-side search, or a worker.

Wrong: skeleton 40 px tall replaced by 300 px content.
Right: skeleton with the real content's dimensions.

## Check yourself
1. What are the three phases of INP?
2. Why do layout shifts right after a click not count toward CLS?
3. When should you virtualize a list?

<details><summary>Answers</summary>

1. Input delay, processing time, presentation delay.
2. They're expected results of the user's action (within 500 ms of input), not unexpected movement.
3. When it renders hundreds or thousands of rows at once and scrolling, memory, or render time suffer (and server pagination isn't an option).
</details>

## Sources
- [web.dev — Optimize INP](https://web.dev/articles/optimize-inp)
- [web.dev — Optimize CLS](https://web.dev/articles/optimize-cls)
- [react.dev — useDeferredValue](https://react.dev/reference/react/useDeferredValue)
- [TanStack Virtual](https://tanstack.com/virtual/latest)
- [web.dev — Optimize long tasks](https://web.dev/articles/optimize-long-tasks)
