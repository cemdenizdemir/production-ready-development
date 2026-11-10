---
title: Access control, XSS, and CSRF
tech: ASP.NET Core 10 authorization, antiforgery, System.Text.Encodings.Web
version: ASP.NET Core 10
date: 2026-11-09
covers: [4, 5, 6]
---
# Access control, XSS, and CSRF
[← Overview](00-overview.md)

## Why it matters
- `GET /orders/1042` returns order 1042 to any logged-in user. A script walks IDs 1–200,000 and downloads every customer's address.
- `PUT /users/me` binds the request straight onto the `User` entity; a client sends `"isAdmin": true`.
- An order confirmation email inserts the customer's name into HTML unencoded; a name like `<img src=x onerror=...>` runs in the support team's mail client.
- A cookie-authenticated `POST /account/email` has no CSRF protection; a malicious site changes users' emails.

## Concepts

### Broken access control
| Failure | Example | Control |
|:--|:--|:--|
| missing authorization | endpoint without policy | fallback policy (lesson 01) |
| ⭐ IDOR (object-level) | `/orders/{id}` without owner check | query by id **and** owner, or resource-based authorization |
| function-level | non-admin calls admin endpoint | role/policy per endpoint group |
| ⭐ mass assignment / over-posting | binding to entities | bind to request DTOs with only allowed fields |
| tenant leaks | missing tenant filter | EF Core global query filters per tenant |
| guessable IDs as security | sequential ints | IDs are not secrets; still check ownership |
| open redirect | `?returnUrl=https://evil.test` | `Url.IsLocalUrl` / `LocalRedirect` |

Deny by default, check on the server for every request, and return **404** (not 403) for resources the user may not even know exist.

Two ways to check ownership:
```csharp
// 1. In the query (simple, efficient)
var order = await db.Orders.SingleOrDefaultAsync(o => o.Id == id && o.CustomerId == userId, ct);

// 2. Resource-based authorization (reusable rules, more complex policies)
var result = await auth.AuthorizeAsync(user, order, "OrderOwner");
```

### XSS and output encoding
| Context | ASP.NET Core default | Watch out |
|:--|:--|:--|
| JSON API responses | `application/json`, values escaped by System.Text.Json | never return user HTML with `text/html` |
| Razor / Blazor | HTML-encoded by default | `@Html.Raw`, `MarkupString` |
| HTML you build (emails, PDFs) | none | `HtmlEncoder.Default.Encode(value)` |
| URLs | | `UrlEncoder.Default.Encode`; validate schemes (`javascript:`) |
| JavaScript strings | | `JavaScriptEncoder.Default.Encode` |
| React frontend | escaped by default | `dangerouslySetInnerHTML` (02-frontend/11) |

Content Security Policy (CSP) is the second line: an API can send `default-src 'none'; frame-ancestors 'none'` because it never serves pages. The Next.js app sets its own nonce-based CSP (02-frontend/11-security).

