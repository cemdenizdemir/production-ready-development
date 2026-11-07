---
title: Data fetching and caching in Next.js 16
tech: Next.js 16, React 19.2, Express 5
version: Next.js 16.x (Cache Components)
date: 2026-11-07
covers: [4, 5, 8]
---
# Data fetching and caching in Next.js 16
[← Overview](00-overview.md)

## Why it matters
- An admin updates a price; the storefront shows the old price for an hour because the page was cached with no way to invalidate it.
- A per-user dashboard is accidentally cached and served to other users, because user-specific data was read inside a shared cache.
- A build fails with "Uncached data was accessed outside of `<Suspense>`" and the team disables caching everywhere instead of placing one boundary.

## Concepts

### Fetching in Server Components
- Server Components are `async`: `await` your data directly. No `useEffect`, no client fetch waterfall.
- With Express as the API, call it from the server using an **internal URL** (`API_INTERNAL_URL`, e.g. `http://api:3000` in Docker), and **forward the user's cookies** for authenticated requests.
- Start independent requests in parallel (`Promise.all`), and use Suspense to stream slow ones.
- React's `cache()` deduplicates a function call within one request (e.g. `getCurrentUser()` used by layout and page).

### Static vs dynamic
With `cacheComponents: true`, data access is **dynamic (request-time) by default**. A component becomes part of the prerendered static shell only if its data is cached (`'use cache'`) or it uses no request data.

| Makes rendering request-specific | Note |
|:--|:--|
| `await cookies()`, `await headers()`, `await draftMode()` | async-only in Next.js 16 |
| `await searchParams` (pages) | query string varies per request |
| `await connection()` | explicit opt-in to request time |
| uncached `fetch` or DB calls | dynamic unless wrapped in `'use cache'` |

Rule: request-specific work must sit **inside a `<Suspense>` boundary** (or be cached). Otherwise the build reports an error, so the shell can't accidentally block on it.

### Cache Components
| API | What it does |
|:--|:--|
| `'use cache'` | cache the result of a function, component, or whole file; arguments become part of the key |
| `cacheLife('minutes' \| 'hours' \| 'days' \| 'weeks' \| 'max' \| profile)` | how long the entry is fresh / revalidates / expires |
| `cacheTag('products')` | label entries for targeted invalidation |
| `revalidateTag('products', 'max')` | mark tagged entries stale; next request serves stale while refreshing (profile required in 16) |
| `updateTag('products')` | Server Actions only: expire and refresh now, so the user sees their own write |
| `revalidatePath('/products')` | invalidate by path |
| `refresh()` | Server Actions: refresh the client router's view |
| `'use cache: private'` | per-user caching in the browser only (not shared) |

Inside `'use cache'` you can't read `cookies()` or `headers()`. Read them outside and pass the values you need as arguments, or render that part dynamically.

## Example
`next.config.ts`
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  output: 'standalone',
};

export default nextConfig;
```
`lib/api.ts` — server-only access to the Express API.
```ts
import 'server-only';
import { cookies } from 'next/headers';

const API = process.env.API_INTERNAL_URL!; // e.g. http://api:3000 inside Docker

export async function apiPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiAsUser<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();          // forward the session to Express
  const res = await fetch(`${API}${path}`, { headers: { cookie: cookieHeader } });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}
```
`lib/products.ts` — shared data, cached and tagged.
```ts
import { cacheLife, cacheTag } from 'next/cache';
import { apiPublic } from './api';

export type Product = { id: string; name: string; priceCents: number; description: string };

export async function getProducts() {
  'use cache';
  cacheLife('hours');
  cacheTag('products');
  return apiPublic<Product[]>('/products');
}

export async function getProduct(id: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('products', `product:${id}`);
  return apiPublic<Product | null>(`/products/${id}`);
}
```
`app/(shop)/products/page.tsx` — static shell plus a dynamic, per-user hole.
```tsx
import { Suspense } from 'react';
import { getProducts } from '@/lib/products';
import { apiAsUser } from '@/lib/api';

export default async function ProductsPage() {
  const products = await getProducts();   // cached → prerendered into the shell
  return (
    <>
      <ul>{products.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
      <Suspense fallback={<p>Loading your cart…</p>}>
        <CartSummary />                     {/* reads cookies → rendered per request, streamed */}
      </Suspense>
    </>
  );
}

async function CartSummary() {
  const cart = await apiAsUser<{ count: number }>('/cart');
  return <p>{cart.count} items in your cart</p>;
}
```
Invalidate after an admin edit (Server Action, lesson 04):
```ts
'use server';
import { updateTag } from 'next/cache';

export async function savePrice(id: string, priceCents: number) {
  // ...authorize, then PATCH the Express API...
  updateTag(`product:${id}`); // the admin sees the new price immediately
  updateTag('products');
}
```
When Express itself changes data (a webhook, another service), call a protected route handler that runs `revalidateTag('products', 'max')`.

## Production patterns
- **Cache shared data with tags, invalidate on change.** Time-based `cacheLife` is the safety net, tags are the real freshness mechanism.
- **Never cache per-user data in shared caches.** Read cookies outside `'use cache'`; personalized parts render per request.
- **Forward auth explicitly** (cookies header) from Server Components to Express; never call the API with a privileged service token on behalf of a user.
- **Parallelize and stream:** start independent fetches together; slow parts behind Suspense.
- **Multiple instances need a shared cache handler** (or accept per-instance caches and tag invalidation that only reaches one instance; lesson 05).

## Mistakes
Wrong: user data inside a shared cache.
```ts
async function getDashboard() {
  'use cache';
  const cookieHeader = (await cookies()).toString(); // not allowed, and would mix users if it were
}
```
Right: read cookies outside, render dynamically inside Suspense (or pass a user ID and cache per user deliberately).

Wrong: sequential awaits for independent data.
```tsx
const product = await getProduct(id);
const reviews = await getReviews(id); // waits for product first
```
Right: `const [product, reviews] = await Promise.all([getProduct(id), getReviews(id)]);` or stream reviews.

Wrong: `revalidateTag('products')` with one argument in Next.js 16. Right: `revalidateTag('products', 'max')`, or `updateTag` inside Server Actions.

Wrong: calling the public API URL from the server (through the CDN and back). Right: the internal URL.

## Check yourself
1. With Cache Components on, what decides whether a component joins the static shell?
2. When do you use `updateTag` instead of `revalidateTag`?
3. Why can't `'use cache'` functions read `cookies()`?

<details>
<summary>Answers</summary>

1. Whether its data is cached (`'use cache'`) or it doesn't touch request-specific data. Anything reading cookies, headers, search params, or uncached data is request-time and must be inside Suspense.
2. In a Server Action after the user's own write, when they must see the change immediately (read-your-writes). `revalidateTag` marks entries stale and serves stale content while refreshing, which suits background updates.
3. Cached results are shared across requests; request-specific values would either leak between users or make the cache useless. Pass the needed values as arguments instead (they become part of the cache key).
</details>

## Sources
- [Next.js — Fetching data](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Next.js — Cache Components](https://nextjs.org/docs/app/getting-started/cache-components)
- [Next.js — `use cache` directive](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- [Next.js — `cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) and [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag)
- [Next.js — `updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag) and [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
