---
title: Streaming, Server Functions, route handlers, and proxy.ts
tech: Next.js 16, React 19.2
version: Next.js 16.x
date: 2026-11-09
covers: [6, 7, 10]
---
# Streaming, Server Functions, route handlers, and proxy.ts
[← Overview](00-overview.md)

## Why it matters
- The product page waits for the slow "recommendations" call (800 ms) before sending any HTML; LCP suffers on every visit.
- A Server Action `deleteAddress(id)` trusts the id from the client; anyone can delete anyone's addresses by calling the action endpoint directly.
- Business logic gets duplicated: half of "apply coupon" lives in a Next.js Server Action, half in the C# API, and they disagree.

## Concepts

### Streaming with Suspense
Next.js sends the HTML shell immediately and streams each `<Suspense>` section when its data resolves.
| Tool | Effect |
|:--|:--|
| `loading.tsx` | Suspense boundary around the whole segment |
| `<Suspense fallback>` in pages | finer sections (reviews, recommendations) |
| independent awaits per component | each section resolves on its own |
| `Promise` passed to a Client Component + `use()` | start fetch on the server, read it on the client |

Place fast, important content (title, price, image) outside boundaries; slow, secondary content inside.

### Server Functions (Server Actions)
`'use server'` functions run on the Next.js server and can be called from forms and Client Components. Each one is a **public HTTP endpoint**.
| Rule | Why |
|:--|:--|
| ⭐ validate input (Zod) | arguments come from the client |
| ⭐ authenticate and authorize inside the action | the action can be called directly |
| keep business rules in ASP.NET Core | one source of truth; the action calls the API |
| `updateTag` / `refresh()` after writes | user sees their change |
| return serializable results | errors as values for forms |

In this stack, Server Functions are thin: validate the form shape, forward the user's cookie to the API, map the Problem Details result for `useActionState`, update tags. The API enforces ownership and rules.

### Route handlers
`app/**/route.ts` exports `GET`, `POST`, … with Web `Request`/`Response`. Use them for webhooks into the frontend (revalidation), OG image generation, or BFF endpoints. Don't build a second API here; the ASP.NET Core API is the API.

### proxy.ts (formerly middleware)
Runs before routes on every matching request (Node.js runtime in Next.js 16).
| Use | Example |
|:--|:--|
| ⭐ same-origin API proxy | rewrite `/api/*` to `API_URL` (01-foundations/07) |
| cheap redirects | locale, legacy URLs |
| auth gate (optimistic) | redirect to `/sign-in` if no session cookie on `/account/*`; real checks still in the API |
| headers | CSP nonce (11-security), security headers |

Keep it fast: no database calls, minimal network.

## Example
`web/src/app/(account)/account/addresses/actions.ts`
```ts
"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { updateTag } from "next/cache";

const Input = z.object({ addressId: z.string().uuid() });

export async function deleteAddress(_prev: unknown, form: FormData) {
  const parsed = Input.safeParse({ addressId: form.get("addressId") });
  if (!parsed.success) return { ok: false as const, message: "Invalid request." };

  const res = await fetch(`${process.env.API_URL}/me/addresses/${parsed.data.addressId}`, {
    method: "DELETE",
    headers: { cookie: (await cookies()).toString() },          // the API checks ownership (404 if not yours)
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 404) return { ok: false as const, message: "Address not found." };
  if (!res.ok) return { ok: false as const, message: "Couldn't delete the address." };

  updateTag("me:addresses");
  return { ok: true as const };
}
```
`web/src/proxy.ts`
```ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.rewrite(new URL(pathname.replace(/^\/api/, "") + search, process.env.API_URL));
  }
  if (pathname.startsWith("/account") && !req.cookies.has("__Host-shop")) {
    return NextResponse.redirect(new URL(`/sign-in?returnUrl=${encodeURIComponent(pathname)}`, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/account/:path*"] };
```
`web/src/app/(shop)/coffee/[slug]/page.tsx` (streaming excerpt)
```tsx
<ProductHeader product={product} />                 {/* fast, outside boundaries */}
<Suspense fallback={<ReviewsSkeleton />}><Reviews slug={slug} /></Suspense>
<Suspense fallback={<RecsSkeleton />}><Recommendations slug={slug} /></Suspense>
```

## Production patterns
- Every Server Function: parse input, rely on the API for authorization, return typed results, never throw raw errors to the client.
- Business logic lives in ASP.NET Core; Next.js orchestrates and renders.
- `proxy.ts` does routing and cheap checks only; the API makes real auth decisions.
- Suspense boundaries match the page's visual sections and their data dependencies.

## Mistakes
Wrong: trusting client-supplied ownership.
```ts
"use server";
export async function deleteAddress(userId: string, id: string) { await db.delete(...) }   // anyone can pass any userId
```
Right: identity comes from the session (cookie) and the API checks ownership.

Wrong: slow data at the top level of the page.
Right: move it into a Suspense-wrapped child component.

## Check yourself
1. Why is every Server Action a security boundary?
2. What should `proxy.ts` not do?
3. Where should "apply coupon" rules live in this stack?

<details><summary>Answers</summary>

1. Each one is reachable as an HTTP endpoint with arbitrary arguments, regardless of which UI calls it.
2. Heavy work (database queries, slow network calls) or authoritative authorization decisions.
3. In the ASP.NET Core API; the frontend only calls it and shows the result.
</details>

## Sources
- [Next.js — Streaming (loading UI)](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [Next.js — Updating data (Server Functions)](https://nextjs.org/docs/app/getting-started/updating-data)
- [Next.js — Data security](https://nextjs.org/docs/app/guides/data-security)
- [Next.js — Route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Next.js — proxy.ts](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
