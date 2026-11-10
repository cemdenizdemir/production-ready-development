---
title: Content Security Policy and security headers
tech: Next.js 16, CSP, Trusted Types
version: Next.js 16.x (proxy.ts), CSP Level 3
date: 2026-11-07
covers: [3, 8, 9]
---
# Content Security Policy and security headers
[← Overview](00-overview.md)

## Why it matters
- An XSS bug slips through review. With a strict CSP, the injected inline script is blocked and reported; without one, every session is exposed.
- June 2024: a CDN serving a popular polyfill script changed owners and began injecting malware. Sites loading it directly from the CDN shipped malware to their users.
- The app can be framed by any site, enabling clickjacking on "Delete account" and "Transfer" buttons.

## Concepts

### Content Security Policy
CSP is a response header listing where scripts, styles, images, frames, and connections may come from. The browser blocks everything else.

| Directive | Controls | Typical value |
|:--|:--|:--|
| `default-src` | fallback for other fetch directives | `'self'` |
| `script-src` | scripts | `'self' 'nonce-…' 'strict-dynamic'` |
| `style-src` | styles | `'self' 'nonce-…'` (or `'unsafe-inline'` as a pragmatic start) |
| `img-src` | images | `'self' data: https://cdn.example.com` |
| `connect-src` | fetch/XHR/WebSocket targets | `'self' https://api.example.com https://*.ingest.sentry.io` |
| `frame-ancestors` | who may frame you | `'none'` |
| `form-action` | where forms may submit | `'self'` |
| `base-uri` | `<base>` tag | `'self'` |
| `object-src` | plugins | `'none'` |
| `upgrade-insecure-requests` | rewrite http: to https: | present |
| `report-to` | where violation reports go | endpoint name |
| `require-trusted-types-for 'script'` | Trusted Types enforcement | after rollout |

**Nonce + `'strict-dynamic'`:** each response gets a random nonce; only `<script nonce="…">` runs, and scripts it loads inherit trust. This blocks injected inline scripts without maintaining a long host allowlist.

**Rollout:** start with `Content-Security-Policy-Report-Only`, collect violations, fix them, then enforce.

### CSP in Next.js 16
- Generate a nonce per request in `proxy.ts`, set the CSP header on the response, and pass the nonce to the app via a request header. Next.js reads the CSP from the request and adds the nonce to its own scripts.
- Nonces need **request-time rendering**: a cached static shell can't contain a per-request nonce. For static pages, use a policy without nonces (hashes, Subresource Integrity, host allowlists) and keep nonce-based CSP for dynamic pages.
- In development, React's dev tooling needs `'unsafe-eval'`; never ship it to production.

### Trusted Types
With `require-trusted-types-for 'script'`, DOM sinks like `innerHTML` reject plain strings; only values created by a registered policy (for example one that runs DOMPurify) are accepted. This turns most DOM XSS into errors. Roll it out in report-only mode first; third-party code often needs fixes.

### Third-party scripts and Subresource Integrity
| Control | Effect |
|:--|:--|
| Prefer self-hosting | no external party can change your code |
| SRI (`integrity="sha384-…" crossorigin="anonymous"`) | browser refuses a CDN file whose hash changed |
| Pinned versions on CDNs | SRI only works for immutable URLs |
| CSP host allowlist | scripts only from origins you chose |
| Review and register every script | owner, purpose, data access |

### Other security headers
| Header | Value | Protects against |
|:--|:--|:--|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS downgrade |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | URL leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self)` | abuse of powerful features |
| `Cross-Origin-Opener-Policy` | `same-origin` | cross-window attacks |
| `X-Frame-Options` | `DENY` | clickjacking in old browsers (CSP `frame-ancestors` is the modern one) |
| `poweredByHeader: false` | remove `X-Powered-By: Next.js` | fingerprinting |

## Example
`proxy.ts` — nonce-based CSP for dynamic pages.
```ts
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' blob: data: https://cdn.example.com`,
    `font-src 'self'`,
    `connect-src 'self' https://*.ingest.sentry.io`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp); // Next.js reads this to nonce its own scripts

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [{ source: '/((?!api|_next/static|_next/image|favicon.ico).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }] }],
};
```
Using the nonce for your own inline script:
```tsx
import { headers } from 'next/headers';
import Script from 'next/script';

export default async function Page() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return <Script src="https://analytics.example.com/script.js" strategy="afterInteractive" nonce={nonce} />;
}
```
`next.config.ts` — static security headers for every response.
```ts
import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
```
SRI for a pinned CDN script (when self-hosting isn't possible):
```html
<script src="https://cdn.example.com/lib@4.2.1/lib.min.js"
        integrity="sha384-<base64-hash-of-the-exact-file>" crossorigin="anonymous"></script>
```

## Production patterns
- **Report-only first, then enforce**; keep a reporting endpoint and watch violations after each release.
- **Nonce + `'strict-dynamic'`** for dynamic pages; hashes/SRI for static ones; no `'unsafe-inline'` scripts in production.
- **`frame-ancestors 'none'`** unless embedding is a feature.
- **Self-host third-party code** where licenses allow; otherwise pin versions with SRI and allowlist hosts.
- **Check headers in CI** (curl the preview deployment) and with Mozilla HTTP Observatory.

## Mistakes
Wrong: a CSP that allows everything.
```text
script-src * 'unsafe-inline' 'unsafe-eval'
```
Right: nonces with `'strict-dynamic'`, no `unsafe-*` in production.

Wrong: enforcing a new CSP straight to production. Payment widgets and analytics break.
Right: `Content-Security-Policy-Report-Only` first.

Wrong: loading scripts from public CDNs by floating URL (`/latest/`). Right: self-host or pin + SRI.

Wrong: expecting nonces on statically cached pages. The nonce would be the same for everyone (or missing). Right: dynamic rendering for nonce pages, or a hash/SRI policy for static ones.

## Check yourself
1. What does `'strict-dynamic'` change about how nonces work?
2. Why must CSP be rolled out in report-only mode first?
3. Why don't nonces work with cached static pages?

<details>
<summary>Answers</summary>

1. Scripts that are already trusted via nonce (or hash) can load further scripts, which are trusted too; host allowlists are ignored. You don't need to list every CDN a trusted loader uses.
2. Real pages use inline styles, third-party widgets, and analytics you might have forgotten; report-only shows every violation without breaking the site, so you can fix the policy or the code first.
3. A nonce must be unpredictable and unique per response. A cached page serves the same HTML (and nonce) to many users, so attackers could learn and reuse it.
</details>

## Sources
- [Next.js — Content Security Policy guide](https://nextjs.org/docs/app/guides/content-security-policy)
- [web.dev — Strict CSP](https://web.dev/articles/strict-csp)
- [MDN — CSP directives](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)
- [MDN — Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- [web.dev — Trusted Types](https://web.dev/articles/trusted-types)
- [Mozilla HTTP Observatory](https://developer.mozilla.org/en-US/observatory)
