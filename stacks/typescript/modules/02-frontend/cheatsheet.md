---
title: Frontend cheatsheet
date: 2026-11-07
---
# Frontend cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · HTML](01-html/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `<header>` `<nav>` `<main>` `<footer>` | landmarks |
| One `<h1>`, no skipped levels | heading outline |
| `<html lang>` + viewport meta | language, mobile layout |
| `<a href>` vs `<button type="button">` | navigate vs act |
| `<dialog>` + `showModal()` | accessible modal for free |
| `popover` + `popovertarget` | popups without JS |
| `<label for>` + `autocomplete` + right `type` | usable forms |
| `alt` (or `alt=""` if decorative) | text alternatives |
| `width`/`height` on images | no layout shift |
| `fetchpriority="high"` on LCP image, `loading="lazy"` below fold | loading priorities |
| `defer` / `type="module"` | non-blocking scripts |
| canonical + Open Graph + JSON-LD | search and previews |

## [02 · CSS](02-css/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `@layer reset, base, components, utilities` | end specificity wars |
| `:where()` | zero-specificity defaults |
| `box-sizing: border-box`, logical properties | predictable, RTL-safe boxes |
| `rem`, `ch`, `dvh`, `clamp()` | the right units |
| `repeat(auto-fit, minmax(min(18rem,100%), 1fr))` | responsive grid, no media query |
| `minmax(0, 1fr)`, `min-inline-size: 0` | no overflow blowouts |
| `container-type` + `@container` | component-level responsiveness |
| `:has()`, `:focus-visible`, nesting | modern selectors |
| tokens + `light-dark()` + `oklch()` | theming and color |
| `isolation: isolate`, top layer | sane stacking |
| animate `transform`/`opacity`, `prefers-reduced-motion` | smooth, respectful motion |
| Tailwind `@import "tailwindcss"` + `@theme` | v4 setup and tokens |

## [03 · JavaScript](03-javascript/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `===`, `structuredClone`, `toSorted()` | equality, deep copy, no mutation |
| Closures + arrow `this` | private state, stable handlers |
| Microtasks before render, tasks after | event loop order |
| Tasks > 50 ms = long tasks | INP killers |
| `Promise.all` / `allSettled` | parallel / partial failure |
| `AbortController`, `AbortSignal.timeout()` | cancellation, deadlines |
| `fetch` + check `res.ok` | HTTP errors don't throw |
| `new Error(msg, { cause })` | wrapped errors |
| `URLSearchParams` | safe query strings |
| `{ signal }` listeners + `abort()` | cleanup |
| integer cents, `Intl.NumberFormat` | money |
| UTC ISO for moments, `YYYY-MM-DD` for dates | time handling |

## [04 · Framework (React)](04-framework/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| UI = f(state); pure render | the model |
| Derive, don't duplicate state | one source of truth |
| `key={item.id}` | stable list identity, reset with key |
| Effects only for external systems | not for derived data or events |
| `useEffectEvent` (19.2) | latest values without effect deps |
| `<Activity mode="hidden">` (19.2) | hide but keep state |
| `useActionState` + `useFormStatus` + `useOptimistic` | Actions |
| `useTransition` / `useDeferredValue` | responsive heavy updates |
| `<Suspense>` + `lazy()` | streaming and code splitting |
| Error boundaries + root `onCaughtError` | contain and report |
| React Compiler 1.0 | automatic memoization |
| Vite `server.proxy` + `tsc -b` | same-origin dev API, real type checks |

## [05 · State Management](05-state-management/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Server / URL / form / UI / derived | where state lives |
| `useQuery({ queryKey, queryFn })` | server state |
| All inputs in the key; key factories | correct caching |
| `staleTime` vs `gcTime` | freshness vs memory |
| `queryOptions()` + `prefetchQuery` | reusable, prefetchable |
| `placeholderData: keepPreviousData` | no flash on filter/page change |
| `useMutation` + `invalidateQueries` | writes + resync |
| cancel → snapshot → set → rollback → invalidate | optimistic updates |
| `useInfiniteQuery` + `maxPages` | feeds |
| retry function skipping 4xx | sensible retries |
| `replaceState` for URL filters | shareable views |

## [06 · Rendering Strategies](06-rendering/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Static shell + dynamic holes | partial prerendering |
| Server Components by default, `'use client'` on leaves | less JS |
| `await params` / `cookies()` / `headers()` | async request APIs (16) |
| `'use cache'` + `cacheLife` + `cacheTag` | Cache Components |
| `updateTag` (actions) / `revalidateTag(tag, 'max')` | invalidation |
| Request data inside `<Suspense>` | streaming, no build errors |
| Forward cookies to Express from the server | auth in RSC |
| Server Actions = public endpoints | validate + authorize |
| `proxy.ts` for redirects/headers only | not real auth |
| `generateMetadata`, `sitemap.ts`, `robots.ts` | SEO |
| `output: 'standalone'` + shared cache handler | self-hosting |

