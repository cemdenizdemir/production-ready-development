---
title: Screen states, loading, empty states, and Suspense
tech: React 19.2, TanStack Query 5, Tailwind CSS 4
version: React 19.2, TanStack Query v5, Tailwind CSS 4.3
date: 2026-11-07
covers: [1, 2, 4, 8]
---
# Screen states, loading, empty states, and Suspense
[← Overview](00-overview.md)

## Why it matters
- A dashboard shows "0 orders" while data is still loading. A merchant panics and calls support, thinking their shop is broken.
- A spinner flashes for 80 ms on every filter change; the page feels jittery and cheap.
- A new user lands on an empty project list with no explanation and no button to create one, and churns on day one.

## Concepts

### The states of a data view
| State | Show | TanStack Query signal |
|:--|:--|:--|
| Loading (first time) | skeleton that matches the layout | `isPending` |
| Success | the data | `isSuccess` |
| Empty | helpful empty state with an action | success with zero items |
| Refreshing | the data + a subtle indicator | `isFetching && !isPending` |
| Placeholder (new filter/page loading) | previous data, slightly dimmed | `isPlaceholderData` |
| Error, nothing cached | error state with retry | `isError && !data` |
| Error, data cached | data + "couldn't refresh" notice | `isError && data` |
| Partial | the parts that loaded, errors for the rest | separate queries/boundaries |
| Offline | cached data + offline banner | `fetchStatus === 'paused'` |

Never show "0" or "no results" while loading: that's a lie, not a state.

### Loading UX
| Situation | Pattern |
|:--|:--|
| Page/section loading | skeleton with the final layout's shape (no layout shift when data arrives) |
| Button action | spinner or "Saving…" in the button; button disabled |
| Long operation (> 10 s) | progress (determinate if possible), allow leaving and notify when done |
| Fast responses | wait ~200–300 ms before showing any loader; avoids a flash |
| Shown loader | keep it at least ~300–500 ms once visible; avoids flicker |
| Background refresh | small indicator, never replace content |

Mark loading regions with `aria-busy="true"`, and respect reduced motion for shimmer animations.

### Empty states
| Kind | Content |
|:--|:--|
| First use | what this area is for + the primary action ("Create your first project") |
| No results | the search/filters used + a way to clear them |
| Cleared / done | positive confirmation ("All caught up") |
| No permission | why it's empty + who to ask |

### Suspense with TanStack Query
- `useSuspenseQuery` suspends until data exists, so `data` is always defined: no `isPending` branches.
- Place `<Suspense>` boundaries around **independent** sections, so each shows its own skeleton.
- Changing the query key would suspend again; wrap the change in `startTransition` (or use `useDeferredValue`) to keep showing the old data instead.
- Pair each Suspense boundary with an error boundary (lesson 02).

## Example
`OrdersSection.tsx` — explicit states with `useQuery`.
```tsx
import { useQuery } from '@tanstack/react-query';
import { ordersQuery } from './orders-queries.ts';
import { useDelayedFlag } from './useDelayedFlag.ts';

export function OrdersSection({ filters }: { filters: { status: string; sort: 'newest' | 'total' } }) {
  const { data, isPending, isError, isFetching, isPlaceholderData, refetch } = useQuery(ordersQuery(filters));
  const showSkeleton = useDelayedFlag(isPending, 250); // no flash for fast responses

  if (isPending) return showSkeleton ? <OrdersSkeleton /> : null;
  if (isError && !data) return <ErrorState title="Couldn't load orders" onRetry={() => refetch()} />;

  if (data.items.length === 0) {
    return filters.status !== 'all' ? (
      <EmptyState title="No orders match these filters" action={<a href="/orders">Clear filters</a>} />
    ) : (
      <EmptyState title="No orders yet" description="Orders appear here as soon as customers check out."
        action={<a href="/products">Share your shop</a>} />
    );
  }

  return (
    <section aria-busy={isFetching} className={isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
      {isFetching && !isPlaceholderData && <span className="text-sm text-gray-500" role="status">Updating…</span>}
      <OrderTable orders={data.items} />
    </section>
  );
}

function OrdersSkeleton() {
  return (
    <ul aria-hidden="true" className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="h-12 animate-pulse rounded-md bg-gray-200 motion-reduce:animate-none" />
      ))}
    </ul>
  );
}
```
`useDelayedFlag.ts`
```ts
import { useEffect, useState } from 'react';

export function useDelayedFlag(active: boolean, delayMs: number) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) return setShow(false);
    const timer = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
  return show;
}
```
The same view with Suspense:
```tsx
import { Suspense, useState, useTransition } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

function OrdersList({ status }: { status: string }) {
  const { data } = useSuspenseQuery(ordersQuery({ status, sort: 'newest' })); // data always defined
  return data.items.length ? <OrderTable orders={data.items} /> : <EmptyState title="No orders yet" />;
}

export function OrdersPage() {
  const [status, setStatus] = useState('all');
  const [isPending, startTransition] = useTransition();
  return (
    <>
      <StatusFilter value={status} onChange={(s) => startTransition(() => setStatus(s))} /> {/* keeps old list visible */}
      <div className={isPending ? 'opacity-60' : ''}>
        <QueryErrorBoundary>
          <Suspense fallback={<OrdersSkeleton />}>
            <OrdersList status={status} />
          </Suspense>
        </QueryErrorBoundary>
      </div>
    </>
  );
}
```
`QueryErrorBoundary` is built in lesson 02.

## Production patterns
- **Design all states with the designer**, per component, before building: loading, empty (each kind), error, partial, offline.
- **Skeletons match the final layout** so content doesn't jump (CLS).
- **Delay loaders slightly and keep them briefly**; avoid flashes and flicker.
- **Keep showing data during refetches and filter changes** (`placeholderData`, transitions).
- **Empty states always offer a next step.**

## Mistakes
Wrong: rendering zeros while loading.
```tsx
const count = data?.items.length ?? 0;
return <p>{count} orders</p>; // "0 orders" during load
```
Right: handle `isPending` first.

Wrong: replacing content with a spinner on every background refetch.
```tsx
if (isFetching) return <Spinner />;
```
Right: `isPending` for the skeleton; `isFetching` only for a subtle indicator.

Wrong: a full-page spinner for a slow sidebar widget. Right: a Suspense boundary (or local state) for that widget only.

Wrong: "No data" as the empty state. Right: explain and offer the action.

## Check yourself
1. What's the difference between `isPending` and `isFetching`, and how should each look?
2. Why delay showing a loader by ~250 ms?
3. How do you keep the old list visible when a filter change would suspend?

<details>
<summary>Answers</summary>

1. `isPending`: no data yet → skeleton. `isFetching`: a request is running, possibly in the background with data on screen → keep the data, show a subtle indicator.
2. Most responses are fast; flashing a loader for 80 ms looks like a glitch. Waiting a moment means fast loads show nothing until content appears.
3. Wrap the state change in `startTransition` (or use `useDeferredValue`), so React keeps the current UI while the new data loads instead of showing the Suspense fallback.
</details>

## Sources
- [TanStack Query — Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense)
- [TanStack Query — Placeholder query data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data)
- [Nielsen Norman Group — Skeleton screens 101](https://www.nngroup.com/articles/skeleton-screens/)
- [Nielsen Norman Group — Designing empty states](https://www.nngroup.com/articles/empty-state-interface-design/)
- [react.dev — Preventing unwanted fallbacks with transitions](https://react.dev/reference/react/Suspense#preventing-already-revealed-content-from-hiding)
