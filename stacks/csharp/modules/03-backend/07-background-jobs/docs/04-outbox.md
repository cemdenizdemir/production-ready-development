---
title: The transactional outbox
tech: EF Core 10, SQL Server 2025, BackgroundService, Azure Service Bus
version: EF Core 10, Azure.Messaging.ServiceBus 7.x
date: 2026-11-09
covers: [11]
---
# The transactional outbox
[← Overview](00-overview.md)

## Why it matters
- The order is saved, then publishing `OrderPlaced` to Service Bus fails; the warehouse never hears about the order.
- The message is published first, then saving the order fails; the warehouse ships an order that doesn't exist.
- A "publish after commit" in code works 99.9% of the time; at 50,000 orders a day, that's 50 lost or phantom orders.

## Concepts

### The dual-write problem
Writing to the database **and** a message broker are two separate operations with no shared transaction. Any crash between them leaves one done and the other not.

### The outbox pattern
1. In the **same database transaction** as the business change, insert a row into an `OutboxMessages` table.
2. A separate publisher reads unpublished rows, sends them to the broker, and marks them published.
3. Consumers are **idempotent**, because the publisher may send a message twice (it can crash after sending and before marking).

```mermaid
sequenceDiagram
  participant API
  participant DB as SQL (Orders + Outbox)
  participant P as Outbox publisher
  participant SB as Service Bus
  participant C as Consumer
  API->>DB: BEGIN; INSERT Order; INSERT OutboxMessage; COMMIT
  loop every 1–2 s
    P->>DB: claim batch (UPDLOCK, READPAST)
    P->>SB: send (MessageId = outbox Id)
    P->>DB: mark ProcessedAt
  end
  SB->>C: deliver (at least once)
  C->>C: dedupe by MessageId (inbox table)
```

| Column | Purpose |
|:--|:--|
| `Id` (GUID) | message identity; reused as `MessageId` for broker duplicate detection |
| `Type` | message type name (`OrderPlaced.v1`) |
| `Payload` | JSON |
| `OccurredAt` | event time |
| `ProcessedAt` | null until published |
| `Attempts`, `LastError` | retries and diagnostics |
| `TraceParent` | continue the trace in consumers |

Inbox (consumer side): `ProcessedMessages(MessageId, Handler)` with a unique key, inserted in the same transaction as the consumer's own changes.

### Producing outbox messages from domain events
Aggregates record domain events (`OrderPlaced`); an EF Core `SaveChangesInterceptor` (or the `SaveChangesAsync` override) converts them to outbox rows before saving, so every save that changes state also records its events, atomically (06-design/05-domain-driven-design).

### Options
| Option | Notes |
|:--|:--|
| ⭐ hand-rolled outbox (this lesson) | small, explicit, teaches the pattern |
| Wolverine / MassTransit / NServiceBus outboxes | built in (MassTransit 9 and NServiceBus are commercial) |
| change data capture | publish from SQL Server CDC / Debezium (heavier) |
| Hangfire as the "outbox" | `Enqueue` inside the same transaction is possible with SQL Server storage, but couples jobs to the DB transaction semantics; outbox is clearer for integration events |

## Example
`src/Shop.Infrastructure/Outbox/OutboxInterceptor.cs`
```csharp
using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

public sealed class OutboxInterceptor(TimeProvider time) : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e, InterceptionResult<int> result, CancellationToken ct = default)
    {
        var db = e.Context!;
        var events = db.ChangeTracker.Entries<IHasDomainEvents>()
            .SelectMany(x => x.Entity.DequeueEvents())
            .ToList();

        foreach (var evt in events)
            db.Set<OutboxMessage>().Add(new OutboxMessage
            {
                Id = Guid.NewGuid(),
                Type = evt.GetType().Name,
                Payload = JsonSerializer.Serialize(evt, evt.GetType()),
                OccurredAt = time.GetUtcNow(),
                TraceParent = Activity.Current?.Id,
            });
        return base.SavingChangesAsync(e, result, ct);
    }
}
```
`src/Shop.Infrastructure/Outbox/OutboxPublisher.cs`
```csharp
using Azure.Messaging.ServiceBus;
using Microsoft.EntityFrameworkCore;

public sealed class OutboxPublisher(IServiceScopeFactory scopes, ServiceBusSender sender, ILogger<OutboxPublisher> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await using var scope = scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<ShopDb>();
            await using var tx = await db.Database.BeginTransactionAsync(stoppingToken);

            var batch = await db.OutboxMessages
                .FromSql($"SELECT TOP (50) * FROM dbo.OutboxMessages WITH (UPDLOCK, READPAST, ROWLOCK) WHERE ProcessedAt IS NULL ORDER BY OccurredAt")
                .ToListAsync(stoppingToken);

            foreach (var m in batch)
            {
                try
                {
                    var msg = new ServiceBusMessage(BinaryData.FromString(m.Payload))
                    {
                        MessageId = m.Id.ToString(),           // broker duplicate detection
                        Subject = m.Type,
                        ContentType = "application/json",
                    };
                    if (m.TraceParent is not null) msg.ApplicationProperties["traceparent"] = m.TraceParent;
                    await sender.SendMessageAsync(msg, stoppingToken);
                    m.ProcessedAt = DateTimeOffset.UtcNow;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    m.Attempts++; m.LastError = ex.Message;
                    log.LogWarning(ex, "Outbox message {Id} failed (attempt {Attempts})", m.Id, m.Attempts);
                }
            }
            await db.SaveChangesAsync(stoppingToken);
            await tx.CommitAsync(stoppingToken);
        }
    }
}
```
`READPAST` lets several replicas run the publisher without sending the same rows at the same time.

## Production patterns
- Every integration event goes through the outbox in the same transaction as the state change.
- Message IDs are stable (outbox row ID) and the broker's duplicate detection is on; consumers still dedupe with an inbox.
- Monitor outbox lag (oldest unprocessed `OccurredAt`) and rows with many attempts; alert on growth.
- Clean up processed rows after N days (a recurring job).

## Mistakes
Wrong:
```csharp
await db.SaveChangesAsync(ct);
await sender.SendMessageAsync(new ServiceBusMessage(json), ct);   // crash in between → lost event
```
Right: outbox row in the same `SaveChangesAsync`, published by the background publisher.

Wrong: consumers assuming each message arrives once.
Right: inbox table / idempotent handlers.

## Check yourself
1. What is the dual-write problem?
2. Why can the outbox publisher send a message twice, and what handles that?
3. Why does the publisher use `UPDLOCK, READPAST`?

<details><summary>Answers</summary>

1. Updating two systems (database and broker) without a shared transaction: a failure between the two leaves them inconsistent.
2. It can crash after sending but before marking the row processed; broker duplicate detection (same `MessageId`) and idempotent consumers handle it.
3. So concurrent publishers on several replicas each claim different rows and skip rows locked by others, instead of blocking or double-sending.
</details>

## Sources
- [Transactional outbox pattern (Azure Architecture Center)](https://learn.microsoft.com/azure/architecture/databases/guide/transactional-outbox-cosmos)
- [microservices.io — Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [EF Core interceptors](https://learn.microsoft.com/ef/core/logging-events-diagnostics/interceptors)
- [Service Bus duplicate detection](https://learn.microsoft.com/azure/service-bus-messaging/duplicate-detection)
