---
title: Databases
module: 03-backend
tech: PostgreSQL 18, pg, Drizzle ORM, MongoDB 8, Mongoose
---
# Databases
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Relational modeling: normalization, keys, relationships, constraints
- [ ] ⭐ SQL you must know: joins, aggregates, CTEs, window functions, upserts
- [ ] ⭐ Indexes: B-tree, composite, partial, expression, GIN; reading `EXPLAIN ANALYZE`
- [ ] ⭐ Transactions and isolation levels; locking; `SELECT … FOR UPDATE SKIP LOCKED`
- [ ] ⭐ Using `pg` safely: pools, parameterized queries, timeouts, transactions
- [ ] Drizzle ORM: schema in TypeScript, queries, relations, transactions
- [ ] ⭐ Migrations with Drizzle Kit: generate, review, apply; zero-downtime changes
- [ ] Data types: `timestamptz`, money as integer minor units, `uuidv7()`, `jsonb`, `citext`, enums
- [ ] The N+1 problem and how to avoid it
- [ ] Connection management in production: pool sizing, RDS Proxy/PgBouncer, timeouts
- [ ] MongoDB data modeling: embed vs reference, schema design patterns
- [ ] Mongoose: schemas, validation, indexes, `lean()`, transactions, query sanitization
- [ ] Postgres operations basics: VACUUM, autovacuum, bloat, `pg_stat_statements`
- [ ] Choosing Postgres vs MongoDB (and JSONB in between)

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Relational modeling, SQL, and data types](docs/01-modeling-sql-types.md)
- [02 · Indexes, query plans, N+1, and operations](docs/02-indexes-performance-operations.md)
- [03 · Transactions, `pg`, and connections](docs/03-transactions-pg-connections.md)
- [04 · Drizzle ORM and migrations](docs/04-drizzle-and-migrations.md)
- [05 · MongoDB, Mongoose, and choosing a database](docs/05-mongodb-and-choosing.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 03-backend/03-databases mode=tasks` when you are ready to build._
