---
title: Idempotent jobs, concurrency, priorities, and failures
tech: Hangfire, SQL Server 2025, Polly
version: Hangfire 1.8.x
date: 2026-11-09
covers: [5, 7, 9]
---
# Idempotent jobs, concurrency, priorities, and failures
[← Overview](00-overview.md)

## Why it matters
- A worker sends the shipping email, then crashes before marking the job done; the job runs again and the customer gets two emails. With payouts instead of emails, a partner gets paid twice.
- 40 workers call a partner API that allows 10 requests per second; the partner blocks the shop's API key.
- 2,000 failed jobs sit in the dashboard for weeks; nobody noticed because nothing alerted.

## Concepts

### Idempotency: the exactly-once illusion
Durable queues deliver **at least once**: crashes, timeouts, and retries mean a job can run more than once. Exactly-once delivery doesn't exist; **effectively-once processing** does, by making handlers idempotent.
| Technique | Example |
|:--|:--|
| ⭐ check state before acting | `if (order.ConfirmationSentAt is not null) return;` |
| ⭐ unique constraints | `ProcessedMessages(MessageId)` / `Payouts(OrderId)` unique → second insert fails |
| conditional updates | `UPDATE … SET Status = 'Shipped' WHERE Id = @id AND Status = 'Paid'` |
| idempotency keys to providers | Stripe `IdempotencyKey = $"refund:{refundId}"` |
| deterministic IDs | outbox message ID reused as Service Bus `MessageId` (duplicate detection) |
| record then act vs act then record | for external side effects, use the provider's idempotency key so retries are safe either way |

### Concurrency, rate limits, priorities
| Need | Hangfire | Elsewhere |
|:--|:--|:--|
| ⭐ priorities | queues in `Queues = ["critical", "default", "low"]` order; `[Queue("critical")]` | Service Bus: separate queues/subscriptions |
| limit total concurrency | `WorkerCount`; a dedicated server with its own queue and small worker count | `MaxConcurrentCalls` |
| one at a time per job type | `[DisableConcurrentExecution(timeoutInSeconds)]` (distributed lock) | sessions |
| one at a time per entity | lock on a key (`SELECT … WITH (UPDLOCK)`), or Service Bus sessions keyed by entity | |
| rate limit outgoing calls | `System.Threading.RateLimiting` limiter shared by workers (or Redis for all instances) | |
| backpressure | let the queue grow; scale workers by queue depth | KEDA scale rules in Container Apps |

### Failed jobs
| Practice | How |
|:--|:--|
| ⭐ classify errors | transient (retry), permanent (fail fast), poison (bad data) |
| dead-letter / failed state | Hangfire Failed list; Service Bus dead-letter queue |
| ⭐ alert | failed count > 0 for critical queues, failure rate, oldest failed age |
| replay | Hangfire dashboard "Requeue"; Service Bus DLQ resubmit tool after fixing the cause |
| context | log job ID, arguments (no secrets), attempt number, trace ID |
| cleanup | Hangfire expires succeeded jobs (default 24 h) and keeps failed ones until handled |

Never replay blindly: fix the cause, check idempotency, then requeue.

## Example
`src/Shop.Application/Payouts/PartnerPayoutJob.cs`
```csharp
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Stripe;

public sealed class PartnerPayoutJob(ShopDb db, TransferService transfers, ILogger<PartnerPayoutJob> log)
{
    [Queue("critical")]
    [AutomaticRetry(Attempts = 5)]
    [DisableConcurrentExecution(timeoutInSeconds: 300)]          // one payout run at a time
    public async Task PayAsync(long payoutId, CancellationToken ct)
    {
        var payout = await db.Payouts.SingleOrDefaultAsync(p => p.Id == payoutId, ct);
        if (payout is null || payout.Status == PayoutStatus.Paid) return;            // already done → idempotent

        try
        {
            var transfer = await transfers.CreateAsync(new TransferCreateOptions
            {
                Amount = payout.AmountMinor, Currency = payout.Currency, Destination = payout.StripeAccountId,
            }, new RequestOptions { IdempotencyKey = $"payout:{payout.Id}" }, ct);    // retries can't double-pay

            payout.MarkPaid(transfer.Id);
            await db.SaveChangesAsync(ct);
        }
        catch (StripeException ex) when (ex.HttpStatusCode is System.Net.HttpStatusCode.BadRequest)
        {
            payout.MarkFailed(ex.StripeError?.Code ?? "invalid_request");            // permanent: don't retry
            await db.SaveChangesAsync(ct);
            log.LogError(ex, "Payout {PayoutId} rejected by Stripe", payoutId);
        }
    }
}
```
Shared outgoing rate limit for a partner API:
```csharp
builder.Services.AddSingleton(_ => new TokenBucketRateLimiter(new TokenBucketRateLimiterOptions
{
    TokenLimit = 10, TokensPerPeriod = 10, ReplenishmentPeriod = TimeSpan.FromSeconds(1), QueueLimit = 1000,
}));
// in the job: using var lease = await limiter.AcquireAsync(1, ct); if (!lease.IsAcquired) throw new TimeoutException();
```
Unique-constraint idempotency for message handlers:
```csharp
db.ProcessedMessages.Add(new ProcessedMessage(messageId, handler: nameof(SendShippingEmail)));
await db.SaveChangesAsync(ct);   // UNIQUE (MessageId, Handler): a duplicate throws → skip
```

## Production patterns
- Every job and message handler is idempotent; external side effects use provider idempotency keys.
- Priorities via queues; heavy or rate-limited work in dedicated queues/servers with small concurrency.
- Alerts on failed critical jobs, DLQ messages, and failure rate; a runbook for replays.
- Error classification in code: transient → retry, permanent → fail and record, poison → dead-letter with context.

## Mistakes
Wrong: assuming a job runs once.
Right: design for at-least-once; check state and use unique constraints.

Wrong: unlimited workers hitting a rate-limited partner.
Right: a shared limiter and a dedicated queue with fixed concurrency.

## Check yourself
1. Why can't a queue guarantee exactly-once delivery?
2. How does Stripe's idempotency key protect a payout job?
3. What should happen before requeueing failed jobs?

<details><summary>Answers</summary>

1. A worker can finish the work and crash (or time out) before acknowledging; the queue can't know, so it redelivers.
2. Stripe returns the original result for a repeated request with the same key instead of creating a second transfer.
3. Find and fix the cause, confirm the handlers are idempotent, and make sure replaying won't cause harm (e.g. duplicate emails), then requeue.
</details>

## Sources
- [Hangfire — Best practices](https://docs.hangfire.io/en/latest/best-practices.html)
- [Hangfire — Configuring job queues](https://docs.hangfire.io/en/latest/background-processing/configuring-queues.html)
- [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Idempotent message processing (Azure Architecture)](https://learn.microsoft.com/azure/architecture/reference-architectures/containers/aks-mission-critical/mission-critical-data-platform#idempotent-message-processing)
- [Service Bus dead-letter queues](https://learn.microsoft.com/azure/service-bus-messaging/service-bus-dead-letter-queues)
