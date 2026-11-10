---
title: Scaling the database and offloading reads
tech: Azure SQL, SQL Server 2025, EF Core 10, Azure Front Door, HybridCache
version: SQL Server 2025, EF Core 10, Microsoft.Data.SqlClient 6.x
date: 2026-11-09
covers: [6, 7, 9]
---
# Scaling the database and offloading reads
[← Overview](00-overview.md)

## Why it matters
- The API scaled to 10 replicas during a sale. Each opened up to 100 connections. The database hit its worker limit and every query failed with "the request limit has been reached".
- The finance team's monthly report ran on the primary at 10:00 and locked out checkout for 4 minutes.
- The home page ran 14 queries per visit. A CDN rule and one precomputed "bestsellers" table cut database reads by 90%.

## Concepts

### Query tuning at scale
| Step | Tool |
|:--|:--|
| ⭐ find the expensive queries | Query Store (`sys.query_store_*`), Azure SQL Query Performance Insight, App Insights dependency durations |
| read the plan | actual execution plan; `SET STATISTICS IO, TIME ON` |
| index | missing-index DMVs (treat as hints), covering indexes with `INCLUDE`, filtered indexes |
| fix the query shape | projections (`Select`), no N+1, keyset pagination, `AsSplitQuery` for big includes |
| parameter sniffing | `OPTION (RECOMPILE)` or Query Store plan forcing for skewed data; SQL Server 2022+ has PSP optimization |
| automatic tuning | Azure SQL can create/drop indexes and force last good plan |

### Connection budgets and pooling
| Item | Note |
|:--|:--|
| ⭐ pool per process per connection string | SqlClient default `Max Pool Size=100`, `Min Pool Size=0` |
| ⭐ budget | `maxReplicas × Max Pool Size` (plus workers) must stay under the database's max sessions/workers for its tier |
| pool exhaustion symptom | `InvalidOperationException: Timeout expired... max pool size was reached` |
| causes | slow queries holding connections, sync-over-async, leaked connections, too many replicas |
| `AddDbContextPool<T>()` | reuses DbContext objects (less allocation); different from connection pooling |
| separate pools | `Application Name=Shop.Reports` gives reports their own pool and shows up in monitoring |

### Read replicas
| Option | How |
|:--|:--|
| ⭐ built-in read scale-out | Business Critical and Premium tiers: `ApplicationIntent=ReadOnly` in the connection string routes to a readable secondary |
| Hyperscale replicas | high-availability and named replicas for read-heavy work |
| geo-replicas / failover groups | readable secondaries in another region; read-only listener endpoint |
| ⭐ replication lag | replicas are slightly behind: read-your-own-writes must use the primary |

Route by use case: a second DbContext (or connection string) for reports, search, and exports; the primary for anything a user just changed.

### Offloading reads
| Technique | Example |
|:--|:--|
| ⭐ CDN | Front Door caches `GET /products` (public, `Cache-Control: public, max-age=60`) and images |
| ⭐ application cache | HybridCache for catalog, prices, categories (06-caching) |
| output cache | whole anonymous responses |
| precomputation | a nightly or event-driven job writes `Bestsellers` and `CategoryCounts` tables |
| indexed views | SQL Server materialises an aggregate; good for counts, adds write cost |
| search engine | Azure AI Search for full-text and facets instead of `LIKE '%x%'` |
| static generation | Next.js caches pages (02-frontend) |

### Partitioning and sharding
| Approach | What | When |
|:--|:--|:--|
| ⭐ table partitioning | one table split by a partition function (by month) | very large tables (100M+ rows): fast archiving with `SWITCH`/`TRUNCATE ... WITH (PARTITIONS)`, partition elimination |
| archiving | move old orders to an archive table or storage | data grows forever, queries touch recent rows |
| vertical split | move a module's tables to its own database | a module with very different load |
| sharding | many databases, each with a subset of tenants/customers | last resort: cross-shard queries, rebalancing, and transactions get hard |
| Hyperscale | up to 128 TB in one database | before sharding, scale up |

Order of operations: tune queries → cache → read replicas → scale up the tier → partition/archive → split by module → shard.

