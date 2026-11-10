---
title: Safe migrations in production
tech: EF Core 10 migrations, SQL Server 2025 / Azure SQL
version: EF Core 10, SQL Server 2025, Azure SQL Database
date: 2026-11-09
covers: [4]
---
# Safe migrations in production
[← Overview](00-overview.md)

## Why it matters
- A migration added an index on `OrderLines` (80 million rows) without `ONLINE = ON`. The table was locked for 11 minutes and checkout stopped.
- `UPDATE Products SET Slug = LOWER(Name)` ran as one statement on 2 million rows. The transaction log filled, the update rolled back for another 20 minutes, and every write in the database waited.
- A migration waited for a lock held by a long report query. Every new query queued behind the migration, and the whole database froze: a lock queue pile-up.

## Concepts

### What's safe, what's dangerous (SQL Server / Azure SQL)
| Change | Risk | Safe approach |
|:--|:--|:--|
| add nullable column | metadata only | fine |
| ⭐ add NOT NULL column with a constant default | metadata only (online) in Azure SQL and SQL Server Enterprise | fine; avoid non-constant defaults (`NEWID()`) |
| ⭐ create index | offline build locks the table | `WITH (ONLINE = ON, RESUMABLE = ON)`; EF Core `.IsCreatedOnline()` |
| change column type / length | size-of-data rewrite, long locks | new column + backfill + switch (expand/contract) |
| rename column / table | breaks running code | expand/contract (04-deployments) |
| drop column | breaks old code; can't roll back | only after no code reads it (contract step) |
| ⭐ add foreign key / CHECK | scans the table to validate | `WITH NOCHECK`, then validate later in a quiet window |
| ⭐ large `UPDATE` / `DELETE` | log growth, long locks, blocking | batches of 1,000–10,000 rows with pauses |
| backfill inside the migration | ties schema change to a long data job | separate job (Container Apps job) after deploy |

### Guard rails in the migration itself
| Guard | How |
|:--|:--|
| ⭐ lock timeout | `SET LOCK_TIMEOUT 5000;` the migration fails fast instead of queueing everything behind it |
| ⭐ review generated SQL | `dotnet ef migrations script --idempotent`; EF Core sometimes rebuilds tables (rename + recreate) |
| ⭐ batches for data changes | `UPDATE TOP (5000) ... WHERE ...` in a loop |
| run off-peak | big index builds and backfills at night |
| `RESUMABLE = ON` | pause/resume index builds; survive failovers |
| watch while running | blocking (`sys.dm_exec_requests` `blocking_session_id`), log usage, DTU/CPU |
| optimized locking | Azure SQL / SQL Server 2025 reduce lock memory and lock escalation; still batch |
| test on production-size data | a restored copy (lesson 01) with real row counts; timings matter |

### Expand/contract checklist
1. **Expand:** add new things (columns, tables, indexes) without removing anything; code keeps working.
2. **Migrate:** backfill in batches; switch reads; write both.
3. **Contract:** remove old columns only after every running version stopped using them (at least one release later).

## Example
`src/Shop.Infrastructure/Migrations/20261109_AddProductSlug.cs` (expand step)
```csharp
using Microsoft.EntityFrameworkCore.Migrations;

public partial class AddProductSlug : Migration
{
    protected override void Up(MigrationBuilder mb)
    {
        mb.Sql("SET LOCK_TIMEOUT 5000;");                                  // fail fast if blocked
        mb.AddColumn<string>("Slug", schema: "catalog", table: "Products", type: "nvarchar(200)", nullable: true);
        // index is created online, after the backfill job fills the column (a later migration)
    }

    protected override void Down(MigrationBuilder mb) =>
        mb.DropColumn("Slug", schema: "catalog", table: "Products");
}
```
`src/Shop.Infrastructure/Data/Configurations/ProductConfiguration.cs` (online index in the model)
```csharp
builder.HasIndex(p => p.Slug).IsUnique().HasFilter("[Slug] IS NOT NULL").IsCreatedOnline();
```
`jobs/backfill-product-slugs.sql` (run as a separate job, not in the migration)
```sql
SET LOCK_TIMEOUT 5000;
DECLARE @rows int = 1;
WHILE @rows > 0
BEGIN
    UPDATE TOP (5000) catalog.Products
    SET Slug = LOWER(REPLACE(TRIM(Name), ' ', '-'))
    WHERE Slug IS NULL;
    SET @rows = @@ROWCOUNT;
    WAITFOR DELAY '00:00:00.200';                                         -- let other work through
END
```
A safe foreign key on a big table:
```sql
ALTER TABLE ordering.OrderLines WITH NOCHECK ADD CONSTRAINT FK_OrderLines_Products
    FOREIGN KEY (ProductId) REFERENCES catalog.Products (Id);
-- later, in a quiet window (scans the table):
ALTER TABLE ordering.OrderLines WITH CHECK CHECK CONSTRAINT FK_OrderLines_Products;
```
Watching for blocking while a migration runs:
```sql
SELECT r.session_id, r.blocking_session_id, r.wait_type, r.wait_time, r.command, t.text
FROM sys.dm_exec_requests r CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.blocking_session_id <> 0;
```

## Production patterns
- Every migration's SQL is reviewed for locks, table rebuilds, and size-of-data operations before merge.
- Migrations set a lock timeout; indexes are built online and resumable; constraints on large tables are added `NOCHECK` and validated later.
- Data backfills are separate, batched, resumable jobs; schema changes follow expand/contract across releases.
- Big changes are rehearsed on a restored production-size copy and scheduled off-peak, with someone watching blocking and log usage.

## Mistakes
Wrong:
```csharp
mb.AlterColumn<string>("Name", "Products", maxLength: 300, schema: "catalog");   // rewrite under lock on a huge table
mb.Sql("UPDATE catalog.Products SET Slug = LOWER(Name)");                        // one giant transaction
```
Right: new column, batched backfill job, switch reads, drop the old column later.

Wrong: trusting that EF Core's generated SQL is always online.
Right: read the script; add `IsCreatedOnline()`, lock timeouts, and split steps.

## Check yourself
1. Why set a lock timeout in a migration?
2. Which schema changes are metadata-only on Azure SQL?
3. Why run backfills outside the migration?

<details><summary>Answers</summary>

1. If the migration waits for a lock, every later query that needs the same table queues behind it, freezing the app. A short lock timeout makes the migration fail fast so you can retry in a quieter moment.
2. Adding a nullable column, and adding a NOT NULL column with a constant default (online in Azure SQL and SQL Server Enterprise); dropping a column is metadata-only too, but breaks old code.
3. Backfills can take a long time and generate lots of log and locks. As a separate batched job they don't block the deploy, can pause and resume, and don't hold one huge transaction.
</details>

## Sources
- [Online index operations](https://learn.microsoft.com/sql/relational-databases/indexes/perform-index-operations-online)
- [Resumable index operations](https://learn.microsoft.com/sql/relational-databases/indexes/guidelines-for-online-index-operations#resumable-index-considerations)
- [SET LOCK_TIMEOUT](https://learn.microsoft.com/sql/t-sql/statements/set-lock-timeout-transact-sql)
- [Optimized locking](https://learn.microsoft.com/sql/relational-databases/performance/optimized-locking)
- [EF Core SQL Server index features](https://learn.microsoft.com/ef/core/providers/sql-server/indexes)
- [ALTER TABLE ... ADD COLUMN online](https://learn.microsoft.com/sql/t-sql/statements/alter-table-transact-sql#adding-not-null-columns-as-an-online-operation)
