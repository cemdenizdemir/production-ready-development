---
title: Documenting API behavior and XML doc comments
tech: Microsoft.AspNetCore.OpenApi, XML doc comments, Problem Details
version: ASP.NET Core 10, C# 14
date: 2026-11-09
covers: [7, 9]
---
# Documenting API behavior and XML doc comments
[← Overview](00-overview.md)

## Why it matters
- The docs list every endpoint, but nowhere say that `POST /orders` accepts an `Idempotency-Key`. Mobile clients retry without one and create duplicate orders.
- A field is removed without warning; a partner's integration breaks on a Friday. The deprecation was "announced" in a Slack channel the partner isn't in.
- Public methods in `Shop.Domain` have no comments; the meaning of `Order.Total` (gross or net? with shipping?) is guessed differently by three developers.

## Concepts

### What the API reference must say beyond shapes
| Behavior | Where to document it |
|:--|:--|
| ⭐ errors | Problem Details responses per operation; a shared page listing `type` URIs and codes |
| ⭐ authentication | security schemes + which operations require which policy |
| pagination | `cursor`/`limit` parameters, max page size, `next` link in the response |
| ⭐ idempotency | which methods accept `Idempotency-Key`, how long keys are kept, what a replay returns |
| rate limits | `429` + `Retry-After`, limits per policy |
| concurrency | `ETag` / `If-Match`, `412` responses |
| deprecations | `deprecated: true` on the operation, `Deprecation` and `Sunset` headers, date in the changelog |
| versioning | how versions are selected and how long old ones live |

### Problem Details as a contract
```json
{
  "type": "https://docs.shop.test/errors/order-already-shipped",
  "title": "Order already shipped",
  "status": 409,
  "detail": "Order 1042 shipped on 2026-11-08 and can't be cancelled.",
  "instance": "/orders/1042/cancel",
  "traceId": "00-8f2c...-01",
  "code": "order.already_shipped"
}
```
Document each `type`/`code` once; clients switch on `code`, not on `title` text.

### XML doc comments
```csharp
/// <summary>Total the customer pays, in the order's currency, including tax and shipping.</summary>
/// <remarks>Rounded half away from zero to 2 decimals, matching Stripe (see ADR-0012).</remarks>
public decimal Total { get; private set; }
```
| Tag | Use |
|:--|:--|
| `<summary>` | one sentence: what it is or does |
| `<remarks>` | why, constraints, links |
| `<param name="x">` / `<returns>` | non-obvious parameters and results |
| `<exception cref="DomainException">` | what callers must handle |
| `<example>` / `<code>` | short usage |
| `<see cref="..."/>` / `<inheritdoc/>` | cross-references, reuse docs from interfaces |
| `<response code="404">` | on endpoint handlers: response descriptions in OpenAPI |

With `<GenerateDocumentationFile>true</GenerateDocumentationFile>`, .NET 10 copies XML comments on endpoint handler methods and on DTO types/properties into the OpenAPI document. Handlers must be methods (not inline lambdas) for comments to attach.

Comment rule from 05-code-quality: comments explain **why** or **contract**, never restate the code. Public APIs of shared projects get `<summary>`; internal code gets comments only where intent isn't obvious. Keep `CS1591` (missing XML comment) suppressed unless the project is a published library.

### Deprecating an endpoint or field
1. Mark it: `.WithMetadata(new ObsoleteAttribute())` or an operation transformer that sets `deprecated: true`; document the replacement.
2. Send `Deprecation: @1767225600` and `Sunset: Mon, 01 Feb 2027 00:00:00 GMT` headers (RFC 9745 / RFC 8594) and a `Link` to the docs.
3. Changelog entry with the removal date; tell consumers directly.
4. Log or meter calls to the deprecated endpoint; remove when traffic is zero or the date passes.

