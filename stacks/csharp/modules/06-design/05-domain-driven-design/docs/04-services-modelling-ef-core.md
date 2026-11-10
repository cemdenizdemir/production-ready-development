---
title: Services, modelling in C#, and persisting with EF Core
tech: C# 14, EF Core 10, SQL Server 2025
version: C# 14 / .NET 10, EF Core 10
date: 2026-11-09
covers: [8, 9, 10]
---
# Services, modelling in C#, and persisting with EF Core
[← Overview](00-overview.md)

## Why it matters
- A `CustomerId` and an `OrderId` were both `long`. A method took them in the wrong order, and a refund went to the wrong customer.
- Email addresses were validated in three controllers and not at all in a Hangfire job. The job created accounts with invalid emails; bounces hurt sender reputation.
- To make EF Core happy, the team gave entities public setters and parameterless public constructors. The domain rules could now be bypassed anywhere.

## Concepts

### Services, factories, repositories
| Building block | Holds | Example |
|:--|:--|:--|
| ⭐ domain service | domain logic that doesn't belong to one entity or value object; stateless | `PricingService.Quote(cart, customerTier, promotions)` |
| ⭐ application service (use case) | orchestration: load aggregates, call domain, save, publish; no business rules | `PlaceOrderHandler` |
| factory | complex creation that keeps invariants | `Order.Start(...)`, `Subscription.Create(...)` |
| ⭐ repository | load/save **aggregates** (not tables) | `IOrderRepository.GetForUpdateAsync` or `DbSet<Order>` directly |
| infrastructure service | technical capability behind a port | `IEmailSender`, `IPaymentGateway` |

### Modelling in C#
| Technique | C# | Prevents |
|:--|:--|:--|
| ⭐ strongly typed IDs | `readonly record struct OrderId(Guid Value)` | mixing up IDs |
| ⭐ records as value objects | `sealed record Address(...)` / `readonly record struct Money(...)` | mutation bugs; gives equality |
| ⭐ factory methods returning results | `Email.Parse(string) → Result<Email>` | invalid objects |
| ⭐ parse, don't validate | parse input once into a type that can only be valid; pass the type around | re-validation, forgotten validation |
| ⭐ illegal states unrepresentable | sum types per state (`Draft`, `Placed`, `Shipped` with their own data); C# 15 unions | `ShippedAt` set on a draft order |
| private setters, private constructors | `{ get; private set; }`, `private Order() { }` for EF | rule bypass |
| no primitive obsession where it matters | `Quantity`, `Sku`, `Email`, `Money` | unit errors |

### Persisting aggregates with EF Core
| Need | EF Core feature |
|:--|:--|
| ⭐ value objects without identity | `ComplexProperty(o => o.Total)` (complex types, EF Core 8+; JSON and optional support in EF Core 10) |
| value object collections / nested | owned types `OwnsMany`, or complex types mapped to JSON (EF Core 10) |
| ⭐ strongly typed IDs | `HasConversion(id => id.Value, v => new OrderId(v))` or conventions via `ConfigureConventions` |
| ⭐ private collections | backing fields: `Navigation(o => o.Lines).UsePropertyAccessMode(PropertyAccessMode.Field)` |
| private setters / constructors | EF Core uses them (no public setters needed) |
| ⭐ optimistic concurrency | `Property(o => o.Version).IsRowVersion()` |
| domain events → outbox | `SaveChangesInterceptor` (03-backend/07-background-jobs lesson 04) |
| inner entities | configured from the root's configuration; no `DbSet` for them |

## In our stack
- Strongly typed IDs and `Money`: [01-paradigms-oop lesson 04](../../01-paradigms-oop/docs/04-entities-values-choosing.md).
- `Result<T>` and error codes: [03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-ports.md).
- EF Core mappings, migrations, and concurrency: [03-backend/03-databases](../../../03-backend/03-databases/README.md).
- Outbox interceptor: [03-backend/07-background-jobs lesson 04](../../../03-backend/07-background-jobs/docs/04-outbox.md).

## When not to
- Don't wrap every primitive (`FirstName`, `Comment`) in a value object; target types with rules or mix-up risk.
- Don't create domain services for logic that clearly belongs to one aggregate ("anemic model" again).
- Don't fight EF Core with exotic mappings; if a model can't be persisted simply, reconsider the model or use a separate persistence model in that one place.

