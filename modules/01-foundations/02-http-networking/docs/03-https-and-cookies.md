---
title: HTTPS, TLS, and cookies
tech: HTTP, Node.js 26, Express 5, Chrome DevTools
version: Node.js 26 LTS, Express 5.2, TLS 1.3
date: 2026-11-07
covers: [5, 6]
---
# HTTPS, TLS, and cookies
[← Overview](00-overview.md)

## Why it matters
- A page served over plain HTTP on café Wi-Fi leaks the session cookie. The attacker is now the user.
- A session cookie without `HttpOnly` is stolen by one XSS payload with `document.cookie`.
- A certificate expires on a Saturday because renewal was manual. Every client fails with a TLS error until someone wakes up.

## Concepts

### What TLS gives you
- **Confidentiality:** traffic is encrypted.
- **Integrity:** nobody can modify it in transit.
- **Authentication:** the certificate proves the server owns the domain.

| Item | What to know |
|:--|:--|
| Certificate | issued by a CA for names in its SAN list; wildcard `*.example.com` covers one level |
| Lifetime | public certs: max 200 days since March 2026, 100 days from 2027, 47 days from 2029. Automate (ACME, AWS ACM) |
| Versions | TLS 1.3 preferred, 1.2 minimum. 1.0 and 1.1 are disabled everywhere |
| HSTS | `Strict-Transport-Security` tells browsers to use HTTPS only for this host for `max-age` seconds |
| Redirect | HTTP → HTTPS with 301 or 308, ideally at the CDN or load balancer |
| Mixed content | an HTTPS page loading HTTP scripts: browsers block it |

HSTS closes the gap where the very first request is plain HTTP. The preload list (hstspreload.org) bakes your domain into browsers; it is hard to undo, so add it only once every subdomain is HTTPS.

### Cookie attributes
| Attribute | Effect | Session cookie |
|:--|:--|:--|
| `HttpOnly` | JavaScript cannot read it | ✓ always |
| `Secure` | sent over HTTPS only | ✓ always |
| `SameSite=Lax` | not sent on cross-site POSTs or subrequests; sent on top-level GET navigations | ✓ default choice |
| `SameSite=Strict` | never sent cross-site, even when following a link | admin areas |
| `SameSite=None` | always sent cross-site; requires `Secure` | third-party embeds only |
| `Domain` | omitted = this host only; set = shared with subdomains | omit |
| `Path` | URL path scope; not a security boundary | `/` |
| `Max-Age` / `Expires` | persists the cookie; omitted = until the browser closes | e.g. 7 days |
| `__Host-` name prefix | browser enforces `Secure`, `Path=/`, no `Domain` | ✓ use it |
| `__Secure-` name prefix | browser enforces `Secure` | when you need `Domain` |
| `Partitioned` | CHIPS: third-party cookie keyed by top-level site | embeds |

**Site vs origin:** `app.example.com` and `api.example.com` are the *same site* (same registrable domain) but *different origins*. SameSite rules use sites; CORS (lesson 04) uses origins.

## Example: secure session cookie
`login.ts` — Express 5 behind one TLS-terminating load balancer.
```ts
import express from 'express';
import { randomBytes } from 'node:crypto';

const app = express();
app.set('trust proxy', 1); // one proxy in front; makes req.secure use X-Forwarded-Proto (lesson 04)

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(308, `https://${req.hostname}${req.originalUrl}`); // fallback; prefer the edge
  }
  res.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
});

const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } as const;

app.post('/login', (_req, res) => {
  // ...verify credentials first (03-backend/04-auth)...
  const sessionId = randomBytes(32).toString('base64url'); // opaque, unguessable
  res.cookie('__Host-sid', sessionId, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // ms
  res.status(204).end();
});

app.post('/logout', (_req, res) => {
  res.clearCookie('__Host-sid', cookieOptions); // same attributes, or the browser keeps it
  res.status(204).end();
});

app.listen(3000);
```
Check it:
```bash
curl -si -X POST localhost:3000/login | grep -i set-cookie
# Set-Cookie: __Host-sid=…; Max-Age=604800; Path=/; Expires=…; HttpOnly; Secure; SameSite=Lax
curl -sI https://example.com/ | grep -i strict-transport-security
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null | openssl x509 -noout -dates
```
In DevTools: **Application → Cookies** shows the flags. **Network → a request → Cookies** shows cookies that were blocked and why.

Browsers treat `http://localhost` as a secure context, so `Secure` and `__Host-` cookies work in local development.

## Production patterns
- **HTTPS everywhere**, internal tools included. Use ACM or Let's Encrypt with automatic renewal and alert on expiry anyway.
- **HSTS with a long `max-age`** once all subdomains serve HTTPS. Preload only when you are sure.
- **Session cookie = `__Host-` + `HttpOnly` + `Secure` + `SameSite=Lax`, no `Domain`.** Store an opaque ID, not user data.
- **SameSite is defense in depth for CSRF, not the whole defense.** Also check the `Origin` header or use CSRF tokens on state-changing requests ([06-security](../../06-security/README.md)).
- **Set `trust proxy` to the real number of hops**, or `req.secure` and `req.ip` lie (lesson 04).

## Mistakes
Wrong: a cookie with default attributes.
```ts
res.cookie('sid', id); // readable by JS, sent over HTTP, no SameSite set explicitly
```
Right:
```ts
res.cookie('__Host-sid', id, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
```

Wrong: `Domain=.example.com` on a session cookie. Every subdomain, including a forgotten marketing site, receives it.
Right: omit `Domain`; the cookie stays on the host that set it.

Wrong: `maxAge: 604800` meant as seconds. Express takes milliseconds, so this is about 10 minutes.
Right: `maxAge: 7 * 24 * 60 * 60 * 1000`.

Wrong: switching to `SameSite=None` "to make the cookie work" across sites.
Right: serve the frontend and API on the same site, or use `None; Secure` together with CSRF protection.

## Check yourself
1. `app.example.com` calls `api.example.com` with `fetch`. Same-site? Same-origin?
2. What does the `__Host-` prefix guarantee?
3. Why is `SameSite=Lax` alone not a complete CSRF defense?

<details>
<summary>Answers</summary>

1. Same-site (both under `example.com`), but cross-origin (different hosts). SameSite cookies are sent, and CORS rules apply; the call needs `credentials: 'include'`.
2. The cookie was set over HTTPS with `Secure`, `Path=/`, and no `Domain`, so subdomains or plain-HTTP pages cannot set or overwrite it.
3. Lax still sends cookies on top-level GET navigations (so GETs must be safe), and it cannot stop attacks from a compromised sibling subdomain, which counts as same-site.
</details>

## Sources
- [MDN — Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [MDN — Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [OWASP — Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [web.dev — SameSite cookies explained](https://web.dev/articles/samesite-cookies-explained)
- [Express 5 — `res.cookie()`](https://expressjs.com/en/5x/api.html#res.cookie)
- [HSTS preload list](https://hstspreload.org/)
