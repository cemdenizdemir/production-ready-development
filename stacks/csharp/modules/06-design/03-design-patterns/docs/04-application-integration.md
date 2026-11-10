---
title: Application, resilience, and integration patterns
tech: C# 14, EF Core 10, Polly 8, Azure Service Bus
version: C# 14 / .NET 10, EF Core 10
date: 2026-11-09
covers: [8, 9]
---
# Application, resilience, and integration patterns
[← Overview](00-overview.md)

## Why it matters
- A generic `IRepository<T>` exposed `GetAll()`. Someone called it on `Orders` in a report; 3 million rows were loaded into memory and the API ran out of memory.
- Business rules for "eligible for free shipping" were written as three slightly different LINQ queries. A promotion changed one of them; the cart and the invoice disagreed.
- A partner's "customer" model (one name field, no country) seeped into the domain. When the shop expanded to new countries, the partner's limits became the shop's limits.

## Concepts

### Application patterns (data)
| Pattern | Intent | In EF Core / .NET |
|:--|:--|:--|
| ⭐ repository | collection-like access to aggregates | `DbSet<T>` already is one; add a repository per **aggregate** only to hide query details or enforce loading rules |
| ⭐ unit of work | track changes, commit once | `DbContext` + `SaveChangesAsync` |
| ⭐ data mapper | domain objects don't know about persistence | EF Core with fluent configuration (domain types stay POCOs) |
| active record | objects save themselves (`order.Save()`) | not idiomatic in .NET; couples domain to DB |
| ⭐ specification | a named, reusable business rule (and its query) | an expression `Expression<Func<Order, bool>>` or a small class used in LINQ and in memory |
| query object / read model | dedicated read paths | projections, Dapper queries, `IOrderQueries` |

Avoid a generic `IRepository<T>` with `GetAll`, `Find(predicate)`, `Update`: it leaks `IQueryable`, invites unbounded queries, and adds nothing over `DbSet<T>`.

### Resilience and integration patterns
| Pattern | Intent | In this stack |
|:--|:--|:--|
| ⭐ retry | ride out transient failures | Polly / standard resilience handler (03-backend/08-reliability) |
| ⭐ circuit breaker | stop calling a failing dependency | Polly `AddCircuitBreaker` |
| ⭐ bulkhead | isolate resources | concurrency limiters, separate pools/queues |
| timeout | bound waiting | Polly timeouts, request timeouts |
| ⭐ transactional outbox | publish events reliably with state changes | 03-backend/07-background-jobs lesson 04 |
| inbox / idempotent consumer | process each message effectively once | `ProcessedMessages` table |
| ⭐ saga (process manager) | multi-step workflow across services with compensations | order → payment → shipping, with refund on failure |
| ⭐ anti-corruption layer (ACL) | translate a foreign model into yours | adapters + mapping for partners and legacy systems |
| competing consumers | scale message processing | Service Bus queue + many workers |
| claim check | send a reference, not a huge payload | store file in Blob, message carries the URL |

## In our stack
- `DbContext` as unit of work, configurations as data mapper: [03-backend/03-databases](../../../03-backend/03-databases/README.md).
- Read models and projections: [03-backend/09-scalability lesson 04](../../../03-backend/09-scalability/docs/04-database-scaling-reads.md).
- Retry, breaker, bulkhead: [03-backend/08-reliability](../../../03-backend/08-reliability/README.md).
- Outbox, inbox, competing consumers: [03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md).
- Sagas and ACLs in depth: [07-distributed-systems](../../07-distributed-systems/README.md), [05-domain-driven-design](../../05-domain-driven-design/README.md).

## When not to
- Don't wrap `DbContext` in a generic repository and unit-of-work layer "for testability"; test against a real database (Testcontainers).
- Don't introduce specifications for rules used once.
- Don't build a saga framework for a two-step process inside one database; use a transaction.
- Don't add an ACL when the external model already matches yours closely and is stable.

