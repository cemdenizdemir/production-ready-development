---
title: DRY, KISS, YAGNI, and object conversations
tech: C# 14
version: C# 14 / .NET 10
date: 2026-11-09
covers: [7, 8, 9]
---
# DRY, KISS, YAGNI, and object conversations
[← Overview](00-overview.md)

## Why it matters
- Two endpoints had similar validation, so someone merged them into one generic `ValidateEntity<T>` with 9 flags. A change for products broke customer signup.
- A "plugin framework" for discounts took a month to build. The business needed exactly two discount types, and the framework made both harder to change.
- `order.Customer.Address.Country.TaxRules.Rate` appeared in 30 places. When tax rules moved to their own service, all 30 broke.

## Concepts

### DRY, KISS, YAGNI
| Principle | Means | Misread as |
|:--|:--|:--|
| ⭐ DRY (don't repeat yourself) | every piece of **knowledge** has one authoritative place | "never have two similar-looking lines" |
| ⭐ KISS (keep it simple) | the simplest design that meets the real requirements | "never use abstractions" |
| ⭐ YAGNI (you aren't gonna need it) | don't build for imagined future needs | "never design ahead" |

| Conflict | Resolve by |
|:--|:--|
| DRY vs coupling | duplicate code that changes for **different** reasons; merge only shared knowledge (a tax rule, a validation rule) |
| DRY vs KISS | the rule of three: tolerate duplication until the third occurrence shows the real abstraction |
| YAGNI vs OCP | add extension points when variation shows up, not before |
| KISS vs performance | simple first; optimise measured hot spots (09-scalability) |

"Duplication is far cheaper than the wrong abstraction" (Sandi Metz).

### Object conversations
| Principle | Means | Example |
|:--|:--|:--|
| ⭐ Law of Demeter | talk to your immediate collaborators, not their collaborators' collaborators | `order.TaxRate()` instead of `order.Customer.Address.Country.TaxRules.Rate` |
| ⭐ tell, don't ask | tell an object to do something instead of asking for its data and deciding for it | `order.Cancel(now)` vs `if (order.Status != Shipped) order.Status = Cancelled` |
| ⭐ command–query separation (CQS) | a method either changes state (command, returns nothing or a result) or returns data (query, no side effects) | `GetTotal()` doesn't save; `Place()` doesn't return lists |

Fluent APIs and LINQ chains (`.Where().Select()`) aren't Demeter violations: they return the same kind of object, not reach into internals.

### Separation of concerns and information hiding
| Principle | Means | In C# |
|:--|:--|:--|
| ⭐ separation of concerns | different concerns (HTTP, rules, persistence, logging) in different places | endpoints / domain / data / middleware |
| ⭐ information hiding | hide decisions likely to change behind stable interfaces (Parnas) | `internal`, ports, modules |
| policy vs detail | business policy shouldn't know about detail (DB, framework, vendor) | the dependency rule |
| cross-cutting concerns | logging, auth, validation applied around code | middleware, endpoint filters, decorators |

## In our stack
- One home for each rule: money rules in `Money`, order rules in `Order` ([01-paradigms-oop](../../01-paradigms-oop/README.md)).
- Tell-don't-ask aggregates: `Order.Cancel`, `Payment.TryMarkSucceeded` ([03-backend/12-integrations lesson 02](../../../03-backend/12-integrations/docs/02-stripe-webhooks.md)).
- Cross-cutting concerns in middleware and filters: validation, rate limiting, exception handling ([03-backend/02-api-design](../../../03-backend/02-api-design/README.md)).
- Information hiding by module: [03-backend/11-architecture lesson 06](../../../03-backend/11-architecture/docs/06-microservices-adrs-boundaries.md).

## When not to
- Don't DRY up test code aggressively; tests that read clearly on their own beat shared helpers with flags.
- Don't apply CQS dogmatically where the framework returns the created resource (a `Create` returning the new ID is fine).
- Don't add wrapper methods for every Demeter "violation" on plain DTOs/records; navigating data structures is fine, it's reaching into *objects with behaviour* that couples.

## Example
Wrong abstraction vs. honest duplication:
```csharp
// Wrong: one validator for unrelated rules, steered by flags
public static Result<bool> Validate<T>(T entity, bool checkEmail, bool checkSku, bool allowZeroPrice, bool isAdmin) { /* ... */ return true; }

// Right: each use case owns its rules; shared *knowledge* lives in value objects
public sealed record SignUpRequest(string Email, string Password);
public static Result<Email> ValidateSignUp(SignUpRequest r) => Email.Parse(r.Email);           // Email rules live in Email
public static Result<Sku> ValidateProduct(CreateProduct r) => Sku.Parse(r.Sku);               // Sku rules live in Sku
```
Law of Demeter and tell, don't ask:
```csharp
// Wrong: asks for data deep inside and decides outside
if (order.Customer.Address.Country.Code == "TR" && order.Status == OrderStatus.Pending)
    order.Total = order.Total.Percent(120);

// Right: ask the order (it can delegate internally), tell it what to do
var vat = taxRules.RateFor(order.ShipToCountry);   // the order exposes what callers need
order.ApplyTax(vat);                                // the order enforces when tax may change
```
Command–query separation:
```csharp
public sealed class Cart
{
    public Money Total() => /* query: no side effects */ Money.Zero("EUR");
    public void Add(Sku sku, Quantity qty) { /* command: changes state, returns nothing */ }
    // Avoid: public Money AddAndGetTotal(...) and queries that "also save the last viewed time"
}
```
YAGNI in practice:
```csharp
// Needed now: two discount types. A closed set is enough.
public abstract record Discount
{
    private Discount() { }
    public sealed record Percent(int Value) : Discount;
    public sealed record Fixed(Money Amount) : Discount;
}
// Not: IDiscountPlugin, DiscountPluginLoader, reflection-based discovery, a rules DSL.
```

## Production patterns
- DRY applies to knowledge (rules, schemas, constants), enforced by single authoritative types; similar-looking code with different reasons to change stays separate.
- Simple designs first; abstractions are extracted on the third real occurrence or when variation is proven.
- Objects are told what to do and protect their rules; queries don't change state; collaborators are reached directly, not through chains.
- Cross-cutting concerns live in middleware, filters, and decorators, not copy-pasted into every handler.

## Mistakes
Wrong: a `BaseHandler<TRequest, TResponse>` with 12 virtual hooks so "all handlers share logic".
Right: plain handlers; shared concerns in filters/middleware; shared rules in domain types.

Wrong: `GetOrder()` that also updates `LastViewedAt` and writes an audit row.
Right: a query that only reads; tracking is an explicit command.

## Check yourself
1. What kind of duplication does DRY really target?
2. What does "tell, don't ask" change in code?
3. When do YAGNI and OCP point in different directions, and how do you decide?

<details><summary>Answers</summary>

1. Duplicated knowledge: the same business rule, schema, or decision encoded in several places, so changing it requires finding all copies. Similar-looking code that changes for different reasons isn't the target.
2. Instead of pulling data out of an object and making decisions about it outside, you call a method on the object that makes the decision and protects its own invariants.
3. OCP suggests adding extension points; YAGNI says don't build for imagined needs. Add the extension point when the variation has actually appeared (or is committed), not on speculation.
</details>

## Sources
- [The Pragmatic Programmer — DRY](https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/)
- [Sandi Metz — The wrong abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)
- [Martin Fowler — Yagni](https://martinfowler.com/bliki/Yagni.html)
- [Martin Fowler — TellDontAsk](https://martinfowler.com/bliki/TellDontAsk.html)
- [Martin Fowler — CommandQuerySeparation](https://martinfowler.com/bliki/CommandQuerySeparation.html)
- [David Parnas — On the criteria to be used in decomposing systems into modules](https://dl.acm.org/doi/10.1145/361598.361623)
