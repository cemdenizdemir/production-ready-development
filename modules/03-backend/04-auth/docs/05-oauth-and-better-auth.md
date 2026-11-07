---
title: OAuth/OIDC sign-in and Better Auth
tech: Better Auth, Express 5, Drizzle ORM, Redis 8
version: Better Auth 1.6/1.7, Express 5.2, OAuth 2.0/2.1, OpenID Connect
date: 2026-11-07
covers: [10, 11]
---
# OAuth/OIDC sign-in and Better Auth
[← Overview](00-overview.md)

## Why it matters
- "Sign in with Google" links accounts by email without checking `email_verified`; an attacker registers that email at a provider that doesn't verify it and takes over the account.
- The OAuth callback doesn't check `state`; an attacker logs victims into the attacker's account (login CSRF) and collects what they type.
- A team maintains 3,000 lines of homegrown auth (sessions, OAuth, MFA, resets) and patches each flow separately; a library that does it well would have been safer.

## Concepts

### OAuth 2.0 and OpenID Connect
**OAuth 2.0** lets a user grant an app access to an API. **OpenID Connect (OIDC)** adds identity: an **ID token** saying who the user is. For "Sign in with X", use the **authorization code flow with PKCE**:

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as Your API
  participant P as Provider (Google/GitHub)
  B->>A: GET /auth/sign-in/google
  A-->>B: redirect to P with client_id, redirect_uri, scope, state, code_challenge (S256), nonce
  B->>P: user logs in and consents
  P-->>B: redirect to /auth/callback?code=…&state=…
  B->>A: callback
  A->>A: check state (CSRF)
  A->>P: exchange code + code_verifier for tokens
  P-->>A: ID token (+ access token)
  A->>A: verify ID token: signature (JWKS), iss, aud, exp, nonce
  A->>A: find or create user by (provider, sub); create session
  A-->>B: Set-Cookie session
```
| Rule | Why |
|:--|:--|
| PKCE (S256) | stops stolen authorization codes being redeemed |
| `state` | CSRF protection for the callback |
| `nonce` | ID token replay protection |
| Identify users by `(provider, sub)` | `sub` is stable; emails change |
| Link by email only if `email_verified` and with care | prevents takeover via unverified provider emails |
| Minimal scopes | `openid email profile` for sign-in |
| Exact redirect URI allowlist | no open redirects of codes |

### Better Auth
A self-hosted TypeScript auth library (MIT): email/password, sessions, social providers, email verification, password reset, rate limiting, and plugins (two-factor, passkeys, organizations, admin, API keys, OAuth 2.1 provider).

| Piece | Use |
|:--|:--|
| `betterAuth({...})` | server instance |
| `database` | a Postgres `Pool` or `drizzleAdapter(db, { provider: 'pg' })` |
| `secondaryStorage` | Redis for sessions and rate limits |
| `emailAndPassword`, `emailVerification` | password flows; you supply email sending |
| `socialProviders` | Google, GitHub, ... |
| `plugins` | `twoFactor()`, passkeys, `organization()`, `admin()`, API keys |
| `toNodeHandler(auth)` | Express integration |
| `auth.api.getSession({ headers })` | read the session in your routes |
| CLI `npx @better-auth/cli generate` / `migrate` | create/update its tables (works with Drizzle) |
| Client `createAuthClient()` | sign-in/sign-up calls from React |

Better Auth hashes passwords with scrypt by default; you can plug in argon2 via the `password.hash`/`password.verify` options.

## Example
`src/auth/auth.ts`
```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import { db } from '#src/db/index.ts';
import { redis } from '#src/redis.ts';
import { emailQueue } from '#src/jobs/queues.ts';
import { hashPassword, verifyPassword } from './passwords.ts';
import { config } from '#src/config.ts';