## Example
Specification shared by the cart, the query, and the invoice:
```csharp
public static class OrderSpecs
{
    public static readonly Expression<Func<Order, bool>> FreeShippingEligible =
        o => o.ShipToCountry == "DE" && o.SubtotalMinor >= 50_00 && !o.ContainsBulkyItems;

    private static readonly Func<Order, bool> FreeShippingEligibleCompiled = FreeShippingEligible.Compile();
    public static bool IsFreeShippingEligible(this Order o) => FreeShippingEligibleCompiled(o);
}

// in a query (translated to SQL)
var count = await db.Orders.Where(OrderSpecs.FreeShippingEligible).CountAsync(ct);
// in memory (same rule)
if (order.IsFreeShippingEligible()) shipping = Money.Zero(order.Currency);
```
An aggregate-specific repository (only where it adds something):
```csharp
public interface IOrderRepository
{
    Task<Order?> GetForUpdateAsync(OrderId id, CancellationToken ct);   // always loads lines + payments together
    void Add(Order order);
}

internal sealed class OrderRepository(OrderingDb db) : IOrderRepository
{
    public Task<Order?> GetForUpdateAsync(OrderId id, CancellationToken ct) =>
        db.Orders.Include(o => o.Lines).Include(o => o.Payments).SingleOrDefaultAsync(o => o.Id == id, ct);
    public void Add(Order order) => db.Orders.Add(order);
}
```
Anti-corruption layer for a legacy ERP:
```csharp
// foreign model (from the ERP's API)
public sealed record ErpCustomer(string KUNNR, string NAME1, string LAND1, string? STCEG);

// translation in one place
internal static class ErpTranslation
{
    public static Result<Customer> ToCustomer(ErpCustomer e) =>
        CountryCode.Parse(e.LAND1) is { IsSuccess: true } country
            ? Customer.Import(new ExternalRef("erp", e.KUNNR), e.NAME1.Trim(), country.Value!, VatId.TryParse(e.STCEG))
            : new Error("erp.invalid_country", $"Unknown country '{e.LAND1}'", ErrorType.Validation);
}
```
Saga (orchestrated) as an explicit state on the order:
```csharp
public enum CheckoutSagaState { Started, StockReserved, Paid, Completed, Compensating, Failed }
// Started → reserve stock → StockReserved → charge → Paid → create shipment → Completed
// failure after StockReserved → release stock; failure after Paid → refund; each step idempotent (07-distributed-systems)
```

## Production patterns
- `DbContext` is the unit of work; repositories exist per aggregate only to enforce loading and invariants; reads use projections or query objects.
- Business rules used in both queries and memory are specifications (expressions) defined once.
- Every external call has timeouts, limited retries, and a breaker; every cross-service workflow has an outbox, idempotent consumers, and explicit compensations.
- Foreign models stop at an anti-corruption layer.

## Mistakes
Wrong:
```csharp
public interface IRepository<T> { IQueryable<T> GetAll(); Task<T?> FindAsync(Expression<Func<T, bool>> p); void Update(T e); }
```
Right: `DbSet<T>` in use cases, or a small aggregate-specific repository with intention-revealing methods.

Wrong: the ERP's `KUNNR`/`LAND1` fields used in domain classes.
Right: translate at the boundary into `Customer`, `CountryCode`, `ExternalRef`.

## Check yourself
1. Why is a generic repository over EF Core usually an anti-pattern?
2. What problem does the specification pattern solve?
3. What does an anti-corruption layer protect?

<details><summary>Answers</summary>

1. `DbSet<T>` and `DbContext` already provide repository and unit-of-work behaviour; a generic wrapper adds indirection, often leaks `IQueryable` anyway, encourages unbounded `GetAll` calls, and hides EF Core features.
2. Keeping one business rule in one place so it's used consistently in database queries (as an expression) and in memory, instead of several drifting copies.
3. The domain model's language and invariants from a foreign or legacy model; translation happens at the boundary so the external model's limitations and changes don't spread.
</details>

## Sources
- [Martin Fowler — Repository](https://martinfowler.com/eaaCatalog/repository.html)
- [Martin Fowler — Unit of Work](https://martinfowler.com/eaaCatalog/unitOfWork.html)
- [Specification pattern (Evans & Fowler)](https://martinfowler.com/apsupp/spec.pdf)
- [Anti-corruption layer pattern](https://learn.microsoft.com/azure/architecture/patterns/anti-corruption-layer)
- [Saga pattern](https://learn.microsoft.com/azure/architecture/reference-architectures/saga/saga)
- [Cloud design patterns](https://learn.microsoft.com/azure/architecture/patterns/)
