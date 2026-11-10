---
title: Why IaC and Bicep basics
tech: Bicep, Azure CLI
version: Bicep 0.3x, Azure CLI 2.7x
date: 2026-11-09
covers: [1, 2]
---
# Why IaC and Bicep basics
[← Overview](00-overview.md)

## Why it matters
- Production was built by hand two years ago. When the region had an outage, nobody could rebuild it elsewhere: the person who built it had left, and the portal doesn't remember clicks.
- Staging had public network access on SQL; production didn't. A bug that depended on network access passed staging and failed in production.
- A storage account's firewall was changed in the portal "for a quick test" and never changed back. Nobody knew until an audit.

## Concepts

### Why infrastructure as code
| Benefit | Meaning |
|:--|:--|
| ⭐ reviewable | changes are pull requests with a diff and an approver |
| ⭐ repeatable | the same code builds dev, staging, and production; differences are explicit parameters |
| ⭐ recoverable | rebuild an environment or region from code (with data from backups, 05-data-safety) |
| ⭐ drift visible | what-if shows when reality no longer matches code |
| documented | the code is the inventory |
| secure by default | policies like "no public blobs" can't be forgotten in one environment |

Portal clicks are fine for exploring. Anything that lasts goes into code.

### Bicep basics
| Element | Syntax |
|:--|:--|
| ⭐ resource | `resource kv 'Microsoft.KeyVault/vaults@2024-11-01' = { name: ..., location: ..., properties: {...} }` |
| ⭐ parameter | `param env string`, with decorators `@allowed([...])`, `@minLength(3)`, `@description('...')`, `@secure()` |
| variable | `var prefix = 'shop-${env}'` |
| ⭐ output | `output apiUrl string = api.properties.configuration.ingress.fqdn` |
| ⭐ references | `kv.id`, `kv.properties.vaultUri`, `kv.name` create implicit dependencies (no `dependsOn` needed) |
| ⭐ `existing` | `resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = { name: 'log-shop-prod' }` |
| ⭐ loops | `[for c in containers: { name: c }]` |
| ⭐ conditions | `resource x '...' = if (env == 'prod') { ... }` |
| child resources | nested or `parent: storage` |
| scope | `targetScope = 'resourceGroup'` (default), `'subscription'`, `'managementGroup'` |
| functions | `resourceGroup().location`, `uniqueString(resourceGroup().id)`, `subscription()`, `toLower()` |
| modules | `module api 'modules/api.bicep' = { params: {...} }` (lesson 03) |

The Bicep compiler turns `.bicep` into an ARM JSON template; Azure Resource Manager deploys it. The VS Code extension gives IntelliSense for every resource type and API version.

## Example
`infra/main.bicep` (a small slice: identity, Key Vault, storage)
```bicep
targetScope = 'resourceGroup'

@allowed(['staging', 'prod'])
param env string
param location string = resourceGroup().location
param containers array = ['products', 'uploads-quarantine', 'invoices']

var suffix = uniqueString(resourceGroup().id)
var tags = { app: 'shop', env: env }

resource apiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-shop-api-${env}'
  location: location
  tags: tags
}

resource kv 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: 'kv-shop-${env}-${take(suffix, 6)}'
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: env == 'prod' ? 'Disabled' : 'Enabled'
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: 'stshop${env}${take(suffix, 6)}'
  location: location
  tags: tags
  sku: { name: env == 'prod' ? 'Standard_ZRS' : 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2024-01-01' = {
  parent: storage
  name: 'default'
  properties: { deleteRetentionPolicy: { enabled: true, days: 14 }, isVersioningEnabled: true }
}

resource blobContainers 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01' = [for c in containers: {
  parent: blobService
  name: c
}]

// Key Vault Secrets User for the API identity
resource kvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, apiIdentity.id, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: apiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output keyVaultUri string = kv.properties.vaultUri
output apiIdentityClientId string = apiIdentity.properties.clientId
```
`terminal`
```bash
az bicep build --file infra/main.bicep                       # compile + lint
az deployment group create -g rg-shop-staging-weu --template-file infra/main.bicep --parameters env=staging
```
Role assignment names use `guid(...)` so they're deterministic: redeploying doesn't create duplicates.

## Production patterns
- Everything that lasts is in `infra/`; portal changes are for exploration and are reverted or codified the same day.
- Resources reference each other through symbolic names (implicit dependencies), never through hand-typed IDs.
- Secure settings are the default in code (no public blobs, no shared keys, TLS 1.2, purge protection); environment differences are explicit expressions.
- API versions are recent and updated deliberately (the linter's `use-recent-api-versions` rule helps).

## Mistakes
Wrong:
```bicep
resource kv 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: 'kv-shop-prod'
  dependsOn: [ storage ]                 // unnecessary; and IDs typed by hand elsewhere
  properties: { accessPolicies: [ ... ] } // legacy access policies
}
```
Right: references create dependencies; `enableRbacAuthorization: true` with role assignments.

Wrong: fixing production in the portal and "updating the Bicep later".
Right: change the Bicep, review the what-if, deploy.

## Check yourself
1. Name three benefits of IaC that portal changes can't give you.
2. How does Bicep know the order to create resources?
3. What does the `existing` keyword do?

<details><summary>Answers</summary>

1. Reviewable changes (PRs with diffs), repeatable environments (same code, different parameters), and recovery (rebuild from code); plus visible drift and an always-current inventory.
2. From references between resources (using `kv.id` or `storage.name` creates an implicit dependency); `dependsOn` is only for the rare case without a reference.
3. It declares a reference to a resource that already exists (not deployed by this template), so you can read its properties or use it as a scope or parent.
</details>

## Sources
- [Bicep file structure and syntax](https://learn.microsoft.com/azure/azure-resource-manager/bicep/file)
- [Resource declaration in Bicep](https://learn.microsoft.com/azure/azure-resource-manager/bicep/resource-declaration)
- [Existing resources in Bicep](https://learn.microsoft.com/azure/azure-resource-manager/bicep/existing-resource)
- [Iterative loops](https://learn.microsoft.com/azure/azure-resource-manager/bicep/loops)
- [Azure built-in roles](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles)
