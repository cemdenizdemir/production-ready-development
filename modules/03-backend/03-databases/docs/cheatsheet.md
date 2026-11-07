---
title: Databases cheatsheet
tech: PostgreSQL 18, pg, Drizzle ORM, MongoDB 8, Mongoose
version: PostgreSQL 18, pg 8, Drizzle ORM 0.45 (1.0 RC), drizzle-kit, MongoDB 8, Mongoose 9
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
---
# Databases cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Modeling
| Concept | Practice |
|:--|:--|
| ⭐ Surrogate PK | `uuid DEFAULT uuidv7()` (PG 18) or identity `bigint` |
| ⭐ Natural keys | `UNIQUE` constraints |
| 1:N / N:M | FK on the many side / join table |
| ⭐ Normalize (~3NF) | store each fact once |
| Denormalize deliberately | prices/addresses at purchase time |
| ⭐ Tenant column | `account_id` everywhere |
| Soft delete | `deleted_at` + partial unique index |
| Audit columns | `created_at`, `updated_at` timestamptz |
| ⭐ Constraints | NOT NULL, UNIQUE, CHECK, FK, EXCLUDE |
| FK actions | `ON DELETE RESTRICT \| CASCADE \| SET NULL` |

## Data types
| Need | Type | Avoid |
|:--|:--|:--|
| ⭐ Moments | `timestamptz` | `timestamp` |
| Dates | `date` | midnight timestamps |
| ⭐ Money | integer minor units + `char(3)` currency, or `numeric` | `float`, `money` |
| Text | `text` | `varchar(255)` habit |
| Emails | `citext` or `lower()` index | case duplicates |
| ⭐ IDs | `uuid` / identity | `serial` |
| JSON | `jsonb` | `json`, core data in blobs |
| Small value sets | `text` + `CHECK` or enum | free text |
| Derived | generated columns (virtual default in PG 18) | duplicated logic |
| Ranges | `tstzrange` + exclusion | overlapping bookings |

## SQL essentials
| Feature | Example |
|:--|:--|
| ⭐ Joins | `JOIN` / `LEFT JOIN … ON` |
| ⭐ Anti-join | `WHERE NOT EXISTS (SELECT 1 …)` |
| Aggregates | `GROUP BY … HAVING`, `count(*) FILTER (WHERE …)` |
| CTE | `WITH x AS (…)`, `WITH RECURSIVE` |
| ⭐ Window functions | `row_number() OVER (PARTITION BY … ORDER BY …)`, `lag`, `sum() OVER` |
| `DISTINCT ON` | latest row per group |
| ⭐ Upsert | `ON CONFLICT (…) DO UPDATE SET x = EXCLUDED.x` |
| ⭐ `RETURNING` | rows written; PG 18 `OLD`/`NEW` |
| `MERGE` | multi-action upserts |
| `LATERAL` | per-row subqueries |
| `jsonb` ops | `->`, `->>`, `@>`, `?`, `jsonb_set` |
| `ANY($1::uuid[])` | batch lookups |
| Full-text | `to_tsvector`, `websearch_to_tsquery`, GIN |
| `generate_series` | date ranges, test data |

## Indexes
| Type | Use | Note |
|:--|:--|:--|
| ⭐ B-tree composite | `(account_id, status, created_at DESC)` | leftmost first |
| ⭐ Partial | `WHERE deleted_at IS NULL` | smaller, targeted |
| ⭐ Expression | `(lower(email))` | match the query |
| Covering `INCLUDE` | index-only scans | |
| GIN | jsonb, arrays, full-text, `pg_trgm` | |
| GiST | ranges, geo, exclusion | |
| BRIN | huge time-ordered tables | |
| ⭐ `CREATE INDEX CONCURRENTLY` | no write lock | not in a transaction |
| Unused indexes | `pg_stat_user_indexes.idx_scan = 0` | drop them |
| Skip scan | PG 18 uses composites without leading filter | don't rely on it |

## EXPLAIN reading
| Node / field | Meaning |
|:--|:--|
| ⭐ `EXPLAIN (ANALYZE, BUFFERS)` | real execution stats |
| Seq Scan | full table read |
| Index Scan / Index Only Scan | index used / answered from index |
| Bitmap Heap Scan | many matches via index |
| Nested Loop / Hash / Merge Join | join strategies |
| ⭐ rows estimated vs actual | stats quality |
| Sort external merge | spills to disk |
| Buffers shared hit / read | cache vs disk |
| explain.dalibo.com | plan visualizer (also seen) |

