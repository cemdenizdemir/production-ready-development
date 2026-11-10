---
title: State Management cheatsheet
tech: React 19.2, TanStack Query 5, Orval
version: React 19.2, TanStack Query v5, Orval 8.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# State Management cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Kinds of state
| Kind | Tool | Note |
|:--|:--|:--|
| ⭐ server | TanStack Query | API owns it |
| ⭐ URL | search params | shareable |
| form | React Hook Form | 10-forms |
| client UI | `useState` / `useReducer` | local |
| derived | compute in render | never store |
| shared client-only | context / Zustand / Jotai | rare |
| preferences | `localStorage` | not tokens |

## URL state (Next.js)
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `useSearchParams()` | read params | client |
| `searchParams` prop | read on server | pages |
| `router.push` / `router.replace` | write | replace while typing |
| `<Link href="?page=2">` | navigation | |
| ⭐ schema parse with `.catch()` | validated params | defaults |
| `{ scroll: false }` | keep scroll | |

## Query basics
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `useQuery({ queryKey, queryFn })` | fetch + cache | v5 object form |
| ⭐ `queryFn({ signal })` | abortable fetch | |
| ⭐ `staleTime` | fresh duration | default 0 |
| ⭐ `gcTime` | unused data lifetime | default 5 min |
| `enabled` | wait for inputs | dependent queries |
| `select` | transform per component | |
| `placeholderData` | temporary data | `keepPreviousData` |
| `initialData` | seed cache | counts as real data |
| `isPending` / `isError` / `isSuccess` | status | |
| `isFetching` | any fetch | background spinner |
| `refetch()` | manual refetch | retry buttons |
| `useQueries({ queries })` | dynamic parallel queries | |
| `useSuspenseQuery` | suspends | Suspense boundaries |

## Keys and options
| Item | Does | Note |
|:--|:--|:--|
| ⭐ hierarchical keys | `["products", "detail", id]` | partial match invalidation |
| include all inputs | `["products", "list", filters]` | |
| ⭐ `queryOptions({...})` | reusable options | typed |
| `prefetchQuery(opts)` | warm the cache | hover, server |
| `ensureQueryData(opts)` | get or fetch | loaders |
| `getQueryData(key)` / `setQueryData(key, fn)` | read / write cache | |

## Orval
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `orval.config.ts` + `defineConfig` | generator config | |
| `input.target` | OpenAPI document | from ASP.NET Core build |
| `client: "react-query"` | TanStack Query hooks | |
| `httpClient: "fetch"` | fetch-based calls | |
| ⭐ `override.mutator` | your fetcher | credentials, errors |
| `mode: "tags-split"` | file per tag | |
| `client: "zod"` | Zod schemas | separate output |
| ⭐ `useGetOrder(id, { query })` | generated query hook | from operationId |
| `getGetOrderQueryKey(id)` | generated key | invalidation |
| `getGetOrderQueryOptions(id)` | generated options | prefetch |
| `useCreateOrder({ mutation })` | generated mutation hook | |
| `mock: true` | MSW handlers | 13-testing |
| never edit generated files | regenerate + diff in CI | |

## Mutations
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `useMutation({ mutationFn })` | writes | |
| `mutate` / `mutateAsync` | trigger | async needs try/catch |
| `isPending` | in flight | disable buttons |
| `variables` | what was sent | optimistic UI |
| `onMutate` → context | before request | snapshot |
| `onError(err, vars, ctx)` | rollback | |
| `onSuccess` / `onSettled` | after | invalidate |
| `mutationKey` + `useMutationState` | observe mutations | global indicators |
| retry | 0 by default | |

## Cache updates
| Strategy | Code | Note |
|:--|:--|:--|
| ⭐ invalidate | `invalidateQueries({ queryKey })` | narrow keys |
| set from response | `setQueryData(key, data)` | no refetch |
| remove | `removeQueries({ queryKey })` | deletes |
| cancel | `cancelQueries({ queryKey })` | before optimistic writes |
| reset | `resetQueries` | back to initial |

## Optimistic updates
| Style | How | Use |
|:--|:--|:--|
| ⭐ via `variables` | render pending item | adding to lists |
| via cache | `onMutate` snapshot + `setQueryData`, rollback in `onError` | edits |
| ⭐ always `onSettled` invalidate | converge on server truth | |
| `useOptimistic` | component-local | React 19 |
| avoid for | payments, stock, rejections | |

## Pagination
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `keepPreviousData` | keep page visible | `isPlaceholderData` |
| prefetch next page | instant clicks | |
| ⭐ `useInfiniteQuery` | cursor feeds | |
| `initialPageParam` | first cursor | required in v5 |
| `getNextPageParam` | next cursor | `undefined` = end |
| `fetchNextPage` / `hasNextPage` / `isFetchingNextPage` | controls | |
| `maxPages` | memory cap | |
| `data.pages.flatMap` | items | |

## Errors, retries, network
| Item | Default / does | Note |
|:--|:--|:--|
| ⭐ `retry` | 3 for queries | skip 4xx |
| `retryDelay` | exponential backoff | `Retry-After` for 429 |
| `throwOnError` | throw to boundary | page-level |
| `QueryErrorResetBoundary` | reset after boundary | |
| `QueryCache({ onError })` | global handler | Sentry, toasts |
| ⭐ `refetchOnWindowFocus` | true | raise `staleTime` instead of disabling |
| `refetchOnReconnect` | true | |
| `refetchInterval` | polling | or SSE |
| `networkMode` | `online` pauses offline | |

## Setup and tools
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `QueryClientProvider` | provide client | |
| `useState(makeClient)` | one client per session | not per render |
| `defaultOptions` | global defaults | staleTime, retry |
| ⭐ React Query Devtools | inspect cache | dev only |
| `HydrationBoundary` + `dehydrate` | server prefetch → client | 06-rendering |
| ESLint plugin `@tanstack/eslint-plugin-query` | key/deps mistakes | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| query data copied to state | stale copies | use `data` |
| keys missing inputs | cache collisions | full keys |
| `new QueryClient()` in render | cache lost | `useState` |
| invalidate everything | refetch storms | narrow keys |
| optimistic without cancel | overwritten | `cancelQueries` |
| retrying 404 | slow errors | retry predicate |
| `staleTime: 0` everywhere | focus refetch storms | sensible defaults |
| editing Orval output | lost on regen | fix the API |
| filters in `useState` | not shareable | URL |

## Sources
| Source | Link |
|:--|:--|
| TanStack Query docs | https://tanstack.com/query/latest/docs/framework/react/overview |
| Important defaults | https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults |
| Query keys | https://tanstack.com/query/latest/docs/framework/react/guides/query-keys |
| Optimistic updates | https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates |
| Infinite queries | https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries |
| Orval React Query | https://orval.dev/docs/guides/react-query |
| Orval v8 | https://orval.dev/docs/versions/v8 |
| TkDodo's blog | https://tkdodo.eu/blog/practical-react-query |
