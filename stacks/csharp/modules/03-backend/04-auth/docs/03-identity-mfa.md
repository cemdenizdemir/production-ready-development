---
title: ASP.NET Core Identity and multi-factor authentication
tech: ASP.NET Core Identity, EF Core 10, TOTP, passkeys (WebAuthn)
version: ASP.NET Core 10 Identity (schema Version3)
date: 2026-11-09
covers: [7, 12]
---
# ASP.NET Core Identity and multi-factor authentication
[← Overview](00-overview.md)

## Why it matters
- A team hand-rolls user tables, password resets, lockout, and MFA; each piece has a subtle bug, and the security review takes months.
- MFA via SMS codes is the only option; SIM-swap attacks take over high-value accounts.
- Users lose their phone and have no recovery codes; support resets MFA based on an email, which attackers also control.

## Concepts

### ASP.NET Core Identity
A membership system: users, password hashes, emails, phone numbers, lockout, security stamps, tokens, external logins, roles, claims, 2FA, passkeys.
| Piece | Does |
|:--|:--|
| `IdentityUser` (or your `AppUser : IdentityUser<Guid>`) | user entity |
| ⭐ `IdentityDbContext<AppUser, …>` | EF Core model for Identity tables (`AspNetUsers`, …) |
| ⭐ `UserManager<TUser>` | create users, passwords, tokens, claims, roles, 2FA |
| ⭐ `SignInManager<TUser>` | password/2FA/passkey sign-in, lockout, cookie issuing |
| `RoleManager<TRole>` | roles |
| `AddIdentityCore<TUser>()` | minimal services (API-only apps) |
| `AddIdentity<TUser, TRole>()` | full services + cookie schemes |
| ⭐ `AddIdentityApiEndpoints<TUser>()` + `MapIdentityApi<TUser>()` | ready-made JSON endpoints: `/register`, `/login`, `/refresh`, `/confirmEmail`, `/forgotPassword`, `/resetPassword`, `/manage/2fa`, `/manage/info` |

`MapIdentityApi` login supports cookies (`?useCookies=true`) for the Next.js frontend, or bearer tokens for other clients. Those bearer tokens are opaque Data Protection tokens with a refresh endpoint, not JWTs; use JWT bearer (lesson 04) when other services must validate tokens.

Many teams map only the endpoints they need, or write their own thin endpoints over `UserManager`/`SignInManager` for full control of messages and flows.

### Multi-factor authentication
| Factor | Strength | Identity support |
|:--|:--|:--|
| ⭐ passkeys (WebAuthn) | phishing-resistant, no shared secret | .NET 10 (schema Version3) |
| TOTP authenticator app | strong; phishable in real time | ✓ (`AuthenticatorTokenProvider`) |
| recovery codes | backup | ✓ (`GenerateNewTwoFactorRecoveryCodesAsync`) |
| email codes | weak-ish (email compromise) | ✓ (token provider) |
| SMS codes | weakest (SIM swap) | ✓ (phone provider) |

TOTP setup flow: `ResetAuthenticatorKeyAsync` → show key/QR (`otpauth://totp/Roastery:{email}?secret={key}&issuer=Roastery`) → user enters a code → `VerifyTwoFactorTokenAsync(user, TokenOptions.DefaultAuthenticatorProvider, code)` → `SetTwoFactorEnabledAsync(user, true)` → generate recovery codes, show once.

Sign-in with 2FA: `PasswordSignInAsync` returns `RequiresTwoFactor` → second step `TwoFactorAuthenticatorSignInAsync(code, isPersistent, rememberClient)` (or `TwoFactorRecoveryCodeSignInAsync`).

Passkeys: the server creates WebAuthn options, the browser calls `navigator.credentials.create()` / `.get()`, the server verifies the attestation/assertion and stores the credential. .NET 10 Identity implements the server side (options, verification, storage); the Blazor template shows the full flow, and the same `SignInManager` passkey APIs can back endpoints called from the Next.js frontend. Set `IdentityPasskeyOptions.ServerDomain` (the relying party ID) explicitly to your domain.

