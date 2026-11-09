---
title: Frontend Security cheatsheet
tech: React 19.2, Next.js 16, CSP
version: React 19.2, Next.js 16.x, CSP Level 3, Trusted Types
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Frontend Security cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Threats
| Threat | What happens | Defense |
|:--|:--|:--|
| ⭐ XSS | script runs in your origin | escape, sanitize, CSP, Trusted Types |
| ⭐ CSRF | cross-site actions with cookies | SameSite, Origin checks, Server Actions checks |
| ⭐ Clickjacking | invisible framing | `frame-ancestors 'none'` |
| ⭐ Supply chain | malicious dependency/script | lockfiles, review, SRI, self-hosting |
| Open redirect | phishing via your domain | relative/allowlisted targets |
| Data exposure | private fields in payloads | DTOs, `server-only` |
| Token theft | stolen bearer tokens | `HttpOnly` cookies |
| Tabnabbing | opened page changes opener | `rel="noopener"` (default for `target=_blank` now) |
| DOM clobbering | HTML ids override globals | sanitize, avoid global lookups |
| Prototype pollution | `__proto__` keys merged | validate objects, Zod strips unknown keys |

## React XSS escape hatches
| Hatch | Risk | Safe use |
|:--|:--|:--|
| ⭐ `dangerouslySetInnerHTML` | raw HTML | DOMPurify first |
| ⭐ `href` / `src` with user URLs | `javascript:` / `data:` | scheme allowlist |
| `ref.current.innerHTML` | raw HTML | `textContent` |
| `eval` / `new Function` / string `setTimeout` | code execution | never with data |
| `{...untrustedProps}` | injected props/handlers | pick fields |
| JSON in `<script>` | `</script>` breakout | escape `<` as `<` |
| Markdown/rich text libraries | raw HTML passthrough | disable raw HTML or sanitize |
| `<iframe srcdoc>` | HTML injection | sanitize + sandbox |

## Sanitizing
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `DOMPurify.sanitize(html)` | allowlist sanitizer | browser |
| `USE_PROFILES: { html: true }` | HTML only | no SVG/MathML |
| `FORBID_TAGS` / `FORBID_ATTR` | tighten rules | `style`, `form` |
| `RETURN_TRUSTED_TYPE: true` | returns TrustedHTML | with Trusted Types |
| Server-side DOMPurify | with a DOM implementation (jsdom) | also seen: isomorphic-dompurify |
| Sanitize at render | protects old data too | not only on save |

## CSP directives
| Directive | Typical value |
|:--|:--|
| ⭐ `default-src` | `'self'` |
| ⭐ `script-src` | `'self' 'nonce-{n}' 'strict-dynamic'` |
| `style-src` | `'self' 'nonce-{n}'` |
| `img-src` | `'self' data: blob: https://cdn…` |
| `font-src` | `'self'` |
| ⭐ `connect-src` | `'self' https://api… https://*.ingest.sentry.io` |
| ⭐ `frame-ancestors` | `'none'` |
| `frame-src` | allowed embeds (payments, video) |
| `form-action` | `'self'` |
| `base-uri` | `'self'` |
| `object-src` | `'none'` |
| `worker-src` | `'self' blob:` |
| `upgrade-insecure-requests` | on |
| `report-to` / `Reporting-Endpoints` | violation reports |
| `require-trusted-types-for` | `'script'` |
| `trusted-types` | allowed policy names |

## CSP concepts
| Concept | What it means | Note |
|:--|:--|:--|
| ⭐ Nonce | random per response; only matching scripts run | must be unpredictable |
| ⭐ `'strict-dynamic'` | trusted scripts may load more scripts | host lists ignored |
| Hash source | `'sha256-…'` of an inline script | static pages |
| ⭐ Report-Only | `Content-Security-Policy-Report-Only` | roll out safely |
| `'unsafe-inline'` | allows inline scripts | avoid for scripts |
| `'unsafe-eval'` | allows eval | dev only |
| ⭐ Nonces need dynamic rendering | cached pages can't vary nonce | static: hashes/SRI |
| Next.js CSP via `proxy.ts` | set header + pass `x-nonce` | Next nonces its scripts |
| `nonce` prop | `next/script`, inline scripts | read `headers().get('x-nonce')` |

## Security headers
| Header | Value |
|:--|:--|
| ⭐ `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| ⭐ `X-Content-Type-Options` | `nosniff` |
| ⭐ `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `require-corp` (only for cross-origin isolation) |
| `X-Frame-Options` | `DENY` (legacy; CSP replaces) |
| `poweredByHeader: false` | remove `X-Powered-By` |
| `headers()` in next.config | static headers per path |

