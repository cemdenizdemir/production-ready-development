---
title: App Router, Server and Client Components, hydration
tech: Next.js 16, React 19.2
version: Next.js 16.x, React 19.2
date: 2026-11-09
covers: [2, 3, 9]
---
# App Router, Server and Client Components, hydration
[← Overview](00-overview.md)

## Why it matters
- `'use client'` at the top of `layout.tsx` turns the whole app into client code; the JavaScript bundle triples.
- A Server Component passes a class instance with methods to a Client Component; the build fails with a serialization error the night before release.
- "Text content does not match server-rendered HTML" appears in production for users in other time zones; dates render differently on server and client.

## Concepts

### App Router files
| File | Role |
|:--|:--|
| `app/layout.tsx` | root layout (`<html>`, `<body>`), persists across navigations |
| `page.tsx` | route UI; makes a segment publicly routable |
| `layout.tsx` (nested) | shared UI for a segment and its children |
| `loading.tsx` | Suspense fallback for the segment (streaming) |
| `error.tsx` | error boundary for the segment (must be a Client Component) |
| `not-found.tsx` | UI for `notFound()` |
| `template.tsx` | like layout but remounts on navigation |
| `route.ts` | route handler (HTTP endpoint) |
| `[slug]` / `[...slug]` / `[[...slug]]` | dynamic, catch-all, optional catch-all |
| `(group)` | route group: organizes without affecting the URL (e.g. `(shop)`, `(account)`) |
| `_folder` | private, not routed |
| `@slot` | parallel routes |

### Server vs Client Components
| | Server Component (default) | Client Component (`'use client'`) |
|:--|:--|:--|
| runs | on the Next.js server only | server (prerender) + browser |
| can | `await` data, read env secrets, call the API directly, use server-only libraries | state, effects, event handlers, browser APIs, TanStack Query |
| ships JS to browser | no | yes |
| imports | Server or Client Components | only Client Components (and shared pure code) |

Place `'use client'` at the **leaves**: an `AddToCartButton`, not the product page. Server Components can render Client Components and pass them **serializable** props (plain objects, arrays, strings, numbers, Dates, promises), or JSX as `children`.

`import "server-only"` in modules that must never reach the browser (API secrets, server fetchers); `import "client-only"` for browser-only code.

### Hydration
The server sends HTML; React in the browser **hydrates** it, attaching event handlers and expecting the first client render to produce the same markup.
| Mismatch cause | Fix |
|:--|:--|
| `Date.now()`, `Math.random()`, `new Date().toLocaleString()` in render | compute on the server and pass down, or render after mount |
| locale/time zone differences | format with an explicit `timeZone` and locale shared by server and client |
| `typeof window !== "undefined"` branches | `useEffect`/`useSyncExternalStore` with a server snapshot |
| invalid HTML nesting (`<p><div>`) | fix the markup |
| browser extensions modifying the DOM | `suppressHydrationWarning` on the specific element only if unavoidable |

## Example
```text
web/src/app/
  layout.tsx                     # <html lang>, fonts, Providers (client) wrapping children
  (shop)/layout.tsx              # header, footer
  (shop)/coffee/page.tsx         # Server Component: list
  (shop)/coffee/[slug]/page.tsx  # Server Component: detail
  (shop)/coffee/[slug]/loading.tsx
  (account)/account/layout.tsx   # requires auth
  (account)/account/orders/page.tsx
  not-found.tsx
```
`web/src/app/(shop)/coffee/[slug]/page.tsx`
```tsx
import { notFound } from "next/navigation";
import { getProduct } from "@/server/catalog";
import { AddToCartButton } from "@/features/cart/AddToCartButton";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <article>
      <h1>{product.name}</h1>
      <p>{product.roastedOn}</p>                          {/* formatted on the server: no mismatch */}
      <AddToCartButton sku={product.sku} />               {/* the only client JS on this page section */}
    </article>
  );
}
```
`web/src/features/cart/AddToCartButton.tsx`
```tsx
"use client";
import { useAddCartLine } from "@/api/generated/cart/cart";

export function AddToCartButton({ sku }: { sku: string }) {
  const add = useAddCartLine();
  return (
    <button type="button" disabled={add.isPending} onClick={() => add.mutate({ data: { sku, quantity: 1 } })}>
      {add.isPending ? "Adding…" : "Add to cart"}
    </button>
  );
}
```

## Production patterns
- Server Components by default; `'use client'` only for interactive leaves and providers.
- Route groups separate public shop pages from authenticated account pages, each with its own layout.
- `server-only` on every module that calls the API with server credentials.
- Format dates and money on the server or with explicit locale/time zone on both sides.

## Mistakes
Wrong: client boundary at the root.
```tsx
"use client";             // in app/layout.tsx
```
Right: a small `Providers` Client Component that wraps `children` inside a Server Component layout.

Wrong: passing functions or class instances to Client Components.
Right: pass plain data; define handlers inside the Client Component or use Server Functions.

## Check yourself
1. Can a Client Component import a Server Component?
2. What does `error.tsx` need at the top of the file?
3. Why does `new Date().toLocaleTimeString()` in render cause hydration warnings?

<details><summary>Answers</summary>

1. No, but it can render one passed to it as `children` (or another prop) by a Server Component.
2. `'use client'`; error boundaries are Client Components.
3. The server and the browser render at different times and often in different time zones/locales, so the text differs.
</details>

## Sources
- [Next.js — Project structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Next.js — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js — Route groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)
- [react.dev — 'use client'](https://react.dev/reference/rsc/use-client)
- [Next.js — Hydration error](https://nextjs.org/docs/messages/react-hydration-error)
