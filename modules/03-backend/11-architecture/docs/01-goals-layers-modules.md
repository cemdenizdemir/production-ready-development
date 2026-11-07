---
title: Goals, layers, and feature modules
tech: Node.js 26, Express 5, TypeScript
version: Node.js 26 LTS, Express 5.2, TypeScript 6.0
date: 2026-11-07
covers: [1, 2, 3]
---
# Goals, layers, and feature modules
[← Overview](00-overview.md)

## Why it matters
- Adding a "gift message" to orders touches `controllers/`, `services/`, `repositories/`, `validators/`, `dtos/`, and `utils/`. Every feature is a scavenger hunt.
- The pricing rule lives in a route handler. The mobile API and the admin import each copy it slightly differently, and the three versions disagree.
- `catalog` imports from `orders`, `orders` imports from `catalog`. Nobody can change either without breaking the other, and extracting one later is impossible.

## Concepts

### What architecture is for
| Goal | Means |
|:--|:--|
| Easy to change | small, cohesive modules with clear boundaries |
| Easy to understand | predictable structure: one obvious place for each kind of code |
| Easy to test | business rules testable without HTTP or a database |
| Teams work in parallel | modules with owners and stable interfaces |
| Easy to operate | as few deployables as possible, until there's a reason for more |

Architecture is the set of decisions that are **expensive to change later**. Pick the simplest structure that keeps most changes local to one place. For most products that is a **modular monolith**: one codebase and one deployable (plus worker processes), split internally into feature modules with explicit public APIs.

### Layers inside a module
| Layer | File | Knows about | Never knows about |
|:--|:--|:--|:--|
| HTTP adapter | `orders.routes.ts` | Express, Zod input schemas, DTOs, the service | SQL, Stripe |
| Use cases | `orders.service.ts` | domain rules, repositories, ports, transactions | `req`, `res`, status codes |
| Domain | `orders.domain.ts` | types, rules, invariants (pure functions) | anything with I/O |
| Persistence | `orders.repo.ts` | Drizzle, tables, SQL | HTTP |

**The dependency rule:** source code dependencies point inward, toward the domain. The domain imports nothing from Express, Drizzle, or SDKs. Workers, CLI scripts, and tests call the same use cases as the routes.

### Organize by feature, not by technical layer
| By technical layer | By feature module |
|:--|:--|
| `controllers/`, `services/`, `repositories/` | `orders/`, `catalog/`, `payments/`, `users/` |
| a feature touches many folders | a feature stays in one folder |
| anything can import anything | each module exposes `index.ts` |
| ownership unclear | a team owns a module |
| hard to extract later | a module can become a service if needed |

| Module rule | Why |
|:--|:--|
| Other modules import only `#src/<module>/index.ts` | internals can change freely |
| Relative imports inside a module | the module is self-contained |
| A module owns its tables | others ask through its API, never query its tables |
| `shared/` stays small | errors, money, IDs, db client, logger; no business logic |
| No cycles between modules | a cycle means the boundary is in the wrong place |
| Side effects across modules via events | [lesson 04](04-events-boundaries-decisions.md) |

