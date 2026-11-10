---
title: Infrastructure as Code cheatsheet
tech: Bicep, Azure Developer CLI (azd), GitHub Actions
version: Bicep 0.3x, azd 1.x, Azure CLI 2.7x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Infrastructure as Code cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Why IaC
| Benefit | Meaning | Note |
|:--|:--|:--|
| ⭐ reviewable | PR + diff | what-if |
| ⭐ repeatable | same code, all envs | params differ |
| ⭐ recoverable | rebuild from code | + data backups |
| ⭐ drift visible | what-if vs reality | nightly |
| inventory | code documents infra | |

## Bicep syntax
| Element | Example | Note |
|:--|:--|:--|
| ⭐ resource | `resource kv 'Microsoft.KeyVault/vaults@2024-11-01' = {...}` | type@apiVersion |
| ⭐ param | `param env string` | decorators |
| `@allowed([...])`, `@minLength()`, `@description()` | param rules | |
| ⭐ `@secure()` | hide value | no defaults |
| var | `var tags = {...}` | |
| ⭐ output | `output uri string = kv.properties.vaultUri` | no secrets |
| ⭐ `existing` | reference, don't deploy | |
| ⭐ loop | `[for x in xs: {...}]` | |
| ⭐ condition | `= if (cond) {...}` | |
| `parent:` | child resource | |
| `scope:` | other scope | locks, RBAC |
| `targetScope` | RG / subscription / MG | |
| `??`, `?.` | null handling | |
| `guid(...)` | deterministic names | role assignments |
| `uniqueString(resourceGroup().id)` | stable suffix | |

## Types and modules
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `module x 'path.bicep' = {...}` | reuse | outputs via `x.outputs` |
| ⭐ `type T = {...}` | user-defined type | typed params |
| `@export()` / `import {T} from '...'` | share types | |
| `@sealed()`, `@discriminator()` | strict objects | |
| ⭐ AVM | `br/public:avm/res/...:<version>` | Microsoft modules |
| private registry | `br:crshop.azurecr.io/bicep/...` | versioned |
| `az bicep publish` | push module | |

## Parameter files
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `.bicepparam` | typed params | `using './main.bicep'` |
| `readEnvironmentVariable('X')` | from pipeline env | |
| ⭐ `az.getSecret(sub, rg, kv, name)` | Key Vault value | secure params |
| one file per env | `env/prod.bicepparam` | |
| `main.parameters.json` | azd mapping | `${AZURE_ENV_NAME}` |

## Deployment commands
| Command | Does | Note |
|:--|:--|:--|
| `az bicep build --file x.bicep` | compile + lint | |
| ⭐ `az deployment group what-if ...` | preview | `--exclude-change-types NoChange` |
| `az deployment group validate ...` | ARM validation | |
| `az deployment group create ...` | deploy (incremental) | |
| `--confirm-with-what-if` | interactive confirm | local |
| `az deployment sub create -l ...` | subscription scope | |
| `--mode Complete` | delete unlisted | avoid; use stacks |

## State model
| Fact | Effect | Note |
|:--|:--|:--|
| ⭐ no state file | ARM is truth | |
| ⭐ incremental default | removed resources stay | |
| idempotent | redeploy = no change | |
| ⭐ resource ID | type + name + scope | name change = new resource |
| deployment history | per scope | auto-cleaned |

## Deployment stacks
| Option | Does | Note |
|:--|:--|:--|
| ⭐ `az stack group create` | deploy as a stack | also `sub`, `mg` |
| ⭐ `--action-on-unmanage detachAll` | keep removed resources | refactors |
| `deleteResources` | delete removed resources | |
| `deleteAll` | also resource groups | careful |
| ⭐ `--deny-settings-mode denyDelete` | block deletes outside stack | |
| `denyWriteAndDelete` | block changes too | |
| `--deny-settings-excluded-principals` | let pipeline through | |
| `az stack group show/delete` | manage | |

## Refactoring
| Change | Effect | Safe way |
|:--|:--|:--|
| symbolic name | none | free |
| move into module | none | check what-if |
| ⭐ `name` property | new resource | migration plan |
| location | replace/fail | migration |
| remove from code | per mode | `detachAll` first |
| ⭐ `CanNotDelete` lock | blocks deletes | stateful resources |

