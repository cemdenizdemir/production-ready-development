---
title: REST design, app structure, and the middleware pipeline
tech: ASP.NET Core 10 Minimal APIs
version: ASP.NET Core 10
date: 2026-11-09
covers: [1, 2]
---
# REST design, app structure, and the middleware pipeline
[← Overview](00-overview.md)

## Why it matters
- Endpoints like `POST /api/getOrdersForCustomer` and `GET /api/deleteOrder?id=7` make caching, retries, and permissions impossible to reason about.
- `Program.cs` grows to 900 lines of inline lambdas; nobody can find the cancel-order endpoint.
- `UseAuthorization()` placed before `UseRouting()`-dependent features or `UseCors()` after auth: preflights fail with 401 and the frontend breaks only in production.

## Concepts

### Resource-oriented REST
| Action | Method + path | Success |
|:--|:--|:--|
| list orders | `GET /orders?status=paid&cursor=…` | 200 |
| get one | `GET /orders/{id}` | 200 / 404 |
| create | `POST /orders` | 201 + `Location` |
| replace | `PUT /orders/{id}/address` | 200 / 204 |
| partial update | `PATCH /orders/{id}` | 200 / 204 |
| delete | `DELETE /addresses/{id}` | 204 |
| action that isn't CRUD | `POST /orders/{id}/cancel` | 202 / 204 / 409 |
| nested ownership | `GET /me/orders` | 200 |

Rules: plural nouns, IDs in paths, filters in query strings, verbs only for real actions (as sub-resources), status codes from 01-foundations/02. Keep URLs lowercase with hyphens.

### Structuring a Minimal API
| Concern | Where |
|:--|:--|
| `Program.cs` | composition: services, middleware, `app.MapXxxEndpoints()` calls |
| ⭐ endpoint files per feature | `Features/Orders/OrderEndpoints.cs` with a `MapOrderEndpoints` extension |
| ⭐ route groups | `app.MapGroup("/orders").WithTags("Orders").RequireAuthorization()` |
| handlers | named static methods (better OpenAPI, XML comments, testable) |
| application services | business operations called by handlers |
| endpoint filters | cross-cutting per endpoint/group (validation, idempotency) |
| ⭐ `IExceptionHandler` | map exceptions to Problem Details in one place |

### The middleware pipeline
Middleware runs in the order registered for requests and in reverse for responses.
```mermaid
flowchart LR
  A[UseExceptionHandler] --> B[UseHsts / UseHttpsRedirection]
  B --> C[UseForwardedHeaders*]
  C --> D[UseRouting (implicit)]
  D --> E[UseCors]
  E --> F[UseAuthentication]
  F --> G[UseAuthorization]
  G --> H[UseRateLimiter]
  H --> I[UseRequestTimeouts / UseOutputCache]
  I --> J[Endpoints]
```
\* `UseForwardedHeaders` goes first in practice (before everything that reads scheme/IP).

| Rule | Why |
|:--|:--|
| exception handler first | catches exceptions from everything after it |
| forwarded headers early | auth, redirects, rate limits see real values |
| CORS before auth | preflight `OPTIONS` must not need credentials |
| authentication before authorization | identity before decisions |
| rate limiter after routing/auth | endpoint-specific policies, per-user partitions |
| `WebApplication` adds `UseRouting` at the start and endpoints at the end automatically | call `UseRouting()` explicitly only when order requires |

Custom middleware: `app.Use(async (ctx, next) => { …; await next(ctx); })` or a class with `InvokeAsync(HttpContext)`. Endpoint filters are usually better for logic tied to specific endpoints.

