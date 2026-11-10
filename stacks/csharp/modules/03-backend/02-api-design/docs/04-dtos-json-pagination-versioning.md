---
title: DTOs, serialization, pagination, and versioning
tech: ASP.NET Core 10, System.Text.Json, Asp.Versioning.Http, EF Core 10
version: ASP.NET Core 10, System.Text.Json 10, Asp.Versioning 8.x
date: 2026-11-09
covers: [7, 9, 10, 11]
---
# DTOs, serialization, pagination, and versioning
[← Overview](00-overview.md)

## Why it matters
- An endpoint returns the EF Core `Customer` entity; a new `PasswordHash` property added to the entity is now in the public API.
- Order statuses serialize as numbers (`"status": 2`); reordering the enum in C# silently changes what clients see.
- `GET /orders?page=4000` runs `OFFSET 80000` on a 5-million-row table; the query takes 9 seconds and blocks other work.

## Concepts

### DTOs and response shaping
| Rule | Why |
|:--|:--|
| ⭐ never expose entities | internal fields leak; schema changes break clients; lazy-loading surprises |
| request and response records per use case | `CreateOrderRequest`, `OrderDto`, `OrderSummaryDto` |
| project in the query | `Select(o => new OrderSummaryDto(...))` → only needed columns |
| stable names | renaming a property is a breaking change |
| money | `decimal` amount + currency (and/or `amountMinor`), agreed with the frontend (02-frontend/03) |
| dates | `DateTimeOffset` (ISO 8601 with offset), `DateOnly` for calendar dates |
| IDs | strings/GUIDs; large `long`s as strings for JavaScript |
| nulls | consistent: omit or include; don't mix per endpoint |

Mapping: write explicit mapping methods (`ToDto()`), or use Mapperly (source-generated, free). AutoMapper 15+ is commercial (03-backend/11).

### System.Text.Json in ASP.NET Core
ASP.NET Core uses `JsonSerializerDefaults.Web`: camelCase names, case-insensitive reading, numbers allowed as strings when reading.
| Option | Use |
|:--|:--|
| `ConfigureHttpJsonOptions(o => …)` | Minimal APIs (controllers: `AddJsonOptions`) |
| ⭐ `JsonStringEnumConverter` | enums as strings (`"Shipped"`) |
| `RespectNullableAnnotations = true` | null for non-nullable → error |
| `RespectRequiredConstructorParameters = true` | missing constructor params → error |
| `UnmappedMemberHandling = Disallow` | reject unknown properties (strict inputs) |
| `DefaultIgnoreCondition = WhenWritingNull` | omit nulls (decide once) |
| ⭐ source generation | `[JsonSerializable(typeof(OrderDto))] partial class ApiJsonContext : JsonSerializerContext`; faster startup, AOT-friendly |
| polymorphism | `[JsonPolymorphic]` + `[JsonDerivedType]` (01-foundations/06) |
| `MaxDepth` | default 64 |

### Pagination
| Style | How | Good for | Problems |
|:--|:--|:--|:--|
| offset | `?page=3&pageSize=20` → `OFFSET 40 FETCH 20` | small tables, jump to page N | slow deep pages; duplicates/skips when data changes |
| ⭐ cursor (keyset) | `?limit=20&cursor=<opaque>` → `WHERE (CreatedAt, Id) < (@c, @id) ORDER BY CreatedAt DESC, Id DESC` | feeds, large tables, infinite scroll | no random page jumps |

Rules: a maximum page size (e.g. 100), a stable sort with a unique tie-breaker (`Id`), an index matching the sort (03-databases), an opaque cursor (Base64 of the sort keys), and a response like `{ "items": [...], "nextCursor": "..." }`. Filtering and sorting use allowlisted fields (`?sort=price` → known column).

### Versioning and evolving APIs
Most changes should be **additive** (new endpoints, new optional fields, new enum values clients tolerate). Breaking changes: removing/renaming fields, changing types, new required inputs, changing semantics.
| Strategy | Example | Note |
|:--|:--|:--|
| ⭐ evolve without versions | additive changes + deprecation (01-foundations/08) | default |
| URL segment | `/v2/orders` | visible, cache-friendly |
| header / query | `api-version: 2.0` | cleaner URLs |
| media type | `Accept: application/vnd.shop.v2+json` | rare |

`Asp.Versioning.Http` adds version sets, reporting (`api-supported-versions` header), and OpenAPI document per version.