## Example
`src/Shop.Infrastructure/Data/ShopDb.cs` (Identity + app data in one context)
```csharp
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

public sealed class AppUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = "";
}

public sealed class ShopDb(DbContextOptions<ShopDb> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Order> Orders => Set<Order>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);                                   // Identity tables first
        b.ApplyConfigurationsFromAssembly(typeof(ShopDb).Assembly);
    }
}
```
`src/Shop.Api/Program.cs`
```csharp
builder.Services.AddAuthorization();
builder.Services.AddIdentityApiEndpoints<AppUser>(o =>
    {
        o.SignIn.RequireConfirmedEmail = true;
        o.Lockout.MaxFailedAccessAttempts = 5;
        o.Password.RequiredLength = 15;
        o.Stores.SchemaVersion = IdentitySchemaVersions.Version3;   // passkeys (.NET 10)
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<ShopDb>();

builder.Services.ConfigureApplicationCookie(o =>
{
    o.Cookie.Name = "__Host-shop";
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
});

var app = builder.Build();
app.MapGroup("/auth").MapIdentityApi<AppUser>().WithTags("Auth");
```
`src/Shop.Api/Auth/TwoFactorEndpoints.cs` (enabling TOTP by hand)
```csharp
app.MapPost("/me/2fa/authenticator/verify", async (VerifyTotpRequest body, ClaimsPrincipal me, UserManager<AppUser> users) =>
{
    var user = await users.GetUserAsync(me);
    var code = body.Code.Replace(" ", "").Replace("-", "");
    var valid = await users.VerifyTwoFactorTokenAsync(user!, users.Options.Tokens.AuthenticatorTokenProvider, code);
    if (!valid) return Results.Problem(statusCode: 400, title: "That code didn't work. Check the time on your phone and try again.");

    await users.SetTwoFactorEnabledAsync(user!, true);
    var recovery = await users.GenerateNewTwoFactorRecoveryCodesAsync(user!, 10);
    return Results.Ok(new { recoveryCodes = recovery });       // show once; user stores them
}).RequireAuthorization();
```
Migration after adding Identity: `dotnet ef migrations add AddIdentity -p src/Shop.Infrastructure -s src/Shop.Api` (and again when moving to schema Version3 for passkeys).

## Production patterns
- Identity for user management; your own endpoints where UX or messages need control; `MapIdentityApi` for the rest.
- Offer passkeys and TOTP; recovery codes always; SMS only as a last resort.
- MFA required for staff/admin accounts; step-up (re-authenticate) before sensitive actions like changing email or payout details.
- MFA reset by support follows a documented, strong identity verification process, logged and notified.

## Mistakes
Wrong: `MapIdentityApi` bearer tokens validated by another service as if they were JWTs.
Right: use JWT bearer with a shared issuer (lesson 04) for cross-service tokens.

Wrong: enabling 2FA without generating recovery codes.
Right: generate and show recovery codes when 2FA is turned on; let users regenerate them.

## Check yourself
1. What is the difference between `UserManager` and `SignInManager`?
2. Why are passkeys stronger than TOTP?
3. What happens when `PasswordSignInAsync` returns `RequiresTwoFactor`?

<details><summary>Answers</summary>

1. `UserManager` manages user data (create, passwords, tokens, roles, 2FA settings); `SignInManager` performs sign-in flows and issues the authentication cookie.
2. They're bound to the site's origin (phishing-resistant), use public-key cryptography (nothing reusable to steal from the server), and need no typed code.
3. The password was correct but the user must complete a second factor; the app asks for a TOTP/recovery code (or passkey) and calls the matching two-factor sign-in method.
</details>

## Sources
- [Introduction to Identity](https://learn.microsoft.com/aspnet/core/security/authentication/identity)
- [Identity API endpoints for SPAs](https://learn.microsoft.com/aspnet/core/security/authentication/identity-api-authorization)
- [Enable QR codes for TOTP authenticator apps](https://learn.microsoft.com/aspnet/core/security/authentication/identity-enable-qrcodes)
- [Passkeys in ASP.NET Core Identity](https://learn.microsoft.com/aspnet/core/security/authentication/passkeys)
- [OWASP — Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
