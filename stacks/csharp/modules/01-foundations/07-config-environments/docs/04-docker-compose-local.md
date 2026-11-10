---
title: Local environments with Docker Compose
tech: Docker Compose, SQL Server 2025, Redis 8, Azurite
version: Docker Compose v2, mcr.microsoft.com/mssql/server:2025-latest, redis:8
date: 2026-11-09
covers: [8]
---
# Local environments with Docker Compose
[← Overview](00-overview.md)

## Why it matters
- The README says "install SQL Server 2025, Redis, and Azurite". New developers lose a day; each laptop ends up with different versions.
- The API starts before SQL Server is ready to accept logins and crashes on the first migration. `depends_on` was there, but without a health condition.
- Someone runs `docker compose down -v` and wipes everyone's assumption that local data survives.

## Concepts

### What Compose is for here
One file that starts every dependency the API needs, with pinned versions, health checks, and named volumes. The API itself usually runs on the host (`dotnet watch`) for fast debugging; Compose can also run it in a container for parity checks.

| Service | Image | Notes |
|:--|:--|:--|
| SQL Server 2025 | `mcr.microsoft.com/mssql/server:2025-latest` | needs ~2 GB RAM, `ACCEPT_EULA=Y`, a strong `MSSQL_SA_PASSWORD` |
| Redis 8 | `redis:8` | cache, rate limits, Hangfire is on SQL Server |
| Azurite | `mcr.microsoft.com/azure-storage/azurite` | Blob/Queue/Table emulator |
| Service Bus emulator | `mcr.microsoft.com/azure-messaging/servicebus-emulator` | optional profile; needs its own SQL container |
| API (optional) | built from `src/Shop.Api/Dockerfile` | profile `app` |

### Features you will use
| Feature | Use |
|:--|:--|
| `healthcheck` + `depends_on: condition: service_healthy` | start in the right order |
| named volumes | data survives `docker compose down` (not `down -v`) |
| `profiles` | optional services: `docker compose --profile messaging up` |
| `.env` file | variable substitution in `compose.yaml` (`${MSSQL_SA_PASSWORD}`) |
| `compose.override.yaml` | personal or CI overrides, merged automatically |
| `develop.watch` | sync/rebuild a containerized app on file changes |
| `ports: "127.0.0.1:1433:1433"` | bind to localhost only |

## Example
`compose.yaml`
```yaml
name: shop

services:
  sql:
    image: mcr.microsoft.com/mssql/server:2025-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: ${MSSQL_SA_PASSWORD:?set it in .env}
      MSSQL_PID: Developer
    ports: ["127.0.0.1:1433:1433"]
    volumes: [sqldata:/var/opt/mssql]
    healthcheck:
      test: ["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P \"$$MSSQL_SA_PASSWORD\" -C -Q 'SELECT 1' -b -o /dev/null"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  redis:
    image: redis:8
    ports: ["127.0.0.1:6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 10

  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    command: azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --skipApiVersionCheck
    ports: ["127.0.0.1:10000:10000", "127.0.0.1:10001:10001"]
    volumes: [azuritedata:/data]

  api:
    profiles: [app]
    build: { context: ., dockerfile: src/Shop.Api/Dockerfile }
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      ConnectionStrings__Shop: Server=sql,1433;Database=shop;User Id=sa;Password=${MSSQL_SA_PASSWORD};TrustServerCertificate=true
      ConnectionStrings__Redis: redis:6379
    ports: ["127.0.0.1:8080:8080"]
    depends_on:
      sql: { condition: service_healthy }
      redis: { condition: service_healthy }
    develop:
      watch:
        - action: rebuild
          path: src/

volumes:
  sqldata:
  azuritedata:
```
`.env.example` (committed; copy to `.env`)
```bash
MSSQL_SA_PASSWORD=Change_me_Local_1!
```
`terminal`
```bash
cp .env.example .env
docker compose up -d            # sql, redis, azurite
docker compose ps               # wait until sql is "healthy"
dotnet watch --project src/Shop.Api
docker compose --profile app up --build    # whole stack in containers
docker compose down             # keep data
docker compose down -v          # wipe data (be sure)
```

## Production patterns
- Pin image tags you depend on (`2025-latest` tracks the 2025 major; pin a CU tag if you need reproducibility).
- Bind ports to `127.0.0.1` so local databases aren't reachable from the network.
- Health checks on every dependency; the API waits on `service_healthy`.
- Connection strings in Compose use service names (`sql`, `redis`), on the host use `localhost`: keep both in config (user-secrets for host runs, Compose env for container runs).
- Aspire's AppHost (04-shipping/01-containers) is an alternative for orchestrating the same services from C#; Compose remains the universal baseline.

## Mistakes
Wrong: order without health.
```yaml
depends_on: [sql]       # starts after the container starts, not after SQL accepts logins
```
Right: `depends_on: sql: condition: service_healthy` with a real health check.

Wrong: committing `.env` with the SA password, or using `sa` from the app in any shared environment.
Right: `.env` ignored, `.env.example` committed; cloud environments use a least-privilege login or managed identity.

## Check yourself
1. Why does `$$MSSQL_SA_PASSWORD` have two dollar signs in the health check?
2. What keeps SQL Server data across `docker compose down`?
3. When would you start the `app` profile instead of running the API on the host?

<details><summary>Answers</summary>

1. `$$` escapes Compose's own variable substitution, so the shell inside the container expands the variable.
2. The named volume `sqldata` mounted at `/var/opt/mssql`; only `down -v` removes it.
3. To check the containerized build (Dockerfile, ports, environment variables) the way production runs it, or to run the whole stack without the .NET SDK.
</details>

## Sources
- [Compose file reference](https://docs.docker.com/reference/compose-file/)
- [Compose — Control startup order](https://docs.docker.com/compose/how-tos/startup-order/)
- [Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/)
- [SQL Server Linux container images](https://learn.microsoft.com/sql/linux/sql-server-linux-docker-container-deployment)
- [Azurite emulator](https://learn.microsoft.com/azure/storage/common/storage-use-azurite)
