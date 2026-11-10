---
title: Cloud cheatsheet
tech: Azure (Container Apps, Azure SQL, Azure Managed Redis, Key Vault, Blob Storage, Service Bus)
version: Azure (November 2026), Azure CLI 2.7x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Cloud cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Hierarchy
| Level | Is | Note |
|:--|:--|:--|
| ⭐ tenant | Entra ID directory | identities |
| management group | policy/access grouping | `mg-shop` |
| ⭐ subscription | billing + isolation | one per environment |
| ⭐ resource group | lifecycle unit | `rg-shop-prod-weu` |
| ⭐ region / zones | location / data centres | residency, HA |
| tags | metadata | `app`, `env`, `owner` |
| landing zone | prepared subscription setup | CAF |

## Naming (CAF)
| Prefix | Resource | Example |
|:--|:--|:--|
| `rg-` | resource group | `rg-shop-prod-weu` |
| `cae-` / `ca-` / `caj-` | ACA environment / app / job | `ca-shop-api` |
| `cr` | container registry | `crshop` |
| `sql-` / `sqldb-` | SQL server / database | `sql-shop-prod` |
| `kv-` | Key Vault | `kv-shop-prod` |
| `st` | storage account | `stshopprod` |
| `id-` | managed identity | `id-shop-api` |
| `log-` | Log Analytics | `log-shop-prod` |

## Identity
| Item | Does | Note |
|:--|:--|:--|
| ⭐ Entra ID | identity provider | people, apps, workloads |
| ⭐ RBAC assignment | principal + role + scope | |
| control vs data plane | manage vs use | different roles |
| ⭐ managed identity | credential-free app identity | system or user-assigned |
| ⭐ `DefaultAzureCredential` | dev login locally, MI in Azure | `AZURE_CLIENT_ID` |
| `ManagedIdentityCredential` | production-only chain | faster |
| PIM | just-in-time admin | approvals |
| workload identity federation | OIDC for pipelines | no secrets |

## Common data-plane roles
| Role | For | Scope |
|:--|:--|:--|
| ⭐ `AcrPull` | pull images | registry |
| ⭐ `Key Vault Secrets User` | read secrets | vault |
| ⭐ `Storage Blob Data Contributor` | blobs | container |
| `Azure Service Bus Data Sender` / `Receiver` | messaging | queue/topic |
| SQL contained user | `FROM EXTERNAL PROVIDER` | database |
| Redis access policy | Entra auth | cache |
| `Reader` | view only | default for people |

## Networking
| Item | Does | Note |
|:--|:--|:--|
| ⭐ VNet / subnets | private address space | `10.20.0.0/16` |
| ⭐ NSG | allow/deny rules | per subnet |
| ⭐ private endpoint | private IP for PaaS | disable public access |
| private DNS zone | `privatelink.*` resolution | |
| ⭐ NAT gateway | static outbound IP | partner allow-lists |
| service endpoint | older option | prefer private endpoints |
| subnet delegation | `Microsoft.App/environments` | ACA |

## Container Apps
| Item | Does | Note |
|:--|:--|:--|
| ⭐ environment | VNet, logs, profiles | per environment |
| workload profiles | Consumption + Dedicated | /27 subnets |
| ⭐ container app | one deployable | api, web, workers |
| ⭐ revision | immutable template snapshot | new on image/env change |
| revision mode | single / multiple | traffic split |
| ⭐ ingress | external / internal | target port 8080 |
| ⭐ jobs | manual, scheduled, event | migrations, batch |
| secrets + `secretRef` | env from secrets | Key Vault refs |
| `registries: [{ server, identity }]` | MI image pull | |
| request timeout | 240 s | use jobs/queues |
| `az containerapp logs show --type system` | platform events | |
| `az containerapp exec` | shell into replica | if image has one |

## App Service
| Item | Does | Note |
|:--|:--|:--|
| plan | VMs you pay for | B, P0v3, P1v3... |
| ⭐ deployment slots | staging + swap | Standard+ |
| Easy Auth | built-in auth | |
| WebJobs | background work | |
| choose when | single web app, slots | ACA for many services |

## Azure SQL
| Item | Does | Note |
|:--|:--|:--|
| DTU | bundled tiers | simple |
| ⭐ vCore | GP / BC / Hyperscale | flexible |
| ⭐ serverless | auto-scale, auto-pause (GP) | non-prod pause |
| free offer | small serverless DB | per subscription |
| ⭐ Entra-only auth | no SQL logins | `--enable-ad-only-auth` |
| ⭐ private endpoint | no public access | |
| zone redundancy | survive a zone | GP+ in supported regions |
| minimal TLS | 1.2+ | |
| elastic pool | shared resources | many DBs |
| Database Watcher | monitoring | |

