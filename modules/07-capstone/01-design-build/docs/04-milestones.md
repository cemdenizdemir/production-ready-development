---
title: Milestones
tech: Next.js 16, Express 5, TypeScript, PostgreSQL 18, Drizzle ORM, Redis 8, BullMQ
version: the full STACK.md stack; Terraform 1.14 and GitHub Actions from M1
date: 2026-11-07
covers: [12]
---
# Milestones
[← Overview](00-overview.md)

## Why it matters
- Big-bang capstones stall at 70%. Small milestones that each end **deployed** keep momentum and expose integration problems early.
- A walking skeleton (thin end-to-end slice, deployed through the real pipeline) makes every later milestone a feature, not a fight with infrastructure.
- Each milestone has exit criteria, so "done" is checkable by you and by `/review`.

## How milestones work
| Rule | Detail |
|:--|:--|
| One milestone = one task | `/learn 07-capstone/01-design-build mode=tasks` creates T01 = M1 … T07 = M7 |
| Each ends deployed to staging | through CI/CD, never by hand |
| Each ends reviewed | `/review 07-capstone/01-design-build T0x` (kind: milestone) |
| ADRs as you go | listed per milestone |
| Tests at every level | domain unit tests, adapter integration tests (Testcontainers), API tests (Supertest), E2E (Playwright) for key journeys |
| Small PRs | vertical slices, merged daily ([05-practice](../../../05-practice/01-engineering-practice/README.md)) |

## The milestones
### M1 · Walking skeleton
| | |
|:--|:--|
| Build | pnpm workspace (`apps/web`, `apps/api`, `packages/contracts`); Docker Compose (Postgres, Redis, LGTM); `GET /health/*`; one slice: `GET /v1/products` from Postgres rendered by Next.js; Terraform for staging (VPC, ECS, RDS, ElastiCache, ALB); GitHub Actions with OIDC: lint, types, tests, image build, migrate, deploy |
| Exit criteria | a commit to `main` reaches staging automatically; the product list renders from the staging database; health checks green; logs and traces visible in Grafana |
| ADRs | 0001 modular monolith, 0009 ECS + Terraform |
| Topics | [04-shipping](../../../04-shipping/README.md), [01-foundations/04-ci-cd](../../../01-foundations/04-ci-cd/README.md), [03-backend/10-observability](../../../03-backend/10-observability/README.md) |

### M2 · Domain model and catalog
| | |
|:--|:--|
| Build | `docs/domain/glossary.md`, context map, event storming notes; context folder layout with lint rules and the architecture test; Catalog context: products, variants, categories, images via presigned S3 uploads, admin CRUD; `sellable` specification; cache-aside + CDN headers for product pages |
| Exit criteria | boundaries fail CI when violated; domain unit tests for catalog rules; image upload verified (type, size, scan/quarantine); product page p95 < 300 ms in a smoke load test |
| ADRs | 0002 clean layout, 0003 Postgres + Drizzle |
| Topics | [06-design/05](../../../06-design/05-domain-driven-design/README.md), [03-backend/11-architecture](../../../03-backend/11-architecture/README.md), [03-backend/12-integrations lesson 04](../../../03-backend/12-integrations/docs/04-files-with-s3.md) |

### M3 · Identity, cart, and pricing
| | |
|:--|:--|
| Build | Better Auth (customers + staff roles, MFA for staff); Cart aggregate (guest + merge on login); Pricing context: promotion rules (strategy registry), coupons with redemption limits, `PriceQuotes` port; cart UI with ViewModel hooks |
| Exit criteria | invariants covered by unit tests (quantities, line limits, no stacking); authorization tests for every route; rate limits on login and coupon endpoints |
| ADRs | 0007 Better Auth |
| Topics | [03-backend/04-auth](../../../03-backend/04-auth/README.md), [06-design/03](../../../06-design/03-design-patterns/README.md), [02-frontend/05-state-management](../../../02-frontend/05-state-management/README.md) |

### M4 · Checkout and payments
| | |
|:--|:--|
| Build | Order aggregate with lifecycle and versioning; stock items and reservations; checkout saga (orchestrated, persisted); Payments context with Stripe Checkout ACL; webhook route + worker with dedupe; outbox relay; reconciliation job |
| Exit criteria | concurrent checkout test can't oversell; duplicate and out-of-order webhooks leave correct state; expired sessions release stock; test-card flows incl. 3DS and declines pass in staging |
| ADRs | 0004 outbox, 0005 checkout saga, 0006 Stripe Checkout |
| Topics | [06-design/07](../../../06-design/07-distributed-systems/README.md), [03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md), [03-backend/12-integrations](../../../03-backend/12-integrations/README.md) |