## Example
`src/Shop.Api/Endpoints/OrderEndpoints.cs`
```csharp
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Shop.Api.Endpoints;

public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/orders").WithTags("Orders").RequireAuthorization();
        g.MapPost("/", CreateOrder).WithName("CreateOrder").ProducesValidationProblem();
        g.MapPost("/{id:int}/cancel", CancelOrder).WithName("CancelOrder");
        g.MapGet("/", ListOrdersOffset).WithName("ListOrdersOffset")
            .WithMetadata(new ObsoleteAttribute("Use cursor pagination. Removal 2027-02-01."))
            .AddEndpointFilter(async (ctx, next) =>
            {
                ctx.HttpContext.Response.Headers["Deprecation"] = "@1767225600";
                ctx.HttpContext.Response.Headers["Sunset"] = "Mon, 01 Feb 2027 00:00:00 GMT";
                return await next(ctx);
            });
    }

    /// <summary>Places an order.</summary>
    /// <remarks>
    /// Send an <c>Idempotency-Key</c> header (UUID). Retries with the same key within 24 hours
    /// return the original response instead of creating another order.
    /// </remarks>
    /// <param name="body">Line items; 1–50 lines, quantity 1–1000 each.</param>
    /// <param name="idempotencyKey">Client-generated key for safe retries.</param>
    /// <response code="201">Order created. <c>Location</c> points to it.</response>
    /// <response code="409">Same key reused with a different body.</response>
    private static Created<OrderDto> CreateOrder(
        CreateOrderRequest body,
        [FromHeader(Name = "Idempotency-Key")] Guid? idempotencyKey) =>
        TypedResults.Created("/orders/1", new OrderDto(1, "Placed", 20m));

    /// <summary>Cancels an order that hasn't shipped.</summary>
    /// <response code="204">Cancelled.</response>
    /// <response code="404">Not found, or not yours.</response>
    /// <response code="409">Already shipped (<c>code: order.already_shipped</c>).</response>
    private static Results<NoContent, NotFound, ProblemHttpResult> CancelOrder(int id) => TypedResults.NoContent();

    /// <summary>Lists orders with offset pagination. Deprecated: use <c>GET /orders/search?cursor=</c>.</summary>
    private static Ok<OrderDto[]> ListOrdersOffset(int page = 1) => TypedResults.Ok(Array.Empty<OrderDto>());
}

/// <summary>Request to place an order.</summary>
/// <param name="Lines">Items to buy.</param>
public sealed record CreateOrderRequest(IReadOnlyList<OrderLine> Lines);

/// <param name="Sku">Product code, e.g. <c>COF-ETH-250</c>.</param>
/// <param name="Quantity">Units, 1–1000.</param>
public sealed record OrderLine(string Sku, int Quantity);

/// <param name="Id">Order id.</param>
/// <param name="Status">Placed, Paid, Shipped, Cancelled.</param>
/// <param name="Total">Gross total including tax and shipping.</param>
public sealed record OrderDto(int Id, string Status, decimal Total);
```

## Production patterns
- An "API conventions" page (errors, auth, pagination, idempotency, rate limits, versioning, deprecation) linked from the OpenAPI `info.description`.
- Every operation lists its error responses; integration tests assert the documented status codes.
- Deprecations are visible in three places: the document (`deprecated`), response headers, and the changelog.
- XML comments on DTOs describe units, formats, and ranges; those are what client developers need.

## Mistakes
Wrong: comments that repeat names.
```csharp
/// <summary>Gets the order.</summary>
public Order GetOrder(int id)
```
Right: comment only what the signature can't say (404 semantics, ownership, side effects), or nothing.

Wrong: removing a field in the same release that deprecates it.
Right: deprecate with a date, measure usage, remove later.

## Check yourself
1. Why should clients switch on a Problem Details `code` and not on `title`?
2. What must be true for an XML comment on a handler to appear in the OpenAPI document?
3. Which two response headers announce a deprecation and a removal date?

<details><summary>Answers</summary>

1. `title` is human text and may change or be translated; `code` is a stable contract.
2. `GenerateDocumentationFile` is on, and the handler is a named method (not an inline lambda) in the project.
3. `Deprecation` and `Sunset`.
</details>

## Sources
- [RFC 9457 — Problem Details](https://www.rfc-editor.org/rfc/rfc9457)
- [OpenAPI XML documentation comment support (.NET 10)](https://learn.microsoft.com/aspnet/core/fundamentals/openapi/openapi-comments)
- [C# XML documentation comments](https://learn.microsoft.com/dotnet/csharp/language-reference/xmldoc/)
- [RFC 9745 — Deprecation header](https://www.rfc-editor.org/rfc/rfc9745) · [RFC 8594 — Sunset header](https://www.rfc-editor.org/rfc/rfc8594)
- [Zalando RESTful API guidelines — deprecation](https://opensource.zalando.com/restful-api-guidelines/#deprecation)
