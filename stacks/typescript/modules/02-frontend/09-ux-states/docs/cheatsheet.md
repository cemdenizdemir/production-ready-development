---
title: UX States & Error Handling cheatsheet
tech: React 19.2, TanStack Query 5, Tailwind CSS 4
version: React 19.2, TanStack Query v5, Tailwind CSS 4.3, Sentry JS SDK 10
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
---
# UX States & Error Handling cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## States of a data view
| State | Show | Query signal |
|:--|:--|:--|
| ⭐ Loading (first) | layout-matching skeleton | `isPending` |
| ⭐ Success | data | `isSuccess` |
| ⭐ Empty | explanation + action | success, 0 items |
| ⭐ Refreshing | data + subtle indicator | `isFetching && !isPending` |
| Placeholder | previous data, dimmed | `isPlaceholderData` |
| ⭐ Error, no data | error + retry | `isError && !data` |
| Error, stale data | data + "couldn't refresh" | `isError && data` |
| Partial | loaded parts + section errors | separate boundaries |
| Offline | cached data + banner | `fetchStatus === 'paused'` |
| Unauthorized | login prompt / redirect | 401 |
| Forbidden | explanation + who to ask | 403 |
| Not found | 404 page with search/links | 404 |

## Loading patterns
| Pattern | Use | Note |
|:--|:--|:--|
| ⭐ Skeleton | page/section first load | same shape as content |
| Spinner in button | action pending | disable the button |
| Inline "Updating…" | background refetch | `role="status"` |
| Progress bar | long, measurable work | determinate if possible |
| ⭐ Delay before loader | ~200–300 ms | no flash |
| Minimum display time | ~300–500 ms once shown | no flicker |
| `aria-busy="true"` | region loading | |
| `motion-reduce:animate-none` | reduce shimmer | Tailwind |
| Optimistic content | instant feedback | see Optimistic |

## Empty states
| Kind | Content |
|:--|:--|
| ⭐ First use | purpose + primary action |
| ⭐ No results | query/filters shown + clear filters |
| All done | positive confirmation |
| No permission | reason + contact |
| Error vs empty | never show "empty" when the load failed |

## Suspense and boundaries
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `useSuspenseQuery` | suspends until data | data always defined |
| ⭐ `<Suspense fallback>` | skeleton per section | independent sections |
| ⭐ `startTransition` on key change | keep old UI | no fallback flash |
| `useDeferredValue` | lagging value | |
| ⭐ Error boundary per section | contain failures | with retry |
| `QueryErrorResetBoundary` | reset queries on retry | TanStack |
| `throwOnError` | send query errors to boundary | |
| Next.js `loading.tsx` / `error.tsx` | route-level states | |

## Error → message → action
| Error | Message | Action |
|:--|:--|:--|
| ⭐ Network/timeout | connection problem | retry; keep input |
| ⭐ 400/422 | field problems | inline errors |
| ⭐ 401 | session expired | re-login, return |
| 403 | no access | who to ask |
| 404 | doesn't exist | search, list |
| 409 | changed by someone else | reload, reapply |
| 429 | too many attempts | wait N seconds |
| ⭐ 5xx | our problem | retry later + request ID |

## Writing error messages
| Rule | Example |
|:--|:--|
| ⭐ What happened | "We couldn't save your address." |
| Why (if useful) | "The postal code doesn't match the city." |
| ⭐ What to do | "Check the postal code and try again." |
| Plain language | no codes, no stack traces |
| Don't blame | "That code didn't work" not "You entered an invalid code" |
| Keep input | never clear the form on error |
| Reference for support | "Reference: req_8f2a…" on 5xx |

## Feedback channels
| Channel | Use | Accessibility |
|:--|:--|:--|
| ⭐ Inline message | field/section errors | `aria-describedby`, `aria-invalid` |
| ⭐ Toast (success) | completed actions | `role="status"`, auto-dismiss OK |
| Toast (error) | background failures | `role="alert"`, no auto-dismiss |
| Banner | offline, maintenance, degraded | `role="status"` |
| Dialog | blocking decisions | `<dialog>` |
| Live region | section updated | polite, pre-existing |
| Toast rules | pause on hover/focus, dismissible, don't cover actions | |

