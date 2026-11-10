---
title: Services, repositories, and modeling in TypeScript
tech: TypeScript, Node.js 26, Zod 4
version: TypeScript 6.0, Node.js 26 LTS, Zod 4
date: 2026-11-07
covers: [8, 9]
---
# Services, repositories, and modeling in TypeScript
[← Overview](00-overview.md)

## Why it matters
- Every service function takes `string` IDs. `refund(orderId, customerId)` is called with the arguments swapped; TypeScript doesn't notice, and the wrong account gets refunded.
- Validation is repeated in routes, jobs, and admin scripts, and the three versions disagree on the allowed quantity range.
- A "domain service" grows into a god object holding every rule, and the entities become empty data bags.

## Concepts

### Where logic lives
| Block | Holds | Example |
|:--|:--|:--|
| Entity / aggregate method | rules about one aggregate's own state | `order.place()`, `cart.addLine()` |
| Value object | rules about a value | `Money.add`, `EmailAddress.parse` |
| Domain service | domain logic that doesn't belong to one aggregate | `priceCart(cart, promotions)`, `allocateStock(order, warehouses)` |
| Application service (use case) | workflow: load, call domain, save, publish; transactions; authorization | `placeOrder`, `cancelOrder` |
| Factory | complex creation with invariants | `Order.fromCart(cart, prices)` |
| Repository | collection-like access to aggregates | `orders.get(id)`, `orders.save(order)` |
| Policy | "whenever X happens, do Y" | on `OrderPaid` → request shipment |

Domain services are **stateless** and named in the ubiquitous language; application services are thin orchestrators with no business rules.

### Repositories in DDD
| Rule | Detail |
|:--|:--|
| One per aggregate root | `OrderRepository`, not `OrderLineRepository` |
| Collection semantics | `get`, `save`, `nextId`, a few intention-revealing finders |
| Return aggregates, not rows | mapping happens inside |
| Interface in the domain/application layer | implementation in adapters (Drizzle) |
| Reads for screens bypass repositories | query modules / read models (CQRS-lite) |

### Making illegal states unrepresentable
| Technique | TypeScript |
|:--|:--|
| Branded IDs | `type OrderId = string & { readonly __brand: 'OrderId' }` |
| Smart constructors | `EmailAddress.parse(input)` returns a result; the only way to get a value |
| Parse, don't validate | turn unknown input into typed domain values once, at the edge |
| State-specific types | `DraftOrder` vs `PlacedOrder` when states have different data |
| Immutability | `readonly` fields, new values instead of mutation |
| Exhaustive unions | `switch` + `assertNever` over statuses and events |

