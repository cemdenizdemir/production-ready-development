---
title: Authentication & Authorization — Overview
tech: Express 5, Redis 8, argon2, Better Auth
version: Express 5.2, Redis 8, argon2 (node-argon2), Better Auth 1.6/1.7, NIST SP 800-63B rev. 4
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Authentication & Authorization — Overview
[← Topic](../README.md)

**TECH:** Express 5 · Redis 8 (sessions, counters) · argon2id · Better Auth (after the hand-built version)
**LEVEL:** intermediate (mid-level, has shipped production code)

## Why this matters in production
- Account takeover is the most direct way to harm users: weak hashing, guessable tokens, and missing rate limits are all it takes.
- Broken authorization (users reading other users' data) is the #1 OWASP risk.
- Auth flows (reset, verification, MFA, OAuth) each have well-known traps; following proven patterns avoids them.
- Building sessions once by hand teaches what Better Auth does for you, so you can configure and audit it.

## Mental model
**Authentication** proves who the caller is and issues a **session**; **authorization** decides, on every request, whether that identity may perform this action on this resource.

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as Express API
  participant R as Redis
  participant D as Postgres
  B->>A: POST /auth/login (email, password)
  A->>A: rate limit (IP + account)
  A->>D: load user + argon2id hash
  A->>A: argon2.verify
  A->>R: SET session:<hash(id)> {userId,…} EX 7d
  A-->>B: Set-Cookie: __Host-sid=<id>; HttpOnly; Secure; SameSite=Lax
  B->>A: GET /orders (cookie)
  A->>R: GET session → userId
  A->>A: authorize: role + ownership
```

## Prerequisites
- [01-foundations/02-http-networking](../../../01-foundations/02-http-networking/README.md) lesson 03 (cookies) and [01-foundations/06-security](../../../01-foundations/06-security/README.md).
- [02-api-design](../../02-api-design/README.md), [03-databases](../../03-databases/README.md); Redis running locally.

## Lesson map
| Lesson | Checklist items |
|:--|:--|
| [01 · Concepts, passwords, and tokens](01-concepts-passwords-tokens.md) | 1, 2, 9 |
| [02 · Server-side sessions in Redis](02-sessions-in-redis.md) | 3, 4, 13 |
| [03 · Login protection, recovery, and MFA](03-login-protection-recovery-mfa.md) | 5, 6, 7 |
| [04 · Authorization and multiple clients](04-authorization-and-clients.md) | 8, 12 |
| [05 · OAuth/OIDC sign-in and Better Auth](05-oauth-and-better-auth.md) | 10, 11 |
| [Cheatsheet](cheatsheet.md) | all |

## Suggested order
1. 01 → 04 building sessions by hand, then 05 to move to Better Auth.
2. Abuse protection continues in [05-validation-abuse](../../05-validation-abuse/README.md); the frontend side in [02-frontend/11-security](../../../02-frontend/11-security/README.md).
3. Ready to build: `/learn typescript/03-backend/04-auth mode=tasks`.

## Version notes
- NIST SP 800-63B revision 4 (2025): passwords used as the only factor need at least 15 characters (8 with MFA); no composition rules or forced periodic changes; check against breached-password lists; allow paste and password managers.
- OWASP's minimum argon2id parameters: 19 MiB memory, 2 iterations, parallelism 1 (or equivalent stronger settings).
- Better Auth: 1.5 replaced the OIDC provider plugin with an OAuth 2.1 provider; 1.6/1.7 are current. Its Express integration mounts `toNodeHandler(auth)` on `/api/auth/*splat` (Express 5 syntax) before `express.json()`. Auth.js is in maintenance (security fixes only), per STACK.md.
- Passkeys (WebAuthn) are supported by all major browsers and password managers; prefer them over SMS codes.

## Sources
- [OWASP — Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP — Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [Better Auth documentation](https://www.better-auth.com/docs)
- [OWASP — Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
