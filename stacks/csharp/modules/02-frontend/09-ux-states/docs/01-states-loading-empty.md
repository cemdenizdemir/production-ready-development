---
title: Screen states, loading UX, empty states, and Suspense
tech: React 19.2, TanStack Query 5, Tailwind CSS 4
version: TanStack Query v5, React 19.2
date: 2026-11-09
covers: [1, 2, 4, 8]
---
# Screen states, loading UX, empty states, and Suspense
[← Overview](00-overview.md)

## Why it matters
- The order history shows a spinner for 200 ms on every visit, even with cached data; the page "flickers" and feels slower than it is.
- A new customer's "My orders" page is a blank white area. They think the site is broken and contact support.
- A background refetch replaces the whole product list with a spinner every time the tab regains focus.

## Concepts

### The states of a data view
| State | Show | TanStack Query signal |
|:--|:--|:--|
| loading (no data) | skeleton matching the layout | `isPending` |
| ready | data | `isSuccess` |
| refreshing | data + subtle indicator | `isFetching && !isPending` |
| empty | helpful empty state | `isSuccess && data.length === 0` |
| error (no data) | message + retry | `isError && !data` |
| stale error (have data, refetch failed) | data + small "couldn't refresh" notice | `isError && data` |
| partial | the parts that loaded + section-level errors | separate queries/boundaries |
| offline | cached data + offline banner | `onlineManager`, `navigator.onLine` |

### Loading UX
| Choice | When |
|:--|:--|
| ⭐ skeleton | content with a known layout (lists, cards, product page) — same size as the real content |
| spinner | short, unknown-shape waits (inside a button, small widgets) |
| progress bar | long operations with known progress (uploads) |
| nothing | < ~150 ms: delay showing loaders to avoid flicker |
| keep old data | pagination/filter changes (`keepPreviousData`), transitions |

Avoid flicker: delay loaders (`setTimeout` ~150 ms, or CSS `animation-delay`), and once shown, keep them for a minimum (~400 ms) so they don't flash.

### Empty states that help
Explain why it's empty and offer the next step:
| Situation | Message | Action |
|:--|:--|:--|
| first use (no orders yet) | "You haven't ordered yet." | "Browse coffee" link |
| no search results | "No coffee matches 'kenya decaf'." | clear filters, suggestions |
| filtered to nothing | "No light roasts under €10." | "Reset filters" |
| cleared by the user | "Cart is empty." | recently viewed products |

### Suspense-based loading
`useSuspenseQuery` suspends until data exists, so components only handle the ready state; loading UI lives in `<Suspense fallback>` and errors in error boundaries. Data is never `undefined` in the component.
| Pattern | Use |
|:--|:--|
| one boundary per independent section | sections load and fail independently |
| `QueryErrorResetBoundary` + `ErrorBoundary` | retry after error |
| prefetch in Server Components + `HydrationBoundary` | no client waterfall |
| `startTransition` on filter changes | keep old UI instead of falling back to the skeleton |

## Example
`web/src/features/orders/OrdersList.tsx`
```tsx
"use client";
import { useGetOrders } from "@/api/generated/orders/orders";
import { OrdersSkeleton } from "./OrdersSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import Link from "next/link";

export function OrdersList() {
  const q = useGetOrders({ query: { staleTime: 30_000 } });

  if (q.isPending) return <OrdersSkeleton rows={5} />;
  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const orders = q.data;
  if (orders.length === 0) {
    return (
      <div className="grid justify-items-start gap-2">
        <p>You haven't ordered yet.</p>
        <Link href="/coffee" className="underline">Browse coffee</Link>
      </div>
    );
  }

  return (
    <section aria-busy={q.isFetching}>
      {q.isError && <p role="status" className="text-sm">Couldn't refresh. Showing saved data.</p>}
      <ul>{orders.map((o) => <li key={o.id}>#{o.id} · {o.status}</li>)}</ul>
    </section>
  );
}
```
`web/src/features/orders/OrdersSkeleton.tsx`
```tsx
export function OrdersSkeleton({ rows }: { rows: number }) {
  return (
    <ul aria-hidden="true" className="grid gap-2 [animation-delay:150ms]">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="h-14 animate-pulse rounded-card bg-stone-200 motion-reduce:animate-none dark:bg-stone-800" />
      ))}
      <span className="sr-only">Loading orders…</span>
    </ul>
  );
}
```

## Production patterns
- Design every state with the designer: loading, empty (each kind), error, stale, offline.
- Skeletons sized like the content (no CLS), with `motion-reduce` respected.
- Background refreshes never replace data with a loader.
- Suspense boundaries per section, with matching error boundaries.

## Mistakes
Wrong: spinner on `isFetching`.
```tsx
if (q.isFetching) return <Spinner />;     // flickers on every background refetch
```
Right: loader only on `isPending`; subtle indicator for background fetches.

Wrong: an empty `<ul>` for no results.
Right: an empty state with an explanation and next action.

## Check yourself
1. What's the difference between `isPending` and `isFetching`?
2. Why delay showing a loader by ~150 ms?
3. What does `useSuspenseQuery` guarantee about `data`?

<details><summary>Answers</summary>

1. `isPending`: no data yet. `isFetching`: a request is in flight (including background refetches while data exists).
2. Fast responses then show no loader at all, avoiding a flash that makes the page feel slower.
3. It's defined; loading and error states are handled by Suspense and error boundaries outside the component.
</details>

## Sources
- [TanStack Query — Background fetching indicators](https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators)
- [TanStack Query — Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense)
- [NN/g — Skeleton screens](https://www.nngroup.com/articles/skeleton-screens/)
- [NN/g — Empty states](https://www.nngroup.com/articles/empty-state-interface-design/)
