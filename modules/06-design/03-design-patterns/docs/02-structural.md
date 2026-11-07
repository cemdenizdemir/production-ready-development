---
title: Structural patterns
tech: TypeScript 6 (strict), Node.js 26
version: TypeScript 6.0, Node.js 26 LTS
date: 2026-11-07
covers: [4, 5]
---
# Structural patterns
[← Overview](00-overview.md)

## Why it matters
- Retry, timeout, metrics, and caching code is copy-pasted into every partner client. One client forgets the timeout and hangs during an outage.
- Business code calls the shipping provider's SDK with its 40 options. When the provider changes, half the codebase changes.
- A category tree is rendered with special cases for "category" and "product" nodes everywhere, and a new "bundle" node needs edits in eight places.

## Concepts

| Pattern | Problem | Shape | Everyday example |
|:--|:--|:--|:--|
| Adapter | an interface doesn't fit what the client expects | wrapper that translates calls and data | Stripe adapter behind `PaymentGateway` |
| Facade | a subsystem is complex to use | one simple entry point over many parts | `checkout()` hiding pricing, stock, payment |
| Decorator | add behavior without changing the object | wrapper with the **same interface** | retry, timeout, metrics, caching around a client |
| Proxy | control access to an object | stand-in with the same interface | lazy loading, access checks, remote proxies |
| Composite | treat single items and groups uniformly | tree of nodes sharing an interface | category trees, UI component trees, bundles |
| Bridge | two dimensions vary independently | abstraction holds an implementation | notification type × channel |
| Flyweight | many similar objects use too much memory | share the immutable part | interned strings, shared icons, cached formatters |

Adapter vs decorator vs proxy: an **adapter** changes the interface; a **decorator** keeps the interface and adds behavior; a **proxy** keeps the interface and controls access. A **facade** offers a *new, simpler* interface over several objects.

## Example
Decorators stacked around a port (same interface, added behavior):
```ts
export interface ProductCatalog { get(id: string): Promise<Product | undefined> }

export const withTimeout = (inner: ProductCatalog, ms: number): ProductCatalog => ({
  get: (id) => Promise.race([
    inner.get(id),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`catalog timeout after ${ms} ms`)), ms).unref()),
  ]),
});

export const withCache = (inner: ProductCatalog, cache: Map<string, { value: Product | undefined; at: number }>, ttlMs: number): ProductCatalog => ({
  async get(id) {
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;
    const value = await inner.get(id);
    cache.set(id, { value, at: Date.now() });
    return value;
  },
});

export const withMetrics = (inner: ProductCatalog, record: (ms: number, ok: boolean) => void): ProductCatalog => ({
  async get(id) {
    const start = performance.now();
    try { const v = await inner.get(id); record(performance.now() - start, true); return v; }
    catch (err) { record(performance.now() - start, false); throw err; }
  },
});

// Composition root: order matters (cache outside the timeout, metrics outermost)
const catalog = withMetrics(withCache(withTimeout(httpCatalog, 800), new Map(), 60_000), recordCatalogLatency);
```
`Promise.race` doesn't cancel the inner call; real clients pass an `AbortSignal` through ([03-backend/08-reliability](../../../03-backend/08-reliability/docs/01-failure-modes-timeouts-retries.md)).

Adapter: translate a vendor API into the core's port.
```ts
// The core's port
export interface ShippingLabels { create(input: { orderId: string; address: Address; weightGrams: number }): Promise<{ trackingId: string; labelUrl: string }> }

// Adapter over a vendor SDK with different names and units
export function createAcmeShippingAdapter(sdk: AcmeSdk): ShippingLabels {
  return {
    async create({ orderId, address, weightGrams }) {
      const res = await sdk.shipments.new({
        reference: orderId,
        recipient: { fullName: address.name, street: address.line1, zip: address.postalCode, city: address.city, cc: address.country },
        parcel: { weightKg: weightGrams / 1000 },
      });
      return { trackingId: res.tracking_number, labelUrl: res.documents.label_pdf };
    },
  };
}
```
Facade: one entry point for a workflow.
```ts
export function createCheckoutFacade(deps: { pricing: Pricing; stock: Stock; payments: PaymentGateway; orders: Orders }) {
  return {
    async checkout(cart: Cart, payment: PaymentInput) {
      const total = deps.pricing.total(cart);
      await deps.stock.reserve(cart.lines);
      const result = await deps.payments.charge({ ...payment, amountCents: total });
      return result.ok ? deps.orders.confirm(cart, result.paymentId) : deps.stock.release(cart.lines).then(() => result);
    },
  };
}
```
Composite: one interface for items and groups.
```ts
type PriceNode =
  | { kind: 'product'; sku: string; priceCents: number }
  | { kind: 'bundle'; name: string; discountPercent: number; children: PriceNode[] };

export function priceOf(node: PriceNode): number {
  switch (node.kind) {
    case 'product': return node.priceCents;
    case 'bundle': {
      const sum = node.children.reduce((total, child) => total + priceOf(child), 0);
      return Math.round(sum * (1 - node.discountPercent / 100));
    }
  }
}
```

## In our stack
- Adapters: Stripe, SES, S3 behind ports ([03-backend/12-integrations](../../../03-backend/12-integrations/README.md)).
- Decorators: `fetchJson` wrapping `fetch` with timeouts and retries; breakers and bulkheads wrapping calls ([03-backend/08-reliability lesson 03](../../../03-backend/08-reliability/docs/03-breakers-bulkheads-load-shedding.md)); Express middleware decorating handlers.
- Proxy: CloudFront in front of S3; Drizzle's lazy query objects.
- Composite: React component trees; category trees.

## When not to
- No decorator chain for one behavior used once; inline it.
- No facade that just forwards one call to one object (a "middle man").
- `Proxy` objects in business code hide behavior from readers and debuggers; prefer explicit wrappers.

## Production patterns
- **Cross-cutting behavior as decorators** with the same interface: retries, timeouts, caching, metrics, logging.
- **Adapters at every external boundary**, translating names, units, and errors.
- **Facades for workflows** used by routes, jobs, and scripts.
- **Composites (unions + recursion)** for trees.

## Mistakes
Wrong: copy-pasting retry/timeout logic into every client. Right: one decorator, applied in the composition root.

Wrong: an "adapter" that exposes the vendor's types (`Promise<AcmeShipment>`). The core is still coupled. Right: return the core's types.

Wrong: decorators that change the contract (throwing new error types, changing return shapes). Right: same interface, same semantics, plus behavior.

## Check yourself
1. What's the difference between an adapter and a decorator?
2. Why does the order of stacked decorators matter? Give an example.
3. When is a facade useful, and when is it just a middle man?

<details>
<summary>Answers</summary>

1. An adapter converts one interface into another that the client expects; a decorator keeps the same interface and adds behavior around it, so it can wrap any implementation of that interface.
2. Each decorator sees the calls the outer ones let through. Cache outside retries means cache hits skip retries entirely; retries outside a timeout give each attempt its own timeout, while a timeout outside retries bounds the total time. Metrics outermost measure what callers experience.
3. Useful when it simplifies a multi-step interaction across several parts (checkout across pricing, stock, payment) and gives routes, jobs, and scripts one entry point. It's a middle man when it only forwards single calls without hiding any complexity.
</details>

## Sources
- [refactoring.guru — Structural patterns](https://refactoring.guru/design-patterns/structural-patterns)
- [refactoring.guru — Decorator](https://refactoring.guru/design-patterns/decorator)
- [refactoring.guru — Adapter](https://refactoring.guru/design-patterns/adapter)
- [MDN — Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
