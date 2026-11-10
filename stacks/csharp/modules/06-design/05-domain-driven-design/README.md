---
title: Domain-Driven Design
module: 06-design
tech: C# 14, EF Core 10, SQL Server 2025
---
# Domain-Driven Design
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Why DDD: complex domains, models, and the cost of misunderstanding
- [ ] ⭐ Ubiquitous language and domain experts; event storming
- [ ] Subdomains: core, supporting, generic; build vs buy
- [ ] ⭐ Bounded contexts and context maps: ACL, shared kernel, customer–supplier, conformist, open host, published language
- [ ] ⭐ Entities and value objects
- [ ] ⭐ Aggregates: invariants, consistency boundaries, references by ID, size
- [ ] Domain events and integration events
- [ ] Repositories, factories, domain services, and application services
- [ ] Modeling in C#: strongly typed IDs, records as value objects, factory methods, parse don't validate, illegal states unrepresentable
- [ ] Persisting aggregates with EF Core: owned and complex types, backing fields, `rowversion`, events through the outbox
- [ ] ⭐ DDD with clean/hexagonal architecture: where each building block lives
- [ ] When not to use DDD: CRUD, generic subdomains, prototypes, DDD-lite

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Why DDD, ubiquitous language, and subdomains](docs/01-why-language-subdomains.md)
- [02 · Bounded contexts and context maps](docs/02-bounded-contexts-maps.md)
- [03 · Entities, value objects, aggregates, and domain events](docs/03-building-blocks-aggregates.md)
- [04 · Services, modelling in C#, and persisting with EF Core](docs/04-services-modelling-ef-core.md)
- [05 · DDD with clean architecture, and when not to use DDD](docs/05-clean-architecture-when-not.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/06-design/05-domain-driven-design mode=tasks` when you are ready to build._
