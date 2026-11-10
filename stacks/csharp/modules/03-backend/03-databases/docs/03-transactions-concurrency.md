---
title: Transactions, isolation, locking, and optimistic concurrency
tech: SQL Server 2025, EF Core 10
version: SQL Server 2025, EF Core 10
date: 2026-11-09
covers: [4, 8]
---
# Transactions, isolation, locking, and optimistic concurrency
[← Overview](00-overview.md)

## Why it matters
- Two customers buy the last bag at the same time; both checks see `Stock = 1`, both orders succeed, stock becomes `-1`.
- A report query holds shared locks for 40 seconds; every checkout that touches `Orders` waits behind it.
- Deadlocks (error 1205) appear at peak; the app shows a 500 instead of retrying the victim transaction.

## Concepts

### Transactions
A transaction is all-or-nothing (atomicity), keeps constraints valid (consistency), isolates concurrent work (isolation), and survives crashes once committed (durability).
- EF Core: one `SaveChangesAsync` is one transaction. For several saves or raw SQL in one unit: `await using var tx = await db.Database.BeginTransactionAsync(ct); … await tx.CommitAsync(ct);`.
- Keep transactions **short**: no HTTP calls, no user think time, no waiting on queues inside them.
- With `EnableRetryOnFailure`, wrap manual transactions in `db.Database.CreateExecutionStrategy().ExecuteAsync(...)` so the whole unit is retried.

### Isolation levels in SQL Server
| Level | Readers see | Readers block writers? | Anomalies prevented |
|:--|:--|:--|:--|
| READ UNCOMMITTED (`NOLOCK`) | uncommitted data | no | none (dirty reads) → avoid |
| READ COMMITTED (default, locking) | committed data | yes (shared locks while reading) | dirty reads |
| ⭐ READ COMMITTED SNAPSHOT (RCSI) | last committed version (row versioning) | no | dirty reads; readers and writers don't block each other |
| SNAPSHOT | consistent snapshot for the whole transaction | no | non-repeatable reads, phantoms; update conflicts raise error 3960 |
| REPEATABLE READ | rows read stay locked | yes | non-repeatable reads |
| SERIALIZABLE | range locks | yes | phantoms; most blocking |

RCSI is on by default in Azure SQL Database; turn it on for SQL Server databases (`ALTER DATABASE Shop SET READ_COMMITTED_SNAPSHOT ON`). SQL Server 2025's **optimized locking** (with accelerated database recovery and RCSI) reduces lock memory and blocking further.

### Locking patterns
| Need | Pattern |
|:--|:--|
| ⭐ decrement stock safely | single atomic statement: `UPDATE Products SET Stock = Stock - @q WHERE Id = @id AND Stock >= @q`; check rows affected |
| read-then-update a row safely | `SELECT … WITH (UPDLOCK, ROWLOCK) WHERE Id = @id` inside the transaction |
| queue table: claim work without collisions | `WITH (UPDLOCK, READPAST, ROWLOCK)` (SQL Server's "skip locked") |
| avoid deadlocks | touch tables in the same order; short transactions; good indexes (fewer locks) |
| handle deadlocks | SQL error 1205 = victim → retry the whole transaction (execution strategy or Polly) |
| find deadlocks | `system_health` Extended Events session → deadlock graph |

### Optimistic concurrency
For user edits that may conflict (two agents editing an address), don't hold locks across user think time. Detect conflicts at save time:
- `rowversion` column mapped with `IsRowVersion()` (or `[Timestamp]`): EF Core adds `WHERE RowVersion = @original` to updates.
- Zero rows affected → `DbUpdateConcurrencyException`.
- Map to HTTP 412 with ETag/If-Match (02-api-design lesson 05), or merge and retry for automatic updates.
- `IsConcurrencyToken()` on a regular property (e.g. a `Version` int you increment) works too.

## Example
`src/Shop.Infrastructure/Inventory/StockReservation.cs`
```csharp
using Microsoft.EntityFrameworkCore;

public sealed class StockReservation(ShopDb db)
{
    public async Task<bool> TryReserveAsync(long productId, int quantity, CancellationToken ct)
    {
        var rows = await db.Products
            .Where(p => p.Id == productId && p.Stock >= quantity)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Stock, p => p.Stock - quantity), ct);  // one atomic UPDATE
        return rows == 1;                                                                            // 0 → not enough stock
    }
}
```
`src/Shop.Application/Checkout/PlaceOrder.cs` (several changes in one retried transaction)
```csharp
public async Task<long> PlaceAsync(PlaceOrderCommand cmd, CancellationToken ct)
{
    var strategy = db.Database.CreateExecutionStrategy();
    return await strategy.ExecuteAsync(async () =>
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        foreach (var line in cmd.Lines)
            if (!await stock.TryReserveAsync(line.ProductId, line.Quantity, ct))
                throw new OutOfStockException(line.ProductId);                // rolls back on dispose

        var order = Order.Place(cmd.CustomerId, cmd.Lines, time.GetUtcNow());
        db.Orders.Add(order);
        db.OutboxMessages.Add(OutboxMessage.From(new OrderPlaced(order.Id)));  // same transaction (03-backend/07)
        await db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);
        return order.Id;
    });
}
```
Claiming jobs from a queue table:
```sql
WITH next AS (
    SELECT TOP (10) Id FROM dbo.EmailQueue WITH (UPDLOCK, READPAST, ROWLOCK)
    WHERE Status = 'Pending' ORDER BY Id
)
UPDATE q SET Status = 'Processing', ClaimedAt = SYSUTCDATETIME()
OUTPUT inserted.Id, inserted.Payload
FROM dbo.EmailQueue AS q JOIN next ON next.Id = q.Id;
```

## Production patterns
- RCSI on for OLTP databases (Azure SQL has it by default).
- Inventory and counters changed with single conditional `UPDATE`s, not read-modify-write in C#.
- Optimistic concurrency (`rowversion`) on aggregates edited by people; 412 back to the client.
- Retry deadlock victims and transient errors with the EF Core execution strategy; log the deadlock graph for analysis.

## Mistakes
Wrong: read-check-write in C#.
```csharp
var p = await db.Products.FindAsync(id);
if (p!.Stock >= qty) { p.Stock -= qty; await db.SaveChangesAsync(); }   // race between read and write
```
Right: conditional `ExecuteUpdateAsync` (or `rowversion` + retry).

Wrong: calling Stripe inside an open database transaction.
Right: commit the order (and an outbox message) first; call external services after, idempotently.

## Check yourself
1. What does RCSI change for readers and writers?
2. How does EF Core detect a concurrency conflict with `rowversion`?
3. What should the application do when SQL Server reports error 1205?

<details><summary>Answers</summary>

1. Readers read the last committed version of rows from the version store instead of taking shared locks, so they don't block writers and aren't blocked by them.
2. It includes the original `RowVersion` value in the `UPDATE … WHERE` clause; if no row matches (someone else changed it), zero rows are affected and it throws `DbUpdateConcurrencyException`.
3. Treat it as a transient failure: roll back and retry the whole transaction (and investigate the deadlock graph if it's frequent).
</details>

## Sources
- [Transaction locking and row versioning guide](https://learn.microsoft.com/sql/relational-databases/sql-server-transaction-locking-and-row-versioning-guide)
- [Optimized locking](https://learn.microsoft.com/sql/relational-databases/performance/optimized-locking)
- [EF Core — Transactions](https://learn.microsoft.com/ef/core/saving/transactions)
- [EF Core — Handling concurrency conflicts](https://learn.microsoft.com/ef/core/saving/concurrency)
- [EF Core — Connection resiliency (execution strategies)](https://learn.microsoft.com/ef/core/miscellaneous/connection-resiliency)
