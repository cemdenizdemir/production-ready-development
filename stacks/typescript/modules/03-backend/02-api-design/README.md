---
title: API Design
module: 03-backend
tech: Express 5, Zod 4, OpenAPI 3.1
---
# API Design
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Resource-oriented REST design: nouns, URLs, methods, status codes
- [ ] ⭐ Express 5 app structure: routers, middleware order, async errors, and the error handler
- [ ] ⭐ Request validation with Zod: body, params, query; 400 vs 422
- [ ] ⭐ Consistent error responses with Problem Details (RFC 9457)
- [ ] Pagination: cursor vs offset; filtering and sorting conventions
- [ ] ⭐ Idempotency keys for safe retries of POST
- [ ] Versioning and evolving APIs without breaking clients; deprecation
- [ ] Response shaping: DTOs, field naming, dates, money, nulls
- [ ] Concurrency control: ETags and `If-Match`, optimistic locking
- [ ] Long-running operations: 202 Accepted and status resources
- [ ] API contract and docs with OpenAPI 3.1 generated from Zod
- [ ] Webhooks you send: signatures, retries, and idempotency for consumers
- [ ] REST vs GraphQL vs RPC: when each fits

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Resources, Express 5 structure, and API styles](docs/01-rest-and-express-structure.md)
- [02 · Validation, errors, and response shapes](docs/02-validation-errors-responses.md)
- [03 · Pagination, idempotency, and concurrency](docs/03-pagination-idempotency-concurrency.md)
- [04 · Evolution, async operations, webhooks, and the contract](docs/04-evolution-async-webhooks-contract.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn typescript/03-backend/02-api-design mode=tasks` when you are ready to build._
