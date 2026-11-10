---
title: Domain-Driven Design cheatsheet
tech: C# 14, EF Core 10, SQL Server 2025
version: C# 14 / .NET 10, EF Core 10, SQL Server 2025
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Domain-Driven Design cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Why DDD
| Problem | DDD answer | Note |
|:--|:--|:--|
| ⭐ complex, changing rules | domain model | core subdomain |
| ⭐ misunderstandings | ubiquitous language | in code too |
| one word, many meanings | bounded contexts | |
| inconsistent rules | aggregates | invariants |
| even effort everywhere | subdomain classification | |

## Language and discovery
| Practice | Use when | Smell |
|:--|:--|:--|
| ⭐ ubiquitous language | always in modelled areas | `Status = 7`, `UpdateOrder(flags)` |
| glossary per context | terms confuse people | |
| ⭐ event storming | starting big work, confusing domains | workshops for CRUD screens |
| hotspots | conflicts, unknowns | ignored red stickies |

## Event storming stickies
| Sticky | Means | Example |
|:--|:--|:--|
| ⭐ domain event | fact, past tense | Order Placed |
| command | intention | Place Order |
| actor | who | customer |
| policy | whenever X then Y | Return Received → Issue Refund |
| aggregate | enforces rules | Order |
| external system | outside | Stripe |
| hotspot | question/risk | partial refunds? |

## Subdomains
| Type | Strategy | Shop |
|:--|:--|:--|
| ⭐ core | build, invest, full DDD | subscriptions, freshness pricing |
| ⭐ supporting | build simply | returns, loyalty |
| ⭐ generic | buy/integrate | payments, tax, email, identity |

## Bounded contexts
| Concept | Means | Smell |
|:--|:--|:--|
| ⭐ bounded context | consistent model + language | one 70-property `Product` |
| context = module/service | ownership, own data | shared tables |
| IDs cross, objects don't | `Sku`, `OrderId` | sharing entities |
| ⭐ context map | relationships + contracts | undocumented integrations |

## Context map relationships
| Relationship | Use when | Note |
|:--|:--|:--|
| ⭐ anti-corruption layer | messy/legacy upstream | translate |
| ⭐ customer–supplier | upstream plans for downstream | |
| ⭐ conformist | good upstream model | adopt it |
| ⭐ open host service | many consumers | public API |
| ⭐ published language | shared format | versioned events, OpenAPI |
| shared kernel | tiny shared model | `Money`, `Result` |
| partnership | joint success | close coordination |
| separate ways | no integration needed | |

## Building blocks
| Block | Identity | Note |
|:--|:--|:--|
| ⭐ entity | by ID | methods protect state |
| ⭐ value object | by value | immutable, validated |
| ⭐ aggregate | root's ID | consistency boundary |
| ⭐ domain event | — | inside context |
| ⭐ integration event | — | across contexts, outbox |
| domain service | — | cross-concept logic, stateless |
| application service | — | orchestration, no rules |
| factory | — | valid creation |
| ⭐ repository | — | per aggregate |

## Aggregate rules
| Rule | Why | Smell |
|:--|:--|:--|
| ⭐ invariants inside | always consistent | rules checked in services |
| ⭐ one root | single entry | `db.OrderLines.Add` |
| ⭐ reference by ID | small, independent | `Customer.Orders` collection |
| ⭐ one per transaction | low contention | multi-aggregate transactions |
| ⭐ keep small | fast loads | huge object graphs |
| optimistic concurrency | safe updates | lost updates |
| events recorded, dispatched after save | no premature side effects | emails inside methods |

## Modelling in C#
| Technique | C# | Prevents |
|:--|:--|:--|
| ⭐ strongly typed IDs | `readonly record struct OrderId(Guid Value)` | ID mix-ups |
| ⭐ value objects | records with validated ctors | mutation, invalid values |
| ⭐ factory returning `Result<T>` | `Email.Parse(...)` | invalid objects |
| ⭐ parse, don't validate | domain types after the boundary | forgotten validation |
| ⭐ illegal states unrepresentable | sealed record states / C# 15 unions | contradictory fields |
| private setters/ctors | `{ get; private set; }` | bypassing rules |

## EF Core mapping
| Need | Feature | Note |
|:--|:--|:--|
| ⭐ value objects | `ComplexProperty(...)` | EF Core 8+; JSON in 10 |
| collections of values | `OwnsMany` / complex JSON | |
| ⭐ typed IDs | `HasConversion(id => id.Value, v => new OrderId(v))` | or conventions |
| ⭐ private collections | `UsePropertyAccessMode(PropertyAccessMode.Field)` | backing fields |
| private ctors/setters | supported | no public setters needed |
| ⭐ concurrency | `IsRowVersion()` | 409 on conflict |
| enums as strings | `HasConversion<string>()` | readable DB |
| events → outbox | `SaveChangesInterceptor` | |
| child entities | no `DbSet` | through the root |

## Where blocks live
| Block | Ring | Folder |
|:--|:--|:--|
| ⭐ entities, VOs, aggregates, events | domain | `Domain/` |
| domain services | domain | `Domain/Services/` |
| ⭐ use cases | application | slice folders |
| ports | application | module core |
| ⭐ integration events | contracts | `*.Contracts/` |
| EF Core config, DbContext, repos | infrastructure | `Data/` |
| endpoints, DTOs | presentation | slice folders |

## When not to
| Situation | Instead | Note |
|:--|:--|:--|
| ⭐ CRUD | records + DbContext | transaction script |
| ⭐ generic subdomain | buy + port | |
| ⭐ prototype | simplest code | model later |
| reporting | read models, SQL | |
| ⭐ DDD-lite | language + contexts + VOs | most supporting areas |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| tactical patterns first | ceremony, wrong boundaries | strategic design first |
| invented language | experts don't recognise code | discover theirs |
| giant aggregates | contention, slow loads | small, by invariant |
| bypassing the root | broken invariants | methods on root |
| side effects in aggregates | effects without commit | events + outbox |
| primitive IDs | swapped arguments | typed IDs |
| public setters for EF | rule bypass | backing fields |
| attributes on domain | framework coupling | fluent config, DTOs |
| DDD everywhere | slow delivery | core only |
| growing shared kernel | coupling | keep tiny |

## Sources
| Source | Link |
|:--|:--|
| DDD Reference (Evans) | https://www.domainlanguage.com/ddd/reference/ |
| Effective aggregate design | https://www.dddcommunity.org/library/vernon_2011/ |
| DDD-oriented microservice | https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/ddd-oriented-microservice |
| Domain analysis (Azure) | https://learn.microsoft.com/azure/architecture/microservices/model/domain-analysis |
| Context mapping (DDD Crew) | https://github.com/ddd-crew/context-mapping |
| EventStorming | https://www.eventstorming.com/ |
| EF Core complex types | https://learn.microsoft.com/ef/core/modeling/complex-types |
| Parse, don't validate | https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/ |
