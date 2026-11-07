---
title: Domain logic, errors, and transactions
tech: TypeScript, Express 5, Drizzle ORM
version: TypeScript 6.0, Express 5.2, Drizzle ORM 0.45, PostgreSQL 18, Zod 4
date: 2026-11-07
covers: [5, 6, 11]
---
# Domain logic, errors, and transactions
[← Overview](00-overview.md)

## Why it matters
- Error classes carry HTTP status codes, so a BullMQ worker that reuses the checkout logic logs "404" for a missing product that has nothing to do with HTTP.
- Checkout calls Stripe inside a database transaction. Stripe slows down, transactions stay open for 10 seconds holding row locks, the pool runs dry, and the whole API stalls.
- The order row is saved, then the stock update fails. There's no transaction around the two, so the shop sells stock it doesn't have.

## Concepts

### Where each rule lives
| Rule | Put it in |
|:--|:--|
| Pricing, discounts, "quantity 1–99", "only pending or paid orders can be cancelled" | domain functions (pure) |
| "Body is valid JSON with a UUID and an integer" | Zod schema at the edge (route, job payload) |
| "Users only see their own account's orders" | use case + repository queries scoped by account |
| "SKU is unique" | database constraint, translated into a domain error |
| Workflows: price → reserve stock → charge → confirm | use case (service method) |

Plain data types plus pure functions work well in TypeScript; classes are optional. **Value objects** make rules hard to break:
| Value | Representation |
|:--|:--|
| Money | integer minor units + currency (`{ amountCents: 4599, currency: 'eur' }`), never floats |
| IDs | branded types (`string & { readonly __brand: 'OrderId' }`, Zod `.brand()`), so an `AccountId` can't be passed as an `OrderId` |
| Quantities, emails, SKUs | validated once at creation, then trusted |
| Status | a union of string literals plus allowed transitions |

### Error architecture
| Layer | Produces | Example |
|:--|:--|:--|
| Domain | `DomainError` with a stable `code` | `order.not_cancellable` |
| Use cases | domain errors, `NotFoundError`, `ForbiddenError`, `ConflictError` | `order.not_found` |
| Adapters | provider and database errors translated into domain terms | Stripe card error → `{ ok: false }`; unique violation → `ConflictError('catalog.sku_taken')` |
| HTTP error handler | status code + problem+json, the **only** place that knows HTTP | `NotFoundError` → 404, `ConflictError` → 409, other `DomainError` → 422, unknown → 500 |
| Worker | decides retry or not | `DomainError` → `UnrecoverableError`; others → retry |

Expected outcomes can be **results** instead of exceptions (`{ ok: false, reason: 'declined' }`); exceptions are for things the caller can't sensibly handle in normal flow. This evolves [02-api-design lesson 02](../../02-api-design/docs/02-validation-errors-responses.md), where `AppError` carried an HTTP status: fine for small apps, but as the domain grows, status codes move out of the domain.

### Transactions and consistency boundaries
| Rule | Why |
|:--|:--|
| The use case owns the transaction | it knows which writes belong together; routes and repositories don't |
| Repositories accept a `tx` (unit of work) | several repositories, one commit |
| **No network calls inside a transaction** | locks and pool connections are held while you wait on Stripe |
| Data that must stay consistent is written together | order + lines + stock reservation in one transaction |
| Side effects after commit go through the outbox | emails and webhooks only for committed changes ([07-background-jobs lesson 04](../../07-background-jobs/docs/04-outbox-messaging-monitoring.md)) |
| Concurrent edits | optimistic locking (`version` column, `UPDATE … WHERE version = $n`) or `SELECT … FOR UPDATE` ([03-databases lesson 03](../../03-databases/docs/03-transactions-pg-connections.md)) |
| Across modules | a shared transaction is possible in a monolith (same database) but couples modules; keep it rare |

