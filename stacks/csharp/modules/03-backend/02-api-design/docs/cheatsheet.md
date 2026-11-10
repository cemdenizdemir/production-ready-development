---
title: API Design cheatsheet
tech: ASP.NET Core 10 (Minimal APIs, controllers), Microsoft.AspNetCore.OpenApi, Orval
version: ASP.NET Core 10, FluentValidation 12.x, Asp.Versioning 8.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
---
# API Design cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## REST shapes
| Action | Request | Success |
|:--|:--|:--|
| ⭐ list | `GET /orders?cursor=&limit=` | 200 |
| ⭐ get | `GET /orders/{id}` | 200 / 404 |
| ⭐ create | `POST /orders` | 201 + `Location` |
| replace | `PUT /x/{id}` | 200 / 204 |
| partial | `PATCH /x/{id}` | 200 / 204 |
| delete | `DELETE /x/{id}` | 204 |
| action | `POST /orders/{id}/cancel` | 202 / 204 / 409 |
| current user | `/me/...` | |

## Structure
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `app.MapGroup("/orders")` | route group | tags, auth, filters per group |
| `.WithTags` / `.WithName` / `.RequireAuthorization()` | metadata | |
| ⭐ feature endpoint files | `MapOrderEndpoints()` extension | |
| named handler methods | testable, XML docs | |
| ⭐ `IEndpointFilter` / `.AddEndpointFilter<T>()` | per-endpoint cross-cutting | validation, idempotency |
| `app.Use(async (ctx, next) => …)` | inline middleware | |
| ⭐ `IExceptionHandler` + `AddExceptionHandler<T>()` | exception → Problem Details | |

## Middleware order
| # | Middleware | Note |
|:--|:--|:--|
| 1 | `UseForwardedHeaders` | behind proxies |
| 2 | ⭐ `UseExceptionHandler` | catches everything after |
| 3 | `UseHsts` / `UseHttpsRedirection` | |
| 4 | `UseRouting` | implicit in `WebApplication` |
| 5 | ⭐ `UseCors` | before auth |
| 6 | ⭐ `UseAuthentication` → `UseAuthorization` | |
| 7 | `UseRateLimiter` | endpoint policies |
| 8 | `UseRequestTimeouts` / `UseOutputCache` | |
| 9 | endpoints | implicit |

## Routing
| Template | Meaning | Note |
|:--|:--|:--|
| `{id:guid}` / `{id:int:min(1)}` | typed segment | disambiguation, not validation |
| `{slug:regex(^[a-z0-9-]+$)}` | regex | |
| `{*path}` | catch-all | |
| literal beats parameter | `/orders/export` vs `/orders/{id}` | |
| failed constraint | 404 | |

## Binding
| Source | How | Note |
|:--|:--|:--|
| route / query | parameter names | inferred |
| `[FromHeader(Name = "X")]` | header | |
| body | complex type | one per endpoint |
| `[FromForm]`, `IFormFile` | form | antiforgery |
| services | registered types | |
| `[FromKeyedServices("k")]` | keyed service | .NET 8+ |
| `HttpContext`, `ClaimsPrincipal`, `CancellationToken` | special | |
| ⭐ `[AsParameters]` | parameter object | list queries |
| `TryParse` / `BindAsync` | custom types | value objects |

## Dependency injection
| Lifetime | Per | Use |
|:--|:--|:--|
| ⭐ Singleton | app | stateless, thread-safe |
| ⭐ Scoped | request | `DbContext`, unit of work |
| Transient | resolution | light helpers |
| ⭐ captive dependency | singleton → scoped | bug; `ValidateScopes` |
| `ValidateOnBuild` | check graph at startup | Development default |
| `TryAdd*` | register if missing | libraries |
| keyed services | `AddKeyedScoped<I, T>("key")` | |
| `IServiceScopeFactory` | scopes in background work | |
| feature registration extensions | `AddOrderFeature()` | composition root |
| service locator | avoid | |

## Validation
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `AddValidation()` | DataAnnotations on parameters | .NET 10, source-generated |
| `.DisableValidation()` | opt out | |
| `[Required]`, `[Range]`, `[MaxLength]`, `[RegularExpression]`, `[EmailAddress]` | attributes | flow into OpenAPI |
| `IValidatableObject` | cross-field in the type | |
| ⭐ FluentValidation `AbstractValidator<T>` | rich rules | free |
| `RuleForEach(...).ChildRules(...)` | collections | |
| `AddValidatorsFromAssemblyContaining<T>()` | register | DI extensions package |
| `result.ToDictionary()` → `TypedResults.ValidationProblem` | 400 response | |
| 400 / 409 / 422 | fields / state conflict / business rule | one convention |

## Problem Details
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `AddProblemDetails()` | service + writer | adds `traceId` |
| ⭐ `UseExceptionHandler()` | 500 as Problem Details | |
| `UseStatusCodePages()` | empty errors → Problem Details | |
| `CustomizeProblemDetails` | add extensions | |
| `TypedResults.Problem(...)` | explicit problem | |
| `TypedResults.ValidationProblem(errors)` | field errors | |
| `IProblemDetailsService.TryWriteAsync` | write from handlers | |
| `type` URI + `code` extension | stable contract | |

