---
title: "Scaling PostgreSQL: pooling, replicas, partitioning, sharding"
tech: PostgreSQL 18, Drizzle ORM, AWS RDS
version: PostgreSQL 18, Drizzle ORM 0.45, node-postgres 8, AWS RDS
date: 2026-11-07
covers: [4, 7]
---
# Scaling PostgreSQL: pooling, replicas, partitioning, sharding
[← Overview](00-overview.md)

## Why it matters
- Autoscaling adds tasks during a sale. 30 tasks × a pool of 20 = 600 connections, but the database allows a few hundred. New connections fail, and the API errors exactly at peak traffic.
- The `events` table reaches 2 billion rows. The nightly `DELETE` of old rows runs for hours, bloats the table, and autovacuum can't keep up.
- Product pages read from a replica. A user renames their shop and the page still shows the old name: replication lag broke read-your-writes.

## Concepts

### The scaling ladder (cheapest first)
| Step | Typical gain | Cost |
|:--|:--|:--|
| 1. Fix queries and indexes | often 10–100× for the worst queries | engineering time |
| 2. Cache hot reads | large for read-heavy apps | invalidation ([06-caching](../../06-caching/README.md)) |
| 3. Pool connections well | stability under load | configuration |
| 4. Bigger instance | ~2× per size step | money; a short failover on Multi-AZ |
| 5. Read replicas | more read throughput | replication lag |
| 6. Partition big tables | cheap retention, pruning, faster maintenance | schema complexity |
| 7. Move workloads out | analytics to a warehouse, search to a search engine | more systems to run |
| 8. Shard | write scaling | high complexity: last resort |

### Query tuning at scale
| Tool | Use |
|:--|:--|
| `pg_stat_statements` | top queries by total time, calls, mean time |
| `EXPLAIN (ANALYZE, BUFFERS)` | real plan, row counts, I/O ([03-databases lesson 02](../../03-databases/docs/02-indexes-performance-operations.md)) |
| RDS Performance Insights / CloudWatch Database Insights | database load by query and wait event |
| `auto_explain`, `log_min_duration_statement` | log slow queries and their plans |
| `pg_stat_user_indexes` | unused indexes (cost on every write) |
| Query count per request | catch N+1 in tests and traces |

Optimize by **total time** (calls × mean), not by the single slowest query: a 2 ms query called 50,000 times a minute usually matters more than one 3-second report.

### Connection budget
Each Postgres connection is a separate server process with its own memory. Thousands of connections hurt even when idle.

`API tasks × pool max + workers × pool max + admin/migrations ≤ max_connections − reserve`

| Option | How | Watch out |
|:--|:--|:--|
| Smaller app pools | `max` 5–10 per task; requests wait briefly for a connection | set `connectionTimeoutMillis` |
| Short transactions | release connections fast | never call external APIs inside a transaction |
| RDS Proxy | managed pooler; faster failover; IAM auth | "pinning" when sessions change state; extra cost |
| PgBouncer, transaction mode | self-hosted pooler (also seen) | no session state: `SET`, session advisory locks, `LISTEN`; prepared statements need `max_prepared_statements` |

### Read replicas
| Aspect | Detail |
|:--|:--|
| Good for | reads that tolerate a little staleness: lists, search, reports |
| Lag | usually milliseconds to seconds, spikes under heavy writes |
| Read-your-writes | read a user's own just-changed data from the primary |
| Routing | Drizzle `withReplicas(primary, [replica])`; `db.$primary` forces the primary |
| Monitoring | RDS `ReplicaLag` metric with an alert |
| Not the same as | Multi-AZ standby (not readable); Multi-AZ DB clusters do have readable standbys |

### Partitioning
| Type | Key | Fits |
|:--|:--|:--|
| RANGE | time (`created_at`) | events, logs, orders by month |
| LIST | region, category, plan | known sets of values |
| HASH | id, tenant id | spreading rows evenly |

Benefits: **partition pruning** (queries that filter on the key touch fewer partitions), **instant retention** (detach and drop a partition instead of `DELETE`), smaller per-partition indexes, vacuum per partition.

Rules: primary keys and unique constraints must include the partition key; create future partitions ahead of time; queries must filter on the key to prune; thousands of partitions slow down planning. Rule of thumb from the Postgres docs: partition when the table is bigger than the database server's memory.

### Sharding
| Aspect | Detail |
|:--|:--|
| Shard key | usually the tenant/account: all of a tenant's data on one shard |
| Routing | lookup table (tenant → shard) or hashing |
| Cross-shard queries | avoid in the app; aggregate in a warehouse |
| Rebalancing | moving tenants between shards is a project |
| Managed options | Citus, Aurora Limitless Database (also seen) |
| When | one primary can't handle the writes or the data size after every step above |

Most products never need sharding. Bigger instances and the steps above go a very long way.

