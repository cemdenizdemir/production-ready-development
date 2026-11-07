---
title: Compose, Next.js, multi-arch builds, and debugging
tech: Docker Compose, Docker, Next.js 16
version: Docker Compose v2 (compose.yaml, develop.watch), Docker Buildx, Next.js 16 standalone output, AWS Graviton (arm64)
date: 2026-11-07
covers: [6, 7, 8, 10]
---
# Compose, Next.js, multi-arch builds, and debugging
[← Overview](00-overview.md)

## Why it matters
- The API container starts before Postgres is ready, crashes on the first query, and new developers lose an afternoon to "connection refused".
- The image is built on an Apple Silicon laptop (arm64) and pushed; the x86 Fargate task fails with `exec format error`.
- A task restarts every few hours with exit code 137. Nobody knows it means the kernel killed it for exceeding its memory limit.

## Concepts

### Docker Compose for local development
| Feature | Use |
|:--|:--|
| `compose.yaml` services | Postgres, Redis, Grafana LGTM, API, worker, web |
| `healthcheck` + `depends_on: { condition: service_healthy }` | start in the right order |
| Named volumes | data survives `docker compose down` (not `down -v`) |
| `profiles` | optional services (`observability`, `app`) |
| `develop.watch` | sync code into containers, rebuild on lockfile changes |
| `env_file` | local config from `.env` (never committed) |
| Ports on `127.0.0.1` | services aren't exposed to your network |
| `docker compose up -d --wait` | start and wait for healthchecks |

Two common setups: run only infrastructure in Compose and the app on the host (fastest feedback), or run everything in Compose (closest to production). Both use the same `compose.yaml` with profiles.

### Next.js in a container
| Piece | Detail |
|:--|:--|
| `output: 'standalone'` | `.next/standalone/server.js` with only the needed `node_modules` |
| Static files | copy `.next/static` and `public` next to the server, or upload them to S3/CloudFront |
| `HOSTNAME=0.0.0.0`, `PORT` | listen on all interfaces inside the container |
| `NEXT_PUBLIC_*` | baked in at build time: keep them identical across environments |
| Several instances | shared cache handler and the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` on every instance |

The full multi-stage Dockerfile is in [02-frontend/06-rendering lesson 05](../../../02-frontend/06-rendering/docs/05-metadata-and-self-hosting.md).

### Multi-architecture images
| Topic | Detail |
|:--|:--|
| Platforms | `linux/amd64` (x86) and `linux/arm64` (Graviton, Apple Silicon) |
| Graviton on Fargate | `runtimePlatform.cpuArchitecture: ARM64`; usually cheaper for the same work |
| Building | `docker buildx build --platform linux/amd64,linux/arm64 --push` creates one manifest list |
| Speed | build natively on arm64 runners (GitHub `ubuntu-24.04-arm`) instead of slow QEMU emulation |
| Native modules | argon2, sharp, and similar ship prebuilt binaries for both; verify on the target platform |

### Debugging containers
| Need | Command |
|:--|:--|
| Logs | `docker logs -f --since 10m <container>`, `docker compose logs -f api` |
| Shell inside | `docker exec -it <container> sh`; ECS: `aws ecs execute-command` (ECS Exec) |
| Why did it stop? | `docker inspect --format '{{.State.ExitCode}} {{.State.OOMKilled}}' <container>` |
| Resource use | `docker stats` |
| Image contents | `docker image history`, `docker run --rm -it --entrypoint sh <image>`; also seen: dive |
| Disk | `docker system df`, `docker builder prune` |
| Limits locally | `docker run --memory=512m --cpus=0.5` to reproduce production limits |

| Exit code | Meaning |
|:--|:--|
| 0 | clean exit |
| 1 | application error (uncaught exception, failed startup) |
| 137 | SIGKILL: often out of memory (OOMKilled) or a forced stop after the stop timeout |
| 143 | SIGTERM handled by exiting (normal stop) |
| `exec format error` | wrong CPU architecture for the image |

## Example
`compose.yaml` — infrastructure always, the app with `--profile app`.
```yaml
services:
  postgres:
    image: postgres:18
    environment: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: shop }
    ports: ["127.0.0.1:5432:5432"]
    volumes: [pgdata:/var/lib/postgresql]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d shop"]
      interval: 5s
      retries: 10

  redis:
    image: redis:8-alpine
    ports: ["127.0.0.1:6379:6379"]
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 5s, retries: 10 }

  api:
    profiles: [app]
    build: { context: ., target: runtime }
    command: ["node", "--watch", "src/server.ts"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/shop   # service name, not localhost
      REDIS_URL: redis://redis:6379
    ports: ["127.0.0.1:3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    develop:
      watch:
        - { action: sync, path: ./src, target: /app/src }   # node --watch restarts on change
        - { action: rebuild, path: pnpm-lock.yaml }

  worker:
    profiles: [app]
    build: { context: ., target: runtime }
    command: ["node", "src/jobs/worker.ts"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/shop
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }

volumes:
  pgdata:
```
Daily commands:
```bash
docker compose up -d --wait                  # infrastructure only; run the app with pnpm dev
docker compose --profile app up --watch      # everything in containers, code synced on save
docker compose logs -f api worker
docker compose down                          # keeps volumes; `down -v` deletes the database
```
Multi-arch build and push (CI usually does this, [04-deployments](../../04-deployments/README.md)):
```bash
docker buildx create --use --name multi
docker buildx build --platform linux/amd64,linux/arm64 \
  -t 123456789012.dkr.ecr.eu-central-1.amazonaws.com/shop-api:sha-3f2a1c9 --push .
docker buildx imagetools inspect 123456789012.dkr.ecr.eu-central-1.amazonaws.com/shop-api:sha-3f2a1c9
```
Investigating a restart loop:
```bash
docker inspect --format '{{.State.ExitCode}} OOMKilled={{.State.OOMKilled}}' shop-api-1   # 137 OOMKilled=true
docker stats --no-stream shop-api-1                                                      # memory near the limit?
# fix: raise the task memory or lower --max-old-space-size, then look for the leak (heap snapshots)
```

## Production patterns
- **One `compose.yaml`** with healthchecks, ordered startup, named volumes, and profiles for the app and observability.
- **Service names as hostnames** inside Compose; `127.0.0.1` port bindings on the host.
- **Next.js standalone images** with static assets on a CDN and shared secrets across instances.
- **Images built for the platform you run on** (arm64 for Graviton), natively in CI.
- **Exit codes and OOM flags checked first** when containers restart.

## Mistakes
Wrong: `depends_on` without health conditions.
```yaml
depends_on: [postgres]   # starts the API as soon as the container starts, not when Postgres accepts connections
```
Right: `depends_on: { postgres: { condition: service_healthy } }` plus a healthcheck.

Wrong: `localhost` inside a container to reach another service. It points at the container itself. Right: the Compose service name (`postgres`, `redis`).

Wrong: building on an arm64 laptop and deploying to x86 Fargate (or the reverse). Right: build for the target platform in CI, or a multi-platform manifest.

Wrong: `docker compose down -v` to "fix" something. It deletes the local database. Right: `down` keeps volumes; delete them only on purpose.

## Check yourself
1. How do you make the API wait until Postgres is ready in Compose?
2. What does exit code 137 usually mean, and how do you confirm it?
3. Why build arm64 images natively instead of with QEMU?

<details>
<summary>Answers</summary>

1. Give Postgres a `healthcheck` (`pg_isready`) and set `depends_on: { postgres: { condition: service_healthy } }` on the API; `docker compose up --wait` also waits for health. The app should still retry connections at startup, since dependencies can restart later.
2. The process got SIGKILL, most often because it exceeded the container's memory limit (or was force-stopped after the stop timeout). `docker inspect` shows `OOMKilled=true`; on ECS the stopped reason says `OutOfMemoryError`.
3. Emulation is many times slower, especially for installs and native compilation, and occasionally behaves differently. A native arm64 runner builds quickly and produces exactly what Graviton will run.
</details>

## Sources
- [Docker Compose — File reference](https://docs.docker.com/reference/compose-file/)
- [Docker Compose — Watch](https://docs.docker.com/compose/how-tos/file-watch/)
- [Docker — Multi-platform builds](https://docs.docker.com/build/building/multi-platform/)
- [Next.js — Self-hosting (output: standalone)](https://nextjs.org/docs/app/guides/self-hosting)
- [Amazon ECS — Using ECS Exec](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html)
