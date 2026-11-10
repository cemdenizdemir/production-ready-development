---
title: Tokens, cookies, and securing Server Functions
tech: Next.js 16, ASP.NET Core Identity cookies, Zod 4
version: Next.js 16.x, ASP.NET Core 10
date: 2026-11-09
covers: [5, 6]
---
# Tokens, cookies, and securing Server Functions
[← Overview](00-overview.md)

## Why it matters
- The SPA keeps a JWT in `localStorage`; one XSS sends it to an attacker, who uses it from their own machine until it expires.
- A Server Action `updateEmail(userId, email)` is exported from a file with `'use server'`; it's callable by anyone with any `userId`.
- A route handler accepts `POST` with cookies and no CSRF protection; a malicious page changes the user's delivery address.

## Concepts

### Where tokens live
| Storage | Readable by JS (XSS) | Sent automatically | Verdict |
|:--|:--|:--|:--|
| `localStorage` / `sessionStorage` | yes | no | ⚠ XSS steals it |
| in-memory variable | yes (while page lives) | no | lost on reload; still XSS-exposed |
| ⭐ `HttpOnly; Secure; SameSite=Lax` cookie | no | yes (same-site) | best for browsers; needs CSRF defenses |

In this stack, ASP.NET Core Identity's cookie authentication issues an `HttpOnly` session cookie (`__Host-shop`) on the shop's domain. The browser talks to `/api/*` on the same origin (proxied), so the cookie flows without CORS. JWTs are for non-browser clients (mobile apps, partners) (03-backend/04-auth).

XSS with `HttpOnly` cookies can still make requests **as** the user while the page is open, but can't steal the session for later; CSP limits that further.

### CSRF with cookie sessions
`SameSite=Lax` blocks most cross-site POSTs. For defense in depth on state-changing requests:
- the ASP.NET Core API validates an antiforgery header (`X-XSRF-TOKEN`) or checks `Origin`;
- the frontend fetcher sends the token (read from a non-HttpOnly cookie the API sets for that purpose);
- Next.js Server Actions compare the `Origin` header with the host automatically, and only accept `POST`.

### Securing Server Functions and route handlers
Every Server Function and route handler is a public HTTP endpoint.
| Check | How |
|:--|:--|
| ⭐ input validation | Zod `safeParse` on every argument / form field |
| ⭐ authentication | read the session cookie; forward it to the API, which authenticates |
| ⭐ authorization | the API checks ownership and roles; never trust IDs from the client to mean "mine" |
| CSRF | Server Actions: built-in Origin check; route handlers: verify `Origin`/token yourself for cookie-authenticated POSTs |
| allowed origins | `serverActions.allowedOrigins` when behind proxies with different hosts |
| rate limits | at the API / Front Door |
| errors | return safe messages; log details server-side |
| unused actions | not exported (Next.js removes unused action IDs from the client) |

Closures in Server Actions capture values that get encrypted and sent to the client; don't capture secrets.

## Example
`web/src/app/(account)/account/email/actions.ts`
```ts
"use server";
import { z } from "zod";
import { cookies, headers } from "next/headers";

const Input = z.object({ email: z.email().max(254) });

export async function changeEmail(_prev: unknown, form: FormData) {
  const parsed = Input.safeParse({ email: form.get("email") });
  if (!parsed.success) return { ok: false as const, error: "Enter a valid email address." };

  const jar = await cookies();
  const res = await fetch(`${process.env.API_URL}/me/email`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: jar.toString(),                                   // API authenticates the user from the session
      "X-XSRF-TOKEN": jar.get("XSRF-TOKEN")?.value ?? "",       // API's antiforgery check
      traceparent: (await headers()).get("traceparent") ?? "",
    },
    body: JSON.stringify({ email: parsed.data.email }),          // no userId: the API uses the session's identity
    signal: AbortSignal.timeout(5000),
  });

  if (res.status === 409) return { ok: false as const, error: "That email is already in use." };
  if (!res.ok) return { ok: false as const, error: "Couldn't change your email. Try again." };
  return { ok: true as const };
}
```
`web/src/api/fetcher.ts` (client side, excerpt)
```ts
function xsrfToken(): string | undefined {
  return document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="))?.split("=")[1];
}
// in apiFetch for non-GET requests:
// headers["X-XSRF-TOKEN"] = decodeURIComponent(xsrfToken() ?? "");
```

## Production patterns
- Browser sessions are `HttpOnly` cookies from the API; no tokens in `localStorage`.
- Server Functions are thin and parse all input; identity comes from the session, authorization from the API.
- Unsafe methods carry an antiforgery token or are Origin-checked on both Next.js and ASP.NET Core.
- Review every new `'use server'` export as you would a new API endpoint.

## Mistakes
Wrong:
```ts
"use server";
export async function updateEmail(userId: string, email: string) { /* trusts userId */ }
```
Right: no user ID parameter; the API derives the user from the session.

Wrong: `localStorage.setItem("token", jwt)`.
Right: `HttpOnly` session cookie set by the API.

## Check yourself
1. What can an attacker do with XSS when the session is an `HttpOnly` cookie, and what can't they do?
2. Why is a Server Action argument like `orderId` untrusted?
3. What CSRF protection do Next.js Server Actions have built in?

<details><summary>Answers</summary>

1. They can make requests as the user while the page is open; they can't read the cookie and reuse the session elsewhere later.
2. Anyone can call the action endpoint with any arguments; ownership must be checked by the API.
3. They only accept POST and compare the `Origin` header with the host (configurable with `serverActions.allowedOrigins`).
</details>

## Sources
- [Next.js — Data security (Server Actions)](https://nextjs.org/docs/app/guides/data-security)
- [Next.js — serverActions config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- [OWASP — HTML5 Security (local storage)](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage)
- [ASP.NET Core — Antiforgery with JavaScript/SPAs](https://learn.microsoft.com/aspnet/core/security/anti-request-forgery#javascript-ajax-and-spas)