### M5 · Fulfillment, notifications, and read models
| | |
|:--|:--|
| Build | shipments and carrier adapter (timeout, retry, breaker, flat-rate fallback); Notifications context with SES (templates, `email_sends` dedupe, bounce handling); `order_summaries` projection and order history page; admin order dashboard |
| Exit criteria | every event consumer is idempotent (tested by double delivery); emails tested with the SES simulator; projections rebuildable from scratch |
| ADRs | 0008 CQRS-lite read models |
| Topics | [03-backend/12-integrations lesson 03](../../../03-backend/12-integrations/docs/03-email-with-ses.md), [06-design/04 lesson 04](../../../06-design/04-architecture-styles/docs/04-cqrs-serverless-combining.md) |

### M6 · Hardening
| | |
|:--|:--|
| Build | SLOs and burn-rate alerts; dashboards (service, dependencies, queues, business); timeouts, load shedding, degradation of optional features; security headers and CSP; k6 load test at campaign peak (100 req/s) |
| Exit criteria | load test meets thresholds; failure tests (MSW, `docker compose stop redis`) show graceful degradation; no high/critical findings from dependency and code scanning |
| Topics | [03-backend/08-reliability](../../../03-backend/08-reliability/README.md), [03-backend/09-scalability](../../../03-backend/09-scalability/README.md), [01-foundations/06-security](../../../01-foundations/06-security/README.md) |

### M7 · Production environment
| | |
|:--|:--|
| Build | production account and Terraform environment; promotion from staging with approval; backups (PITR, AWS Backup copy), first restore drill; runbooks for the top alerts; on-call rotation and status page |
| Exit criteria | the same image runs in staging and production; rollback tested; restore drill RTO measured; then continue with [02-pre-launch](../../02-pre-launch/README.md) |
| Topics | [04-shipping/04-deployments](../../../04-shipping/04-deployments/README.md), [04-shipping/05-data-safety](../../../04-shipping/05-data-safety/README.md), [04-shipping/06-incident-response](../../../04-shipping/06-incident-response/README.md) |

## Example
A Playwright journey test used as an exit criterion from M4 on:
```ts
import { test, expect } from '@playwright/test';

test('guest buys a coffee with a test card', async ({ page }) => {
  await page.goto('/products/ethiopia-guji');
  await page.getByRole('radio', { name: '250 g' }).check();
  await page.getByRole('radio', { name: 'Whole bean' }).check();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('link', { name: /cart/i }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
  // in staging: fill the Stripe test card 4242 4242 4242 4242, then:
  // await expect(page.getByRole('heading', { name: 'Thank you for your order' })).toBeVisible();
});
```
A concurrency test that proves no overselling (M4):
```ts
test('two checkouts for the last bag: exactly one succeeds', async () => {
  await seedStock(db, { sku: 'GUJI-250-WB', onHand: 1 });
  const results = await Promise.allSettled([checkout(cartA), checkout(cartB)]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(await stockOf(db, 'GUJI-250-WB')).toMatchObject({ onHand: 1, reserved: 1 });
});
```

## Mistakes
Wrong: building all features locally and deploying at the end. Infrastructure problems appear when there's no time left. Right: M1 deploys a walking skeleton.

Wrong: skipping tests "until it works". Right: domain tests as you model; adapter and journey tests as exit criteria.

Wrong: milestones without exit criteria. Right: checkable criteria, reviewed with `/review`.

## Check yourself
1. What is a walking skeleton, and why is it milestone 1?
2. Which exit criteria in M4 prove correctness under concurrency and duplication?
3. Why does every milestone end deployed to staging?

<details>
<summary>Answers</summary>

1. A thin slice through every tier (UI → API → database), built, tested, and deployed through the real pipeline and infrastructure. Doing it first means later milestones only add features; infrastructure and integration risks are discovered when they're cheapest to fix.
2. The concurrent checkout test that can't oversell, and the duplicate/out-of-order webhook tests that must leave the order and stock in the correct state; plus expired sessions releasing stock.
3. "Works on my machine" hides configuration, networking, permissions, and migration problems. Deploying every milestone keeps the system releasable and the pipeline exercised.
</details>

## Sources
- [Alistair Cockburn — Walking skeleton](https://wiki.c2.com/?WalkingSkeleton)
- [Playwright — Writing tests](https://playwright.dev/docs/writing-tests)
- [Testcontainers for Node.js](https://node.testcontainers.org/)
- [DORA — Working in small batches](https://dora.dev/capabilities/working-in-small-batches/)
