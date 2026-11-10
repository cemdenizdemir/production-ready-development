---
title: Cloud
module: 04-shipping
tech: Azure (Container Apps, Azure SQL, Azure Managed Redis, Key Vault, Blob Storage, Service Bus)
---
# Cloud
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Azure foundations: tenants, management groups, a subscription per environment, resource groups, regions
- [ ] ⭐ Identity and access: Microsoft Entra ID, Azure RBAC, managed identities instead of keys, least privilege
- [ ] ⭐ Networking: virtual networks, subnets, network security groups, private endpoints, NAT gateway
- [ ] ⭐ Running containers on Azure Container Apps: environments, revisions, ingress, scale rules, jobs, pulling from ACR with managed identity
- [ ] App Service for .NET: plans, deployment slots, and when it beats Container Apps
- [ ] Azure SQL Database in production: DTU, vCore, and serverless tiers, Entra-only auth, private access, zone redundancy
- [ ] Azure Managed Redis: tiers, clustering, Entra authentication, and the Azure Cache for Redis retirement
- [ ] Blob Storage and Azure Front Door: private containers, managed identity access, static assets
- [ ] Secrets and configuration: Key Vault, App Configuration, Key Vault references, rotation
- [ ] DNS and TLS: Azure DNS, managed certificates, custom domains on Container Apps
- [ ] Cost awareness: what costs money, budgets, cost alerts, free offers, scale to zero, reservations
- [ ] Platform logs and metrics: Log Analytics workspaces, retention, Container Apps logs, alerts

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Azure foundations and identity](docs/01-foundations-identity.md)
- [02 · Networking and Azure Container Apps](docs/02-networking-container-apps.md)
- [03 · App Service, Azure SQL, and Azure Managed Redis](docs/03-app-service-sql-redis.md)
- [04 · Storage and Front Door, secrets, DNS, and TLS](docs/04-storage-secrets-dns.md)
- [05 · Cost awareness and platform logs](docs/05-cost-logs.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/04-shipping/02-cloud mode=tasks` when you are ready to build._
