---
title: Queues, capacity planning, payloads, and batching
tech: Azure Service Bus, Hangfire, ASP.NET Core 10, EF Core 10
version: .NET 10, EF Core 10
date: 2026-11-09
covers: [10, 11, 12]
---
# Queues, capacity planning, payloads, and batching
[← Overview](00-overview.md)

## Why it matters
- A marketing email to 200,000 customers sends a spike of clicks and orders. Generating invoice PDFs inside the order request pushes checkout p99 to 12 s. Moving PDFs to a queue keeps checkout at 400 ms.
- The team sized for "average load", running at 85% CPU. A normal Monday peak tipped it into queueing, and latency went up 10× from a 15% traffic rise.
- `GET /orders` returned full order graphs: 2 MB per page and 40 columns nobody used. Mobile users waited 6 s.

## Concepts

### Queues for throughput
| Benefit | How |
|:--|:--|
| ⭐ absorb spikes | the queue grows; workers drain it at a steady rate |
| ⭐ fast responses | accept (202 or "order received"), do the slow part later |
| independent scaling | workers scale on queue length, separately from the API |
| smooth load on dependencies | fixed worker concurrency protects SQL and partners |
| retries without users waiting | failed work retries in the background |

Good candidates: emails, PDFs, image resizing, exports, webhooks out, search indexing, analytics. Bad candidates: anything the user needs right now to continue (price, stock check, payment confirmation).

### Capacity planning
**Little's law:** `concurrency = throughput × latency` (L = λW).
| Example | Result |
|:--|:--|
| 400 req/s × 0.15 s average | 60 requests in flight |
| 400 req/s × 1.5 s (dependency slow) | 600 in flight: limits and pools must cover it, or shed |
| worker: 50 jobs/s needed × 0.4 s per job | 20 concurrent workers |

| Rule | Why |
|:--|:--|
| ⭐ headroom | plan peak at ≤ 60–70% utilisation; latency rises steeply above ~80% |
| ⭐ shared limits | the database, Redis, partner rate limits, and SNAT ports don't scale with your replicas |
| N+1 for failure | survive losing one replica or zone at peak |
| growth | revisit quarterly with real traffic and business forecasts |
| measure capacity | breakpoint load test per replica (lesson 01) |

### Payloads and batching
| Technique | .NET |
|:--|:--|
| ⭐ pagination | keyset pagination, max page size (02-api-design) |
| ⭐ lean DTOs | EF Core projections: `.Select(o => new OrderSummary(...))` |
| ⭐ compression | Front Door compression, or `AddResponseCompression()` with Brotli/Gzip (watch BREACH with secrets in responses) |
| sparse fields / expansion | `?fields=` or separate detail endpoints |
| bulk endpoints | `POST /cart/items:batch` with a size limit, per-item results |
| streaming | return `IAsyncEnumerable<T>` from Minimal APIs (streamed JSON array); `Results.Stream` for files |
| bulk writes | `ExecuteUpdateAsync` / `ExecuteDeleteAsync`, `AddRange` (EF batches statements), `SqlBulkCopy` for imports |
| HTTP/2 and HTTP/3 | multiplexing at Front Door and Kestrel |

## Example
`src/Shop.Api/Orders/OrderEndpoints.cs` (accept fast, process later)
```csharp
app.MapPost("/orders", async (PlaceOrder cmd, OrderService orders, IBackgroundJobClient jobs, CancellationToken ct) =>
{
    var order = await orders.PlaceAsync(cmd, ct);                                        // fast: validate, reserve, save
    jobs.Enqueue<InvoiceJobs>(x => x.GeneratePdfAsync(order.Id, CancellationToken.None)); // slow: later
    return TypedResults.Created($"/orders/{order.Id}", new { order.Id, order.Status });
});
```
In production, enqueue through the outbox (07-background-jobs) so the job and the order commit together.

Lean, paged, streamed reads:
```csharp
app.MapGet("/orders", (ShopReadDb db, ClaimsPrincipal user, long? after, int pageSize = 20) =>
{
    pageSize = Math.Clamp(pageSize, 1, 100);
    var userId = user.GetUserId();
    return db.Orders
        .Where(o => o.CustomerId == userId && (after == null || o.Number < after))
        .OrderByDescending(o => o.Number)
        .Take(pageSize)
        .Select(o => new OrderSummary(o.Number, o.PlacedAt, o.Status, o.TotalMinor, o.Lines.Count))
        .AsAsyncEnumerable();                         // streamed JSON array, no full buffering
});

app.MapGet("/admin/exports/orders.csv", (ShopReadDb db, CancellationToken ct) =>
    Results.Stream(async stream => await OrderCsv.WriteAsync(db, stream, ct), "text/csv"))
   .RequireAuthorization(Policies.AdminOnly);
```

Bulk update in one statement:
```csharp
await db.Carts.Where(c => c.UpdatedAt < cutoff)
    .ExecuteDeleteAsync(ct);                          // one DELETE, no entities loaded
```

Capacity worksheet (keep it in the repo, `docs/capacity.md`):
| Item | Value |
|:--|:--|
| peak requests/s (last Black Friday × growth) | 900 |
| p95 latency target | 300 ms |
| tested capacity per replica at p95 target | 150 req/s |
| replicas needed at 65% utilisation | 900 ÷ (150 × 0.65) ≈ 10 |
| SQL connections at 10 replicas × 60 | 600 (tier limit 1,600) |

## Production patterns
- Slow, non-interactive work leaves the request path through durable queues; workers scale on queue length with capped concurrency.
- A capacity worksheet per service, updated from breakpoint tests and real peaks, with shared limits listed explicitly.
- Every list endpoint is paginated with a maximum page size and projects into DTOs; large exports stream.
- Compression at the edge; bulk endpoints with size limits; bulk SQL operations instead of loops over entities.

## Mistakes
Wrong:
```csharp
var orders = await db.Orders.Include(o => o.Lines).ThenInclude(l => l.Product).ToListAsync(ct);   // all rows, all columns
return orders;
```
Right: filter, paginate, `Select` into a DTO, and stream large results.

Wrong: sizing for average traffic at 85% utilisation.
Right: size for peak at 60–70%, plus one replica's worth of failure headroom.

## Check yourself
1. Using Little's law: 300 req/s at 200 ms average. How many requests are in flight?
2. Which work should move to a queue, and which shouldn't?
3. What does `AsAsyncEnumerable()` change for a large response?

<details><summary>Answers</summary>

1. 300 × 0.2 = 60 concurrent requests.
2. Work the user doesn't need to continue right now (emails, PDFs, exports, indexing, webhooks). Not work whose result the user needs immediately (prices, stock checks, payment results).
3. Rows are serialised to the response as they're read, instead of loading the whole list into memory first. Memory stays flat and the first bytes arrive sooner.
</details>

## Sources
- [Queue-Based Load Leveling pattern](https://learn.microsoft.com/azure/architecture/patterns/queue-based-load-leveling)
- [Little's law (Wikipedia)](https://en.wikipedia.org/wiki/Little%27s_law)
- [Response compression in ASP.NET Core](https://learn.microsoft.com/aspnet/core/performance/response-compression)
- [ExecuteUpdate and ExecuteDelete (EF Core)](https://learn.microsoft.com/ef/core/saving/execute-insert-update-delete)
- [Minimal API responses](https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/responses)
- [Performance efficiency checklist (Azure Well-Architected)](https://learn.microsoft.com/azure/well-architected/performance-efficiency/checklist)
