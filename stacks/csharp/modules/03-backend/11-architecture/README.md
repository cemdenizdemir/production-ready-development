---
title: Architecture
module: 03-backend
tech: ASP.NET Core 10, C# 14, built-in DI, Mapperly
---
# Architecture
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ What architecture is for: change, teams, trade-offs; start with a modular monolith
- [ ] ⭐ Layers: routes, use cases, domain, repositories; the dependency rule
- [ ] ⭐ Feature modules with public APIs instead of technical-layer folders
- [ ] ⭐ Dependency injection with the built-in container: composition root, registration per module, keyed services, fakes in tests
- [ ] Domain logic: business rules out of HTTP and SQL; value objects and invariants
- [ ] Error architecture: domain errors with codes, mapped to HTTP in one place
- [ ] Ports and adapters for external services: payments, email, storage
- [ ] Events between modules: domain events, the outbox, eventual consistency
- [ ] Mediators and mappers: plain services vs MediatR (commercial from v13); Mapperly vs manual mapping; AutoMapper's licence
- [ ] Clean Architecture templates in .NET: what they get right, and where they over-engineer
- [ ] Monolith vs microservices: when to split, costs, the distributed-monolith trap
- [ ] Recording and evolving decisions: ADRs, the strangler fig
- [ ] Transactions and consistency boundaries: unit of work, no network calls inside transactions
- [ ] Enforcing boundaries: one project per module, `internal` types, architecture tests, CODEOWNERS

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Modular monolith, layers, and feature modules](docs/01-modular-monolith-layers-modules.md)
- [02 · Dependency injection and the composition root](docs/02-dependency-injection.md)
- [03 · Domain logic, error architecture, and ports and adapters](docs/03-domain-errors-ports.md)
- [04 · Events between modules and consistency boundaries](docs/04-events-transactions.md)
- [05 · Mediators, mappers, and Clean Architecture templates](docs/05-mediators-mappers-templates.md)
- [06 · Microservices, decisions, and enforcing boundaries](docs/06-microservices-adrs-boundaries.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/11-architecture mode=tasks` when you are ready to build._