## Azure Managed Redis
| Item | Does | Note |
|:--|:--|:--|
| ⭐ tiers | Memory/Compute/Balanced/Flash Optimized | |
| ⭐ clustering policy | OSS / Enterprise | client support |
| ⭐ Entra auth | access policies | disable keys |
| `ConfigureForAzureWithTokenCredentialAsync` | token auth | Microsoft.Azure.StackExchangeRedis |
| port | 10000, TLS | |
| ⭐ Azure Cache for Redis | retiring | Enterprise 2027, others Sept 2028 |

## Storage and Front Door
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `allowBlobPublicAccess: false` | no anonymous blobs | |
| ⭐ `allowSharedKeyAccess: false` | Entra only | |
| ZRS / GZRS | redundancy | |
| soft delete, versioning | recovery | |
| lifecycle rules | tiering, cleanup | |
| ⭐ Front Door | edge, WAF, CDN, TLS | Standard / Premium |
| Private Link origin | private storage origin | Premium |
| caching rules | static assets | long TTL |

## Secrets and configuration
| Item | Does | Note |
|:--|:--|:--|
| ⭐ Key Vault | secrets, keys, certs | RBAC model |
| ⭐ purge protection | can't permanently delete early | |
| ⭐ versionless references | pick up rotation | |
| `AddAzureKeyVault(uri, cred)` | config provider | |
| App Configuration | settings, flags | labels |
| `ConfigureKeyVault(...)` | resolve KV refs | |
| `ConfigureRefresh(...)` | live updates | `UseAzureAppConfiguration()` |
| `UseFeatureFlags()` | flags | FeatureManagement |
| expiry events | `SecretNearExpiry` | Event Grid |

## DNS and TLS
| Item | Does | Note |
|:--|:--|:--|
| Azure DNS | hosted zones | IaC |
| ⭐ CNAME + TXT `asuid.*` | ACA domain validation | |
| ⭐ managed certificates | free, auto-renew | ACA, Front Door |
| `az containerapp hostname add/bind` | custom domain | |
| HSTS | force HTTPS | after HTTPS is solid |
| CAA | allowed CAs | |

## Cost
| Item | Does | Note |
|:--|:--|:--|
| ⭐ budgets | alerts on actual/forecast | day one |
| Cost analysis | by tag/service | saved views |
| anomaly alerts | unusual spend | |
| Advisor | right-sizing | monthly |
| reservations / savings plans | commit for discount | steady loads |
| ⭐ scale to zero | idle costs nothing | non-prod, workers |
| ACA free grant | 180k vCPU-s, 360k GiB-s, 2M requests | per subscription/month |
| Log Analytics | GB ingested | filters, retention |

## Platform logs
| Source | Table | Note |
|:--|:--|:--|
| ⭐ ACA console | `ContainerAppConsoleLogs_CL` | stdout/stderr |
| ⭐ ACA system | `ContainerAppSystemLogs_CL` | probes, restarts, OOM |
| resource logs | diagnostic settings | SQL, KV, FD, Storage |
| activity log | subscription changes | who did what |
| metrics | Azure Monitor | replicas, CPU, restarts |
| ⭐ one workspace per env | | RBAC |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| one subscription for all envs | prod deleted by mistake | subscription per env |
| `Contributor` for apps | huge blast radius | data roles, narrow scope |
| SQL admin password in config | full takeover on leak | Entra-only + MI |
| "Allow Azure services" on SQL | exposed endpoint | private endpoint |
| migrations on app startup | races, deadlocks | ACA job |
| auto-pause in prod | slow first request | provisioned |
| new Azure Cache for Redis | retiring, blocked | Managed Redis |
| copied secrets | missed rotations | KV references |
| manual certificates | expiry outage | managed certs |
| no budget | surprise bills | budgets + alerts |
| ignoring system logs | unexplained restarts | `--type system` |

## Sources
| Source | Link |
|:--|:--|
| Container Apps | https://learn.microsoft.com/azure/container-apps/overview |
| Azure RBAC | https://learn.microsoft.com/azure/role-based-access-control/overview |
| Managed identities | https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview |
| Private endpoints | https://learn.microsoft.com/azure/private-link/private-endpoint-overview |
| Azure SQL vCore | https://learn.microsoft.com/azure/azure-sql/database/service-tiers-sql-database-vcore |
| Azure Managed Redis | https://learn.microsoft.com/azure/redis/overview |
| Key Vault best practices | https://learn.microsoft.com/azure/key-vault/general/best-practices |
| ACA custom domains | https://learn.microsoft.com/azure/container-apps/custom-domains-managed-certificates |
| Container Apps billing | https://learn.microsoft.com/azure/container-apps/billing |
| CAF abbreviations | https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations |
