---
title: Config & Environments cheatsheet
tech: ASP.NET Core configuration, Options pattern, user-secrets, Azure Key Vault, Docker Compose
version: .NET 10, Azure.Extensions.AspNetCore.Configuration.Secrets 1.x, Microsoft.Azure.AppConfiguration.AspNetCore 8.x, Microsoft.FeatureManagement 4.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Config & Environments cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Principles
| Principle | Meaning | Note |
|:--|:--|:--|
| ⭐ config in the environment | values differ per deploy, code doesn't | 12-factor |
| ⭐ one build, many deploys | same image everywhere | no per-env images |
| parity | same versions and keys across envs | different values |
| defaults visible | every key in `appsettings.json` | empty for secrets |
| validate on start | bad config fails the rollout | |
| secrets ≠ config | different stores and access | |

## Environment name
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ `ASPNETCORE_ENVIRONMENT` | web app environment | wins over `DOTNET_` |
| `DOTNET_ENVIRONMENT` | generic host environment | workers |
| default | `Production` | when nothing is set |
| `app.Environment.IsDevelopment()` | check | also `IsStaging`, `IsProduction`, `IsEnvironment("X")` |
| ⭐ `launchSettings.json` | `dotnet run` / IDE only | not in containers |
| `--no-launch-profile` | ignore launch settings | |
| `--environment Staging` | CLI override | `dotnet run` |

## Providers (default order, later wins)
| # | Provider | Note |
|:--|:--|:--|
| 1 | `appsettings.json` | defaults |
| 2 | `appsettings.{Environment}.json` | non-secret differences |
| 3 | ⭐ user secrets | Development only |
| 4 | ⭐ environment variables | `__` = `:` |
| 5 | command line | `--Section:Key=value` |
| + | Key Vault / App Configuration | added in `Program.cs` |
| `AddJsonFile("x.json", optional: true, reloadOnChange: true)` | extra file | order matters |
| `AddInMemoryCollection(...)` | tests | |
| `GetDebugView()` | which provider won | Development only |

## Keys and access
| Item | Example | Note |
|:--|:--|:--|
| hierarchy | `Payments:TimeoutSeconds` | case-insensitive |
| ⭐ env var form | `Payments__TimeoutSeconds` | double underscore |
| arrays | `Cors:Origins:0` / `Cors__Origins__0` | |
| ⭐ `GetConnectionString("Shop")` | `ConnectionStrings:Shop` | |
| `GetSection("X").Get<T>()` | bind ad hoc | in `Program.cs` only |
| `GetValue<int>("X:Y", 10)` | typed read with default | |
| Key Vault name | `Payments--ApiKey` | `--` = `:` |

## Options pattern
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `AddOptions<T>().BindConfiguration("Section")` | bind section | |
| ⭐ `.ValidateDataAnnotations()` | run attributes | |
| `.Validate(o => …, "message")` | custom rule | |
| ⭐ `.ValidateOnStart()` | fail at startup | |
| `IValidateOptions<T>` | complex validator class | |
| `[OptionsValidator]` partial class | source-generated validator | .NET 8+, AOT |
| `[ValidateObjectMembers]` / `[ValidateEnumeratedItems]` | nested validation | |
| `.PostConfigure(...)` | adjust after binding | deprecations |
| `Configure<T>(section)` | older bind style | no validation chain |
| `EnableConfigurationBindingGenerator` | reflection-free binding | .NET 8+ |
| `OptionsValidationException` | thrown on failure | message lists members |

## Options interfaces
| Interface | Lifetime | Reload |
|:--|:--|:--|
| ⭐ `IOptions<T>` | singleton | no |
| `IOptionsSnapshot<T>` | scoped | per request |
| ⭐ `IOptionsMonitor<T>` | singleton | `CurrentValue`, `OnChange` |
| named options | `Get("name")` | several instances of one type |
| `Options.Create(value)` | tests | wrap a value |

## Secrets
| Item | Use | Note |
|:--|:--|:--|
| ⭐ `dotnet user-secrets init` / `set` / `list` / `remove` | local secrets | `UserSecretsId` in csproj |
| user secrets path | `%APPDATA%\Microsoft\UserSecrets\<id>\secrets.json` | outside repo |
| `.env` + `.env.example` | Compose / Next.js | ignore `.env` |
| ⭐ Key Vault | cloud secrets | RBAC, versions |
| ⭐ managed identity | no secret | SQL, Storage, Service Bus, Key Vault |
| rotation | overlap old + new | then revoke |
| ⭐ `Key Vault Secrets User` | read role | scope to one vault |
| Container Apps `keyvaultref:` | secret from Key Vault | refresh on restart |

## Azure Key Vault provider
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `AddAzureKeyVault(uri, credential, options)` | load secrets as config | Azure.Extensions.AspNetCore.Configuration.Secrets |
| `ReloadInterval` | re-read secrets | rotation |
| `KeyVaultSecretManager` | filter/rename secrets | prefixes per app |
| ⭐ `DefaultAzureCredential` | credential chain | `az login` locally, MI in Azure |
| `ManagedIdentityCredential` | MI only | predictable in prod |
| `AZURE_CLIENT_ID` | pick user-assigned MI | env var |

## Azure App Configuration
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `AddAzureAppConfiguration(o => o.Connect(uri, cred))` | load settings | managed identity |
| `.Select("Shop:*", label)` | filter keys, label per env | |
| `.ConfigureRefresh(r => r.RegisterAll().SetRefreshInterval(...))` | dynamic refresh | |
| `AddAzureAppConfiguration()` + `UseAzureAppConfiguration()` | refresh middleware | |
| `.ConfigureKeyVault(...)` | resolve Key Vault references | |
| `.UseFeatureFlags()` | load flags | |
| labels | per environment values | |
| snapshots | immutable config set | roll back |
| history / audit | who changed what | |

## Feature flags
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `AddFeatureManagement()` | services | Microsoft.FeatureManagement.AspNetCore |
| ⭐ `IFeatureManager.IsEnabledAsync("X")` | check flag | |
| `feature_management.feature_flags` | config schema | v2 schema; `FeatureManagement` also works |
| `Microsoft.Percentage` | % of evaluations | |
| `Microsoft.TimeWindow` | on between dates | |
| `Microsoft.Targeting` | users, groups, rollout % | sticky per user |
| `IVariantFeatureManager` | variants / experiments | |
| `[FeatureGate("X")]` | gate MVC actions | controllers |
| release vs ops vs experiment | flag kinds | release flags get removed |
| ⭐ kill switch | disable risky feature fast | test it |

## Docker Compose
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `compose.yaml` | services file | Compose v2 |
| `docker compose up -d` / `ps` / `logs -f` | run / status / logs | |
| `docker compose down` / `down -v` | stop / stop + delete volumes | |
| ⭐ `healthcheck` | readiness test | |
| ⭐ `depends_on: x: condition: service_healthy` | start order | |
| `profiles: [app]` | optional services | `--profile app` |
| `${VAR:?message}` | required variable | from `.env` |
| `compose.override.yaml` | local overrides | auto-merged |
| `develop.watch` | sync/rebuild on change | `docker compose watch` |
| `127.0.0.1:1433:1433` | localhost-only port | |
| named volumes | persistent data | |

## Local service images
| Service | Image | Note |
|:--|:--|:--|
| ⭐ SQL Server 2025 | `mcr.microsoft.com/mssql/server:2025-latest` | `ACCEPT_EULA`, `MSSQL_SA_PASSWORD` |
| sqlcmd in image | `/opt/mssql-tools18/bin/sqlcmd -C` | `-C` trusts the self-signed cert |
| Redis 8 | `redis:8` | `redis-cli ping` |
| Azurite | `mcr.microsoft.com/azure-storage/azurite` | ports 10000–10002 |
| Service Bus emulator | `mcr.microsoft.com/azure-messaging/servicebus-emulator` | needs its own SQL container |

## Frontend config
| Item | Visible | Fixed |
|:--|:--|:--|
| ⭐ `NEXT_PUBLIC_*` | browser | build time |
| server env vars | Server Components, route handlers | runtime |
| ⭐ `proxy.ts` rewrite to `API_URL` | same-origin `/api` | per request |
| `next.config` `rewrites()` | build-time serialized (standalone) | not for per-env URLs |
| runtime config endpoint | public per-env values | |

## Changing config safely
| Practice | How | Note |
|:--|:--|:--|
| PR review | `appsettings*.json`, IaC | |
| ⭐ expand → migrate → contract | key renames | log deprecation |
| snapshots / labels | roll back config | App Configuration |
| audit | App Config history, Key Vault logs, Activity Log | |
| log config version at startup | correlate incidents | |
| gradual rollout | flags, one env at a time | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `Section_Key` env var | ignored | `Section__Key` |
| No `ASPNETCORE_ENVIRONMENT` | Production defaults | set it explicitly |
| Secrets in `launchSettings.json` | committed | user-secrets |
| `IConfiguration` in services | typos, no validation | options |
| `IOptionsSnapshot` in singleton | startup error | `IOptionsMonitor` |
| No `ValidateOnStart` | fails on first request | validate on start |
| `depends_on` without health | race on startup | `service_healthy` |
| `NEXT_PUBLIC_` per env | baked into image | runtime proxy |
| Key Vault client secret | secret zero | managed identity |
| `GetDebugView()` in prod | prints secrets | Development only |

## Sources
| Source | Link |
|:--|:--|
| Configuration | https://learn.microsoft.com/aspnet/core/fundamentals/configuration/ |
| Options pattern | https://learn.microsoft.com/aspnet/core/fundamentals/configuration/options |
| Environments | https://learn.microsoft.com/aspnet/core/fundamentals/environments |
| User secrets | https://learn.microsoft.com/aspnet/core/security/app-secrets |
| Key Vault provider | https://learn.microsoft.com/aspnet/core/security/key-vault-configuration |
| App Configuration provider | https://learn.microsoft.com/azure/azure-app-configuration/reference-dotnet-provider |
| Feature management | https://learn.microsoft.com/azure/azure-app-configuration/feature-management-dotnet-reference |
| Compose file | https://docs.docker.com/reference/compose-file/ |
| 12-factor config | https://12factor.net/config |