## Example
`src/Shop.Api/Features/Orders/OrderListing.cs`
```csharp
using System.Buffers.Text;
using System.Text;
using Microsoft.EntityFrameworkCore;

namespace Shop.Api.Features.Orders;

public sealed record OrderSummaryDto(Guid Id, long Number, DateTimeOffset PlacedAt, OrderStatus Status, decimal Total, string Currency);
public sealed record Page<T>(IReadOnlyList<T> Items, string? NextCursor);

public static class OrderListing
{
    public static async Task<Page<OrderSummaryDto>> ListAsync(ShopDb db, Guid customerId, string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 100);
        var query = db.Orders.AsNoTracking().Where(o => o.CustomerId == customerId);

        if (Decode(cursor) is var (placedAt, number))
            query = query.Where(o => o.PlacedAt < placedAt || (o.PlacedAt == placedAt && o.Number < number));

        var rows = await query
            .OrderByDescending(o => o.PlacedAt).ThenByDescending(o => o.Number)   // unique tie-breaker
            .Take(limit + 1)                                                        // one extra to know if there's more
            .Select(o => new OrderSummaryDto(o.Id, o.Number, o.PlacedAt, o.Status, o.Total, o.Currency))
            .ToListAsync(ct);

        var hasMore = rows.Count > limit;
        var items = hasMore ? rows[..limit] : rows;
        return new Page<OrderSummaryDto>(items, hasMore ? Encode(items[^1].PlacedAt, items[^1].Number) : null);
    }

    private static string Encode(DateTimeOffset at, long number) =>
        Base64Url.EncodeToString(Encoding.UTF8.GetBytes($"{at.UtcTicks}:{number}"));

    private static (DateTimeOffset, long)? Decode(string? cursor)
    {
        if (string.IsNullOrEmpty(cursor)) return null;
        var parts = Encoding.UTF8.GetString(Base64Url.DecodeFromChars(cursor)).Split(':');
        return (new DateTimeOffset(long.Parse(parts[0]), TimeSpan.Zero), long.Parse(parts[1]));
    }
}
```
`Number` is a unique `bigint` (identity or sequence) on the order. Comparing `Guid`s in keyset queries is awkward: C# has no `<` on `Guid`, and SQL Server sorts `uniqueidentifier` by a different byte order than .NET (03-databases).
`src/Shop.Api/Program.cs` (JSON options)
```csharp
using System.Text.Json.Serialization;

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.SerializerOptions.RespectNullableAnnotations = true;
    o.SerializerOptions.TypeInfoResolverChain.Insert(0, ApiJsonContext.Default);
});

[JsonSerializable(typeof(OrderSummaryDto))]
[JsonSerializable(typeof(Page<OrderSummaryDto>))]
internal partial class ApiJsonContext : JsonSerializerContext;
```
A bad cursor should produce a 400, not a 500: wrap `Decode` in a `try/catch (FormatException)` and return a validation problem.

## Production patterns
- DTO per use case, projected in the query, mapped explicitly or with Mapperly.
- Enums as strings; clients handle unknown values gracefully (02-frontend/03).
- Cursor pagination for anything that grows; max page size enforced; index on the sort keys.
- Additive evolution by default; versions only for real breaking changes, with dated deprecation of the old one.

## Mistakes
Wrong:
```csharp
app.MapGet("/customers/{id}", async (Guid id, ShopDb db) => await db.Customers.FindAsync(id));   // entity out
```
Right: `Select(c => new CustomerDto(c.Id, c.DisplayName))`.

Wrong: unbounded page size.
```csharp
int pageSize = 1_000_000
```
Right: `Math.Clamp(limit, 1, 100)`.

## Check yourself
1. Why is offset pagination slow for deep pages?
2. Why serialize enums as strings?
3. Name two breaking and two non-breaking API changes.

<details><summary>Answers</summary>

1. The database must read and discard all skipped rows (`OFFSET N`) for every request; cost grows with N.
2. Names are stable and readable; numeric values change silently if the enum is reordered, and clients can't tell what `2` means.
3. Breaking: removing/renaming a field, changing a type, adding a required input. Non-breaking: adding an endpoint, adding an optional request field, adding a response field.
</details>

## Sources
- [System.Text.Json overview](https://learn.microsoft.com/dotnet/standard/serialization/system-text-json/overview)
- [JSON source generation](https://learn.microsoft.com/dotnet/standard/serialization/system-text-json/source-generation)
- [EF Core — Pagination (keyset)](https://learn.microsoft.com/ef/core/querying/pagination)
- [Asp.Versioning](https://github.com/dotnet/aspnet-api-versioning)
- [Mapperly](https://mapperly.riok.app/)
