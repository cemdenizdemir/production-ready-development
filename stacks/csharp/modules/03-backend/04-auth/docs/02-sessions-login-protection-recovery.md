---
title: "Sessions in practice: fixation, logout everywhere, login protection, recovery"
tech: ASP.NET Core Identity, cookie authentication, rate limiting middleware, Redis 8
version: ASP.NET Core 10
date: 2026-11-09
covers: [4, 5, 6]
---
# Sessions in practice: fixation, logout everywhere, login protection, recovery
[← Overview](00-overview.md)

## Why it matters
- A user changes their password after a phone theft; the thief's session on the phone keeps working for weeks.
- A credential-stuffing attack tries 50,000 email/password pairs from leaked lists; 1.2% work. No rate limit, no lockout, no alert.
- "Forgot password" says "No account with that email"; attackers use it to check which emails are customers. Reset links never expire.

## Concepts

### Session fixation and rotation
Fixation: an attacker plants a session identifier before login and reuses it after. Defense: **issue a new session on every login and privilege change**. ASP.NET Core's cookie handler creates a new ticket on `SignInAsync`; with a server-side ticket store, a new key. Never accept session IDs from query strings.

### Logout everywhere and session lists
| Mechanism | How |
|:--|:--|
| ⭐ security stamp (Identity) | a random value stored with the user; changes on password change, MFA change, `UpdateSecurityStampAsync`. Cookies carry the stamp; `SecurityStampValidator` rechecks it every `ValidationInterval` (default 30 min) and rejects stale cookies |
| shorter validation interval | e.g. 1–5 min for sensitive apps (each check is a DB read) |
| server-side sessions (`ITicketStore` in Redis) | list sessions (device, IP, last seen), revoke one or all immediately |
| refresh-token revocation | for JWT clients (lesson 04) |

### Login protection
| Layer | Control |
|:--|:--|
| ⭐ rate limits | per IP and per account on `/auth/login` (01-foundations/06), plus edge rules at Front Door |
| ⭐ lockout | Identity: `MaxFailedAccessAttempts` (e.g. 5), `DefaultLockoutTimeSpan` (e.g. 15 min); `lockoutOnFailure: true` in `PasswordSignInAsync` |
| throttling vs lockout | lockout can be abused to lock victims out; combine short lockouts with progressive delays and IP limits |
| credential stuffing | breached-password checks at registration/change, MFA, bot detection (CAPTCHA only after suspicious signals) |
| generic errors | "Email or password is incorrect" for every failure |
| notifications | email on new device login, password change, MFA change |
| monitoring | alert on failed-login spikes, many accounts from one IP, many IPs on one account |

### Password reset and email verification
| Step | Rule |
|:--|:--|
| request reset | always respond "If an account exists, we sent an email" (no enumeration); rate limit per email and IP |
| token | single-use, short-lived (e.g. 1 h), tied to the security stamp (Identity's `DataProtectorTokenProvider`) |
| link | `https://shop.test/reset?email=…&token=…` (URL-encode the token); no tokens in logs or analytics (strip query strings) |
| reset | `ResetPasswordAsync` validates token + new password, updates the security stamp → other sessions end |
| after reset | notify the user, optionally sign in |
| email confirmation | `GenerateEmailConfirmationTokenAsync` / `ConfirmEmailAsync`; `SignIn.RequireConfirmedEmail = true` before allowing sign-in or sensitive actions |
| changing email | confirm the **new** address before switching; notify the old one |

## Example
`src/Shop.Api/Program.cs` (Identity options)
```csharp
builder.Services.AddIdentityCore<AppUser>(o =>
    {
        o.Password.RequiredLength = 15;
        o.Password.RequireDigit = o.Password.RequireLowercase = o.Password.RequireUppercase = o.Password.RequireNonAlphanumeric = false;
        o.Lockout.MaxFailedAccessAttempts = 5;
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        o.Lockout.AllowedForNewUsers = true;
        o.User.RequireUniqueEmail = true;
        o.SignIn.RequireConfirmedEmail = true;
    })
    .AddEntityFrameworkStores<ShopDb>()
    .AddDefaultTokenProviders()
    .AddPasswordValidator<BreachedPasswordValidator>();          // checks Have I Been Pwned (k-anonymity)

builder.Services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromHours(1));
builder.Services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.FromMinutes(5));
```
`src/Shop.Api/Auth/PasswordResetEndpoints.cs`
```csharp
public static class PasswordResetEndpoints
{
    public static void MapPasswordReset(this IEndpointRouteBuilder app)
    {
        app.MapPost("/auth/forgot-password", async (ForgotPasswordRequest body, UserManager<AppUser> users,
            IAccountEmails emails, CancellationToken ct) =>
        {
            var user = await users.FindByEmailAsync(body.Email);
            if (user is not null && await users.IsEmailConfirmedAsync(user))
            {
                var token = await users.GeneratePasswordResetTokenAsync(user);
                await emails.SendPasswordResetAsync(user.Email!, token, ct);      // queued job (03-backend/07)
            }
            return Results.Accepted();                                              // same answer either way
        }).RequireRateLimiting("account-recovery");

        app.MapPost("/auth/reset-password", async (ResetPasswordRequest body, UserManager<AppUser> users) =>
        {
            var user = await users.FindByEmailAsync(body.Email);
            if (user is null) return Results.Problem(statusCode: 400, title: "The link is invalid or has expired.");
            var result = await users.ResetPasswordAsync(user, body.Token, body.NewPassword);   // also rotates the security stamp
            return result.Succeeded
                ? Results.NoContent()
                : Results.ValidationProblem(result.Errors.GroupBy(e => e.Code).ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
        }).RequireRateLimiting("account-recovery");
    }
}
```
"Log out everywhere":
```csharp
app.MapPost("/me/sessions/revoke-all", async (ClaimsPrincipal me, UserManager<AppUser> users) =>
{
    var user = await users.GetUserAsync(me);
    await users.UpdateSecurityStampAsync(user!);     // all existing cookies fail validation at the next check
    return Results.NoContent();
}).RequireAuthorization();
```

## Production patterns
- New session on login; security stamp updated on password/MFA/email changes; short stamp validation interval for sensitive apps.
- Layered login defense: IP + account rate limits, short lockouts, MFA, breached-password checks, alerts.
- Recovery flows that never reveal account existence and use short-lived, single-use tokens.
- Security notifications by email for logins from new devices and every credential change.

## Mistakes
Wrong:
```csharp
if (user is null) return Results.NotFound("No account with that email");
```
Right: identical response for existing and unknown emails.

Wrong: `lockoutOnFailure: false` on password sign-in.
Right: `PasswordSignInAsync(..., lockoutOnFailure: true)` plus rate limits.

## Check yourself
1. How does the security stamp end other sessions after a password change?
2. Why can aggressive lockout be a problem?
3. What makes a password reset token safe?

<details><summary>Answers</summary>

1. The stamp in the cookie no longer matches the user's stored stamp; the validator rejects the cookie at its next check (within `ValidationInterval`).
2. Attackers can lock real users out on purpose (denial of service); combine short lockouts with IP-based limits and progressive delays.
3. It's random/unguessable, single-use, short-lived, tied to the current security stamp, sent only to the verified email, and never logged.
</details>

## Sources
- [Identity configuration (lockout, password, sign-in)](https://learn.microsoft.com/aspnet/core/security/authentication/identity-configuration)
- [Account confirmation and password recovery](https://learn.microsoft.com/aspnet/core/security/authentication/accconfirm)
- [OWASP — Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP — Credential Stuffing Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html)
- [OWASP — Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