## CI with OIDC
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `permissions: id-token: write` | OIDC token | |
| ⭐ `azure/login@v2` | client/tenant/subscription IDs | no secret |
| ⭐ federated credential subject | `repo:org/repo:environment:production` | per env |
| `az identity federated-credential create` | set up trust | MI |
| ⭐ GitHub environments | approvals | production |
| read-only what-if identity | PR jobs | `Reader` |
| deploy identity | Contributor + RBAC admin (constrained) | |
| `azd pipeline config` | generate workflow + OIDC | |

## Guardrails
| Guardrail | Stops | Note |
|:--|:--|:--|
| ⭐ Azure Policy deny | non-compliant resources | MG/subscription |
| audit / deployIfNotExists | report, auto-fix | diagnostics |
| ⭐ resource locks | deletes | data resources |
| stack deny settings | out-of-band changes | |
| ⭐ scheduled what-if | drift | nightly |
| PIM | standing access | |

## Linter and tests
| Tool | Checks | Note |
|:--|:--|:--|
| ⭐ `bicepconfig.json` | linter levels | error in CI |
| `no-hardcoded-env-urls` | portable URLs | |
| `secure-parameter-default` | no secret defaults | |
| `outputs-should-not-contain-secrets` | no secret outputs | |
| `use-recent-api-versions` | fresh APIs | |
| ⭐ PSRule for Azure | WAF rules | `microsoft/ps-rule@v2` |
| what-if | real diff | |
| test deployment | ephemeral RG | PR envs |
| smoke tests | health after deploy | |

## azd
| Command | Does | Note |
|:--|:--|:--|
| ⭐ `azd init` | scaffold / detect | Aspire too |
| ⭐ `azd up` | package + provision + deploy | |
| `azd provision` | infra only | |
| `azd deploy [svc]` | apps only | |
| ⭐ `azd env new/select/set` | environments | `.azure/<env>/.env` |
| `azd infra gen` | eject Bicep | was `infra synth` |
| `azd pipeline config` | CI + OIDC | |
| `azd down --purge` | delete env | purge KV |
| `azure.yaml` | services, hosts | `host: containerapp` |

## Bicep vs Terraform
| Topic | Bicep | Terraform |
|:--|:--|:--|
| scope | Azure | any provider |
| ⭐ state | none | state file + locking |
| new Azure APIs | day one | `azapi` for day one |
| preview | what-if | plan |
| deletions | stacks | built in |
| refactor | name = identity | `moved` blocks |
| licence | MIT | BSL (OpenTofu: MPL) |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| portal fixes | drift, lost changes | code + PR |
| complete mode | deletes others' resources | stacks |
| renaming `name` | new empty resource | migration |
| removed resource still billing | incremental mode | stacks with delete |
| secret defaults | secrets in Git | `@secure()`, KV |
| client secrets in CI | expiry, leaks | OIDC |
| giant main.bicep | inconsistent fixes | modules |
| what-if noise ignored | real changes missed | learn the noise |
| generated Bicep unread | can't customise | `azd infra gen` early |
| no locks on data | accidental deletes | `CanNotDelete` |

## Sources
| Source | Link |
|:--|:--|
| Bicep overview | https://learn.microsoft.com/azure/azure-resource-manager/bicep/overview |
| Bicep best practices | https://learn.microsoft.com/azure/azure-resource-manager/bicep/best-practices |
| What-if | https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-what-if |
| Deployment stacks | https://learn.microsoft.com/azure/azure-resource-manager/bicep/deployment-stacks |
| Parameter files | https://learn.microsoft.com/azure/azure-resource-manager/bicep/parameter-files |
| AVM | https://azure.github.io/Azure-Verified-Modules/ |
| Bicep + GitHub Actions | https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-github-actions |
| PSRule for Azure | https://azure.github.io/PSRule.Rules.Azure/ |
| azd | https://learn.microsoft.com/azure/developer/azure-developer-cli/overview |
| Terraform vs Bicep | https://learn.microsoft.com/azure/developer/terraform/comparing-terraform-and-bicep |