## Example
`src/shared/errors.ts` — no HTTP in here.
```ts
export class DomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity}.not_found`, `${entity} ${id} not found`);
  }
}
export class ConflictError extends DomainError {}
export class ForbiddenError extends DomainError {}
```
`src/shared/db.ts` (types) — one handle type for "the db or a transaction".
```ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema.ts';                 // re-exports every module's tables

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;
```
`src/orders/orders.service.ts` — checkout owns its transactions and keeps the network call outside them.
```ts
import type { Db } from '#src/shared/db.ts';
import { DomainError } from '#src/shared/errors.ts';
import { appendOutbox } from '#src/shared/outbox.ts';
import type { CatalogService } from '#src/catalog/index.ts';
import type { PaymentGateway } from '#src/payments/index.ts';
import { priceOrder } from './orders.domain.ts';
import * as ordersRepo from './orders.repo.ts';

type Deps = { db: Db; catalog: CatalogService; payments: PaymentGateway; clock: () => Date };
type CheckoutInput = { items: { productId: string; quantity: number }[]; customerRef: string; paymentMethodRef: string };

export type OrdersService = ReturnType<typeof createOrdersService>;

export function createOrdersService({ db, catalog, payments, clock }: Deps) {
  return {
    async checkout(accountId: string, input: CheckoutInput) {
      const products = await catalog.getProducts(input.items.map((i) => i.productId));
      const priced = priceOrder(input.items, products);                 // pure rules; may throw DomainError

      // 1. Short transaction: the pending order and the stock reservation commit together
      const order = await db.transaction(async (tx) => {
        const created = await ordersRepo.insert(tx, { accountId, ...priced, status: 'pending', createdAt: clock() });
        await catalog.reserveStock(tx, priced.lines);                   // ConflictError if out of stock → rollback
        return created;
      });

      // 2. The network call happens outside any transaction, idempotent per order
      const result = await payments.charge({
        orderId: order.id,
        amountCents: order.totalCents,
        currency: 'eur',
        customerRef: input.customerRef,
        paymentMethodRef: input.paymentMethodRef,
        idempotencyKey: `order-${order.id}`,
      });

      // 3. Record the outcome; follow-up work goes to the outbox in the same transaction
      if (!result.ok) {
        await db.transaction(async (tx) => {
          await catalog.releaseStock(tx, priced.lines);
          await ordersRepo.setStatus(tx, order.id, 'payment_failed');
        });
        throw result.reason === 'declined'
          ? new DomainError('payment.declined', 'The payment was declined')
          : new DomainError('payment.unavailable', 'Payments are temporarily unavailable');
      }
      return db.transaction(async (tx) => {
        const paid = await ordersRepo.markPaid(tx, order.id, result.paymentId);
        await appendOutbox(tx, { topic: 'order.paid', payload: { orderId: order.id, accountId } });
        return paid;
      });
    },
  };
}
```
If the process dies between steps 2 and 3, or the charge result was ambiguous (timeout), the card may be charged while the order isn't marked paid. The Stripe webhook ([12-integrations](../../12-integrations/README.md)) reconciles it: mark the order paid, or refund. Design for that gap instead of pretending it can't happen.

`src/http/error-handler.ts` — the only place that maps domain errors to HTTP.
```ts
import type { ErrorRequestHandler } from 'express';
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from '#src/shared/errors.ts';

const STATUS_BY_CODE: Record<string, number> = { 'payment.declined': 402, 'payment.unavailable': 503 };
const TITLES: Record<number, string> = {
  402: 'Payment required', 403: 'Forbidden', 404: 'Not found', 409: 'Conflict', 422: 'Unprocessable content', 503: 'Service unavailable',
};

