---
title: Modules, environments, and secrets
tech: Bicep modules, Azure Verified Modules, .bicepparam, Key Vault
version: Bicep 0.3x
date: 2026-11-09
covers: [5, 6, 7]
---
# Modules, environments, and secrets
[← Overview](00-overview.md)

## Why it matters
- `main.bicep` grew to 2,000 lines with copy-pasted Container App blocks for API, web, and workers. A security fix was applied to two of the three.
- Staging and production used one parameters JSON with `if` statements scattered through the template. Nobody could tell what was different between them.
- The SQL admin password was a default parameter value in the template. It's in Git history forever.

## Concepts

### Modules
| Item | Syntax / practice |
|:--|:--|
| ⭐ local module | `module api 'modules/container-app.bicep' = { name: 'api', params: { ... } }` |
| ⭐ outputs | modules return IDs and names: `api.outputs.fqdn` |
| ⭐ user-defined types | `type ContainerAppSpec = { name: string, image: string, cpu: string?, minReplicas: int }` |
| shared types | `@export()` in `types.bicep`; `import { ContainerAppSpec } from 'types.bicep'` |
| `@sealed()`, `@discriminator()` | stricter object types |
| module scope | `scope: resourceGroup('rg-shared')` to deploy into another group |
| ⭐ Azure Verified Modules | `br/public:avm/res/key-vault/vault:<version>`: Microsoft-maintained, secure defaults, tested |
| private registry | publish your modules to ACR: `br:crshop.azurecr.io/bicep/modules/container-app:1.2.0` |
| module size | one module per concept (app, data, network); thin `main.bicep` wiring them together |

Use AVM for standard resources (Key Vault, storage, SQL, Container Apps) unless you need something they don't support; write your own modules for your app's opinionated combinations ("a Container App the way we run it").

### Environments
| Practice | How |
|:--|:--|
| ⭐ one template, one params file per environment | `infra/env/staging.bicepparam`, `infra/env/prod.bicepparam` |
| ⭐ differences as parameters | SKUs, replica counts, zone redundancy, alert thresholds |
| isolation | a subscription per environment (or at least a resource group) |
| ⭐ tags | `env`, `app`, `owner` from parameters on every resource |
| ephemeral environments | PR environments from the same template with small SKUs, deleted on merge |
| naming | derived from `env` and a short unique suffix |

`.bicepparam` files are type-checked against the template (`using './main.bicep'`) and can read environment variables and Key Vault secrets.

### Secrets in IaC
| Rule | How |
|:--|:--|
| ⭐ prefer no secrets at all | managed identities and Entra auth for SQL, Redis, Storage, Service Bus, ACR |
| ⭐ `@secure()` parameters | not logged in deployment history or outputs |
| ⭐ Key Vault references in params | `az.getSecret(subscriptionId, rg, vaultName, secretName)` in `.bicepparam` |
| `readEnvironmentVariable('X')` | values from the pipeline's environment (non-secret IDs) |
| no secret outputs | linter rule `outputs-should-not-contain-secrets`; or `@secure()` outputs where unavoidable |
| no defaults for secure params | linter rule `secure-parameter-default` |
| third-party secrets (Stripe) | created in Key Vault by a person or script, referenced by apps; not in Bicep |

