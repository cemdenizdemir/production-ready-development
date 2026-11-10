---
title: Structural patterns
tech: C# 14, ASP.NET Core 10, IHttpClientFactory
version: C# 14 / .NET 10
date: 2026-11-09
covers: [4, 5]
---
# Structural patterns
[← Overview](00-overview.md)

## Why it matters
- Caching, logging, and retries were copy-pasted into every repository method. A bug fix to caching had to be applied in 40 places; three were missed.
- The checkout endpoint called six services in a specific order, and the same order was duplicated in the admin "re-place order" tool. They drifted.
- The shipping partner's SDK types leaked into the domain. When the partner changed their SDK, half the app needed changes.

## Concepts

### The main four
| Pattern | Intent | Shop example |
|:--|:--|:--|
| ⭐ adapter | make one interface look like another | `StripeGateway : IPaymentGateway` translating Stripe types |
| ⭐ facade | one simple entry point to a complex subsystem | `IPayments` contract of the Payments module hiding gateways, ledger, webhooks |
| ⭐ decorator | add behaviour around an object with the same interface | `CachedCatalogQueries` wrapping `CatalogQueries`; `HttpClient` delegating handlers |
| ⭐ proxy | control access to an object (lazy, remote, protected) | EF Core lazy-loading proxies, a typed `HttpClient` as a remote proxy, authorization proxy |

| Adapter vs facade vs decorator vs proxy | Interface | Purpose |
|:--|:--|:--|
| adapter | different from the wrapped one | translation |
| facade | new, simpler | simplification |
| decorator | same as the wrapped one | extra behaviour |
| proxy | same as the wrapped one | access control |

### Composite, bridge, flyweight
| Pattern | Intent | Shop example |
|:--|:--|:--|
| composite | treat a tree of parts and wholes uniformly | product bundles containing products and other bundles; price = sum of children |
| bridge | split abstraction from implementation so both vary | `Notification` kinds × `INotificationChannel` (email, SMS, push) |
| flyweight | share immutable state among many objects | interned strings, cached `CultureInfo`, `FrozenDictionary` of tax rates shared by all orders |

## In our stack
- Adapters for every partner: [03-backend/12-integrations](../../../03-backend/12-integrations/README.md).
- Module contracts as facades: [03-backend/11-architecture lesson 01](../../../03-backend/11-architecture/docs/01-modular-monolith-layers-modules.md).
- Decorators: resilience `DelegatingHandler`s on `HttpClient` ([03-backend/08-reliability lesson 02](../../../03-backend/08-reliability/docs/02-resilience-pipelines-httpclient.md)); HybridCache around queries ([03-backend/06-caching](../../../03-backend/06-caching/README.md)).
- Bridge: notifications × channels ([01-paradigms-oop lesson 02](../../01-paradigms-oop/docs/02-classes-composition-polymorphism.md)).

## When not to
- Don't add a facade over a subsystem with one caller and two methods; call it directly.
- Don't stack five decorators where middleware or a resilience pipeline already does the job.
- Don't build a composite tree for a flat list that never nests.

