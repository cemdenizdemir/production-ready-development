---
title: UX States & Error Handling cheatsheet
tech: React 19.2, TanStack Query 5, Tailwind CSS 4
version: React 19.2, TanStack Query v5, Tailwind CSS 4.3, Sentry JS SDK 10
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
---
# UX States & Error Handling cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## States
| State | Show | Signal |
|:--|:--|:--|
| ⭐ loading | skeleton | `isPending` |
| ready | data | `isSuccess` |
| refreshing | data + subtle indicator | `isFetching && !isPending` |
| ⭐ empty | explanation + next step | `data.length === 0` |
| ⭐ error | message + retry | `isError && !data` |
| stale error | data + notice | `isError && data` |
| partial | loaded parts + section errors | per-section queries |
| offline | cached data + banner | `onlineManager` |

## Loading UX
| Item | Use | Note |
|:--|:--|:--|
| ⭐ skeleton | known layout | same size as content |
| spinner | small/unknown waits | buttons |
| progress bar | known progress | uploads |
| delay ~150 ms | avoid flicker | `animation-delay` |
| minimum ~400 ms | avoid flash once shown | |
| `keepPreviousData` | paging/filtering | |
| `startTransition` | keep old UI | |
| `aria-busy` | region updating | |
| `motion-reduce:animate-none` | respect preference | Tailwind |

## Empty states
| Kind | Message + action | Note |
|:--|:--|:--|
| first use | "No orders yet" + browse | |
| no results | echo query + clear filters | |
| filtered to nothing | reset filters | |
| cleared | suggestions | recently viewed |

## Suspense loading
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `useSuspenseQuery` | data always defined | |
| `<Suspense fallback>` per section | independent loading | |
| `QueryErrorResetBoundary` | reset after error | |
| `ErrorBoundary` | section errors | |
| `HydrationBoundary` | server prefetch | no waterfalls |
| `loading.tsx` | route-level | Next.js |

## Error layers
| Layer | UI | Note |
|:--|:--|:--|
| field | inline message | `ValidationProblemDetails` |
| mutation | near the action | keep input |
| query | section error + retry | |
| boundary | section fallback | render errors |
| `error.tsx` / `global-error.tsx` | route/root | Next.js |
| `not-found.tsx` | helpful 404 | |

## API errors → messages
| Status | Message | Note |
|:--|:--|:--|
| 400/422 | field errors | |
| 401 | sign in again | keep return URL |
| 403 | no access | |
| 404 | not found / not yours | |
| 409 | conflict explained | use `code` |
| 412 | changed by someone else | reload |
| 429 | wait and retry | `Retry-After` |
| 5xx / network | try again + reference | `traceId` |

## Error message parts
| Part | Example |
|:--|:--|
| ⭐ what happened | "We couldn't place your order." |
| why | "One item is out of stock." |
| ⭐ what to do | "Remove it or pick another size." |
| reference | "Reference: 4f2a9c1e" |

## Feedback
| Pattern | Use | A11y |
|:--|:--|:--|
| inline | specific results | `role="status"` |
| ⭐ toast | brief confirmation | live region, ≥ 5 s with actions |
| banner | page-wide state | status/alert |
| dialog | must decide | focus managed |
| button states | pending/done | text + `aria-disabled` |

## Reporting (Sentry)
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `@sentry/nextjs` | Next.js SDK | v10 |
| `instrumentation-client.ts` | client init | |
| `release` | commit/image tag | |
| `environment` | staging/production | |
| `tracePropagationTargets` | link to API traces | `/api/` only |
| `sendDefaultPii: false` | no PII | |
| tags | route, feature, `traceId` | |
| hashed user ID | identify without PII | |
| `tracesSampleRate` | perf sampling | 0.1 typical |
| Session Replay | with masking | 13-testing-monitoring |

## Optimistic and undo
| Item | Use | Note |
|:--|:--|:--|
| ⭐ optimistic | toggles, quantities, notes | rollback ready |
| not optimistic | payments, orders, stock | |
| ⭐ undo toast | reversible actions | ~6 s window |
| delayed commit | undo before request | |
| soft delete + restore | longer undo | API support |
| `useOptimistic` | component-local | React 19 |

## Destructive actions
| Item | Rule | Note |
|:--|:--|:--|
| reversible | undo | |
| irreversible | specific confirm dialog | name + consequence |
| very destructive | type to confirm | account deletion |
| button labels | "Delete address" / "Keep address" | not OK/Cancel |
| focus safe option | default | |
| ⭐ double submit | disable + idempotency key | API dedupes |
| unsaved changes | warn sparingly | `beforeunload` |

## Offline and slow
| Item | Does | Note |
|:--|:--|:--|
| ⭐ cached reads | stale data + notice | |
| paused mutations | resume online | default network mode |
| block critical writes | explicit message | payments |
| `refetchOnReconnect` | refresh | default true |
| `onlineManager` | Query's online state | |
| `online`/`offline` events | browser state | not proof |
| ~1 s → progress, ~10 s → retry/cancel | slow network UX | |
| `persistQueryClient` | survive reloads offline | rarely needed |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| spinner on `isFetching` | flicker | `isPending` only |
| blank empty state | looks broken | explain + action |
| raw error text | confusing, leaks | mapped messages |
| clearing form on error | lost input | keep values |
| short toasts with actions | unreachable | longer, keyboard access |
| confirm on everything | ignored | undo |
| optimistic payments | false success | wait for API |
| PII in Sentry | privacy breach | scrub, hash |
| silent offline failure | data loss | queue or block clearly |

## Sources
| Source | Link |
|:--|:--|
| TanStack Query statuses | https://tanstack.com/query/latest/docs/framework/react/guides/queries |
| Background fetching | https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators |
| Suspense | https://tanstack.com/query/latest/docs/framework/react/guides/suspense |
| Network mode | https://tanstack.com/query/latest/docs/framework/react/guides/network-mode |
| Next.js error handling | https://nextjs.org/docs/app/getting-started/error-handling |
| Sentry Next.js | https://docs.sentry.io/platforms/javascript/guides/nextjs/ |
| NN/g error messages | https://www.nngroup.com/articles/error-message-guidelines/ |
| NN/g confirmation dialogs | https://www.nngroup.com/articles/confirmation-dialog/ |
