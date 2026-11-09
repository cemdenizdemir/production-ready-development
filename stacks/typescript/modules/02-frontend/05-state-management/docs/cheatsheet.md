---
title: State Management cheatsheet
tech: React 19.2, TanStack Query 5
version: React 19.2, TanStack Query v5
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# State Management cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Where state lives
| Kind | Examples | Tool |
|:--|:--|:--|
| ⭐ Server | orders, user, products | TanStack Query |
| ⭐ URL | filters, sort, page, tab, search | search params |
| Form | values, errors, touched | React Hook Form |
| ⭐ Client UI | open menus, selection, drafts | `useState` / `useReducer` |
| App-wide UI | theme, locale, flags | context |
| ⭐ Derived | totals, filtered lists | compute in render |
| Persistent client | preferences | `localStorage` (non-sensitive) |

## Client state tools
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ `useState` | local state | |
| `useReducer` | named transitions | |
| ⭐ Context | slow-changing global values | split per concern |
| `useSyncExternalStore` | external/browser stores | |
| Zustand / Jotai / Redux Toolkit | big client-only state | also seen |
| XState | complex state machines | also seen |

## URL state
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `URLSearchParams` | read/write query params | |
| ⭐ `history.replaceState` | update without a history entry | typing |
| `history.pushState` | new history entry | deliberate navigation |
| `popstate` event | back/forward happened | |
| Next.js `useSearchParams` + `router.replace` | URL state in Next | Client Components |
| Validate params | allowlist / schema | user input |
| Defaults omitted | shorter links | |
| nuqs | typed URL state hooks | also seen |

## QueryClient setup
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `new QueryClient({ defaultOptions })` | the cache | one per app (per request on servers) |
| ⭐ `<QueryClientProvider client>` | provide it | |
| `useQueryClient()` | access it in components | |
| `queryClient.clear()` | wipe cache | logout |
| `@tanstack/react-query-devtools` | inspect cache | dev only |
| `@tanstack/eslint-plugin-query` | lint keys and usage | |

## useQuery options
| Option | What it does | Default / note |
|:--|:--|:--|
| ⭐ `queryKey` | cache identity | include all inputs |
| ⭐ `queryFn({ signal, queryKey })` | fetcher | must throw on errors |
| ⭐ `staleTime` | fresh duration | 0 |
| ⭐ `gcTime` | unused data lifetime | 5 min (was `cacheTime`) |
| `enabled` | run or not | |
| ⭐ `skipToken` | type-safe disable | `queryFn: id ? fn : skipToken` |
| `select` | derive data per observer | memoized |
| ⭐ `placeholderData: keepPreviousData` | keep old data during key change | pagination, filters |
| `initialData` / `initialDataUpdatedAt` | seed the cache | |
| `retry` / `retryDelay` | retry policy | 3, exponential |
| `refetchOnWindowFocus` / `OnReconnect` / `OnMount` | auto refetch | true |
| `refetchInterval` | polling | |
| `throwOnError` | throw to error boundary | was `useErrorBoundary` |
| `networkMode` | `online` / `always` / `offlineFirst` | |
| `structuralSharing` | keep references of unchanged data | true |
| `meta` | custom info for global handlers | |

## Query result
| Field | Means |
|:--|:--|
| ⭐ `data` | the data (or undefined) |
| ⭐ `isPending` | no data yet |
| ⭐ `isError` / `error` | last fetch failed |
| `isSuccess` | data available |
| ⭐ `isFetching` | request in flight |
| `isLoading` | first load in flight |
| `isRefetching` | background refetch |
| `isPlaceholderData` | showing placeholder |
| `isStale` | past `staleTime` |
| `status` / `fetchStatus` | `pending\|error\|success` / `fetching\|paused\|idle` |
| `dataUpdatedAt` / `errorUpdatedAt` | timestamps |
| `refetch()` | manual refetch |

## Query hooks and helpers
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `useQuery` | read server data | |
| ⭐ `queryOptions({...})` | reusable typed options | key + fn together |
| ⭐ `useSuspenseQuery` | Suspense version | data always defined |
| `useQueries({ queries, combine })` | dynamic parallel queries | |
| `useSuspenseQueries` | parallel + Suspense | |
| ⭐ `useInfiniteQuery` | paged data in one entry | |
| `infiniteQueryOptions` | reusable infinite options | |
| `useIsFetching()` / `useIsMutating()` | global activity indicators | |
| `QueryErrorResetBoundary` | reset errors with boundaries | |
| `HydrationBoundary` + `dehydrate` | SSR hydration | Next.js |

## Query keys
| Pattern | Example | Note |
|:--|:--|:--|
| ⭐ Arrays | `['orders', 'list', { status }]` | serializable |
| ⭐ Key factory | `orderKeys.list(filters)` | one place per feature |
| Hierarchy | `all → lists → list(f)`, `all → detail(id)` | targeted invalidation |
| Prefix matching | `invalidateQueries({ queryKey: ['orders'] })` | all orders queries |
| `exact: true` | only that key | |
| Object key order | doesn't matter (hashed deterministically) | |