## DTOs and JSON
| Item | Does | Note |
|:--|:--|:--|
| ⭐ no entities in responses | DTO per use case | |
| `Select(...)` projection | only needed columns | |
| Mapperly / explicit mapping | mapping | AutoMapper 15+ commercial |
| `ConfigureHttpJsonOptions` | Minimal API JSON | `AddJsonOptions` for MVC |
| ⭐ `JsonStringEnumConverter` | enums as strings | |
| `RespectNullableAnnotations` | strict nulls | .NET 9+ |
| `UnmappedMemberHandling.Disallow` | reject unknown fields | |
| ⭐ `JsonSerializerContext` + `[JsonSerializable]` | source generation | `TypeInfoResolverChain` |
| web defaults | camelCase, case-insensitive | |

## Pagination
| Item | Does | Note |
|:--|:--|:--|
| offset | `OFFSET/FETCH` | slow deep pages |
| ⭐ cursor / keyset | `WHERE (sort, tiebreak) < (@c)` | stable, fast |
| unique tie-breaker | `Number`/`Id` | avoid Guid comparisons |
| `Take(limit + 1)` | detect next page | |
| ⭐ max page size | `Math.Clamp` | |
| opaque cursor | `Base64Url` | .NET 9+ |
| `{ items, nextCursor }` | response | |
| allowlisted sort fields | no SQL from input | |

## Versioning
| Item | Does | Note |
|:--|:--|:--|
| ⭐ additive evolution | default | |
| breaking changes | remove/rename/type change/new required input | |
| `/v2/...` | URL versioning | |
| `api-version` header/query | versioning | |
| `Asp.Versioning.Http` | version sets, reporting | Minimal APIs |
| deprecation headers + changelog | 01-foundations/08 | |

## Idempotency
| Case | Response | Note |
|:--|:--|:--|
| ⭐ `Idempotency-Key` header | per logical POST | client UUID |
| replay (same body) | stored response | |
| in progress | 409 | |
| different body | 422 | |
| storage | unique `(UserId, Key)` | same transaction |
| expiry | ~24 h | |

## Concurrency
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `rowversion` / `[Timestamp]` / `IsRowVersion()` | version column | SQL Server |
| `ETag` header | expose version | Base64 |
| ⭐ `If-Match` | required on update | |
| 412 | version mismatch | |
| 428 | `If-Match` missing | |
| `OriginalValue = clientVersion` | EF check | |
| `DbUpdateConcurrencyException` | conflict detected | → 412 |

## Long-running operations
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `202 Accepted` + `Location` | start async work | |
| `/operations/{id}` | status resource | running/succeeded/failed |
| `Retry-After` | polling hint | |
| `303 See Other` | redirect to result | optional |
| background job | does the work | Hangfire |
| SSE | push progress | optional |

## Outgoing webhooks
| Item | Practice | Note |
|:--|:--|:--|
| ⭐ HMAC-SHA256 signature | `timestamp.body` | per-subscriber secret |
| `Webhook-Id` / `-Timestamp` / `-Signature` | headers | Standard Webhooks |
| retries with backoff | job system | then disable/alert |
| event IDs | consumer idempotency | |
| SSRF checks | subscriber URLs | |
| short timeouts | 5–10 s | |
| delivery logs | per attempt | |

## Contract and clients
| Item | Does | Note |
|:--|:--|:--|
| ⭐ build-time OpenAPI file | committed contract | |
| `git diff --exit-code openapi/` | stale contract | CI |
| ⭐ `oasdiff breaking` | breaking changes | label + approval |
| Orval regen + typecheck | frontend in sync | same PR |
| stable `operationId`s | client names | `WithName` |

## Controllers
| Item | Does | Note |
|:--|:--|:--|
| `AddControllers()` / `MapControllers()` | enable MVC | coexist with Minimal APIs |
| ⭐ `[ApiController]` | auto 400, binding inference, Problem Details | |
| `[Route]`, `[HttpGet("{id:guid}")]` | attribute routing | |
| `ActionResult<T>` | typed results | |
| `CreatedAtAction` | 201 + Location | |
| `[ProducesResponseType<T>(200)]` | OpenAPI metadata | |
| action / exception / result filters | cross-cutting | |
| `ControllerBase` | API base class | no views |

## API styles
| Style | Fits | Note |
|:--|:--|:--|
| ⭐ REST + OpenAPI | public, frontend | caching |
| GraphQL (HotChocolate) | many varied clients | cost control |
| gRPC | internal, streaming | gRPC-Web for browsers |
| messaging | async integration | 03-backend/07 |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| entities as responses | leaks, coupling | DTOs |
| CORS after auth | preflight 401 | before auth |
| singleton → scoped | captive DbContext | scopes |
| constraints as validation | 404 not 400 | validators |
| numeric enums | silent changes | strings |
| offset deep pages | slow | keyset |
| POST without idempotency | duplicates | keys |
| last write wins | lost updates | ETags |
| long work in request | ingress timeout | 202 + job |
| hand-written TS types | drift | Orval |

## Sources
| Source | Link |
|:--|:--|
| Minimal APIs | https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/overview |
| Middleware | https://learn.microsoft.com/aspnet/core/fundamentals/middleware/ |
| Parameter binding | https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/parameter-binding |
| DI guidelines | https://learn.microsoft.com/dotnet/core/extensions/dependency-injection-guidelines |
| Error handling (APIs) | https://learn.microsoft.com/aspnet/core/fundamentals/error-handling-api |
| FluentValidation | https://docs.fluentvalidation.net/ |
| EF Core concurrency | https://learn.microsoft.com/ef/core/saving/concurrency |
| Controllers (web API) | https://learn.microsoft.com/aspnet/core/web-api/ |
| Microsoft API guidelines | https://github.com/microsoft/api-guidelines |