export const auth = betterAuth({
  baseURL: config.auth.baseUrl,                    // e.g. https://app.example.com (same site as the frontend)
  secret: config.auth.secret,                      // from the secret manager
  trustedOrigins: [config.app.origin],
  database: drizzleAdapter(db, { provider: 'pg' }),
  secondaryStorage: {
    get: (key) => redis.get(key),
    set: (key, value, ttl) => redis.set(key, value, ttl ? { EX: ttl } : undefined).then(() => {}),
    delete: (key) => redis.del(key).then(() => {}),
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 15,
    requireEmailVerification: true,
    password: {
      hash: hashPassword,                          // argon2id from lesson 01
      verify: async ({ hash, password }) => (await verifyPassword(hash, password)).ok,
    },
    sendResetPassword: async ({ user, url }) => { await emailQueue.add('password-reset', { to: user.email, url }); },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => { await emailQueue.add('verify-email', { to: user.email, url }); },
  },
  socialProviders: {
    github: { clientId: config.github.clientId, clientSecret: config.github.clientSecret },
    google: { clientId: config.google.clientId, clientSecret: config.google.clientSecret },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, storage: 'secondary-storage' },
  plugins: [twoFactor()],
});
```
`src/app.ts` (excerpt) — mount before `express.json()`; use sessions in your routes.
```ts
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth/auth.ts';

app.all('/api/auth/*splat', toNodeHandler(auth));  // Better Auth parses its own bodies
app.use(express.json({ limit: '100kb' }));

app.use(async (req, _res, next) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (session) req.user = { id: session.user.id, accountId: session.user.accountId, role: session.user.role };
  next();
});
```
Generate Better Auth's tables into your Drizzle schema, then use your normal migration flow:
```bash
npx @better-auth/cli generate --output src/db/auth-schema.ts
pnpm drizzle-kit generate --name better_auth && pnpm drizzle-kit migrate
```
React client (same-origin `/api/auth` through the frontend's proxy):
```ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();       // defaults to the current origin
await authClient.signIn.social({ provider: 'github', callbackURL: '/dashboard' });
await authClient.signIn.email({ email, password });
```
`accountId` and `role` above are custom user fields; add them with Better Auth's `user.additionalFields` option (or the organization plugin for multi-tenant teams).

## Production patterns
- **Authorization code + PKCE + state + nonce**, users keyed by `(provider, sub)`, careful email-based linking.
- **Better Auth for the flows, your code for authorization** (permissions and tenant checks from lesson 04 stay yours).
- **Its tables in your Drizzle schema and migrations**, reviewed like any other migration.
- **Redis secondary storage** for sessions and rate limits shared across instances.
- **Pin and track Better Auth versions**; read release notes and security advisories before upgrading.

## Mistakes
Wrong: linking social accounts by email blindly.
```ts
const user = await users.findByEmail(profile.email); // provider may not have verified this email
```
Right: identify by `(provider, sub)`; link to an existing account only when `email_verified` is true and the user confirms (e.g. logs in with the existing method first).

Wrong: skipping `state`/PKCE in a hand-written OAuth flow. Right: use a library (Better Auth) that implements them, or implement both.

Wrong: mounting the auth handler after `express.json()`; the body is consumed and Better Auth's endpoints fail. Right: mount `toNodeHandler(auth)` before body parsers.

Wrong: Express 4 wildcard syntax from old examples (`/api/auth/*`). Right: `/api/auth/*splat` in Express 5.

## Check yourself
1. What do `state`, `nonce`, and PKCE each protect against?
2. Why use `sub` rather than email to identify a social login?
3. What stays your responsibility after adopting Better Auth?

<details>
<summary>Answers</summary>

1. `state`: CSRF on the callback (login CSRF). `nonce`: replay of an ID token. PKCE: an intercepted authorization code being exchanged by someone else.
2. `sub` is the provider's stable, unique identifier for the user; emails can change, be reassigned, or be unverified, which enables account takeover through linking.
3. Authorization (roles, permissions, tenant checks), audit events and monitoring, email delivery, configuration and secrets, database migrations, version upgrades, and reviewing the security settings.
</details>

## Sources
- [OAuth 2.0 Security Best Current Practice (RFC 9700)](https://www.rfc-editor.org/rfc/rfc9700)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
- [Better Auth — Installation](https://www.better-auth.com/docs/installation)
- [Better Auth — Express integration](https://www.better-auth.com/docs/integrations/express)
- [Better Auth — Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [Better Auth — Two-factor plugin](https://www.better-auth.com/docs/plugins/2fa)