## N+1
| Fix | How |
|:--|:--|
| ⭐ JOIN | one query |
| ⭐ Batch | `WHERE id = ANY($1)` + map |
| Drizzle `with` | relational query |
| Mongoose `populate` | batched per path; still extra queries |
| DataLoader | GraphQL batching (also seen) |
| Detect | queries per request in traces |

## Transactions and locking
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Read committed | default; per-statement snapshot | |
| Repeatable read | transaction snapshot | retry `40001` |
| Serializable | full isolation | retry `40001` |
| ⭐ Atomic UPDATE with condition | check-and-act in one statement | stock, balances |
| ⭐ `FOR UPDATE` | row lock | |
| ⭐ `FOR UPDATE SKIP LOCKED` | queue workers | |
| `NOWAIT` | fail instead of waiting | |
| Advisory locks | `pg_advisory_xact_lock(key)` | app-level mutex |
| Deadlocks `40P01` | consistent lock order, retry | |
| ⭐ Short transactions, no network calls | | outbox for side effects |

## pg (node-postgres)
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `new Pool({ max, connectionTimeoutMillis, idleTimeoutMillis })` | pool | set connection timeout |
| ⭐ `pool.query(text, values)` | parameterized query | `$1, $2` |
| ⭐ `pool.connect()` + BEGIN/COMMIT/ROLLBACK + `release()` | transactions | release in `finally` |
| `pool.on('error')` | idle client errors | required |
| `options: '-c statement_timeout=5000'` | server settings per connection | |
| `application_name` | identify service | |
| `ssl: { rejectUnauthorized: true, ca }` | TLS to RDS | |
| ⭐ int8 as string | default | parse deliberately |
| ⭐ `date` → JS Date | time-zone shift | `setTypeParser(1082, v => v)` |
| `pg-query-stream` / `pg-cursor` | streaming results | |
| `pool.end()` | shutdown | |

## Connections in production
| Item | Practice |
|:--|:--|
| ⭐ Small pools | 5–20 per instance |
| ⭐ Budget | instances × max + headroom < `max_connections` |
| RDS Proxy / PgBouncer | many instances, serverless |
| Transaction pooling limits | no session state, careful with prepared statements |
| Read replicas | lag-tolerant reads |
| Failover | reconnect, retry idempotent work |

## Safety settings
| Setting | Effect |
|:--|:--|
| ⭐ `statement_timeout` | kill long queries |
| ⭐ `idle_in_transaction_session_timeout` | kill abandoned transactions |
| ⭐ `lock_timeout` | don't queue forever on locks |
| `ALTER ROLE app SET …` | per-role defaults |
| Least-privilege roles | app can't run DDL |

## Drizzle ORM
| API | What it does |
|:--|:--|
| ⭐ `pgTable('t', {...}, (t) => [index(...)])` | schema |
| `` uuid().primaryKey().default(sql`uuidv7()`) `` | UUIDv7 PK |
| `timestamp({ withTimezone: true }).defaultNow()` | timestamptz |
| `text({ enum: [...] })` | typed text values |
| `jsonb().$type<T>()` | typed JSON |
| `references(() => t.id, { onDelete })` | FK |
| ⭐ `drizzle({ client: pool, schema, casing: 'snake_case' })` | db instance |
| ⭐ `db.select().from(t).where(and(eq(...)))` | queries |
| `.orderBy(desc(...)).limit(n)` | sorting/paging |
| `db.insert(t).values(v).returning()` | insert |
| `.onConflictDoUpdate({ target, set })` | upsert |
| `db.update(t).set(v).where(...)` | update |
| ⭐ `db.transaction(async (tx) => …)` | transactions |
| `relations()` + `db.query.t.findMany({ with })` | relational queries (stable API) |
| `defineRelations` | 1.0 RC relational API |
| ⭐ `` sql`… ${value}` `` | parameterized raw SQL |
| `sql.raw()` | unparameterized: never with input |
| `$inferSelect` / `$inferInsert` | row types |

## drizzle-kit
| Command | Use |
|:--|:--|
| ⭐ `drizzle-kit generate --name x` | create migration SQL |
| ⭐ `drizzle-kit migrate` | apply migrations |
| `drizzle-kit push` | local prototyping only |
| `drizzle-kit check` | consistency |
| `drizzle-kit pull` | introspect existing DB |
| `drizzle-kit studio` | data browser |
| `strict: true` | confirm destructive changes |

