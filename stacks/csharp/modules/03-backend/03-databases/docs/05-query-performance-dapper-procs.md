---
title: "Query performance: N+1, EF Core tuning, Dapper, stored procedures"
tech: EF Core 10, Dapper, Microsoft.Data.SqlClient, SQL Server 2025
version: EF Core 10.0.x, Dapper 2.1.x, Microsoft.Data.SqlClient 6.x
date: 2026-11-09
covers: [5, 10, 11, 12]
---
# Query performance: N+1, EF Core tuning, Dapper, stored procedures
[← Overview](00-overview.md)

## Why it matters
- The order history page runs 1 query for orders and 50 more for their lines; at 200 requests per second that's 10,000 queries per second.
- `Include(o => o.Lines).Include(o => o.Payments).Include(o => o.Shipments)` produces a cartesian explosion: 20 orders return 40,000 rows.
- A finance report written in LINQ generates a 300-line SQL statement nobody can tune; the same report as a reviewed SQL query (or stored procedure) runs 20× faster.

## Concepts

### The N+1 problem
Loading a list, then querying related data per item. With EF Core it comes from lazy loading (proxies) or from loops calling the database.
| Fix | How |
|:--|:--|
| ⭐ projection | `Select(o => new OrderDto(o.Id, o.Lines.Count, o.Lines.Sum(l => l.Quantity * l.UnitPrice)))` → one SQL query |
| eager loading | `Include(o => o.Lines)` |
| ⭐ split queries | `AsSplitQuery()` for multiple collection includes (avoids cartesian explosion) |
| batch by IDs | `Where(x => ids.Contains(x.OrderId))` once, then group in memory |
| no lazy loading | don't enable `UseLazyLoadingProxies` in APIs |

### Seeing the SQL EF Core sends
| Tool | Use |
|:--|:--|
| logging category `Microsoft.EntityFrameworkCore.Database.Command` at `Information` | every command with duration |
| `query.ToQueryString()` | SQL for one query (debugging, tests) |
| `TagWith("orders:list")` | comment in SQL, visible in Query Store and traces |
| `EnableSensitiveDataLogging()` | parameter values: **Development only** |
| OpenTelemetry SQL instrumentation | spans with durations (03-backend/10) |

### EF Core tuning checklist
| Technique | Effect |
|:--|:--|
| ⭐ `AsNoTracking()` for reads | no tracking overhead |
| ⭐ project to DTOs | fewer columns, no entity materialization |
| `AsSplitQuery()` | one query per collection include |
| filters and limits in SQL | stay `IQueryable` until the end |
| compiled queries `EF.CompileAsyncQuery` | skip LINQ translation for very hot queries |
| `ExecuteUpdateAsync`/`ExecuteDeleteAsync` | bulk changes without loading |
| `Contains` on lists | parameterized (EF 10 improved translation of large parameter collections) |
| avoid client evaluation | EF Core throws for untranslatable expressions in the final projection only; check `ToQueryString()` |
| `AddDbContextPool` | lower allocation per request |

### Dapper and ADO.NET
Dapper maps SQL results to objects with almost no overhead. Use it for hand-written reporting queries, complex SQL (window functions, CTEs), and stored procedures.
| Rule | Why |
|:--|:--|
| ⭐ parameters always (`@CustomerId` + anonymous object) | injection-safe, plan reuse |
| `CommandDefinition` with `cancellationToken` | cancellation |
| `await using var conn = new SqlConnection(cs)` | pooled connection returned on dispose |
| command timeout explicit for slow reports | default 30 s |
| `QueryMultipleAsync` | several result sets in one round trip |
| sharing a transaction with EF Core | `db.Database.GetDbConnection()` + `GetDbTransaction()` |

### Stored procedures, views, functions
| Object | Use | Watch out |
|:--|:--|:--|
| view | reusable read shape (`vw_OrderTotals`); EF can map keyless entities to views | not a performance tool by itself |
| stored procedure | complex set-based logic, reporting, shared with other systems (finance, BI), permission boundary (EXECUTE only) | logic split between C# and T-SQL; version them in migrations |
| inline table-valued function | parameterized view; composable in queries | |
| scalar UDF | small helpers | can hurt performance (SQL Server 2019+ inlines many) |

Call from EF Core: `db.Database.SqlQuery<DailySalesRow>($"EXEC dbo.GetDailySales @Day = {day}")`; from Dapper: `commandType: CommandType.StoredProcedure`. Keep procedure definitions in migrations (`migrationBuilder.Sql(...)`) so they're versioned with the schema.

