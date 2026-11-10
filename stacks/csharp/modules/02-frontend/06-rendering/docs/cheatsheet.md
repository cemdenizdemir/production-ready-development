---
title: Rendering Strategies cheatsheet
tech: Next.js 16, React 19.2
version: Next.js 16.x (App Router, Cache Components, Turbopack), React 19.2
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Rendering Strategies cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Strategies
| Strategy | When | Note |
|:--|:--|:--|
| CSR | behind-login dashboards | slow first paint |
| ⭐ SSR (dynamic) | per-user, per-request | account, checkout |
| SSG | build-time static | marketing |
| ISR / tag revalidation | static + refresh | catalog |
| ⭐ streaming | slow sections | Suspense |
| ⭐ PPR (Cache Components) | static shell + dynamic holes | product page |
| `next build` route markers | ○ static · ◐ partial · ƒ dynamic | check in PRs |

## Dynamic vs cached (Cache Components)
| Item | Effect | Note |
|:--|:--|:--|
| ⭐ `cacheComponents: true` | enable model | next.config |
| dynamic by default | uncached data = request time | |
| `await cookies()` / `headers()` | dynamic | |
| `await params` / `searchParams` | dynamic unless prerendered | async in 15+ |
| `await connection()` | force dynamic | |
| ⭐ `'use cache'` | cache function/component | args in key |
| `generateStaticParams` | prerender known params | |
| dynamic needs `<Suspense>` | fallback in shell | |

## App Router files
| File | Role | Note |
|:--|:--|:--|
| ⭐ `layout.tsx` | shared, persistent UI | root has `<html>` |
| ⭐ `page.tsx` | route UI | |
| ⭐ `loading.tsx` | segment Suspense fallback | streaming |
| ⭐ `error.tsx` | segment error boundary | `'use client'` |
| `global-error.tsx` | root errors | |
| `not-found.tsx` | `notFound()` UI | |
| `route.ts` | HTTP handler | GET/POST… |
| `template.tsx` | remounting layout | |
| `[x]` / `[...x]` / `[[...x]]` | dynamic segments | |
| `(group)` | organize, no URL | layouts per group |
| `_private` | not routed | |
| `@slot` | parallel routes | |
| `opengraph-image.tsx` | OG image | |
| `sitemap.ts` / `robots.ts` | crawl files | |

## Server and Client Components
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ Server Components default | no JS shipped | can await data |
| ⭐ `'use client'` at leaves | interactive parts only | |
| props to client | serializable only | no functions/classes |
| `children` pattern | server content inside client wrapper | providers |
| ⭐ `import "server-only"` | keep server code off the client | API secrets |
| `import "client-only"` | browser-only modules | |
| Providers component | TanStack Query, theme | client |

## Hydration
| Cause | Fix | Note |
|:--|:--|:--|
| time/random in render | compute on server / after mount | |
| locale/time zone | explicit `timeZone` + locale | |
| `typeof window` branches | `useSyncExternalStore` server snapshot | |
| invalid nesting | fix HTML | `<p><div>` |
| extensions | `suppressHydrationWarning` (single element) | last resort |

## Fetching from ASP.NET Core
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `process.env.API_URL` | server-side base URL | runtime |
| ⭐ forward `cookie` | user's session to API | per-user calls |
| forward `traceparent` | join traces | |
| ⭐ `AbortSignal.timeout(ms)` | deadline | |
| `React.cache(fn)` | per-request dedupe | |
| `notFound()` | 404 page | |
| `redirect()` | server redirect | |
| Orval functions server-side | typed calls | server fetcher |

## Caching APIs
| API | Does | Note |
|:--|:--|:--|
| ⭐ `'use cache'` | persistent cache | no cookies inside |
| ⭐ `cacheLife(profile)` | freshness | seconds…max, custom |
| ⭐ `cacheTag(...tags)` | label entries | `product:slug`, `products` |
| ⭐ `revalidateTag(tag, "max")` | stale-while-revalidate | Next 16 signature |
| `updateTag(tag)` | read-your-writes | Server Actions |
| `revalidatePath(path)` | by route | |
| `refresh()` | refresh uncached data | Server Actions |
| `fetch` | not cached by default | 15+ |
| never cache per-user data | shared cache leaks | |

## Streaming
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `<Suspense fallback>` | stream a section | |
| `loading.tsx` | segment-level | |
| independent awaits | parallel sections | |
| promise → client + `use()` | start on server, read on client | |
| fast content outside boundaries | LCP | |

## Server Functions
| Item | Rule | Note |
|:--|:--|:--|
| `'use server'` | server function | public endpoint |
| ⭐ validate input | Zod | |
| ⭐ authorize inside | API checks ownership | |
| thin actions | call ASP.NET Core | rules live in API |
| `useActionState` | form results | 04-framework |
| `updateTag` after write | fresh UI | |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | same on all replicas | |

## Route handlers and proxy.ts
| Item | Use | Note |
|:--|:--|:--|
| `export async function GET/POST(req)` | HTTP handlers | Web Request/Response |
| `/internal/revalidate` | API → Next.js invalidation | secret, internal only |
| ⭐ `proxy.ts` + `export function proxy` | pre-route logic | Node runtime (16) |
| `config.matcher` | which paths | |
| ⭐ `NextResponse.rewrite(API_URL)` | same-origin `/api` proxy | |
| `NextResponse.redirect` | auth gate, legacy URLs | optimistic only |
| no DB calls in proxy | keep it fast | |

## Metadata and SEO
| Item | Use | Note |
|:--|:--|:--|
| ⭐ `export const metadata` | static metadata | |
| ⭐ `generateMetadata` | data-driven | shares cached fetch |
| `metadataBase` | absolute URLs | root layout |
| `title.template` | `%s – Roastery` | |
| `alternates.canonical` | canonical | |
| `robots` | noindex rules | per env |
| `openGraph` / `twitter` | previews | |
| JSON-LD script | rich results | |

## Self-hosting
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `output: "standalone"` | minimal server bundle | `server.js` |
| copy `.next/static` + `public` | assets | |
| `HOSTNAME=0.0.0.0` / `PORT` | listen | container |
| ⭐ shared cache handler | consistent cache across replicas | Redis |
| `deploymentId` | version skew handling | |
| `/healthz` route | probes | |
| `sharp` | image optimization | |
| `assetPrefix` | CDN for static assets | |
| Turbopack | default bundler | 16 |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `'use client'` in root layout | whole app client JS | leaf boundaries |
| cookies in root layout | everything dynamic | Suspense-isolated component |
| caching `/me` | data leak | uncached per-user |
| Server Components calling `/api` | extra hop | `API_URL` directly |
| trusting action args | IDOR | API authorizes |
| business logic in actions | two sources of truth | API owns rules |
| replicas without shared key | Server Action errors | shared key |
| per-env builds | untested artifact | runtime config |
| revalidate before commit | caches old data | after commit (outbox) |

## Sources
| Source | Link |
|:--|:--|
| Next.js App Router | https://nextjs.org/docs/app |
| Next.js 16 | https://nextjs.org/blog/next-16 |
| Cache Components | https://nextjs.org/docs/app/getting-started/cache-components |
| use cache | https://nextjs.org/docs/app/api-reference/directives/use-cache |
| Server and Client Components | https://nextjs.org/docs/app/getting-started/server-and-client-components |
| Data security | https://nextjs.org/docs/app/guides/data-security |
| proxy.ts | https://nextjs.org/docs/app/api-reference/file-conventions/proxy |
| Self-hosting | https://nextjs.org/docs/app/guides/self-hosting |
