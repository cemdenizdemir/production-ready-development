---
title: API Design cheatsheet
tech: Express 5, Zod 4, OpenAPI 3.1
version: Express 5.2, Zod 4.4, OpenAPI 3.1, RFC 9457, Node.js 26 LTS
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# API Design cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Resource design
| Rule | Example |
|:--|:--|
| ⭐ Plural nouns | `/orders`, `/orders/{orderId}` |
| ⭐ Methods for actions | GET read, POST create, PATCH update, PUT replace, DELETE remove |
| Sub-resources | `/orders/{id}/items` |
| ⭐ Query params for filter/sort/page | `?status=paid&sort=-createdAt&limit=20` |
| Non-CRUD actions | `POST /orders/{id}/cancellation` |
| ⭐ Current user | `/me`, `/me/orders` |
| kebab-case paths, camelCase JSON | consistency |
| Version prefix | `/v1/...` |
| Search across resources | `GET /search?q=` |
| Bulk operations | `POST /orders/batch` with per-item results |

## Status codes for APIs
| Code | Use |
|:--|:--|
| ⭐ 200 / 201 + `Location` / 204 | read/update, created, no body |
| ⭐ 202 + status URL | async work |
| ⭐ 400 | malformed request (bad JSON) |
| ⭐ 401 / 403 | not authenticated / not allowed |
| ⭐ 404 | not found (or not yours) |
| 405 | wrong method |
| ⭐ 409 | conflict with state; idempotency key in progress |
| 412 / 428 | `If-Match` failed / required |
| 413 | body too large |
| 415 | wrong content type |
| ⭐ 422 | validation failed |
| ⭐ 429 + `Retry-After` | rate limited |
| 500 / 502 / 503 / 504 | server / upstream / overload / timeout |

## Express 5 essentials
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `express.json({ limit })` | parse JSON with size cap | default 100 kb |
| `express.urlencoded({ extended: false })` | form bodies | extended false default in v5 |
| ⭐ `express.Router()` | modular routes | `mergeParams` for nested |
| ⭐ Async errors forwarded | throw in async handlers | v5 |
| ⭐ Error handler `(err, req, res, next)` | last middleware | four params |
| ⭐ `/*splat` | named wildcard | `req.params.splat` is an array |
| `{/:id}` | optional segment | braces |
| No regex in paths | validate with Zod | |
| `req.query` read-only | simple parser default | `app.set('query parser', 'extended')` |
| `req.body` undefined without parser | check/parse | |
| `res.status().location().json()` | chaining | |
| `res.sendStatus(204)` | status only | |
| `app.set('trust proxy', 1)` | client IP behind LB | |
| `app.disable('x-powered-by')` | hide framework | Helmet does it too |
| Removed in v5 | `app.del`, `req.param()`, `res.send(status)`, `redirect('back')` | |

## Middleware order
| # | Middleware |
|:--|:--|
| 1 | request ID / context (`AsyncLocalStorage`) |
| 2 | request logging (pino-http) |
| 3 | security headers (Helmet) |
| 4 | CORS (only if cross-origin) |
| 5 | body parsing with limits |
| 6 | rate limiting |
| 7 | health endpoints (public) |
| 8 | ⭐ authentication |
| 9 | routers (authorization inside) |
| 10 | 404 handler |
| 11 | ⭐ error handler (last) |

## Validation with Zod
| Pattern | Example | Note |
|:--|:--|:--|
| ⭐ Parse body | `CreateOrder.parse(req.body)` | throw → 422 |
| ⭐ Parse params | `z.object({ id: z.uuid() }).parse(req.params)` | |
| ⭐ Parse query | `z.coerce.number().int().max(100).default(20)` | strings in |
| ⭐ `.strict()` | reject unknown keys | writes |
| default strip | drop unknown keys | reads |
| `z.enum([...])` | allowed values | status, sort |
| `.transform()` | normalize | trim, lowercase |
| `safeParse` | handle without throwing | |
| Shared schemas package | front + back | `@acme/schemas` |

## Problem Details (RFC 9457)
| Field | Meaning |
|:--|:--|
| ⭐ `type` | problem type URI |
| ⭐ `title` | short summary per type |
| ⭐ `status` | HTTP status |
| `detail` | this occurrence |
| `instance` | request path / occurrence URI |
| `errors` (extension) | field errors `[{ path, message, code }]` |
| `requestId` (extension) | support correlation |
| ⭐ `Content-Type: application/problem+json` | media type |

## Error architecture
| Piece | Role |
|:--|:--|
| ⭐ `AppError` subclasses | `NotFoundError`, `ConflictError`, `ForbiddenError` |
| Services throw domain/app errors | no Express knowledge |
| ⭐ One error handler | maps to Problem Details |
| `ZodError` → 422 | validation |
| JSON `SyntaxError` → 400 | malformed body |
| Unknown → 500 generic | log details, never leak |

## Response conventions
| Concern | Convention |
|:--|:--|
| ⭐ DTOs | never raw DB rows |
| ⭐ IDs | strings (bigint as string) |
| ⭐ Timestamps | ISO 8601 UTC |
| Dates | `YYYY-MM-DD` |
| ⭐ Money | `{ amount: 2599, currency: "EUR" }` |
| Enums | lowercase strings |
| Nulls | consistent: include nullable fields |
| Lists | `{ data, nextCursor }` |
| Expansions | `?expand=customer` (optional) |
| Field selection | `?fields=` (rarely worth it) |

