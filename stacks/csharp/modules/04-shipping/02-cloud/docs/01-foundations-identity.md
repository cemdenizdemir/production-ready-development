---
title: Azure foundations and identity
tech: Azure Resource Manager, Microsoft Entra ID, Azure RBAC, managed identities
version: Azure (November 2026), Azure CLI 2.7x
date: 2026-11-09
covers: [1, 2]
---
# Azure foundations and identity
[← Overview](00-overview.md)

## Why it matters
- Dev and production shared one subscription. A developer cleaning up "old test resources" deleted the production Redis cache.
- The API connected to SQL with the server admin password from an app setting. The password leaked in a screenshot, and the attacker had full control of every database on the server.
- A pipeline service principal had Owner on the whole subscription. When its secret leaked, the attacker could create resources and assign roles.

## Concepts

### The resource hierarchy
| Level | What it is | Shop example |
|:--|:--|:--|
| ⭐ tenant | your Microsoft Entra ID directory: users, groups, apps | `shop.example` |
| management group | groups subscriptions for policy and access | `mg-shop` |
| ⭐ subscription | billing and isolation boundary; one per environment | `shop-prod`, `shop-nonprod` |
| ⭐ resource group | lifecycle unit: resources deployed and deleted together | `rg-shop-prod-weu` |
| resource | one service instance | `ca-shop-api`, `sql-shop-prod` |
| ⭐ region | data centre location | West Europe; pick by users and data residency |
| availability zones | separate data centres in a region | zone-redundant SQL, Container Apps |

Naming follows the Cloud Adoption Framework abbreviations (`rg-`, `ca-`, `cae-`, `kv-`, `sql-`, `st`, `cr`), with environment and region. Tags (`app`, `env`, `owner`, `costCenter`) go on every resource.

### Identity and access
| Concept | Meaning |
|:--|:--|
| ⭐ Microsoft Entra ID | identity provider for people, groups, apps, and workloads |
| ⭐ Azure RBAC | role assignment = **who** (principal) + **what** (role) + **where** (scope) |
| control plane vs data plane | managing a resource (`Contributor`) vs using its data (`Storage Blob Data Reader`, `Key Vault Secrets User`) |
| ⭐ managed identity | an Entra identity for an Azure resource; Azure handles the credentials; no secrets in the app |
| system-assigned vs user-assigned | lifecycle tied to one resource vs a standalone identity you can share and pre-authorise |
| ⭐ least privilege | smallest role at the smallest scope; data roles instead of `Contributor` |
| PIM (Privileged Identity Management) | just-in-time elevation for people, with approval and expiry |
| workload identity federation | pipelines (GitHub Actions) get tokens through OIDC; no client secrets (04-deployments) |

| The app needs | Role | Scope |
|:--|:--|:--|
| pull images | `AcrPull` | the registry |
| read secrets | `Key Vault Secrets User` | the vault (or one secret) |
| read/write blobs | `Storage Blob Data Contributor` | the container |
| send/receive messages | `Azure Service Bus Data Sender` / `Data Receiver` | the queue or topic |
| use SQL | a contained database user `FROM EXTERNAL PROVIDER` with `db_datareader`/`db_datawriter` (or narrower) | the database (inside SQL) |
| use Redis | Redis access policy assignment (Entra auth) | the cache |

In code, `DefaultAzureCredential` (or `ManagedIdentityCredential` in production) finds the managed identity in Azure and your developer login locally.

## Example
`terminal` (create the basics, then grant the API's identity data-plane roles)
```bash
az group create -n rg-shop-prod-weu -l westeurope --tags app=shop env=prod owner=team-shop

az identity create -g rg-shop-prod-weu -n id-shop-api
API_PRINCIPAL=$(az identity show -g rg-shop-prod-weu -n id-shop-api --query principalId -o tsv)

KV_ID=$(az keyvault show -n kv-shop-prod --query id -o tsv)
az role assignment create --assignee-object-id "$API_PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" --scope "$KV_ID"

ST_ID=$(az storage account show -n stshopprod --query id -o tsv)
az role assignment create --assignee-object-id "$API_PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" --scope "$ST_ID/blobServices/default/containers/uploads"
```
`sql/grant-api.sql` (run as the Entra admin of the SQL server)
```sql
CREATE USER [id-shop-api] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [id-shop-api];
ALTER ROLE db_datawriter ADD MEMBER [id-shop-api];
GRANT EXECUTE TO [id-shop-api];
```
`src/Shop.Api/Program.cs`
```csharp
using Azure.Identity;

var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
{
    ManagedIdentityClientId = builder.Configuration["AZURE_CLIENT_ID"],   // user-assigned identity in Azure
});
builder.Configuration.AddAzureKeyVault(new Uri(builder.Configuration["KeyVault:Uri"]!), credential);
// SQL: "Server=tcp:sql-shop-prod.database.windows.net;Database=shop;Authentication=Active Directory Default;User Id=<client-id>"
```
In production, `ManagedIdentityCredential` (or `DefaultAzureCredential` with `AZURE_TOKEN_CREDENTIALS=prod`) avoids slow probing of developer credentials.

## Production patterns
- A subscription per environment (at least prod and non-prod) under a management group with policies; resource groups per app and environment.
- Consistent names and tags; regions chosen for users, data residency, and zone support.
- Apps use user-assigned managed identities with data-plane roles at the narrowest scope; no connection strings with passwords.
- People get no standing production write access: Reader by default, PIM for elevation, break-glass accounts monitored.

## Mistakes
Wrong: `Contributor` on the subscription for the app's identity "so it works".
Right: `Key Vault Secrets User` on one vault, `Storage Blob Data Contributor` on one container, a SQL user with only the roles it needs.

Wrong: `Server=...;User Id=sqladmin;Password=...` in configuration.
Right: Entra-only authentication with the managed identity (`Authentication=Active Directory Default`).

## Check yourself
1. What does a role assignment consist of?
2. Why prefer a user-assigned managed identity for the API?
3. What's the difference between `Contributor` and `Storage Blob Data Contributor`?

<details><summary>Answers</summary>

1. A security principal (who), a role definition (what actions), and a scope (where: management group, subscription, resource group, or resource).
2. It exists independently of the Container App, so you can create it, grant roles, and grant SQL access before the app is deployed, and it survives app re-creation. It can also be shared by the API and workers if they need the same access.
3. `Contributor` manages resources (control plane) but doesn't grant reading blob data with Entra auth. `Storage Blob Data Contributor` reads and writes blob data (data plane) without the right to change the storage account itself.
</details>

## Sources
- [Azure resource organisation](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-setup-guide/organize-resources)
- [Resource naming abbreviations](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations)
- [What is Azure RBAC?](https://learn.microsoft.com/azure/role-based-access-control/overview)
- [Managed identities for Azure resources](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview)
- [Microsoft Entra authentication for Azure SQL](https://learn.microsoft.com/azure/azure-sql/database/authentication-aad-overview)
- [DefaultAzureCredential guidance](https://learn.microsoft.com/dotnet/azure/sdk/authentication/credential-chains)
