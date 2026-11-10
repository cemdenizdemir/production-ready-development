---
title: "Local orchestration: Compose, SQL Server, and Aspire"
tech: Docker Compose, SQL Server 2025 container, Aspire 13
version: Compose v2, mcr.microsoft.com/mssql/server:2025-latest, Aspire 13
date: 2026-11-09
covers: [7, 8, 9]
---
# Local orchestration: Compose, SQL Server, and Aspire
[← Overview](00-overview.md)

## Why it matters
- SQL Server in Docker kept crashing on a laptop with 4 GB given to Docker. Nobody knew it needs at least 2 GB of its own.
- Local data was lost every time someone ran `docker compose down -v`, so every developer seeded test data by hand.
- Connection strings for the API, workers, and frontend were copied into five places and drifted. The worker pointed at a stale database for a week.

## Concepts

### Docker Compose, beyond the basics
01-foundations/07 introduced Compose. The production-minded features:
| Feature | Use |
|:--|:--|
| ⭐ `healthcheck` + `depends_on: { condition: service_healthy }` | ordered startup that waits for readiness |
| `depends_on: { condition: service_completed_successfully }` | run a migration/seed container first |
| ⭐ named volumes | data survives restarts; `down -v` deletes them |
| ⭐ `profiles` | optional parts: `app`, `messaging`, `observability`, `perf` |
| `develop.watch` (`docker compose watch`) | `sync` files, `rebuild` on project changes, `sync+restart` for config |
| `include:` | split large Compose files |
| `compose.override.yaml` | personal settings, merged automatically |
| `env_file`, `.env` | variables; commit only `.env.example` |
| `mem_limit`, `cpus` | match production limits locally |

### SQL Server in a container
| Item | Value |
|:--|:--|
| ⭐ image | `mcr.microsoft.com/mssql/server:2025-latest` (pin a CU tag for reproducibility) |
| required env | `ACCEPT_EULA=Y`, `MSSQL_SA_PASSWORD` (complexity rules), `MSSQL_PID=Developer` |
| ⭐ memory | at least 2 GB for the container; `MSSQL_MEMORY_LIMIT_MB` to cap SQL itself |
| ⭐ data | named volume at `/var/opt/mssql` |
| ⭐ health | `sqlcmd` (in `/opt/mssql-tools18/bin`) with `-C` to trust the self-signed cert |
| architecture | amd64 only; emulated on Apple Silicon (works, slower) |
| seed | an `init` container running EF Core migrations or a migration bundle, then seed data |
| tests | Testcontainers starts its own throwaway SQL container per test run |

### Aspire for local orchestration
Aspire describes the app's resources in C# (an **AppHost** project) and runs them with one command, wiring connection strings and showing everything in the Aspire dashboard (logs, traces, metrics).
| Concept | Meaning |
|:--|:--|
| ⭐ AppHost | a C# project (or single-file `apphost.cs`) that declares resources |
| resources | containers (SQL Server, Redis), projects, executables, JavaScript apps |
| ⭐ `WithReference(x)` | injects connection info as config (`ConnectionStrings__shop`) |
| `WaitFor(x)` | start after x is healthy |
| service defaults | a shared project adding OpenTelemetry, health checks, resilience, service discovery |
| `aspire run` / `dotnet run --project AppHost` | start everything with the dashboard |
| `aspire publish` / `aspire deploy`, `azd` | generate deployment artefacts (Bicep for Container Apps) |

| | Docker Compose | Aspire |
|:--|:--|:--|
| language | YAML | C# |
| best for | any stack; CI; teams without .NET | .NET-centric apps; wiring config; telemetry by default |
| telemetry | add the Aspire dashboard container yourself | built in |
| debugging | attach to processes | F5 on the AppHost debugs all .NET projects |
| deployment | not a deployment tool | can generate infrastructure (with azd) |

Both are fine. Many teams keep Compose as the universal baseline (CI, non-.NET developers) and add an AppHost for the .NET inner loop.