function statusFor(err: DomainError): number {
  if (Object.hasOwn(STATUS_BY_CODE, err.code)) return STATUS_BY_CODE[err.code]!;
  if (err instanceof NotFoundError) return 404;
  if (err instanceof ForbiddenError) return 403;
  if (err instanceof ConflictError) return 409;
  return 422;                                                          // any other business rule
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Zod validation errors: 422 with field errors, as in 02-api-design lesson 02
  if (err instanceof DomainError) {
    const status = statusFor(err);
    res.status(status).type('application/problem+json').json({
      type: `https://api.example.com/problems/${err.code}`,
      title: TITLES[status],
      status,
      detail: err.message,
      code: err.code,                                                  // stable, for clients and dashboards
    });
    return;
  }
  req.log.error({ err }, 'unhandled error');                          // unexpected: log once, here
  res.status(500).type('application/problem+json').json({ type: 'about:blank', title: 'Internal server error', status: 500 });
};
```
An adapter translating a database error into domain terms:
```ts
// src/catalog/catalog.repo.ts
export async function insertProduct(db: DbOrTx, row: NewProduct) {
  try {
    const [product] = await db.insert(products).values(row).returning();
    return product!;
  } catch (err) {
    if (isUniqueViolation(err, 'products_sku_key')) throw new ConflictError('catalog.sku_taken', `SKU ${row.sku} already exists`);
    throw err;
  }
}

// src/shared/pg-errors.ts — Postgres error 23505; Drizzle may wrap the driver error in `cause`
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  const pg = (err instanceof Error && err.cause) || err;
  return typeof pg === 'object' && pg !== null
    && (pg as { code?: unknown }).code === '23505'
    && (pg as { constraint?: unknown }).constraint === constraint;
}
```

## Production patterns
- **Business rules as pure functions** over plain types; value objects for money, IDs, and statuses.
- **Domain errors with stable codes**; HTTP status codes only in the HTTP error handler; workers map them to retry or no retry.
- **Use cases own short transactions**; repositories take `tx`; network calls stay outside.
- **Outbox for post-commit side effects**, and reconciliation for the gaps that remain.
- **Constraint violations translated** at the repository, so callers see `ConflictError`, not `23505`.

## Mistakes
Wrong: HTTP inside the domain.
```ts
throw new AppError(404, 'not-found', 'Product not found'); // in pricing code also used by workers and scripts
```
Right: `throw new NotFoundError('product', id)`; the HTTP layer maps it to 404.

Wrong: a network call inside a transaction.
```ts
await db.transaction(async (tx) => {
  await ordersRepo.insert(tx, order);
  await stripe.paymentIntents.create(...); // holds locks and a pool connection while Stripe responds
});
```
Right: commit, call the provider, then record the outcome in a second short transaction.

Wrong: each repository opens its own transaction. Two writes that belong together commit separately. Right: the use case opens one transaction and passes `tx` to every repository.

Wrong: floating-point money (`19.99 * 3`). Rounding errors appear in totals and refunds. Right: integer cents, formatted only at the edge.

## Check yourself
1. Why should domain errors carry codes rather than HTTP status codes?
2. Why must the Stripe call stay outside the database transaction, and what risk remains?
3. Where does a unique-constraint violation get translated, and into what?

<details>
<summary>Answers</summary>

1. The same rules run in HTTP handlers, workers, CLI scripts, and tests. A code (`order.not_cancellable`) describes the business problem; each adapter decides what it means for its channel (HTTP 409, a non-retryable job failure, a CLI exit code). Status codes in the domain tie business logic to HTTP.
2. Inside a transaction, locks and a pool connection are held for the whole network call; a slow provider then stalls the database for everyone. Outside it, a crash or ambiguous failure can leave a charge without a paid order, so you need reconciliation (webhook or job) using the order ID and idempotency key.
3. In the repository (the database adapter), into a domain error such as `ConflictError('catalog.sku_taken')`, so use cases and the HTTP layer never deal with Postgres error codes.
</details>

## Sources
- [Martin Fowler — Value object](https://martinfowler.com/bliki/ValueObject.html)
- [Martin Fowler — Unit of work](https://martinfowler.com/eaaCatalog/unitOfWork.html)
- [RFC 9457 — Problem details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
- [Drizzle — Transactions](https://orm.drizzle.team/docs/transactions)
- [PostgreSQL — Error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
