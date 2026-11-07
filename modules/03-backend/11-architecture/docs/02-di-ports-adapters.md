---
title: Dependency injection and ports and adapters
tech: Node.js 26, TypeScript, Express 5
version: Node.js 26 LTS, TypeScript 6.0, Express 5.2, Vitest 4, stripe-node
date: 2026-11-07
covers: [4, 7]
---
# Dependency injection and ports and adapters
[← Overview](00-overview.md)

## Why it matters
- The orders service does `import { stripe } from '../stripe.ts'` at the top. Every test of checkout hits Stripe's test API, takes 2 seconds, and fails when the network is flaky.
- Switching the email provider means editing 23 files, because the SDK's types and error classes leaked into business code.
- Config is read with `process.env.X` in 40 places. A typo in one variable name only shows up in production, at 3 a.m.

## Concepts

### Dependency injection without a framework
| Idea | In code |
|:--|:--|
| Dependencies are parameters | `createOrdersService({ db, catalog, payments, clock })` |
| One composition root | `src/deps.ts` builds every object once at startup |
| Inject what varies | external services (ports), clock, ID generator, config, db handle |
| Import what doesn't | pure domain functions, repositories (tested against a real Postgres) |
| No globals in business code | `process.env`, SDK clients, and the db pool appear only in the root and in adapters |
| Tests pass fakes | fake payment gateway, fixed clock, in-memory mailer |

Why no DI container: Node's type stripping can't run decorators, and container magic hides the wiring. A composition root of plain function calls is explicit, type-checked, and easy to read. Also seen: NestJS (decorator-based framework with its own build), awilix, InversifyJS, tsyringe.

### Ports and adapters (hexagonal architecture)
| Term | Meaning | Example |
|:--|:--|:--|
| Port | an interface the core needs, in the core's own words | `PaymentGateway.charge()`, `Mailer.send()`, `FileStore.put()` |
| Adapter | an implementation for one technology | `createStripeGateway`, `createSesMailer`, `createS3FileStore`, fakes |
| Driving adapters | call into the core | Express routes, BullMQ workers, CLI scripts |
| Driven adapters | called by the core | repositories, Stripe, SES, S3 |

What adapters are for:
| Benefit | Example |
|:--|:--|
| Provider types stay outside | business code never sees `Stripe.PaymentIntent` |
| Error translation | `StripeCardError` → `{ ok: false, reason: 'declined' }` |
| One place for resilience | timeouts, retries, breakers ([08-reliability](../../08-reliability/README.md)) |
| Swappable providers | SES ↔ another email API without touching use cases |
| Fast tests | fakes instead of network calls |

Don't over-abstract: one port per external system, not an interface for every class. Repositories can stay concrete Drizzle modules tested against a real database ([01-foundations/03-testing lesson 04](../../../01-foundations/03-testing/docs/04-integration-tests.md)).

