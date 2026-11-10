---
title: Pagination, errors and retries, devtools
tech: TanStack Query 5, React 19.2
version: TanStack Query v5, @tanstack/react-query-devtools 5
date: 2026-11-09
covers: [5, 10, 11]
---
# Pagination, errors and retries, devtools
[← Overview](00-overview.md)

## Why it matters
- The order history jumps to a spinner every time the user clicks "Next page", losing their place.
- A 404 for a deleted product is retried three times with backoff; the page takes 7 seconds to say "not found".
- A user on a train loses connection; every query errors, then nothing recovers when the network comes back.

## Concepts

### Paginated queries
```ts
const { data, isPlaceholderData } = useQuery({
  queryKey: ["orders", "list", { page }],
  queryFn: ({ signal }) => getOrders({ page, pageSize: 20 }, { signal }),
  placeholderData: keepPreviousData,       // keep showing page N while N+1 loads
});
```
Prefetch the next page when `data.hasNext` to make clicks instant.

### Infinite queries (cursor pagination)
The ASP.NET Core API returns `{ items, nextCursor }` (03-backend/02-api-design).
```ts
const q = useInfiniteQuery({
  queryKey: ["products", "feed", filters],
  queryFn: ({ pageParam, signal }) => getProducts({ ...filters, cursor: pageParam }, { signal }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.nextCursor ?? undefined,
  maxPages: 10,                             // cap memory for long scrolls
});
const items = q.data?.pages.flatMap((p) => p.items) ?? [];
```
`fetchNextPage()` from an `IntersectionObserver` sentinel or a "Load more" button (more accessible).

### Errors and retries
Defaults: queries retry **3 times** with exponential backoff; mutations don't retry.
| Policy | Setting |
|:--|:--|
| ⭐ don't retry client errors | `retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 3` |
| honour `Retry-After` on 429 | custom `retryDelay` reading the error's header value |
| error boundaries for page-level failures | `throwOnError: true` or `useSuspenseQuery` + `QueryErrorResetBoundary` |
| inline errors for sections | `isError` + message + retry button (`refetch()`) |
| global reporting | `QueryCache({ onError })` → Sentry, toast for background refetch failures |

### Refetching and network mode
| Default | Effect | Change when |
|:--|:--|:--|
| `refetchOnWindowFocus: true` | refresh stale data when the tab regains focus | data rarely changes → longer `staleTime` instead of turning it off |
| `refetchOnReconnect: true` | refresh after reconnect | |
| `refetchOnMount: true` | refresh stale data on mount | |
| `networkMode: "online"` | pause fetches while offline, resume on reconnect | `"always"` for local/mock APIs |
| `refetchInterval` | polling | live order status (or SSE, 01-foundations/02) |

### Devtools
`@tanstack/react-query-devtools` shows every query: key, status, stale/fresh, observers, data, and lets you invalidate, refetch, or trigger error/loading states. Dev-only (it's tree-shaken out of production builds by default).

## Example
`web/src/app/providers.tsx`
```tsx
"use client";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import * as Sentry from "@sentry/nextjs";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/api/fetcher";

function makeClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!(error instanceof ApiError && error.status < 500)) Sentry.captureException(error, { extra: { key: query.queryKey } });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 3,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);        // one client per browser session, not per render
  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## Production patterns
- `keepPreviousData` for numbered pages; infinite queries with `maxPages` for feeds.
- Never retry 4xx; respect `Retry-After` for 429; report 5xx and network errors centrally.
- Longer `staleTime` for slow-changing data (catalog) and short for volatile data (stock, order status).
- One `QueryClient` per browser session (created in `useState`), and a fresh one per request on the server (06-rendering).

## Mistakes
Wrong: creating the client during render.
```tsx
<QueryClientProvider client={new QueryClient()}>   // new empty cache on every render
```
Right: `const [client] = useState(makeClient)`.

Wrong: disabling `refetchOnWindowFocus` globally to "fix" too many requests.
Right: raise `staleTime` for data that doesn't change often.

## Check yourself
1. What does `placeholderData: keepPreviousData` change for the user?
2. Why shouldn't a 404 be retried?
3. What happens to queries when the browser goes offline with the default network mode?

<details><summary>Answers</summary>

1. The previous page stays visible (with `isPlaceholderData` true) while the next page loads, instead of a spinner.
2. It's a client error that won't change on retry; retrying only delays the "not found" state.
3. They pause instead of failing and resume (refetch) when the connection comes back.
</details>

## Sources
- [TanStack Query — Paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries)
- [TanStack Query — Infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
- [TanStack Query — Query retries](https://tanstack.com/query/latest/docs/framework/react/guides/query-retries)
- [TanStack Query — Network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)
- [TanStack Query — Devtools](https://tanstack.com/query/latest/docs/framework/react/devtools)
