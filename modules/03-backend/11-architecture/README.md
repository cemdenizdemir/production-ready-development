---
title: Architecture
module: 03-backend
tech: Node.js 26, Express 5, TypeScript
---
# Architecture
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ What architecture is for: change, teams, trade-offs; start with a modular monolith
- [ ] ⭐ Layers: routes, use cases, domain, repositories; the dependency rule
- [ ] ⭐ Feature modules with public APIs instead of technical-layer folders
- [ ] ⭐ Dependency injection without a framework: composition root, factory functions, fakes in tests
- [ ] Domain logic: business rules out of HTTP and SQL; value objects and invariants
- [ ] Error architecture: domain errors with codes, mapped to HTTP in one place
- [ ] Ports and adapters for external services: payments, email, storage
- [ ] Events between modules: domain events, the outbox, eventual consistency
- [ ] Monolith vs microservices: when to split, costs, the distributed-monolith trap
- [ ] Recording and evolving decisions: ADRs, the strangler fig
- [ ] Transactions and consistency boundaries: unit of work, no network calls inside transactions
- [ ] Enforcing boundaries: ESLint import rules, architecture tests, CODEOWNERS

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Goals, layers, and feature modules](docs/01-goals-layers-modules.md)
- [02 · Dependency injection and ports and adapters](docs/02-di-ports-adapters.md)
- [03 · Domain logic, errors, and transactions](docs/03-domain-errors-transactions.md)
- [04 · Events, service boundaries, decisions, and enforcement](docs/04-events-boundaries-decisions.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 03-backend/11-architecture mode=tasks` when you are ready to build._
