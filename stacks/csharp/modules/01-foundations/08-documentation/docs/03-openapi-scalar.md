---
title: OpenAPI 3.1 with Microsoft.AspNetCore.OpenApi and Scalar
tech: Microsoft.AspNetCore.OpenApi, Microsoft.OpenApi 2.x, Scalar.AspNetCore
version: ASP.NET Core 10, Scalar.AspNetCore 2.x
date: 2026-11-09
covers: [5, 6, 12]
---
# OpenAPI 3.1 with Microsoft.AspNetCore.OpenApi and Scalar
[← Overview](00-overview.md)

## Why it matters
- The API docs are a hand-written wiki page that's three releases behind. The frontend team codes against fields that no longer exist.
- Every endpoint is documented as returning `200` with no body, so the generated TypeScript client has `unknown` everywhere and no error types.
- Interactive docs are public in production and list internal admin endpoints.

## Concepts

### How the document is generated
`Microsoft.AspNetCore.OpenApi` reads endpoint metadata at runtime (routes, parameter types, `TypedResults`, `Produces*`, attributes, XML comments) and builds an OpenAPI document. In .NET 10 it's **OpenAPI 3.1** by default.

```csharp
builder.Services.AddOpenApi();          // document "v1"
app.MapOpenApi();                       // GET /openapi/v1.json
app.MapOpenApi("/openapi/{documentName}.yaml");   // YAML too (.NET 10)
```
| Signal | Becomes |
|:--|:--|
| route template + constraints | path + parameter schemas |
| parameter types (`int id`, `[AsParameters] OrderQuery q`) | parameters and request body |
| ⭐ `TypedResults` / `Results<Ok<T>, NotFound>` | response codes and schemas, without extra metadata |
| `.Produces<T>(201)`, `.ProducesProblem(404)`, `.ProducesValidationProblem()` | extra responses |
| `.WithName("GetOrder")` | `operationId` (generated client method names) |
| `.WithSummary(...)`, `.WithDescription(...)`, `.WithTags(...)` | summary, description, grouping |
| `[Description("...")]` on parameters/properties | descriptions |
| DataAnnotations (`[Required]`, `[MaxLength]`, `[Range]`) | schema constraints |
| nullable annotations | `required` / nullable in schemas |
| XML doc comments (`/// <summary>`) | summaries and descriptions (.NET 10, needs `GenerateDocumentationFile`) |
| `.ExcludeFromDescription()` | hidden endpoint |

`WithOpenApi()` is obsolete in .NET 10; use the methods above and transformers.

### Transformers
For things metadata can't express: security schemes, servers, global responses, schema tweaks.
| Transformer | Runs on | Example |
|:--|:--|:--|
| document | whole document | add security scheme, servers, info |
| operation | each operation | add `429` response, mark deprecated |
| schema | each schema | add examples, formats |

.NET 10 uses Microsoft.OpenApi 2.x: `using Microsoft.OpenApi;` (no `.Models` namespace), interfaces such as `IOpenApiSecurityScheme`, and some collections may be `null` until you create them.

### Multiple documents
`builder.Services.AddOpenApi("public")` and `AddOpenApi("admin")` with `ShouldInclude = d => d.GroupName == "admin"`; assign endpoints with `.WithGroupName("admin")`. Handy to keep internal endpoints out of the public contract.

### Scalar
Scalar renders the document as interactive reference docs with a request runner.
```csharp
app.MapScalarApiReference(o => o.WithTitle("Shop API"));    // /scalar
```
Expose the UI (and the raw document) only in Development, or behind authentication in shared environments. Also seen: Swagger UI (`Swashbuckle`/`NSwag`), ReDoc.

## Example
`src/Shop.Api/Program.cs`
```csharp
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.OpenApi;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi(o =>
{
    o.AddDocumentTransformer((doc, ctx, ct) =>
    {
        doc.Info = new OpenApiInfo { Title = "Shop API", Version = "v1" };
        doc.Components ??= new OpenApiComponents();
        doc.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        doc.Components.SecuritySchemes["bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
        };
        return Task.CompletedTask;
    });
    o.AddOperationTransformer((op, ctx, ct) =>
    {
        op.Responses ??= new OpenApiResponses();
        op.Responses.TryAdd("429", new OpenApiResponse { Description = "Too many requests. See Retry-After." });
        return Task.CompletedTask;
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(o => o.WithTitle("Shop API"));
}

var orders = app.MapGroup("/orders").WithTags("Orders");

orders.MapGet("/{id:int}", Results<Ok<OrderDto>, NotFound> (int id) =>
        id == 1 ? TypedResults.Ok(new OrderDto(1, "COF-1", 2)) : TypedResults.NotFound())
    .WithName("GetOrder")
    .WithSummary("Get one order")
    .WithDescription("Returns 404 for orders that don't exist or belong to another customer.");

orders.MapPost("/", (CreateOrder body) => TypedResults.Created("/orders/1", new OrderDto(1, body.Sku, body.Quantity)))
    .WithName("CreateOrder")
    .ProducesValidationProblem();

app.Run();

public sealed record CreateOrder(string Sku, int Quantity);
public sealed record OrderDto(int Id, string Sku, int Quantity);
```
`terminal`
```bash
curl -s https://localhost:7043/openapi/v1.json -k | jq '.openapi, (.paths | keys)'
# "3.1.1"
# ["/orders", "/orders/{id}"]
```
Open `https://localhost:7043/scalar` to try the endpoints.

## Production patterns
- `TypedResults` everywhere: response types are documented and type-checked without extra attributes.
- Stable `operationId`s via `WithName`; they become function names in the generated frontend client, so renames are breaking changes.
- One transformer file (`OpenApiSetup.cs`) for security schemes and global responses.
- Docs UI in Development (and maybe staging behind auth); the contract file itself is generated at build time and committed (lesson 05).

## Mistakes
Wrong: untyped results.
```csharp
app.MapGet("/orders/{id}", (int id) => Results.Ok(load(id)));   // schema unknown
```
Right: `TypedResults.Ok(dto)` with a declared `Results<...>` return type.

Wrong: Scalar and `/openapi` exposed publicly in production with internal endpoints.
Right: map them only in Development, or split public/admin documents and protect them.

## Check yourself
1. What gives a generated TypeScript client good method names?
2. Why use `TypedResults` instead of `Results` for documentation?
3. Where do you add a JWT bearer security scheme to the document?

<details><summary>Answers</summary>

1. Stable `operationId`s, set with `.WithName(...)`.
2. `TypedResults` return concrete types (`Ok<T>`, `NotFound`) that the OpenAPI generator can inspect; `Results` returns `IResult`, which hides the response shape.
3. In a document transformer, under `Components.SecuritySchemes`.
</details>

## Sources
- [Generate OpenAPI documents](https://learn.microsoft.com/aspnet/core/fundamentals/openapi/aspnetcore-openapi)
- [Include OpenAPI metadata in Minimal APIs](https://learn.microsoft.com/aspnet/core/fundamentals/openapi/include-metadata)
- [Customize OpenAPI documents (transformers)](https://learn.microsoft.com/aspnet/core/fundamentals/openapi/customize-openapi)
- [What's new in ASP.NET Core 10 — OpenAPI](https://learn.microsoft.com/aspnet/core/release-notes/aspnetcore-10.0)
- [Scalar.AspNetCore](https://github.com/scalar/scalar/tree/main/integrations/aspnetcore)