## Third-party code
| Control | What it does | Note |
|:--|:--|:--|
| ⭐ Self-host | you control the bytes | |
| ⭐ SRI `integrity` + `crossorigin` | reject changed files | pinned URLs only |
| CSP allowlist | limit origins | |
| Script register | owner, purpose, consent | |
| Lockfile + review new deps | supply-chain hygiene | see 01-foundations/06 |
| Sandboxed iframes | isolate widgets | `sandbox`, `allow` |
| polyfill.io (2024) | CDN takeover injected malware | why self-hosting matters |

## Tokens and sessions
| Option | JS can read? | Verdict |
|:--|:--|:--|
| ⭐ `HttpOnly; Secure; SameSite=Lax` cookie | no | recommended |
| `localStorage` token | yes | avoid long-lived tokens |
| In-memory access token + cookie refresh | while page runs | acceptable |
| ⭐ Same-origin `/api` routing | cookies flow, no CORS | rewrites/proxy to Express |
| ⭐ Server-side cookie forwarding | Server Components → Express | `headers: { cookie }` |
| BFF pattern | frontend server talks to APIs | tokens never in browser |

## Server Actions and route handlers
| Item | Built in? | Note |
|:--|:--|:--|
| POST only | ✓ | |
| Origin vs Host check | ✓ | CSRF protection |
| Unguessable IDs, dead-code removal | ✓ | |
| Encrypted closures | ✓ | |
| ⭐ Input validation | ✗ | Zod in every action |
| ⭐ Authentication | ✗ | session on the server |
| ⭐ Authorization | ✗ | ownership checks (Express) |
| Rate limiting | ✗ | edge/Express |
| `experimental.serverActions.allowedOrigins` | config | behind proxies |
| ⭐ `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | config | same on all instances |
| Route handler CSRF | ✗ | check `Origin`/`Sec-Fetch-Site` yourself |

## Data exposure
| Tool | What it does | Note |
|:--|:--|:--|
| ⭐ `import 'server-only'` | build error on client import | DAL, secrets |
| ⭐ DTOs | return only needed fields | data access layer |
| React `cache()` | dedupe per request | `getCurrentUser` |
| `experimental_taintObjectReference` | block objects from reaching client | `experimental.taint` |
| `experimental_taintUniqueValue` | block specific values (keys) | |
| ⭐ Minimal action results | `{ ok }` / field errors | |
| Review client props | treat like API responses | |

## Secrets in the frontend
| Item | What it means |
|:--|:--|
| ⭐ `NEXT_PUBLIC_*` / `VITE_*` | inlined into bundles: public |
| ⭐ Server env vars | only in server code |
| Publishable values | public API URL, Stripe `pk_`, analytics ID, Sentry DSN |
| Never public | API secret keys, DB URLs, signing keys, tokens |
| Bundle scan in CI | grep `.next/static` for `sk_live_`, `AKIA`, private keys |
| "Needs a secret in the browser" | call your server instead |

## Redirects and navigation
| Check | Why |
|:--|:--|
| ⭐ Starts with `/` | relative path |
| Not `//` or `/\` | protocol-relative tricks |
| ⭐ Same origin after `new URL()` | final check |
| Allowlist for external targets | known partners only |
| Validate on the server | redirect happens there |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Trusting JSX escaping for URLs | `javascript:` links | scheme allowlist |
| Homemade sanitizer | bypassable | DOMPurify |
| CSP with `unsafe-inline` scripts | XSS protection gone | nonces |
| Enforcing CSP blind | broken widgets | report-only first |
| Nonces on cached pages | reused nonce | dynamic or hashes |
| JWT in `localStorage` | stolen by XSS | `HttpOnly` cookie |
| User ID from form data | IDOR | session identity |
| Route handlers without Origin check | CSRF | check headers |
| Per-instance action keys | random failures | shared key |
| Whole records as props | data leak | DTOs |
| Secret with public prefix | public forever | server-only + rotate |
| Unvalidated `?next=` | open redirect | `safeRedirectPath` |

## Sources
| Source | Link |
|:--|:--|
| OWASP XSS Prevention | https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html |
| Next.js CSP guide | https://nextjs.org/docs/app/guides/content-security-policy |
| Next.js data security | https://nextjs.org/docs/app/guides/data-security |
| web.dev Strict CSP | https://web.dev/articles/strict-csp |
| MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP |
| MDN SRI | https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity |
| web.dev Trusted Types | https://web.dev/articles/trusted-types |
| DOMPurify | https://github.com/cure53/DOMPurify |
