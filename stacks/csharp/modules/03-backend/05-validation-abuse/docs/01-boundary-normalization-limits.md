---
title: Validating at the boundary, normalization, limits, and over-posting
tech: ASP.NET Core 10 validation, FluentValidation, Kestrel, System.Text.Json, Regex
version: ASP.NET Core 10, FluentValidation 12.x
date: 2026-11-09
covers: [1, 2, 3, 4, 9]
---
# Validating at the boundary, normalization, limits, and over-posting
[← Overview](00-overview.md)

## Why it matters
- Two accounts exist for `Ada@Shop.test` and `ada@shop.test `; password resets go to the wrong one.
- A product search accepts a user-supplied regex; `(a+)+$` against a long string pins a CPU core for minutes (ReDoS).
- A JSON body with 200,000 order lines is accepted; memory spikes and the pod is OOM-killed.
- A customer sends `"isAdmin": true` in a profile update and becomes an admin, because the endpoint bound to the entity.

## Concepts

### Validate everything at the boundary
| Input | Validate |
|:--|:--|
| body | required fields, types, lengths, ranges, formats, collection sizes, nested objects |
| route / query | types (binding), ranges (`limit` 1–100), allowlisted enums (`sort`) |
| headers | `Idempotency-Key` format, `Content-Type`, custom headers |
| files | size, count, type by content (magic bytes), name |
| identity | the user may act on this resource (authorization, 04-auth) |

Validate shape at the edge, then pass **typed, trusted objects** inward. Domain objects still guard their invariants (`Order.AddLine` rejects quantity ≤ 0) and the database has constraints. Three layers, three purposes.

### Validation tools in ASP.NET Core
| Tool | Use |
|:--|:--|
| DataAnnotations + `AddValidation()` | field rules on request records; appear in OpenAPI |
| `IValidatableObject` | cross-field rules inside the type |
| FluentValidation + endpoint filter | conditional, collection, async rules (02-api-design lesson 03) |
| custom binding (`TryParse`) | value objects: `Sku`, `Email`, `PostalCode` |
| domain methods | invariants |
| DB constraints | final guard |

### Normalization and canonicalization
Normalize **before** validating and comparing.
| Value | Normalize |
|:--|:--|
| all text | trim; Unicode NFC (`s.Normalize(NormalizationForm.FormC)`); remove control/invisible characters where not allowed |
| email | trim; lowercase (at least the domain); Identity stores `NormalizedEmail` via `ILookupNormalizer` |
| usernames/handles | case-fold; reject confusable/mixed-script names for impersonation-prone fields |
| URLs | `Uri.TryCreate(..., UriKind.Absolute)`, scheme allowlist, lowercase host |
| phone numbers | E.164 (`+905551234567`) with libphonenumber-csharp |
| postal codes, SKUs | uppercase, strip spaces |
| money | `decimal` with a max scale; reject more than 2 decimals for EUR |

### Size and complexity limits
| Limit | Where |
|:--|:--|
| request body | Kestrel `MaxRequestBodySize` (30 MB default) → lower globally; `[RequestSizeLimit]` per endpoint |
| forms/uploads | `FormOptions.MultipartBodyLengthLimit`, `ValueCountLimit` |
| JSON depth | `JsonSerializerOptions.MaxDepth` (64 default) |
| ⭐ collections | `[MaxLength(50)]` on lists / FluentValidation `.Must(l => l.Count <= 50)` |
| ⭐ strings | `[MaxLength]` on every string; DB column lengths match |
| page sizes | clamp `limit` (02-api-design lesson 04) |
| time | request timeouts, SQL command timeouts |
| ⭐ regex | `new Regex(p, opts, TimeSpan.FromMilliseconds(100))` or `RegexOptions.NonBacktracking`; source-generated `[GeneratedRegex]` for your patterns; never run user-supplied patterns with backtracking |
| headers | Kestrel `MaxRequestHeadersTotalSize` |

### Mass assignment / over-posting
Never bind request bodies to entities. Request DTOs contain only what the caller may set; mapping is explicit. Separate DTOs for admin and customer operations. `[JsonIgnore]` on entity properties is not a defense (another endpoint will forget).