## Example
`src/Shop.Api/Program.cs`
```csharp
using Shop.Api.Errors;
using Shop.Api.Features.Orders;
using Shop.Api.Features.Catalog;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddValidation();
builder.Services.AddOpenApi();
builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization();
builder.Services.AddCors(o => o.AddPolicy("web", p => p.WithOrigins("https://localhost:3000").AllowCredentials().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddOrderFeature();                 // registers OrderService, validators, etc.

var app = builder.Build();

app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseCors("web");
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();
app.MapCatalogEndpoints();
app.MapOrderEndpoints();
app.Run();
```
`src/Shop.Api/Features/Orders/OrderEndpoints.cs`
```csharp
using Microsoft.AspNetCore.Http.HttpResults;

namespace Shop.Api.Features.Orders;

public static class OrderEndpoints
{
    public static IEndpointRouteBuilder MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/orders").WithTags("Orders").RequireAuthorization();
        g.MapGet("/{id:guid}", GetOrder).WithName("GetOrder");
        g.MapPost("/", CreateOrder).WithName("CreateOrder");
        g.MapPost("/{id:guid}/cancel", CancelOrder).WithName("CancelOrder");
        return app;
    }

    private static async Task<Results<Ok<OrderDto>, NotFound>> GetOrder(Guid id, OrderService orders, CancellationToken ct) =>
        await orders.FindAsync(id, ct) is { } dto ? TypedResults.Ok(dto) : TypedResults.NotFound();

    private static async Task<Created<OrderDto>> CreateOrder(CreateOrderRequest body, OrderService orders, CancellationToken ct)
    {
        var dto = await orders.PlaceAsync(body, ct);
        return TypedResults.Created($"/orders/{dto.Id}", dto);
    }

    private static async Task<NoContent> CancelOrder(Guid id, OrderService orders, CancellationToken ct)
    {
        await orders.CancelAsync(id, ct);                // throws OrderAlreadyShippedException → 409 via handler
        return TypedResults.NoContent();
    }
}
```
`src/Shop.Api/Errors/DomainExceptionHandler.cs`
```csharp
using Microsoft.AspNetCore.Diagnostics;

public sealed class DomainExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        if (ex is not DomainException domain) return false;          // let the default handler log and return 500
        ctx.Response.StatusCode = domain.StatusCode;                    // e.g. 409, 422
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = ctx,
            Exception = ex,
            ProblemDetails = { Title = domain.Title, Detail = domain.Message, Type = $"https://docs.shop.test/errors/{domain.Code}",
                               Extensions = { ["code"] = domain.Code } },
        });
    }
}
```

## Production patterns
- One endpoint file per feature, one route group per resource, named handler methods.
- Handlers stay under ~15 lines: bind, call a service, map the result.
- A fixed middleware order documented in `Program.cs` comments; reviewers check it on every change.
- Domain exceptions carry a stable `code` and status; the exception handler is the only place that maps them to HTTP.

## Mistakes
Wrong: RPC-style URLs and wrong methods.
```text
GET /orders/delete?id=42
```
Right: `DELETE /orders/42` (or `POST /orders/42/cancel` for a business action).

Wrong: `try/catch` in every endpoint to build error responses.
Right: throw domain exceptions; `IExceptionHandler` + Problem Details map them once.

## Check yourself
1. Why must `UseCors` come before `UseAuthentication`/`UseAuthorization`?
2. When is a verb in a URL acceptable?
3. What does `IExceptionHandler.TryHandleAsync` returning `false` mean?

<details><summary>Answers</summary>

1. CORS preflight requests carry no credentials; if auth runs first they get 401/403 and the browser blocks the real request.
2. For actions that aren't plain CRUD on a resource, modeled as a sub-resource with POST (`/orders/{id}/cancel`).
3. This handler didn't handle the exception; the next handler (or the default behavior: log + 500 Problem Details) takes over.
</details>

## Sources
- [Minimal APIs — Route groups](https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/route-handlers#route-groups)
- [Middleware order](https://learn.microsoft.com/aspnet/core/fundamentals/middleware/#middleware-order)
- [Handle errors (IExceptionHandler)](https://learn.microsoft.com/aspnet/core/fundamentals/error-handling)
- [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md)
- [Zalando RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/)
