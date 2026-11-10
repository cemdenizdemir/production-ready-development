---
title: Stateless scaling, load balancing, and real-time connections
tech: Azure Container Apps, YARP, Azure Front Door, Application Gateway, SignalR, Azure SignalR Service
version: YARP 2.x, ASP.NET Core 10 SignalR, Microsoft.Azure.SignalR 1.x
date: 2026-11-09
covers: [4, 5, 13]
---
# Stateless scaling, load balancing, and real-time connections
[← Overview](00-overview.md)

## Why it matters
- The cart was kept in server memory. When Container Apps scaled from 2 to 6 replicas, users bounced between replicas and their carts appeared and disappeared.
- Data Protection keys lived inside each container. After a scale-out, auth cookies issued by one replica failed on the others, and users were logged out at random.
- Order-status notifications over SignalR worked with one replica. With three, a user connected to replica A never received events raised on replica B.

## Concepts

### Stateless services
A replica must be disposable: any request can go to any replica, and killing one loses nothing.
| State | Where it goes |
|:--|:--|
| ⭐ sessions, carts | SQL (or Redis with persistence), keyed by user or cart ID |
| ⭐ Data Protection keys (cookies, antiforgery) | shared store: `PersistKeysToAzureBlobStorage(...)` + `ProtectKeysWithAzureKeyVault(...)` |
| caches | HybridCache L2 in Redis (L1 per replica is fine with short TTLs) |
| uploaded files | Blob Storage, never the container disk |
| background work | Hangfire or Service Bus, not in-memory queues |
| rate limit counters | per replica (accept) or Redis (exact) |
| SignalR connections | backplane or Azure SignalR Service |

### Autoscaling on Azure Container Apps
| Rule | Scales on | Use |
|:--|:--|:--|
| ⭐ HTTP | concurrent requests per replica (default 10) | the API |
| CPU / memory | utilisation % | CPU-heavy work |
| ⭐ Azure Service Bus | messages per replica | workers |
| custom KEDA scalers | Redis lists, SQL queries, cron | special cases |

| Setting | Note |
|:--|:--|
| `minReplicas` | ≥ 2 for the API in production (no cold start, survives a restart); 0 allowed for workers and dev |
| `maxReplicas` | cap cost and protect the database (connections!) |
| cooldown and polling | KEDA defaults: polling 30 s, cooldown 300 s |
| workload profiles | Consumption (serverless) or Dedicated (fixed machines) |

Scaling is slower than a spike: new replicas need image pull, start-up, and warm-up. Keep headroom (lesson 05) and shed load (08-reliability).

### Load balancing and traffic management
| Layer | Azure service | Does |
|:--|:--|:--|
| ⭐ global edge | Azure Front Door | anycast entry, CDN caching, WAF, TLS, routing to regions/origins, health probes |
| regional L7 | Application Gateway (+ WAF) | path routing, TLS inside a VNet |
| regional L4 | Azure Load Balancer | TCP/UDP |
| DNS | Traffic Manager | DNS-based failover between regions |
| app ingress | Container Apps ingress (Envoy) | spreads requests over replicas and revisions |
| ⭐ in-app proxy / gateway | YARP | reverse proxy in .NET: BFF, API gateway, strangler fig |

| Algorithm | Behaviour |
|:--|:--|
| round robin | simple, even when requests cost about the same |
| least requests | better when request costs vary |
| power of two choices | pick two at random, use the less loaded (YARP default) |
| hash / sticky | same client → same backend |

**Sticky sessions** (session affinity, supported in Container Apps ingress) are a crutch: they hide in-memory state and spread load unevenly. Use them only for things that must stay connected, such as SignalR without a service.

### Scaling real-time connections
| Option | How | Trade-off |
|:--|:--|:--|
| one replica | nothing to do | doesn't scale, no redundancy |
| SignalR + Redis backplane | `AddSignalR().AddStackExchangeRedis(cs)`; messages fan out through Redis pub/sub | needs sticky sessions (unless WebSockets-only with `SkipNegotiation`); Redis is in the path |
| ⭐ Azure SignalR Service | `AddSignalR().AddAzureSignalR()`; the service holds client connections | no sticky sessions, scales to many connections; costs per unit |

