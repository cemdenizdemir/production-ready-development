---
title: Architecture
tech: Next.js 16, Express 5, TypeScript, PostgreSQL 18, Drizzle ORM, Redis 8, BullMQ
version: Node.js 26 LTS, TypeScript 6.0, Next.js 16, Express 5.2, Drizzle ORM 0.45, BullMQ 5, ESLint 10, pnpm workspaces
date: 2026-11-07
covers: [5, 6, 7, 10, 11]
---
# Architecture
[← Overview](00-overview.md)

## Why it matters
- The structure chosen in week one decides whether milestone 5 is a week of work or a month of untangling.
- A written map of where each pattern and principle lives prevents both extremes: copy-paste chaos and pattern-itis.
- Cross-cutting concerns (auth, errors, logging, config) done once and early save every later feature from reinventing them.

## Tiers and deployables
| Tier / process | Runs | Scales on |
|:--|:--|:--|
| Browser | React app (Next.js client components) | — |
| CloudFront | static assets, product images, cacheable public pages | — |
| `web` (ECS) | Next.js 16 server: Server Components, BFF route handlers | CPU / requests |
| `api` (ECS) | Express 5 API from `apps/api` | CPU / requests |
| `worker` (ECS, Spot OK) | BullMQ workers from the same image | queue backlog |
| `migrate` (one-off task) | Drizzle migrator | per deploy |
| Postgres (RDS Multi-AZ) | system of record, outbox | — |
| Valkey (ElastiCache) | sessions + BullMQ (`noeviction`), cache (`allkeys-lru`) | — |
| S3 | product images, exports | — |

## Repository layout
```text
roastery/                         pnpm workspace
  apps/
    web/                          Next.js 16 (App Router)
      app/ components/ hooks/     hooks = ViewModels; components = Views
    api/
      src/
        contexts/
          catalog/                  each context: domain/ application/ adapters/ contracts/ queries/ index.ts
          pricing/
          ordering/
          payments/
          fulfillment/
          identity/
          notifications/
        shared/                     db, redis, outbox, errors, money, ids, logger, config, telemetry (technical only)
        http/                       app.ts (createApp), error handler, auth middleware, request context
        jobs/                       worker.ts, subscriptions.ts (event → handlers)
        deps.ts                     composition root
        server.ts                   API process entry
      test/                         architecture test, helpers (Testcontainers)
  packages/
    contracts/                    Zod schemas and DTO types shared by web and api (published language)
  infra/                          Terraform (bootstrap, modules, envs)
  docs/
    domain/glossary.md  domain/context-map.md  adr/  design/  runbooks/
```

## Inside a context (clean/hexagonal)
| Folder | Ring | Contains | May import |
|:--|:--|:--|:--|
| `domain/` | center | aggregates, value objects, domain events, domain services, repository interfaces | `shared/errors`, `shared/money`, `shared/ids` |
| `application/` | use cases | commands/use cases, saga steps, ports for other contexts and gateways | `domain/` |
| `adapters/` | outside | Express routes, job handlers, Drizzle repositories, ACLs (Stripe, SES, carrier), port implementations calling other contexts' `index.ts` | everything inside its context, other contexts' `index.ts`, frameworks |
| `contracts/` | published language | integration event types, DTOs | — |
| `queries/` | read side | SQL/Drizzle read slices for screens | `shared/db` |
| `index.ts` | public API | use case factories, contracts, router registration | — |

Dependency rules (enforced in CI):
| Rule | Enforcement |
|:--|:--|
| `domain/` imports no framework, ORM, SDK, or `shared/db` | ESLint `no-restricted-imports` on `**/domain/**` |
| Other contexts only through `contexts/<name>/index.ts` | ESLint regex pattern |
| No dependency cycles between contexts | architecture test (Vitest) |
| `packages/contracts` imports nothing from `apps/*` | workspace boundaries |

## Patterns and principles: where they live
| Idea | Where in Roastery |
|:--|:--|
| SRP / high cohesion | contexts split by business capability; email wording in Notifications, not Ordering |
| OCP | promotion rule registry (new promotion kinds = new rule), carrier adapters |
| LSP | contract tests run against Stripe adapter and fake gateway |
| ISP | role ports: `PriceQuotes`, `StockReservations`, `PaymentGateway` |
| DIP | contexts own their ports; adapters implement them; `deps.ts` wires |
| Strategy | promotion rules, shipping cost rules |
| Specification | `sellable` (active, not deleted, in stock) for catalog queries and checkout checks |
| State | order lifecycle transition table; checkout saga states |
| Factory | `Order.fromQuote(quote, cart)`, `createDeps()` |
| Builder | email messages in Notifications |
| Adapter / ACL | Stripe, SES, S3, carrier API |
| Decorator | `withTimeout`, `withRetry`, `withMetrics`, `withCircuitBreaker` around adapters |
| Facade | `startCheckout` use case over pricing, stock, payments |
| Composite | gift sets (bundles of variants) priced recursively |
| Observer / events | domain events → outbox → subscribers |
| Command | BullMQ jobs; saga commands |
| Chain of responsibility | Express middleware |
| Iterator | Stripe auto-pagination in reconciliation |
| Repository + unit of work | per aggregate, transaction passed in |
| Saga (orchestrated) | checkout: reserve → pay → confirm / compensate |
| Outbox + idempotent consumer | every integration event |
| CQRS-lite | `orderSummaries` read model, admin dashboard queries |
| MVVM | `useCartViewModel`, `useCheckoutViewModel` hooks |

