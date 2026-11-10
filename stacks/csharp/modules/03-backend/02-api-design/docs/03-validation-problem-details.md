---
title: Validation and Problem Details
tech: ASP.NET Core 10 validation, FluentValidation, Problem Details
version: ASP.NET Core 10, FluentValidation 12.x
date: 2026-11-09
covers: [5, 6]
---
# Validation and Problem Details
[← Overview](00-overview.md)

## Why it matters
- An order with `quantity: -3` reaches the database; refunds are calculated on negative totals.
- Validation errors come back as `{"error":"bad input"}` from one endpoint and `"Quantity invalid"` as plain text from another; the frontend can't map either to fields.
- A 500 response includes the SQL exception message and the server's file paths.

## Concepts

### Built-in Minimal API validation (.NET 10)
`builder.Services.AddValidation()` turns on validation of endpoint parameters using DataAnnotations (`[Required]`, `[Range]`, `[MaxLength]`, `[RegularExpression]`, `[EmailAddress]`, custom `ValidationAttribute`s) and `IValidatableObject`. A source generator finds your types at build time. Invalid input returns **400** with `HttpValidationProblemDetails` before your handler runs. Disable for one endpoint with `.DisableValidation()`.

### FluentValidation for richer rules
| Use DataAnnotations | Use FluentValidation |
|:--|:--|
| simple field constraints that should appear in OpenAPI (and Orval's Zod) | conditional rules, cross-field rules, collections of items, async checks, reusable rule sets |

FluentValidation runs where you call it: an endpoint filter for a group is a clean way.
```csharp
public sealed class CreateOrderValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.Lines).NotEmpty().WithMessage("Add at least one item.");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.Sku).NotEmpty().MaximumLength(20);
            line.RuleFor(l => l.Quantity).InclusiveBetween(1, 1000);
        });
        RuleFor(x => x.DeliveryDate).GreaterThan(_ => DateOnly.FromDateTime(DateTime.UtcNow)).When(x => x.DeliveryDate is not null);
    }
}
```
Register with `services.AddValidatorsFromAssemblyContaining<CreateOrderValidator>()` (FluentValidation.DependencyInjectionExtensions).

### 400, 409, 422
| Status | Use in this API |
|:--|:--|
| 400 | ⭐ malformed JSON, wrong types, field validation failures (ASP.NET Core's default) |
| 409 | conflicts with current state (already shipped, duplicate email, version conflict without ETags) |
| 422 | well-formed and valid fields, but a business rule rejects it (coupon expired, delivery area not served) |

Pick a convention, document it (01-foundations/08), and apply it everywhere. Clients care most about consistency.

### Problem Details everywhere
| Setup | Effect |
|:--|:--|
| ⭐ `AddProblemDetails()` | `IProblemDetailsService` + default writer; adds `traceId` |
| `UseExceptionHandler()` | unhandled exceptions → 500 Problem Details (no stack in Production) |
| `UseStatusCodePages()` | empty error responses (404, 405) → Problem Details |
| `CustomizeProblemDetails` | add extensions (`instance`, `code`, environment-safe info) |
| `TypedResults.Problem(...)` / `TypedResults.ValidationProblem(errors)` | explicit responses |
| `IExceptionHandler` | domain exceptions → 409/422 with `code` (lesson 01) |

## Example
`src/Shop.Api/Validation/FluentValidationFilter.cs`
```csharp
using FluentValidation;

namespace Shop.Api.Validation;

public sealed class FluentValidationFilter<T>(IValidator<T> validator) : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var arg = ctx.Arguments.OfType<T>().FirstOrDefault();
        if (arg is null) return await next(ctx);

        var result = await validator.ValidateAsync(arg, ctx.HttpContext.RequestAborted);
        return result.IsValid
            ? await next(ctx)
            : TypedResults.ValidationProblem(result.ToDictionary());     // same shape as built-in validation
    }
}

public static class ValidationExtensions
{
    public static RouteHandlerBuilder Validate<T>(this RouteHandlerBuilder b) where T : class =>
        b.AddEndpointFilter<FluentValidationFilter<T>>().ProducesValidationProblem();
}
```
`src/Shop.Api/Program.cs` (excerpt)
```csharp
builder.Services.AddValidation();                                       // DataAnnotations on parameters
builder.Services.AddValidatorsFromAssemblyContaining<Program>();        // FluentValidation validators
builder.Services.AddProblemDetails(o => o.CustomizeProblemDetails = ctx =>
{
    ctx.ProblemDetails.Instance = $"{ctx.HttpContext.Request.Method} {ctx.HttpContext.Request.Path}";
});

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapPost("/orders", CreateOrder).Validate<CreateOrderRequest>();
```
`src/Shop.Api/Features/Orders/CreateOrderRequest.cs`
```csharp
using System.ComponentModel.DataAnnotations;

public sealed record CreateOrderRequest(
    [property: Required, MinLength(1), MaxLength(50)] IReadOnlyList<OrderLineRequest> Lines,
    [property: MaxLength(500)] string? Note,
    DateOnly? DeliveryDate);

public sealed record OrderLineRequest(
    [property: Required, MaxLength(20)] string Sku,
    [property: Range(1, 1000, ErrorMessage = "Quantity must be between 1 and 1000.")] int Quantity);
```
Response for an invalid request:
```json
{ "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1", "title": "One or more validation errors occurred.",
  "status": 400, "errors": { "Lines[0].Quantity": ["Quantity must be between 1 and 1000."] },
  "traceId": "00-4f2a9c1e…-01" }
```

## Production patterns
- Shape constraints as DataAnnotations on request records (they flow into OpenAPI and the frontend's generated Zod); complex rules in FluentValidation.
- Validation results always as `ValidationProblemDetails`; errors keyed by property path.
- Friendly, user-facing messages for common rules; the frontend shows them as-is (02-frontend/10-forms).
- Never leak exception details in Production; log them with the `traceId` the client receives.

## Mistakes
Wrong: validating inside handlers with ad-hoc responses.
```csharp
if (body.Quantity <= 0) return Results.BadRequest("Quantity invalid");
```
Right: attributes / validators + Problem Details.

Wrong: `UseDeveloperExceptionPage()` outside Development.
Right: `UseExceptionHandler()` + `AddProblemDetails()`.

## Check yourself
1. What does `AddValidation()` validate, and when?
2. Which rules belong in DataAnnotations rather than FluentValidation in this stack?
3. What does `UseStatusCodePages()` add?

<details><summary>Answers</summary>

1. DataAnnotations and `IValidatableObject` on Minimal API endpoint parameters (including nested objects), before the handler runs; failures return 400 `HttpValidationProblemDetails`.
2. Simple field constraints (required, length, range, pattern), because they appear in the OpenAPI schema and the generated frontend Zod schemas.
3. Problem Details bodies for error status codes that would otherwise have empty bodies (404, 405, 415…).
</details>

## Sources
- [Minimal API validation (.NET 10)](https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis#validation)
- [Problem details in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/error-handling-api)
- [FluentValidation documentation](https://docs.fluentvalidation.net/)
- [RFC 9457 — Problem Details](https://www.rfc-editor.org/rfc/rfc9457)
- [Endpoint filters](https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/min-api-filters)
