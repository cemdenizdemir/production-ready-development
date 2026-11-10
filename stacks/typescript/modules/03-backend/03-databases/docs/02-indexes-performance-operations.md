---
title: Indexes, query plans, N+1, and operations
tech: PostgreSQL 18, pg, Drizzle ORM
version: PostgreSQL 18
date: 2026-11-07
covers: [3, 9, 13]
---
# Indexes, query plans, N+1, and operations
[← Overview](00-overview.md)

## Why it matters
- The orders list scans 8 million rows on every request because the index is on `(created_at)` but queries filter by `account_id` first.
- A page renders 50 orders and fires 51 queries (one per customer). Locally it's 20 ms; in production with 2 ms network latency per query it's 300 ms.
- An "idle in transaction" connection left open by a bug blocks autovacuum for days; tables bloat to 10× their size and queries crawl.

## Concepts

### Index types
| Type | Good for | Example |
|:--|:--|:--|
| B-tree (default) | equality, ranges, sorting | `CREATE INDEX ON orders (account_id, created_at DESC)` |
| Composite | multi-column filters; **leftmost columns first** | `(account_id, status, created_at)` |
| Partial | a subset of rows | `… WHERE deleted_at IS NULL`, `… WHERE status = 'pending'` |
| Expression | queries on computed values | `ON customers (lower(email))` |
| Covering (`INCLUDE`) | index-only scans | `ON orders (account_id, created_at) INCLUDE (total_cents)` |
| GIN | `jsonb`, arrays, full-text, trigram search | `USING gin (attributes jsonb_path_ops)` |
| GiST | ranges, geometry, exclusion constraints | bookings without overlap |
| BRIN | huge append-only tables ordered by time | event logs |

Composite index order: equality columns first, then the sort/range column. PG 18's skip scan can use a composite index even when the first column isn't filtered, but don't design around it.