## Example
`infra/types.bicep`
```bicep
@export()
type ContainerAppSpec = {
  @minLength(2)
  name: string
  image: string
  ingress: ('external' | 'internal' | 'none')
  targetPort: int?
  cpu: string
  memory: string
  minReplicas: int
  maxReplicas: int
  env: { name: string, value: string?, secretRef: string? }[]
}
```
`infra/modules/container-app.bicep`
```bicep
import { ContainerAppSpec } from '../types.bicep'

param spec ContainerAppSpec
param environmentId string
param identityId string
param registryServer string
param tags object

resource app 'Microsoft.App/containerApps@2025-01-01' = {
  name: spec.name
  location: resourceGroup().location
  tags: tags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identityId}': {} } }
  properties: {
    environmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [ { server: registryServer, identity: identityId } ]
      ingress: spec.ingress == 'none' ? null : {
        external: spec.ingress == 'external'
        targetPort: spec.targetPort ?? 8080
        transport: 'auto'
      }
    }
    template: {
      containers: [ {
        name: 'main'
        image: spec.image
        resources: { cpu: json(spec.cpu), memory: spec.memory }
        env: spec.env
        probes: [
          { type: 'Liveness', httpGet: { path: '/health/live', port: spec.targetPort ?? 8080 } }
          { type: 'Readiness', httpGet: { path: '/health/ready', port: spec.targetPort ?? 8080 } }
        ]
      } ]
      scale: { minReplicas: spec.minReplicas, maxReplicas: spec.maxReplicas }
    }
  }
}

output fqdn string = spec.ingress == 'none' ? '' : app.properties.configuration.ingress.fqdn
```
`infra/env/prod.bicepparam`
```bicep
using '../main.bicep'

param env = 'prod'
param sqlSku = { name: 'GP_Gen5', tier: 'GeneralPurpose', capacity: 2 }
param zoneRedundant = true
param apiImage = readEnvironmentVariable('API_IMAGE')               // digest from the build job
param sqlAdminGroupObjectId = readEnvironmentVariable('SQL_ADMIN_GROUP_ID')
param alertEmail = 'oncall@shop.example'
```
A secret only where a resource truly needs one (example: a third-party API key for a Container App secret):
```bicep
// main.bicep
@secure()
param partnerApiKey string
// prod.bicepparam
param partnerApiKey = az.getSecret('<subscription-id>', 'rg-shop-shared', 'kv-shop-shared', 'partner-api-key')
```
Better still: the Container App references the Key Vault secret directly (02-cloud lesson 04), so the value never passes through the deployment.

## Production patterns
- A thin `main.bicep` that wires modules; AVM for standard resources; typed parameters with user-defined types.
- One `.bicepparam` per environment, reviewed like code; differences between environments are visible in one place.
- Almost no secrets in IaC thanks to managed identities; the few that remain are `@secure()` and come from Key Vault references.
- Modules versioned in a private registry once several repos share them.

## Mistakes
Wrong:
```bicep
@secure()
param sqlAdminPassword string = 'P@ssw0rd123!'     // default secret, in Git forever
output connectionString string = 'Server=...;Password=${sqlAdminPassword}'
```
Right: Entra-only SQL with managed identities; no password parameter, no secret outputs.

Wrong: one huge template with `if (env == 'prod')` in 40 places.
Right: parameters that express the differences (`zoneRedundant`, `sqlSku`), set per environment file.

## Check yourself
1. Why use user-defined types for module parameters?
2. What can a `.bicepparam` file do that a JSON parameters file can't?
3. How do you give a template a secret without putting it in Git?

<details><summary>Answers</summary>

1. They give module inputs a checked shape (required and optional properties, allowed values), so mistakes show up in the editor and at build time instead of failing in Azure.
2. It's type-checked against the template (`using`), and it can use expressions such as `readEnvironmentVariable()` and `az.getSecret()` to pull values from the pipeline and Key Vault.
3. Mark the parameter `@secure()` and supply it from Key Vault (`az.getSecret` in the parameter file or a Key Vault reference), or better, avoid the secret entirely with managed identities.
</details>

## Sources
- [Bicep modules](https://learn.microsoft.com/azure/azure-resource-manager/bicep/modules)
- [User-defined data types](https://learn.microsoft.com/azure/azure-resource-manager/bicep/user-defined-data-types)
- [Parameter files (.bicepparam)](https://learn.microsoft.com/azure/azure-resource-manager/bicep/parameter-files)
- [Key Vault secrets in Bicep](https://learn.microsoft.com/azure/azure-resource-manager/bicep/key-vault-parameter)
- [Azure Verified Modules](https://azure.github.io/Azure-Verified-Modules/)
- [Private module registry](https://learn.microsoft.com/azure/azure-resource-manager/bicep/private-module-registry)
