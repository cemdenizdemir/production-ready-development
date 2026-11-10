---
title: Authentication & Authorization — Overview
tech: ASP.NET Core Identity, JWT bearer, cookie authentication, Data Protection, Redis 8
version: ASP.NET Core 10, Microsoft.AspNetCore.Identity.EntityFrameworkCore 10.0.x, Microsoft.AspNetCore.Authentication.JwtBearer 10.0.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
---
# Authentication & Authorization — Overview
[← Topic](../README.md)

**TECH:** ASP.NET Core authentication handlers (cookie, JWT bearer, OpenID Connect), ASP.NET Core Identity on EF Core + SQL Server, authorization policies, Data Protection with keys in Blob Storage + Key Vault, optional Redis ticket store; Microsoft Entra External ID as the hosted alternative
**LEVEL:** intermediate (mid-level, new to C# and .NET)

## Why this matters in production
- Authentication failures are #7 in the OWASP Top 10:2025 and access-control failures are #1. Most breaches start at the login form or with a missing ownership check.
- ASP.NET Core gives you strong building blocks (Identity's password hasher, lockout, Data Protection, policies), but the defaults need production tuning: shared key rings, cookie flags, lockout, token lifetimes.
- The stack's learning path: build cookie and JWT auth by hand first (to understand the handlers), then move to ASP.NET Core Identity for real user management.

## Mental model
```mermaid
flowchart LR
  REQ[Request] --> AN[Authentication middleware<br/>scheme: cookie / bearer]
  AN -->|ClaimsPrincipal| AZ[Authorization<br/>policies, requirements, handlers]
  AZ -->|allowed| EP[Endpoint → resource check (owner?)]
  AZ -->|no identity| C401[401 Challenge]
  AZ -->|not allowed| C403[403 Forbid]
  ID[ASP.NET Core Identity<br/>users, passwords, MFA, lockout] --> AN
  DP[Data Protection key ring<br/>Blob + Key Vault] --> AN
```
Authentication answers **who are you**; authorization answers **what may you do**. Both run in middleware; resource-level checks happen in handlers or services.

## Prerequisites
- [01-foundations/06-security](../../../01-foundations/06-security/README.md), [01-foundations/02-http-networking](../../../01-foundations/02-http-networking/README.md) lesson 03 (cookies), [03-databases](../../03-databases/README.md) (Identity stores users with EF Core).

## Lesson map
| Lesson | Checklist items |
|:--|:--|
| [01 · Authentication basics, password storage, and cookie authentication](01-basics-passwords-cookies.md) | 1, 2, 3 |
| [02 · Sessions in practice: fixation, logout everywhere, login protection, recovery](02-sessions-login-protection-recovery.md) | 4, 5, 6 |
| [03 · ASP.NET Core Identity and multi-factor authentication](03-identity-mfa.md) | 7, 12 |
| [04 · JWT bearer tokens, sessions vs JWTs, and several clients](04-jwt-sessions-clients.md) | 9, 10, 13 |
| [05 · Authorization: roles, claims, policies, and resources](05-authorization.md) | 8 |
| [06 · External sign-in, Data Protection, hosted identity, and auditing](06-external-dataprotection-audit.md) | 11, 14, 15, 16 |
| [Cheatsheet](cheatsheet.md) | all |

## Suggested order
1. 01 → 06. Build lessons 01 and 04 by hand once; then use Identity (lesson 03) for the real app.
2. Then [05-validation-abuse](../../05-validation-abuse/README.md) (login rate limits) and [02-frontend/11-security](../../../02-frontend/11-security/README.md).
3. Ready to build: `/learn csharp/03-backend/04-auth mode=tasks`.

## Version notes
- .NET 10 Identity adds **passkey** (WebAuthn) support with a new schema version (Version3); the Blazor template shows the full flow.
- `MapIdentityApi<TUser>()` (since .NET 8) exposes register/login/refresh/2FA/reset endpoints for SPAs; its bearer tokens are Data Protection tokens, not JWTs.
- Identity's default password hasher is PBKDF2-HMAC-SHA512 with 100,000 iterations; the count is configurable.
- Microsoft Entra External ID is Microsoft's customer identity service; Azure AD B2C is no longer offered to new customers.
- Duende IdentityServer is commercial; OpenIddict is the open-source option for running your own OAuth/OIDC server.

## Sources
- [ASP.NET Core authentication overview](https://learn.microsoft.com/aspnet/core/security/authentication/)
- [Introduction to Identity](https://learn.microsoft.com/aspnet/core/security/authentication/identity)
- [Authorization in ASP.NET Core](https://learn.microsoft.com/aspnet/core/security/authorization/introduction)
- [Passkeys in ASP.NET Core Identity](https://learn.microsoft.com/aspnet/core/security/authentication/passkeys)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