### CSRF
CSRF happens when the browser **automatically** attaches credentials (cookies) to a request a different site triggered.
| Auth mechanism | CSRF risk | Defense |
|:--|:--|:--|
| ⭐ cookies (`SameSite=Lax`) | low for cross-site POST, but not zero (same-site subdomains, GET with side effects) | `SameSite` + antiforgery token or `Origin` check on unsafe methods |
| bearer token in `Authorization` header | none (browser doesn't attach it) | — |
| cookies with `SameSite=None` | high | antiforgery tokens required |

ASP.NET Core antiforgery:
- `builder.Services.AddAntiforgery(o => o.HeaderName = "X-XSRF-TOKEN")`, `app.UseAntiforgery()`.
- Minimal API endpoints that bind **forms** (`[FromForm]`, `IFormFile`) validate tokens automatically (.NET 8+).
- JSON endpoints called by an SPA with cookies: issue the token with `IAntiforgery.GetAndStoreTokens` (readable cookie), send it back in the header, validate with `IAntiforgery.ValidateRequestAsync` in an endpoint filter.
- Never change state on `GET`.

## Example
`src/Shop.Api/Endpoints/Orders.cs`
```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

public static class OrderEndpoints
{
    public static RouteGroupBuilder MapOrders(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/orders").RequireAuthorization();

        g.MapGet("/{id:int}", async Task<Results<Ok<OrderDto>, NotFound>> (int id, ClaimsPrincipal user, ShopDb db, CancellationToken ct) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var order = await db.Orders
                .Where(o => o.Id == id && o.CustomerId == userId)        // ownership in the query
                .Select(o => new OrderDto(o.Id, o.Status.ToString(), o.Total))
                .SingleOrDefaultAsync(ct);
            return order is null ? TypedResults.NotFound() : TypedResults.Ok(order);
        });

        g.MapPut("/{id:int}/notes", async (int id, UpdateNotes body, ClaimsPrincipal user, ShopDb db, CancellationToken ct) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var rows = await db.Orders
                .Where(o => o.Id == id && o.CustomerId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(o => o.Notes, body.Notes), ct);   // only Notes can change
            return rows == 0 ? Results.NotFound() : Results.NoContent();
        }).AddEndpointFilter<ValidateAntiforgeryFilter>();

        return g;
    }
}

public sealed record UpdateNotes(string Notes);                  // DTO: no Status, no Total, no CustomerId
public sealed record OrderDto(int Id, string Status, decimal Total);

public sealed class ValidateAntiforgeryFilter(Microsoft.AspNetCore.Antiforgery.IAntiforgery af) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        await af.ValidateRequestAsync(ctx.HttpContext);          // throws AntiforgeryValidationException → 400
        return await next(ctx);
    }
}
```
Encoding user data in an email:
```csharp
var safeName = HtmlEncoder.Default.Encode(customer.Name);
var html = $"<p>Thanks for your order, {safeName}!</p>";
```

## Production patterns
- Every query for user-owned data includes the owner (or tenant) in the `WHERE` clause; add integration tests that try another user's ID and expect 404.
- Request DTOs per use case; never bind entities. `ExecuteUpdateAsync` with explicit `SetProperty` makes allowed fields obvious.
- For multi-tenant apps, an EF Core global query filter on `TenantId` plus tests that bypass attempts fail.
- Prefer a same-origin frontend (Next.js proxying `/api`) with `SameSite=Lax` cookies + antiforgery header for unsafe methods.

## Mistakes
Wrong: trusting the ID alone.
```csharp
var order = await db.Orders.FindAsync(id);
```
Right: `Where(o => o.Id == id && o.CustomerId == userId)`.

Wrong: binding to the entity.
```csharp
app.MapPut("/users/me", async (User body, ShopDb db) => { db.Update(body); await db.SaveChangesAsync(); });
```
Right: a DTO with only the editable fields, mapped explicitly.

## Check yourself
1. Why return 404 instead of 403 for another user's order?
2. Does an API authenticated only with `Authorization: Bearer` headers need CSRF tokens?
3. Which ASP.NET Core endpoints validate antiforgery tokens automatically?

<details><summary>Answers</summary>

1. 403 confirms the resource exists; 404 reveals nothing.
2. No. Browsers don't attach the header automatically; CSRF relies on automatically sent credentials like cookies.
3. Minimal API endpoints that bind form data (`[FromForm]`, `IFormFile`), and MVC/Razor form posts with `[ValidateAntiForgeryToken]` or the global filter; JSON endpoints need explicit validation.
</details>

## Sources
- [Resource-based authorization](https://learn.microsoft.com/aspnet/core/security/authorization/resourcebased)
- [OWASP — Authorization Cheat Sheet (IDOR)](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
- [Prevent XSS in ASP.NET Core](https://learn.microsoft.com/aspnet/core/security/cross-site-scripting)
- [Prevent CSRF attacks in ASP.NET Core](https://learn.microsoft.com/aspnet/core/security/anti-request-forgery)
- [OWASP — CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
