---
title: Frontend patterns, anti-patterns, choosing, and .NET's built-in patterns
tech: C# 14, ASP.NET Core 10, React 19.2 + TypeScript
version: C# 14 / .NET 10, React 19.2, Next.js 16
date: 2026-11-09
covers: [10, 11, 12, 13]
---
# Frontend patterns, anti-patterns, choosing, and .NET's built-in patterns
[← Overview](00-overview.md)

## Why it matters
- A React product page component fetched data, held form state, formatted prices, and rendered 400 lines of markup. Reusing the price display elsewhere meant copying half of it.
- A codebase had `OrderServiceLocator.Resolve<T>()` calls in 200 places. Nobody could tell what a class needed until it crashed at runtime.
- A developer wrote their own options loading, retry handler, and middleware-like pipeline, re-implementing what ASP.NET Core already provides.

## Concepts

### Frontend patterns (React 19 / Next.js 16)
| Pattern | Intent | Shop example |
|:--|:--|:--|
| ⭐ container / presentational | separate data fetching from rendering | Server Component loads product data; `<ProductCard>` only renders props |
| ⭐ custom hooks | reuse stateful logic | `useCart()`, `useDebouncedSearch()` |
| ⭐ composition (children, slots) | build UIs from small parts instead of config flags | `<Card><Card.Header/>...</Card>` rather than `<Card showHeader titleAlign="left" .../>` |
| compound components | related components sharing implicit state | `<Tabs><Tabs.List/><Tabs.Panel/></Tabs>` via context |
| ⭐ providers | make shared state/services available below | `QueryClientProvider` (TanStack Query), theme, cart context |
| server/client split | data on the server, interactivity on the client | `"use client"` only where needed (02-frontend) |

### Anti-patterns
| Anti-pattern | Symptom | Way out |
|:--|:--|:--|
| ⭐ god object | one class/module knows and does everything | split by responsibility (02-principles) |
| ⭐ service locator | `IServiceProvider.GetService<T>()` in business code | constructor injection |
| ⭐ singleton abuse | static mutable state, global caches | DI lifetimes, `IOptions<T>`, HybridCache |
| ⭐ pattern-itis | `OrderStrategyFactoryProviderManager` | inline; keep the simplest working design |
| ⭐ big ball of mud | no boundaries, everything references everything | modules, contracts, architecture tests (03-backend/11-architecture) |
| anemic domain model | entities are bags of setters; services hold all rules | move behaviour onto entities and value objects |
| magic strings | stringly typed statuses, config keys | enums, constants, options classes, `nameof` |
| golden hammer | one pattern (or library) for every problem | choose per problem |

### Choosing a pattern
| Step | Question |
|:--|:--|
| ⭐ problem first | what hurts? which change is expensive? |
| ⭐ simplest thing | would a function, a `switch`, or a small class do? |
| rule of three | have we seen this variation three times? |
| ⭐ refactor towards | introduce the pattern in a refactoring PR with tests (02-principles lesson 04) |
| refactor away | remove the pattern when its forces disappear (one strategy left, decorator no longer needed) |
| team fluency | will the team recognise and maintain it? |

### Patterns built into .NET
| .NET feature | Pattern |
|:--|:--|
| ⭐ ASP.NET Core middleware | chain of responsibility |
| ⭐ `HttpClient` `DelegatingHandler`s, resilience pipelines | decorator, chain |
| ⭐ `IOptions<T>` / `IOptionsMonitor<T>` / `IOptionsSnapshot<T>` | options pattern (typed configuration, validation, reload) |
| ⭐ DI container, `IHttpClientFactory`, `IDbContextFactory<T>` | factory, singleton (managed), abstract factory |
| `IEnumerable<T>` / `yield return` / `IAsyncEnumerable<T>` | iterator |
| `DbContext` / `DbSet<T>` | unit of work, repository |
| `IObservable<T>` / C# events | observer |
| `BackgroundService` | template method |
| endpoint filters, MVC filters | chain of responsibility / decorator |
| `IHostedService` + `IHostApplicationLifetime` | lifecycle hooks |
| decorators via DI | manual registration or Scrutor `Decorate` (also seen) |

