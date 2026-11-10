---
title: Authentication & Authorization cheatsheet
tech: ASP.NET Core Identity, JWT bearer, cookie authentication, Data Protection, Redis 8
version: ASP.NET Core 10, Microsoft.AspNetCore.Identity.EntityFrameworkCore 10.0.x, Microsoft.AspNetCore.Authentication.JwtBearer 10.0.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
---
# Authentication & Authorization cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Basics
| Term | Meaning | Note |
|:--|:--|:--|
| ⭐ authentication | who you are | |
| ⭐ authorization | what you may do | |
| `ClaimsPrincipal` | identities + claims | `HttpContext.User` |
| scheme | named handler | Cookies, Bearer, oidc |
| challenge / forbid | 401 / 403 | |
| `UseAuthentication()` → `UseAuthorization()` | order | |

## Passwords
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ `PasswordHasher<TUser>` | PBKDF2-HMAC-SHA512, 100k iterations default | raise `IterationCount` (≥ 210k) |
| argon2id | OWASP first choice | custom `IPasswordHasher` |
| `SuccessRehashNeeded` | upgrade hash on login | |
| ⭐ NIST 800-63B | length (15+ single-factor), breached checks, no rotation/composition | |
| breached check | HIBP k-anonymity | `IPasswordValidator` |
| dummy hash on unknown user | timing-safe login | |

## Cookie authentication
| Option | Value | Note |
|:--|:--|:--|
| ⭐ `Cookie.Name` | `__Host-shop` | prefix rules |
| ⭐ `HttpOnly` / `SecurePolicy.Always` / `SameSite.Lax` | flags | |
| `ExpireTimeSpan` + `SlidingExpiration` | lifetime | + absolute max |
| ⭐ `OnRedirectToLogin` → 401 | APIs | no HTML redirects |
| `OnRedirectToAccessDenied` → 403 | APIs | |
| `SessionStore` (`ITicketStore`) | server-side sessions | Redis |
| `SignInAsync` / `SignOutAsync` | issue / clear | |
| `ConfigureApplicationCookie` | Identity's cookie | |

## Sessions
| Item | Does | Note |
|:--|:--|:--|
| new session on login | stops fixation | automatic on `SignInAsync` |
| ⭐ security stamp | invalidates old cookies | password/MFA/email changes |
| `UpdateSecurityStampAsync` | logout everywhere | |
| `SecurityStampValidatorOptions.ValidationInterval` | check frequency | default 30 min |
| session list | ticket store with metadata | revoke one |

## Login protection
| Control | How | Note |
|:--|:--|:--|
| ⭐ rate limits | IP + account | `RequireRateLimiting("login")` |
| ⭐ lockout | `MaxFailedAccessAttempts`, `DefaultLockoutTimeSpan` | `lockoutOnFailure: true` |
| generic errors | "Email or password is incorrect" | no enumeration |
| MFA | passkeys, TOTP | |
| notifications | new device, credential changes | email |
| alerts | failed-login spikes | |

## Recovery
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ same response for unknown emails | no enumeration | `202 Accepted` |
| `GeneratePasswordResetTokenAsync` / `ResetPasswordAsync` | reset flow | rotates stamp |
| `DataProtectionTokenProviderOptions.TokenLifespan` | token expiry | default 1 day → 1 h |
| `GenerateEmailConfirmationTokenAsync` / `ConfirmEmailAsync` | verify email | |
| `SignIn.RequireConfirmedEmail` | gate sign-in | |
| change email | confirm new, notify old | |
| no tokens in logs | strip query strings | |

## ASP.NET Core Identity
| API | Does | Note |
|:--|:--|:--|
| ⭐ `IdentityDbContext<TUser, TRole, TKey>` | EF Core tables | `base.OnModelCreating` first |
| `AddIdentityCore<TUser>()` | minimal services | APIs |
| ⭐ `AddIdentityApiEndpoints<TUser>()` + `MapIdentityApi<TUser>()` | SPA endpoints | `/register`, `/login`, `/refresh`, `/manage/2fa`… |
| `?useCookies=true` | cookie login | Next.js |
| MapIdentityApi bearer tokens | Data Protection tokens | not JWTs |
| ⭐ `UserManager<TUser>` | users, tokens, 2FA, roles | |
| ⭐ `SignInManager<TUser>` | sign-in flows | |
| `RoleManager<TRole>` | roles | |
| `Stores.SchemaVersion = Version3` | passkeys schema | .NET 10 |
| `IdentityOptions` | password, lockout, user, sign-in | |

## MFA
| Factor | Identity API | Note |
|:--|:--|:--|
| ⭐ passkeys | .NET 10 passkey support | phishing-resistant; set `ServerDomain` |
| ⭐ TOTP | `ResetAuthenticatorKeyAsync`, `VerifyTwoFactorTokenAsync` | QR `otpauth://` |
| recovery codes | `GenerateNewTwoFactorRecoveryCodesAsync` | show once |
| enable 2FA | `SetTwoFactorEnabledAsync` | |
| sign-in | `RequiresTwoFactor` → `TwoFactorAuthenticatorSignInAsync` | |
| recovery sign-in | `TwoFactorRecoveryCodeSignInAsync` | |
| SMS | weakest | last resort |
| step-up | re-auth before sensitive actions | |

## Sessions vs JWTs
| Aspect | Cookie session | JWT |
|:--|:--|:--|
| revocation | immediate | until expiry |
| browser storage | HttpOnly | XSS-exposed |
| CSRF | needs defenses | not with headers |
| cross-service | no | yes |
| ⭐ this stack | browser | mobile, partners, services |

