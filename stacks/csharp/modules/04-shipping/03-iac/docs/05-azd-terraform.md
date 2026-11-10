---
title: The Azure Developer CLI and Bicep vs Terraform
tech: Azure Developer CLI (azd), Bicep, Terraform (comparison)
version: azd 1.x, Bicep 0.3x, Terraform 1.1x / OpenTofu 1.x
date: 2026-11-09
covers: [11, 13]
---
# The Azure Developer CLI and Bicep vs Terraform
[← Overview](00-overview.md)

## Why it matters
- New developers needed two days and a wiki page of `az` commands to get a personal Azure environment. With `azd up` it's one command and about fifteen minutes.
- The team generated infrastructure from Aspire with `azd`, never looked at the Bicep, and couldn't add a private endpoint later. Ejecting the Bicep early would have made it theirs.
- A team switched from Bicep to Terraform "because everyone uses it", then spent a sprint on remote state, locking, and provider version issues for an Azure-only app.

## Concepts

### The Azure Developer CLI
`azd` is a developer workflow on top of Bicep (or Terraform): it provisions infrastructure, builds and pushes images, and deploys apps, driven by `azure.yaml`.
| Command | Does |
|:--|:--|
| ⭐ `azd init` | create `azure.yaml` and `infra/` from a template, or detect an existing app (including an Aspire AppHost) |
| ⭐ `azd up` | `package` + `provision` + `deploy` in one go |
| `azd provision` | deploy `infra/main.bicep` with the environment's parameters |
| `azd deploy` | build images, push to ACR, update the Container Apps |
| ⭐ `azd env new <name>` / `azd env select` | separate environments (`dev-ana`, `staging`), each with its own `.azure/<env>/.env` values |
| `azd env set KEY value` | environment values, mapped to Bicep parameters |
| `azd pipeline config` | create a GitHub Actions workflow and set up OIDC federation |
| `azd infra gen` | write the generated Bicep (Aspire apps) to `infra/` so you can own and edit it (formerly `azd infra synth`) |
| `azd down --purge` | delete the environment (and purge soft-deleted Key Vaults) |
| `azd monitor` | open Application Insights / dashboards |

| Good fit | Less good fit |
|:--|:--|
| per-developer and PR environments | complex, multi-team platform infrastructure |
| getting a .NET/Aspire app to Container Apps fast | when you need full control of every deployment step |
| a consistent `up`/`down` workflow | deployment stacks and deny settings (use `az stack` in CI) |

Many teams use `azd` for development environments and plain `az stack` + GitHub Actions for staging and production, sharing the same Bicep.

### Bicep vs Terraform
| | Bicep | Terraform (or OpenTofu) |
|:--|:--|:--|
| scope | Azure only | any provider: Azure, AWS, GCP, GitHub, Cloudflare, Datadog, PagerDuty... |
| ⭐ state | none: Azure is the state | a state file you store, lock, and protect (Azure Storage backend) |
| new Azure features | day one (any API version) | `azurerm` provider releases; `azapi` provider for day-one APIs |
| preview | what-if (some noise) | `plan` (precise, saved plan files) |
| deletion of removed resources | deployment stacks | built in (state knows what it created) |
| refactoring | rename freely; name changes = new resource | `moved` blocks, `terraform state mv` |
| licence | MIT | BSL 1.1 (Terraform), MPL 2.0 (OpenTofu fork) |
| ecosystem | AVM, Azure tooling, azd | huge module registry, many integrations |

| What transfers | Between the two |
|:--|:--|
| ⭐ resource model | both describe the same ARM resources and properties |
| modules and parameters | same ideas: inputs, outputs, environments |
| workflow | preview in PR → approve → apply from CI with OIDC |
| guardrails | Azure Policy, locks, and linting apply to both |

**Terraform wins** when you manage more than Azure (GitHub repos, DNS at Cloudflare, monitoring SaaS), when the team already knows it well, or when you need its precise plans and state-based refactoring. **Bicep wins** for Azure-only teams that want no state to manage and immediate access to new Azure features.

## Example
`azure.yaml`
```yaml
name: shop
metadata:
  template: shop@1.0.0
infra:
  provider: bicep
  path: infra
services:
  api:
    project: ./src/Shop.Api
    language: dotnet
    host: containerapp
    docker:
      path: ./Dockerfile
      context: ../..          # the Dockerfile copies from the repo root
  web:
    project: ./frontend
    language: js
    host: containerapp
    docker:
      path: ./Dockerfile
```
`terminal`
```bash
azd auth login
azd env new dev-ana --location westeurope
azd env set SQL_ADMIN_GROUP_ID "$(az ad group show -g sg-shop-sql-admins --query id -o tsv)"
azd up                     # provision infra/main.bicep, build and push images, deploy both apps
azd deploy api             # after code changes
azd down --purge           # remove the whole dev environment
```
`infra/main.parameters.json` (azd maps environment values to Bicep parameters)
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "env": { "value": "${AZURE_ENV_NAME}" },
    "location": { "value": "${AZURE_LOCATION}" },
    "sqlAdminGroupObjectId": { "value": "${SQL_ADMIN_GROUP_ID}" }
  }
}
```
The same resource in Terraform, for comparison:
```hcl
resource "azurerm_key_vault" "shop" {
  name                       = "kv-shop-prod-abc123"
  location                   = azurerm_resource_group.shop.location
  resource_group_name        = azurerm_resource_group.shop.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true   # azurerm 4.x name; older versions: enable_rbac_authorization
  purge_protection_enabled   = true
}
```

## Production patterns
- `azd` for developer and PR environments (fast `up`/`down`), with Bicep the team owns (`azd infra gen` early for Aspire apps).
- Staging and production deployed by CI with deployment stacks, what-if, and approvals, from the same Bicep files.
- The IaC tool decision is recorded in an ADR (03-backend/11-architecture): Bicep for this Azure-only stack, Terraform if the scope grows beyond Azure.

## Mistakes
Wrong: using generated infrastructure you've never read, then editing resources in the portal when it doesn't fit.
Right: generate once, commit the Bicep, and change it through PRs.

Wrong: choosing Terraform for an Azure-only app without planning for state storage, locking, and access.
Right: weigh state management and provider lag against the benefits; Bicep removes that whole problem for Azure-only infrastructure.

## Check yourself
1. What does `azd up` do?
2. Why might a team use `azd` for dev environments but `az stack` in CI for production?
3. When does Terraform beat Bicep?

<details><summary>Answers</summary>

1. Packages the services (builds images), provisions the infrastructure from `infra/` with the environment's parameters, and deploys the services, in one command.
2. `azd` makes personal and PR environments trivial to create and delete, while production needs deployment stacks with deny settings, what-if reviews, and approvals, which the `az stack` pipeline gives explicitly.
3. When you manage resources beyond Azure (GitHub, Cloudflare, SaaS monitoring), when the team already has strong Terraform skills and tooling, or when precise plans and state-based refactoring (`moved` blocks) matter.
</details>

## Sources
- [Azure Developer CLI overview](https://learn.microsoft.com/azure/developer/azure-developer-cli/overview)
- [azure.yaml schema](https://learn.microsoft.com/azure/developer/azure-developer-cli/azd-schema)
- [azd environments](https://learn.microsoft.com/azure/developer/azure-developer-cli/work-with-environments)
- [Comparing Terraform and Bicep](https://learn.microsoft.com/azure/developer/terraform/comparing-terraform-and-bicep)
- [OpenTofu](https://opentofu.org/)
