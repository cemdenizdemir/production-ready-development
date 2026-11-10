---
title: Frontend cheatsheet
date: 2026-11-09
---
# Frontend cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · HTML](01-html/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `<main>`, `<nav aria-label>`, `<header>`, `<footer>` | landmarks |
| one `<h1>`, ordered headings | page outline |
| `<a href>` vs `<button type="button">` | navigate vs act |
| `<dialog>.showModal()` / `popover` | native modal / light-dismiss panel |
| `<label for>` + `autocomplete` | accessible, autofillable fields |
| `alt`, `width`/`height`, `srcset` + `sizes` | images without CLS |
| `fetchpriority="high"` on LCP image, `loading="lazy"` below fold | loading priority |
| `defer` / `async` / `type="module"` | script loading |
| `rel="canonical"` / `robots noindex` / JSON-LD | SEO |
| DevTools Accessibility pane | computed role and name |

## [02 · CSS](02-css/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `@layer reset, base, components, utilities` | cascade order by intent |
| `box-sizing: border-box`, `rem`, logical properties | sane defaults |
| `repeat(auto-fit, minmax(min(15rem,100%),1fr))` | responsive grid |
| `container-type: inline-size` + `@container` | component queries |
| `isolation: isolate`, top layer | stacking without z-index wars |
| `:has()`, `:focus-visible` | modern selectors |
| `oklch()`, `color-mix()`, `light-dark()` | tokens and themes |
| `@starting-style`, `prefers-reduced-motion` | motion done right |
| `@import "tailwindcss"` + `@theme` | Tailwind 4 setup |
| `cva` + `tailwind-merge` | component variants |

## [03 · JavaScript](03-javascript/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `===`, `structuredClone`, spread | equality and copies |
| `??`, `?.` | defaults and optional data |
| `toSorted`, `Object.groupBy`, iterator helpers | modern non-mutating APIs |
| microtasks before tasks | event loop order |
| `Promise.all` | parallel awaits (`Task.WhenAll`) |
| `AbortController` / `AbortSignal.timeout` | cancellation (`CancellationToken`) |
| Problem Details → `ApiError` | one error type for API failures |
| `URLSearchParams`, `crypto.randomUUID()` | safe URLs, idempotency keys |
| minor units for money | no float rounding |
| `DateOnly` ↔ plain date, `Intl.*` | dates and formatting |

## [04 · Framework (React)](04-framework/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| pure render, derived values | no stale state |
| lift state up, stable keys | one source of truth |
| effects only for external systems | fewer bugs |
| `useEffectEvent` | latest values inside effects (19.2) |
| `children`, slots, custom hooks | composition |
| error boundaries + root callbacks | resilient UI |
| `useActionState`, `useFormStatus`, `useOptimistic` | Actions (19) |
| `useTransition`, `<Suspense>` | responsive loading |
| React Compiler | automatic memoization |
| Vite `server.proxy['/api']` | same-origin dev against ASP.NET Core |

## [05 · State Management](05-state-management/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| server / URL / form / UI / derived | where each state lives |
| search params with schema parsing | shareable filters |
| `useQuery({ queryKey, queryFn, staleTime })` | server state |
| `staleTime` vs `gcTime` | fresh vs kept in memory |
| `queryOptions` + `prefetchQuery` | reusable options, warm cache |
| Orval `useGetOrder` / `getGetOrderQueryKey` | generated hooks and keys |
| `invalidateQueries` (narrow) / `setQueryData` | cache updates after writes |
| `onMutate` snapshot + `onError` rollback + `onSettled` invalidate | optimistic updates |
| `keepPreviousData` / `useInfiniteQuery` | pagination |
| `retry` predicate skipping 4xx | sane retries |

## [06 · Rendering Strategies](06-rendering/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `cacheComponents: true` | Next.js 16 caching model |
| `'use cache'` + `cacheLife` + `cacheTag` | cached data and components |
| `revalidateTag(tag, "max")` / `updateTag` | invalidate / read-your-writes |
| Server Components by default, `'use client'` at leaves | small bundles |
| `import "server-only"` | keep server code off the client |
| forward `cookie` + `traceparent` to `API_URL` | per-user server fetches |
| `<Suspense>` / `loading.tsx` | streaming |
| thin Server Functions, API owns rules | security and one source of truth |
| `proxy.ts` rewrite `/api` | same-origin API |
| `output: "standalone"` + shared encryption key | self-hosting replicas |