## Example
`src/Shop.Infrastructure/Data/ReadDb.cs`
```csharp
using Microsoft.EntityFrameworkCore;

public sealed class ShopReadDb(DbContextOptions<ShopReadDb> options) : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();     // same mappings as ShopDb (shared configuration classes)
}
```
`src/Shop.Api/Program.cs`
```csharp
builder.Services.AddDbContextPool<ShopDb>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Shop"),
    sql => sql.EnableRetryOnFailure()));
builder.Services.AddDbContextPool<ShopReadDb>(o => o
    .UseSqlServer(builder.Configuration.GetConnectionString("ShopRead"))
    .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));   // read-only: no change tracking
```
`appsettings.Production.json` (no secrets: managed identity)
```json
"ConnectionStrings": {
  "Shop":     "Server=tcp:sql-shop.database.windows.net;Database=shop;Authentication=Active Directory Default;Max Pool Size=60;Application Name=Shop.Api",
  "ShopRead": "Server=tcp:sql-shop.database.windows.net;Database=shop;Authentication=Active Directory Default;ApplicationIntent=ReadOnly;Max Pool Size=20;Application Name=Shop.Reports"
}
```
Budget check: 12 replicas × (60 + 20) = 960 possible connections. Compare with the tier's limit, and lower the pool sizes or `maxReplicas` if needed.

Monthly partitioning for an append-only table:
```sql
CREATE PARTITION FUNCTION pf_OrderMonth (datetime2) AS RANGE RIGHT FOR VALUES ('2026-01-01', '2026-02-01', '2026-03-01');
CREATE PARTITION SCHEME ps_OrderMonth AS PARTITION pf_OrderMonth ALL TO ([PRIMARY]);
CREATE TABLE dbo.OrderEvents (Id bigint IDENTITY, OccurredAt datetime2 NOT NULL, Payload json NOT NULL,
  CONSTRAINT PK_OrderEvents PRIMARY KEY (OccurredAt, Id)) ON ps_OrderMonth (OccurredAt);
-- monthly job: SPLIT the next boundary; TRUNCATE TABLE dbo.OrderEvents WITH (PARTITIONS (1)) for the oldest
```

## Production patterns
- Query Store on; a weekly look at top queries by total CPU and duration; indexes reviewed in PRs with plans attached.
- A written connection budget: replicas × pool sizes for API, workers, and jobs, checked when `maxReplicas` changes.
- Reports, exports, and search on a read replica or a separate store; read-your-writes paths on the primary.
- Public reads served from the CDN and caches first; precomputed tables for expensive aggregates.
- Partitioning only for huge, time-based tables; sharding only after everything else.

## Mistakes
Wrong: adding replicas to fix slow SQL.
Right: fix the query (plan, index, shape). More replicas only add connections to a struggling database.

Wrong: reading from the replica right after a write ("order not found" after checkout).
Right: the primary for read-your-own-writes; the replica for lag-tolerant reads.

## Check yourself
1. How do you compute a connection budget?
2. What is the main risk of read replicas?
3. Why is sharding the last step?

<details><summary>Answers</summary>

1. Maximum replicas of every process (API, workers, jobs) × each process's pool size per connection string, summed, compared with the database tier's session and worker limits.
2. Replication lag: data read from a replica may be slightly stale, so a user may not see their own recent changes.
3. It makes queries across shards, transactions, reporting, schema changes, and rebalancing much harder. Tuning, caching, replicas, scaling up, and partitioning are far cheaper.
</details>

## Sources
- [Monitor performance with Query Store](https://learn.microsoft.com/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store)
- [SQL Server connection pooling](https://learn.microsoft.com/sql/connect/ado-net/sql-server-connection-pooling)
- [Read scale-out in Azure SQL](https://learn.microsoft.com/azure/azure-sql/database/read-scale-out)
- [Resource limits for Azure SQL Database](https://learn.microsoft.com/azure/azure-sql/database/resource-limits-vcore-single-databases)
- [Partitioned tables and indexes](https://learn.microsoft.com/sql/relational-databases/partitions/partitioned-tables-and-indexes)
- [Azure Front Door caching](https://learn.microsoft.com/azure/frontdoor/front-door-caching)
