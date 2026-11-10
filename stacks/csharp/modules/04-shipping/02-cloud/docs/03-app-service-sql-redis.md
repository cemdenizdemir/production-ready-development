---
title: App Service, Azure SQL, and Azure Managed Redis
tech: Azure App Service, Azure SQL Database, Azure Managed Redis
version: Azure (November 2026), Microsoft.Azure.StackExchangeRedis 3.x
date: 2026-11-09
covers: [5, 6, 7]
---
# App Service, Azure SQL, and Azure Managed Redis
[← Overview](00-overview.md)

## Why it matters
- The team picked a 4-vCore Business Critical database "to be safe" for an MVP with 50 users a day. It cost more than everything else combined.
- A serverless database auto-paused overnight. The first checkout of the morning waited 40 seconds while it resumed, and the payment session expired.
- A new Azure Cache for Redis instance was planned for launch. Creation was blocked for new customers, and the migration to Azure Managed Redis happened in launch week.

## Concepts

### App Service vs Container Apps
| | App Service | Container Apps |
|:--|:--|:--|
| unit | web app on an App Service plan (fixed VMs you pay for) | container app in an environment (per-second or dedicated) |
| deploy | code (zip) or a container | containers only |
| ⭐ deployment slots | yes (Standard+): staging slot, warm-up, swap | revisions and traffic splitting |
| scale to zero | no | yes |
| background work | WebJobs | jobs, KEDA event scaling |
| built-in auth | Easy Auth | Easy Auth too |
| best for | one or a few .NET web apps, teams wanting the simplest PaaS | several services, workers, jobs, scale-to-zero, sidecars |

The shop uses Container Apps (API, web, workers, jobs in one environment). App Service would be a fine choice for a single web app with slots.

### Azure SQL Database in production
| Model | Tiers | Use |
|:--|:--|:--|
| DTU | Basic, Standard, Premium | simple bundles; small or legacy apps |
| ⭐ vCore | General Purpose, Business Critical, Hyperscale | choose CPU and storage separately; reserved capacity and Azure Hybrid Benefit |
| ⭐ serverless (vCore) | General Purpose (auto-pause), Hyperscale (no auto-pause) | spiky or dev workloads; auto-scaling compute |
| free offer | serverless General Purpose, monthly vCore-seconds and 32 GB | learning and tiny apps |

| Production setting | Practice |
|:--|:--|
| ⭐ authentication | Entra-only (`azureADOnlyAuthentication`), an Entra group as admin, managed identities for apps |
| ⭐ network | private endpoint; public access disabled; minimum TLS 1.2 |
| ⭐ availability | zone redundancy (General Purpose and above in supported regions); Business Critical has built-in replicas |
| auto-pause | off for production databases that must answer instantly |
| backups | PITR retention, LTR, backup redundancy (05-data-safety) |
| monitoring | Query Store, Database Watcher, alerts on CPU, log IO, workers, storage |
| elastic pools | many small databases sharing resources (multi-tenant) |

### Azure Managed Redis
| Item | Detail |
|:--|:--|
| ⭐ what | Redis Enterprise-based managed Redis; replaces Azure Cache for Redis for new work |
| tiers | Memory Optimized, Balanced, Compute Optimized, Flash Optimized |
| ⭐ clustering policy | OSS cluster (client handles shards; fastest), Enterprise (single endpoint via proxy) |
| high availability | replicas on by default; zone-redundant in supported regions |
| ⭐ Entra authentication | access policies for managed identities; disable access keys |
| port | TLS on 10000 |
| modules | RediSearch, RedisJSON, time series, Bloom (tier-dependent) |
| retirement | Azure Cache for Redis: Enterprise tiers end March 2027, Basic/Standard/Premium end 30 September 2028; migration tooling exists |

