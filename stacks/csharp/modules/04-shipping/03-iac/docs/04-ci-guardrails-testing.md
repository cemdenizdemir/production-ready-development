---
title: CI with OIDC, guardrails, and testing
tech: GitHub Actions, azure/login (OIDC), Azure Policy, resource locks, Bicep linter, PSRule for Azure
version: azure/login v2, PSRule.Rules.Azure 1.x, Bicep 0.3x
date: 2026-11-09
covers: [9, 10, 12]
---
# CI with OIDC, guardrails, and testing
[← Overview](00-overview.md)

## Why it matters
- The pipeline authenticated with a client secret stored in GitHub. It expired on a Friday evening and every deployment failed until someone with admin rights renewed it.
- A change to a storage account passed review because nobody noticed `allowBlobPublicAccess: true` in a 300-line diff. A policy would have blocked it at deploy time.
- Drift went unnoticed for months: someone had opened the SQL firewall in the portal. A nightly what-if would have reported it the next morning.

## Concepts

### Bicep in CI with OIDC
| Piece | Practice |
|:--|:--|
| ⭐ workload identity federation | GitHub's OIDC token is exchanged for an Azure token; no client secret exists |
| ⭐ federated credential subject | trust only specific contexts: `repo:org/shop:environment:production`, `repo:org/shop:pull_request` |
| identity | a user-assigned managed identity (or app registration) per environment, with the least role needed |
| ⭐ `permissions: id-token: write` | lets the job request the OIDC token |
| ⭐ GitHub environments | `staging`, `production` with required reviewers and branch rules |
| PR job | lint, build, PSRule, what-if with a **read-only** identity, post the diff |
| deploy job | `az stack group create` with the deploy identity, after approval for production |

Roles for the deploy identity: `Contributor` on the environment's resource groups plus `Role Based Access Control Administrator` (constrained to the roles your templates assign), or `Owner` scoped narrowly. The what-if identity only needs `Reader` plus what-if permissions.

### Guardrails
| Guardrail | Stops |
|:--|:--|
| ⭐ Azure Policy (deny) | non-compliant resources anywhere: public blob access, SQL without Entra-only, disallowed regions or SKUs |
| Azure Policy (audit / deployIfNotExists) | report non-compliance; add diagnostic settings automatically |
| ⭐ resource locks (`CanNotDelete`) | accidental deletion of stateful resources |
| deployment stack deny settings | changes outside the stack |
| ⭐ Bicep linter (`bicepconfig.json`) | hard-coded URLs, secret defaults, unused params, old API versions |
| ⭐ scheduled what-if | drift: changes made outside IaC |
| PIM / no standing access | people changing production by hand |

### Testing infrastructure code
| Level | Tool | Checks |
|:--|:--|:--|
| ⭐ lint | `az bicep build` / `bicep lint` with `bicepconfig.json` | syntax, best-practice rules |
| ⭐ rules | PSRule for Azure | Well-Architected rules (TLS, zone redundancy, diagnostics, identities) on the expanded template |
| ⭐ what-if | `az deployment group what-if` | the real diff against Azure |
| validate | `az deployment group validate` | ARM validation (quotas, names) without deploying |
| test deployment | ephemeral resource group / PR environment | it actually deploys and the app works |
| smoke tests | after deploy: health endpoints, a synthetic request | the environment is usable |

