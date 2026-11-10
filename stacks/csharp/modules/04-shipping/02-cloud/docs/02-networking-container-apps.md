---
title: Networking and Azure Container Apps
tech: Azure Virtual Network, private endpoints, NAT gateway, Azure Container Apps
version: Azure Container Apps (workload profiles environments), November 2026
date: 2026-11-09
covers: [3, 4]
---
# Networking and Azure Container Apps
[← Overview](00-overview.md)

## Why it matters
- Azure SQL had "Allow Azure services" turned on. Any Azure customer's resource could reach the login endpoint, and brute-force attempts appeared in the audit log.
- A partner allow-listed the shop's outbound IP. Container Apps used shared, changing egress IPs, and the integration broke after a platform update.
- A database migration job ran inside the API container on startup. Three replicas ran it at the same time and deadlocked.

## Concepts

### Networking building blocks
| Block | Purpose |
|:--|:--|
| ⭐ virtual network (VNet) | your private address space (`10.20.0.0/16`) |
| ⭐ subnets | slices for different uses: Container Apps environment, private endpoints |
| ⭐ network security groups (NSGs) | allow/deny rules on subnets |
| ⭐ private endpoints | a private IP in your VNet for a PaaS service (SQL, Key Vault, Storage, Redis, Service Bus, ACR); disable public access |
| private DNS zones | `privatelink.database.windows.net` resolves to the private IP inside the VNet |
| ⭐ NAT gateway | one static outbound IP for everything in a subnet (partner allow-lists) |
| service endpoints | older, simpler option for some services; private endpoints preferred |
| Front Door / Application Gateway | public entry with WAF in front of internal apps |

Default posture: public endpoints only for Front Door (and the Container Apps ingress Front Door points at); everything else reachable only from the VNet.

### Azure Container Apps
| Concept | Meaning |
|:--|:--|
| ⭐ environment | shared boundary for apps: VNet, Log Analytics, Dapr, workload profiles |
| workload profiles | Consumption (serverless) plus optional Dedicated profiles (D4, E8...) in the same environment |
| ⭐ container app | one deployable (API, web, workers) with containers, ingress, scale, secrets, identity |
| ⭐ revision | an immutable snapshot of the app's template; changing image or env creates a new one |
| revision mode | single (automatic cut-over) or multiple (traffic split, blue/green) |
| ⭐ ingress | external or internal (environment only), target port, HTTP/TCP, session affinity, IP restrictions |
| scale rules | HTTP concurrency, CPU/memory, KEDA scalers (Service Bus), min/max replicas (03-backend/09-scalability) |
| ⭐ jobs | manual, scheduled (cron), or event-driven containers that run to completion: migrations, batch work |
| secrets | app-level secrets, optionally Key Vault references |
| ⭐ ACR pull with managed identity | `registries: [{ server, identity }]`; no registry passwords |
| limits | request timeout 240 s at ingress; plan long work as jobs |

The shop's layout: one environment per environment (prod, staging) with `ca-shop-api` (internal ingress behind Front Door, or external with IP restrictions to Front Door), `ca-shop-web` (external, behind Front Door), `ca-shop-workers` (no ingress, scaled by Service Bus), and jobs `caj-shop-migrate` (manual) and `caj-shop-nightly` (scheduled).

