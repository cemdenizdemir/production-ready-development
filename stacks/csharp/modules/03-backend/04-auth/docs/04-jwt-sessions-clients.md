---
title: JWT bearer tokens, sessions vs JWTs, and several clients
tech: Microsoft.AspNetCore.Authentication.JwtBearer, Microsoft.IdentityModel.JsonWebTokens, Azure Key Vault
version: ASP.NET Core 10, Microsoft.IdentityModel 8.x
date: 2026-11-09
covers: [9, 10, 13]
---
# JWT bearer tokens, sessions vs JWTs, and several clients
[← Overview](00-overview.md)

## Why it matters
- Access tokens are valid for 30 days; one leaked token in a support ticket screenshot gives full account access for a month, and there's no way to revoke it.
- The API validates the JWT signature but not the audience; a token issued for the partner API is accepted by the admin API.
- A symmetric signing key is shared by six services; any one of them can mint admin tokens for all the others.

## Concepts

### Sessions vs JWTs
| | Server-side session (cookie) | JWT access token |
|:--|:--|:--|
| state | on the server (ticket store / security stamp) | self-contained, signed claims |
| revocation | immediate (delete session / stamp check) | hard until expiry (keep it short) |
| browser storage | `HttpOnly` cookie (XSS can't read it) | must be stored somewhere; `localStorage` is XSS-readable |
| CSRF | needs `SameSite` + antiforgery | not with `Authorization` header |
| cross-service | the API that issued it | any service that trusts the issuer |
| best for | ⭐ browsers (the Next.js app via same-origin `/api`) | mobile apps, service-to-service, partner APIs |

Default for this stack: cookies for the browser, JWT bearer for other clients.

### JWT essentials
A JWT is `header.payload.signature` (Base64URL). Claims you use: `iss` (issuer), `aud` (audience), `sub` (user id), `exp`/`nbf`/`iat`, `jti` (token id), `scope`/roles.
| Validation | Why |
|:--|:--|
| ⭐ signature with the expected key/algorithm | forged tokens |
| ⭐ issuer | tokens from other systems |
| ⭐ audience | tokens meant for other APIs |
| lifetime (`exp`, `nbf`) + small `ClockSkew` | expired tokens (default skew is 5 min; use ~1 min) |
| algorithm allowlist | `alg: none` / key-confusion attacks |

Keys: asymmetric (ES256/RS256) with the private key in **Azure Key Vault** (sign via Key Vault or load at startup) and public keys published as JWKS; symmetric HS256 only when one service both issues and validates. Rotate keys with `kid` headers and overlapping validity.

### Lifetimes, refresh, revocation
| Token | Lifetime | Storage |
|:--|:--|:--|
| access token (JWT) | 5–15 minutes | memory / secure storage in mobile apps |
| refresh token (opaque random) | days–weeks, sliding | server stores a **hash**; client in secure storage |

Refresh **rotation**: each use returns a new refresh token and invalidates the old one; reuse of an old one means theft → revoke the whole token family. Revocation: delete refresh tokens (logout, password change), keep access tokens short; for emergencies, a `jti` deny list checked in `OnTokenValidated`.

Usually you don't issue tokens yourself: an identity provider (Entra External ID, Keycloak, OpenIddict server) does, and the API only validates (`Authority` + `Audience`). Issuing by hand is worth doing once to understand it.

### Serving several clients
| Client | Auth | Scheme |
|:--|:--|:--|
| Next.js storefront | cookie via same-origin `/api` | `Identity.Application` / cookies |
| mobile app | OAuth 2.0 authorization code + PKCE with an IdP → JWT | `Bearer` |
| partners / integrations | client credentials (JWT) or API keys (hashed, scoped, rotatable) | `Bearer` / `ApiKey` |
| internal services | managed identity / client credentials → JWT | `Bearer` |

A **policy scheme** picks the handler per request: bearer if an `Authorization: Bearer` header is present, cookie otherwise.

## Example
`src/Shop.Api/Auth/JwtSetup.cs`
```csharp
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

public static class JwtSetup
{
    public static AuthenticationBuilder AddShopAuth(this IServiceCollection services, IConfiguration config)
    {
        var auth = services.AddAuthentication("smart")
            .AddPolicyScheme("smart", "Cookie or bearer", o => o.ForwardDefaultSelector = ctx =>
                ctx.Request.Headers.Authorization.ToString().StartsWith("Bearer ", StringComparison.Ordinal)
                    ? JwtBearerDefaults.AuthenticationScheme
                    : IdentityConstants.ApplicationScheme)
            .AddJwtBearer(o =>
            {
                o.Authority = config["Auth:Authority"];                 // IdP (Entra External ID / Keycloak / own issuer)
                o.Audience = config["Auth:Audience"];                   // "api://shop"
                o.MapInboundClaims = false;                             // keep "sub", "roles" as-is
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidAlgorithms = [SecurityAlgorithms.RsaSha256, SecurityAlgorithms.EcdsaSha256],
                    ClockSkew = TimeSpan.FromMinutes(1),
                    NameClaimType = "sub",
                    RoleClaimType = "roles",
                };
            });
        return auth;
    }
}
```
`src/Shop.Api/Auth/TokenIssuer.cs` (hand-built issuer, for learning or a single service)
```csharp
using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

public sealed class TokenIssuer(SigningCredentials signing, TimeProvider time)    // ES256 key loaded from Key Vault
{
    private readonly JsonWebTokenHandler _handler = new();

    public string CreateAccessToken(AppUser user, IEnumerable<string> roles) => _handler.CreateToken(new SecurityTokenDescriptor
    {
        Issuer = "https://shop.test",
        Audience = "api://shop",
        Subject = new ClaimsIdentity(
            [new Claim("sub", user.Id.ToString()), new Claim("jti", Guid.NewGuid().ToString()), ..roles.Select(r => new Claim("roles", r))]),
        IssuedAt = time.GetUtcNow().UtcDateTime,
        Expires = time.GetUtcNow().AddMinutes(10).UtcDateTime,
        SigningCredentials = signing,
    });
}
```
Refresh token rotation (storage sketch):
```csharp
public sealed record RefreshToken(Guid Id, Guid UserId, Guid FamilyId, string TokenHash, DateTimeOffset ExpiresAt,
    DateTimeOffset? UsedAt, DateTimeOffset? RevokedAt);
// on refresh: find by hash → if UsedAt != null → revoke whole FamilyId (reuse = theft) → else mark used, issue new pair
```

## Production patterns
- Browser: cookies. Other clients: short-lived JWTs from an identity provider; the API validates issuer, audience, lifetime, algorithm.
- Asymmetric keys in Key Vault, rotated with `kid`; never share a symmetric key across services.
- Refresh tokens: opaque, hashed at rest, rotated on use, family revoked on reuse, revoked on password change.
- One API, several schemes, selected by a policy scheme; authorization policies don't care which scheme authenticated.

## Mistakes
Wrong:
```csharp
o.TokenValidationParameters = new() { ValidateAudience = false, ValidateIssuer = false };
```
Right: validate issuer and audience always.

Wrong: 30-day access tokens.
Right: 5–15 minute access tokens + rotating refresh tokens.

## Check yourself
1. Why are cookies preferred over JWTs for the Next.js browser app here?
2. What does audience validation protect against?
3. How do you detect a stolen refresh token?

<details><summary>Answers</summary>

1. `HttpOnly` cookies aren't readable by JavaScript, sessions can be revoked immediately, and the same-origin `/api` proxy makes cookies simple; JWTs in the browser have to be stored somewhere XSS can reach.
2. Tokens issued for a different API (another audience) being accepted by yours.
3. Rotation with reuse detection: if a refresh token that was already used is presented again, someone else has a copy; revoke the whole family.
</details>

## Sources
- [Configure JWT bearer authentication](https://learn.microsoft.com/aspnet/core/security/authentication/configure-jwt-bearer-authentication)
- [Policy schemes](https://learn.microsoft.com/aspnet/core/security/authentication/policyschemes)
- [OAuth 2.0 Security Best Current Practice (RFC 9700)](https://www.rfc-editor.org/rfc/rfc9700)
- [OAuth 2.0 for Browser-Based Apps (BFF)](https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/)
- [OWASP — JSON Web Token Cheat Sheet (Java examples, concepts apply)](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
