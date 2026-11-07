---
title: Kinds of state and where they live
tech: React 19.2, TanStack Query 5
version: React 19.2, TanStack Query v5
date: 2026-11-07
covers: [1, 8, 9]
---
# Kinds of state and where they live
[← Overview](00-overview.md)

## Why it matters
- A Redux store holds `orders`, `ordersLoading`, `ordersError`, and `ordersLastFetched`, maintained by hand in 14 places. One path forgets to reset `loading`, and a spinner spins forever.
- A user filters a report, shares the link with a colleague, and the colleague sees the unfiltered default. The filter lived only in component state.
- A global context holds the search input's text. Every keystroke re-renders the whole app.

## Concepts

### Five kinds of state
| Kind | Examples | Owner | Tool |
|:--|:--|:--|:--|
| Server | orders, products, current user | the API | TanStack Query (cache) |
| URL | filters, sort, page, selected tab, search query | the address bar | search params |
| Form | field values, touched, errors | the form | React Hook Form ([10-forms](../../10-forms/README.md)) |
| Client UI | open dialog, selected rows, theme, unsaved draft | the component(s) | `useState`, `useReducer`, context |
| Derived | totals, filtered lists, "can submit" | nobody: computed | plain expressions in render |

Decision steps:
1. Can it be computed? → derive it.
2. Does it come from the server? → TanStack Query.
3. Should a link or refresh preserve it? → URL.
4. Is it a form? → form library.
5. Otherwise → local state, lifted only as far as needed; context for app-wide values that rarely change.

### Client state options
| Option | Good for | Watch out |
|:--|:--|:--|
| `useState` | local values | lift only as high as needed |
| `useReducer` | related values with named transitions | |
| Context | theme, locale, current user, feature flags | all consumers re-render on change; split contexts |
| `useSyncExternalStore` | browser APIs, tiny custom stores | |
| Store library (Zustand, Jotai, Redux Toolkit) | large client-only state shared widely (editors, canvases) | also seen; usually unnecessary once server state is in Query |

### URL as state
- Put state in the URL when users expect to **share, bookmark, refresh, or go back** to it.
- Use `replace` (not `push`) for keystroke-level changes like a search box, so Back isn't flooded.
- Validate params: they're user input (`?page=-5`, `?sort=drop_table`).
- Keep defaults out of the URL so links stay short.

## Example
`useSearchParam.ts` — a small, framework-free URL state hook (in Next.js use `useSearchParams` + `router.replace`; also seen: nuqs).
```ts
import { useSyncExternalStore } from 'react';

const URL_EVENT = 'app:urlchange';

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);  // back/forward
  window.addEventListener(URL_EVENT, callback);   // our own replaceState calls
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(URL_EVENT, callback);
  };
}

export function useSearchParam(name: string, fallback = '') {
  const value = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name) ?? fallback,
    () => fallback, // server snapshot
  );

  function setValue(next: string) {
    const url = new URL(window.location.href);
    if (next && next !== fallback) url.searchParams.set(name, next);
    else url.searchParams.delete(name);
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(URL_EVENT));
  }

  return [value, setValue] as const;
}
```
`OrdersPage.tsx` — URL state drives the server query; UI state stays local.
```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParam } from './useSearchParam.ts';
import { ordersQuery } from './orders-queries.ts';

const SORTS = ['newest', 'total'] as const;
type Sort = (typeof SORTS)[number];

export function OrdersPage() {
  const [status, setStatus] = useSearchParam('status', 'all');
  const [rawSort, setSort] = useSearchParam('sort', 'newest');
  const sort: Sort = SORTS.includes(rawSort as Sort) ? (rawSort as Sort) : 'newest'; // validate URL input

  const [selected, setSelected] = useState<Set<string>>(new Set()); // UI state: not shareable

  const { data, isPending, isError } = useQuery(ordersQuery({ status, sort }));

  if (isPending) return <p>Loading orders…</p>;
  if (isError) return <p>Couldn't load orders.</p>;

  const totalCents = data.items.reduce((sum, o) => sum + o.totalCents, 0); // derived

  return (
    <>
      <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
        <option value="all">All</option>
        <option value="paid">Paid</option>
        <option value="shipped">Shipped</option>
      </select>
      <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
        <option value="newest">Newest</option>
        <option value="total">Total</option>
      </select>
      <p>{data.items.length} orders · {selected.size} selected · {(totalCents / 100).toFixed(2)} total</p>
    </>
  );
}
```

## Production patterns
- **Server data never goes into `useState` or a global store** as the source of truth; it lives in the Query cache.
- **Shareable view state in the URL**; validate and default it.
- **Context for rarely changing app-wide values**; one context per concern.
- **Colocate state** with the component that uses it; lift only when a sibling needs it.
- **Introduce a store library only for real client-side complexity** (rich editors, offline-first apps), not to cache API responses.

## Mistakes
Wrong: copying query data into state.
```tsx
const { data } = useQuery(ordersQuery(filters));
const [orders, setOrders] = useState(data); // stale after refetch; two sources of truth
```
Right: use `data` directly; update it through mutations and the cache.

Wrong: filters only in component state; refresh or share loses them. Right: URL search params.

Wrong: unvalidated URL params flow into API calls and UI. Right: parse with an allowlist or schema, fall back to defaults.

Wrong: `pushState` on every keystroke; the Back button replays each character. Right: `replaceState` for typing, `pushState` for deliberate navigation.

## Check yourself
1. Where should the following live: current user, "sort by total", "is the dropdown open", "cart total"?
2. Why does putting server data into a global store cause bugs?
3. When should URL updates use `replace` instead of `push`?

<details>
<summary>Answers</summary>

1. Current user: server state (Query), maybe exposed via context. Sort: URL. Dropdown open: local UI state. Cart total: derived from cart items.
2. You must re-implement caching, staleness, refetching, deduplication, and loading/error tracking by hand, and the copy drifts from the server's truth.
3. For high-frequency or incremental changes (typing a search, dragging a slider) where each step isn't a meaningful history entry.
</details>

## Sources
- [react.dev — Choosing the state structure](https://react.dev/learn/choosing-the-state-structure)
- [TanStack Query — Does this replace client state?](https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state)
- [MDN — `History.replaceState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)
- [Next.js — `useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