## [07 · Performance](07-performance/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (p75) | targets |
| Field (RUM) to decide, lab to debug | measuring |
| `web-vitals/attribution` / `useReportWebVitals` | RUM with causes |
| LCP = TTFB + load delay + load time + render delay | what to fix |
| `fetchPriority="high"` on hero, lazy below fold | image priority |
| `next/font` | no font-swap shift |
| Server Components, `next/dynamic`, tree shaking | less JS |
| facades + `lazyOnload` for third parties | contain scripts |
| feedback first, `startTransition` for the rest | INP |
| reserve space for media, embeds, banners | CLS |
| Lighthouse CI budgets | regressions fail PRs |

## [08 · Accessibility](08-accessibility/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| WCAG 2.2 AA; EAA since June 2025 | target and law |
| Role, name, state | accessibility tree |
| Native elements first; rules of ARIA | fewer bugs |
| Keyboard: Tab, Enter, Space, Esc, arrows | operability |
| `:focus-visible`, skip link, no traps | focus |
| `aria-describedby` + `aria-invalid` | form errors |
| Focus heading on route change; return focus from dialogs | SPA focus |
| `role="status"` pre-existing live region | announcements |
| 4.5:1 text, 3:1 UI, 24 px targets | visual |
| `@axe-core/playwright` + role queries | automated checks |
| keyboard pass + NVDA/VoiceOver | manual checks |

## [09 · UX States](09-ux-states/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| loading / empty / error / partial / offline | design every state |
| `isPending` → skeleton; `isFetching` → subtle indicator | loading UX |
| delay loader ~250 ms | no flash |
| empty states with a next action | helpful empties |
| error → message → action map | useful errors |
| inline for actionable errors, toasts for confirmations | feedback channels |
| `QueryErrorResetBoundary` + section boundaries | contained failures |
| undo for reversible, confirm for irreversible | destructive actions |
| cached data + offline banner; paused mutations | offline |
| disable + idempotency key | double-submit protection |

## [10 · Forms](10-forms/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| uncontrolled by default | performance |
| `useForm({ resolver: zodResolver(S), mode: 'onTouched' })` | setup |
| one Zod schema in `packages/schemas` | same rules front and back |
| `z.input` / `z.output` | form vs parsed types |
| 422 `{ errors: { field: [msg] } }` → `setError` | server errors on fields |
| `useFieldArray` keyed by `field.id` | dynamic rows |
| `Controller` for custom inputs | third-party widgets |
| `useWatch` in leaf components | isolated re-renders |
| `trigger(stepFields)` | multi-step validation |
| presigned upload + `xhr.upload.onprogress` | uploads |
| `user-event` + MSW tests | realistic tests |

## [11 · Frontend Security](11-security/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| JSX escapes text; watch `dangerouslySetInnerHTML`, URLs, refs | XSS hatches |
| DOMPurify at render | sanitize HTML |
| scheme allowlist for links | no `javascript:` URLs |
| nonce + `'strict-dynamic'` CSP via `proxy.ts` | strict CSP |
| report-only first | safe rollout |
| `frame-ancestors 'none'`, HSTS, nosniff, Permissions-Policy | headers |
| `HttpOnly` session cookies, no tokens in JS | token safety |
| Server Actions: validate + authn + authz | secure mutations |
| shared `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | multi-instance |
| `server-only` + DTOs | no data leaks |
| `NEXT_PUBLIC_*` is public | no secrets in bundles |
| relative-only redirects | no open redirects |

## [12 · Cross-Cutting](12-cross-cutting/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| semantic tokens in `@theme` | themeable components |
| small typed component library | consistency |
| theme before paint (CSS or head script) | no flash |
| inline SVG icons, `currentColor` | icon system |
| catalogs + ICU/`Intl.PluralRules` | i18n |
| `<html lang dir>`, logical CSS | locales and RTL |
| moments in UTC, events with their zone | time zones |
| currency travels with amount | money |
| env-aware `robots.ts`, real 404s, JSON-LD | SEO |
| Baseline + browserslist + WebKit tests | browser support |
| server-evaluated, sticky flags | no flicker |
| no tracking before consent; honor GPC | privacy |

## [13 · Testing & Monitoring](13-testing-monitoring/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `getByRole(role, { name })` | user-like queries |
| `userEvent.setup()` + `await user.click/type` | realistic interaction |
| `findBy` / `queryBy` | async / absence |
| MSW handlers shared by tests and dev | network mocking |
| new QueryClient per test, `retry: false` | isolated query tests |
| Vitest browser mode for layout-dependent components | real browser |
| Playwright web-first assertions, no sleeps | stable E2E |
| setup project + `storageState` | login once |
| `trace: 'on-first-retry'` + artifacts | debuggable CI failures |
| `toHaveScreenshot` / `toMatchAriaSnapshot` | visual and a11y regressions |
| Sentry `release` + uploaded hidden source maps | readable errors |
| masked replays on error, `sendDefaultPii: false` | privacy |
| alerts: new issue, regression, user impact | actionable alerting |