## Example
`src/Shop.Infrastructure/Orders/OrderQueries.cs`
```csharp
using Microsoft.EntityFrameworkCore;

public sealed class OrderQueries(ShopDb db)
{
    public Task<List<OrderListItemDto>> ForCustomerAsync(long customerId, CancellationToken ct) =>
        db.Orders
            .AsNoTracking()
            .TagWith("orders:list-for-customer")
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.PlacedAt)
            .Take(20)
            .Select(o => new OrderListItemDto(
                o.Id, o.PlacedAt, o.Status.ToString(),
                o.Lines.Count,
                o.Lines.Sum(l => l.Quantity * l.UnitPrice)))      // one SQL query, no N+1
            .ToListAsync(ct);

    public Task<Order?> ForEditAsync(long id, CancellationToken ct) =>
        db.Orders
            .Include(o => o.Lines)
            .Include(o => o.Payments)
            .AsSplitQuery()                                         // two collections → avoid cartesian product
            .SingleOrDefaultAsync(o => o.Id == id, ct);
}
```
`src/Shop.Infrastructure/Reports/SalesReport.cs` (Dapper)
```csharp
using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;

public sealed class SalesReport(IConfiguration config)
{
    private const string Sql = """
        SELECT CAST(o.PlacedAt AS date) AS Day, o.Currency, COUNT(*) AS Orders, SUM(o.Total) AS Revenue
        FROM dbo.Orders AS o
        WHERE o.Status IN ('Paid', 'Shipped') AND o.PlacedAt >= @From AND o.PlacedAt < @To
        GROUP BY CAST(o.PlacedAt AS date), o.Currency
        ORDER BY Day;
        """;

    public async Task<IReadOnlyList<DailySales>> RunAsync(DateOnly from, DateOnly to, CancellationToken ct)
    {
        await using var conn = new SqlConnection(config.GetConnectionString("ShopReadOnly"));
        var rows = await conn.QueryAsync<DailySales>(new CommandDefinition(Sql,
            new { From = from.ToDateTime(TimeOnly.MinValue), To = to.AddDays(1).ToDateTime(TimeOnly.MinValue) },
            commandTimeout: 60, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<IReadOnlyList<DailySales>> RunProcAsync(DateOnly day, CancellationToken ct)
    {
        await using var conn = new SqlConnection(config.GetConnectionString("ShopReadOnly"));
        var rows = await conn.QueryAsync<DailySales>(new CommandDefinition("dbo.GetDailySales",
            new { Day = day.ToDateTime(TimeOnly.MinValue) }, commandType: CommandType.StoredProcedure, cancellationToken: ct));
        return rows.AsList();
    }
}

public sealed record DailySales(DateTime Day, string Currency, int Orders, decimal Revenue);
```
Logging generated SQL in Development (`appsettings.Development.json`):
```json
{ "Logging": { "LogLevel": { "Microsoft.EntityFrameworkCore.Database.Command": "Information" } } }
```

## Production patterns
- Read endpoints: `AsNoTracking` + projection; never return entity graphs.
- Watch query counts per request in traces; more than a handful for one endpoint is a smell.
- Dapper (or SQL via `SqlQuery`) for reports and complex SQL, with a read-only connection string or a read replica (Azure SQL read scale-out, `ApplicationIntent=ReadOnly`).
- Stored procedures only where they earn their place, versioned in migrations, reviewed like code.

## Mistakes
Wrong:
```csharp
foreach (var order in orders)
    order.Lines = await db.OrderLines.Where(l => l.OrderId == order.Id).ToListAsync(ct);   // N+1
```
Right: projection or one batched query by `ids.Contains(...)`.

Wrong: string-built SQL in Dapper.
```csharp
conn.QueryAsync<Order>($"SELECT * FROM Orders WHERE Sku = '{sku}'");
```
Right: `"… WHERE Sku = @Sku", new { Sku = sku }`.

## Check yourself
1. What is a cartesian explosion, and how does `AsSplitQuery` help?
2. How do you see the SQL for one EF Core query in a test?
3. When would you choose Dapper over EF Core?

<details><summary>Answers</summary>

1. Including several collections in one SQL query multiplies rows (lines × payments × shipments per order); `AsSplitQuery` loads each collection in its own query.
2. `query.ToQueryString()`.
3. For hand-tuned SQL (reports, CTEs, window functions), stored procedure calls, and very hot read paths where you want full control of the SQL; EF Core stays for writes and typical queries.
</details>

## Sources
- [EF Core — Efficient querying](https://learn.microsoft.com/ef/core/performance/efficient-querying)
- [EF Core — Single vs split queries](https://learn.microsoft.com/ef/core/querying/single-split-queries)
- [EF Core — Logging and diagnostics (simple logging)](https://learn.microsoft.com/ef/core/logging-events-diagnostics/simple-logging)
- [EF Core — SQL queries](https://learn.microsoft.com/ef/core/querying/sql-queries)
- [Dapper](https://github.com/DapperLib/Dapper)
- [CREATE PROCEDURE](https://learn.microsoft.com/sql/t-sql/statements/create-procedure-transact-sql)
