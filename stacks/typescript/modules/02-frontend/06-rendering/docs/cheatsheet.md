---
title: Rendering Strategies cheatsheet
tech: Next.js 16, React 19.2
version: Next.js 16.x (App Router, Cache Components), React 19.2
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Rendering Strategies cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Strategies
| Strategy | HTML made | Use for |
|:--|:--|:--|
| ⭐ CSR | in the browser | app screens behind login |
| ⭐ SSR | server, per request | personalized, always-fresh pages |
| ⭐ SSG | at build | docs, marketing |
| ISR / revalidation | static, refreshed later | catalogs, articles |
| ⭐ Streaming SSR | shell first, chunks later | pages with slow parts |
| ⭐ Partial prerendering | static shell + dynamic holes | Next 16 default with Cache Components |
| ⭐ RSC | server-only components, no JS shipped | data-heavy UI |
| Hydration | client attaches to server HTML | Client Components only |
| Islands | interactive leaves in static pages | `'use client'` leaves |

## File conventions
| File | Role | Note |
|:--|:--|:--|
| ⭐ `layout.tsx` | shared UI, persists on navigation | root has `<html>`/`<body>` |
| ⭐ `page.tsx` | route UI | makes segment routable |
| ⭐ `loading.tsx` | Suspense fallback | instant loading state |
| ⭐ `error.tsx` | error boundary | `'use client'`; `reset()` |
| `global-error.tsx` | root layout errors | own `<html>` |
| `not-found.tsx` | `notFound()` UI | |
| `forbidden.tsx` / `unauthorized.tsx` | 403 / 401 UI | experimental `authInterrupts` |
| `template.tsx` | remounting layout | |
| `default.tsx` | parallel route fallback | required in 16 |
| ⭐ `route.ts` | HTTP handlers | `GET`, `POST`, … |
| `proxy.ts` | runs before routing | was `middleware.ts` |
| `instrumentation.ts` | `register()`, `onRequestError` | observability setup |
| `instrumentation-client.ts` | client-side init | Sentry, analytics |
| `opengraph-image.tsx` / `icon.tsx` | generated images | `ImageResponse` |
| `sitemap.ts` / `robots.ts` / `manifest.ts` | SEO files | |

## Route segments
| Pattern | Meaning |
|:--|:--|
| ⭐ `[id]` | dynamic segment |
| `[...slug]` / `[[...slug]]` | catch-all / optional catch-all |
| ⭐ `(group)` | route group, not in URL |
| `_folder` | private, not routable |
| `@slot` | parallel route |
| `(.)x` / `(..)x` / `(...)x` | intercepting routes |
| ⭐ `generateStaticParams` | prerender dynamic params |
| `PageProps<'/route/[id]'>` / `LayoutProps` | generated route types |

## Server vs Client
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Server Component | default; async; no client JS | secrets, data access |
| ⭐ `'use client'` | client boundary for the module graph | keep low in the tree |
| ⭐ `children` into Client Components | keep server-rendered parts | composition |
| ⭐ Serializable props | only plain data crosses the boundary | visible in payload |
| ⭐ `import 'server-only'` | build error if imported client-side | DB, secrets |
| `import 'client-only'` | opposite guard | browser-only modules |
| `next/dynamic` `{ ssr: false }` | client-only component | in Client Components |
| React `cache(fn)` | dedupe per request | `getCurrentUser()` |
| `after(fn)` | work after the response | logging, analytics |

## Request APIs (async in 16)
| API | Returns | Note |
|:--|:--|:--|
| ⭐ `await params` | route params | Promise in 16 |
| ⭐ `await searchParams` | query params | makes rendering dynamic |
| ⭐ `await cookies()` | cookie store | read; set in actions/handlers |
| ⭐ `await headers()` | request headers | |
| `await draftMode()` | preview mode | |
| `await connection()` | opt into request time | `next/server` |
| `useSearchParams()` / `usePathname()` / `useRouter()` | client hooks | `next/navigation` |
| `useParams()` | params in Client Components | |
| `redirect()` / `permanentRedirect()` / `notFound()` | control flow | throw internally |

## Cache Components
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `cacheComponents: true` | enable model | next.config |
| ⭐ `'use cache'` | cache function/component/file | args are cache key |
| ⭐ `cacheLife(profile)` | freshness/revalidate/expire | `minutes`, `hours`, `days`, `weeks`, `max` |
| ⭐ `cacheTag(...tags)` | label entries | invalidation |
| ⭐ `revalidateTag(tag, profile)` | stale-while-revalidate invalidation | profile required in 16 |
| ⭐ `updateTag(tag)` | expire now (read-your-writes) | Server Actions only |
| `revalidatePath(path)` | invalidate by path | |
| `refresh()` | refresh client router | Server Actions |
| `'use cache: private'` | per-user, browser-only cache | |
| `'use cache: remote'` | remote cache handler | multi-instance |
| Custom `cacheLife` profiles | named in next.config | |
| Uncached data outside Suspense | build error | add Suspense or cache it |
| Old segment config (`dynamic`, `revalidate`, `fetchCache`) | not used with Cache Components | |

## Data fetching
| Pattern | What it does | Note |
|:--|:--|:--|
| ⭐ `await` in Server Components | fetch on the server | no client waterfall |
| ⭐ `Promise.all` | parallel requests | |
| ⭐ Suspense per slow section | stream | |
| Internal API URL | `http://api:3000` | not through the CDN |
| ⭐ Forward cookies | `headers: { cookie }` | auth to Express |
| `fetch` not cached by default | since Next 15 | cache with `'use cache'` |
| TanStack Query + `HydrationBoundary` | client-side caching after SSR | Client Components |

