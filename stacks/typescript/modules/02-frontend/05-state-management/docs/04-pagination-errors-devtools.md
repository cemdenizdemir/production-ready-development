---
title: Pagination, errors, retries, and devtools
tech: React 19.2, TanStack Query 5
version: TanStack Query v5, @tanstack/react-query-devtools v5
date: 2026-11-07
covers: [5, 10, 11]
---
# Pagination, errors, retries, and devtools
[← Overview](00-overview.md)

## Why it matters
- An infinite feed keeps every page in memory forever. After an hour of scrolling the tab uses 2 GB and crashes on low-end phones.
- A 404 for a deleted record is retried three times with backoff; the user stares at a spinner for 7 seconds before seeing "not found".
- Nobody understands why data refetches "randomly". It's window-focus refetching, and the devtools would have shown it in seconds.

## Concepts

### Paginated vs infinite queries
| | Paginated (`useQuery` + page in key) | Infinite (`useInfiniteQuery`) |
|:--|:--|:--|
| UI | page numbers, next/prev | "load more", infinite scroll |
| Cache | one entry per page | one entry holding many pages |
| Key | `['orders', { page }]` | `['feed']` |
| Smooth transitions | `placeholderData: keepPreviousData` | append pages |
| API style | offset or cursor | cursor (recommended) |

`useInfiniteQuery` needs `initialPageParam` and `getNextPageParam(lastPage)` (return `undefined` when there are no more pages). It returns `data.pages`, `fetchNextPage`, `hasNextPage`, and `isFetchingNextPage`. `maxPages` caps how many pages stay in the cache.

### Errors and retries
| Default | Value | Change it when |
|:--|:--|:--|
| Query `retry` | 3 attempts with exponential backoff | don't retry 4xx (client errors) |
| Mutation `retry` | 0 | retry only idempotent mutations |
| `refetchOnWindowFocus` | true | turn off for expensive or rarely changing data |
| `refetchOnReconnect` | true | |
| `networkMode` | `'online'`: pause when offline | `'always'` for local-only fetchers, `'offlineFirst'` for PWAs |
| `throwOnError` | false | true (or a function) to let an error boundary handle it |

Show errors near the data, keep stale data visible when a background refetch fails, and give a retry action. `QueryErrorResetBoundary` resets queries when an error boundary retries.

### Devtools
`@tanstack/react-query-devtools` shows every query key, its status (fresh, stale, fetching, paused, inactive), data, observers, and lets you refetch, invalidate, reset, or trigger loading/error states. It's tree-shaken out of production builds by default.

## Example
`Feed.tsx` — cursor-based infinite scroll with a memory cap.
```tsx
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from './api.ts';

type Page = { items: { id: string; text: string }[]; nextCursor: string | null };

const feedQuery = infiniteQueryOptions({
  queryKey: ['feed'],
  queryFn: ({ pageParam, signal }) =>
    api<Page>(`/feed?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`, { signal }),
  initialPageParam: null as string | null,
  getNextPageParam: (last) => last.nextCursor ?? undefined, // undefined = no more pages
  maxPages: 10,                                             // keep memory bounded
});

export function Feed() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, isError, refetch } =
    useInfiniteQuery(feedQuery);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) return <p>Loading…</p>;
  if (isError) return <p role="alert">Couldn't load the feed. <button onClick={() => refetch()}>Retry</button></p>;

  return (
    <>
      <ul>{data.pages.flatMap((p) => p.items).map((i) => <li key={i.id}>{i.text}</li>)}</ul>
      <div ref={sentinel} />
      {isFetchingNextPage && <p>Loading more…</p>}
      {!hasNextPage && <p>You're all caught up.</p>}
    </>
  );
}
```
`query-client.ts` — retry policy that respects HTTP semantics, and devtools.
```tsx
import { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: (failureCount, error) => {
        if (error instanceof HttpError && error.status >= 400 && error.status < 500 && error.status !== 429) {
          return false;                  // 404, 401, 403, 422: retrying won't help
        }
        return failureCount < 3;
      },
    },
  },
});

export function Devtools() {
  return <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />;
}
```
Your `api` helper should throw `HttpError` with the status so the retry function can inspect it.

## Production patterns
- **Cursor pagination for feeds** (stable under inserts), offset pagination only for small admin tables with page numbers ([03-backend/02-api-design](../../../03-backend/02-api-design/README.md)).
- **Cap infinite queries with `maxPages`** and virtualize long lists ([07-performance](../../07-performance/README.md)).
- **Don't retry client errors**; do retry network errors, 5xx, and 429 (respect `Retry-After` if your API sends it).
- **Keep stale data on background errors**, with a subtle "couldn't refresh" notice.
- **Devtools in development builds**, and the ESLint plugin in CI.

## Mistakes
Wrong: one entry per page for an infinite feed, glued together in state.
```tsx
const [items, setItems] = useState<Item[]>([]);
useEffect(() => { fetchPage(page).then((p) => setItems((prev) => [...prev, ...p])); }, [page]);
```
Right: `useInfiniteQuery` with `getNextPageParam`.

Wrong: retrying 404s three times. Right: a `retry` function that skips 4xx (except 429).

Wrong: a global error toast for every failed query, including background refetches. Users see alarms for things they didn't do.
Right: inline errors for initial loads; quiet handling (or a small notice) for background refetch failures.

Wrong: offset pagination for a live feed; new items shift offsets and users see duplicates or skip items. Right: cursor-based pages.

## Check yourself
1. What must `getNextPageParam` return when there are no more pages?
2. Which HTTP errors are worth retrying automatically?
3. A query refetches every time you switch browser tabs. Why, and how do you change it?

<details>
<summary>Answers</summary>

1. `undefined` (or `null`), which sets `hasNextPage` to false.
2. Network failures, timeouts, 5xx server errors, and 429 (after waiting). Not other 4xx errors such as 400, 401, 403, 404, 422.
3. `refetchOnWindowFocus` is true by default and the data is stale (`staleTime` 0). Raise `staleTime` for that query, or set `refetchOnWindowFocus: false` where focus refetching isn't useful.
</details>

## Sources
- [TanStack Query — Infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
- [TanStack Query — Paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries)
- [TanStack Query — Query retries](https://tanstack.com/query/latest/docs/framework/react/guides/query-retries)
- [TanStack Query — Network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)
- [TanStack Query — Devtools](https://tanstack.com/query/latest/docs/framework/react/devtools)
