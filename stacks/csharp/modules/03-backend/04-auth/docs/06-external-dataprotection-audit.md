---
title: External sign-in, Data Protection, hosted identity, and auditing
tech: OpenID Connect handler, ASP.NET Core Data Protection, Azure Blob Storage + Key Vault, Microsoft Entra External ID
version: ASP.NET Core 10, Azure.Extensions.AspNetCore.DataProtection.Blobs/Keys 1.x
date: 2026-11-09
covers: [11, 14, 15, 16]
---
# External sign-in, Data Protection, hosted identity, and auditing
[← Overview](00-overview.md)

## Why it matters
- After every deploy, all customers are logged out: each new container generates its own Data Protection keys, so old cookies can't be decrypted.
- With three replicas, users are randomly logged out: each replica has a different key ring.
- "Sign in with Google" links accounts by email without checking that the email is verified at the provider; an attacker creates a Google account with a victim's unverified email and takes over their shop account.

## Concepts

### OAuth 2.0 / OpenID Connect sign-in
| Piece | Meaning |
|:--|:--|
| OAuth 2.0 | delegated authorization (access tokens for APIs) |
| ⭐ OpenID Connect | identity layer on OAuth 2.0: an **ID token** proves who signed in |
| authorization code + PKCE | the flow for web and mobile apps (the ASP.NET Core OIDC handler uses code + PKCE by default) |
| `state` / `nonce` | CSRF and replay protection (handled by the handler) |
| scopes | `openid profile email` |
| external login in Identity | `SignInManager.ExternalLoginSignInAsync`, `UserManager.AddLoginAsync` (AspNetUserLogins table) |

Account linking rules: link only on a **verified** email from the provider (`email_verified` claim), or require the user to sign in with the existing method first; never silently merge by unverified email.

Handlers: `AddOpenIdConnect` (any OIDC provider), `AddMicrosoftAccount`, `AddGoogle`, plus community providers (AspNet.Security.OAuth.Providers).

### Data Protection
ASP.NET Core's encryption API. It protects cookies, antiforgery tokens, Identity tokens (reset, email confirmation), `MapIdentityApi` bearer tokens, and TempData.
| Setting | Production |
|:--|:--|
| ⭐ key ring persistence | shared storage: `PersistKeysToAzureBlobStorage(...)` |
| ⭐ key encryption at rest | `ProtectKeysWithAzureKeyVault(...)` |
| `SetApplicationName("shop")` | same name on all instances that share cookies |
| key lifetime | 90 days by default, rolled automatically, old keys kept to decrypt |
| `IDataProtector` (`CreateProtector("purpose")`) | protect your own short-lived data (tokens in links, state) |
| `ToTimeLimitedDataProtector()` | expiring payloads |

Data Protection is for **transient** data. For long-term encrypted data at rest (stored in the database for years), use Always Encrypted or application-level AES-GCM with keys in Key Vault (and plan key rotation), because Data Protection keys are designed to roll.

### Hosted identity
| Option | What | When |
|:--|:--|:--|
| ⭐ Microsoft Entra External ID | Microsoft's customer identity (CIAM): sign-up/sign-in, social logins, MFA, branding | you'd rather not run auth; Azure-centric |
| Microsoft Entra ID (workforce) | employees and admins (SSO, conditional access) | admin/back-office apps |
| Keycloak / Auth0 / Okta | other IdPs | multi-cloud, existing contracts |
| OpenIddict | open-source OIDC server library for ASP.NET Core | you must be the identity provider |
| Duende IdentityServer | commercial OIDC server | enterprise licenses |
| ASP.NET Core Identity | users in your own database | this stack's default for customers |

When to stop running your own: compliance demands (SOC 2 controls, audits), many apps needing SSO, enterprise customers requiring SAML/OIDC federation, or a team without security capacity. Microsoft.Identity.Web simplifies Entra integration.

### Auditing authentication events
| Event | Fields |
|:--|:--|
| sign-in success / failure (reason category) | user id (or attempted identifier hash), IP, user agent, scheme, trace id |
| lockout, unlock | |
| password change / reset | |
| MFA enabled/disabled, recovery code used | |
| new device / passkey registered | |
| role or permission change | actor, target, before/after |
| refresh token reuse detected | family id |

