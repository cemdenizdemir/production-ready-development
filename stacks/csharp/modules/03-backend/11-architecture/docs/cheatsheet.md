---
title: Architecture cheatsheet
tech: ASP.NET Core 10, C# 14, built-in DI, Mapperly
version: .NET 10, C# 14, Riok.Mapperly 4.x, NetArchTest.Rules 1.3.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
---
# Architecture cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Goals
| Goal | Sign it works | Note |
|:--|:--|:--|
| ⭐ cheap change | common changes touch one module | |
| team autonomy | owners per module | CODEOWNERS |
| explicit trade-offs | ADRs | |
| testability | rules tested without I/O | |
| ⭐ modular monolith first | one deploy, clear seams | split later |

## Layers
| Layer | Holds | Depends on |
|:--|:--|:--|
| routes | HTTP binding, auth, status | use cases |
| ⭐ use cases | one operation, transaction, ports | domain, ports |
| ⭐ domain | entities, value objects, events | nothing |
| data / adapters | DbContext, SDK clients | domain, ports |
| ⭐ dependency rule | dependencies point inward | |
| repositories | optional over EF Core | only when reused |

## Module anatomy
| Part | Visibility | Example |
|:--|:--|:--|
| ⭐ Contracts project | public | `ICatalogQueries`, `OrderPlaced` |
| implementation | `internal` | handlers, domain, data |
| ⭐ own tables | schema per module | `ordering.*` |
| `AddXxxModule(...)` | public | DI registration |
| `MapXxxEndpoints(...)` | public | routes |
| vertical slices | folder per use case | `PlaceOrder/` |
| shared kernel | tiny, stable | `Result`, `Money` |

## DI lifetimes
| Lifetime | Per | Use |
|:--|:--|:--|
| ⭐ singleton | app | stateless, clients, options |
| ⭐ scoped | request | `DbContext`, handlers |
| transient | resolve | light helpers, typed HttpClients |
| captive dependency | singleton → scoped | bug |

## DI APIs
| API | Does | Note |
|:--|:--|:--|
| ⭐ `ValidateScopes` / `ValidateOnBuild` | catch mistakes at startup | `UseDefaultServiceProvider` |
| ⭐ `AddKeyedScoped<T, TImpl>("key")` | keyed registration | .NET 8+ |
| `[FromKeyedServices("key")]` | inject keyed | |
| `GetRequiredKeyedService<T>(key)` | runtime key | |
| `TryAdd*` | add if missing | library defaults |
| `IEnumerable<T>` | all implementations | |
| `IServiceScopeFactory` | scopes in singletons | |
| `AddOptions<T>().BindConfiguration(...).ValidateOnStart()` | validated options | |
| `TimeProvider` / `FakeTimeProvider` | testable time | |
| Scrutor | scanning, decorators | also seen |
| service locator | hidden dependencies | avoid |

## Test seams
| Seam | How | Note |
|:--|:--|:--|
| ⭐ `ConfigureTestServices` | replace in integration tests | WebApplicationFactory |
| `services.Replace(...)` | swap one registration | |
| `services.RemoveAll<T>()` | remove all | |
| NSubstitute | fakes in unit tests | |
| `InternalsVisibleTo` | tests see internals | |

## Domain modelling
| Tool | C# | Note |
|:--|:--|:--|
| ⭐ value object | `readonly record struct Money(...)` | immutable, by value |
| strongly typed ID | `record struct OrderId(long Value)` | no mix-ups |
| ⭐ encapsulated entity | private setters, methods | invariants |
| factory method | `Order.Create(...)` | valid or error |
| read-only collections | `IReadOnlyList<T>` | |
| domain events | recorded on aggregate | dispatched on save |

## Errors
| Kind | Represent | HTTP |
|:--|:--|:--|
| ⭐ expected | `Result<T>` + `Error(Code, Message, Type)` | 404/409/422 |
| validation | validation problem | 400 |
| forbidden | error or 404 | 403/404 |
| ⭐ unexpected | exception → global handler | 500/503 |
| ⭐ stable codes | `order.already_shipped` | in problem `code` |
| ⭐ one mapping | `ToHttp()` / `ToProblem()` | |
| libraries | ErrorOr, OneOf, FluentResults | also seen |

## Ports and adapters
| Port | Adapter | Fake |
|:--|:--|:--|
| ⭐ `IPaymentGateway` | `StripeGateway` | `FakePaymentGateway` |
| `IEmailSender` | `AcsEmailSender` | `FakeEmailSender` |
| `IFileStorage` | `BlobFileStorage` | `LocalFileStorage` |
| `TimeProvider` | `TimeProvider.System` | `FakeTimeProvider` |
| vendor types | stay in adapter | |
| no port | own `DbContext` | not swapped |