## Example
`src/payments/payments.port.ts` — the core's words, no Stripe types.
```ts
export type ChargeResult =
  | { ok: true; paymentId: string }
  | { ok: false; reason: 'declined' | 'provider_unavailable' };

export interface PaymentGateway {
  charge(input: {
    orderId: string;
    amountCents: number;
    currency: 'eur';
    customerRef: string;
    paymentMethodRef: string;
    idempotencyKey: string;
  }): Promise<ChargeResult>;
  refund(input: { paymentId: string; amountCents: number; idempotencyKey: string }): Promise<void>;
}
```
`src/payments/stripe.adapter.ts` — the only file that knows Stripe (details in [12-integrations](../../12-integrations/README.md)).
```ts
import Stripe from 'stripe';
import type { ChargeResult, PaymentGateway } from './payments.port.ts';

export function createStripeGateway(stripe: Stripe): PaymentGateway {
  return {
    async charge(input): Promise<ChargeResult> {
      try {
        const intent = await stripe.paymentIntents.create(
          {
            amount: input.amountCents,
            currency: input.currency,
            customer: input.customerRef,
            payment_method: input.paymentMethodRef,
            confirm: true,
            off_session: true,
            metadata: { orderId: input.orderId },
          },
          { idempotencyKey: input.idempotencyKey },
        );
        return intent.status === 'succeeded' ? { ok: true, paymentId: intent.id } : { ok: false, reason: 'declined' };
      } catch (err) {
        if (err instanceof Stripe.errors.StripeCardError) return { ok: false, reason: 'declined' };
        if (err instanceof Stripe.errors.StripeConnectionError) return { ok: false, reason: 'provider_unavailable' };
        throw err;                                                     // bugs and config errors stay exceptions
      }
    },
    async refund(input) {
      await stripe.refunds.create({ payment_intent: input.paymentId, amount: input.amountCents }, { idempotencyKey: input.idempotencyKey });
    },
  };
}
```
`src/payments/fake.adapter.ts` — for tests and local development.
```ts
import type { PaymentGateway } from './payments.port.ts';

export function createFakeGateway(opts: { decline?: boolean } = {}) {
  const charges: Parameters<PaymentGateway['charge']>[0][] = [];
  const gateway: PaymentGateway = {
    async charge(input) {
      charges.push(input);
      return opts.decline ? { ok: false, reason: 'declined' } : { ok: true, paymentId: `pay_fake_${charges.length}` };
    },
    async refund() {},
  };
  return { gateway, charges };
}
```
`src/deps.ts` — the composition root: the only place that knows every concrete implementation.
```ts
import Stripe from 'stripe';
import type { Config } from './config.ts';
import { createDb } from './shared/db.ts';
import { createRedis } from './shared/redis.ts';
import { createLogger } from './shared/logger.ts';
import { createStripeGateway, createFakeGateway } from './payments/index.ts';
import { createSesMailer } from './notifications/index.ts';
import { createCatalogService } from './catalog/index.ts';
import { createOrdersService } from './orders/index.ts';

export async function createDeps(config: Config) {
  const logger = createLogger(config);
  const { db, pool } = createDb(config);
  const redis = await createRedis(config);
  const clock = () => new Date();

  const payments = config.payments.provider === 'stripe'
    ? createStripeGateway(new Stripe(config.stripe.secretKey, { timeout: 10_000, maxNetworkRetries: 2 }))
    : createFakeGateway().gateway;                                     // local development without Stripe
  const mailer = createSesMailer(config.ses);

  const catalog = createCatalogService({ db, redis });
  const orders = createOrdersService({ db, catalog, payments, clock });

  return {
    logger, catalog, orders, mailer,
    async close() {
      await Promise.allSettled([pool.end(), redis.close()]);
    },
  };
}

export type Deps = Awaited<ReturnType<typeof createDeps>>;
```
`src/server.ts` and `src/jobs/worker.ts` both start from the same root:
```ts
const config = loadConfig();                       // validated once with Zod (01-foundations/07-config-environments)
const deps = await createDeps(config);
const server = createApp(deps).listen(config.http.port);
// worker.ts: const deps = await createDeps(config); startWorkers(deps);
```
A use-case test with fakes for the outside world and a real test database (`checkout` is built in [lesson 03](03-domain-errors-transactions.md)):
```ts
import { expect, test } from 'vitest';
import { createOrdersService } from './orders.service.ts';
import { createCatalogService } from '#src/catalog/index.ts';
import { createFakeGateway } from '#src/payments/index.ts';
import { testDatabase, seedProduct } from '../../test/helpers/db.ts'; // Postgres in Docker

test('a declined payment marks the order payment_failed', async () => {
  const { db } = await testDatabase();
  const product = await seedProduct(db, { priceCents: 1_000 });
  const { gateway, charges } = createFakeGateway({ decline: true });
  const orders = createOrdersService({ db, catalog: createCatalogService({ db }), payments: gateway, clock: () => new Date('2026-11-07T10:00:00Z') });

  await expect(orders.checkout('acc_1', { items: [{ productId: product.id, quantity: 2 }], customerRef: 'cus_1', paymentMethodRef: 'pm_1' }))
    .rejects.toMatchObject({ code: 'payment.declined' });
  expect(charges[0]).toMatchObject({ amountCents: 2_000, idempotencyKey: expect.stringMatching(/^order-/) });
});
```

## Production patterns
- **One composition root** per process type (API, worker) built from the same `createDeps`.
- **Ports for every external system** (payments, email, storage, SMS), in the core's vocabulary.
- **Adapters translate**: provider types, errors, and retries stay inside them.
- **Fakes for external systems in tests**, a real Postgres for repositories.
- **Config validated once** and passed down; no `process.env` in business code.

## Mistakes
Wrong: importing a singleton client in business code.
```ts
import { stripe } from '#src/stripe.ts'; // in orders.service.ts: untestable, provider types everywhere
```
Right: the service receives a `PaymentGateway`; the root decides which implementation.

Wrong: an interface for everything (`IOrderService`, `IOrderRepository`, `IOrderMapper`…) with one implementation each. Ceremony without benefit. Right: ports at real boundaries only.

Wrong: leaking provider errors.
```ts
catch (err) { if (err.type === 'StripeCardError') ... } // in the use case
```
Right: the adapter returns `{ ok: false, reason: 'declined' }`.

Wrong: a DI container resolved by string tokens or decorators. Wiring errors appear at runtime, and Node's type stripping can't run decorators. Right: plain function calls in `deps.ts`.

## Check yourself
1. What is a composition root, and why only one per process?
2. What's the difference between a port and an adapter?
3. Why fake the payment gateway but not the repository?

<details>
<summary>Answers</summary>

1. The single place where concrete implementations are created and connected (db pool, Redis, Stripe adapter, services). Keeping it in one place makes the wiring visible, type-checked, and easy to change per environment, and keeps business code free of construction details.
2. A port is an interface defined by the core in its own terms (`PaymentGateway.charge()`). An adapter is one technology-specific implementation of it (Stripe, a fake). The core depends on the port; the root picks the adapter.
3. The payment gateway is an external network service: slow, costly, and non-deterministic in tests, so a fake is better. Repositories hold SQL whose correctness depends on the real database (constraints, types, transactions); testing them against a real Postgres catches bugs a fake would hide.
</details>

## Sources
- [Alistair Cockburn — Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Mark Seemann — Composition root](https://blog.ploeh.dk/2011/07/28/CompositionRoot/)
- [Martin Fowler — Inversion of control containers and the dependency injection pattern](https://martinfowler.com/articles/injection.html)
- [Stripe — Error handling (Node.js)](https://docs.stripe.com/error-handling?lang=node)