## Example
`compose.yaml` (additions to the foundations file)
```yaml
services:
  sql:
    image: mcr.microsoft.com/mssql/server:2025-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: ${MSSQL_SA_PASSWORD:?set it in .env}
      MSSQL_PID: Developer
      MSSQL_MEMORY_LIMIT_MB: "2048"
    mem_limit: 3g
    volumes: [sqldata:/var/opt/mssql]
    healthcheck:
      test: ["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P \"$$MSSQL_SA_PASSWORD\" -C -Q 'SELECT 1' -b -o /dev/null"]
      interval: 10s
      retries: 10
      start_period: 30s

  migrate:
    profiles: [app]
    build: { context: ., dockerfile: tools/Migrate.Dockerfile }   # runs the EF Core migration bundle + seed
    environment:
      ConnectionStrings__Shop: Server=sql;Database=shop;User Id=sa;Password=${MSSQL_SA_PASSWORD};TrustServerCertificate=true
    depends_on: { sql: { condition: service_healthy } }

  api:
    profiles: [app]
    depends_on:
      migrate: { condition: service_completed_successfully }
      redis: { condition: service_healthy }
    develop:
      watch:
        - { action: rebuild, path: src/ }
        - { action: sync+restart, path: src/Shop.Api/appsettings.Development.json, target: /app/appsettings.Development.json }
```
`docker compose --profile app watch` starts the stack and rebuilds the API on changes.

`src/Shop.AppHost/AppHost.cs` (Aspire 13)
```csharp
var builder = DistributedApplication.CreateBuilder(args);

var sqlPassword = builder.AddParameter("sql-password", secret: true);
var sql = builder.AddSqlServer("sql", password: sqlPassword)
                 .WithDataVolume()
                 .WithLifetime(ContainerLifetime.Persistent);      // keeps running between AppHost restarts
var shopDb = sql.AddDatabase("shop");
var redis = builder.AddRedis("redis");

var api = builder.AddProject<Projects.Shop_Api>("api")
    .WithReference(shopDb).WaitFor(shopDb)
    .WithReference(redis).WaitFor(redis);

builder.AddProject<Projects.Shop_Workers>("workers")
    .WithReference(shopDb).WaitFor(api);

builder.AddJavaScriptApp("web", "../../frontend")              // Aspire.Hosting.JavaScript
    .WithReference(api)
    .WithHttpEndpoint(env: "PORT");

builder.Build().Run();
```
The API reads `builder.Configuration.GetConnectionString("shop")`; Aspire supplies it, so no connection strings are copied around. Run with `aspire run` and open the dashboard link it prints.

## Production patterns
- One command starts the whole local system, with pinned images, health-ordered startup, persistent volumes, and seeded data.
- Local limits mirror production (`mem_limit`, `cpus`) so memory problems show up before deploy.
- Connection information is wired by the orchestrator (Compose env or Aspire references), not copied into many files.
- Compose stays the baseline for CI and non-.NET contributors; the Aspire AppHost is the .NET developer's inner loop with telemetry built in.

## Mistakes
Wrong: SQL Server with 1 GB of memory and no volume.
Right: ≥ 2 GB, a named volume, a health check, and a migration step before the API starts.

Wrong: `depends_on: [sql]` and hoping the API retries until SQL is ready.
Right: `condition: service_healthy` (Compose) or `WaitFor(sql)` (Aspire).

## Check yourself
1. What does `service_completed_successfully` let you do?
2. How does Aspire give the API its connection string?
3. When would you keep Compose even after adopting Aspire?

<details><summary>Answers</summary>

1. Run a one-off container (migrations, seed data) to completion before dependent services start, and stop them from starting if it fails.
2. `WithReference(shopDb)` injects the connection string into the API's configuration (`ConnectionStrings__shop`) when the AppHost starts it.
3. For CI pipelines, for contributors who don't use .NET tooling (frontend developers, QA), and as a tool-neutral description of dependencies.
</details>

## Sources
- [Docker Compose file reference](https://docs.docker.com/reference/compose-file/)
- [Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/)
- [SQL Server Linux container configuration](https://learn.microsoft.com/sql/linux/sql-server-linux-docker-container-configure)
- [Aspire overview](https://learn.microsoft.com/dotnet/aspire/get-started/aspire-overview)
- [Aspire JavaScript integration](https://aspire.dev/integrations/frameworks/javascript/)