## In our stack
- Frontend structure, Server Components, TanStack Query providers: [02-frontend/04-framework](../../../02-frontend/04-framework/README.md), [02-frontend/05-state-management](../../../02-frontend/05-state-management/README.md).
- Options pattern with validation: [01-foundations/07-config-environments](../../../01-foundations/07-config-environments/README.md).
- Middleware and filters: [03-backend/02-api-design](../../../03-backend/02-api-design/README.md).
- Architecture tests against the big ball of mud: [03-backend/11-architecture lesson 06](../../../03-backend/11-architecture/docs/06-microservices-adrs-boundaries.md).

## When not to
- Don't introduce compound components or providers for a component used once; props are fine.
- Don't write your own middleware framework, options loader, or retry wrapper when ASP.NET Core and Microsoft.Extensions already provide one.
- Don't refactor working, rarely changed code towards a pattern just because you spotted the opportunity.

## Example
Container/presentational with a Server Component (Next.js 16):
```tsx
// app/products/[slug]/page.tsx (container: data on the server)
import { getProduct } from "@/lib/api/products";        // Orval-generated client
import { ProductCard } from "@/components/product-card";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  return <ProductCard name={product.name} priceMinor={product.priceMinor} currency={product.currency} />;
}
```
```tsx
// components/product-card.tsx (presentational: props in, markup out)
import { formatMoney } from "@/lib/money";

export function ProductCard({ name, priceMinor, currency }: { name: string; priceMinor: number; currency: string }) {
  return (
    <article className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold">{name}</h2>
      <p>{formatMoney(priceMinor, currency)}</p>
    </article>
  );
}
```
A custom hook:
```tsx
"use client";
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```
Service locator removed:
```csharp
// Wrong
public sealed class RefundHandler(IServiceProvider sp)
{
    public Task HandleAsync(Refund r) => sp.GetRequiredService<IPaymentGateway>().RefundAsync(r);   // hidden dependency
}

// Right
public sealed class RefundHandler(IPaymentGateway payments)
{
    public Task HandleAsync(Refund r) => payments.RefundAsync(r);
}
```
The options pattern instead of a static settings singleton:
```csharp
public sealed class CheckoutOptions
{
    [Range(1, 50)] public int MaxLines { get; init; } = 50;
    [Required] public string DefaultCurrency { get; init; } = "EUR";
}

builder.Services.AddOptions<CheckoutOptions>().BindConfiguration("Checkout").ValidateDataAnnotations().ValidateOnStart();
public sealed class CartService(IOptions<CheckoutOptions> options) { /* options.Value.MaxLines */ }
```

## Production patterns
- Frontend: Server Components as containers, small presentational components, custom hooks for reusable logic, providers only for truly shared state.
- Backend: use the framework's built-in patterns (middleware, handlers, options, factories) before writing your own.
- Patterns appear through refactoring when a real problem repeats, and disappear when the problem does; anti-patterns are named in reviews with a concrete way out.

## Mistakes
Wrong: `<ProductCard showPrice showRating compact variant="b" hideImage onlyTitle />` (flags instead of composition).
Right: compose small components; each variant composes what it needs.

Wrong: `static class AppSettings { public static string StripeKey = ""; }` set at startup.
Right: `IOptions<StripeOptions>` with validation, injected.

## Check yourself
1. What does the container/presentational split buy you in Next.js?
2. Why is a service locator an anti-pattern?
3. Name three patterns ASP.NET Core gives you out of the box.

<details><summary>Answers</summary>

1. Data fetching stays on the server (security, performance, no client waterfalls), and presentational components are simple, reusable, and easy to test and render in isolation.
2. It hides dependencies inside method bodies, so you can't see what a class needs, mistakes fail at runtime instead of startup, and testing requires setting up a container.
3. Any three of: middleware (chain of responsibility), `HttpClient` delegating handlers (decorator), the options pattern, DI factories and lifetimes, iterators via `IEnumerable`/`IAsyncEnumerable`, unit of work/repository via `DbContext`, template method via `BackgroundService`.
</details>

## Sources
- [patterns.dev — React patterns](https://www.patterns.dev/react)
- [React — Reusing logic with custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Options pattern in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/configuration/options)
- [Mark Seemann — Service Locator is an anti-pattern](https://blog.ploeh.dk/2010/02/03/ServiceLocatorisanAnti-Pattern/)
- [Brian Foote & Joseph Yoder — Big Ball of Mud](http://www.laputan.org/mud/)
- [ASP.NET Core middleware](https://learn.microsoft.com/aspnet/core/fundamentals/middleware/)