Every index slows writes and costs storage. Find unused ones with `pg_stat_user_indexes` (`idx_scan = 0`). In production, create indexes with `CREATE INDEX CONCURRENTLY` (no write lock; can't run inside a transaction).

### Reading `EXPLAIN (ANALYZE, BUFFERS)`
| Node | Means |
|:--|:--|
| Seq Scan | reads the whole table: fine for small tables, bad for big filtered ones |
| Index Scan | walks the index, fetches matching rows |
| Index Only Scan | answers from the index alone (covering index, visibility map) |
| Bitmap Heap Scan | collects matches from index(es), then reads pages |
| Nested Loop / Hash Join / Merge Join | join strategies; nested loops over many rows are a warning sign |
| Sort (external merge) | sort spilled to disk: needs an index or more `work_mem` |

Compare **estimated rows vs actual rows**: big differences mean stale statistics (`ANALYZE table`) or correlated columns. Look at **actual time** and **loops**, and at `Buffers: shared read` (disk) vs `hit` (cache).

### The N+1 problem
| Cause | Fix |
|:--|:--|
| a query per item in a loop | one query with `JOIN` |
| loading related records lazily | batch: `WHERE id = ANY($1)` with all IDs |
| ORM relations without eager loading | Drizzle relational query `with: { customer: true }` |
| GraphQL resolvers | batching (also seen: DataLoader) |
Detect it: count queries per request (trace spans, query logs in development).

### Operations basics
| Concept | What to know |
|:--|:--|
| MVCC | updates/deletes leave dead row versions until vacuumed |
| autovacuum | cleans dead tuples and updates statistics; tune per hot table |
| Bloat | tables/indexes larger than needed after heavy churn |
| Long transactions | prevent vacuum cleanup; set `idle_in_transaction_session_timeout` |
| Transaction ID wraparound | autovacuum's emergency mode if vacuum falls far behind |
| `pg_stat_statements` | top queries by total time, calls, mean time: start every investigation here |
| `pg_stat_activity` | running queries, waits, idle-in-transaction sessions |
| `pg_cancel_backend(pid)` / `pg_terminate_backend(pid)` | stop a runaway query / connection |
| `auto_explain` | log plans of slow queries automatically |
| PG 19 `REPACK` | online table rewrite to remove bloat (coming) |

## Example
Diagnose and fix a slow list query:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, total_cents, created_at FROM orders
WHERE account_id = '0193…' AND status = 'paid'
ORDER BY created_at DESC LIMIT 20;
-- Seq Scan on orders (actual rows=20 loops=1) … Rows Removed by Filter: 7999980
-- Execution Time: 1840 ms

CREATE INDEX CONCURRENTLY orders_account_status_created_idx
  ON orders (account_id, status, created_at DESC) INCLUDE (total_cents);

-- Index Only Scan using orders_account_status_created_idx … Execution Time: 0.4 ms
```
Top queries by total time:
```sql
SELECT round(total_exec_time) AS total_ms, calls, round(mean_exec_time, 2) AS mean_ms, left(query, 80) AS query
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```
Find long-running and idle-in-transaction sessions:
```sql
SELECT pid, state, now() - xact_start AS xact_age, left(query, 60) AS query
FROM pg_stat_activity
WHERE state <> 'idle' AND xact_start < now() - interval '1 minute'
ORDER BY xact_age DESC;
```
N+1 and its fix with `pg`:
```ts
// Wrong: 1 + N queries
const { rows: orders } = await pool.query('SELECT * FROM orders WHERE account_id = $1 LIMIT 50', [accountId]);
for (const o of orders) {
  o.customer = (await pool.query('SELECT name FROM customers WHERE id = $1', [o.customer_id])).rows[0];
}

// Right: 2 queries total (or one JOIN)
const ids = [...new Set(orders.map((o) => o.customer_id))];
const { rows: customers } = await pool.query('SELECT id, name FROM customers WHERE id = ANY($1::uuid[])', [ids]);
const byId = new Map(customers.map((c) => [c.id, c]));
const result = orders.map((o) => ({ ...o, customer: byId.get(o.customer_id) }));
```
Database-level safety settings (set per role or in the connection string):
```sql
ALTER ROLE app SET statement_timeout = '5s';
ALTER ROLE app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE app SET lock_timeout = '3s';
```

## Production patterns
- **Design indexes from real queries**: tenant column first, then equality filters, then sort/range; verify with `EXPLAIN ANALYZE` on production-like data.
- **`pg_stat_statements` enabled everywhere**; review the top 10 queries regularly.
- **Query count per request is a metric** in traces; alert on N+1 regressions in tests or staging.
- **Timeouts at the role level** (`statement_timeout`, `idle_in_transaction_session_timeout`, `lock_timeout`).
- **`CREATE INDEX CONCURRENTLY`** for production indexes; drop unused indexes.

## Mistakes
Wrong: an index that doesn't match the filter order.
```sql
CREATE INDEX ON orders (created_at); -- queries filter by account_id first
```
Right: `(account_id, created_at DESC)`.

Wrong: `WHERE lower(email) = $1` with an index on `email` only. The index can't be used. Right: an expression index on `lower(email)` (or `citext`).

Wrong: testing query performance on a 100-row local table. Plans differ completely at scale. Right: production-like volumes (anonymized copies, generated data) in staging.

Wrong: `CREATE INDEX` (without `CONCURRENTLY`) on a busy production table. Writes block for the whole build. Right: `CONCURRENTLY`, outside a transaction.

## Check yourself
1. Why must `account_id` come before `created_at` in an index for tenant-scoped lists?
2. In a plan, estimated rows = 10, actual rows = 500,000. What do you suspect and do?
3. How do idle-in-transaction connections hurt the whole database?

<details>
<summary>Answers</summary>

1. A B-tree is sorted by its first column first. With `account_id` leading, all of one tenant's rows are adjacent and already ordered by `created_at`, so the query reads just the needed entries.
2. Stale or insufficient statistics (or correlated columns): run `ANALYZE`, consider extended statistics, then re-check the plan; bad estimates lead to wrong join strategies.
3. They hold a snapshot (blocking vacuum from removing dead rows everywhere, causing bloat) and may hold locks that block other queries; they also occupy pool connections.
</details>

## Sources
- [PostgreSQL — Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL — Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [Use The Index, Luke](https://use-the-index-luke.com/)
- [PostgreSQL — pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [PostgreSQL — Routine vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html)