## JWT bearer
| Item | Value | Note |
|:--|:--|:--|
| ⭐ `AddJwtBearer` | validation | |
| `Authority` / `Audience` | IdP + API id | |
| ⭐ validate issuer, audience, lifetime, signature | always | |
| `ValidAlgorithms` | RS256/ES256 | no `none` |
| `ClockSkew` | ~1 min | default 5 min |
| `MapInboundClaims = false` | keep claim names | |
| `NameClaimType` / `RoleClaimType` | `sub` / `roles` | |
| `JsonWebTokenHandler.CreateToken` | issue tokens | Microsoft.IdentityModel.JsonWebTokens |
| asymmetric keys in Key Vault | signing | JWKS, `kid` rotation |
| access 5–15 min | lifetime | |
| ⭐ refresh rotation + reuse detection | opaque, hashed | revoke family |
| `jti` deny list | emergencies | `OnTokenValidated` |

## Multiple clients
| Client | Auth | Note |
|:--|:--|:--|
| Next.js | cookies, same-origin `/api` | |
| mobile | code + PKCE → JWT | IdP |
| partners | client credentials / API keys | hashed keys |
| services | managed identity / client credentials | |
| ⭐ `AddPolicyScheme` + `ForwardDefaultSelector` | pick scheme per request | Bearer header? |

## Authorization
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `AddAuthorizationBuilder().SetFallbackPolicy(...)` | deny by default | |
| ⭐ `AddPolicy("Name", p => …)` | named policy | |
| `RequireRole` / `RequireClaim` / `RequireAssertion` | builders | |
| `IAuthorizationRequirement` + `AuthorizationHandler<TReq>` | custom rules | |
| ⭐ `AuthorizationHandler<TReq, TResource>` | resource rules | |
| ⭐ `IAuthorizationService.AuthorizeAsync(user, resource, policy)` | check in handlers | |
| `.RequireAuthorization("Policy")` / `[Authorize(Policy = …)]` | endpoints | |
| `.AllowAnonymous()` | explicit public | |
| `IClaimsTransformation` | enrich claims | cache |
| permissions over roles | fine-grained | roles → permission sets |
| ownership in queries | cheap check | `WHERE CustomerId = @me` |

## External sign-in
| Item | Does | Note |
|:--|:--|:--|
| ⭐ OIDC | identity on OAuth 2.0 | ID token |
| code + PKCE | flow | default in handler |
| `AddOpenIdConnect` / `AddGoogle` / `AddMicrosoftAccount` | handlers | |
| `IdentityConstants.ExternalScheme` | temp external cookie | |
| `ExternalLoginSignInAsync` / `AddLoginAsync` | Identity linking | |
| ⭐ link only verified emails | no takeover | `email_verified` |
| `bypassTwoFactor: false` | keep MFA | |

## Data Protection
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `PersistKeysToAzureBlobStorage` | shared key ring | |
| ⭐ `ProtectKeysWithAzureKeyVault` | encrypt keys at rest | |
| `SetApplicationName` | share across apps/replicas | |
| key lifetime | 90 days, auto-roll | |
| `CreateProtector("purpose")` | protect own data | |
| `ToTimeLimitedDataProtector()` | expiring payloads | |
| not for long-term data | keys roll | Always Encrypted / AES-GCM |

## Hosted identity
| Option | Use | Note |
|:--|:--|:--|
| ⭐ Entra External ID | customer identity (CIAM) | Azure AD B2C closed to new customers |
| Entra ID | employees/admins | conditional access |
| Microsoft.Identity.Web | Entra integration library | |
| Keycloak / Auth0 / Okta | other IdPs | |
| OpenIddict | own OIDC server | open source |
| Duende IdentityServer | own OIDC server | commercial |

## Auditing
| Event | Log | Note |
|:--|:--|:--|
| ⭐ sign-in success/failure | reason, user hash, IP, UA | |
| lockout | | |
| password/MFA/email changes | | notify user |
| role/permission changes | actor, before/after | |
| token reuse | family id | alert |
| ⭐ never log | passwords, tokens, reset links | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| SHA-256 passwords | cracked fast | PBKDF2/argon2id |
| API redirects to login | broken SPA | 401 events |
| "no such account" messages | enumeration | generic |
| no lockout | stuffing works | lockout + limits |
| no audience validation | token confusion | validate |
| long-lived JWTs | no revocation | short + refresh rotation |
| shared symmetric keys | anyone mints tokens | asymmetric |
| default Data Protection in containers | logouts | shared key ring |
| auto-link by email | takeover | verified + explicit |
| roles on every endpoint | brittle | policies |
| UI-only authorization | bypassable | API enforces |

## Sources
| Source | Link |
|:--|:--|
| Authentication overview | https://learn.microsoft.com/aspnet/core/security/authentication/ |
| Identity | https://learn.microsoft.com/aspnet/core/security/authentication/identity |
| Identity API endpoints | https://learn.microsoft.com/aspnet/core/security/authentication/identity-api-authorization |
| Passkeys | https://learn.microsoft.com/aspnet/core/security/authentication/passkeys |
| JWT bearer | https://learn.microsoft.com/aspnet/core/security/authentication/configure-jwt-bearer-authentication |
| Policy-based authorization | https://learn.microsoft.com/aspnet/core/security/authorization/policies |
| Data Protection | https://learn.microsoft.com/aspnet/core/security/data-protection/introduction |
| OWASP Authentication | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html |
| NIST SP 800-63B | https://pages.nist.gov/800-63-4/sp800-63b.html |
