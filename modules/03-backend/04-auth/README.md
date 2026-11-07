---
title: Authentication & Authorization
module: 03-backend
tech: Express 5, Redis 8, argon2, Better Auth
---
# Authentication & Authorization
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Authentication vs authorization; identity, credentials, sessions
- [ ] ⭐ Password storage with argon2id; password rules from NIST SP 800-63B
- [ ] ⭐ Server-side sessions in Redis with secure cookies; rotation and expiry
- [ ] Session fixation, logout everywhere, and listing active sessions
- [ ] ⭐ Login protection: rate limits, throttling vs lockouts, credential stuffing defenses
- [ ] Password reset and email verification with single-use tokens
- [ ] Multi-factor authentication: TOTP, passkeys (WebAuthn), recovery codes
- [ ] ⭐ Authorization: RBAC, ownership checks, permission middleware
- [ ] Sessions vs JWTs: trade-offs, and where JWTs fit
- [ ] OAuth 2.0 / OpenID Connect sign-in: authorization code + PKCE, state, account linking
- [ ] ⭐ Moving to Better Auth: Express setup, database adapter, plugins
- [ ] Auth for several clients: Next.js frontend, mobile apps, API keys
- [ ] Auditing and monitoring authentication events

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Concepts, passwords, and tokens](docs/01-concepts-passwords-tokens.md)
- [02 · Server-side sessions in Redis](docs/02-sessions-in-redis.md)
- [03 · Login protection, recovery, and MFA](docs/03-login-protection-recovery-mfa.md)
- [04 · Authorization and multiple clients](docs/04-authorization-and-clients.md)
- [05 · OAuth/OIDC sign-in and Better Auth](docs/05-oauth-and-better-auth.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 03-backend/04-auth mode=tasks` when you are ready to build._
