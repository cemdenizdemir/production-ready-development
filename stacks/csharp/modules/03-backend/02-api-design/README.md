---
title: API Design
module: 03-backend
tech: ASP.NET Core 10 (Minimal APIs, controllers), Microsoft.AspNetCore.OpenApi, Orval
---
# API Design
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Resource-oriented REST design: nouns, URLs, methods, status codes
- [ ] ⭐ ASP.NET Core app structure: Minimal API route groups, the middleware pipeline and its order, endpoint filters, `IExceptionHandler`
- [ ] ⭐ Routing and binding: route templates and constraints, `[FromBody]`, `[FromQuery]`, `[AsParameters]`, `TypedResults`
- [ ] ⭐ Dependency injection in ASP.NET Core: registering services; singleton, scoped, and transient lifetimes; captive dependencies
- [ ] ⭐ Request validation with built-in Minimal API validation and FluentValidation: body, route, query; 400 vs 422
- [ ] ⭐ Consistent error responses with Problem Details (RFC 9457)
- [ ] Pagination: cursor vs offset; filtering and sorting conventions
- [ ] ⭐ Idempotency keys for safe retries of POST
- [ ] Versioning and evolving APIs without breaking clients; deprecation
- [ ] Response shaping: DTOs, field naming, dates, money, nulls
- [ ] Serialization with `System.Text.Json`: naming policies, enums as strings, source generation, polymorphism
- [ ] Concurrency control: ETags and `If-Match`, optimistic locking
- [ ] Long-running operations: 202 Accepted and status resources
- [ ] API contract and docs with OpenAPI 3.1 from Microsoft.AspNetCore.OpenApi
- [ ] ⭐ Contract-first frontend: generating the TypeScript client with Orval and catching breaking changes in CI
- [ ] Controllers: `[ApiController]`, attribute routing, filters; reading and maintaining controller-based codebases
- [ ] Webhooks you send: signatures, retries, and idempotency for consumers
- [ ] REST vs GraphQL vs RPC: when each fits

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · REST design, app structure, and the middleware pipeline](docs/01-rest-structure-pipeline.md)
- [02 · Routing, binding, and dependency injection](docs/02-routing-binding-di.md)
- [03 · Validation and Problem Details](docs/03-validation-problem-details.md)
- [04 · DTOs, serialization, pagination, and versioning](docs/04-dtos-json-pagination-versioning.md)
- [05 · Idempotency, concurrency, long-running operations, and webhooks](docs/05-idempotency-concurrency-async-webhooks.md)
- [06 · Contracts, controllers, and API styles](docs/06-contracts-controllers-styles.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/02-api-design mode=tasks` when you are ready to build._
