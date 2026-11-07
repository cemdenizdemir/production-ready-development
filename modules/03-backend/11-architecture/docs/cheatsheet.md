---
title: Architecture cheatsheet
tech: Node.js 26, Express 5, TypeScript
version: Node.js 26 LTS, Express 5.2, TypeScript 6.0 (erasable syntax), Drizzle ORM 0.45, ESLint 10
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Architecture cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Goals
| Goal | Means |
|:--|:--|
| ⭐ Easy to change | small cohesive modules, clear boundaries |
| Easy to understand | one obvious place per kind of code |
| ⭐ Easy to test | pure domain, fakes for external systems |
| Parallel teams | module ownership, stable public APIs |
| Easy to operate | few deployables until there's a reason |
| ⭐ Default | modular monolith (+ worker processes) |

## Layers in a module
| Layer | File | May import |
|:--|:--|:--|
| HTTP adapter | `orders.routes.ts` | Express, schemas, DTOs, service |
| ⭐ Use cases | `orders.service.ts` | domain, repo, ports, `db` for transactions |
| ⭐ Domain | `orders.domain.ts` | `shared/errors`, types only |
| Persistence | `orders.repo.ts` | Drizzle, tables |
| Input schemas | `orders.schemas.ts` | Zod |
| Output shapes | `orders.dto.ts` | domain types |
| Events | `orders.events.ts` | types only |
| Public API | `index.ts` | re-exports |
| ⭐ Dependency rule | dependencies point inward, toward the domain | |

## Module rules
| Rule | Why |
|:--|:--|
| ⭐ Import other modules via `#src/<module>/index.ts` | internals stay private |
| Relative imports inside a module | self-contained |
| ⭐ A module owns its tables | no cross-module queries |
| Small `shared/` | errors, money, IDs, db, logger, clock |
| ⭐ No cycles | a cycle = wrong boundary |
| Side effects across modules via events | decoupled publishers |
| Same use cases for routes, workers, scripts, tests | one implementation |

## Layout
| Path | Holds |
|:--|:--|
| `src/server.ts` | config → `createDeps` → listen → shutdown |
| `src/app.ts` | `createApp(deps)`: middleware, routers, error handler |
| ⭐ `src/deps.ts` | composition root |
| `src/http/` | error handler, auth, request context |
| `src/shared/` | technical building blocks |
| `src/<module>/` | one feature |
| `src/jobs/` | worker entry, same modules |
| `src/events/` | subscriptions wiring |

## Dependency injection
| Practice | Detail |
|:--|:--|
| ⭐ Factory functions | `createOrdersService({ db, catalog, payments, clock })` |
| ⭐ One composition root per process | `createDeps(config)` |
| Inject | ports, clock, ID generator, config, db handle |
| Import | pure domain functions, repositories |
| `type Deps = Awaited<ReturnType<typeof createDeps>>` | inferred types |
| `ReturnType<typeof createOrdersService>` | service type without an interface |
| No `process.env` in business code | config validated once |
| avoid | decorator DI (needs a build step), string-token containers |
| Also seen | NestJS, awilix, InversifyJS, tsyringe |

## Erasable TypeScript (Node type stripping)
| Avoid | Use instead |
|:--|:--|
| `enum Status { … }` | `type Status = 'pending' \| 'paid'` or `as const` object |
| Parameter properties `constructor(private x)` | declare the field, assign in the constructor |
| `namespace X { … }` with code | ES modules |
| Decorators | plain functions |
| `import x = require()` | `import` |
| Checks | `erasableSyntaxOnly`, `verbatimModuleSyntax` in tsconfig |

