---
title: Consensus, locks, fencing, and delivery guarantees
tech: Redis 8, SQL Server 2025, Azure Service Bus, C# 14
version: November 2026
date: 2026-11-09
covers: [7, 8]
---
# Consensus, locks, fencing, and delivery guarantees
[← Overview](00-overview.md)

## Why it matters
- Two replicas both ran the nightly payout job. A Redis lock existed, but worker A paused for 40 seconds in a GC, its lock expired, worker B took it, and both paid partners.
- The email worker completed each Service Bus message before sending the email ("at-most-once"). When the provider was down, 1,200 shipping notices were lost.
- A team implemented "exactly-once delivery" with a custom ack protocol. It still produced duplicates under failover; the consumers weren't idempotent.

## Concepts

### Consensus and coordination
| Concept | Meaning | Where you meet it |
|:--|:--|:--|
| ⭐ consensus | nodes agree on a value/order despite failures (majority quorum) | Raft (etcd, Consul), Paxos; inside SQL availability groups, Service Bus, Azure Storage |
| leader election | one node acts as leader at a time | Kubernetes/KEDA leases, job schedulers |
| ⭐ distributed lock | one holder of a named resource at a time | Redis `SET NX PX`, SQL `sp_getapplock`, Azure Blob leases, Hangfire `DisableConcurrentExecution` |
| ⭐ lease | a lock with an expiry; must be renewed | Blob leases, Redis TTL |
| ⭐ fencing token | an increasing number issued with each lock; the resource rejects older tokens | protects against paused/expired holders |

You rarely implement consensus yourself; use systems that do (SQL, Service Bus, etcd). But **locks with expiry aren't safe alone**: a holder can pause (GC, VM migration) past expiry and keep acting. Fencing tokens close that gap.

| Lock option | Safety | Use |
|:--|:--|:--|
| SQL `sp_getapplock` (session-scoped) | strong while the connection lives | jobs that write to the same SQL database |
| Redis `SET key token NX PX ttl` | efficiency (avoid duplicate work), not correctness | dedupe expensive work |
| Blob lease | strong-ish, 15–60 s or infinite | leader election for a worker |
| Hangfire `DisableConcurrentExecution` | SQL-based distributed lock | one job type at a time |
| ⭐ + fencing token | correctness when the resource checks it | payouts, inventory |

### Delivery guarantees
| Guarantee | How | Risk |
|:--|:--|:--|
| at-most-once | ack before processing (Service Bus receive-and-delete) | ⭐ lost messages |
| ⭐ at-least-once | process, then ack (peek-lock, complete after success) | duplicates |
| exactly-once delivery | not achievable end to end over unreliable networks | — |
| ⭐ effectively-once processing | at-least-once delivery + idempotent consumer (dedupe, idempotent writes) | the practical goal |

| Idempotent consumer technique | Example |
|:--|:--|
| ⭐ inbox / processed-messages table | unique `(MessageId, Handler)` in the same transaction as the effect |
| ⭐ natural idempotency | `SET status = 'Shipped' WHERE status = 'Paid'`; upserts |
| idempotency keys downstream | Stripe `IdempotencyKey`, ACS message ID |
| broker duplicate detection | Service Bus `MessageId` within a window (helps, not sufficient) |
| version checks | apply only newer versions (lesson 02) |

## In our stack
- Outbox + inbox, peek-lock with explicit complete, DLQ: [03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md).
- Hangfire `DisableConcurrentExecution` and job idempotency: [03-backend/07-background-jobs lesson 03](../../../03-backend/07-background-jobs/docs/03-idempotency-concurrency-failures.md).
- Redis in the stack: [03-backend/06-caching](../../../03-backend/06-caching/README.md).

## When not to
- Don't add distributed locks where idempotency or a unique constraint would do; locks add failure modes.
- Don't implement Redlock or your own consensus for business correctness; use the database (constraints, transactions, `sp_getapplock`) or fencing.
- Don't chase exactly-once delivery; make consumers idempotent.

