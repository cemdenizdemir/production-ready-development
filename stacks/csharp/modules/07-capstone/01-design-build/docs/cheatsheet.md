---
title: Design & Build cheatsheet
tech: Next.js 16, ASP.NET Core 10, C# 14, SQL Server 2025, EF Core 10, Redis 8, Hangfire
version: .NET 10 LTS, C# 14, EF Core 10, SQL Server 2025 / Azure SQL, Redis 8 / Azure Managed Redis, Hangfire 1.8, Next.js 16
date: 2026-11-10
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Design & Build cheatsheet
[← Overview](00-overview.md) · Quick reference: where each idea lives in Roastery. ⭐ = must know.

## Scope and targets
| Item | Value | Note |
|:--|:--|:--|
| ⭐ traffic | 20 req/s peak, 100 req/s campaigns | |
| orders | 300/day, 30/min peak | |
| ⭐ latency | product p95 < 300 ms, checkout start p95 < 800 ms | |
| ⭐ availability | 99.9% browse + checkout | SLOs |
| ⭐ durability | RPO 5 min, RTO 1 h | |
| out of scope v1 | subscriptions, loyalty, multi-currency, returns portal | v2 |

## Contexts (modules)
| Context | Subdomain | Owns |
|:--|:--|:--|
| ⭐ Pricing & Promotions | core | promotions, redemptions, quotes |
| ⭐ Ordering | core | carts, orders, checkout saga |
| Catalog | supporting | products, variants, images |
| Fulfillment | supporting | stock, reservations, shipments |
| Payments | generic | payments, refunds, Stripe events |
| Identity & Access | generic | users, roles, passkeys |
| Notifications | generic | emails, suppressions |

## Context map
| Relationship | Between | Contract |
|:--|:--|:--|
| customer–supplier | Pricing → Ordering | `IPriceQuotes` |
| open host | Catalog → Ordering, Pricing | `ICatalogQueries`, `ProductChangedV1` |
| ⭐ published language | Ordering → Fulfillment, Notifications | `OrderPlacedV1`, `OrderPaidV1`, `OrderCancelledV1` |
| ⭐ ACL | Payments → Stripe; Fulfillment → carrier; Notifications → ACS | adapters |
| conformist | Identity → ASP.NET Core Identity | |

## Aggregates
| Aggregate | Key invariant | Note |
|:--|:--|:--|
| Cart | ≤ 50 lines, qty 1–99 | |
| ⭐ Order | total from frozen lines; lifecycle transitions | `rowversion` |
| Promotion | window, limits, no stacking | sum type |
| CouponRedemption | single use | unique constraint |
| ⭐ StockItem | `Reserved ≤ OnHand` | conditional update |
| Reservation | expires 60 min, released once | |
| Payment | one capture; refunds ≤ captured | |

## Architecture
| Level | Style | ADR |
|:--|:--|:--|
| ⭐ tiers | n-tier on Container Apps | 0001 |
| ⭐ modules | modular monolith | 0002 |
| ⭐ inside modules | clean + vertical slices | 0003 |
| data | Azure SQL, schema per module | 0004 |
| jobs/messaging | Hangfire + Service Bus | 0005 |
| libraries | no mediator/AutoMapper | 0006 |
| payments | Stripe Checkout | 0007 |
| auth | Identity cookies via BFF | 0008 |
| infra | Bicep + azd + OIDC | 0009 |
| observability | OTel → Aspire / Azure Monitor; Sentry | 0010 |

## Boundary enforcement
| Rule | Tool | Note |
|:--|:--|:--|
| ⭐ reference only `*.Contracts` | project references | |
| ⭐ `internal` by default | NetArchTest | |
| ⭐ framework-free domain | NetArchTest | |
| schema per module | DbContext per module | |
| owners review | CODEOWNERS | |
| no commercial libraries | CI package check | |

## Patterns map
| Pattern | Where | Note |
|:--|:--|:--|
| ⭐ ports and adapters / ACL | Payments, Fulfillment, Notifications | |
| strategy (sum type) | promotions | |
| ⭐ state machine | Order, Reservation | |
| ⭐ saga (orchestrated) | checkout | deadline job |
| ⭐ outbox + inbox | module events | |
| decorator | cached catalog queries | HybridCache |
| CQRS-lite | order history, admin dashboard | Dapper, replica |

## Consistency
| Operation | Level | Mechanism |
|:--|:--|:--|
| ⭐ reserve stock | strong | conditional `UPDATE` |
| ⭐ place order | strong | one transaction + outbox |
| ⭐ payment status | strong | unique event IDs |
| coupon | strong | unique constraint |
| emails, shipments | eventual | outbox handlers |
| catalog, search, dashboards | eventual | cache, projections |

## Cross-cutting
| Concern | Decision | Topic |
|:--|:--|:--|
| ⭐ auth | Identity cookies, passkeys/TOTP staff | 03-backend/04 |
| validation | `AddValidation()`, FluentValidation, Zod | 03-backend/05 |
| ⭐ errors | `Result<T>` + Problem Details | 03-backend/11 |
| config | options + Key Vault + App Configuration | 01-foundations/07 |
| ⭐ observability | OpenTelemetry, SLOs | 03-backend/10 |
| ⭐ resilience | standard handler, timeouts, probes | 03-backend/08 |
| caching | HybridCache, output cache, Front Door | 03-backend/06 |

## Milestones
| # | Goal | Key exit criterion |
|:--|:--|:--|
| ⭐ M1 | walking skeleton | one path through all tiers, deployed by CI |
| M2 | catalog | cached pages, outbox events |
| M3 | cart + pricing | promotions with tests |
| ⭐ M4 | checkout + payments | saga, webhooks, first prod deploy |
| M5 | fulfillment + notifications | idempotent consumers |
| M6 | accounts + admin | read models, refunds |
| M7 | hardening | SLOs, restore drill |
| M8 | performance + polish | k6, Web Vitals, a11y |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| shared Product entity | coupling | model per context |
| stock on catalog product | overselling | Fulfillment owns stock |
| promotions in the UI | tampering | Pricing quotes |
| check-then-reserve | races | conditional update |
| paid on redirect | unpaid orders | webhook + saga |
| layers before skeleton | late integration pain | M1 walking skeleton |
| infra/CI last | painful launch | from M1 |
| patterns everywhere | slow change | the map |

## Sources
| Source | Link |
|:--|:--|
| STACK.md | ../../../../STACK.md |
| 03-backend/11-architecture | ../../../03-backend/11-architecture/README.md |
| 06-design/05-domain-driven-design | ../../../06-design/05-domain-driven-design/README.md |
| 06-design/07-distributed-systems | ../../../06-design/07-distributed-systems/README.md |
| eShop reference app | https://github.com/dotnet/eShop |
| EventStorming | https://www.eventstorming.com/ |