## Cross-cutting concerns
| Concern | Approach | Taught in |
|:--|:--|:--|
| Authentication | Better Auth sessions (cookie `__Host-` prefixed), staff MFA | [03-backend/04-auth](../../../03-backend/04-auth/README.md) |
| Authorization | `can(user, permission)` + account-scoped queries in use cases | [03-backend/04-auth lesson 04](../../../03-backend/04-auth/docs/04-authorization-and-clients.md) |
| Validation | Zod schemas from `packages/contracts` at every edge | [03-backend/05-validation-abuse](../../../03-backend/05-validation-abuse/README.md) |
| Errors | `DomainError(code)` mapped to problem+json in `http/` | [03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-transactions.md) |
| Configuration | Zod-validated env at startup; secrets from Secrets Manager | [01-foundations/07-config-environments](../../../01-foundations/07-config-environments/README.md) |
| Logging / tracing / metrics | Pino + OpenTelemetry + Sentry, trace IDs everywhere | [03-backend/10-observability](../../../03-backend/10-observability/README.md) |
| Rate limiting | express-rate-limit with Redis store | [03-backend/05-validation-abuse lesson 02](../../../03-backend/05-validation-abuse/docs/02-limits-and-rate-limiting.md) |
| Resilience | timeouts, retries, breakers, shedding as decorators | [03-backend/08-reliability](../../../03-backend/08-reliability/README.md) |

## ADRs to write
| # | Decision |
|:--|:--|
| 0001 | Modular monolith with DDD bounded contexts as modules |
| 0002 | Clean/hexagonal layout inside each context and enforced dependency rules |
| 0003 | PostgreSQL as the system of record; Drizzle as data mapper; no ORM decorators |
| 0004 | Outbox + BullMQ for integration events; at-least-once with idempotent consumers |
| 0005 | Orchestrated saga for checkout; stock reservation expiry tied to Stripe session expiry |
| 0006 | Stripe Checkout (hosted) instead of Payment Element |
| 0007 | Better Auth for identity (generic subdomain) |
| 0008 | CQRS-lite read models for order history and admin dashboards |
| 0009 | Deployment on ECS Fargate with Terraform; staging and production accounts |

## Example
`apps/api/src/deps.ts` (excerpt) — the composition root wires contexts through ports.
```ts
export async function createDeps(config: Config) {
  const { db, pool } = createDb(config);
  const redis = await createRedis(config);
  const clock = () => new Date();

  const catalog = createCatalogContext({ db, redis });
  const pricing = createPricingContext({ db, catalog: catalog.prices });                    // port: CatalogPrices
  const fulfillment = createFulfillmentContext({ db, carrier: withTimeout(createCarrierAdapter(config.carrier), 2_000) });
  const payments = createPaymentsContext({ db, stripe: createStripe(config.stripe) });
  const ordering = createOrderingContext({
    db, clock,
    priceQuotes: pricing.quotes,                   // port implemented by the pricing context
    stockReservations: fulfillment.reservations,   // port implemented by the fulfillment context
    paymentGateway: payments.gateway,              // ACL over Stripe
  });
  const notifications = createNotificationsContext({ db, mailer: createSesMailer(config.ses) });

  return { db, redis, catalog, pricing, fulfillment, payments, ordering, notifications, close: () => Promise.allSettled([pool.end(), redis.close()]) };
}
```
`apps/api/src/contexts/ordering/index.ts` — the only door into Ordering.
```ts
export { createOrderingContext, type OrderingContext } from './adapters/context.ts';
export { orderingRouter } from './adapters/http.ts';
export type { OrderPlacedV1, OrderPaidV1, OrderCancelledV1 } from './contracts/events.ts';
```

## Mistakes
Wrong: contexts reaching into each other's tables "just for one query". Right: ask through the other context's public API or a published read model.

Wrong: putting promotion logic in the checkout route because it's "only one rule". Right: Pricing owns it, behind `PriceQuotes`.

Wrong: no ADRs until the end. The reasons are forgotten. Right: an ADR per decision as it's made.

## Check yourself
1. Which folder of a context may import Drizzle, and which may not?
2. How does the Ordering context use Pricing without depending on its internals?
3. Name three decorators you'd put around the carrier adapter and why.

<details>
<summary>Answers</summary>

1. `adapters/` (repositories) and `queries/` may import Drizzle; `domain/` may not, and `application/` only uses repository and port interfaces, so business rules never depend on persistence.
2. Ordering defines a `PriceQuotes` port in its application layer; the Pricing context provides an implementation, and the composition root wires it in. Ordering only knows the port's types, imported through Pricing's public `index.ts` contracts.
3. A timeout (the carrier must not hang checkout or jobs), retries with backoff for transient errors (rate quotes are idempotent reads), a circuit breaker (fail fast and fall back to a flat rate when the carrier is down), and metrics (latency and errors per carrier on dashboards).
</details>

## Sources
- [Herberto Graça — Explicit architecture](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/)
- [pnpm — Workspaces](https://pnpm.io/workspaces)
- [ESLint — no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports)
- [Michael Nygard — Documenting architecture decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
