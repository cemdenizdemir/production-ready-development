---
title: Frontend Security cheatsheet
tech: React 19.2, Next.js 16, CSP
version: React 19.2, Next.js 16.x, CSP Level 3, Trusted Types
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Frontend Security cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Threats
| Threat | Defense | Note |
|:--|:--|:--|
| ⭐ XSS | escaping, no raw HTML, CSP, Trusted Types | |
| CSRF | SameSite + antiforgery/Origin | API side too |
| clickjacking | `frame-ancestors 'none'` | |
| supply chain | lock files, audit, SRI, CSP | |
| open redirect | allowlist paths | |
| data exposure | client DTOs, `server-only` | RSC payload |

## React XSS surface
| Context | Safe? | Note |
|:--|:--|:--|
| `{text}` | ✓ | escaped |
| attributes | ✓ | escaped |
| ⭐ `href`/`src` with user URL | ⚠ | validate scheme |
| ⭐ `dangerouslySetInnerHTML` | ✗ | sanitize |
| `ref.innerHTML` | ✗ | |
| inline styles from input | ⚠ | |
| `postMessage` data | ⚠ | check `origin`, validate |
| `eval` / `new Function` | ✗ | |

## Sanitizing
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ DOMPurify | client sanitizer | strict allowlist |
| `RETURN_TRUSTED_TYPE` | Trusted Types output | |
| HtmlSanitizer (NuGet) | server sanitizer | ASP.NET Core |
| Markdown → React | no raw HTML | `react-markdown` |
| `rel="ugc noopener noreferrer"` | user links | |

## CSP directives
| Directive | Shop value | Note |
|:--|:--|:--|
| `default-src` | `'self'` | |
| ⭐ `script-src` | `'self' 'nonce-…' 'strict-dynamic'` | no `unsafe-inline` |
| `style-src` | `'self' 'nonce-…'` | |
| `img-src` | `'self' blob: data: <image host>` | |
| `connect-src` | `'self' <sentry>` | |
| `frame-src` | payment provider | |
| ⭐ `frame-ancestors` | `'none'` | clickjacking |
| `base-uri` | `'none'` | |
| `form-action` | `'self'` | |
| `object-src` | `'none'` | |
| `upgrade-insecure-requests` | on | |
| `require-trusted-types-for` | `'script'` | where supported |
| `report-to` / `report-uri` | reporting | Sentry |
| ⭐ Report-Only header | trial run | before enforcing |

## CSP in Next.js
| Item | Does | Note |
|:--|:--|:--|
| ⭐ nonce in `proxy.ts` | per-request nonce | |
| `Content-Security-Policy` request header | Next.js nonces its scripts | |
| `x-nonce` header → `headers()` | read nonce in RSC | |
| `<Script nonce>` | your scripts | |
| nonce ⇒ dynamic | no static cache | hashes for static pages |
| matcher excludes static assets | performance | |
| `'unsafe-eval'` | dev only | React dev tools |

## Security headers (Next.js app)
| Header | Value | Note |
|:--|:--|:--|
| HSTS | `max-age=31536000; includeSubDomains` | Front Door too |
| `X-Content-Type-Options` | `nosniff` | |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | |
| `Permissions-Policy` | features off | |
| COOP | `same-origin` / `-allow-popups` | payments |
| `X-Frame-Options` | `DENY` | legacy |
| `headers()` in next.config | static headers | |

## Tokens and cookies
| Storage | Verdict | Note |
|:--|:--|:--|
| `localStorage` | ⚠ XSS-readable | no tokens |
| memory | lost on reload | still exposed |
| ⭐ `HttpOnly; Secure; SameSite=Lax` cookie | best for browsers | `__Host-` prefix |
| same-origin `/api` | cookies flow, no CORS | proxy |
| JWT bearer | non-browser clients | mobile, partners |

## Server Functions and route handlers
| Check | How | Note |
|:--|:--|:--|
| ⭐ validate input | Zod `safeParse` | |
| ⭐ identity from session | forward cookie | no userId args |
| ⭐ authorization in API | ownership/roles | |
| CSRF (actions) | POST + Origin check built in | |
| CSRF (route handlers) | check Origin / token | cookie-auth POSTs |
| `serverActions.allowedOrigins` | proxied hosts | |
| no secrets in closures | encrypted but sent | |
| safe error messages | details in logs | |
| `X-XSRF-TOKEN` header | API antiforgery | |

## Data exposure
| Item | Does | Note |
|:--|:--|:--|
| ⭐ client DTOs | pass only needed fields | |
| ⭐ `import "server-only"` | block client imports | |
| `taintObjectReference` / `taintUniqueValue` | block passing to client | experimental |
| minimal API DTOs | defense in depth | backend |
| RSC payload | visible to users | view source |

## Third parties
| Control | How | Note |
|:--|:--|:--|
| inventory + owner | per script | |
| CSP allowlist | listed origins | |
| ⭐ SRI | `integrity` + `crossorigin` | static files |
| iframe `sandbox` | isolate widgets | |
| hosted payment fields | card data off your DOM | Stripe Elements |
| none on checkout | reduce risk | |
| `pnpm audit`, Dependabot | npm risk | |
| `onlyBuiltDependencies` | install scripts allowlist | |

## Redirects and secrets
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ `safeReturnUrl` | single leading `/` only | reject `//`, `/\` |
| `LocalRedirect` (ASP.NET Core) | server side | |
| `rel="noopener noreferrer"` | external links | |
| ⭐ `NEXT_PUBLIC_*` = public | never secrets | |
| publishable keys / DSNs | public by design | |
| secret keys | API + Key Vault | |
| server env vars | Next.js server only | revalidate secret |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| raw HTML from CMS/users | XSS | sanitize / render text |
| user URLs in `href` | `javascript:` | scheme allowlist |
| tokens in localStorage | stolen by XSS | HttpOnly cookie |
| `'use server'` with userId param | IDOR | session identity |
| full DTO to client | data leak | client DTO |
| secret in `NEXT_PUBLIC_` | published | server only |
| permissive CSP | false sense of safety | strict nonce CSP |
| CSP enforced blind | breaks site | report-only first |
| unvalidated returnUrl | phishing redirects | allowlist |

## Sources
| Source | Link |
|:--|:--|
| OWASP XSS | https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html |
| Next.js CSP | https://nextjs.org/docs/app/guides/content-security-policy |
| Next.js data security | https://nextjs.org/docs/app/guides/data-security |
| Strict CSP | https://web.dev/articles/strict-csp |
| Trusted Types | https://developer.mozilla.org/docs/Web/API/Trusted_Types_API |
| DOMPurify | https://github.com/cure53/DOMPurify |
| SRI | https://developer.mozilla.org/docs/Web/Security/Subresource_Integrity |
| OWASP redirects | https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html |
