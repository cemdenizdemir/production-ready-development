---
title: Authentication basics, password storage, and cookie authentication
tech: ASP.NET Core 10 cookie authentication, Identity PasswordHasher, Redis 8 (ticket store)
version: ASP.NET Core 10
date: 2026-11-09
covers: [1, 2, 3]
---
# Authentication basics, password storage, and cookie authentication
[← Overview](00-overview.md)

## Why it matters
- Passwords are stored as SHA-256 hashes without salt; after a database leak, 70% are cracked in an afternoon.
- The API redirects unauthenticated calls to `/Account/Login` (the cookie handler's default); the Next.js app receives HTML instead of a 401 and shows a broken page.
- Cookies are issued without `Secure` and with `SameSite=None`; a network attacker or a cross-site request rides the session.

## Concepts

### Identity, credentials, sessions
| Term | Meaning |
|:--|:--|
| identity | who someone claims to be (user id, email) |
| credential | proof: password, passkey, TOTP code, client certificate |
| authentication | verifying the credential |
| session | remembered authentication (cookie or token) for later requests |
| `ClaimsPrincipal` | ASP.NET Core's representation: identities with claims (`sub`, `email`, `role`) |
| scheme | a named handler: `Cookies`, `Bearer`, `Identity.Application`, `oidc` |
| challenge / forbid | 401 (authenticate first) / 403 (not allowed) |

### Password storage
| Rule | Detail |
|:--|:--|
| ⭐ slow, salted, adaptive hash | argon2id, scrypt, bcrypt, or PBKDF2 with many iterations |
| ASP.NET Core Identity hasher | PBKDF2-HMAC-SHA512, 128-bit salt, 100,000 iterations by default; raise to OWASP's ≥ 210,000 for SHA-512 via `PasswordHasherOptions.IterationCount` |
| argon2id | OWASP's first choice (e.g. m=19 MiB, t=2, p=1); plug in with a custom `IPasswordHasher<TUser>` (e.g. Konscious.Security.Cryptography) |
| rehash on login | when parameters change, `PasswordVerificationResult.SuccessRehashNeeded` → store the new hash |
| never | plain hashes (SHA-256/MD5), encryption instead of hashing, logging passwords |

Password rules per NIST SP 800-63B (rev. 4): length over complexity (at least 15 characters when the password is the only factor, 8+ with MFA), allow at least 64 characters and all Unicode/spaces, **block breached and common passwords** (k-anonymity check against Have I Been Pwned), no composition rules, no forced periodic rotation, allow paste and password managers.

### Cookie authentication by hand
The cookie handler serializes the `ClaimsPrincipal` into an authentication ticket, encrypts it with Data Protection, and sets it as a cookie.
| Option | Production value |
|:--|:--|
| `Cookie.Name` | `__Host-shop` |
| `Cookie.HttpOnly` | true |
| `Cookie.SecurePolicy` | `Always` |
| `Cookie.SameSite` | `Lax` |
| `ExpireTimeSpan` + `SlidingExpiration` | e.g. 8 h sliding, plus an absolute max you enforce |
| `Events.OnRedirectToLogin` / `OnRedirectToAccessDenied` | return 401/403 for API requests instead of redirects |
| `SessionStore` (`ITicketStore`) | server-side sessions: the cookie holds only a key; tickets in Redis → revocable, small cookies |
| Data Protection key ring | shared and persisted (lesson 06), or every restart logs everyone out |

## Example
`src/Shop.Api/Auth/CookieAuthSetup.cs`
```csharp
using Microsoft.AspNetCore.Authentication.Cookies;

public static class CookieAuthSetup
{
    public static IServiceCollection AddShopCookieAuth(this IServiceCollection services) =>
        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(o =>
            {
                o.Cookie.Name = "__Host-shop";
                o.Cookie.HttpOnly = true;
                o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                o.Cookie.SameSite = SameSiteMode.Lax;
                o.Cookie.Path = "/";
                o.ExpireTimeSpan = TimeSpan.FromHours(8);
                o.SlidingExpiration = true;
                o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
                o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
            })
            .Services;
}
```
`src/Shop.Api/Auth/LoginEndpoints.cs` (hand-built, before Identity)
```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;

public static class LoginEndpoints
{
    public static void MapLogin(this IEndpointRouteBuilder app)
    {
        app.MapPost("/auth/login", async (LoginRequest body, UserStore users, IPasswordHasher<AppUser> hasher, HttpContext http, CancellationToken ct) =>
        {
            var user = await users.FindByEmailAsync(body.Email, ct);
            // verify against a dummy hash when the user doesn't exist: same response, similar timing
            var result = hasher.VerifyHashedPassword(user ?? DummyUser, user?.PasswordHash ?? DummyHash, body.Password);

            if (user is null || result == PasswordVerificationResult.Failed)
                return Results.Problem(statusCode: 401, title: "Email or password is incorrect.");

            if (result == PasswordVerificationResult.SuccessRehashNeeded)
                await users.UpdatePasswordHashAsync(user, hasher.HashPassword(user, body.Password), ct);

            var principal = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(ClaimTypes.Email, user.Email)],
                CookieAuthenticationDefaults.AuthenticationScheme));

            await http.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal,
                new AuthenticationProperties { IsPersistent = body.RememberMe });
            return Results.NoContent();
        }).RequireRateLimiting("login");

        app.MapPost("/auth/logout", async (HttpContext http) =>
        {
            await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.NoContent();
        }).RequireAuthorization();
    }

    private static readonly AppUser DummyUser = new();
    private const string DummyHash = "AQAAAAIAAYagAAAAE…";   // a real hash generated once, used to equalize timing
}
```
`src/Shop.Api/Program.cs` (hasher strength)
```csharp
builder.Services.Configure<PasswordHasherOptions>(o => o.IterationCount = 210_000);
builder.Services.AddSingleton<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
```

## Production patterns
- Use Identity's hasher (tuned) or argon2id; rehash on successful login when parameters change.
- Cookie flags: `__Host-` prefix, `HttpOnly`, `Secure`, `SameSite=Lax`; API returns 401/403, never redirects.
- Same error message and similar timing for "no such user" and "wrong password" (no account enumeration).
- Server-side ticket store (Redis) when you need revocation, many claims, or session listings (lesson 02).

## Mistakes
Wrong:
```csharp
var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(password)));
```
Right: `PasswordHasher<TUser>` (PBKDF2, salted, iterated) or argon2id.

Wrong: forcing "1 uppercase, 1 number, 1 symbol, change every 90 days".
Right: long passphrases, breached-password checks, MFA.

## Check yourself
1. What's the difference between a 401 and a 403 in terms of authentication?
2. Why does a password hash need a salt and many iterations?
3. Why configure `OnRedirectToLogin` for an API?

<details><summary>Answers</summary>

1. 401: no valid identity (challenge, authenticate first). 403: authenticated, but the identity isn't allowed (forbid).
2. Salt makes identical passwords hash differently and defeats precomputed tables; iterations make each guess expensive for attackers.
3. The cookie handler's default is a 302 to a login page, which API clients (and fetch from the Next.js app) can't use; they need a 401.
</details>

## Sources
- [Use cookie authentication without Identity](https://learn.microsoft.com/aspnet/core/security/authentication/cookie)
- [OWASP — Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [PasswordHasher\<TUser\>](https://learn.microsoft.com/dotnet/api/microsoft.aspnetcore.identity.passwordhasher-1)
- [Have I Been Pwned — Pwned Passwords API](https://haveibeenpwned.com/API/v3#PwnedPasswords)
