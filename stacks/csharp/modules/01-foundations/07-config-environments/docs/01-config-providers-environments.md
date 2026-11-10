---
title: Twelve-factor config, environments, and how ASP.NET Core loads configuration
tech: ASP.NET Core configuration, Microsoft.Extensions.Hosting
version: .NET 10
date: 2026-11-09
covers: [1, 2, 3, 13]
---
# Twelve-factor config, environments, and how ASP.NET Core loads configuration
[← Overview](00-overview.md)

## Why it matters
- Separate Docker images are built for staging and production "because the config is different". Production then runs an image nobody tested.
- Production runs with `ASPNETCORE_ENVIRONMENT` unset; the team assumes Development settings are off, but a `launchSettings.json` habit made them think the default was Development.
- A setting in `appsettings.Staging.json` silently overrides an environment variable because someone added the JSON file **after** the environment variables in code.

## Concepts

### Twelve-factor config
- Config = everything that differs between deploys (URLs, credentials, limits, flags). Code = everything else.
- **One build, many deploys:** the same image runs everywhere; config comes from the environment at runtime.
- Strict test: could you open-source the repo right now without leaking a credential?

### Environments and parity
| Environment | Purpose | Data |
|:--|:--|:--|
| local | develop | Compose containers, seed data |
| test (CI) | automated tests | Testcontainers, throwaway |
| preview | per-PR deploy (optional) | synthetic |
| staging | production rehearsal | production-like, never raw production data |
| production | users | real |

Parity: same SQL Server major version (2025 locally ↔ Azure SQL), same Redis major, same container image, same config **keys** (different values). Differences are where "works in staging" bugs live.

### The environment name
| Variable | Read by | Default |
|:--|:--|:--|
| `ASPNETCORE_ENVIRONMENT` | web apps (`WebApplication`) | — |
| `DOTNET_ENVIRONMENT` | generic host (workers) and web apps | — |
| none set | | **Production** |

In web apps, `ASPNETCORE_ENVIRONMENT` wins over `DOTNET_ENVIRONMENT`. Built-in names: `Development`, `Staging`, `Production` (`app.Environment.IsDevelopment()`). Custom names work too (`IsEnvironment("Testing")`).

`Properties/launchSettings.json` sets `ASPNETCORE_ENVIRONMENT=Development` and URLs **only** for `dotnet run` / IDE launches. It is not used by `dotnet publish`, containers, or Azure. Never put secrets in it.

### Provider order (later wins)
| # | Provider | Example | Notes |
|:--|:--|:--|:--|
| 1 | `appsettings.json` | `"Payments": { "TimeoutSeconds": 10 }` | committed safe defaults |
| 2 | `appsettings.{Environment}.json` | `appsettings.Production.json` | committed, no secrets |
| 3 | user secrets | `dotnet user-secrets set "Payments:ApiKey" "sk_test_..."` | Development only |
| 4 | environment variables | `Payments__TimeoutSeconds=5` | `__` = `:` |
| 5 | command-line args | `--Payments:TimeoutSeconds=3` | |
| 6+ | anything you add after build | Key Vault, App Configuration | added in `Program.cs` |

Keys are case-insensitive. Hierarchy uses `:` in JSON paths and `__` (double underscore) in environment variables. `ConnectionStrings:Shop` is read by `builder.Configuration.GetConnectionString("Shop")`.

Debug what the app actually sees:
```csharp
if (app.Environment.IsDevelopment())
    app.MapGet("/debug/config", (IConfiguration c) =>
        ((IConfigurationRoot)c).GetDebugView());     // shows each key and which provider won
```
Never expose this outside Development: it prints secrets.

## Example
`src/Shop.Api/appsettings.json`
```json
{
  "Logging": { "LogLevel": { "Default": "Information", "Microsoft.AspNetCore": "Warning" } },
  "Payments": { "BaseUrl": "https://api.stripe.com", "TimeoutSeconds": 10 },
  "ConnectionStrings": { "Shop": "" }
}
```
`src/Shop.Api/appsettings.Development.json`
```json
{
  "Logging": { "LogLevel": { "Default": "Debug" } },
  "ConnectionStrings": { "Shop": "Server=localhost,1433;Database=shop;User Id=sa;TrustServerCertificate=true" }
}
```
`terminal`
```bash
dotnet user-secrets set "ConnectionStrings:Shop" "Server=localhost,1433;Database=shop;User Id=sa;Password=Local_dev_1;TrustServerCertificate=true" --project src/Shop.Api
ASPNETCORE_ENVIRONMENT=Staging Payments__TimeoutSeconds=5 dotnet run --project src/Shop.Api --no-launch-profile
```
Container Apps (or any host) sets the same keys as environment variables:
```bash
az containerapp update -n ca-shop-api -g rg-shop \
  --set-env-vars ASPNETCORE_ENVIRONMENT=Production Payments__TimeoutSeconds=5
```

## Production patterns
- `appsettings.json` holds every key with a safe default (or empty), so the full set of keys is visible in one file.
- Environment-specific JSON only for non-secret differences; secrets never in any JSON file.
- Production values via environment variables and Key Vault (lesson 03); the image is identical across environments.
- Set `ASPNETCORE_ENVIRONMENT` explicitly everywhere, including Production, so nobody guesses.

## Mistakes
Wrong: one image per environment.
```dockerfile
COPY appsettings.Production.json appsettings.json
```
Right: one image; `ASPNETCORE_ENVIRONMENT` and environment variables choose behavior.

Wrong: single underscore in environment variables.
```bash
ConnectionStrings_Shop="..."      # ignored
```
Right:
```bash
ConnectionStrings__Shop="..."
```

## Check yourself
1. Which environment does an ASP.NET Core app use if no variable is set?
2. A key is in `appsettings.Production.json` and in an environment variable. Which value wins?
3. Why doesn't `launchSettings.json` affect a container?

<details><summary>Answers</summary>

1. Production.
2. The environment variable; it is added after the JSON files.
3. It's only read by `dotnet run` and IDE launch profiles; published apps and containers ignore it.
</details>

## Sources
- [Configuration in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/configuration/)
- [Use multiple environments in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/environments)
- [The Twelve-Factor App](https://12factor.net/)
- [Environment variables configuration provider](https://learn.microsoft.com/dotnet/core/extensions/configuration-providers#environment-variable-configuration-provider)
