---
title: Replication, partitioning, and time and ordering
tech: Azure SQL, SQL Server 2025, Azure Service Bus sessions, C# 14
version: November 2026
date: 2026-11-09
covers: [4, 5, 6]
---
# Replication, partitioning, and time and ordering
[← Overview](00-overview.md)

## Why it matters
- Two warehouse workers updated the same stock row on different replicas of a multi-master setup. Both writes "won" on their side; after sync, stock was wrong by 40 bags.
- Events were ordered by `DateTime.UtcNow` from different containers. A container's clock was 3 seconds fast, so `OrderShipped` sorted before `OrderPaid`.
- A partitioned table used `CustomerCountry` as the key. 70% of customers were in one country; one partition held most data and load.

## Concepts

### Replication
| Topology | How | Pros | Cons |
|:--|:--|:--|:--|
| ⭐ single leader | all writes to one primary; replicas follow | simple, no write conflicts | primary is the write bottleneck; failover needed |
| multi-leader | several nodes accept writes; sync with each other | local writes in each region | ⭐ write conflicts need resolution |
| leaderless | clients write/read several replicas (quorums) | no failover; high availability | eventual consistency, read repair |

| Concept | Meaning |
|:--|:--|
| ⭐ synchronous replication | write confirmed after replicas have it (no data loss on failover, more latency) |
| ⭐ asynchronous replication | write confirmed before replicas have it (fast; RPO > 0) |
| ⭐ replication lag | how far replicas are behind; causes stale reads |
| quorum (W + R > N) | with N replicas, writing to W and reading from R guarantees overlap |
| failover | promote a replica; risks: split brain, lost async writes |

Azure SQL: single leader; synchronous replicas inside the region (HA), asynchronous geo-replicas (failover groups).

### Partitioning and rebalancing
| Strategy | Good for | Risk |
|:--|:--|:--|
| ⭐ hash | even spread | range queries hit all partitions |
| ⭐ range (e.g. by date) | time-based queries, archiving | hot latest partition |
| list / tenant | multi-tenant isolation | uneven tenants |
| ⭐ key choice | high cardinality, even load, matches access pattern | skew (hot partitions) |
| rebalancing | move partitions when nodes change | fixed number of partitions or consistent hashing keeps moves small |

### Time and ordering
| Tool | Gives | Limit |
|:--|:--|:--|
| ⭐ wall clocks (`DateTimeOffset.UtcNow`) | human time | skew between machines (ms to seconds), jumps (NTP) |
| monotonic clocks (`Stopwatch`, `TimeProvider.GetTimestamp()`) | durations on one machine | meaningless across machines |
| ⭐ Lamport clocks | a total order consistent with causality | can't tell concurrent from ordered |
| vector clocks | detect concurrent updates | size grows with participants |
| hybrid logical clocks (HLC) | close to wall time + causality | used by some databases |
| ⭐ per-aggregate versions | order of changes to one entity (version 1, 2, 3...) | only within the aggregate |
| ⭐ Service Bus sessions | FIFO per `SessionId` | per session only |
| database sequence | total order from one source | single point |

Rule: don't order events from different machines by wall-clock time. Use the source's sequence (aggregate version, database sequence, session order).

## In our stack
- Read replicas and failover groups: [04-shipping/05-data-safety lesson 03](../../../04-shipping/05-data-safety/docs/03-exports-redundancy-dr.md).
- Partitioning in SQL Server: [03-backend/09-scalability lesson 04](../../../03-backend/09-scalability/docs/04-database-scaling-reads.md).
- `rowversion` and aggregate versions: [05-domain-driven-design lesson 03](../../05-domain-driven-design/docs/03-building-blocks-aggregates.md).
- Service Bus sessions: [03-backend/07-background-jobs lesson 05](../../../03-backend/07-background-jobs/docs/05-service-bus-messaging-monitoring.md).

