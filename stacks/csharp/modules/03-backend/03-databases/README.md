---
title: Databases
module: 03-backend
tech: SQL Server 2025, EF Core 10, Dapper, Azure SQL
---
# Databases
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Relational modeling: normalization, keys, relationships, constraints
- [ ] ⭐ SQL you must know: joins, aggregates, CTEs, window functions, upserts
- [ ] ⭐ Indexes: clustered vs nonclustered, composite, covering (`INCLUDE`), filtered; reading execution plans
- [ ] ⭐ Transactions and isolation levels; locking and blocking; `READ_COMMITTED_SNAPSHOT`; deadlocks
- [ ] ⭐ Data access with ADO.NET and Dapper: connection pooling, parameterized queries, command timeouts, transactions
- [ ] ⭐ EF Core: `DbContext`, entities, relationships, configuration, change tracking, `AsNoTracking`
- [ ] ⭐ EF Core migrations: add, review the SQL, apply with scripts or bundles; zero-downtime changes
- [ ] ⭐ Optimistic concurrency in EF Core: `rowversion`, concurrency tokens, handling `DbUpdateConcurrencyException`
- [ ] Data types: `datetimeoffset`, `decimal` for money, `Guid.CreateVersion7()`, JSON columns, collations, enums
- [ ] The N+1 problem and how to avoid it
- [ ] Query performance in EF Core: logging the generated SQL, projections, split queries, compiled queries
- [ ] Stored procedures, views, and functions: when to use them, calling them from EF Core and Dapper
- [ ] Connection management in production: pool sizing, connection resiliency and retries, timeouts
- [ ] SQL security: least-privilege logins, contained users, Microsoft Entra authentication, row-level security, Always Encrypted
- [ ] SQL Server operations basics: Query Store, statistics, index maintenance, `sys.dm_*` views
- [ ] Tools: SSMS, the VS Code mssql extension, SQL Server in Docker
- [ ] Choosing SQL Server vs PostgreSQL vs a document store; JSON columns in between

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Relational modeling, data types, SQL you must know, and tools](docs/01-modeling-sql-tools.md)
- [02 · Indexes, execution plans, and SQL Server operations](docs/02-indexes-plans-operations.md)
- [03 · Transactions, isolation, locking, and optimistic concurrency](docs/03-transactions-concurrency.md)
- [04 · EF Core: model, change tracking, and migrations](docs/04-ef-core-model-migrations.md)
- [05 · Query performance: N+1, EF Core tuning, Dapper, stored procedures](docs/05-query-performance-dapper-procs.md)
- [06 · Connections, security, and choosing a database](docs/06-connections-security-choice.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/03-databases mode=tasks` when you are ready to build._
