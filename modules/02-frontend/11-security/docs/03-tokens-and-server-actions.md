---
title: Tokens in the browser and securing Server Actions
tech: Next.js 16, React 19.2, Express 5
version: Next.js 16.x, React 19.2
date: 2026-11-07
covers: [5, 6]
---
# Tokens in the browser and securing Server Actions
[← Overview](00-overview.md)

## Why it matters
- A single-page app stores a long-lived JWT in `localStorage`. One XSS bug, or one malicious npm package in the frontend bundle, exfiltrates every user's token.
- A Server Action updates any user's email because it trusts the `userId` sent from the client form.
- Three Next.js instances run behind a load balancer; Server Action requests fail randomly because each instance generated its own encryption key.

## Concepts

### Where to keep auth in the browser
| Option | Readable by injected JS? | CSRF risk | Verdict |
|:--|:--|:--|:--|
| `HttpOnly; Secure; SameSite=Lax` session cookie | no | yes, mitigated (SameSite + Origin checks) | recommended |
| `localStorage` / `sessionStorage` token | yes | no | avoid for anything long-lived |
| In-memory token (JS variable) | yes, while the page runs | no | ok for short-lived access tokens with a cookie-based refresh |
| Non-HttpOnly cookie | yes | yes | worst of both |

STACK.md: Express owns sessions (hand-built, then Better Auth) and sets an `HttpOnly` `__Host-` cookie. The browser talks to the API on the **same origin** (`/api/*` routed to Express), and Next.js Server Components forward the cookie to Express on the server side. No token ever lives in JavaScript.

### Server Actions are public endpoints
Next.js gives Server Actions some protections automatically:
| Built in | Not built in |
|:--|:--|
| POST only | authentication |
| Origin header compared with Host (CSRF protection) | authorization (does this user own this object?) |
| Unguessable action IDs; unused actions removed from the bundle | input validation |
| Encrypted closure variables | rate limiting |

So every action must: **validate input** (Zod), **authenticate** (who is calling), **authorize** (may they do this to this object), and **return minimal data**. Never trust IDs from the client to decide *whose* data to change; derive the user from the session.

Behind a proxy that rewrites `Host`, set `experimental.serverActions.allowedOrigins`. With several instances, set the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` on all of them.

### Route handlers
Route handlers get **no** automatic CSRF protection. For cookie-authenticated state changes in `route.ts`, check the `Origin` header (or `Sec-Fetch-Site`) yourself, validate input, and authorize.

## Example
`app/settings/actions.ts` — the user comes from the session, not the form.
```ts
'use server';
import { cookies } from 'next/headers';
import { updateTag } from 'next/cache';
import { z } from 'zod';

const ChangeEmail = z.object({ email: z.email().max(254) });

export async function changeEmail(_prev: { error?: string }, formData: FormData) {
  const parsed = ChangeEmail.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: 'Enter a valid email address.' };

  // Express identifies the user from the session cookie; we never send a userId from the client.
  const res = await fetch(`${process.env.API_INTERNAL_URL}/me/email`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie: (await cookies()).toString() },
    body: JSON.stringify(parsed.data),
  });

  if (res.status === 401) return { error: 'Your session expired. Log in again.' };
  if (res.status === 409) return { error: 'That email is already in use.' };
  if (!res.ok) return { error: 'Could not change your email. Try again.' };

  updateTag('me');
  return {};
}
```
`app/api/export/route.ts` — manual CSRF check for a cookie-authenticated POST handler.
```ts
const ALLOWED_ORIGINS = new Set([process.env.APP_ORIGIN!]); // e.g. https://app.example.com

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (!(site === 'same-origin' || (origin && ALLOWED_ORIGINS.has(origin)))) {
    return Response.json({ error: 'Cross-site request blocked' }, { status: 403 });
  }
  const res = await fetch(`${process.env.API_INTERNAL_URL}/exports`, {
    method: 'POST',
    headers: { cookie: request.headers.get('cookie') ?? '' },
  });
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
```
`next.config.ts` (excerpt) and environment for self-hosting:
```ts
experimental: {
  serverActions: {                        // Server Actions are stable; these options keep the experimental key
    allowedOrigins: ['app.example.com'],  // when a proxy changes the Host header
    bodySizeLimit: '1mb',
  },
},
```
```bash
# same value on every instance (generate once: openssl rand -base64 32)
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<base64 key from your secret manager>
```

## Production patterns
- **`HttpOnly` session cookies set by Express**, same-origin API routing, no tokens in JS.
- **Every Server Action = validate + authenticate + authorize + minimal response**, enforced in code review.
- **Derive identity from the session** on the server; IDs from the client only identify *which* object, and ownership is checked.
- **Manual Origin checks in cookie-authenticated route handlers.**
- **Shared encryption key and allowed origins** configured for multi-instance, proxied deployments.

## Mistakes
Wrong: long-lived tokens in `localStorage`.
```ts
localStorage.setItem('token', jwt); // readable by any injected script
```
Right: an `HttpOnly` cookie set by the API.

Wrong: trusting a user ID from the form.
```ts
export async function deleteAccount(formData: FormData) {
  await api.delete(`/users/${formData.get('userId')}`); // any user ID works
}
```
Right: the API deletes the account of the session's user (`DELETE /me`).

Wrong: assuming route handlers have CSRF protection like Server Actions. Right: check `Origin`/`Sec-Fetch-Site` for cookie-authenticated POSTs.

Wrong: a per-instance random encryption key in multi-instance deployments. Right: one `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` from the secret manager.

## Check yourself
1. Why are `HttpOnly` cookies safer than `localStorage` for session tokens, and what new risk do they bring?
2. What does Next.js check automatically for Server Actions, and what must you add?
3. Why must a Server Action derive the user from the session rather than form data?

<details>
<summary>Answers</summary>

1. Injected scripts can't read `HttpOnly` cookies, so a session can't be stolen and replayed elsewhere. Cookies are sent automatically, so CSRF must be handled (SameSite, Origin checks, Server Actions' built-in check).
2. Automatically: POST only, Origin vs Host comparison, unguessable IDs, encrypted closures. You must add input validation, authentication, authorization, and rate limiting.
3. Form data is fully controlled by the caller; anyone can call the action with any user ID. Only the session, validated on the server, proves who is acting.
</details>

## Sources
- [Next.js — Data security: Server Actions](https://nextjs.org/docs/app/guides/data-security#mutating-data)
- [Next.js — `serverActions` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- [Next.js — Self-hosting: Server Actions encryption key](https://nextjs.org/docs/app/guides/self-hosting#server-functions-encryption-key)
- [OWASP — HTML5 Security Cheat Sheet (local storage)](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage)
- [OWASP — CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