## Example
`src/Shop.Api/Features/Account/UpdateProfile.cs`
```csharp
using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.RegularExpressions;

public sealed partial record UpdateProfileRequest(
    [property: Required, MaxLength(100)] string DisplayName,
    [property: MaxLength(20)] string? Phone,
    [property: MaxLength(500), Url] string? Website) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext _)
    {
        if (Phone is not null && !E164().IsMatch(Phone))
            yield return new ValidationResult("Use international format, e.g. +905551234567.", [nameof(Phone)]);
    }

    [GeneratedRegex(@"^\+[1-9]\d{7,14}$", RegexOptions.None, matchTimeoutMilliseconds: 100)]
    private static partial Regex E164();
}

public static class Normalize
{
    public static string Text(string s) =>
        new string(s.Normalize(NormalizationForm.FormC).Trim().Where(c => !char.IsControl(c)).ToArray());

    public static string Email(string s) => Text(s).ToLowerInvariant();
}

// endpoint: only DisplayName, Phone, Website can change — no IsAdmin, no Email here
app.MapPut("/me/profile", async (UpdateProfileRequest body, ClaimsPrincipal me, ShopDb db, CancellationToken ct) =>
{
    var userId = me.GetUserId();
    var rows = await db.Users.Where(u => u.Id == userId).ExecuteUpdateAsync(s => s
        .SetProperty(u => u.DisplayName, Normalize.Text(body.DisplayName))
        .SetProperty(u => u.PhoneNumber, body.Phone)
        .SetProperty(u => u.Website, body.Website), ct);
    return rows == 1 ? Results.NoContent() : Results.NotFound();
});
```
`src/Shop.Api/Program.cs` (limits)
```csharp
builder.WebHost.ConfigureKestrel(k =>
{
    k.Limits.MaxRequestBodySize = 1 * 1024 * 1024;          // 1 MB for JSON APIs
    k.Limits.MaxRequestHeadersTotalSize = 16 * 1024;
});
builder.Services.Configure<FormOptions>(o => { o.MultipartBodyLengthLimit = 10 * 1024 * 1024; o.ValueCountLimit = 200; });
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.MaxDepth = 32);
```

## Production patterns
- Request DTOs with lengths and ranges on **every** field and collection; database column sizes match.
- A small `Normalize` helper used by all endpoints that store or compare user text.
- Strict global body limits, raised per endpoint (uploads go directly to Blob Storage, 02-frontend/10).
- Source-generated regexes with timeouts; no user-supplied regex with backtracking.

## Mistakes
Wrong:
```csharp
app.MapPut("/me", async (AppUser body, ShopDb db) => { db.Update(body); await db.SaveChangesAsync(); });
```
Right: a DTO with only editable fields and explicit `SetProperty` mapping.

Wrong: `new Regex(userInput).IsMatch(text)`.
Right: no user patterns, or `RegexOptions.NonBacktracking` + timeout.

## Check yourself
1. Why normalize before validating?
2. What prevents a client from sending 200,000 order lines?
3. Which three layers protect a business invariant like "quantity between 1 and 1000"?

<details><summary>Answers</summary>

1. So equivalent inputs (case, whitespace, Unicode forms) are compared and validated the same way, avoiding duplicates and bypasses.
2. A max length on the collection (validation), plus body size limits in Kestrel and JSON depth limits.
3. Request validation (DataAnnotations/FluentValidation), the domain method's guard, and a database `CHECK` constraint.
</details>

## Sources
- [Minimal API validation](https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis#validation)
- [OWASP — Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [Regex best practices (timeouts, NonBacktracking)](https://learn.microsoft.com/dotnet/standard/base-types/best-practices-regex)
- [Unicode normalization (String.Normalize)](https://learn.microsoft.com/dotnet/api/system.string.normalize)
- [Kestrel limits](https://learn.microsoft.com/aspnet/core/fundamentals/servers/kestrel/options)
- [OWASP — Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
