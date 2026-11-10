---
title: Building blocks and data storage choices
tech: Azure Front Door, Container Apps, Azure SQL, Azure Managed Redis, Service Bus, Blob Storage, Azure AI Search, Cosmos DB
version: November 2026
date: 2026-11-09
covers: [3, 4]
---
# Building blocks and data storage choices
[← Overview](00-overview.md)

## Why it matters
- Product search used `LIKE '%term%'` on Azure SQL. With 200,000 products, every search scanned the table; at peak, search took the database down for everyone.
- Shipment tracking events (millions per day) went into the orders database. It grew 10× in a year and backups took hours.
- A "NoSQL because it scales" decision put orders in a document store without transactions; a partial failure left orders without payments and no simple way to find them.

## Concepts

### Building blocks
| Block | Purpose | Azure option |
|:--|:--|:--|
| ⭐ DNS + CDN | route users, cache static and cacheable content at the edge | Azure DNS, Front Door |
| ⭐ load balancer | spread traffic across replicas, health checks | Front Door, Container Apps ingress, Application Gateway |
| ⭐ API gateway | single entry, auth, rate limits, routing | Front Door + API Management / YARP |
| ⭐ stateless app tier | business logic, scale horizontally | Container Apps |
| ⭐ cache | fast reads of hot data | Azure Managed Redis (+ HybridCache L1) |
| ⭐ queue / topic | decouple, absorb spikes, async work | Service Bus |
| stream | high-volume ordered event logs, replay | Event Hubs (Kafka-compatible) |
| ⭐ object storage | files, images, exports, backups | Blob Storage |
| ⭐ search index | full-text, facets, relevance, autocomplete | Azure AI Search |
| relational DB | transactions, constraints, flexible queries | Azure SQL |
| scheduler / workers | background and periodic work | Container Apps jobs, Hangfire |
| identity | sign-in, tokens | Entra ID / ASP.NET Core Identity |
| observability | logs, metrics, traces | Azure Monitor, Application Insights |

### Data storage choices
| Store type | Strengths | Weaknesses | Use for | Azure |
|:--|:--|:--|:--|:--|
| ⭐ relational | ACID transactions, joins, constraints, flexible queries | scaling writes beyond one node needs work | orders, payments, inventory, users | Azure SQL / SQL Server 2025 |
| document | flexible schema, item-level scale, JSON | weaker joins and multi-item transactions (per partition) | catalogs with varied attributes, user profiles | Cosmos DB (NoSQL API); SQL Server 2025 `json` type |
| ⭐ key-value | very fast get/set by key | no queries beyond the key | cache, sessions, counters, rate limits | Managed Redis |
| wide-column | huge write throughput, partitioned by key | limited queries, modelling by query | telemetry at massive scale | Cosmos DB (Cassandra API) |
| ⭐ search | text relevance, facets, fuzzy, autocomplete | eventual consistency with the source | product search | Azure AI Search |
| time-series | append-heavy, time-bucketed queries, downsampling | specialised | metrics, IoT, tracking events | Azure Data Explorer, Log Analytics |
| ⭐ object | cheap, durable, huge files | no queries inside objects | images, PDFs, exports | Blob Storage |
| vector | similarity search | approximate | semantic search, recommendations | SQL Server 2025 `vector` type, Azure AI Search |

**Default:** a relational database for the system of record; add specialised stores for clear access patterns (search, cache, files, events) and keep them in sync from the source (events/outbox, change tracking).

## In our stack
- Azure SQL as the system of record: [03-backend/03-databases](../../../03-backend/03-databases/README.md).
- Redis for cache and rate limits: [03-backend/06-caching](../../../03-backend/06-caching/README.md), [03-backend/05-validation-abuse](../../../03-backend/05-validation-abuse/README.md).
- Blob Storage for files: [03-backend/12-integrations lesson 04](../../../03-backend/12-integrations/docs/04-blob-uploads-serving-security.md).
- Service Bus for async work: [03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md).
- Front Door and Container Apps: [04-shipping/02-cloud](../../../04-shipping/02-cloud/README.md).

## When not to
- Don't add a second database technology without a concrete access pattern the first can't serve; every store is more to operate, secure, back up, and keep consistent.
- Don't use a cache as the source of truth.
- Don't use a search index for exact business queries (order lookups); it's eventually consistent.

## Example
Matching access patterns to stores for the shop:
```text
Place order, pay, reserve stock          → Azure SQL (transactions, constraints)
Product page, category listings (hot)    → Azure SQL + HybridCache/Redis + Front Door caching
Product search with facets, typo-tolerance → Azure AI Search, fed by ProductChanged events
Product images, invoices                  → Blob Storage (+ Front Door for public images)
Order notifications                       → Service Bus queue → worker
Rate limits, carts of anonymous users     → Redis (TTL)
Shipment tracking events (high volume)    → Event Hubs → Azure Data Explorer (or a separate SQL DB with retention)
"Similar coffees" recommendations         → SQL Server 2025 vector column or AI Search vector index
```
Keeping the search index in sync from the source of truth:
```csharp
internal sealed class SyncSearchIndex(SearchClient search) : IIntegrationEventHandler<ProductChangedV1>
{
    public async Task HandleAsync(ProductChangedV1 e, Guid messageId, CancellationToken ct)
    {
        if (!e.Active) { await search.DeleteDocumentsAsync("sku", [e.Sku], cancellationToken: ct); return; }
        await search.MergeOrUploadDocumentsAsync([new ProductDocument(e.Sku, e.Name, e.RoastLevel, e.Tags)], cancellationToken: ct);
    }
}
public sealed record ProductDocument(string Sku, string Name, string RoastLevel, IReadOnlyList<string> Tags);
```

## Production patterns
- One relational system of record; specialised stores added per access pattern and fed from it (events, outbox).
- Hot reads served from CDN and caches; files in object storage; text search in a search engine.
- Each added store has an owner, backups/retention, monitoring, and a documented sync path.

## Mistakes
Wrong: `WHERE Name LIKE '%' + @term + '%'` for customer-facing search.
Right: Azure AI Search (or SQL full-text for small scale), synced from the catalog.

Wrong: "Let's use a document database because it scales" for orders and payments.
Right: relational with transactions; scale reads with caches and replicas first (03-backend/09-scalability).

## Check yourself
1. Why is a relational database the default system of record?
2. When does a search index earn its place?
3. What must you plan whenever you add a second store for the same data?

<details><summary>Answers</summary>

1. It gives transactions, constraints, and flexible queries, which protect correctness for money, orders, and inventory, and it scales far enough for most systems with caching and replicas.
2. When users need relevance-ranked full-text search, typo tolerance, facets, or autocomplete over large data, which relational `LIKE` queries can't do efficiently.
3. How it stays in sync with the source (events/outbox, rebuilds), how stale it may be, who owns and operates it, and its backup, security, and cost.
</details>

## Sources
- [Choose a data store (Azure)](https://learn.microsoft.com/azure/architecture/guide/technology-choices/data-store-overview)
- [Azure AI Search](https://learn.microsoft.com/azure/search/search-what-is-azure-search)
- [Azure Cosmos DB](https://learn.microsoft.com/azure/cosmos-db/introduction)
- [SQL Server 2025 vector data type](https://learn.microsoft.com/sql/t-sql/data-types/vector-data-type)
- [Designing Data-Intensive Applications](https://dataintensive.net/)