## Example
Top queries by total time:
```sql
SELECT left(query, 80)              AS query,
       calls,
       round(total_exec_time)       AS total_ms,
       round(mean_exec_time, 1)     AS mean_ms,
       rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```
A connection budget written down (instance with `max_connections` = 400):
| Component | Instances (max) | Pool `max` | Connections |
|:--|:--|:--|:--|
| API tasks | 20 | 8 | 160 |
| BullMQ workers | 6 | 5 | 30 |
| Migrations, admin, monitoring | — | — | 10 |
| **Total** | | | **200** (50% headroom) |

`src/db.ts` — primary and replica with Drizzle.
```ts
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { withReplicas } from 'drizzle-orm/pg-core';
import * as schema from './db/schema.ts';
import { config } from './config.ts';

const primaryPool = new Pool({ connectionString: config.db.url, max: 8, connectionTimeoutMillis: 3_000, statement_timeout: 5_000 });
const replicaPool = new Pool({ connectionString: config.db.replicaUrl, max: 8, connectionTimeoutMillis: 3_000, statement_timeout: 15_000 });

const primary = drizzle({ client: primaryPool, schema, casing: 'snake_case' });
const replica = drizzle({ client: replicaPool, schema, casing: 'snake_case' });

// selects go to the replica, writes to the primary; db.$primary forces the primary
export const db = withReplicas(primary, [replica]);
```
Choosing per query:
```ts
// The shop the user just renamed: read from the primary (read-your-writes)
const shop = await db.$primary.query.shops.findFirst({ where: (s, { eq }) => eq(s.ownerId, req.user!.id) });

// Public product search tolerates a second of lag: the replica
const results = await db.select().from(products).where(eq(products.categoryId, categoryId)).limit(20);
```
A partitioned `events` table (a custom SQL migration: `drizzle-kit generate --custom`).
```sql
CREATE TABLE events (
  id         uuid        NOT NULL DEFAULT uuidv7(),
  account_id uuid        NOT NULL,
  type       text        NOT NULL,
  payload    jsonb       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)                      -- must include the partition key
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_11 PARTITION OF events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE events_2026_12 PARTITION OF events FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE INDEX ON events (account_id, created_at);    -- created on every partition

-- Retention: instant, no bloat (CONCURRENTLY can't run inside a transaction block)
ALTER TABLE events DETACH PARTITION events_2025_11 CONCURRENTLY;
DROP TABLE events_2025_11;
```
A monthly BullMQ job creates partitions three months ahead (`CREATE TABLE IF NOT EXISTS … PARTITION OF events …`), so inserts never fail for a missing partition.

## Production patterns
- **Work the ladder in order**: queries and indexes, caching, pooling, bigger instance, replicas, partitioning; sharding only with evidence.
- **A written connection budget** that autoscaling limits respect; RDS Proxy or PgBouncer when tasks multiply.
- **Replicas for stale-tolerant reads**, primary for read-your-writes, alerts on replica lag.
- **Time-partitioned tables** for high-volume, append-mostly data with retention; partitions created ahead by a job.
- **Review `pg_stat_statements` regularly** (weekly, and after big releases).

## Mistakes
Wrong: pool size times autoscaling maximum is never calculated.
```ts
new Pool({ max: 20 }); // × 50 tasks at peak = 1,000 connections
```
Right: budget connections; smaller pools, a pooler, or a lower task maximum.

Wrong: reading a user's own fresh write from a replica. They see old data and edit again. Right: `db.$primary` for read-after-write paths.

Wrong: partitioning a 5 GB table, or querying a partitioned table without the partition key. All the complexity, none of the pruning. Right: partition big, time-based tables and always filter on the key.

Wrong: sharding first. Every query, migration, and report gets harder for years. Right: exhaust the cheaper steps first.

## Check yourself
1. How do you compute whether autoscaling can exhaust database connections?
2. What is read-your-writes, and how do you keep it with replicas?
3. Why is dropping a partition better than `DELETE` for retention?

<details>
<summary>Answers</summary>

1. Multiply the maximum number of tasks by each pool's `max`, add workers and admin connections, and compare with `max_connections` minus a reserve. If it doesn't fit, shrink pools, add a pooler (RDS Proxy, PgBouncer), or cap autoscaling.
2. A user should see their own changes right after making them. Replicas lag, so read data the user just changed from the primary (`db.$primary`), at least for a short time after the write; other reads can use replicas.
3. Dropping a partition is a quick metadata operation: no row-by-row deletes, no dead tuples, no bloat, no long vacuum. `DELETE` of millions of rows is slow, generates WAL, and leaves bloat behind.
</details>

## Sources
- [PostgreSQL — Table partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [PostgreSQL — `pg_stat_statements`](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [Amazon RDS — Read replicas](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html)
- [Amazon RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)
- [Drizzle — Read replicas](https://orm.drizzle.team/docs/read-replicas)
- [PgBouncer — Features](https://www.pgbouncer.org/features.html)