## Example
`terminal` (environment in a VNet, then the API)
```bash
az network vnet create -g rg-shop-prod-weu -n vnet-shop-prod --address-prefixes 10.20.0.0/16 \
  --subnet-name snet-aca --subnet-prefixes 10.20.0.0/23
az network vnet subnet update -g rg-shop-prod-weu --vnet-name vnet-shop-prod -n snet-aca \
  --delegations Microsoft.App/environments

az containerapp env create -g rg-shop-prod-weu -n cae-shop-prod -l westeurope \
  --enable-workload-profiles \
  --infrastructure-subnet-resource-id "$(az network vnet subnet show -g rg-shop-prod-weu --vnet-name vnet-shop-prod -n snet-aca --query id -o tsv)" \
  --logs-workspace-id "$LAW_ID" --logs-workspace-key "$LAW_KEY"

az containerapp create -g rg-shop-prod-weu -n ca-shop-api --environment cae-shop-prod \
  --image crshop.azurecr.io/shop-api@sha256:... \
  --registry-server crshop.azurecr.io --registry-identity "$API_IDENTITY_ID" \
  --user-assigned "$API_IDENTITY_ID" \
  --ingress external --target-port 8080 \
  --min-replicas 2 --max-replicas 10 --cpu 0.5 --memory 1Gi \
  --env-vars ASPNETCORE_ENVIRONMENT=Production AZURE_CLIENT_ID="$API_CLIENT_ID"
```
Migrations as a manual job, started by the pipeline (04-deployments):
```bash
az containerapp job create -g rg-shop-prod-weu -n caj-shop-migrate --environment cae-shop-prod \
  --trigger-type Manual --replica-timeout 1800 --replica-retry-limit 0 \
  --image crshop.azurecr.io/shop-migrate@sha256:... --registry-server crshop.azurecr.io --registry-identity "$API_IDENTITY_ID" \
  --mi-user-assigned "$API_IDENTITY_ID"
az containerapp job start -g rg-shop-prod-weu -n caj-shop-migrate
```
A private endpoint for Azure SQL (and turning public access off):
```bash
az network private-endpoint create -g rg-shop-prod-weu -n pe-sql-shop --vnet-name vnet-shop-prod --subnet snet-pe \
  --private-connection-resource-id "$SQL_SERVER_ID" --group-id sqlServer --connection-name sql
az sql server update -g rg-shop-prod-weu -n sql-shop-prod --enable-public-network false
```
In practice all of this lives in Bicep (03-iac); the CLI shows what each piece is.

## Production patterns
- A workload profiles environment in your own VNet; PaaS services behind private endpoints with public access disabled; NAT gateway when partners need a fixed outbound IP.
- The API, web, and workers as separate container apps sharing one environment; migrations and batch work as Container Apps jobs.
- Images pulled with a managed identity by digest; min replicas ≥ 2 for user-facing apps; ingress only through Front Door.
- Long-running work never relies on HTTP requests (240 s ingress timeout); it goes to jobs or queues.

## Mistakes
Wrong: running migrations in `Program.cs` on startup of every replica.
Right: a migration job started once by the pipeline before the new revision takes traffic.

Wrong: SQL "Allow Azure services and resources to access this server" enabled.
Right: private endpoint, public network access disabled, Entra-only authentication.

## Check yourself
1. What does a private endpoint give you?
2. What creates a new revision in Container Apps?
3. When do you need a NAT gateway?

<details><summary>Answers</summary>

1. A private IP address for a PaaS service inside your VNet, so traffic stays on the private network and you can disable the service's public endpoint.
2. Changes to the revision-scope template: container image, environment variables, resources, scale rules, and similar. App-level settings like ingress traffic splits or secrets (values) don't create one by themselves.
3. When outbound traffic needs a stable, known IP address, for example for partner allow-lists, or to control egress from the environment's subnet.
</details>

## Sources
- [Networking in Container Apps](https://learn.microsoft.com/azure/container-apps/networking)
- [Workload profiles](https://learn.microsoft.com/azure/container-apps/workload-profiles-overview)
- [Revisions in Container Apps](https://learn.microsoft.com/azure/container-apps/revisions)
- [Jobs in Container Apps](https://learn.microsoft.com/azure/container-apps/jobs)
- [What is a private endpoint?](https://learn.microsoft.com/azure/private-link/private-endpoint-overview)
- [NAT gateway with Container Apps](https://learn.microsoft.com/azure/container-apps/custom-virtual-networks)