## Example
SQL application lock for a job that must not run twice concurrently:
```csharp
public static async Task<bool> TryRunExclusiveAsync(SqlConnection conn, string resource, Func<Task> work, CancellationToken ct)
{
    await using var cmd = new SqlCommand("DECLARE @r int; EXEC @r = sp_getapplock @Resource, 'Exclusive', 'Session', 0; SELECT @r;", conn);
    cmd.Parameters.AddWithValue("@Resource", resource);
    var result = (int)(await cmd.ExecuteScalarAsync(ct))!;
    if (result < 0) return false;                                   // someone else holds it
    try { await work(); return true; }
    finally
    {
        await using var release = new SqlCommand("EXEC sp_releaseapplock @Resource, 'Session';", conn);
        release.Parameters.AddWithValue("@Resource", resource);
        await release.ExecuteNonQueryAsync(CancellationToken.None);
    }
}
```
Fencing token: the resource rejects stale lock holders
```csharp
// Lock service hands out increasing tokens (e.g. a SQL sequence) with each acquisition
public sealed record LockGrant(string Resource, long FencingToken, DateTimeOffset ExpiresAt);

// The protected resource stores the highest token it has seen and rejects lower ones
await db.Database.ExecuteSqlAsync($"""
    UPDATE payouts.PayoutRuns
    SET Status = 'Running', FencingToken = {grant.FencingToken}
    WHERE RunDate = {runDate} AND (FencingToken IS NULL OR FencingToken < {grant.FencingToken})
    """, ct);
// a paused worker with an older token can no longer change the run
```
Effectively-once consumer (inbox in the same transaction as the effect):
```csharp
internal sealed class ShipOrderHandler(OrderingDb db) : IIntegrationEventHandler<PaymentSucceededV1>
{
    public async Task HandleAsync(PaymentSucceededV1 e, Guid messageId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        db.Inbox.Add(new InboxRow(messageId, nameof(ShipOrderHandler)));                   // unique (MessageId, Handler)
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation()) { return; }               // duplicate: already done

        await db.Orders.Where(o => o.Number == e.OrderNumber && o.Status == OrderStatus.Placed)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OrderStatus.Paid), ct);    // naturally idempotent too
        await tx.CommitAsync(ct);
    }
}
```
When `EnableRetryOnFailure` is on, wrap the transaction in `db.Database.CreateExecutionStrategy().ExecuteAsync(...)`.

## Production patterns
- Coordination comes from systems with consensus built in (SQL, Service Bus, Blob leases); app-level locks are SQL application locks or leases, plus fencing tokens where correctness matters.
- All messaging is at-least-once with peek-lock; every consumer is idempotent (inbox, natural idempotency, downstream idempotency keys).
- Broker duplicate detection is enabled as a first filter, never as the only defence.

## Mistakes
Wrong: `AutoCompleteMessages = true` with failures swallowed (at-most-once in practice).
Right: complete only after the work commits; let failures retry and dead-letter.

Wrong: a Redis lock with a 30-second TTL guarding payouts, no fencing.
Right: a SQL app lock or a fencing token checked by the payout table, plus idempotency keys at Stripe.

## Check yourself
1. Why isn't a lock with an expiry enough to guarantee mutual exclusion?
2. What's the difference between at-least-once delivery and effectively-once processing?
3. Name two ways to make a consumer idempotent.

<details><summary>Answers</summary>

1. The holder can pause (GC, network, VM freeze) beyond the expiry; another process takes the lock while the first still believes it holds it, and both act. A fencing token checked by the resource rejects the stale holder.
2. At-least-once is a delivery guarantee (messages may repeat); effectively-once is the result you get by making processing idempotent so repeats have no additional effect.
3. Any two of: an inbox/processed-messages table with a unique key in the same transaction; naturally idempotent writes (conditional updates, upserts); idempotency keys for downstream calls; version checks that ignore older events.
</details>

## Sources
- [Martin Kleppmann — How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
- [Raft consensus](https://raft.github.io/)
- [sp_getapplock](https://learn.microsoft.com/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql)
- [Service Bus receive modes and settlement](https://learn.microsoft.com/azure/service-bus-messaging/message-transfers-locks-settlement)
- [Idempotent consumer (microservices.io)](https://microservices.io/patterns/communication-style/idempotent-consumer.html)
- [Leader election pattern (Azure)](https://learn.microsoft.com/azure/architecture/patterns/leader-election)
