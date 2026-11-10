---
title: Entities, value objects, DTOs, and choosing a style
tech: C# 14
version: C# 14 / .NET 10
date: 2026-11-09
covers: [8, 10]
---
# Entities, value objects, DTOs, and choosing a style
[← Overview](00-overview.md)

## Why it matters
- Two `Order` objects for the same order compared unequal (reference equality), so a `HashSet<Order>` held duplicates and an order was emailed twice.
- `Money` was a mutable class. A discount method changed the `Amount` of a price object shared by every cart line using that product.
- The EF Core entity was returned straight from the API. Adding a `PasswordHash` column to `Customer` exposed it in JSON.

## Concepts

### Three kinds of types
| Kind | Identity | Equality | Mutability | C# |
|:--|:--|:--|:--|:--|
| ⭐ entity | has an ID that persists over time | by ID | changes through methods | `sealed class` with private setters |
| ⭐ value object | none; defined by its values | by value (all fields) | immutable | `readonly record struct` or `sealed record` |
| ⭐ DTO | none | by value (records) | immutable data carrier | `record` with only data |

| Question | Entity | Value object |
|:--|:--|:--|
| does it change over time but stay "the same thing"? | yes (an order moves from Pending to Shipped) | no (a new address is a new value) |
| do two with equal fields mean the same thing? | not necessarily | yes |
| shop examples | `Order`, `Customer`, `Product`, `Payment` | `Money`, `Sku`, `Email`, `Address`, `DateRange`, `Quantity` |

DTOs cross boundaries (HTTP, messages, between modules); they have no behaviour and never expose entities directly.

### Choosing a style: functional core, imperative shell
| Layer | Style | Why |
|:--|:--|:--|
| ⭐ core (domain rules, calculations) | functional: pure, immutable values, entities with methods | easy to test and reason about |
| ⭐ shell (endpoints, use cases, EF Core, partners) | imperative/OO: orchestration, I/O, DI | that's where effects belong |
| boundaries | DTOs and mapping | stable contracts |

| Use classes (OO) when | Use functions and records when |
|:--|:--|
| something has identity and a lifecycle (entities) | transforming data (pricing, validation, mapping) |
| you need to hide and protect state | the data is just data (DTOs, events) |
| collaborators vary and are injected (ports, strategies) | the logic is a calculation with inputs and outputs |
| the framework expects it (`BackgroundService`) | a small strategy fits in a `Func<...>` |

## In our stack
- Entities with methods and private setters: [03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-ports.md).
- Value objects in EF Core as complex types / owned types: [05-domain-driven-design](../../05-domain-driven-design/README.md).
- DTOs per endpoint and Mapperly/manual mapping: [03-backend/02-api-design](../../../03-backend/02-api-design/README.md), [03-backend/11-architecture lesson 05](../../../03-backend/11-architecture/docs/05-mediators-mappers-templates.md).

## When not to
- Don't make value objects for every primitive (`FirstName`, `LastName`, `Comment`) when no rule protects them; wrap the ones with rules or mix-up risk (`Money`, `Email`, IDs).
- Don't add behaviour to DTOs; keep them plain so serialisation and contracts stay predictable.
- Don't force a rich domain model on a simple CRUD screen; records and a straight `DbContext` update are fine there.