## [07 · Performance](07-performance/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (p75) | targets |
| `web-vitals` / `useReportWebVitals` | field data |
| Lighthouse CI budgets | regression gate |
| parallel API calls, fast SQL | lower TTFB |
| `next/image` `sizes` + `priority` | right image, fast LCP |
| `next/font` `display: swap` | no blocking fonts |
| `immutable` for `/_next/static` | CDN caching |
| `next/dynamic`, Server Components | less JS |
| `next/script` `lazyOnload` after consent | tame third parties |
| `useDeferredValue`, virtualization | responsive interactions |

## [08 · Accessibility](08-accessibility/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| WCAG 2.2 AA | target (EAA, ADA) |
| role + name + state | accessibility tree |
| contextual names ("Remove Ethiopia Guji") | clear controls |
| visible focus, skip link, no traps | keyboard access |
| focus to opener after dialog close | focus management |
| label + `aria-describedby` error + `aria-invalid` | accessible forms |
| `role="status"` live region | announcements |
| 4.5:1 text, 3:1 UI contrast; 320 px reflow | visual requirements |
| APG-compliant headless components | custom widgets |
| `@axe-core/playwright` + manual NVDA/VoiceOver pass | testing |

## [09 · UX States & Error Handling](09-ux-states/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| loading / empty / error / stale / offline | every state designed |
| skeleton on `isPending`, not `isFetching` | no flicker |
| empty state with next step | helpful blanks |
| `useSuspenseQuery` + boundaries | data always defined |
| what happened + what to do + reference | good error messages |
| `traceId` from Problem Details | support correlation |
| toast for confirmations, inline for errors | feedback |
| undo instead of confirm | reversible actions |
| disable + idempotency key | no double submits |
| paused mutations offline | resilience |

## [10 · Forms & Validation](10-forms/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `useForm({ resolver: zodResolver(schema), mode: "onTouched" })` | form setup |
| `register` / `Controller` | native / custom inputs |
| Orval `client: "zod"` | schemas from the C# contract |
| `.extend()` generated schemas | UX-only rules |
| `ValidationProblemDetails.errors` → `setError` | server errors on fields |
| `Lines[1].Quantity` → `lines.1.quantity` | key mapping |
| `useFieldArray` + `field.id` keys | dynamic rows |
| SAS URL + direct Blob upload + "complete" call | large uploads |
| `trigger(stepFields)`, server-side checkout draft | multi-step |
| Testing Library + `user-event` + MSW 400 case | form tests |

## [11 · Frontend Security](11-security/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| no raw HTML without DOMPurify | XSS |
| URL scheme allowlist for `href` | `javascript:` links |
| nonce CSP in `proxy.ts`, `'strict-dynamic'` | contain XSS |
| `frame-ancestors 'none'` | clickjacking |
| Report-Only first | safe rollout |
| `HttpOnly; Secure; SameSite=Lax` cookies from the API | session storage |
| Server Functions: parse input, identity from session | secure actions |
| `X-XSRF-TOKEN` for unsafe methods | CSRF defense in depth |
| client DTOs + `server-only` | no data leaks |
| `safeReturnUrl`, no secrets in `NEXT_PUBLIC_*` | redirects and secrets |

## [12 · Cross-Cutting Frontend](12-cross-cutting/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| semantic tokens in `@theme` | consistent design |
| pre-paint theme script | no dark-mode flash |
| container queries, ≥ 44 px targets | responsive and touchable |
| ICU messages (next-intl) | translatable text |
| `Intl.NumberFormat` currency, `DateTimeFormat` + `timeZone` | locale formatting |
| API computes prices per currency | correct money |
| canonical + `noindex` + `sitemap.ts` + JSON-LD | SEO |
| Baseline policy + Playwright browsers | browser support |
| API-evaluated flags with safe defaults | consistent rollouts |
| consent before analytics, server-side revenue events | privacy and accuracy |

## [13 · Frontend Testing & Monitoring](13-testing-monitoring/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| component tests as the core, few E2E journeys | test strategy |
| `getByRole` + `userEvent.setup()` | user-like tests |
| Vitest browser mode for real-DOM components | fidelity |
| MSW + Orval mocks, `onUnhandledRequest: "error"` | network mocking |
| new `QueryClient` per test, `retry: false` | reliable query tests |
| Playwright against real ASP.NET Core + SQL Server | integration bugs |
| setup project + `storageState` | fast auth |
| `toMatchAriaSnapshot`, `toHaveScreenshot` | tree and visual checks |
| `--shard` + `merge-reports` | fast CI |
| Sentry: source maps, release = SHA, masked replay, first-party trace propagation | monitoring |
