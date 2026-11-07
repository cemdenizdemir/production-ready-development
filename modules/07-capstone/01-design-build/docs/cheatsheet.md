---
title: Design & Build cheatsheet
tech: Next.js 16, Express 5, TypeScript, PostgreSQL 18, Drizzle ORM, Redis 8, BullMQ
version: the full STACK.md stack
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Design & Build cheatsheet
[← Overview](00-overview.md) · Reminder tables: where each idea lives in Roastery. ⭐ = must know.

## Which style answers which question
| Question | Roastery |
|:--|:--|
| ⭐ Where does it run? | n-tier: browser · CloudFront · Next.js · Express API · Postgres/Valkey · workers |
| ⭐ How many deployables? | modular monolith (API + worker processes, one image) |
| ⭐ What are the modules? | DDD bounded contexts |
| ⭐ Dependencies inside a module? | clean/hexagonal: domain ← application ← adapters |
| How do modules talk? | ports for queries, outbox events for consequences, saga for checkout |
| Reads? | CQRS-lite read models |
| UI? | components (Views) + hooks (ViewModels) |

## Bounded contexts
| Context | Type | Owns |
|:--|:--|:--|
| ⭐ Pricing & Promotions | core | promotions, coupons, redemptions, quotes |
| ⭐ Ordering | core | carts, orders, checkout saga, order summaries |
| Catalog | supporting | products, variants, images, categories |
| Fulfillment | supporting | stock, reservations, shipments |
| Payments | generic (Stripe ACL) | payments, refunds, webhook dedupe |
| Identity & Access | generic (Better Auth) | users, sessions, roles |
| Notifications | generic (SES ACL) | emails, preferences, deliveries |

## Aggregates and invariants
| Aggregate | Invariant |
|:--|:--|
| Cart | ≤ 50 lines, qty 1–99, one line per variant |
| ⭐ Order | total = priced lines − discount; lifecycle transitions; frozen lines |
| Promotion | validity window, usage limit, no stacking |
| CouponRedemption | unique (coupon, customer) when single-use |
| ⭐ StockItem | `reserved ≤ onHand`, `onHand ≥ 0` |
| Reservation | expires in 60 min; released once |
| Payment | one capture per order; refunds ≤ captured |

## Context folders
| Folder | Holds |
|:--|:--|
| `domain/` | aggregates, values, domain events, domain services, repository interfaces |
| `application/` | use cases, saga steps, ports |
| `adapters/` | routes, jobs, Drizzle repos, ACLs, port implementations |
| `contracts/` | integration events, DTOs |
| `queries/` | read slices |
| `index.ts` | public API |

## Enforcement
| Rule | Tool |
|:--|:--|
| ⭐ Pure domain | ESLint `no-restricted-imports` on `**/domain/**` |
| ⭐ Cross-context via `index.ts` | ESLint regex |
| No context cycles | architecture test |
| Contracts package independent | workspace boundaries |

## Patterns map
| Pattern | Where |
|:--|:--|
| Strategy | promotion and shipping rules |
| Specification | `sellable` products |
| ⭐ State | order lifecycle, saga states |
| Factory | `Order.fromQuote`, `createDeps` |
| Builder | email messages |
| ⭐ Adapter / ACL | Stripe, SES, S3, carrier |
| ⭐ Decorator | timeout, retry, breaker, metrics on adapters |
| Facade | `startCheckout` |
| Composite | gift sets |
| ⭐ Repository + UoW | per aggregate, `tx` passed in |
| ⭐ Saga | checkout orchestration |
| ⭐ Outbox + idempotent consumer | integration events |
| CQRS-lite | order summaries, dashboards |
| MVVM | cart and checkout hooks |

## SOLID map
| Principle | Where |
|:--|:--|
| SRP | contexts by capability |
| OCP | promotion rule registry, carrier adapters |
| LSP | contract tests for Stripe adapter vs fake |
| ISP | `PriceQuotes`, `StockReservations`, `PaymentGateway` ports |
| ⭐ DIP | contexts own ports; `deps.ts` wires adapters |

## Consistency per operation
| Operation | Mechanism |
|:--|:--|
| ⭐ Reserve stock | conditional `UPDATE … WHERE on_hand - reserved >= q` |
| ⭐ Single-use coupon | unique constraint |
| Order changes | version (optimistic concurrency) |
| ⭐ Payment → paid | webhook dedupe + idempotent `markPaid` |
| Product pages | CDN + Redis (≤ 60 s stale) |
| Order history | projection (seconds) |
| Emails | outbox + `email_sends` claim |

## Checkout saga
| State | Compensation |
|:--|:--|
| started | cancel order |
| stock_reserved | release stock, cancel |
| awaiting_payment (timeout 65 min) | release stock, cancel |
| ⭐ paid (pivot) | none: forward only, retries + alerts |
| completed / cancelled | — |

## Events
| Event | Consumers |
|:--|:--|
| `order.placed.v1` | projection |
| `payment.captured.v1` | ordering saga |
| ⭐ `order.paid.v1` | fulfillment, notifications, projection |
| `order.cancelled.v1` | fulfillment, projection |
| `shipment.shipped.v1` | notifications, ordering, projection |
| `product.published.v1` | cache invalidation, sitemap |

## ADRs
| # | Decision |
|:--|:--|
| 0001 | modular monolith with bounded contexts |
| 0002 | clean layout + enforced rules |
| 0003 | Postgres + Drizzle data mapper |
| 0004 | outbox + BullMQ, at-least-once |
| 0005 | orchestrated checkout saga |
| 0006 | Stripe Checkout |
| 0007 | Better Auth |
| 0008 | CQRS-lite read models |
| 0009 | ECS Fargate + Terraform |

## Milestones
| Milestone | Exit criterion (headline) |
|:--|:--|
| ⭐ M1 Walking skeleton | `main` deploys to staging automatically |
| M2 Domain + catalog | boundaries enforced, uploads safe |
| M3 Identity, cart, pricing | invariants + authorization tests |
| ⭐ M4 Checkout + payments | no overselling, duplicate-safe webhooks |
| M5 Fulfillment, notifications, read models | idempotent consumers, rebuildable projections |
| M6 Hardening | load test + failure tests pass |
| M7 Production | same image staging → prod, restore drill done |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Shared product model | coupling across contexts | model per context |
| Stock on the catalog product | overselling, coupling | Fulfillment owns stock |
| Promotions in the UI | inconsistent prices | Pricing quotes on the server |
| Check-then-act stock | overselling | conditional update |
| Paid on redirect | forged/missed payments | webhook + reconciliation |
| Cross-context FKs/queries | no independent evolution | IDs, public APIs |
| Deploying at the end | late surprises | walking skeleton |
| ADRs written last | lost reasons | ADR per decision |

## Sources
| Source | Link |
|:--|:--|
| Explicit architecture | https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/ |
| DDD Reference | https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf |
| Clean architecture | https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html |
| Saga pattern | https://microservices.io/patterns/data/saga.html |
| Stripe fulfillment | https://docs.stripe.com/checkout/fulfillment |
| Walking skeleton | https://wiki.c2.com/?WalkingSkeleton |
