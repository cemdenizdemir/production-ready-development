---
title: Nullable reference types and type-safe boundaries
tech: C# 14, nullable reference types
version: C# 14, .NET 10
date: 2026-11-09
covers: [2, 3]
---
# Nullable reference types and type-safe boundaries
[← Overview](00-overview.md)

## Why it matters
- `customer.Address.City` throws in production for guest checkouts, which have no address. The type said `Address`, not `Address?`, because nullable was off.
- A developer silences 200 nullable warnings with `!` to make the build green. The warnings were right.
- A JSON body without `email` deserializes into an object where `Email` is `null` even though it is declared `string`. The bug appears three layers later.

## Concepts

### What nullable reference types do
With `<Nullable>enable</Nullable>`, `string` means "never null" and `string?` means "maybe null". The compiler tracks null state through your code (flow analysis) and warns when you might dereference null or assign null to a non-nullable.

| Warning | Means |
|:--|:--|
| CS8600 | converting null to a non-nullable type |
| CS8602 | dereference of a possibly null reference |
| CS8603 | possible null return |
| CS8604 | possible null argument |
| CS8618 | non-nullable property not initialized when constructor exits |
| CS8625 | null literal to non-nullable |

It's compile-time only: at runtime, `string` can still be null (from reflection, deserialization, or old libraries). That is why boundaries need validation.

### Warnings as errors
```xml
<Nullable>enable</Nullable>
<TreatWarningsAsErrors>true</TreatWarningsAsErrors>
```
Or only nullable as errors while other warnings stay warnings: `<WarningsAsErrors>nullable</WarningsAsErrors>`. Keep `TreatWarningsAsErrors` on in CI; locally it can be relaxed with `-p:TreatWarningsAsErrors=false` while you work.

### Helping the compiler
| Tool | Use |
|:--|:--|
| `?` on types | `string? MiddleName` |
| `required` member (C# 11) | caller must set it: `public required string Email { get; init; }` |
| `init` accessor | settable only during initialization |
| null checks and patterns | `if (x is null) return;`, `x is { Length: > 0 }` |
| `ArgumentNullException.ThrowIfNull(x)` | guard + informs flow analysis |
| `[NotNullWhen(true)]` | `bool TryGet(..., [NotNullWhen(true)] out Order? order)` |
| `[MemberNotNull(nameof(_conn))]` | method guarantees a field is set |
| `[MaybeNull]`, `[AllowNull]`, `[DisallowNull]`, `[NotNull]` | edge cases in generic code |
| `!` (null-forgiving) | "trust me". Rare: after a check the compiler can't see |

### Type-safe boundaries
Inside the app, types should be trustworthy. At the edges (HTTP, configuration, database, queues, files), data is not.
| Boundary | Make it safe with |
|:--|:--|
| HTTP request bodies | DTO records + validation (built-in Minimal API validation / FluentValidation, 03-backend/05) |
| configuration | Options pattern + `ValidateOnStart` (07-config-environments) |
| JSON | `JsonSerializerOptions` with `RespectRequiredConstructorParameters` and `RespectNullableAnnotations` (.NET 9+) |
| database | non-nullable columns ↔ non-nullable properties; EF Core reads NRT annotations |
| external APIs | parse into your own types; reject or map unknown values |

Pattern matching makes checks explicit and readable:
```csharp
var message = order switch
{
    { Status: OrderStatus.Shipped, TrackingNumber: { } tracking } => $"Shipped: {tracking}",
    { Status: OrderStatus.Shipped } => "Shipped",
    { Status: OrderStatus.Cancelled } => "Cancelled",
    _ => "In progress",
};
```

## Example
`src/Shop.Api/Contracts/CreateCustomer.cs`
```csharp
using System.ComponentModel.DataAnnotations;

namespace Shop.Api.Contracts;

public sealed record CreateCustomer
{
    [Required, EmailAddress, MaxLength(254)]
    public required string Email { get; init; }

    [Required, MaxLength(100)]
    public required string Name { get; init; }

    [MaxLength(100)]
    public string? Company { get; init; }          // optional, and the type says so
}
```
`src/Shop.Api/Program.cs` (excerpt)
```csharp
builder.Services.AddValidation();                // .NET 10: runs the DataAnnotations above for Minimal APIs
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.RespectNullableAnnotations = true;            // null for `string` → 400, not a null string
    o.SerializerOptions.RespectRequiredConstructorParameters = true;
});

app.MapPost("/customers", (CreateCustomer body, CustomerStore store) =>
{
    var customer = store.Add(body.Email, body.Name, body.Company);
    return TypedResults.Created($"/customers/{customer.Id}", customer);
});
```
`src/Shop.Domain/CustomerStore.cs`
```csharp
using System.Diagnostics.CodeAnalysis;

public sealed class CustomerStore
{
    private readonly Dictionary<Guid, Customer> _byId = [];

    public bool TryGet(Guid id, [NotNullWhen(true)] out Customer? customer) => _byId.TryGetValue(id, out customer);

    public string DisplayName(Guid id) =>
        TryGet(id, out var c) ? c.Name : "unknown";    // no warning: c is non-null in the true branch
}
```

## Production patterns
- Enable nullable in `Directory.Build.props` for every project from day one.
- Treat `!` as a code-review flag: each one needs a reason or a better type.
- Validate at the boundary, then pass well-typed objects inward. Domain code shouldn't re-check for nulls the type rules out.
- Turn on `RespectNullableAnnotations` for JSON so the type system and the wire format agree.

## Mistakes
Wrong: silencing instead of modeling.
```csharp
public string Company { get; set; } = null!;   // it is optional in reality
```
Right:
```csharp
public string? Company { get; init; }
```

Wrong: `!` to escape a real maybe-null.
```csharp
var city = customer.Address!.City;
```
Right:
```csharp
var city = customer.Address?.City ?? "n/a";
```

## Check yourself
1. Does `string` (with nullable enabled) guarantee no null at runtime?
2. What does `[NotNullWhen(true)]` tell the compiler?
3. Why add `required` to a property that also has `[Required]`?

<details><summary>Answers</summary>

1. No. It's compile-time analysis; deserialization, reflection, or unannotated code can still produce null.
2. When the method returns `true`, the annotated `out` parameter is not null.
3. `required` makes the compiler force C# callers to set it; `[Required]` validates incoming data at runtime. They protect different boundaries.
</details>

## Sources
- [Nullable reference types](https://learn.microsoft.com/dotnet/csharp/nullable-references)
- [Attributes for null-state static analysis](https://learn.microsoft.com/dotnet/csharp/language-reference/attributes/nullable-analysis)
- [required modifier](https://learn.microsoft.com/dotnet/csharp/language-reference/keywords/required)
- [System.Text.Json — Respect nullable annotations](https://learn.microsoft.com/dotnet/standard/serialization/system-text-json/nullable-annotations)
- [Pattern matching](https://learn.microsoft.com/dotnet/csharp/fundamentals/functional/pattern-matching)