## Optimistic UI and undo
| Pattern | Use | Note |
|:--|:--|:--|
| ⭐ Optimistic update | toggles, likes, renames, reorders | rollback on error |
| ⭐ Undo toast | reversible deletes/archives | 5–10 s window |
| Delayed commit | send after undo window | lost if tab closes |
| ⭐ Soft delete + restore | API-backed undo | `deleted_at` |
| ⭐ Confirmation dialog | irreversible, high impact | name the object |
| Type-to-confirm | very destructive actions | workspace deletion |
| No optimism | payments, refunds | wait for server |
| Specific button labels | "Delete workspace" not "OK" | |

## Offline and slow networks
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `useOnlineStatus` | online/offline state | `useSyncExternalStore` |
| ⭐ `networkMode: 'online'` | pause fetches offline | default |
| `fetchStatus: 'paused'` | query waiting for network | |
| ⭐ Paused mutations | resume on reconnect | `isPaused` |
| `useMutationState` | show pending sync count | |
| `dataUpdatedAt` | "last updated" hints | |
| `refetchOnReconnect` | refresh after reconnect | default true |
| Slow request message | after ~10 s | offer cancel/retry |
| `AbortSignal.timeout` | request deadlines | |
| Service worker caching | offline-first apps | also seen: Workbox |

## Double-submit protection
| Layer | Technique |
|:--|:--|
| ⭐ UI | disable while `isPending` |
| Logic | ignore calls while pending |
| ⭐ API | `Idempotency-Key` |
| Data | unique constraints |
| Navigation | warn on leaving with unsaved changes (`beforeunload`) |

## Error reporting (Sentry)
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `Sentry.captureException(err, { tags, extra })` | report handled errors | |
| `Sentry.setUser({ id })` | user context | IDs, not emails |
| `Sentry.setTag('feature', 'checkout')` | filterable tags | |
| `Sentry.addBreadcrumb` | trail before an error | |
| `beforeSend` | filter/scrub events | drop expected errors |
| `ignoreErrors` | ignore noisy messages | browser extensions |
| ⭐ Report unexpected only | not 4xx validation | |
| Request ID tag | link to backend logs | |
| `QueryCache` / `MutationCache` `onError` | global capture | TanStack |
| React root `onCaughtError` / `onUncaughtError` | boundary errors | |

## Tailwind snippets
| Purpose | Classes |
|:--|:--|
| Skeleton | `h-12 animate-pulse rounded-md bg-gray-200 motion-reduce:animate-none` |
| Dimmed placeholder | `opacity-60 transition-opacity` |
| Error box | `rounded-md border border-red-200 bg-red-50 p-4 text-red-900` |
| Warning banner | `bg-amber-50 px-4 py-2 text-sm text-amber-900` |
| Visually hidden | `sr-only` |
| Disabled button | `disabled:cursor-not-allowed disabled:opacity-50` |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| "0 items" while loading | false information | handle `isPending` first |
| Spinner on every refetch | content flashes | `isFetching` indicator only |
| Flash of loader | jittery UI | delay + minimum time |
| Generic "Something went wrong" | no next step | map errors to actions |
| Validation in toasts | can't find the field | inline + focus |
| Clearing input on failure | lost work | keep input |
| Confirm for everything | reflex clicking | undo |
| Spinner while offline | useless | cached data + banner |
| Disabled button as only guard | duplicates still possible | idempotency keys |
| Reporting expected errors | noise | filter in `beforeSend` |
| Live region added with message | not announced | persistent region |
| Global boundary only | whole page lost | section boundaries |

## Sources
| Source | Link |
|:--|:--|
| TanStack Query guides | https://tanstack.com/query/latest/docs/framework/react/overview |
| react.dev Suspense | https://react.dev/reference/react/Suspense |
| NN/g error messages | https://www.nngroup.com/articles/error-message-guidelines/ |
| NN/g empty states | https://www.nngroup.com/articles/empty-state-interface-design/ |
| NN/g confirmation dialogs | https://www.nngroup.com/articles/confirmation-dialog/ |
| GOV.UK error patterns | https://design-system.service.gov.uk/components/error-message/ |
| Sentry React | https://docs.sentry.io/platforms/javascript/guides/react/ |
