---
title: Authentication & Authorization
module: 03-backend
tech: ASP.NET Core Identity, JWT bearer, cookie authentication, Data Protection, Redis 8
---
# Authentication & Authorization
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Authentication vs authorization; identity, credentials, sessions
- [ ] ⭐ Password storage: the Identity password hasher (PBKDF2) vs argon2id; password rules from NIST SP 800-63B
- [ ] ⭐ Cookie authentication: the authentication handler, secure cookies, sliding expiry, a server-side ticket store in Redis
- [ ] Session fixation, logout everywhere, and listing active sessions
- [ ] ⭐ Login protection: rate limits, throttling vs lockouts, credential stuffing defenses
- [ ] Password reset and email verification with single-use tokens
- [ ] Multi-factor authentication: TOTP, passkeys (WebAuthn), recovery codes
- [ ] ⭐ Authorization: roles, claims, policies, requirements and handlers, resource-based checks
- [ ] Sessions vs JWTs: trade-offs, and where JWTs fit
- [ ] ⭐ JWT bearer authentication: issuing and validating tokens, signing keys, lifetimes, refresh tokens, revocation
- [ ] OAuth 2.0 / OpenID Connect sign-in: authorization code + PKCE, state, account linking
- [ ] ⭐ Moving to ASP.NET Core Identity: `IdentityDbContext` with EF Core, `UserManager`, `SignInManager`, identity API endpoints
- [ ] Auth for several clients: Next.js frontend, mobile apps, API keys
- [ ] Encryption and secure storage: the Data Protection API, key ring storage, protecting data at rest
- [ ] Hosted identity: Microsoft Entra ID and Entra External ID; when to stop running your own
- [ ] Auditing and monitoring authentication events

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Authentication basics, password storage, and cookie authentication](docs/01-basics-passwords-cookies.md)
- [02 · Sessions in practice: fixation, logout everywhere, login protection, recovery](docs/02-sessions-login-protection-recovery.md)
- [03 · ASP.NET Core Identity and multi-factor authentication](docs/03-identity-mfa.md)
- [04 · JWT bearer tokens, sessions vs JWTs, and several clients](docs/04-jwt-sessions-clients.md)
- [05 · Authorization: roles, claims, policies, and resources](docs/05-authorization.md)
- [06 · External sign-in, Data Protection, hosted identity, and auditing](docs/06-external-dataprotection-audit.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/04-auth mode=tasks` when you are ready to build._
