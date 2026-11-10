---
title: State, what-if, deployment stacks, and safe refactoring
tech: Bicep, Azure Resource Manager, deployment stacks, Azure CLI
version: Bicep 0.3x, Azure CLI 2.7x
date: 2026-11-09
covers: [3, 4, 8]
---
# State, what-if, deployment stacks, and safe refactoring
[← Overview](00-overview.md)

## Why it matters
- A module was removed from `main.bicep`, and everyone assumed the Redis cache would be deleted. Incremental deployments leave unmanaged resources alone, so it ran (and billed) for months.
- Someone ran a complete-mode deployment against the wrong resource group. Everything not in the template was deleted, including a database another team owned.
- A storage account's `name` was "tidied up" in a PR. The deploy created a new, empty account; the app switched to it, and every product image disappeared.

## Concepts

### State in Bicep
| Fact | Consequence |
|:--|:--|
| ⭐ no state file | Azure Resource Manager (ARM) is the source of truth; nothing to store, lock, or corrupt |
| ⭐ declarative + idempotent | deploying the same template twice changes nothing the second time |
| ⭐ incremental mode (default) | resources in the template are created/updated; resources **not** in the template are left alone |
| complete mode | deletes resources in the resource group that aren't in the template; avoid, use deployment stacks |
| identity of a resource | its **resource ID** (type + name + scope); the symbolic name in Bicep doesn't matter to Azure |
| deployment history | each deployment is recorded on the scope (up to 800 per resource group; old ones are cleaned up) |

### What-if and the deploy workflow
| Step | Command |
|:--|:--|
| ⭐ preview changes | `az deployment group what-if -g rg --template-file main.bicep --parameters prod.bicepparam` |
| change types | Create, Delete (complete mode/stacks), Modify, NoChange, Ignore, Deploy (unknown), NoEffect |
| ⭐ in PRs | CI runs what-if against each environment and posts the diff as a PR comment |
| ⭐ deploy from CI only | people don't deploy to production from laptops |
| confirm interactively | `az deployment group create ... --confirm-with-what-if` (local use) |
| read the diff | look for Delete and Modify on stateful resources (SQL, storage, Key Vault) and on `name`/`location` |

What-if has noise: some properties always show as Modify (read-only or normalised values). Learn the usual noise for your templates so real changes stand out.

### Deployment stacks
A **deployment stack** is an Azure resource that tracks the set of resources a template manages.
| Feature | Meaning |
|:--|:--|
| ⭐ managed resources | everything the template deployed is tracked by the stack |
| ⭐ `--action-on-unmanage` | what happens to resources removed from the template: `detachAll` (keep, untrack), `deleteResources`, `deleteAll` (also resource groups) |
| ⭐ deny settings | `denyDelete` or `denyWriteAndDelete` on managed resources, so portal or CLI changes outside the stack are blocked |
| excluded principals/actions | let the pipeline identity or specific actions through deny settings |
| scopes | resource group, subscription, management group |

### Refactoring safely
| Change | Effect on Azure | Safe approach |
|:--|:--|:--|
| rename the symbolic name (`resource kv ...` → `resource vault ...`) | none | free |
| move a resource into a module | none (same resource ID) | check what-if shows NoChange |
| ⭐ change the `name` property | **new resource**; old one left (incremental) or deleted (stack with delete) | treat as a migration: create new, move data, switch, delete old |
| change `location` or immutable properties | deploy fails or replaces | new resource + migration |
| remove a resource from code | left alone (incremental) / per `actionOnUnmanage` (stack) | use `detachAll` during refactors, then `deleteResources` |
| split a stack into two | resources move between stacks | detach in the old stack first |
| ⭐ protect stateful resources | | `CanNotDelete` locks on SQL, storage, Key Vault, plus deny settings |

## Example
`terminal` (what-if, then deploy the stack)
```bash
az deployment group what-if -g rg-shop-prod-weu \
  --template-file infra/main.bicep --parameters infra/env/prod.bicepparam \
  --result-format FullResourcePayloads

az stack group create --name stack-shop -g rg-shop-prod-weu \
  --template-file infra/main.bicep --parameters infra/env/prod.bicepparam \
  --action-on-unmanage deleteResources \
  --deny-settings-mode denyDelete \
  --deny-settings-excluded-principals "$PIPELINE_PRINCIPAL_ID" \
  --yes
```
`infra/modules/locks.bicep` (extra protection for data)
```bicep
param sqlServerName string
param storageName string

resource sql 'Microsoft.Sql/servers@2023-08-01' existing = { name: sqlServerName }
resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' existing = { name: storageName }

resource sqlLock 'Microsoft.Authorization/locks@2020-05-01' = {
  name: 'no-delete-sql'
  scope: sql
  properties: { level: 'CanNotDelete', notes: 'Production data. Remove only through an approved change.' }
}

resource storageLock 'Microsoft.Authorization/locks@2020-05-01' = {
  name: 'no-delete-storage'
  scope: storage
  properties: { level: 'CanNotDelete', notes: 'Production files.' }
}
```
Renaming a storage account safely, in steps:
1. Add the new account (`stshopprod2...`) next to the old one; deploy.
2. Copy data (`azcopy copy` between containers), switch the app's configuration, verify.
3. Remove the old account from code with the stack on `detachAll`, check, then delete it deliberately (lock removed by an approved change).

## Production patterns
- Every environment is a deployment stack with `deleteResources` on unmanage and `denyDelete` (pipeline identity excluded); stateful resources also carry `CanNotDelete` locks.
- What-if runs in every infra PR and the diff is reviewed like code; deletes or name changes on data resources need a second reviewer.
- Production deploys only from CI; nobody has standing write access to production resource groups.
- Renames and moves of stateful resources are planned migrations, never a one-line PR.

## Mistakes
Wrong: `az deployment group create --mode Complete` to "clean up".
Right: a deployment stack with an explicit `--action-on-unmanage`, reviewed with what-if.

Wrong: changing `name: 'stshopprod'` to `name: 'stshopprodweu'` in a PR titled "naming cleanup".
Right: a migration plan (new resource, copy, switch, retire), or leave the name alone.

## Check yourself
1. What happens to a resource you delete from a Bicep file in incremental mode?
2. What do deny settings on a deployment stack protect against?
3. Which Bicep changes create a new resource in Azure?

<details><summary>Answers</summary>

1. Nothing: incremental deployments don't delete resources that aren't in the template. It keeps running unmanaged (and costing money) unless a deployment stack with a delete action, or a person, removes it.
2. Changes made outside the stack (portal, CLI, other pipelines) such as deleting or modifying the managed resources, except by excluded principals like the deploying pipeline.
3. Changing the resource's `name` (or parent, type, or scope), because those make up its resource ID. Changing the symbolic name or moving it into a module doesn't.
</details>

## Sources
- [Bicep deployment modes](https://learn.microsoft.com/azure/azure-resource-manager/templates/deployment-modes)
- [What-if operation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-what-if)
- [Deployment stacks](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deployment-stacks)
- [Lock resources](https://learn.microsoft.com/azure/azure-resource-manager/management/lock-resources)
- [Azure Resource Manager deployment history](https://learn.microsoft.com/azure/azure-resource-manager/templates/deployment-history)
