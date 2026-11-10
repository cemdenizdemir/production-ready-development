---
title: Twelve-factor config, environments, and Compose
tech: Node.js 26, Docker Compose
version: Node.js 26 LTS, Docker Compose v2, PostgreSQL 18, Redis 8
date: 2026-11-07
covers: [1, 2, 8]
---
# Twelve-factor config, environments, and Compose
[← Overview](00-overview.md)

## Why it matters
- The image is rebuilt for production with a different `API_URL` baked in. What was tested in staging is not what ships, and the bug only exists in production.
- `NODE_ENV=staging` is set "to be accurate". Express and React libraries treat anything except `production` as development: slower, verbose errors, dev-only code paths in front of users.
- Local development uses Postgres 14 from Homebrew while production runs 18. A query using a newer feature passes code review and fails in CI, or worse, the reverse.

## Concepts

### Twelve-factor, factor III: config
- **Config** is everything that differs between deploys: database URLs, credentials, hostnames, ports, per-environment toggles.
- It lives in the **environment**, not in code. Test: could you open-source the repo right now without leaking anything?
- **Build once, run anywhere:** one artifact (image) for all environments; config is injected at start.
- Not config: internal app constants (routes, business rules). Those are code.

### Environments
| Environment | Purpose | Data | Integrations |
|:--|:--|:--|:--|
| local | develop | seed data | fakes or sandboxes, Compose services |
| test (CI) | automated checks | fixtures, Testcontainers | fakes/MSW |
| preview | review a PR live | seed data | sandboxes |
| staging | rehearse releases, prod-like | anonymized or synthetic | sandbox/test mode (Stripe test keys) |
| production | real users | real | live |

**Parity** (factor X): keep the gaps small. Same Node, Postgres, and Redis versions; same container image; same migrations; similar data shapes. Differences should be *values*, not *behavior*.

### `NODE_ENV` vs `APP_ENV`
| Variable | Values | Meaning |
|:--|:--|:--|
| `NODE_ENV` | `production`, `development`, `test` only | how libraries behave (optimizations, error detail) |
| `APP_ENV` (your name) | `local`, `preview`, `staging`, `production` | where this deploy runs (logging tags, URLs) |

Staging runs `NODE_ENV=production` with `APP_ENV=staging`.

### Docker Compose for local parity
Compose runs the backing services (Postgres, Redis, MongoDB, observability) with production versions, one command for every developer.

| Feature | Use |
|:--|:--|
| `services` + pinned image tags | `postgres:18-alpine`, `redis:8-alpine` |
| `healthcheck` + `depends_on: condition: service_healthy` | start in the right order |
| Named volumes | data survives restarts; `docker compose down -v` wipes it |
| `ports: "127.0.0.1:5432:5432"` | reachable from your machine only, not your network |
| `env_file` / `environment` | config for containers |
| `${VAR:-default}` interpolation | values from the shell or the project `.env` file |
| `profiles` | optional services (`docker compose --profile observability up`) |
| `compose.override.yaml` | personal or local-only tweaks, merged automatically |
| `docker compose up -d --wait` | start and wait until healthy |
| `develop.watch` + `docker compose watch` | sync or rebuild app containers on file changes |

## Example
`compose.yaml` — backing services for local development.
```yaml
name: shop

services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-app_local_only}
      POSTGRES_DB: shop
    ports: ["127.0.0.1:5432:5432"]
    volumes: [pgdata:/var/lib/postgresql]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d shop"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:8-alpine
    ports: ["127.0.0.1:6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 10

  lgtm:                      # Grafana + Loki + Tempo + Prometheus + OTel Collector in one container
    image: grafana/otel-lgtm
    profiles: [observability]
    ports: ["127.0.0.1:3001:3000", "127.0.0.1:4318:4318"]

volumes:
  pgdata:
```
PostgreSQL 18 images store data under `/var/lib/postgresql` (a versioned subfolder inside), so mount that path rather than the old `/var/lib/postgresql/data`.

Daily commands:
```bash
docker compose up -d --wait          # start services, wait for healthchecks
docker compose ps                    # status and health
docker compose logs -f postgres      # follow logs
docker compose --profile observability up -d   # include optional services
docker compose down                  # stop (data kept)
docker compose down -v               # stop and delete volumes (fresh database)
```
The app itself usually runs on the host (`pnpm dev`) for fast reloads, pointing at `localhost:5432`.

## Production patterns
- **One image, many environments.** Tag images by commit SHA and inject config at runtime ([04-ci-cd](../../04-ci-cd/README.md) lesson 04).
- **Pin service versions** in Compose to production's major versions; upgrade them together.
- **Staging uses production settings** (`NODE_ENV=production`, same flags) with sandbox credentials.
- **A `make`-free onboarding path:** `docker compose up -d --wait && pnpm install && pnpm db:migrate && pnpm dev`, documented in the README.
- **Bind local ports to 127.0.0.1** so databases with dev passwords aren't exposed on café Wi-Fi.

## Mistakes
Wrong: environment-specific builds.
```dockerfile
ARG API_URL
ENV API_URL=$API_URL   # baked in: a new image per environment
```
Right: read `API_URL` at runtime from the environment; build once.

Wrong: `NODE_ENV=staging`. Right: `NODE_ENV=production`, `APP_ENV=staging`.

Wrong: unpinned images.
```yaml
image: postgres:latest   # jumps a major version on the next pull
```
Right: `postgres:18-alpine` (or a digest).

Wrong: `ports: ["5432:5432"]`, which listens on all interfaces. Right: `"127.0.0.1:5432:5432"`.

Wrong: `depends_on: [postgres]` without a health condition. The app starts before Postgres accepts connections.
Right: `depends_on: { postgres: { condition: service_healthy } }` with a `healthcheck`.

## Check yourself
1. What belongs in config, and what doesn't?
2. Why is `NODE_ENV=staging` harmful?
3. What is the difference between the `.env` file Compose reads and your app's `.env`?

<details>
<summary>Answers</summary>

1. Values that change between deploys: URLs, credentials, ports, per-environment toggles. Business rules, routes, and internal constants are code.
2. Libraries check for `NODE_ENV === 'production'`; anything else enables development behavior (slower paths, detailed errors). Staging then tests different behavior than production.
3. Compose automatically reads `.env` in the project directory to interpolate `${VAR}` inside `compose.yaml`. Your app reads its own env file (`--env-file`) at runtime. They can be the same file, but they serve different programs; be deliberate.
</details>

## Sources
- [The Twelve-Factor App — III. Config](https://12factor.net/config) and [X. Dev/prod parity](https://12factor.net/dev-prod-parity)
- [Docker Compose — File reference](https://docs.docker.com/reference/compose-file/)
- [Docker Compose — Interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
- [Docker Compose — Profiles](https://docs.docker.com/compose/how-tos/profiles/)
- [Express — Production best practices: set NODE_ENV](https://expressjs.com/en/advanced/best-practice-performance.html)