## Example
`bicepconfig.json`
```json
{
  "analyzers": {
    "core": {
      "rules": {
        "no-hardcoded-env-urls": { "level": "error" },
        "secure-parameter-default": { "level": "error" },
        "outputs-should-not-contain-secrets": { "level": "error" },
        "use-recent-api-versions": { "level": "warning" },
        "no-unused-params": { "level": "error" },
        "use-secure-value-for-secure-inputs": { "level": "error" }
      }
    }
  }
}
```
`.github/workflows/infra.yml`
```yaml
name: infra
on:
  pull_request: { paths: ["infra/**"] }
  push: { branches: [main], paths: ["infra/**"] }
  schedule: [{ cron: "0 5 * * *" }]            # nightly drift check

permissions:
  id-token: write
  contents: read
  pull-requests: write

jobs:
  check:
    runs-on: ubuntu-latest
    environment: infra-read                     # federated credential: read-only identity
    steps:
      - uses: actions/checkout@v5
      - run: az bicep build --file infra/main.bicep
      - uses: microsoft/ps-rule@v2
        with: { modules: PSRule.Rules.Azure, inputPath: infra/ }
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      - name: what-if (prod)
        run: |
          az deployment group what-if -g rg-shop-prod-weu \
            --template-file infra/main.bicep --parameters infra/env/prod.bicepparam \
            --exclude-change-types NoChange Ignore > whatif.txt
          cat whatif.txt
      # post whatif.txt as a PR comment (e.g. with actions/github-script); on schedule, fail if it shows changes

  deploy-prod:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: check
    runs-on: ubuntu-latest
    environment: production                     # required reviewers
    steps:
      - uses: actions/checkout@v5
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      - run: |
          az stack group create --name stack-shop -g rg-shop-prod-weu \
            --template-file infra/main.bicep --parameters infra/env/prod.bicepparam \
            --action-on-unmanage deleteResources --deny-settings-mode denyDelete --yes
```
Federated credential for the production environment (one-time setup):
```bash
az identity federated-credential create -g rg-shop-identities --identity-name id-gh-shop-prod --name gh-prod \
  --issuer https://token.actions.githubusercontent.com \
  --subject repo:my-org/shop:environment:production \
  --audiences api://AzureADTokenExchange
```
A policy assignment that denies public blob access (Bicep, subscription scope):
```bicep
targetScope = 'subscription'
resource noPublicBlobs 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'deny-public-blob-access'
  properties: {
    displayName: 'Storage accounts should prevent public blob access'
    policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/4fa4b6c0-31ca-4c0d-b10d-24b96f62a751'
    parameters: { effect: { value: 'Deny' } }
  }
}
```
Check the built-in definition's ID and allowed effects in the portal before assigning; many built-ins default to `Audit`.

## Production patterns
- OIDC everywhere: one federated identity per environment, subjects pinned to repo and environment, no client secrets.
- PRs show lint, PSRule, and what-if results; production deploys need an approval in the GitHub environment.
- Policies deny the dangerous settings at the subscription or management group, so a bad template fails even if review misses it.
- A nightly what-if reports drift; locks and stack deny settings make most drift impossible in the first place.

## Mistakes
Wrong: `AZURE_CREDENTIALS` JSON with a client secret in GitHub secrets.
Right: `azure/login@v2` with OIDC, `id-token: write`, and a federated credential scoped to the environment.

Wrong: relying on review alone to catch insecure settings.
Right: linter + PSRule in CI, Azure Policy deny at deploy time.

## Check yourself
1. What does the federated credential's subject control?
2. What does Azure Policy catch that PR review might not?
3. Name three checks that run before infrastructure reaches production.

<details><summary>Answers</summary>

1. Which GitHub workflow contexts may get a token for that identity (repository plus branch, environment, tag, or pull request). A subject for `environment:production` means only jobs in that GitHub environment can deploy with it.
2. Any non-compliant resource, from any template, script, or portal change, at deploy time, even when a reviewer misses the setting in a large diff.
3. Bicep build/lint, PSRule for Azure rules, and what-if against the target environment (plus validate, a test deployment, and an approval).
</details>

## Sources
- [Deploy Bicep with GitHub Actions](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-github-actions)
- [Use OIDC with azure/login](https://learn.microsoft.com/azure/developer/github/connect-from-azure-openid-connect)
- [Bicep linter](https://learn.microsoft.com/azure/azure-resource-manager/bicep/linter)
- [PSRule for Azure](https://azure.github.io/PSRule.Rules.Azure/)
- [Azure Policy overview](https://learn.microsoft.com/azure/governance/policy/overview)
- [Lock resources](https://learn.microsoft.com/azure/azure-resource-manager/management/lock-resources)