## Example
`src/Shop.Api/Program.cs` (stateless essentials)
```csharp
using Azure.Identity;
using Microsoft.AspNetCore.DataProtection;

var credential = new DefaultAzureCredential();
builder.Services.AddDataProtection()
    .SetApplicationName("shop")
    .PersistKeysToAzureBlobStorage(new Uri(builder.Configuration["DataProtection:BlobUri"]!), credential)
    .ProtectKeysWithAzureKeyVault(new Uri(builder.Configuration["DataProtection:KeyUri"]!), credential);

builder.Services.AddSignalR().AddAzureSignalR(builder.Configuration["SignalR:ConnectionString"]);
```
Packages: `Azure.Extensions.AspNetCore.DataProtection.Blobs`, `Azure.Extensions.AspNetCore.DataProtection.Keys`, `Microsoft.Azure.SignalR`.

`infra/modules/api.bicep` (scale rules, excerpt)
```bicep
scale: {
  minReplicas: 2
  maxReplicas: 12
  rules: [
    { name: 'http', http: { metadata: { concurrentRequests: '50' } } }
  ]
}
```
Set `concurrentRequests` from a load test: the concurrency one replica handles at your p95 target.

YARP as a gateway in front of the monolith and a new service (strangler fig, 11-architecture):
```csharp
builder.Services.AddReverseProxy().LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));
app.MapReverseProxy();
```
```json
"ReverseProxy": {
  "Routes": { "search": { "ClusterId": "search", "Match": { "Path": "/api/search/{**rest}" } } },
  "Clusters": { "search": { "LoadBalancingPolicy": "PowerOfTwoChoices",
    "Destinations": { "a": { "Address": "http://search-a:8080" }, "b": { "Address": "http://search-b:8080" } } } }
}
```

## Production patterns
- Replicas are cattle: no local state, shared Data Protection keys, files in Blob Storage, work in durable queues.
- API: HTTP scale rule with a tested concurrency target, `minReplicas` ≥ 2, `maxReplicas` set from the database's connection budget. Workers: scale on queue length, minimum 0–1.
- Front Door at the edge for TLS, WAF, CDN, and failover. Container Apps ingress inside. YARP only when you need .NET logic in the proxy.
- Azure SignalR Service for real time in production, the Redis backplane only when you must self-host.

## Mistakes
Wrong:
```csharp
static readonly ConcurrentDictionary<Guid, Cart> Carts = new();   // lost on restart, split across replicas
```
Right: carts in SQL (or Redis), loaded per request.

Wrong: scaling the API to 50 replicas × `Max Pool Size=100` against a database that allows a few hundred sessions.
Right: `maxReplicas` × pool size within the database's limits (lesson 04).

## Check yourself
1. What three things must move out of process memory before you scale out?
2. Why are sticky sessions a last resort?
3. Why does SignalR need a backplane or Azure SignalR Service with several replicas?

<details><summary>Answers</summary>

1. User state (sessions, carts), Data Protection keys, and background work (plus files and SignalR connections).
2. They hide state problems, spread load unevenly (heavy users stick to one replica), and break when a replica restarts or scales in.
3. Each client connects to one replica. A message raised on another replica must reach it, so replicas need a shared channel (Redis) or a service that holds all connections.
</details>

## Sources
- [Scaling in Azure Container Apps](https://learn.microsoft.com/azure/container-apps/scale-app)
- [Configure ASP.NET Core Data Protection](https://learn.microsoft.com/aspnet/core/security/data-protection/configuration/overview)
- [YARP overview](https://learn.microsoft.com/aspnet/core/fundamentals/servers/yarp/yarp-overview)
- [Load balancing options in Azure](https://learn.microsoft.com/azure/architecture/guide/technology-choices/load-balancing-overview)
- [SignalR scale-out (Redis backplane)](https://learn.microsoft.com/aspnet/core/signalr/redis-backplane)
- [Azure SignalR Service with ASP.NET Core](https://learn.microsoft.com/azure/azure-signalr/signalr-quickstart-dotnet-core)
