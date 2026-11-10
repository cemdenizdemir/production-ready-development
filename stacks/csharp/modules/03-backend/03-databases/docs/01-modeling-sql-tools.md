---
title: Relational modeling, data types, SQL you must know, and tools
tech: SQL Server 2025 (T-SQL), SSMS, VS Code mssql extension
version: SQL Server 2025
date: 2026-11-09
covers: [1, 2, 9, 16]
---
# Relational modeling, data types, SQL you must know, and tools
[← Overview](00-overview.md)

## Why it matters
- Customer addresses are copied into every order row as one text column; changing the address format means parsing millions of strings.
- `Total FLOAT` stores `27.000000000000004`; reconciliation with Stripe fails daily.
- No foreign keys "for performance"; orphaned order lines accumulate and reports double-count revenue.

## Concepts

### Relational modeling
| Concept | Rule |
|:--|:--|
| entities → tables | one table per thing with identity (Customers, Orders, OrderLines, Products) |
| primary key | every table; surrogate key (`bigint` identity or GUID) + unique natural keys where they exist (SKU, email) |
| foreign keys | always; they protect integrity and help the optimizer |
| normalization (to 3NF) | each fact in one place; no repeating groups; no columns depending on part of a key |
| deliberate denormalization | historical snapshots (price and address **at the time of the order** belong on the order) |
| constraints | `NOT NULL`, `UNIQUE`, `CHECK (Quantity > 0)`, `DEFAULT` |
| many-to-many | join table with a composite key (`ProductTags(ProductId, TagId)`) |
| soft delete | `IsDeleted` + filtered indexes/query filters, only when you need it |

### SQL Server data types that matter
| Need | Type | Avoid |
|:--|:--|:--|
| ⭐ money | `decimal(19,4)` or `decimal(18,2)` (+ currency `char(3)`) | `float`, `money` (rounding quirks) |
| ⭐ instants | `datetimeoffset(3)` (or `datetime2(3)` always UTC) | `datetime` (low precision) |
| calendar date | `date` | `datetime` |
| text | `nvarchar(n)` (Unicode) with a real max | `varchar` for user text, `nvarchar(max)` everywhere |
| case-insensitive comparisons | collation (`Latin1_General_100_CI_AS_SC_UTF8`, or `Turkish_100_CI_AS` for Turkish rules) | `LOWER()` in queries |
| identifiers | `bigint IDENTITY` or `uniqueidentifier` | |
| flags/enums | `tinyint`/`smallint` with a `CHECK`, or `nvarchar(20)` for readability | magic numbers without constraints |
| JSON documents | `json` (SQL Server 2025) or `nvarchar(max)` with `ISJSON` check | storing relational data as JSON |
| versions | `rowversion` | |
| embeddings | `vector(1536)` (SQL Server 2025) | |

GUID keys: SQL Server orders `uniqueidentifier` by its **last** bytes first, so random GUIDs and `Guid.CreateVersion7()` (time in the first bytes) are not sequential in a SQL Server index and fragment a clustered key. EF Core's default GUID generator for SQL Server produces SQL-Server-sequential GUIDs; or cluster on a `bigint` identity and keep a GUID as a public, non-clustered unique key.

### SQL you must know
| Feature | Example |
|:--|:--|
| joins | `INNER JOIN`, `LEFT JOIN` (orders without shipments) |
| aggregates | `SUM`, `COUNT`, `GROUP BY`, `HAVING` |
| ⭐ CTEs | `WITH recent AS (SELECT …) SELECT … FROM recent` |
| ⭐ window functions | `ROW_NUMBER() OVER (PARTITION BY CustomerId ORDER BY PlacedAt DESC)`, running totals `SUM(…) OVER (ORDER BY …)` |
| upserts | `MERGE` (carefully, with `HOLDLOCK`) or `UPDATE … IF @@ROWCOUNT = 0 INSERT …` in a transaction |
| `OFFSET … FETCH` / `TOP` | paging / limits |
| `EXISTS` vs `IN` | correlated existence checks |
| `OUTPUT inserted.*` | return changed rows |
| `STRING_AGG`, `JSON_VALUE`, `OPENJSON` | strings and JSON |

### Tools
| Tool | Use |
|:--|:--|
| SSMS 21+ (Windows) | full admin, execution plans, Query Store reports, XEvents |
| ⭐ VS Code mssql extension | queries, results, plans, schema browsing in your editor |
| `sqlcmd` (go-sqlcmd) | scripting, CI, containers |
| SQL Server 2025 in Docker | local dev and tests (Testcontainers) |
| Azure portal Query editor | quick checks on Azure SQL |