## Events
| Kind | Scope | Delivery |
|:--|:--|:--|
| ⭐ domain event | inside module | same transaction |
| ⭐ integration event | between modules | outbox, after commit |
| versioned names | `OrderPlaced.v1` | public contract |
| ⭐ idempotent handlers | inbox per handler | |
| in-process dispatcher | monolith | swap for Service Bus |
| eventual consistency | design the UI for it | |

## Transactions
| Rule | Why | Note |
|:--|:--|:--|
| ⭐ one module per transaction | independence | |
| ⭐ `DbContext` = unit of work | one `SaveChangesAsync` | |
| ⭐ no network calls inside | locks, no rollback | |
| side effects via outbox | publish only on commit | |
| `CreateExecutionStrategy().ExecuteAsync(...)` | explicit tx with retries | |
| sagas / process managers | cross-module workflows | compensations |
| reconciliation job | repair crashes | |

## Mediators
| Option | Licence | Note |
|:--|:--|:--|
| ⭐ plain injected handlers | — | F12 works |
| endpoint filters | built in | cross-cutting |
| decorators | — | explicit |
| MediatR 13+ | commercial | community tier for small companies |
| `Mediator` (source-generated) | MIT | also seen |
| Wolverine | MIT | handlers + messaging |

## Mappers
| Option | How | Note |
|:--|:--|:--|
| ⭐ manual | `ToDto()`, constructors | explicit |
| ⭐ Mapperly | `[Mapper] partial class` | MIT, source-generated |
| `RequiredMappingStrategy.Target` | all DTO members mapped | |
| `[MapProperty(..., Use = ...)]` | custom member map | |
| `[MapperIgnoreSource(...)]` | explicit exclusion | |
| `IQueryable<T>` projection | SQL projection | |
| RMG012 / RMG020 | unmapped members | warnings as errors |
| AutoMapper 15+ | commercial, runtime | avoid in new code |

## Clean Architecture templates
| Keep | Drop (usually) | Note |
|:--|:--|:--|
| ⭐ dependency rule | project per layer by default | |
| testable use cases | mediator for every call | |
| ports for externals | repositories over EF Core | |
| consistent structure | interfaces used once | |
| | folders by technical role | use features |

## Monolith vs microservices
| Split when | Don't split when | Note |
|:--|:--|:--|
| very different scaling | "modern" | |
| separate team blocked by releases | one small team | |
| security/compliance boundary | unclear boundaries | |
| different tech need | shared data needed | |
| ⭐ distributed-monolith signs | lockstep deploys, sync chains, shared DB | avoid |

## Decisions
| Item | Does | Note |
|:--|:--|:--|
| ⭐ ADR | context, decision, consequences, status | `docs/adr/NNNN-*.md` |
| status | Proposed / Accepted / Superseded | never delete |
| ⭐ strangler fig | route by route replacement | YARP / Front Door |
| STACK.md decision log | stack choices | this repo |

## Enforcing boundaries
| Mechanism | Enforces | Note |
|:--|:--|:--|
| ⭐ project per module | reference graph | Contracts only |
| ⭐ `internal` default | visibility | |
| ⭐ NetArchTest / ArchUnitNET | custom rules | CI |
| `HaveDependencyOnAny(...)` | forbidden namespaces | NetArchTest |
| `Should().NotBePublic()` | visibility rule | NetArchTest |
| schema per module | no cross-module SQL | |
| ⭐ CODEOWNERS | review by owners | `.github/CODEOWNERS` |
| `Directory.Build.props` | shared settings | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| technical-layer folders | changes everywhere | feature modules |
| cross-module table access | hidden coupling | contracts/events |
| giant shared project | coupling magnet | tiny kernel |
| captive `DbContext` | threading errors | scopes |
| rules in endpoints | duplicated, drifting | domain methods |
| exceptions for expected cases | string matching | results + codes |
| network call in transaction | locks, inconsistency | outbox, after commit |
| convention mapping | data leaks | explicit mapping |
| copied templates | ceremony | start small |
| early microservices | distributed monolith | modules first |
| undocumented decisions | repeated debates | ADRs |

## Sources
| Source | Link |
|:--|:--|
| .NET architecture guide | https://learn.microsoft.com/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures |
| DI in .NET | https://learn.microsoft.com/dotnet/core/extensions/dependency-injection |
| DDD-oriented microservice | https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/ddd-oriented-microservice |
| Mapperly | https://mapperly.riok.app/ |
| NetArchTest | https://github.com/BenMorris/NetArchTest |
| Strangler fig | https://learn.microsoft.com/azure/architecture/patterns/strangler-fig |
| ADRs | https://adr.github.io/ |
| MonolithFirst | https://martinfowler.com/bliki/MonolithFirst.html |