Structured logs (03-backend/10) for operations; an append-only audit table (or Log Analytics) for security-relevant account changes; alerts on spikes. Never log passwords, tokens, or full reset links.

## Example
`src/Shop.Api/Program.cs` (Data Protection for multiple replicas)
```csharp
using Azure.Identity;
using Microsoft.AspNetCore.DataProtection;

var credential = new DefaultAzureCredential();
builder.Services.AddDataProtection()
    .SetApplicationName("shop")
    .PersistKeysToAzureBlobStorage(new Uri(builder.Configuration["DataProtection:BlobUri"]!), credential)      // .../keys/shop.xml
    .ProtectKeysWithAzureKeyVault(new Uri(builder.Configuration["DataProtection:KeyUri"]!), credential);       // KV key, not secret
```
External sign-in (Google) with Identity:
```csharp
builder.Services.AddAuthentication()
    .AddGoogle(o =>
    {
        o.ClientId = builder.Configuration["Auth:Google:ClientId"]!;
        o.ClientSecret = builder.Configuration["Auth:Google:ClientSecret"]!;   // from Key Vault
        o.SignInScheme = IdentityConstants.ExternalScheme;
    });

app.MapGet("/auth/external/callback", async (SignInManager<AppUser> signIn, UserManager<AppUser> users, ILogger<Program> log) =>
{
    var info = await signIn.GetExternalLoginInfoAsync();
    if (info is null) return Results.Redirect("/sign-in?error=external");

    var result = await signIn.ExternalLoginSignInAsync(info.LoginProvider, info.ProviderKey, isPersistent: false, bypassTwoFactor: false);
    if (result.Succeeded) return Results.Redirect("/account");

    var email = info.Principal.FindFirstValue(ClaimTypes.Email);
    var verified = info.Principal.FindFirstValue("email_verified") == "true";
    if (email is null || !verified) return Results.Redirect("/sign-in?error=unverified-email");
    // existing local account with this email → ask the user to sign in and link explicitly; never auto-merge
    log.LogInformation("External login needs linking for {Provider}", info.LoginProvider);
    return Results.Redirect("/sign-in/link?provider=" + Uri.EscapeDataString(info.LoginProvider));
});
```
Audit log event:
```csharp
log.LogWarning("Auth.SignInFailed {Reason} {UserIdHash} {Ip}", "invalid_password", Hash(userId), ip);
```

## Production patterns
- Data Protection keys in Blob Storage, wrapped with a Key Vault key, same application name on every replica; tested by restarting and scaling.
- External logins link only on verified emails or explicit user action; external sign-in still honors MFA (`bypassTwoFactor: false`).
- Consider Entra External ID before building sign-up, social logins, and MFA UX yourself; keep ASP.NET Core Identity if you need full control in your database.
- An auth-events dashboard and alerts (failed sign-ins, lockouts, token reuse) owned by the team.

## Mistakes
Wrong: default Data Protection in containers.
```csharp
// nothing configured → keys in the container's file system, lost on restart, different per replica
```
Right: persisted, encrypted, shared key ring.

Wrong: auto-linking external accounts by email.
Right: verified email + explicit linking flow.

## Check yourself
1. What breaks when replicas don't share the Data Protection key ring?
2. Why isn't Data Protection right for encrypting data stored for years?
3. What is the ID token in OpenID Connect for?

<details><summary>Answers</summary>

1. Cookies, antiforgery tokens, and Identity tokens created by one replica can't be decrypted by another, so users are logged out and forms fail randomly.
2. Its keys roll (90 days) and the system is designed for transient payloads; long-term data needs encryption with keys you manage and rotate deliberately (Always Encrypted, Key Vault-backed AES).
3. It's a signed token from the identity provider that says who signed in (subject, issuer, audience, auth time), consumed by the client application.
</details>

## Sources
- [Data Protection in ASP.NET Core](https://learn.microsoft.com/aspnet/core/security/data-protection/introduction)
- [Configure Data Protection (Azure Blob + Key Vault)](https://learn.microsoft.com/aspnet/core/security/data-protection/configuration/overview)
- [External login providers in ASP.NET Core](https://learn.microsoft.com/aspnet/core/security/authentication/social/)
- [Microsoft Entra External ID](https://learn.microsoft.com/entra/external-id/)
- [OpenIddict](https://documentation.openiddict.com/)
- [OWASP — Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