## Zero-downtime migrations
| Change | Pattern |
|:--|:--|
| ⭐ Add column | nullable/constant default → code → backfill → constraints |
| ⭐ NOT NULL | `CHECK … NOT VALID` → `VALIDATE` → `SET NOT NULL` |
| ⭐ Rename | add, dual write, backfill, switch reads, drop (multi-deploy) |
| Drop | remove code usage first, drop later |
| Index | `CONCURRENTLY` |
| Type change | new column + backfill |
| ⭐ `SET lock_timeout` | fail fast on locks |
| Backfills | batched jobs, not migrations |
| ⭐ Migrate before deploy | backward-compatible schema first |

## Operations
| Tool | Use |
|:--|:--|
| ⭐ `pg_stat_statements` | top queries |
| ⭐ `pg_stat_activity` | running/idle-in-transaction sessions |
| `pg_locks` | lock waits |
| `pg_cancel_backend` / `pg_terminate_backend` | stop query / connection |
| autovacuum tuning | hot tables |
| `ANALYZE` | refresh statistics |
| `auto_explain` | log slow plans |
| VACUUM FULL / pg_repack / REPACK (PG 19) | remove bloat |
| RDS Database Insights | managed monitoring |

## MongoDB modeling
| Pattern | Use |
|:--|:--|
| ⭐ Embed | bounded, read together, owned |
| ⭐ Reference | unbounded, shared, independent |
| Subset | latest N embedded, rest referenced |
| Extended reference | copy stable fields |
| Computed | precomputed totals |
| Bucket | time series per period |
| Schema versioning | `schemaVersion` field |
| ⭐ 16 MB limit | no unbounded arrays |

## MongoDB indexes and ops
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Compound + ESR | Equality, Sort, Range order | |
| Multikey | array fields | |
| Unique / partial | constraints | |
| TTL | expire documents | sessions, tokens |
| ⭐ `explain('executionStats')` | IXSCAN vs COLLSCAN | docsExamined ≈ returned |
| Transactions | replica set required | keep short |
| `writeConcern: majority` | durable writes | |
| Atlas Search | full-text | |

## Mongoose 9
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `new Schema({...}, { timestamps: true })` | schema | |
| Validators | required, min, enum, custom | `runValidators` on updates |
| ⭐ Async middleware only | no `next()` | v9 change |
| ⭐ `.lean()` | plain objects | faster reads |
| `.select()` | projections | |
| `populate()` | load references | extra queries |
| `schema.index({...})` | indexes | `autoIndex: false` in prod |
| `syncIndexes()` | build indexes deliberately | migration step |
| ⭐ `sanitizeFilter: true` | neutralize `$` operators | plus Zod |
| `connection.transaction(fn)` | transactions | |
| `updatePipeline` | disabled by default | v9 |
| `InferSchemaType` | TS types from schema | |

## Choosing
| Need | Pick |
|:--|:--|
| ⭐ Relational, constraints, transactions, reporting | PostgreSQL |
| Flexible attributes on relational data | `jsonb` |
| Document-shaped, read-whole data, MERN | MongoDB |
| Money/inventory consistency | PostgreSQL |
| One flow across two DBs | avoid; needs outbox/sync |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Check-then-act | race conditions | atomic SQL / locks |
| Transactions via `pool.query` | different connections | one client |
| Unreleased clients | pool exhaustion | `finally` release |
| No connection timeout | hangs forever | `connectionTimeoutMillis` |
| Wrong index column order | seq scans | tenant + equality first |
| Index without CONCURRENTLY | write lock | CONCURRENTLY |
| `drizzle-kit push` in prod | data loss on renames | generate + migrate |
| One-step renames | broken old instances | expand/contract |
| `date` parsed as Date | off-by-one days | keep string |
| Unbounded Mongo arrays | 16 MB limit | references |
| Raw request filters in Mongo | operator injection | Zod + sanitizeFilter |
| `autoIndex` in prod | load spikes | controlled builds |
| Idle in transaction | bloat, locks | timeouts |

## Sources
| Source | Link |
|:--|:--|
| PostgreSQL docs | https://www.postgresql.org/docs/current/ |
| PostgreSQL 18 release notes | https://www.postgresql.org/docs/18/release-18.html |
| Use The Index, Luke | https://use-the-index-luke.com/ |
| node-postgres | https://node-postgres.com/ |
| Drizzle ORM | https://orm.drizzle.team/docs/overview |
| MongoDB data modeling | https://www.mongodb.com/docs/manual/data-modeling/ |
| Mongoose docs | https://mongoosejs.com/docs/ |
| Strong Migrations | https://github.com/ankane/strong_migrations |
