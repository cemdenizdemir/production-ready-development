---
title: Architecture Styles cheatsheet
tech: C#, ASP.NET Core 10, Next.js 16, React 19.2
version: .NET 10, Next.js 16, React 19.2
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Architecture Styles cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Quality attributes
| Attribute | Question | Note |
|:--|:--|:--|
| ⭐ changeability | cost of the next feature | |
| ⭐ deployability | release safely and often | |
| ⭐ scalability | handle peaks | |
| ⭐ availability | survive failures | |
| performance | latency | |
| security | blast radius | |
| team autonomy | independent shipping | |
| operability / cost | effort to run | |
| testability | fast, reliable tests | |

## Layers and tiers
| Concept | Use when | Smell |
|:--|:--|:--|
| ⭐ layers (logical) | organise code by responsibility | features spread across all layers |
| ⭐ tiers (physical) | security, scaling, ownership needs | extra tiers for one team's CRUD |
| closed layers | strict boundaries | pass-through services |
| open layers | reads skipping layers | business rules bypassed |

## UI patterns
| Pattern | Where | Note |
|:--|:--|:--|
| MVC | ASP.NET Core MVC, Razor | server-rendered |
| MVP | legacy desktop/web forms | |
| MVVM | WPF, MAUI, Blazor (partly) | bindings |
| ⭐ component-based | React, Next.js, Blazor | state + rendering per component |
| ⭐ rules in backend | UI mirrors validation for UX | API is authoritative |

## Clean / hexagonal / onion
| Style | Core idea | Smell |
|:--|:--|:--|
| ⭐ hexagonal | ports owned by the app, adapters outside | vendor types in core |
| onion | rings, inner knows nothing of outer | |
| ⭐ clean | dependencies point inward | domain references EF Core/ASP.NET |
| ⭐ dependency rule | the shared principle | |
| project-per-layer | big teams, strict separation | 4 projects for small apps |

## Organising code
| Style | Use when | Smell |
|:--|:--|:--|
| technical layers | small apps, few features | one feature touches 6 folders |
| ⭐ vertical slices | per-use-case cohesion | shared "god" services across slices |
| ⭐ feature modules | ownership, boundaries | modules sharing tables |

## Modular monolith
| Property | Practice | Note |
|:--|:--|:--|
| ⭐ one deployable | in-process calls | |
| ⭐ public contracts | `*.Contracts` projects | `internal` rest |
| ⭐ data per module | schema + DbContext each | |
| events between modules | outbox | |
| enforcement | projects, NetArchTest, CODEOWNERS | |
| evolution | extract along contracts | |

## Microservices
| Aspect | Rule | Smell |
|:--|:--|:--|
| ⭐ data | database per service | shared database |
| ⭐ boundaries | business capabilities | technical-layer services |
| ⭐ communication | async events for reactions | sync call chains |
| ⭐ reason to split | team, scaling, security, tech | "modern" |
| deployment | independent | lockstep releases |
| distributed monolith | | all of the above smells |

## Event-driven
| Concept | Means | Note |
|:--|:--|:--|
| ⭐ event | past-tense fact | `OrderPlaced` |
| event notification | thin, call back for details | coupling |
| ⭐ event-carried state transfer | data in the event | no callbacks |
| ⭐ choreography | services react independently | simple reactions |
| ⭐ orchestration | coordinator drives steps | workflows, compensation |
| Service Bus / Event Grid / Event Hubs | business / resource / streams | Azure |

## CQRS and event sourcing
| Pattern | Use when | Avoid when |
|:--|:--|:--|
| ⭐ CQRS-lite | separate read paths | — (default) |
| full CQRS | very different read/write models/loads | CRUD |
| ⭐ event sourcing | audit/temporal needs, event-centred domains | CRUD, "just for audit" |
| projections | read models from events | |
| snapshots, upcasting | long streams, versions | ES costs |

## Serverless
| Option | Use when | Note |
|:--|:--|:--|
| ⭐ Azure Functions (isolated) | event-triggered isolated work | cold starts |
| ⭐ Container Apps jobs | run-to-completion work | migrations, batch |
| scale to zero apps | idle internal tools | |
| Logic Apps | low-code workflows | |

## BFF and gateways
| Pattern | Purpose | In stack |
|:--|:--|:--|
| ⭐ BFF | frontend-shaped backend, session | Next.js server |
| ⭐ API gateway | routing, auth, rate limits, TLS | Front Door, APIM, YARP |
| aggregation | one call for many | BFF/gateway |
| offloading | cross-cutting at the edge | WAF, policies |
| ⭐ no business rules | thin gateways | |

## Fitness functions and ADRs
| Tool | Checks | Runs |
|:--|:--|:--|
| ⭐ architecture tests | dependency rule, boundaries | every PR |
| k6 thresholds | performance budgets | nightly / PR smoke |
| SLO alerts | availability | continuous |
| licence/dependency checks | allowed packages | every PR |
| Bicep linter / PSRule | infra rules | infra PRs |
| ⭐ ADRs | decisions + trade-offs | when deciding |
| quality scenarios | measurable attributes | "p95 < 500 ms at 300 rps" |

## The shop's combination
| Level | Style | Note |
|:--|:--|:--|
| deployment | n-tier + serverless helpers | Container Apps, Functions |
| backend | modular monolith | |
| per module | clean architecture + slices | |
| core | DDD | |
| integration | events via outbox | Service Bus |
| reads | CQRS-lite | projections, replica |
| edge | gateway + BFF | Front Door, Next.js |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| style before attributes | wrong trade-offs | list attributes, ADR |
| tiers for code organisation | latency, coordination | layers |
| attributes on domain types | framework coupling | fluent config, DTOs |
| one shared DbContext | module coupling | DbContext per module |
| early microservices | distributed monolith | modular monolith |
| thin "updated" events | callbacks, coupling | event-carried state |
| event sourcing for CRUD | complexity | plain tables + audit |
| rules in BFF/gateway | second backend | API owns rules |
| unchecked architecture | erosion | fitness functions |

## Sources
| Source | Link |
|:--|:--|
| Azure architecture styles | https://learn.microsoft.com/azure/architecture/guide/architecture-styles/ |
| .NET web app architectures | https://learn.microsoft.com/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures |
| Clean Architecture | https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html |
| Hexagonal | https://alistair.cockburn.us/hexagonal-architecture/ |
| Vertical slices | https://www.jimmybogard.com/vertical-slice-architecture/ |
| Microservices (Fowler) | https://martinfowler.com/articles/microservices.html |
| CQRS | https://learn.microsoft.com/azure/architecture/patterns/cqrs |
| Event sourcing | https://learn.microsoft.com/azure/architecture/patterns/event-sourcing |
| BFF | https://learn.microsoft.com/azure/architecture/patterns/backends-for-frontends |
| Fitness functions | https://www.thoughtworks.com/radar/techniques/architectural-fitness-function |
