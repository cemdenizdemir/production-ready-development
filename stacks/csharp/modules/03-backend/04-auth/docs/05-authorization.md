---
title: "Authorization: roles, claims, policies, and resources"
tech: ASP.NET Core 10 authorization
version: ASP.NET Core 10
date: 2026-11-09
covers: [8]
---
# Authorization: roles, claims, policies, and resources
[← Overview](00-overview.md)

## Why it matters
- `[Authorize(Roles = "admin")]` is copied to 40 endpoints; adding a "support" role that may refund but not delete means editing all of them, and three are missed.
- A support agent can refund any amount because the rule "support may refund up to €100" lives only in the admin UI.
- `GET /orders/{id}` checks that the user is logged in but not that the order is theirs.

## Concepts

### The building blocks
| Concept | What it is | Example |
|:--|:--|:--|
| role | a coarse group claim | `admin`, `support`, `customer` |
| claim | a fact about the identity | `sub`, `email_verified`, `refund_limit=100`, `tenant=42` |
| ⭐ policy | a named rule made of requirements | `CanRefund`, `OrderOwner`, `AdminOnly` |
| requirement | a condition (`IAuthorizationRequirement`) | `RefundLimitRequirement` |
| handler | evaluates a requirement (`AuthorizationHandler<TReq>` or `<TReq, TResource>`) | checks claim vs refund amount |
| ⭐ resource-based | decision depends on the object | is this order the user's? |
| fallback policy | applies when an endpoint has no authorization metadata | require authenticated user |
| `IClaimsTransformation` | add/derive claims after authentication | load permissions from DB (cache it) |

Endpoints reference **policies**, not roles. Policies can then change (add a role, add an MFA requirement) without touching endpoints.

### RBAC and permissions
| Model | Good for | Note |
|:--|:--|:--|
| roles (RBAC) | small number of stable job functions | roles → policies |
| permissions | fine-grained actions (`orders:refund`, `products:edit`) | roles map to permission sets; policies check permissions |
| attribute/relationship-based (ABAC/ReBAC) | ownership, tenancy, hierarchies | resource-based handlers |

### Resource-based authorization
Load the resource, then ask `IAuthorizationService.AuthorizeAsync(user, resource, "PolicyName")`. Or include ownership in the query (`WHERE CustomerId = @me`), which is cheaper and avoids loading others' data (01-foundations/06). Use handlers when the rule is more than ownership (support agents in the same region, order not yet shipped, amount under the agent's limit).

## Example
`src/Shop.Api/Auth/Policies.cs`
```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

public static class Policies
{
    public const string AdminOnly = nameof(AdminOnly);
    public const string CanRefund = nameof(CanRefund);
    public const string OrderOwnerOrSupport = nameof(OrderOwnerOrSupport);

    public static IServiceCollection AddShopPolicies(this IServiceCollection services)
    {
        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
            .AddPolicy(AdminOnly, p => p.RequireRole("admin").RequireClaim("amr", "mfa"))       // admins must have used MFA
            .AddPolicy(CanRefund, p => p.RequireRole("support", "admin").AddRequirements(new RefundLimitRequirement()))
            .AddPolicy(OrderOwnerOrSupport, p => p.AddRequirements(new OrderAccessRequirement()));

        services.AddSingleton<IAuthorizationHandler, RefundLimitHandler>();
        services.AddSingleton<IAuthorizationHandler, OrderAccessHandler>();
        return services;
    }
}

public sealed class RefundLimitRequirement : IAuthorizationRequirement;
public sealed class OrderAccessRequirement : IAuthorizationRequirement;

public sealed class RefundLimitHandler : AuthorizationHandler<RefundLimitRequirement, RefundRequest>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext ctx, RefundLimitRequirement req, RefundRequest refund)
    {
        if (ctx.User.IsInRole("admin")) { ctx.Succeed(req); return Task.CompletedTask; }
        var limit = decimal.TryParse(ctx.User.FindFirstValue("refund_limit"), out var l) ? l : 0m;
        if (refund.Amount <= limit) ctx.Succeed(req);
        return Task.CompletedTask;                                // not calling Succeed = not authorized by this handler
    }
}

public sealed class OrderAccessHandler : AuthorizationHandler<OrderAccessRequirement, Order>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext ctx, OrderAccessRequirement req, Order order)
    {
        var userId = ctx.User.FindFirstValue("sub");
        if (order.CustomerId.ToString() == userId || ctx.User.IsInRole("support")) ctx.Succeed(req);
        return Task.CompletedTask;
    }
}
```
`src/Shop.Api/Features/Refunds/RefundEndpoints.cs`
```csharp
app.MapPost("/orders/{id:guid}/refunds", async (Guid id, RefundRequest body, ClaimsPrincipal user,
    IAuthorizationService auth, OrderService orders, CancellationToken ct) =>
{
    var order = await orders.GetForUpdateAsync(id, ct);
    if (order is null) return Results.NotFound();

    if (!(await auth.AuthorizeAsync(user, order, Policies.OrderOwnerOrSupport)).Succeeded) return Results.NotFound();   // hide existence
    if (!(await auth.AuthorizeAsync(user, body, Policies.CanRefund)).Succeeded) return Results.Forbid();

    await orders.RefundAsync(order, body.Amount, ct);
    return Results.NoContent();
}).RequireAuthorization(p => p.RequireRole("support", "admin"));

app.MapGet("/health", () => "ok").AllowAnonymous();
app.MapGroup("/admin").RequireAuthorization(Policies.AdminOnly).MapAdminEndpoints();
```

## Production patterns
- Fallback policy = authenticated; anonymous endpoints are explicit.
- Endpoints and groups reference policy names; policies are defined in one file and unit-tested.
- Ownership checks in queries for user data; resource-based handlers for richer rules.
- Integration tests for every policy: allowed role, denied role, other user's resource (expect 404/403).

## Mistakes
Wrong:
```csharp
if (user.IsInRole("admin") || user.IsInRole("support") || user.FindFirst("refund")?.Value == "true") { ... }   // scattered in handlers
```
Right: named policies with requirements and handlers.

Wrong: authorization only in the frontend (hidden buttons).
Right: the API enforces every rule; the UI just reflects it.

## Check yourself
1. Why reference policies instead of roles on endpoints?
2. What happens if no handler calls `Succeed` for a requirement?
3. When is resource-based authorization needed instead of a plain policy?

<details><summary>Answers</summary>

1. Rules can change in one place (add a role, require MFA, check a permission) without editing every endpoint.
2. The requirement isn't met, so the policy fails (403, or 401 if unauthenticated).
3. When the decision depends on the specific object (owner, status, amount, tenant), which is only known after loading it.
</details>

## Sources
- [Policy-based authorization](https://learn.microsoft.com/aspnet/core/security/authorization/policies)
- [Resource-based authorization](https://learn.microsoft.com/aspnet/core/security/authorization/resourcebased)
- [Role-based authorization](https://learn.microsoft.com/aspnet/core/security/authorization/roles)
- [Claims transformation](https://learn.microsoft.com/aspnet/core/security/authentication/claims)
- [OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
