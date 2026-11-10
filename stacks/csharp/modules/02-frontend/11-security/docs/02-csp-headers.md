---
title: Content Security Policy and security headers in Next.js
tech: Next.js 16 (proxy.ts), CSP Level 3
version: Next.js 16.x, CSP Level 3
date: 2026-11-09
covers: [3, 9]
---
# Content Security Policy and security headers in Next.js
[← Overview](00-overview.md)

## Why it matters
- An XSS bug slips through review; without CSP it exfiltrates data, with a strict CSP the injected script never runs.
- A competitor frames the shop in an invisible iframe and tricks users into clicking "Delete account" (clickjacking).
- A CSP with `'unsafe-inline'` and `*` sources is "enabled" and protects nothing.

## Concepts

### Strict CSP with nonces
A per-request random **nonce** is put in the CSP header and on every allowed `<script>`. Injected scripts don't know it and are blocked. `'strict-dynamic'` lets nonced scripts load their own dependencies.

| Directive | Value for the shop | Purpose |
|:--|:--|:--|
| `default-src` | `'self'` | baseline |
| ⭐ `script-src` | `'self' 'nonce-{n}' 'strict-dynamic'` | only nonced scripts |
| `style-src` | `'self' 'nonce-{n}'` (or `'unsafe-inline'` for styles if a library needs it) | styles |
| `img-src` | `'self' blob: data: https://images.roastery.test` | product images |
| `connect-src` | `'self' https://*.sentry.io` | fetch/XHR/WebSocket targets |
| `font-src` | `'self'` | `next/font` self-hosts |
| `frame-src` | `https://js.stripe.com` | embedded payment frames |
| ⭐ `frame-ancestors` | `'none'` | no framing (clickjacking) |
| `base-uri` | `'none'` | no `<base>` hijacking |
| `form-action` | `'self'` | forms post only to us |
| `object-src` | `'none'` | no plugins |
| `upgrade-insecure-requests` | — | http → https |
| `require-trusted-types-for` | `'script'` | Trusted Types (where supported) |
| `report-to` | endpoint group | violation reports |

Roll out with `Content-Security-Policy-Report-Only` first, watch reports, then enforce.

Nonce-based CSP requires dynamic rendering (each response needs a fresh nonce), which conflicts with fully static/cached pages. Options: nonces on dynamic pages, hashes (`'sha256-…'`) for static ones, or a pragmatic policy without nonces for cached marketing pages plus strict nonces on account and checkout.

### Other security headers for the Next.js app
| Header | Value |
|:--|:--|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (usually set at Front Door too) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")` |
| `Cross-Origin-Opener-Policy` | `same-origin` (`same-origin-allow-popups` if payment popups are used) |
| `X-Frame-Options` | `DENY` (legacy; `frame-ancestors` is the modern control) |

Static headers go in `next.config.ts` `headers()`; the CSP with a nonce is set in `proxy.ts`. The ASP.NET Core API sets its own API headers (01-foundations/06-security lesson 04).

## Example
`web/src/proxy.ts`
```ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.rewrite(new URL(req.nextUrl.pathname.replace(/^\/api/, "") + req.nextUrl.search, process.env.API_URL));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data: https://images.roastery.test",
    "connect-src 'self' https://*.ingest.sentry.io",
    "font-src 'self'",
    "frame-src https://js.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);          // Next.js reads it and nonces its own scripts

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)", missing: [{ type: "header", key: "next-router-prefetch" }] }],
};
```
`web/next.config.ts` (static headers)
```ts
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    ],
  }];
},
```
Reading the nonce for your own scripts: `const nonce = (await headers()).get("x-nonce")` in a Server Component, then `<Script nonce={nonce} ... />`.

## Production patterns
- Start in report-only, collect violations (Sentry supports CSP reports), then enforce.
- Strict nonces on dynamic, sensitive routes (account, checkout); a reviewed hash/allowlist policy on cached pages.
- `frame-ancestors 'none'` everywhere unless a partner legitimately embeds you.
- Test headers in E2E (`expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'")`).

## Mistakes
Wrong: a CSP that allows everything.
```text
script-src * 'unsafe-inline' 'unsafe-eval'
```
Right: nonces + `'strict-dynamic'`, no `'unsafe-inline'` for scripts.

Wrong: enforcing a new CSP straight in production.
Right: `Content-Security-Policy-Report-Only` first.

## Check yourself
1. Why does a nonce-based CSP make a page dynamic?
2. Which directive prevents clickjacking?
3. What does `'strict-dynamic'` allow?

<details><summary>Answers</summary>

1. Each response needs a fresh, unpredictable nonce in both the header and the script tags, so it can't be served from a static cache.
2. `frame-ancestors 'none'` (or a specific allowlist).
3. Scripts loaded by an already-trusted (nonced) script are trusted too, without listing their hosts.
</details>

## Sources
- [Next.js — Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy)
- [MDN — Content-Security-Policy](https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Security-Policy)
- [web.dev — Strict CSP](https://web.dev/articles/strict-csp)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [OWASP — HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