## Ports and adapters
| Term | Example |
|:--|:--|
| ⭐ Port | `PaymentGateway`, `Mailer`, `FileStore` (core's vocabulary) |
| ⭐ Adapter | `createStripeGateway`, `createSesMailer`, `createS3FileStore` |
| Fake adapter | `createFakeGateway()` for tests and local dev |
| Driving adapters | routes, workers, CLI |
| Driven adapters | repositories, Stripe, SES, S3 |
| Adapter jobs | translate types and errors; timeouts, retries, breakers |
| ⭐ Rule | ports at real boundaries only, not per class |

## Domain modeling
| Concept | In TypeScript |
|:--|:--|
| ⭐ Pure rules | functions over plain types |
| ⭐ Money | integer cents + currency |
| Branded IDs | `string & { readonly __brand: 'OrderId' }`, Zod `.brand()` |
| Status | string-literal union + allowed transitions |
| Invariants | checked in domain functions, enforced by DB constraints too |
| Results for expected outcomes | `{ ok: true } \| { ok: false, reason }` |

## Where rules live
| Rule | Place |
|:--|:--|
| ⭐ Business rules | domain functions |
| ⭐ Shape and type checks | Zod at the edge |
| Account scoping | use case + scoped repo queries |
| Uniqueness | DB constraint → domain error |
| ⭐ Workflows | use cases |

## Error architecture
| Layer | Produces |
|:--|:--|
| ⭐ Domain | `DomainError(code, message)` |
| Use cases | `NotFoundError`, `ConflictError`, `ForbiddenError` |
| Adapters | translated provider and DB errors |
| ⭐ HTTP error handler | status + problem+json (only place with HTTP codes) |
| Worker | `DomainError` → `UnrecoverableError`, else retry |

## Error → HTTP mapping
| Error | Status |
|:--|:--|
| `NotFoundError` | 404 |
| `ForbiddenError` | 403 |
| `ConflictError` | 409 |
| Other `DomainError` | 422 |
| `payment.declined` | 402 |
| `payment.unavailable` | 503 |
| Zod validation error | 422 with field errors |
| Anything else | 500, logged once |

## Transactions
| Rule | Detail |
|:--|:--|
| ⭐ Use case owns the transaction | `db.transaction(async (tx) => …)` |
| Repos take `tx` | `type DbOrTx = Db \| Tx` |
| ⭐ No network calls inside | charge between short transactions |
| Consistent data together | order + lines + stock |
| ⭐ Post-commit side effects | outbox |
| Concurrent edits | `version` column or `SELECT … FOR UPDATE` |
| Gaps | reconcile (webhooks, jobs) |
| `Tx` type | `Parameters<Parameters<Db['transaction']>[0]>[0]` |

## Events
| Concept | Rule |
|:--|:--|
| ⭐ Command vs event | "do X" (one handler) vs "X happened" (many) |
| Naming | past tense: `order.paid` |
| ⭐ Payload | IDs, `eventId`, `occurredAt`, `version` |
| ⭐ Delivery | outbox → one BullMQ job per subscriber |
| Subscribers | idempotent on `eventId` |
| Direction | publisher doesn't import subscribers |
| Direct call instead | when the workflow needs the result now |

## Monolith vs microservices
| Topic | Modular monolith | Microservices |
|:--|:--|:--|
| Deploys | one (+ workers) | many |
| Calls | function calls | network calls |
| Transactions | ACID | sagas |
| Debugging | one process | distributed tracing |
| Ops cost | low | high |

## When to extract a service
| Reason | Good? |
|:--|:--|
| ⭐ Very different resources or scaling (media, ML) | ✓ |
| Isolation for security or compliance | ✓ |
| Team friction on one deployable | ✓ |
| "Cleaner code", trends | ✗ |
| Boundaries not yet understood | ✗ |
| ⭐ How | ADR + strangler fig along a module boundary |
| ⭐ Distributed monolith signs | shared tables, deploy together, sync call chains |

## Enforcing boundaries
| Tool | Enforces |
|:--|:--|
| ⭐ ESLint `no-restricted-imports` (`patterns` with `regex`) | `index.ts`-only cross-module imports, pure domain files |
| ⭐ Architecture test (Vitest) | no module cycles |
| CODEOWNERS | module ownership in reviews |
| Workspace packages + `exports` | hard boundaries (also seen) |
| eslint-plugin-boundaries, dependency-cruiser | richer rules (also seen) |

## Decisions
| Practice | Detail |
|:--|:--|
| ⭐ ADR per expensive decision | context, decision, consequences, status |
| Where | `docs/adr/NNNN-title.md` |
| Changes | supersede, don't delete |
| Examples | module boundaries, events, extracting a service |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Rules in routes | duplicated, untested | domain functions |
| Deep cross-module imports | hidden coupling | `index.ts` only |
| Business logic in `shared/` | everything depends on it | owning module |
| HTTP status in domain errors | workers and scripts get HTTP semantics | codes, map at the edge |
| Network call in a transaction | locks and pool held | short transactions around it |
| Each repo opens its own transaction | partial writes | `tx` from the use case |
| Floats for money | rounding errors | integer cents |
| Interfaces for everything | ceremony | ports at real boundaries |
| Later ESLint config overrides rule options | boundary rule lost on some files | repeat shared patterns |
| Microservices sharing tables | distributed monolith | data ownership per service |

## Sources
| Source | Link |
|:--|:--|
| Monolith first | https://martinfowler.com/bliki/MonolithFirst.html |
| Hexagonal architecture | https://alistair.cockburn.us/hexagonal-architecture/ |
| Composition root | https://blog.ploeh.dk/2011/07/28/CompositionRoot/ |
| Strangler fig | https://martinfowler.com/bliki/StranglerFigApplication.html |
| Documenting architecture decisions | https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions |
| Node.js type stripping | https://nodejs.org/api/typescript.html#type-stripping |
| ESLint no-restricted-imports | https://eslint.org/docs/latest/rules/no-restricted-imports |