## Example
Branded IDs and smart constructors with Zod at the edge:
```ts
// shared/ids.ts
import { z } from 'zod';
export const OrderId = z.uuid().brand<'OrderId'>();
export type OrderId = z.infer<typeof OrderId>;
export const CustomerId = z.uuid().brand<'CustomerId'>();
export type CustomerId = z.infer<typeof CustomerId>;

// ordering/domain/email.ts — a value object with a smart constructor
export class EmailAddress {
  readonly value: string;
  private constructor(value: string) { this.value = value; }
  static parse(input: string): EmailAddress {
    const normalized = input.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new DomainError('email.invalid', 'Invalid email address');
    return new EmailAddress(normalized);
  }
  equals(other: EmailAddress) { return this.value === other.value; }
}

// refund(orderId, customerId) with swapped arguments no longer compiles
declare function refund(orderId: OrderId, customerId: CustomerId): Promise<void>;
```
State-specific types when data differs per state:
```ts
type DraftOrder = { state: 'draft'; id: OrderId; lines: OrderLine[] };
type PlacedOrder = { state: 'placed'; id: OrderId; lines: OrderLine[]; placedAt: Date; total: Money };
type PaidOrder = Omit<PlacedOrder, 'state'> & { state: 'paid'; paymentId: string; paidAt: Date };

// A paid order always has a paymentId; a draft never does
export function pay(order: PlacedOrder, paymentId: string, now: Date): PaidOrder {
  return { ...order, state: 'paid', paymentId, paidAt: now };
}
```
A domain service and a thin application service:
```ts
// pricing/domain/price-cart.ts — domain service: rules across cart, products, and promotions
export function priceCart(lines: readonly CartLine[], prices: ReadonlyMap<ProductId, Money>, promotions: readonly Promotion[]): PricedCart {
  const priced = lines.map((l) => {
    const unit = prices.get(l.productId);
    if (!unit) throw new DomainError('pricing.unknown_product', `No price for ${l.productId}`);
    return { ...l, unitPrice: unit, lineTotal: unit.multiply(l.quantity) };
  });
  const subtotal = priced.reduce((s, l) => s.add(l.lineTotal), Money.zero('EUR'));
  const discount = bestPromotion(promotions, priced, subtotal);       // rule: promotions don't stack
  return { lines: priced, subtotal, discount, total: subtotal.subtract(discount) };
}

// ordering/application/place-order.ts — application service: orchestration only
export function makePlaceOrder(deps: { carts: CartRepository; orders: OrderRepository; catalog: CatalogPrices; promotions: PromotionsReader; uow: UnitOfWork; clock: () => Date }) {
  return async (customerId: CustomerId, cartId: CartId): Promise<OrderId> => {
    const cart = await deps.carts.get(cartId);
    if (cart.customerId !== customerId) throw new ForbiddenError('cart.not_yours', 'Not your cart');   // authorization in the use case
    const priced = priceCart(cart.lines, await deps.catalog.pricesFor(cart.productIds()), await deps.promotions.active());
    const order = Order.fromPricedCart(await deps.orders.nextId(), customerId, priced);                  // factory keeps invariants
    order.place(deps.clock());
    await deps.uow.run(async (tx) => {
      await deps.orders.save(tx, order);                     // also writes order.pullEvents() to the outbox
      await deps.carts.remove(tx, cart.id);
    });
    return order.id;
  };
}
```
`remove` on the cart and `save` on the order in one transaction looks like "two aggregates, one transaction". It's acceptable here because the cart is being discarded; if in doubt, delete the cart from an `OrderPlaced` handler instead.

## In our stack
- Zod at the edges (`parse, don't validate`): [03-backend/05-validation-abuse](../../../03-backend/05-validation-abuse/README.md).
- Application services as use cases owning transactions: [03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-transactions.md).
- Specification and repository patterns: [03-design-patterns lesson 04](../../03-design-patterns/docs/04-application-frontend-antipatterns.md).

## When not to
- No state-specific types for every status; use them when states carry different data.
- No domain service for logic that clearly belongs to one aggregate (that leads to anemic models).
- No repositories for read-only screen queries; use query modules.

## Production patterns
- **Branded IDs and smart constructors** for everything that's easy to mix up or must be valid.
- **Parse untrusted input once at the edge** into domain types.
- **Rules in aggregates and value objects first**, domain services for cross-aggregate logic, thin application services.
- **One repository per aggregate root**, mapping hidden inside.

## Mistakes
Wrong: primitive obsession.
```ts
function transfer(from: string, to: string, amount: number) {} // which string is which? cents or euros?
```
Right: `transfer(from: AccountId, to: AccountId, amount: Money)`.

Wrong: application services full of `if` rules; entities with only getters and setters. Right: rules inside the model; services orchestrate.

Wrong: repositories per table (`OrderLineRepository`) that let callers change children directly. Right: one repository per aggregate root.

## Check yourself
1. What's the difference between a domain service and an application service?
2. What does "parse, don't validate" mean?
3. Why does a repository return aggregates instead of rows?

<details>
<summary>Answers</summary>

1. A domain service contains business rules that don't belong to a single aggregate (pricing a cart with promotions) and uses only domain types. An application service orchestrates a use case: loads aggregates, calls domain logic, handles transactions, authorization, and publishing, without business rules of its own.
2. Convert untrusted input into precise domain types once at the boundary (failing if it can't), so the rest of the code receives values that are valid by construction, instead of checking raw data repeatedly in many places.
3. Callers should work with the model and its rules, not with storage details; returning rows would let them bypass invariants and couple them to the schema. The repository hides the mapping between rows and aggregates.
</details>

## Sources
- [Alexis King — Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)
- [Zod — Branded types](https://zod.dev/api#branded-types)
- [Martin Fowler — Repository](https://martinfowler.com/eaaCatalog/repository.html)
- [Microsoft — Designing a DDD-oriented microservice (layers and services)](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/ddd-oriented-microservice)