## Server Functions
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `'use server'` | server function / action | file or function level |
| ⭐ Public POST endpoint | callable by anyone | auth + validate inside |
| `<form action={fn}>` | progressive enhancement | works before hydration |
| `useActionState(fn, init)` | state + pending | |
| `useFormStatus()` | pending in children | |
| Return values | serializable results | errors as data |
| `experimental.serverActions.allowedOrigins` | trusted origins behind proxies | next.config |
| `experimental.serverActions.bodySizeLimit` | request size limit | default 1 MB |
| Encrypted closures | captured values encrypted | still validate |

## Route handlers and proxy
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `export async function GET(req)` | handler per method | Web Request/Response |
| `Response.json(data, { status })` | JSON response | |
| `NextRequest` / `NextResponse` | extended helpers | cookies, redirects |
| ⭐ `proxy(request)` + `config.matcher` | pre-routing logic | Node runtime |
| `NextResponse.redirect` / `rewrite` / `next()` | proxy outcomes | |
| Optimistic auth only | cookie presence | real authz elsewhere |
| CSP nonce headers | security headers per request | 11-security |

## Hydration
| Cause | Fix |
|:--|:--|
| ⭐ Time/random in render | compute on server / `useEffect` |
| ⭐ Browser APIs in render | `useEffect`, `ssr: false` |
| Locale/time zone | explicit locale and `timeZone` |
| Invalid nesting | fix HTML |
| Unavoidable text diff | `suppressHydrationWarning` on that element |
| Debug | 16.2 hydration diff in the error overlay |

## Metadata and SEO
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `export const metadata` | static metadata | |
| ⭐ `generateMetadata` | dynamic metadata | async params |
| ⭐ `title.template` | consistent titles | root layout |
| ⭐ `metadataBase` | absolute URLs | |
| `alternates.canonical` / `languages` | canonical, hreflang | |
| `openGraph` / `twitter` | previews | |
| `robots` | indexing | `noindex` non-prod |
| `ImageResponse` | OG images | `next/og` |
| JSON-LD script | structured data | escape `<` |

## next.config essentials
| Key | What it does |
|:--|:--|
| ⭐ `cacheComponents` | Cache Components |
| ⭐ `reactCompiler` | React Compiler (stable) |
| ⭐ `output: 'standalone'` | self-hosting build |
| `images.remotePatterns` | allowed remote images |
| `images.localPatterns` | allowed local paths with queries |
| `assetPrefix` | CDN for static assets |
| `experimental.serverActions` | origins, body size |
| `cacheHandlers` | custom (shared) cache storage |
| `cacheLife` | custom profiles |
| `typedRoutes` | type-checked links |
| `turbopack` | bundler options (default) |
| `basePath` / `trailingSlash` / `redirects` / `rewrites` / `headers` | routing config |

## CLI
| Command | What it does |
|:--|:--|
| `next dev` | dev server (Turbopack) |
| `next build` | production build (no lint in 16) |
| `next start` | production server (`--inspect` in 16.2) |
| `next typegen` | generate route types |
| `next build --debug-prerender` | debug prerender errors |
| `npx @next/codemod@canary upgrade latest` | upgrade codemods |
| `next info` | environment info for bug reports |

## Self-hosting
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `.next/standalone/server.js` | minimal server | `node server.js` |
| ⭐ Copy `.next/static` + `public` | assets | or CDN |
| `HOSTNAME=0.0.0.0`, `PORT` | listen settings | containers |
| `sharp` | image optimization | in standalone |
| ⭐ `NEXT_PUBLIC_*` at build | inlined | runtime config for per-env values |
| Shared cache handler | consistent caches across instances | Redis |
| Version skew | keep old assets during rollouts | CDN |
| Health route | `/api/health` | load balancer |
| Non-root user | `USER node` | security |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `'use client'` in root layout | whole app client-side | leaves only |
| DB rows as props | data leak to client | DTOs |
| Cookies in `'use cache'` | not allowed / user mix-up | read outside |
| Sync `params` access | removed in 16 | `await params` |
| One-arg `revalidateTag` | deprecated in 16 | add profile or `updateTag` |
| Auth only in `proxy.ts` | bypass via matcher gaps | authz in data layer |
| Unvalidated Server Actions | public endpoints | Zod + auth |
| Sequential awaits | waterfalls | `Promise.all`, Suspense |
| Per-instance caches | inconsistent data | shared handler |
| Unescaped JSON-LD | script injection | escape `<` |
| Staging indexed | duplicate content | `noindex` |
| Browser APIs during render | hydration errors | effects |

## Sources
| Source | Link |
|:--|:--|
| Next.js docs | https://nextjs.org/docs/app |
| Next.js 16 release | https://nextjs.org/blog/next-16 |
| Cache Components | https://nextjs.org/docs/app/getting-started/cache-components |
| Upgrade to 16 | https://nextjs.org/docs/app/guides/upgrading/version-16 |
| Data security | https://nextjs.org/docs/app/guides/data-security |
| Self-hosting | https://nextjs.org/docs/app/guides/self-hosting |
| web.dev Rendering on the web | https://web.dev/articles/rendering-on-the-web |
