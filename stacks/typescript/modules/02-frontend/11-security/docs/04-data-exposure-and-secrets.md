---
title: Data exposure and secrets in the frontend
tech: Next.js 16, React 19.2
version: Next.js 16.x, React 19.2
date: 2026-11-07
covers: [7, 11]
---
# Data exposure and secrets in the frontend
[← Overview](00-overview.md)

## Why it matters
- A Server Component passes a full `user` row to a Client Component. The RSC payload now contains `passwordHash`, `stripeCustomerId`, and internal notes, visible in DevTools.
- A developer adds `NEXT_PUBLIC_` to a server API key "because it was undefined in the browser". The key is now in every visitor's JavaScript.
- A Server Action returns the whole updated order object, including other users' internal comments, to the client.

## Concepts

### What reaches the browser
| Path | Visible to anyone who opens DevTools |
|:--|:--|
| Props passed from Server to Client Components | yes (serialized into the RSC payload) |
| Data rendered as HTML | yes |
| Server Action return values | yes |
| Route handler responses | yes |
| `NEXT_PUBLIC_*` env vars | yes (inlined into bundles at build) |
| Code in `'use client'` modules and their imports | yes |
| Server Component code, server-only env vars | no |

### Keep server things on the server
| Tool | Effect |
|:--|:--|
| `import 'server-only'` | build fails if a client module imports this file |
| Data access layer returning **DTOs** | functions return only the fields the UI needs |
| React taint APIs (`experimental_taintObjectReference`, `experimental_taintUniqueValue`; `experimental.taint` in next.config) | error if a tainted object or value is passed to the client |
| Env vars without `NEXT_PUBLIC_` | available only in server code |
| Minimal Server Action results | `{ ok: true }` or field errors, not whole records |

### Secrets and build-time inlining
- `NEXT_PUBLIC_*` (Next.js) and `VITE_*` (Vite) values are **copied into the JavaScript bundle at build time**. Anything there is public, forever (bundles are cached and archived).
- Only publishable values belong there: public API base URL, Stripe **publishable** key, analytics site ID, Sentry DSN (designed to be public).
- If code "needs a secret in the browser", the design is wrong: call your server, which uses the secret.
- Scan builds: search the built client output for known secret prefixes (`sk_live_`, `AKIA`, private keys) in CI.

## Example
`lib/dal/users.ts` — a data access layer that returns DTOs.
```ts
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';

type UserRow = { id: string; name: string; email: string; avatarUrl: string | null; role: string; internalNotes: string };
export type UserDTO = { name: string; avatarUrl: string | null; isAdmin: boolean };

export const getCurrentUser = cache(async (): Promise<UserDTO | null> => {
  const res = await fetch(`${process.env.API_INTERNAL_URL}/me`, { headers: { cookie: (await cookies()).toString() } });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /me → ${res.status}`);
  const user = (await res.json()) as UserRow;
  return { name: user.name, avatarUrl: user.avatarUrl, isAdmin: user.role === 'admin' }; // only what the UI needs
});
```
`app/(app)/layout.tsx` — the Client Component gets the DTO, nothing more.
```tsx
import { getCurrentUser } from '@/lib/dal/users';
import { UserMenu } from './_components/UserMenu'; // 'use client'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      {user && <UserMenu name={user.name} avatarUrl={user.avatarUrl} />}
      {children}
    </>
  );
}
```
Optional defense in depth with taint (`experimental.taint: true` in next.config):
```ts
import { experimental_taintUniqueValue as taintUniqueValue } from 'react';

taintUniqueValue('Do not pass the API key to the client', process, process.env.PAYMENTS_API_KEY!);
```
CI check for leaked secrets in client bundles:
```bash
pnpm build
if grep -rEl 'sk_live_|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----' .next/static; then
  echo "Secret-like value found in client bundle"; exit 1
fi
```

## Production patterns
- **A server-only data access layer** that returns DTOs; components never see raw API or database records.
- **Review every `'use client'` boundary's props** like an API response: is each field safe to publish?
- **Server Actions return minimal results** (status, field errors, the few fields the UI must update).
- **Public env vars are reviewed** like code; adding `NEXT_PUBLIC_` needs a reason.
- **Secret scanning on client bundles in CI**, plus gitleaks on the repo ([01-foundations/06-security](../../../01-foundations/06-security/README.md)).

## Mistakes
Wrong: passing whole records across the boundary.
```tsx
<ProfileForm user={userRowFromApi} />  // all fields serialized to the client
```
Right: `<ProfileForm name={user.name} email={user.email} />`, or a DTO.

Wrong: making a secret public to "fix" undefined values.
```bash
NEXT_PUBLIC_PAYMENTS_API_KEY=sk_live_...
```
Right: keep it server-only; call a Server Action or route handler that uses it.

Wrong: returning full objects from actions.
```ts
return await api.updateOrder(id, data); // internal fields included
```
Right: `return { ok: true };` and let the page re-render from cached server data (`updateTag`).

Wrong: importing a server module into a Client Component and relying on tree shaking to drop secrets. Right: `import 'server-only'` so the build fails.

## Check yourself
1. Which of these reach the browser: Server Component code, props to Client Components, Server Action return values, env vars without `NEXT_PUBLIC_`?
2. What does `import 'server-only'` protect against?
3. Why is the Sentry DSN fine in `NEXT_PUBLIC_*` but a Stripe secret key isn't?

<details>
<summary>Answers</summary>

1. Props to Client Components and Server Action return values reach the browser. Server Component code and non-public env vars do not.
2. Accidentally importing server code (data access, secrets) into a Client Component; the build fails instead of bundling it for the browser.
3. The DSN only allows sending error events to your project and is designed to be public (with rate limits and allowed domains). A secret key authorizes privileged API actions such as charging cards and refunds.
</details>

## Sources
- [Next.js — Data security](https://nextjs.org/docs/app/guides/data-security)
- [Next.js — Environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [react.dev — `experimental_taintObjectReference`](https://react.dev/reference/react/experimental_taintObjectReference)
- [react.dev — `experimental_taintUniqueValue`](https://react.dev/reference/react/experimental_taintUniqueValue)
- [Next.js — `server-only`](https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning)
