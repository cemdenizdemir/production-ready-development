---
title: Fallacies, partial failure, CAP, PACELC, and consistency models
tech: Azure SQL, Redis 8, Azure Service Bus, C# 14
version: November 2026
date: 2026-11-09
covers: [1, 2, 3]
---
# Fallacies, partial failure, CAP, PACELC, and consistency models
[← Overview](00-overview.md)

## Why it matters
- The API called Stripe with a 10-second timeout. The call timed out after Stripe had charged the card; the API told the customer "payment failed", and they paid again.
- A customer updated their address, was redirected to the order page, and saw the old address: the page read from a replica that was 2 seconds behind.
- The team said "we chose CP" in a design review, but nobody could say what the system did during a network partition or how much latency consistency cost on normal days.

## Concepts

### The fallacies of distributed computing
| Fallacy | Reality | Consequence |
|:--|:--|:--|
| ⭐ the network is reliable | packets drop, connections reset | timeouts, retries, idempotency |
| ⭐ latency is zero | every hop costs ms; tails are long | fewer round trips, batching, caching |
| bandwidth is infinite | payloads cost | lean payloads, compression |
| the network is secure | it isn't | TLS, auth everywhere, private networking |
| topology doesn't change | replicas come and go | service discovery, health checks |
| there is one administrator | many teams, providers | contracts, monitoring |
| transport cost is zero | serialisation, egress | measure |
| the network is homogeneous | many clients and protocols | standards, versioning |

### Partial failure and unknown outcomes
In one process, a call either returns or throws. Across a network there's a third outcome: **unknown** (timeout). The request may have failed, succeeded, or still be running.
| Outcome | Handling |
|:--|:--|
| ⭐ success | proceed |
| ⭐ definite failure (4xx, refused) | handle the error |
| ⭐ unknown (timeout, reset after send) | make the operation idempotent and retry, or query the status (Stripe: retrieve the PaymentIntent) |

### CAP and PACELC
| Theorem | Says |
|:--|:--|
| ⭐ CAP | during a network **P**artition, a system must choose between **C**onsistency (linearizable reads/writes) and **A**vailability (every request gets a non-error answer) |
| ⭐ PACELC | if **P**artitioned, choose **A** or **C**; **E**lse (normal operation), choose **L**atency or **C**onsistency |

| System | Partition (PAC) | Else (ELC) |
|:--|:--|:--|
| single-primary SQL with sync replicas | C (rejects writes without quorum) | C (higher latency) |
| SQL with async geo-replica | C on primary; replica reads may be stale | L for replica reads |
| Redis cache | A (serve stale or miss) | L |
| Service Bus | durable, may delay delivery | L/C trade-off inside the service |

CAP is only about partitions; PACELC reminds you that the everyday trade-off is latency vs consistency.

### Consistency models
| Model | Guarantee | Example |
|:--|:--|:--|
| ⭐ linearizable (strong) | every read sees the latest write, as if one copy | primary database reads in a transaction |
| sequential | all see operations in the same order (not necessarily real-time) | |
| causal | operations that are causally related are seen in order | comment after the post it replies to |
| ⭐ read-your-writes | a client always sees its own writes | after updating an address, the user sees it |
| monotonic reads | a client never sees older data after newer | no jumping back in time between page loads |
| ⭐ eventual | replicas converge if writes stop | search index, read models, caches, replicas |

Choose per use case: checkout needs strong consistency for stock and payment; product listings tolerate eventual consistency.

## In our stack
- Timeouts, retries, idempotency keys: [03-backend/08-reliability](../../../03-backend/08-reliability/README.md), [03-backend/12-integrations lesson 01](../../../03-backend/12-integrations/docs/01-principles-stripe-payments.md).
- Read replicas and read-your-writes routing: [03-backend/09-scalability lesson 04](../../../03-backend/09-scalability/docs/04-database-scaling-reads.md).
- Eventually consistent read models and search: [04-architecture-styles lesson 03](../../04-architecture-styles/docs/03-microservices-events-cqrs.md).

## When not to
- Don't demand strong consistency everywhere; it costs latency and availability. Many reads (catalog, recommendations) are fine stale.
- Don't treat every timeout as a failure; for side-effecting calls, resolve the unknown first.
- Don't quote CAP as a design; describe concrete behaviour during failures and the latency budget normally.

## Example
Resolving an unknown outcome with Stripe:
```csharp
public async Task<PaymentOutcome> ChargeAsync(Order order, CancellationToken ct)
{
    var key = $"pi:{order.Id.Value}:{order.PaymentAttempt}";
    try
    {
        var intent = await intents.CreateAsync(order.ToIntentOptions(), new RequestOptions { IdempotencyKey = key }, ct);
        return PaymentOutcome.From(intent);
    }
    catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or TimeoutRejectedException)
    {
        // unknown: retrying with the SAME idempotency key returns the original result instead of charging twice
        var intent = await intents.CreateAsync(order.ToIntentOptions(), new RequestOptions { IdempotencyKey = key }, CancellationToken.None);
        return PaymentOutcome.From(intent);
    }
}
```
Read-your-writes with a replica: route the user's next reads to the primary for a short time after they write.
```csharp
public sealed class ReadRouting(IHttpContextAccessor http, TimeProvider time)
{
    private const string Cookie = "rw-until";
    public void MarkWrite() =>
        http.HttpContext!.Response.Cookies.Append(Cookie, time.GetUtcNow().AddSeconds(10).ToUnixTimeSeconds().ToString(),
            new CookieOptions { HttpOnly = true, Secure = true, SameSite = SameSiteMode.Lax });

    public bool MustReadPrimary() =>
        long.TryParse(http.HttpContext!.Request.Cookies[Cookie], out var until) && time.GetUtcNow().ToUnixTimeSeconds() < until;
}
// use case: var db = routing.MustReadPrimary() ? primaryDb : replicaDb;
```

## Production patterns
- Every remote call has a timeout and a plan for the unknown outcome: idempotent retry, status query, or reconciliation.
- Consistency chosen per use case and written down: strong for money and stock, read-your-writes for a user's own data, eventual for listings and search.
- Design reviews describe partition behaviour and normal-case latency (PACELC), not just "CP" or "AP".

## Mistakes
Wrong: `catch (TimeoutException) { return PaymentFailed; }` after a charge request.
Right: treat it as unknown; retry with the same idempotency key or check status; reconcile later.

Wrong: reading the user's just-updated profile from a replica.
Right: read-your-writes routing to the primary (or return the updated data from the write).

## Check yourself
1. What are the three possible outcomes of a remote call?
2. What does PACELC add to CAP?
3. Which consistency model does a user expect right after editing their address?

<details><summary>Answers</summary>

1. Success, definite failure, and unknown (timeout or a broken connection after sending), where the operation may or may not have happened.
2. The trade-off during normal operation: without a partition, you still choose between lower latency and stronger consistency (for example sync vs async replication).
3. Read-your-writes: they must see their own change on the next page, even if other users see it a moment later.
</details>

## Sources
- [Fallacies of distributed computing explained (Rotem-Gal-Oz)](https://arnon.me/wp-content/uploads/Files/fallacies.pdf)
- [Eric Brewer — CAP twelve years later](https://www.infoq.com/articles/cap-twelve-years-later-how-the-rules-have-changed/)
- [Daniel Abadi — PACELC](https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf)
- [Jepsen — consistency models](https://jepsen.io/consistency)
- [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
