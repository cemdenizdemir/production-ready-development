---
title: Config & Environments
module: 01-foundations
tech: ASP.NET Core configuration, Options pattern, user-secrets, Azure Key Vault, Docker Compose
---
# Config & Environments
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Twelve-factor config: config in the environment, one build for every environment
- [ ] ⭐ Environments: local, test, preview, staging, production, and parity between them
- [ ] ⭐ Configuration providers in ASP.NET Core: `appsettings.json`, `appsettings.{Environment}.json`, environment variables, command line, and their order
- [ ] ⭐ Validating config at startup with the Options pattern: DataAnnotations, `ValidateOnStart`, clear errors
- [ ] Typed config with `IOptions<T>`, `IOptionsSnapshot<T>`, and `IOptionsMonitor<T>`; no `IConfiguration` lookups scattered through the code
- [ ] Local secrets with `dotnet user-secrets`; `.env` and `.env.example` for Compose and the frontend, and what never goes in them
- [ ] Secrets vs config: secret managers, runtime injection, rotation without downtime
- [ ] Docker Compose for local environments: services, healthchecks, profiles, overrides
- [ ] Feature flags and runtime config vs build-time config
- [ ] Frontend config: public vs private values, build-time inlining (`VITE_`, `NEXT_PUBLIC_`)
- [ ] Changing config safely: defaults, deprecations, reviews, and audit trails
- [ ] Azure Key Vault and App Configuration as configuration providers, with managed identity
- [ ] `ASPNETCORE_ENVIRONMENT`, `DOTNET_ENVIRONMENT`, and `launchSettings.json`: what only runs locally

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Twelve-factor config, environments, and how ASP.NET Core loads configuration](docs/01-config-providers-environments.md)
- [02 · Typed, validated options](docs/02-typed-validated-options.md)
- [03 · Secrets, Key Vault, and App Configuration](docs/03-secrets-keyvault-appconfig.md)
- [04 · Local environments with Docker Compose](docs/04-docker-compose-local.md)
- [05 · Feature flags, frontend config, and changing config safely](docs/05-flags-frontend-changes.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/01-foundations/07-config-environments mode=tasks` when you are ready to build._
