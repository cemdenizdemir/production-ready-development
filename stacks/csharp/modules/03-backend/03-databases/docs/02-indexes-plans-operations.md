---
title: Indexes, execution plans, and SQL Server operations
tech: SQL Server 2025, SSMS, Query Store, DMVs
version: SQL Server 2025, Azure SQL Database
date: 2026-11-09
covers: [3, 15]
---
# Indexes, execution plans, and SQL Server operations
[← Overview](00-overview.md)

## Why it matters
- "My orders" takes 4 s for big customers: the query scans 6 million rows because there's no index on `(CustomerId, PlacedAt)`.
- A query is fast in SSMS and slow from the app; the plan was compiled for a tiny customer and reused for a huge one (parameter sniffing).
- After a deploy, CPU on Azure SQL jumps from 20% to 95%. Query Store shows exactly which query regressed, but nobody knew it existed.

## Concepts

### Index types
| Index | What it is | Use |
|:--|:--|:--|
| ⭐ clustered | the table itself, ordered by the key (one per table) | narrow, ever-increasing key (`bigint` identity) |
| ⭐ nonclustered | separate B-tree: key columns + pointer to the row | lookups and ranges on other columns |
| ⭐ composite | several key columns, order matters | `(CustomerId, PlacedAt DESC)` |
| ⭐ covering (`INCLUDE`) | extra columns stored at the leaf | avoid key lookups for hot queries |
| filtered | index with `WHERE` | `WHERE Status = 'Placed'`, `WHERE IsDeleted = 0` |
| unique | enforces uniqueness | email, SKU |
| columnstore | column-oriented, compressed | analytics on large tables |
| JSON / vector indexes | SQL Server 2025 | JSON paths, vector search |

Composite key order: **equality columns first, then range/sort columns**. `WHERE CustomerId = @c ORDER BY PlacedAt DESC` → `(CustomerId, PlacedAt DESC)`.

SARGable predicates let SQL Server seek: `PlacedAt >= @from AND PlacedAt < @to` ✓, `YEAR(PlacedAt) = 2026` ✗, `LOWER(Email) = @e` ✗ (use collation), `Sku LIKE 'COF%'` ✓, `Sku LIKE '%ETH'` ✗.

Every index costs writes, storage, and memory. Index for the queries you actually run, and drop unused ones (`sys.dm_db_index_usage_stats`).

### Reading execution plans
Get the **actual** plan (SSMS: Ctrl+M; mssql extension: "Run with actual plan") plus `SET STATISTICS IO, TIME ON;`.
| Operator / sign | Means |
|:--|:--|
| Index Seek | ✓ navigates the B-tree to matching rows |
| Index/Clustered Index Scan | reads everything (fine for small tables or most rows) |
| Key Lookup | seek found rows, then fetched extra columns from the clustered index per row → consider `INCLUDE` |
| Nested Loops / Hash Match / Merge Join | join strategies; hash on big inputs, loops on small outer inputs |
| Sort, spill warnings | memory grant too small; add an index that provides order |
| estimated vs actual rows far apart | stale statistics or parameter sniffing |
| missing index hint | a suggestion, not a command |
| logical reads (STATISTICS IO) | the number to make small |

Parameter sniffing: the plan is compiled for the first parameter values. Fixes: better indexes, `OPTION (RECOMPILE)` for rare heavy queries, Query Store plan forcing, SQL Server 2022+ parameter-sensitive plan optimization (automatic in compat level 160+).

### Operations basics
| Tool | Use |
|:--|:--|
| ⭐ Query Store | history of queries, plans, runtime stats; "Top resource consuming", "Regressed queries", force a good plan; on by default in Azure SQL and new databases since SQL Server 2022 |
| statistics | auto-created and auto-updated; `UPDATE STATISTICS dbo.Orders` after big loads |
| index maintenance | fragmentation matters less on SSDs; rebuild/reorganize on a schedule for heavily modified indexes; Azure SQL automatic tuning can create/drop indexes and force plans |
| DMVs | `sys.dm_exec_requests` (running now), `sys.dm_exec_query_stats` (cached plan stats), `sys.dm_db_index_usage_stats`, `sys.dm_db_missing_index_details`, `sys.dm_os_wait_stats` |
| waits | what queries wait on: `PAGEIOLATCH` (I/O), `LCK_*` (locks), `CXPACKET` (parallelism), `SOS_SCHEDULER_YIELD` (CPU) |
| Extended Events | deadlocks (`system_health`), slow queries |
| Azure SQL Intelligent Insights / Database Watcher | managed monitoring |