## QueryClient methods
| Method | What it does |
|:--|:--|
| ⭐ `invalidateQueries({ queryKey })` | mark stale + refetch active |
| ⭐ `setQueryData(key, updater)` | write cache (immutably) |
| `getQueryData(key)` | read cache |
| ⭐ `cancelQueries({ queryKey })` | cancel in-flight fetches |
| ⭐ `prefetchQuery(options)` | fetch ahead into cache |
| `ensureQueryData(options)` | return cached or fetch |
| `fetchQuery(options)` | fetch and return (throws) |
| `refetchQueries` / `resetQueries` / `removeQueries` | refetch / reset to initial / drop |
| `setQueriesData(filters, updater)` | update many entries |
| `getQueryState(key)` | status metadata |

## Mutations
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `useMutation({ mutationFn })` | run writes | |
| ⭐ `mutate(vars)` / `mutateAsync(vars)` | fire / await | try/catch with async |
| ⭐ `isPending` / `variables` | pending + its input | optimistic UI |
| `onMutate` | before request | return rollback context |
| `onError(err, vars, ctx)` | rollback | |
| `onSuccess(data, vars, ctx)` | write response | |
| ⭐ `onSettled` | always | invalidate |
| `mutationKey` | identify mutations | `useMutationState` filters |
| `useMutationState({ filters, select })` | pending mutations anywhere | |
| `retry` | default 0 | only idempotent writes |
| `scope: { id }` | run mutations with same scope serially | |
| `reset()` | clear mutation state | |

## Optimistic updates
| Step | Code |
|:--|:--|
| ⭐ Cancel | `await qc.cancelQueries({ queryKey })` |
| ⭐ Snapshot | `const previous = qc.getQueryData(queryKey)` |
| ⭐ Update | `qc.setQueryData(queryKey, (old) => …)` |
| ⭐ Return context | `return { previous }` |
| ⭐ Roll back | `onError: (e, v, ctx) => qc.setQueryData(queryKey, ctx.previous)` |
| ⭐ Resync | `onSettled: () => qc.invalidateQueries({ queryKey })` |
| UI-only variant | render `mutation.variables` while `isPending` |

## Infinite queries
| Option / field | What it does |
|:--|:--|
| ⭐ `initialPageParam` | first page param (required) |
| ⭐ `getNextPageParam(lastPage, allPages)` | next param or `undefined` |
| `getPreviousPageParam` | bidirectional lists |
| `maxPages` | cap cached pages |
| ⭐ `data.pages` / `data.pageParams` | pages and their params |
| ⭐ `fetchNextPage()` / `hasNextPage` / `isFetchingNextPage` | load more |

## Defaults worth remembering
| Default | Value |
|:--|:--|
| `staleTime` | 0 (immediately stale) |
| `gcTime` | 5 minutes |
| Query `retry` | 3 with exponential backoff |
| Mutation `retry` | 0 |
| Refetch on focus / reconnect / mount | yes (if stale) |
| `networkMode` | `online` |
| Structural sharing | on |

## v4 → v5 renames
| v4 | v5 |
|:--|:--|
| `cacheTime` | `gcTime` |
| `isLoading` (no data) | `isPending` |
| `useErrorBoundary` | `throwOnError` |
| `keepPreviousData: true` | `placeholderData: keepPreviousData` |
| `useQuery(key, fn, opts)` | `useQuery({ queryKey, queryFn, ... })` |
| `onSuccess` on `useQuery` | removed: use effects or global cache callbacks |
| `status: 'loading'` | `status: 'pending'` |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Query data copied to state | stale copy | use `data` directly |
| Missing key variables | wrong data shown | all inputs in key |
| Fetcher doesn't throw | errors look like data | throw on `!res.ok` |
| `staleTime: 0` everywhere | refetch storms | sensible defaults |
| No `cancelQueries` before optimistic | overwritten by old data | cancel first |
| Mutating cached objects | no re-render, corrupt cache | immutable `setQueryData` |
| Retrying 4xx | slow error screens | retry function |
| Offset pagination for feeds | duplicates/skips | cursors |
| Unbounded infinite queries | memory growth | `maxPages`, virtualization |
| Shared QueryClient across SSR requests | data leaks between users | one client per request on servers |
| Filters only in state | lost on refresh/share | URL |

## Sources
| Source | Link |
|:--|:--|
| TanStack Query docs | https://tanstack.com/query/latest/docs/framework/react/overview |
| Important defaults | https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults |
| Optimistic updates | https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates |
| Migrating to v5 | https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5 |
| TkDodo's blog | https://tkdodo.eu/blog/practical-react-query |
| react.dev Managing state | https://react.dev/learn/managing-state |