## Example
`src/Shop.Infrastructure/Redis/RedisSetup.cs` (Managed Redis with Entra ID)
```csharp
using Azure.Identity;
using StackExchange.Redis;

public static class RedisSetup
{
    public static async Task<IConnectionMultiplexer> ConnectAsync(string host, string? clientId)
    {
        var options = ConfigurationOptions.Parse($"{host}:10000");
        options.Ssl = true;
        options.AbortOnConnectFail = false;
        await options.ConfigureForAzureWithTokenCredentialAsync(
            new DefaultAzureCredential(new DefaultAzureCredentialOptions { ManagedIdentityClientId = clientId }));  // Microsoft.Azure.StackExchangeRedis
        return await ConnectionMultiplexer.ConnectAsync(options);
    }
}
```
Tokens are refreshed automatically by the extension; no access key is stored anywhere.

`terminal` (Azure SQL: Entra-only, serverless for staging, provisioned for production)
```bash
az sql server create -g rg-shop-prod-weu -n sql-shop-prod -l westeurope \
  --enable-ad-only-auth --external-admin-principal-type Group \
  --external-admin-name sg-shop-sql-admins --external-admin-sid "$ADMINS_GROUP_ID" \
  --minimal-tls-version 1.2

az sql db create -g rg-shop-prod-weu -s sql-shop-prod -n shop \
  --edition GeneralPurpose --family Gen5 --capacity 2 --zone-redundant true \
  --backup-storage-redundancy Zone

az sql db create -g rg-shop-staging-weu -s sql-shop-staging -n shop \
  --edition GeneralPurpose --compute-model Serverless --family Gen5 --capacity 2 --auto-pause-delay 60
```

## Production patterns
- Container Apps for the shop's multiple services and jobs; App Service considered for single web apps that benefit from slots.
- Azure SQL vCore General Purpose to start, sized from measurements (09-scalability), zone-redundant, private, Entra-only; serverless with auto-pause only outside production.
- Azure Managed Redis with Entra authentication and access keys disabled; no new Azure Cache for Redis instances; existing ones on a migration plan.
- Every data service has alerts on its saturation metrics and is in the capacity worksheet.

## Mistakes
Wrong: auto-pause on the production database.
Right: provisioned compute (or serverless without auto-pause) for anything users wait on.

Wrong: Redis access keys in Key Vault "because Entra auth is complicated".
Right: `ConfigureForAzureWithTokenCredentialAsync` with the managed identity and an access policy.

## Check yourself
1. When does App Service beat Container Apps?
2. What's the risk of serverless auto-pause in production?
3. Why should new projects use Azure Managed Redis?

<details><summary>Answers</summary>

1. For one or a few web apps where deployment slots with warm-up and swap, a fixed plan cost, and the most familiar PaaS are more valuable than scale-to-zero, jobs, or event-driven scaling.
2. The first request after a pause waits while the database resumes (tens of seconds), so users and dependent operations (like payment sessions) time out.
3. Azure Cache for Redis is retiring (creation is blocked for new customers, and all tiers retire by 2028); Azure Managed Redis is the supported successor with newer Redis versions, Entra authentication, and better performance per cost.
</details>

## Sources
- [Compare Azure compute options](https://learn.microsoft.com/azure/architecture/guide/technology-choices/compute-decision-tree)
- [App Service deployment slots](https://learn.microsoft.com/azure/app-service/deploy-staging-slots)
- [Azure SQL vCore purchasing model](https://learn.microsoft.com/azure/azure-sql/database/service-tiers-sql-database-vcore)
- [Azure SQL serverless](https://learn.microsoft.com/azure/azure-sql/database/serverless-tier-overview)
- [Azure SQL free offer](https://learn.microsoft.com/azure/azure-sql/database/free-offer)
- [Azure Managed Redis overview](https://learn.microsoft.com/azure/redis/overview)
- [Azure Cache for Redis retirement FAQ](https://learn.microsoft.com/azure/azure-cache-for-redis/retirement-faq)