## Example
`db/indexes.sql`
```sql
-- "my orders", newest first, with summary columns: seek + no key lookups
CREATE INDEX IX_Orders_Customer_PlacedAt
    ON dbo.Orders (CustomerId, PlacedAt DESC)
    INCLUDE (Status, Total, Currency);

-- the fulfilment screen only looks at open orders
CREATE INDEX IX_Orders_Open
    ON dbo.Orders (PlacedAt)
    INCLUDE (CustomerId, Total)
    WHERE Status IN ('Placed', 'Paid');

-- unique natural key
CREATE UNIQUE INDEX UX_Products_Sku ON dbo.Products (Sku);
```
Measure before and after:
```sql
SET STATISTICS IO, TIME ON;
DECLARE @c bigint = 42;
SELECT TOP (20) Id, PlacedAt, Status, Total, Currency
FROM dbo.Orders
WHERE CustomerId = @c
ORDER BY PlacedAt DESC;
-- before: Clustered Index Scan, logical reads 51,233
-- after:  Index Seek on IX_Orders_Customer_PlacedAt, logical reads 4
```
Find the heaviest queries (Query Store):
```sql
SELECT TOP (10) qt.query_sql_text, rs.avg_duration / 1000.0 AS avg_ms, rs.count_executions, rs.avg_logical_io_reads
FROM sys.query_store_runtime_stats AS rs
JOIN sys.query_store_plan AS p ON p.plan_id = rs.plan_id
JOIN sys.query_store_query AS q ON q.query_id = p.query_id
JOIN sys.query_store_query_text AS qt ON qt.query_text_id = q.query_text_id
ORDER BY rs.avg_duration * rs.count_executions DESC;
```
EF Core: declare indexes in the model so migrations create them (`builder.HasIndex(o => new { o.CustomerId, o.PlacedAt }).IsDescending(false, true).IncludeProperties(o => new { o.Status, o.Total, o.Currency });`, lesson 04).

## Production patterns
- Start from the queries: for each hot endpoint, know its SQL, its plan, and its index.
- Composite indexes ordered equality → range/sort; `INCLUDE` to cover the hottest queries.
- Query Store on, reviewed after every deploy and in incident runbooks.
- Measure with logical reads and actual plans, not only wall-clock time on a warm laptop.

## Mistakes
Wrong: one index per column "just in case".
Right: composite indexes that match real `WHERE` + `ORDER BY` patterns; drop unused ones.

Wrong: functions on indexed columns.
```sql
WHERE CONVERT(date, PlacedAt) = '2026-11-09'
```
Right:
```sql
WHERE PlacedAt >= '2026-11-09' AND PlacedAt < '2026-11-10'
```

## Check yourself
1. Why put `CustomerId` before `PlacedAt` in the composite index?
2. What does a Key Lookup in a plan tell you?
3. Where do you look first when a query suddenly got slower after a deploy?

<details><summary>Answers</summary>

1. The query filters by equality on `CustomerId` and sorts/ranges on `PlacedAt`; equality columns first let SQL Server seek to one customer and read rows already in date order.
2. The index found the rows but lacked columns the query needs, so SQL Server fetched them from the clustered index row by row; an `INCLUDE` can remove it.
3. Query Store's regressed queries / top resource consumers, comparing plans before and after.
</details>

## Sources
- [SQL Server index architecture and design guide](https://learn.microsoft.com/sql/relational-databases/sql-server-index-design-guide)
- [Display an actual execution plan](https://learn.microsoft.com/sql/relational-databases/performance/display-an-actual-execution-plan)
- [Monitor performance by using the Query Store](https://learn.microsoft.com/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store)
- [Parameter Sensitive Plan optimization](https://learn.microsoft.com/sql/relational-databases/performance/parameter-sensitive-plan-optimization)
- [Automatic tuning in Azure SQL](https://learn.microsoft.com/azure/azure-sql/database/automatic-tuning-overview)