## Example
Decorator: caching without touching the real implementation
```csharp
public interface ICatalogQueries { Task<ProductSummary?> FindAsync(Sku sku, CancellationToken ct); }

internal sealed class CatalogQueries(CatalogDb db) : ICatalogQueries
{
    public Task<ProductSummary?> FindAsync(Sku sku, CancellationToken ct) =>
        db.Products.Where(p => p.Sku == sku).Select(p => new ProductSummary(p.Sku, p.Name, p.PriceMinor)).SingleOrDefaultAsync(ct);
}

internal sealed class CachedCatalogQueries(ICatalogQueries inner, HybridCache cache) : ICatalogQueries
{
    public async Task<ProductSummary?> FindAsync(Sku sku, CancellationToken ct) =>
        await cache.GetOrCreateAsync($"product:v1:{sku.Value}", async c => await inner.FindAsync(sku, c), cancellationToken: ct);
}

// registration (manual decoration; Scrutor's Decorate<> is also seen)
services.AddScoped<CatalogQueries>();
services.AddScoped<ICatalogQueries>(sp => new CachedCatalogQueries(sp.GetRequiredService<CatalogQueries>(), sp.GetRequiredService<HybridCache>()));
```
Adapter: a partner's API in our language
```csharp
public interface IShippingLabels { Task<Result<Label>> CreateAsync(Shipment shipment, CancellationToken ct); }

internal sealed class CargoCoLabels(CargoCoClient client) : IShippingLabels       // CargoCoClient = partner SDK
{
    public async Task<Result<Label>> CreateAsync(Shipment s, CancellationToken ct)
    {
        var response = await client.CreateConsignmentAsync(new CargoCoConsignment
        {
            Receiver = new() { FullName = s.To.Name, Zip = s.To.PostalCode, CountryIso = s.To.Country },
            WeightKg = s.Grams / 1000.0,
        }, ct);
        return response.Success
            ? new Label(response.TrackingNo, new Uri(response.LabelPdfUrl))
            : new Error("shipping.label_failed", response.ErrorText ?? "Label creation failed", ErrorType.Unprocessable);
    }
}
```
Composite: bundles of products
```csharp
public abstract record CatalogItem { public abstract long PriceMinor { get; } }
public sealed record SingleProduct(string Sku, long Price) : CatalogItem { public override long PriceMinor => Price; }
public sealed record Bundle(string Name, IReadOnlyList<CatalogItem> Items, int DiscountPercent) : CatalogItem
{
    public override long PriceMinor => Items.Sum(i => i.PriceMinor) * (100 - DiscountPercent) / 100;
}

var tasting = new Bundle("Tasting set", [new SingleProduct("ETH-0250", 14_90), new SingleProduct("COL-0250", 12_90),
                                          new Bundle("Mini pack", [new SingleProduct("KEN-0100", 6_90)], 0)], 10);
```
Facade: a module's simple public contract
```csharp
public interface IPayments                     // Payments module facade
{
    Task<Result<PaymentSession>> StartAsync(OrderId order, Money amount, CancellationToken ct);
    Task<PaymentStatus> StatusAsync(OrderId order, CancellationToken ct);
}
// behind it: gateways, idempotency, ledger, webhooks, reconciliation (all internal)
```

## Production patterns
- Every external SDK sits behind an adapter that speaks the domain's language.
- Cross-cutting behaviour (caching, retries, logging, metrics) is added with decorators or pipelines, not copied into methods.
- Modules expose small facades; internals stay `internal`.

## Mistakes
Wrong:
```csharp
public async Task<ProductSummary?> FindAsync(Sku sku, CancellationToken ct)
{
    if (_cache.TryGet(sku, out var cached)) return cached;   // caching + logging + retry mixed into every query
    _log.LogInformation(...); for (var i = 0; i < 3; i++) { try { ... } catch { } }
}
```
Right: a plain query plus a caching decorator; retries in the resilience pipeline.

Wrong: domain code taking `CargoCoConsignment` parameters.
Right: domain types (`Shipment`, `Label`) and an adapter.

## Check yourself
1. How do decorator and proxy differ, given that both keep the same interface?
2. What does an adapter protect you from?
3. When is a composite the right model?

<details><summary>Answers</summary>

1. A decorator adds behaviour (caching, logging, retries) around calls; a proxy controls access to the object (lazy creation, remote access, permission checks). Structurally similar, different intent.
2. Changes in, and leakage of, an external API's types and concepts: only the adapter changes when the partner's SDK changes, and tests can fake the port.
3. When items naturally form a tree where parts and wholes should be treated the same way (bundles of products and bundles, menus, org charts).
</details>

## Sources
- [Refactoring.Guru — structural patterns](https://refactoring.guru/design-patterns/structural-patterns)
- [HTTP message handlers (decorators) in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/http-requests#outgoing-request-middleware)
- [HybridCache](https://learn.microsoft.com/aspnet/core/performance/caching/hybrid)
- [Anti-corruption layer pattern](https://learn.microsoft.com/azure/architecture/patterns/anti-corruption-layer)
- [Scrutor (decoration and scanning)](https://github.com/khellang/Scrutor)
