---
title: Frontend Security
module: 02-frontend
tech: React 19.2, Next.js 16, CSP
---
# Frontend Security
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ The browser threat model: XSS, CSRF, clickjacking, and supply chain in the frontend
- [ ] ⭐ XSS in React: what React escapes, and the escape hatches (`dangerouslySetInnerHTML`, URLs, refs)
- [ ] ⭐ Content Security Policy with nonces in Next.js 16 (`proxy.ts`)
- [ ] Trusted Types and HTML sanitization (DOMPurify)
- [ ] ⭐ Tokens in the browser: `HttpOnly` cookies vs `localStorage`
- [ ] ⭐ Securing Server Actions and route handlers: validation, authentication, authorization, CSRF
- [ ] Data exposure: what reaches the client, `server-only`, DTOs, taint APIs
- [ ] Third-party scripts, Subresource Integrity, and dependency risk
- [ ] Security headers for Next.js: HSTS, `frame-ancestors`, `Permissions-Policy`, `Referrer-Policy`
- [ ] Open redirects and safe navigation
- [ ] Secrets in the frontend: env var prefixes and build-time inlining

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · The browser threat model and XSS in React](docs/01-threats-xss.md)
- [02 · Content Security Policy and security headers in Next.js](docs/02-csp-headers.md)
- [03 · Tokens, cookies, and securing Server Functions](docs/03-tokens-server-functions.md)
- [04 · Data exposure, third parties, redirects, and secrets](docs/04-exposure-thirdparty-secrets.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/02-frontend/11-security mode=tasks` when you are ready to build._