## Example
The layout (grown from [02-api-design lesson 01](../../02-api-design/docs/01-rest-and-express-structure.md)):
```text
src/
  server.ts               process: config, createDeps, listen, shutdown
  app.ts                  createApp(deps): middleware, routers, error handler
  deps.ts                 composition root (lesson 02)
  config.ts
  http/                   error handler, middleware (auth, request context)
  shared/                 errors, money, ids, db, redis, logger, clock
  orders/
    index.ts              public API of the module
    orders.routes.ts      HTTP adapter
    orders.service.ts     use cases
    orders.domain.ts      pure rules
    orders.repo.ts        Drizzle queries
    orders.schemas.ts     Zod input schemas
    orders.dto.ts         response shapes
    orders.events.ts      events this module publishes
  catalog/
  payments/
  notifications/
  jobs/                   worker entry point: same modules, different process
```
`src/orders/index.ts` — the only file other modules may import.
```ts
export { createOrdersService, type OrdersService } from './orders.service.ts';
export { ordersRouter } from './orders.routes.ts';
export type { Order, OrderStatus } from './orders.domain.ts';
export type { OrderPaid } from './orders.events.ts';
```
`src/orders/orders.domain.ts` — pure rules, trivially testable.
```ts
import { ConflictError, DomainError } from '#src/shared/errors.ts';

export type OrderStatus = 'pending' | 'paid' | 'payment_failed' | 'shipped' | 'cancelled';
export type OrderLine = { productId: string; quantity: number; unitPriceCents: number };
export type Order = { id: string; accountId: string; status: OrderStatus; lines: OrderLine[]; totalCents: number; createdAt: Date };
type Product = { priceCents: number; active: boolean };

export function priceOrder(items: { productId: string; quantity: number }[], products: Map<string, Product>) {
  const lines = items.map((item) => {
    const product = products.get(item.productId);
    if (!product?.active) throw new DomainError('order.product_unavailable', `Product ${item.productId} is not available`);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new DomainError('order.invalid_quantity', 'Quantity must be between 1 and 99');
    }
    return { productId: item.productId, quantity: item.quantity, unitPriceCents: product.priceCents };
  });
  const totalCents = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
  return { lines, totalCents };
}

const CANCELLABLE: ReadonlySet<OrderStatus> = new Set(['pending', 'paid']);

export function assertCancellable(order: Order): void {
  if (!CANCELLABLE.has(order.status)) throw new ConflictError('order.not_cancellable', `Order is ${order.status}`);
}
```
`src/orders/orders.routes.ts` — the HTTP adapter stays thin.
```ts
import { Router } from 'express';
import { CreateOrderBody, OrderIdParams } from './orders.schemas.ts';
import { toOrderDTO } from './orders.dto.ts';
import type { OrdersService } from './orders.service.ts';

export function ordersRouter(orders: OrdersService) {
  const router = Router();
  router.post('/', async (req, res) => {
    const order = await orders.create(req.user!.accountId, CreateOrderBody.parse(req.body));
    res.status(201).location(`/v1/orders/${order.id}`).json(toOrderDTO(order));
  });
  router.post('/:orderId/cancellation', async (req, res) => {
    const { orderId } = OrderIdParams.parse(req.params);
    res.json(toOrderDTO(await orders.cancel(req.user!.accountId, orderId)));
  });
  return router;
}
```
A domain test needs no server, database, or mocks:
```ts
import { expect, test } from 'vitest';
import { priceOrder } from './orders.domain.ts';

test('prices lines from the catalog, not from the client', () => {
  const products = new Map([['p1', { priceCents: 1_250, active: true }]]);
  expect(priceOrder([{ productId: 'p1', quantity: 2 }], products).totalCents).toBe(2_500);
});

test('rejects inactive products', () => {
  const products = new Map([['p1', { priceCents: 1_250, active: false }]]);
  expect(() => priceOrder([{ productId: 'p1', quantity: 1 }], products)).toThrow(/not available/);
});
```

## Production patterns
- **Modular monolith by default**: feature modules, one deployable for the API, worker processes from the same code.
- **Thin adapters, pure domain**: routes parse and respond, use cases orchestrate, domain functions decide.
- **Public `index.ts` per module**, relative imports inside, no reaching into other modules' files or tables.
- **A small `shared/`** for technical building blocks only.
- **The same use cases** called from routes, workers, scripts, and tests.

## Mistakes
Wrong: business rules in the route.
```ts
router.post('/orders', async (req, res) => {
  const total = req.body.items.reduce((s, i) => s + i.price * i.qty, 0); // trusts client prices; copied into 3 places
  await db.insert(orders).values({ total, ... });
});
```
Right: the route calls `orders.create()`; prices come from the catalog inside `priceOrder()`.

Wrong: deep imports across modules.
```ts
import { ordersTable } from '#src/orders/orders.repo.ts'; // catalog now depends on orders' internals
```
Right: import from `#src/orders/index.ts`, or ask the orders module through its service.

Wrong: a `utils/` or `shared/` folder that collects business logic. It becomes the module everything depends on. Right: put the logic in the module that owns the concept.

Wrong: designing twelve microservices for a new product. Right: a modular monolith whose boundaries can become services later, if a real need appears.

## Check yourself
1. What does "dependencies point inward" mean for the files in a module?
2. Why organize by feature instead of by technical layer?
3. What belongs in `shared/`, and what doesn't?

<details>
<summary>Answers</summary>

1. Routes and repositories import the service and domain; the domain imports nothing from Express, Drizzle, or SDKs. Business rules then don't change when HTTP or database details change, and they can be tested in isolation.
2. Changes usually follow features. With feature modules, a change stays in one folder, ownership is clear, the public API (`index.ts`) hides internals, and a module can be extracted later. Layer folders spread every feature everywhere and let anything import anything.
3. Technical building blocks used by many modules: error base classes, money helpers, ID generation, the db and Redis clients, logger, clock. Business rules don't belong there; they belong to the module that owns the concept.
</details>

## Sources
- [Martin Fowler — Monolith first](https://martinfowler.com/bliki/MonolithFirst.html)
- [Robert C. Martin — The clean architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Martin Fowler — Bounded context](https://martinfowler.com/bliki/BoundedContext.html)