## Pagination
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Cursor / keyset | `WHERE (created_at, id) < ($1, $2)` | stable, fast |
| ⭐ Opaque cursor | base64url of last row keys | |
| ⭐ `limit + 1` | detect next page | |
| ⭐ Max limit | e.g. 100 | |
| Unique tie-breaker | `ORDER BY created_at DESC, id DESC` | |
| Offset | `LIMIT/OFFSET` | small tables only |
| Matching index | `(account_id, created_at DESC, id DESC)` | |
| Totals | optional, expensive | approximate counts |
| `Link` header | `rel="next"` | alternative to body cursor |

## Idempotency
| Step | Behavior |
|:--|:--|
| ⭐ `Idempotency-Key` header | client UUID per operation |
| New key | record in-progress, process, store response |
| ⭐ Same key + same body | replay stored response |
| Same key + different body | 422 |
| Same key in progress | 409 |
| Scope | per account/user |
| TTL | ~24 h, cleanup job |
| Storage | Postgres unique key or Redis `SET NX` |
| Natural idempotency | PUT/DELETE by design |

## Concurrency
| Technique | How |
|:--|:--|
| ⭐ Optimistic locking | `version` column, `WHERE version = $n` |
| ⭐ `ETag` + `If-Match` | 412 on mismatch |
| `428 Precondition Required` | demand `If-Match` |
| Pessimistic locking | `SELECT … FOR UPDATE` |
| ⭐ Atomic updates | `SET qty = qty - 1 WHERE qty > 0` |
| `SKIP LOCKED` | work queues in SQL |

## Versioning and deprecation
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Additive changes | no new version needed | |
| ⭐ Breaking changes | remove/rename, type change, new required input | new major |
| `/v1` URL versioning | explicit | most common |
| Header / date versions | `Accept` media types, `Api-Version` | |
| ⭐ Tolerant reader | clients ignore unknown fields | |
| `Deprecation` header | RFC 9745 | |
| `Sunset` header | RFC 8594 | removal date |
| `Link rel="deprecation"` | migration docs | |
| Usage metrics per client | know who to contact | |
| `deprecated: true` in OpenAPI | docs | |

## Long-running operations
| Item | What it does |
|:--|:--|
| ⭐ `202 Accepted` + `Location` | start async work |
| `Retry-After` | polling hint |
| ⭐ Status resource | `{ status, progress, result }` |
| Completion | webhook, SSE, email |
| Idempotent start | `Idempotency-Key` |
| Cancellation | `DELETE` or `POST …/cancellation` |

## Webhooks you send
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Event envelope | `{ id, type, createdAt, data }` | |
| ⭐ HMAC signature | over `id.timestamp.body` | Standard Webhooks |
| `webhook-id` / `webhook-timestamp` / `webhook-signature` | headers | |
| ⭐ Retries with backoff | ~1–3 days | from a queue |
| ⭐ Consumers dedupe by `id` | at-least-once delivery | |
| Timestamp tolerance | ~5 min | replay protection |
| Ordering not guaranteed | versions/timestamps | |
| Delivery logs + redelivery | operations | |
| Secret rotation | multiple signatures | |
| Thin payloads | IDs + fetch | less sensitive data |

## API styles
| Style | Fits |
|:--|:--|
| ⭐ REST + OpenAPI | default |
| GraphQL | many clients, aggregation |
| tRPC | internal TS monorepos |
| gRPC | service-to-service |
| Webhooks / events | push to integrators |
| SSE / WebSocket | real-time updates |

## Contract tooling
| Tool | What it does | Note |
|:--|:--|:--|
| ⭐ zod-openapi | spec from Zod | 01-foundations/08 |
| ⭐ Committed `openapi.json` + drift check | contract in review | |
| oasdiff | breaking-change detection | also seen |
| openapi-typescript / orval | typed clients | also seen |
| Scalar | interactive docs | |
| Contract tests | provider/consumer agreement | also seen: Pact |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Verbs in URLs, GET with side effects | unpredictable, crawled | resources + methods |
| Express 4 wildcard syntax | startup crash | `/*splat` |
| Error handler with 3 params | never called | 4 params, last |
| Raw `req.body` usage | mass assignment, type bugs | Zod parse |
| DB rows as responses | leaks fields | DTOs |
| Stack traces in 500s | info leak | generic + request ID |
| Deep OFFSET | slow, inconsistent | cursors |
| Non-unique sort | skipped rows | add `id` tie-breaker |
| Retried POST | duplicates | idempotency keys |
| Read-modify-write counters | lost updates | atomic SQL |
| Renaming fields | broken clients | additive + deprecate |
| Long sync requests | timeouts, retries | 202 + status |
| Unsigned webhooks | spoofing | HMAC + timestamp |

## Sources
| Source | Link |
|:--|:--|
| Express 5 API | https://expressjs.com/en/5x/api.html |
| Migrating to Express 5 | https://expressjs.com/en/guide/migrating-5.html |
| RFC 9457 Problem Details | https://www.rfc-editor.org/rfc/rfc9457 |
| Zalando API guidelines | https://opensource.zalando.com/restful-api-guidelines/ |
| Microsoft API guidelines | https://github.com/microsoft/api-guidelines |
| Idempotency-Key draft | https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ |
| Standard Webhooks | https://www.standardwebhooks.com/ |
| Use The Index, Luke: no offset | https://use-the-index-luke.com/no-offset |