## Example
`db/schema.sql` (what EF Core will create, written by hand first)
```sql
CREATE TABLE dbo.Customers (
    Id          bigint IDENTITY PRIMARY KEY,
    PublicId    uniqueidentifier NOT NULL CONSTRAINT DF_Customers_PublicId DEFAULT NEWSEQUENTIALID(),
    Email       nvarchar(254) NOT NULL,
    DisplayName nvarchar(100) NOT NULL,
    CreatedAt   datetimeoffset(3) NOT NULL CONSTRAINT DF_Customers_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Customers_Email UNIQUE (Email),
    CONSTRAINT UQ_Customers_PublicId UNIQUE (PublicId)
);

CREATE TABLE dbo.Orders (
    Id         bigint IDENTITY PRIMARY KEY,
    CustomerId bigint NOT NULL CONSTRAINT FK_Orders_Customers REFERENCES dbo.Customers(Id),
    Status     varchar(20) NOT NULL CONSTRAINT CK_Orders_Status CHECK (Status IN ('Placed','Paid','Shipped','Cancelled')),
    Total      decimal(18,2) NOT NULL CONSTRAINT CK_Orders_Total CHECK (Total >= 0),
    Currency   char(3) NOT NULL,
    PlacedAt   datetimeoffset(3) NOT NULL,
    ShipTo     json NULL,                                      -- address snapshot at order time (SQL Server 2025)
    RowVersion rowversion NOT NULL
);

CREATE TABLE dbo.OrderLines (
    OrderId   bigint NOT NULL CONSTRAINT FK_OrderLines_Orders REFERENCES dbo.Orders(Id) ON DELETE CASCADE,
    LineNo    int NOT NULL,
    Sku       varchar(20) NOT NULL,
    Quantity  int NOT NULL CONSTRAINT CK_OrderLines_Qty CHECK (Quantity BETWEEN 1 AND 1000),
    UnitPrice decimal(18,2) NOT NULL,                          -- price at order time
    CONSTRAINT PK_OrderLines PRIMARY KEY (OrderId, LineNo)
);
```
`db/queries/top-customers.sql`
```sql
WITH ranked AS (
    SELECT o.CustomerId, o.Id, o.Total, o.PlacedAt,
           ROW_NUMBER() OVER (PARTITION BY o.CustomerId ORDER BY o.PlacedAt DESC) AS rn,
           SUM(o.Total) OVER (PARTITION BY o.CustomerId) AS LifetimeTotal
    FROM dbo.Orders AS o
    WHERE o.Status IN ('Paid', 'Shipped')
)
SELECT TOP (10) c.DisplayName, r.LifetimeTotal, r.PlacedAt AS LastOrderAt
FROM ranked AS r
JOIN dbo.Customers AS c ON c.Id = r.CustomerId
WHERE r.rn = 1
ORDER BY r.LifetimeTotal DESC;
```

## Production patterns
- Write and read the SQL yourself before (and while) using EF Core; review generated migrations as SQL.
- Constraints in the database, not only validation in C#: the database is the last line of defense.
- Snapshot data that must not change with later edits (prices, addresses, tax rates) onto the order.
- `decimal` for money, `datetimeoffset` for instants, `date` for calendar dates, Unicode `nvarchar` with sensible lengths.

## Mistakes
Wrong:
```sql
Total float, PlacedAt datetime, Notes nvarchar(max)    -- for everything
```
Right: `decimal(18,2)`, `datetimeoffset(3)`, `nvarchar(500)`.

Wrong: random GUIDs (`NEWID()` / `Guid.NewGuid()` / v7) as the clustered primary key.
Right: `bigint IDENTITY` clustered key (or SQL-Server-sequential GUIDs) plus a public GUID.

## Check yourself
1. Why store `UnitPrice` on `OrderLines` when `Products` already has a price?
2. Why are `Guid.CreateVersion7()` values not sequential in a SQL Server index?
3. What does `ROW_NUMBER() OVER (PARTITION BY CustomerId ORDER BY PlacedAt DESC)` give you?

<details><summary>Answers</summary>

1. The order must keep the price at the time of purchase; product prices change later.
2. SQL Server compares `uniqueidentifier` values starting with the last 6 bytes; v7 puts the timestamp in the first bytes, so SQL Server's order is effectively random.
3. A per-customer ranking of orders from newest (1) to oldest, useful for "latest order per customer".
</details>

## Sources
- [SQL Server data types](https://learn.microsoft.com/sql/t-sql/data-types/data-types-transact-sql)
- [json data type (SQL Server 2025)](https://learn.microsoft.com/sql/t-sql/data-types/json-data-type)
- [Window functions (OVER clause)](https://learn.microsoft.com/sql/t-sql/queries/select-over-clause-transact-sql)
- [Comparing GUID and uniqueidentifier values](https://learn.microsoft.com/sql/connect/ado-net/sql/compare-guid-uniqueidentifier-values)
- [mssql extension for VS Code](https://learn.microsoft.com/sql/tools/visual-studio-code-extensions/mssql/mssql-extension-visual-studio-code)