## When not to
- Don't use multi-leader replication for data with invariants (stock, balances) unless you have a conflict strategy you've tested.
- Don't build vector clocks into business apps; per-aggregate versions and sequences cover most needs.
- Don't partition by low-cardinality or skewed keys.

## Example
A Lamport clock (illustrates causality ordering across services):
```csharp
public sealed class LamportClock
{
    private long _time;
    public long Tick() => Interlocked.Increment(ref _time);                     // local event or send
    public long Receive(long remote)                                            // on message receipt
    {
        long current, next;
        do { current = Volatile.Read(ref _time); next = Math.Max(current, remote) + 1; }
        while (Interlocked.CompareExchange(ref _time, next, current) != current);
        return next;
    }
}
```
Per-aggregate versions to order and dedupe events in a consumer:
```csharp
public sealed record OrderStatusChanged(long OrderNumber, long Version, string Status);

internal sealed class OrderStatusProjection(ReadDb db) : IIntegrationEventHandler<OrderStatusChanged>
{
    public async Task HandleAsync(OrderStatusChanged e, Guid messageId, CancellationToken ct)
    {
        // apply only if newer than what we have: older or duplicate events are ignored
        var updated = await db.OrderViews
            .Where(v => v.OrderNumber == e.OrderNumber && v.Version < e.Version)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.Status, e.Status).SetProperty(v => v.Version, e.Version), ct);
        if (updated == 0 && !await db.OrderViews.AnyAsync(v => v.OrderNumber == e.OrderNumber, ct))
            db.OrderViews.Add(new OrderView(e.OrderNumber, e.Status, e.Version));
        await db.SaveChangesAsync(ct);
    }
}
```
Ordered processing per order with Service Bus sessions:
```csharp
await using var processor = client.CreateSessionProcessor("order-updates", new ServiceBusSessionProcessorOptions
{
    MaxConcurrentSessions = 16,            // different orders in parallel
    MaxConcurrentCallsPerSession = 1,      // one at a time within an order
    AutoCompleteMessages = false,
});
// sender: new ServiceBusMessage(body) { SessionId = orderNumber.ToString(), MessageId = eventId }
```

## Production patterns
- Single-leader databases for invariants; replicas for scale-out reads with known lag; failover tested.
- Partition keys chosen for even load and the main access pattern; partitions sized so rebalancing moves little data.
- Ordering comes from the source (aggregate versions, sequences, sessions), never from comparing wall clocks across machines; consumers apply only newer versions.

## Mistakes
Wrong: `ORDER BY OccurredAt` across events written by different containers to decide what happened first.
Right: aggregate version per entity (and session ordering on the queue).

Wrong: `DateTime.UtcNow - start` to measure durations.
Right: `TimeProvider.GetTimestamp()` / `Stopwatch` (monotonic).

## Check yourself
1. What's the trade-off between synchronous and asynchronous replication?
2. Why are wall-clock timestamps unreliable for ordering events across services?
3. How can a consumer handle out-of-order events for the same order?

<details><summary>Answers</summary>

1. Synchronous waits for replicas before confirming (no data loss on failover, but higher latency and lower availability if replicas are slow); asynchronous confirms immediately (fast, but recent writes can be lost and replicas lag).
2. Clocks on different machines drift and can jump; a few milliseconds or seconds of skew can reverse the apparent order of events.
3. Carry a per-aggregate version in each event and apply only events newer than the stored version (ignoring older or duplicate ones), or process each order's events in order via Service Bus sessions.
</details>

## Sources
- [DDIA — Replication, Partitioning chapters](https://dataintensive.net/)
- [Leslie Lamport — Time, clocks, and the ordering of events](https://lamport.azurewebsites.net/pubs/time-clocks.pdf)
- [Service Bus message sessions](https://learn.microsoft.com/azure/service-bus-messaging/message-sessions)
- [Azure SQL active geo-replication](https://learn.microsoft.com/azure/azure-sql/database/active-geo-replication-overview)
- [Data partitioning guidance (Azure)](https://learn.microsoft.com/azure/architecture/best-practices/data-partitioning)