## Example
`Money.cs` (value object)
```csharp
public readonly record struct Money
{
    public long Minor { get; }
    public string Currency { get; }

    public Money(long minor, string currency)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(minor);
        if (currency is not { Length: 3 } || !currency.All(char.IsAsciiLetterUpper))
            throw new ArgumentException("ISO 4217 code, e.g. EUR", nameof(currency));
        (Minor, Currency) = (minor, currency);
    }

    public static Money Zero(string currency) => new(0, currency);

    public static Money operator +(Money a, Money b) =>
        a.Currency == b.Currency ? new(a.Minor + b.Minor, a.Currency) : throw new InvalidOperationException("Currency mismatch");

    public Money Percent(int pct) => new(Minor * pct / 100, Currency);
    public override string ToString() => $"{Minor / 100m:0.00} {Currency}";
}
```
`Order.cs` (entity: equality by ID, state changed through methods)
```csharp
public sealed class Order : IEquatable<Order>
{
    private readonly List<OrderLine> _lines = [];
    public OrderId Id { get; }
    public OrderStatus Status { get; private set; }
    public IReadOnlyList<OrderLine> Lines => _lines;

    private Order(OrderId id) => (Id, Status) = (id, OrderStatus.Pending);
    public static Order Create(OrderId id, IEnumerable<OrderLine> lines)
    {
        var order = new Order(id);
        order._lines.AddRange(lines);
        if (order._lines.Count is 0 or > 50) throw new ArgumentException("1–50 lines", nameof(lines));
        return order;
    }

    public bool Equals(Order? other) => other is not null && Id == other.Id;
    public override bool Equals(object? obj) => Equals(obj as Order);
    public override int GetHashCode() => Id.GetHashCode();
}

public readonly record struct OrderId(long Value);
```
`OrderDto.cs` (DTO at the HTTP boundary)
```csharp
public sealed record OrderDto(long Id, string Status, long TotalMinor, string Currency, IReadOnlyList<OrderLineDto> Lines);
public sealed record OrderLineDto(string Sku, int Quantity, long UnitPriceMinor);
```
Functional core, imperative shell in one use case:
```csharp
public async Task<Result<OrderDto>> ApplyDiscountAsync(long orderId, string code, CancellationToken ct)
{
    var order = await db.Orders.Include(o => o.Lines).SingleOrDefaultAsync(o => o.Id == new OrderId(orderId), ct);   // shell: I/O
    var discount = await db.DiscountCodes.SingleOrDefaultAsync(d => d.Code == code, ct);
    if (order is null) return Error.NotFound("order.not_found", "Order not found.");

    var decision = DiscountRules.Evaluate(order, discount, time.GetUtcNow());                                      // core: pure
    if (!decision.IsSuccess) return decision.Error!;

    order.ApplyDiscount(decision.Value!);                                                                            // entity method
    await db.SaveChangesAsync(ct);                                                                                   // shell: I/O
    return order.ToDto();
}
```

## Production patterns
- Entities have identity, private setters, and methods that enforce rules; value objects are immutable and validated on creation; DTOs are plain records at boundaries.
- Rules are pure functions or entity methods tested without infrastructure; use cases do the I/O around them.
- Only meaningful primitives become value objects (money, IDs, emails); the rest stay primitives.

## Mistakes
Wrong:
```csharp
public class Money { public decimal Amount { get; set; } public string Currency { get; set; } }   // shared and mutable
```
Right: an immutable `readonly record struct Money` with validation and operators.

Wrong: `return Results.Ok(customerEntity);`
Right: map to a DTO with exactly the fields the client needs.

## Check yourself
1. How do you decide whether something is an entity or a value object?
2. Why should value objects be immutable?
3. What does "functional core, imperative shell" mean in a use case?

<details><summary>Answers</summary>

1. Ask whether it has an identity that persists while its attributes change (entity, e.g. an order) or whether it's fully defined by its values so equal values are interchangeable (value object, e.g. money or an address).
2. They can be shared and passed around safely: nobody can change a value someone else holds, equality stays stable (safe in hash sets), and invalid states can only be prevented once, at creation.
3. The use case loads data and saves results (I/O in the shell), while the decision in between is made by pure functions or entity methods that take data in and return a result, with no I/O.
</details>

## Sources
- [Records — value equality](https://learn.microsoft.com/dotnet/csharp/language-reference/builtin-types/record#value-equality)
- [Implement value objects (.NET microservices guide)](https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/implement-value-objects)
- [Martin Fowler — Value object](https://martinfowler.com/bliki/ValueObject.html)
- [Gary Bernhardt — Functional core, imperative shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell)
- [Martin Fowler — DTO](https://martinfowler.com/eaaCatalog/dataTransferObject.html)
