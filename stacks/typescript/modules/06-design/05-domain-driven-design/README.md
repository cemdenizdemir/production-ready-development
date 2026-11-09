---
title: Domain-Driven Design
module: 06-design
tech: TypeScript, Node.js 26, Drizzle ORM, PostgreSQL 18
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
- [ ] Modeling in TypeScript: branded types, smart constructors, parse don't validate, illegal states unrepresentable
- [ ] Persisting aggregates with Drizzle: data mapping, optimistic concurrency, events through the outbox
- [ ] ⭐ DDD with clean/hexagonal architecture: where each building block lives
- [ ] When not to use DDD: CRUD, generic subdomains, prototypes, DDD-lite

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Strategic DDD: language, subdomains, bounded contexts](docs/01-strategic-ddd.md)
- [02 · Tactical building blocks: entities, value objects, aggregates, events](docs/02-tactical-building-blocks.md)
- [03 · Services, repositories, and modeling in TypeScript](docs/03-modeling-in-typescript.md)
- [04 · Persistence, DDD with clean architecture, and when not to](docs/04-persistence-clean-architecture.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn typescript/06-design/05-domain-driven-design mode=tasks` when you are ready to build, or practice with `/design "<domain>" area=ddd`._
