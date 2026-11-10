---
title: Data exposure, third parties, redirects, and secrets
tech: Next.js 16, React 19.2, Subresource Integrity
version: Next.js 16.x, React 19.2
date: 2026-11-09
covers: [7, 8, 10, 11]
---
# Data exposure, third parties, redirects, and secrets
[← Overview](00-overview.md)

## Why it matters
- A Server Component passes the whole `CustomerDto` (including internal notes and fraud score) to a Client Component; it's visible in the page's RSC payload to anyone who views source.
- `NEXT_PUBLIC_STRIPE_SECRET_KEY` is set "to make it work"; the secret key ships in the JavaScript bundle.
- `/sign-in?returnUrl=https://evil.test/login` redirects users to a phishing copy after login.

## Concepts

### What reaches the client
| Path | Visible to users? |
|:--|:--|
| props passed from Server to Client Components | ✓ (serialized in the RSC payload) |
| Server Component output (HTML) | ✓ |
| data only used inside Server Components and not rendered | ✗ |
| `NEXT_PUBLIC_*` env vars | ✓ (inlined in bundles) |
| other env vars | ✗ (server only) |
| Server Action closure values | encrypted, but sent to the client |

Controls:
- **DTOs for the client**: map API responses to exactly what the UI needs before passing to Client Components.
- `import "server-only"` in modules with secrets or server fetchers; the build fails if a client module imports them.
- React taint APIs (experimental): `taintObjectReference(msg, obj)` / `taintUniqueValue(msg, obj, value)` throw if a tainted object/value is passed to the client.
- The API should already return minimal DTOs; don't rely on the frontend to hide fields.

### Third-party scripts and dependency risk
| Control | How |
|:--|:--|
| inventory | each script has an owner and purpose |
| CSP allowlist | only listed origins (lesson 02) |
| ⭐ Subresource Integrity | `<script src integrity="sha384-…" crossorigin="anonymous">` for static CDN files |
| sandbox | iframes with `sandbox` for widgets |
| no third parties on checkout/account | reduce exposure where it matters |
| npm supply chain | `pnpm install --frozen-lockfile`, `pnpm audit`, Dependabot, `onlyBuiltDependencies`, review new packages |
| Payment fields | provider-hosted fields (Stripe Elements iframes): card data never touches your DOM |

SRI doesn't work for scripts that change constantly (tag managers); that's a reason to limit them.

### Open redirects and safe navigation
Validate redirect targets: only same-origin paths.
```ts
export function safeReturnUrl(value: string | null, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
```
The ASP.NET Core side uses `Url.IsLocalUrl` / `LocalRedirect` for its own redirects (sign-in flows).

`target="_blank"` links: modern browsers imply `noopener`; add `rel="noopener noreferrer"` for user-supplied links anyway.

### Secrets in the frontend
| Value | Where |
|:--|:--|
| Stripe publishable key, Sentry DSN, public analytics IDs | `NEXT_PUBLIC_*` or rendered by the server (they're public by design) |
| Stripe secret key, API keys, signing secrets, connection strings | never in the frontend; the ASP.NET Core API holds them (Key Vault) |
| Next.js server-only secrets (revalidation secret, Server Actions encryption key) | server env vars from Key Vault references |

Rule of thumb: if it's in a `NEXT_PUBLIC_` variable or a Client Component, assume it's published on the internet.

## Example
`web/src/server/customer.ts`
```ts
import "server-only";
import { experimental_taintObjectReference as taint } from "react";

export async function getCustomerForPage(cookie: string) {
  const res = await fetch(`${process.env.API_URL}/me`, { headers: { cookie }, signal: AbortSignal.timeout(5000) });
  const full = (await res.json()) as CustomerDto;                    // may contain internal fields
  taint("Don't pass the full customer object to the client", full);
  return { displayName: full.displayName, email: full.email, memberSince: full.createdAt };   // client DTO
}
```
`web/src/app/(auth)/sign-in/page.tsx` (redirect after login)
```tsx
import { redirect } from "next/navigation";
import { safeReturnUrl } from "@/lib/safe-url";

export default async function SignInDone({ searchParams }: { searchParams: Promise<{ returnUrl?: string }> }) {
  const { returnUrl } = await searchParams;
  redirect(safeReturnUrl(returnUrl ?? null, "/account"));
}
```

## Production patterns
- Client DTOs everywhere a Server Component hands data to a Client Component; `server-only` on server modules.
- The API returns minimal DTOs per use case (03-backend/02-api-design); defense in depth, not a substitute.
- Only public values in `NEXT_PUBLIC_*`; secrets stay in the API and server env (Key Vault).
- Redirect targets validated on both Next.js and ASP.NET Core; payment data only in provider-hosted fields.

## Mistakes
Wrong:
```tsx
<ProfileCard customer={customerFromApi} />     // Client Component gets every field
```
Right: `<ProfileCard customer={{ displayName, memberSince }} />`.

Wrong: `NEXT_PUBLIC_API_SECRET=...`.
Right: secrets only on the server; the browser calls the API with the user's session.

## Check yourself
1. How can a user see props passed to a Client Component?
2. What does `import "server-only"` do?
3. Which redirect values should `safeReturnUrl` reject?

<details><summary>Answers</summary>

1. They're serialized into the RSC payload in the HTML/network responses; view source or DevTools shows them.
2. Makes the build fail if the module is imported into client code, keeping server secrets and logic out of bundles.
3. Anything not starting with a single `/`: absolute URLs, protocol-relative `//evil.test`, and backslash variants like `/\evil.test`.
</details>

## Sources
- [Next.js — Data security](https://nextjs.org/docs/app/guides/data-security)
- [react.dev — taintObjectReference](https://react.dev/reference/react/experimental_taintObjectReference)
- [MDN — Subresource Integrity](https://developer.mozilla.org/docs/Web/Security/Subresource_Integrity)
- [OWASP — Unvalidated Redirects and Forwards](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [Next.js — Environment variables](https://nextjs.org/docs/app/guides/environment-variables)
