---
title: App Router, Server and Client Components, streaming
tech: Next.js 16, React 19.2
version: Next.js 16.x, React 19.2
date: 2026-11-07
covers: [2, 3, 6]
---
# App Router, Server and Client Components, streaming
[← Overview](00-overview.md)

## Why it matters
- `'use client'` at the top of the root layout turns the whole app into client components. The bundle doubles and nothing benefits from server rendering.
- A Server Component passes a database row with a `passwordHash` field as props to a Client Component. It's now in the HTML payload for anyone to read.
- A slow recommendations query blocks the whole product page because there's no Suspense boundary around it.

## Concepts

### File conventions
| File | Role |
|:--|:--|
| `app/layout.tsx` | root layout: `<html>`, `<body>`, providers; persists across navigation |
| `page.tsx` | the UI for a route; makes the segment public |
| `layout.tsx` (nested) | shared UI for a segment and its children |
| `loading.tsx` | Suspense fallback for the segment (instant loading state) |
| `error.tsx` | error boundary for the segment (must be a Client Component) |
| `not-found.tsx` | UI for `notFound()` |
| `global-error.tsx` | catches errors in the root layout |
| `template.tsx` | like layout, but remounts on navigation |
| `default.tsx` | fallback for parallel routes (required in Next.js 16) |
| `route.ts` | HTTP handler instead of a page (lesson 04) |

| Folder pattern | Meaning |
|:--|:--|
| `app/products/[id]/` | dynamic segment, `params.id` |
| `[...slug]` / `[[...slug]]` | catch-all / optional catch-all |
| `(shop)/` | route group: organizes files, not in the URL |
| `_components/` | private folder, not routable |
| `@modal/` | parallel route slot |
| `(.)photo/[id]` | intercepting route (modals over lists) |

### Server vs Client Components
| | Server Component (default) | Client Component (`'use client'`) |
|:--|:--|:--|
| Runs | on the server only | server (HTML) + browser (hydration) |
| Can use | `async`/`await`, server-only APIs, secrets, direct backend calls | state, effects, event handlers, browser APIs, context |
| Ships JS | no | yes |
| Can import | Server and Client Components | only Client Components (children can be server-rendered via props) |

- `'use client'` marks a **boundary**: that file and everything it imports become client code.
- Keep the boundary **low**: interactive leaves (buttons, forms, dropdowns) are client; pages and layouts stay server.
- Pass **Server Components as `children`** into Client Components to keep them server-rendered.
- Props crossing the boundary must be **serializable** and are visible in the payload: pass only what the client needs.
- `import 'server-only'` in modules that must never reach the client (secrets, DB access).

### Streaming
Each `<Suspense>` boundary (or `loading.tsx`) lets the server send the page shell immediately and stream the slow part when ready. Place boundaries around independent slow data: recommendations, reviews, personalized panels.

## Example
```text
app/
  layout.tsx                 root layout (server)
  (shop)/
    products/
      page.tsx               product list (server)
      [id]/
        page.tsx             product detail (server)
        loading.tsx          skeleton while the page's data loads
        error.tsx            'use client' error boundary
        _components/
          AddToCart.tsx      'use client' (interactive leaf)
          Reviews.tsx        async server component (slow)
```
`app/(shop)/products/[id]/page.tsx`
```tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/products';
import { AddToCart } from './_components/AddToCart';
import { Reviews } from './_components/Reviews';

export default async function ProductPage({ params }: PageProps<'/products/[id]'>) {
  const { id } = await params;                       // params is a Promise in Next.js 16
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <article>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <AddToCart productId={product.id} priceCents={product.priceCents} /> {/* only what it needs */}
      <Suspense fallback={<p>Loading reviews…</p>}>
        <Reviews productId={product.id} />           {/* streams in later; doesn't block the page */}
      </Suspense>
    </article>
  );
}
```
`_components/AddToCart.tsx`
```tsx
'use client';
import { useState } from 'react';

export function AddToCart({ productId, priceCents }: { productId: string; priceCents: number }) {
  const [qty, setQty] = useState(1);
  return (
    <form action={`/api/cart/${productId}`} method="post">
      <input type="number" name="qty" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label="Quantity" />
      <button>Add to cart · {(priceCents * qty / 100).toFixed(2)} €</button>
    </form>
  );
}
```
`error.tsx`
```tsx
'use client';
export default function ProductError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert">
      <p>Something went wrong loading this product.</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```
`PageProps<'/products/[id]'>` is a global helper type Next.js generates (`next dev`, `next build`, or `next typegen`).

## Production patterns
- **Server by default; `'use client'` only on interactive leaves.** Check the bundle with the build output and analyzer.
- **Data access in server-only modules** (`import 'server-only'`) that return DTOs with just the fields the UI needs ([11-security](../../11-security/README.md)).
- **Suspense around each slow, independent section**, with skeletons that match the final layout (no layout shift).
- **`error.tsx` per important segment** with a retry; report errors to Sentry.
- **Route groups** to share layouts (shop vs account vs admin) without affecting URLs.

## Mistakes
Wrong: the client boundary at the top.
```tsx
// app/layout.tsx
'use client'; // the entire app becomes client-side
```
Right: keep layouts and pages server; mark small interactive components.

Wrong: leaking server data through props.
```tsx
<ProfileCard user={userRowFromDb} /> // passwordHash, internal flags now in the payload
```
Right: `<ProfileCard user={{ name: user.name, avatarUrl: user.avatarUrl }} />`.

Wrong: importing a server-only module into a Client Component (DB client, secrets). Right: `import 'server-only'` in that module so the build fails.

Wrong: one `loading.tsx` at the root for everything. Right: boundaries close to slow content.

## Check yourself
1. What does `'use client'` actually mark?
2. How can a Client Component render a Server Component?
3. Why does a Suspense boundary around reviews improve the page?

<details>
<summary>Answers</summary>

1. A module boundary: that file and the modules it imports are bundled for the client. Components above it remain Server Components.
2. Not by importing it, but by receiving it already rendered, typically as `children` or another prop, from a Server Component parent.
3. The rest of the page streams and becomes visible immediately; the reviews arrive when their data is ready instead of delaying the whole response.
</details>

## Sources
- [Next.js — Project structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Next.js — Layouts and pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages)
- [Next.js — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js — Loading UI and streaming](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [Next.js — Error handling](https://nextjs.org/docs/app/getting-started/error-handling)