## Example
Parse, don't validate:
```csharp
public sealed record Email
{
    public string Value { get; }
    private Email(string value) => Value = value;

    public static Result<Email> Parse(string? input)
    {
        var trimmed = input?.Trim().ToLowerInvariant();
        return trimmed is { Length: > 3 and <= 254 } && MailAddress.TryCreate(trimmed, out _)
            ? new Email(trimmed)
            : new Error("email.invalid", "Enter a valid email address.", ErrorType.Validation);
    }
}

// Everything after the boundary takes Email, not string: no re-validation, no forgetting.
public Task SendWelcomeAsync(Email to, CancellationToken ct) => /* ... */ Task.CompletedTask;
```
Illegal states unrepresentable for a subscription:
```csharp
public abstract record SubscriptionState
{
    private SubscriptionState() { }
    public sealed record Active(DateOnly NextRoastOn, int EveryWeeks) : SubscriptionState;
    public sealed record Paused(DateOnly ResumesOn) : SubscriptionState;
    public sealed record Cancelled(DateTimeOffset At, string Reason) : SubscriptionState;
}
// An Active subscription always has a next roast date; a Cancelled one can't have one.
```
`OrderConfiguration.cs` (EF Core 10)
```csharp
internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.ToTable("Orders", "ordering");
        b.HasKey(o => o.Id);
        b.Property(o => o.Id).HasConversion(id => id.Value, v => new OrderId(v));
        b.Property(o => o.CustomerId).HasConversion(id => id.Value, v => new CustomerId(v));
        b.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
        b.ComplexProperty(o => o.Total, m =>
        {
            m.Property(x => x.Minor).HasColumnName("TotalMinor");
            m.Property(x => x.Currency).HasColumnName("TotalCurrency").HasMaxLength(3).IsFixedLength();
        });
        b.Property(o => o.Version).IsRowVersion();

        b.HasMany(o => o.Lines).WithOne().HasForeignKey("OrderId").OnDelete(DeleteBehavior.Cascade);
        b.Navigation(o => o.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);   // uses the _lines field
    }
}

internal sealed class OrderLineConfiguration : IEntityTypeConfiguration<OrderLine>
{
    public void Configure(EntityTypeBuilder<OrderLine> l)
    {
        l.ToTable("OrderLines", "ordering");
        l.Property<int>("Id");
        l.HasKey("Id");                                                // shadow key: not part of the domain
        l.Property(x => x.Sku).HasConversion(s => s.Value, v => Sku.Parse(v).Value!).HasMaxLength(20);
        l.Property(x => x.Quantity).HasConversion(q => q.Value, v => new Quantity(v));
        l.ComplexProperty(x => x.UnitPrice, m =>
        {
            m.Property(x => x.Minor).HasColumnName("UnitPriceMinor");
            m.Property(x => x.Currency).HasColumnName("UnitPriceCurrency").HasMaxLength(3);
        });
    }
}
```
There's no `DbSet<OrderLine>`: lines are reached only through `Order`.

A domain service (logic spanning several concepts, no state):
```csharp
public static class SubscriptionPricing
{
    public static Money PriceFor(Product coffee, int bags, int everyWeeks, LoyaltyTier tier)
    {
        var basePrice = new Money(coffee.PriceMinor * bags, coffee.Currency);
        var frequencyDiscount = everyWeeks <= 2 ? 10 : everyWeeks <= 4 ? 5 : 0;
        var tierDiscount = tier switch { LoyaltyTier.Gold => 5, LoyaltyTier.Silver => 3, _ => 0 };
        return new Money(basePrice.Minor * (100 - frequencyDiscount - tierDiscount) / 100, basePrice.Currency);
    }
}
```

## Production patterns
- Use cases orchestrate; aggregates and value objects hold rules; domain services hold cross-concept logic; infrastructure sits behind ports.
- Input is parsed once into domain types at the boundary; domain methods take domain types.
- EF Core maps the domain as it is: private setters and constructors, backing fields, complex types for value objects, converters for IDs, `rowversion` for concurrency.

## Mistakes
Wrong: `public void Refund(long orderId, long customerId, decimal amount)`.
Right: `Refund(OrderId order, CustomerId customer, Money amount)`; the compiler catches swaps.

Wrong: public setters "because EF Core needs them".
Right: EF Core works with private setters, private constructors, and backing fields.

## Check yourself
1. What's the difference between a domain service and an application service?
2. What does "parse, don't validate" mean in C#?
3. How does EF Core populate a private `_lines` list?

<details><summary>Answers</summary>

1. A domain service contains business logic that doesn't fit a single entity or value object (stateless, in domain terms). An application service (use case) orchestrates: loads aggregates, calls domain logic, saves, and publishes, without containing business rules.
2. Convert unstructured input into a type that can only hold valid values (via a factory returning a result) at the boundary, then pass that type everywhere, so validity is guaranteed by the type rather than re-checked.
3. Through a backing field: with `UsePropertyAccessMode(PropertyAccessMode.Field)` on the navigation, EF Core reads and writes the field directly while the public property exposes a read-only view.
</details>

## Sources
- [EF Core complex types](https://learn.microsoft.com/ef/core/modeling/complex-types)
- [What's new in EF Core 10](https://learn.microsoft.com/ef/core/what-is-new/ef-core-10.0/whatsnew)
- [EF Core backing fields](https://learn.microsoft.com/ef/core/modeling/backing-field)
- [EF Core value conversions](https://learn.microsoft.com/ef/core/modeling/value-conversions)
- [Alexis King — Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)
- [Owned entity types](https://learn.microsoft.com/ef/core/modeling/owned-entities)
