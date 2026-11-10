---
title: Rendering strategies; static vs dynamic
tech: Next.js 16, React 19.2
version: Next.js 16.x
date: 2026-11-09
covers: [1, 8]
---
# Rendering strategies; static vs dynamic
[← Overview](00-overview.md)

## Why it matters
- The whole storefront is a client-side SPA; Google indexes empty `<div id="root">` pages and the product pages take 3 s to show anything on mid-range phones.
- Product pages are fully dynamic (`cookies()` read in the root layout for a banner); every request hits the API, and a campaign spike takes it down.
- The account page is statically prerendered by accident; every user sees the build machine's empty account.

## Concepts

### The strategies
| Strategy | HTML produced | Good for | Cost |
|:--|:--|:--|:--|
| CSR (client-side) | in the browser after JS loads | dashboards behind login | slow first paint, poor SEO |
| SSR (dynamic) | on each request | per-user pages, request-specific data | server work per request |
| SSG (static) | at build time | marketing, docs | stale until rebuild |
| ISR / time-based revalidation | static, regenerated after N seconds or on tag | catalogs, product pages | complexity of invalidation |
| ⭐ streaming | shell first, sections as they're ready | pages with slow parts | needs Suspense boundaries |
| ⭐ Partial Prerendering (Cache Components) | static shell + dynamic holes in one response | product page with per-user cart badge | Next.js 16 mental model |

### Static vs dynamic in Next.js 16 with Cache Components
With `cacheComponents: true`, the rule is simple: **everything is dynamic unless cached**, and the build prerenders a static shell up to the first dynamic boundary.
| Makes a component request-specific (dynamic) | Notes |
|:--|:--|
| `await cookies()`, `await headers()` | per-request data |
| `await searchParams`, `await params` (unless params are known at build time via `generateStaticParams`) | |
| `await connection()` | explicit "dynamic here" |
| uncached `fetch` / data access | not wrapped in `'use cache'` |

| Makes it cacheable (static or revalidated) | |
|:--|:--|
| `'use cache'` on a function or component | + `cacheLife`, `cacheTag` |
| no dynamic APIs inside | |

Dynamic parts must sit inside `<Suspense>`; the fallback becomes part of the static shell.

### Choosing per route in this shop
| Route | Strategy |
|:--|:--|
| `/` home, `/brewing` guides | cached, long `cacheLife` |
| `/coffee` list, `/coffee/[slug]` product | cached data with `cacheTag("products")`, revalidated when the API changes a product; per-user bits (cart count) in a Suspense hole |
| `/search?q=` | dynamic (search params), streamed |
| `/account/*`, `/checkout` | dynamic, never cached; requires auth |
| admin | dynamic; client-heavy is fine |

## Example
`web/next.config.ts`
```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  reactCompiler: true,
};
export default config;
```
`web/src/app/coffee/[slug]/page.tsx`
```tsx
import { Suspense } from "react";
import { getProduct, getTopSellerSlugs } from "@/server/catalog";   // 'use cache' + cacheTag inside (lesson 03)
import { CartBadge } from "@/features/cart/CartBadge";

export async function generateStaticParams() {
  return (await getTopSellerSlugs()).map((slug) => ({ slug }));   // prerender bestsellers at build
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);           // cached
  return (
    <main>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <Suspense fallback={<span aria-hidden>…</span>}>
        <CartBadge />                                {/* reads cookies → dynamic hole */}
      </Suspense>
    </main>
  );
}
```
`next build` output marks routes as static (○), partially prerendered (◐), or dynamic (ƒ). Check it in every PR that touches data access.

## Production patterns
- Decide the strategy per route consciously; write it down in the route file or README.
- Keep dynamic APIs (`cookies()`, `headers()`) out of shared layouts; isolate per-user UI in small Suspense-wrapped components.
- Cache public data with tags so the API can invalidate precisely instead of short TTLs everywhere.
- Never cache per-user data in a shared cache; account pages are dynamic.

## Mistakes
Wrong: reading cookies in the root layout.
```tsx
export default async function RootLayout({ children }) {
  const theme = (await cookies()).get("theme");     // makes every page dynamic
}
```
Right: read it in a small Suspense-wrapped component, or handle theme with CSS/`color-scheme`.

Wrong: client-side fetching for SEO-critical product content.
Right: Server Components render product data into HTML.

## Check yourself
1. With Cache Components on, is a page static or dynamic by default?
2. What becomes part of the static shell when a dynamic component is wrapped in `<Suspense>`?
3. Which strategy fits `/account/orders`?

<details><summary>Answers</summary>

1. Dynamic by default; data and components become static or revalidated only when cached with `'use cache'`.
2. The Suspense fallback (and everything above the boundary); the dynamic content streams in at request time.
3. Dynamic rendering (per request, per user), never cached in a shared cache.
</details>

## Sources
- [Next.js — Rendering](https://nextjs.org/docs/app/getting-started/partial-prerendering)
- [Next.js — Cache Components](https://nextjs.org/docs/app/getting-started/cache-components)
- [Next.js — generateStaticParams](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
- [web.dev — Rendering on the web](https://web.dev/articles/rendering-on-the-web)
