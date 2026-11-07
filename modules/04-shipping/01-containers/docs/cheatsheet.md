---
title: Containers cheatsheet
tech: Docker, Docker Compose
version: Docker Engine with BuildKit, Docker Compose v2, node:26-slim, pnpm 10, Amazon ECR
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
---
# Containers cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Concepts
| Term | Meaning |
|:--|:--|
| ⭐ Image | read-only layers + metadata |
| ⭐ Layer | one instruction's filesystem change, cached |
| ⭐ Container | a process running from an image |
| Registry | stores images (ECR, GHCR, Docker Hub) |
| ⭐ Tag vs digest | movable name vs content hash `@sha256:…` |
| Manifest list | one tag, several platforms |
| BuildKit / Buildx | the builder and its CLI |

## Base images
| Base | Note |
|:--|:--|
| `node:26` | full Debian, large |
| ⭐ `node:26-slim` | small Debian (glibc), default |
| `node:26-alpine` | smallest, musl libc caveats |
| Distroless / hardened | no shell, smallest attack surface (also seen) |

## Dockerfile instructions
| Instruction | Use |
|:--|:--|
| `# syntax=docker/dockerfile:1` | latest stable Dockerfile features |
| ⭐ `FROM image AS name` | stages |
| `ARG` | build-time values (never secrets) |
| `ENV` | runtime environment defaults |
| `WORKDIR` | working directory |
| ⭐ `COPY --from=stage` | take artifacts from another stage |
| `COPY --chown=node:node` | ownership (only for writable paths) |
| ⭐ `RUN --mount=type=cache,target=…` | reusable caches (pnpm store) |
| ⭐ `RUN --mount=type=secret,id=…` | secrets during one step only |
| ⭐ `USER node` | non-root |
| `EXPOSE 3000` | documentation of the port |
| `HEALTHCHECK CMD […]` | local/Compose health (ECS uses its own) |
| ⭐ `CMD ["node", "src/server.ts"]` | exec form: signals reach Node |
| `ENTRYPOINT` | fixed executable, `CMD` as default args |

## Production Dockerfile rules
| Rule | Why |
|:--|:--|
| ⭐ Multi-stage | no build tools or dev deps in the final image |
| ⭐ Lockfile + install before `COPY src` | dependency layer stays cached |
| ⭐ `.dockerignore` | no `node_modules`, `.git`, `.env*` in context |
| `pnpm install --prod --frozen-lockfile` | production deps, exact versions |
| `npm install -g pnpm@<version>` | Corepack isn't bundled since Node 25 |
| Code owned by root, `USER node` | process can't modify its code |
| `NODE_ENV=production` | production behavior in libraries |
| One process per container | API, worker, migrations via command |
| `pnpm deploy --prod --filter api /out` | workspace package as a standalone folder |

## Build commands
| Command | Use |
|:--|:--|
| ⭐ `docker buildx build -t name:tag .` | build |
| `--target runtime` | build a specific stage |
| `--platform linux/amd64,linux/arm64 --push` | multi-arch image |
| `--secret id=npmrc,src=$HOME/.npmrc` | provide a build secret |
| `--sbom=true --provenance=mode=max` | attestations |
| `--cache-from` / `--cache-to type=gha` or `type=registry` | CI layer cache |
| `docker image history <img>` | layer sizes |
| `docker buildx imagetools inspect <img>` | platforms in a manifest |

## Security
| Practice | How |
|:--|:--|
| ⭐ Pin by digest | `FROM node:26-slim@sha256:…` |
| ⭐ Rebuild weekly | patched base layers |
| ⭐ Scan | `docker scout cves`, ECR enhanced scanning; Trivy/Grype (also seen) |
| Gate | fixable high/critical only |
| ⭐ No secrets in images | no `ARG`/`ENV`/`COPY` secrets |
| Updates | Dependabot `package-ecosystem: docker` |
| Read-only root FS | where the app allows it |
| No privileged mode | default on Fargate |

## Runtime configuration
| Concern | Practice |
|:--|:--|
| ⭐ Config | env vars, validated at startup |
| ⭐ Secrets | ECS `secrets` from Secrets Manager/SSM |
| ⭐ Signals | exec-form `CMD` or `--init` / `initProcessEnabled` |
| Memory | `NODE_OPTIONS=--max-old-space-size` ≈ 75% of limit |
| Logs | JSON to stdout |
| Filesystem | stateless; `/tmp` only |
| Time zone | UTC |

## Registry (ECR)
| Practice | How |
|:--|:--|
| ⭐ Immutable tags | `sha-<git sha>`; tag immutability on |
| ⭐ Deploy by digest | `image@sha256:…` |
| ⭐ Promote, don't rebuild | same digest staging → prod |
| Lifecycle policy | expire untagged after 7 days, keep last N |
| Scan on push | enhanced scanning (Inspector) |
| Login | `aws ecr get-login-password \| docker login --username AWS --password-stdin <registry>` |
| avoid | `:latest` in deployments |

## Compose
| Item | Use |
|:--|:--|
| ⭐ `compose.yaml` | file name |
| ⭐ `healthcheck` + `depends_on.condition: service_healthy` | startup order |
| Named volumes | persistent local data |
| `profiles: [app]` | optional services |
| ⭐ `develop.watch` (`sync`, `rebuild`, `sync+restart`) | live code sync |
| `env_file: .env` | local config |
| `"127.0.0.1:5432:5432"` | bind to localhost only |
| Service names as hosts | `postgres:5432`, not `localhost` |

## Compose commands
| Command | Use |
|:--|:--|
| ⭐ `docker compose up -d --wait` | start + wait for health |
| `docker compose --profile app up --watch` | full stack with sync |
| `docker compose logs -f api` | follow logs |
| `docker compose exec api sh` | shell in a service |
| `docker compose ps` | status and health |
| `docker compose down` | stop, keep volumes |
| `docker compose down -v` | also delete volumes (data!) |
| `docker compose config` | render the final config |

## Next.js in containers
| Item | Value |
|:--|:--|
| ⭐ `output: 'standalone'` | minimal server bundle |
| Copy | `.next/standalone`, `.next/static`, `public` |
| Env | `HOSTNAME=0.0.0.0`, `PORT=3000` |
| `NEXT_PUBLIC_*` | build-time: same in every environment |
| ⭐ Multiple instances | same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, shared cache handler |
| Static assets | S3 + CloudFront via `assetPrefix` |

## Multi-arch
| Item | Value |
|:--|:--|
| Platforms | `linux/amd64`, `linux/arm64` |
| Graviton | ECS `runtimePlatform.cpuArchitecture: ARM64` |
| ⭐ Native builds | `ubuntu-24.04-arm` runners, not QEMU |
| Symptom of mismatch | `exec format error` |

## Debugging
| Command | Use |
|:--|:--|
| ⭐ `docker logs -f --since 10m <c>` | logs |
| ⭐ `docker exec -it <c> sh` | shell |
| ⭐ `docker inspect --format '{{.State.ExitCode}} {{.State.OOMKilled}}' <c>` | why it stopped |
| `docker stats` | CPU/memory |
| `docker run --rm -it --entrypoint sh <img>` | explore an image |
| `docker run --memory=512m --cpus=0.5` | reproduce limits |
| `docker system df`, `docker builder prune` | disk usage |
| `aws ecs execute-command --interactive --command sh` | ECS Exec |

## Exit codes
| Code | Meaning |
|:--|:--|
| 0 | clean exit |
| 1 | app error |
| ⭐ 137 | SIGKILL: OOM or forced stop |
| 143 | SIGTERM exit |
| 126 / 127 | not executable / command not found |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `COPY . .` before install | reinstall on every change | lockfile first |
| No `.dockerignore` | huge context, secrets in layers | ignore file |
| Root user | full control after RCE | `USER node` |
| Shell-form `CMD` / `npm start` | SIGTERM lost | exec form `node` |
| `ARG` secrets | visible in history | secret mounts |
| `:latest` deploys | ambiguous rollbacks | SHA tags, digests |
| `localhost` between containers | points to itself | service names |
| `depends_on` without health | race at startup | `service_healthy` |
| arm64 image on x86 | `exec format error` | build for the target |
| Heap = container memory | OOM kill (137) | ~75% heap |
| `down -v` | local data gone | `down` |
| Dockerfile `HEALTHCHECK` on ECS | ignored | task definition `healthCheck` |

## Sources
| Source | Link |
|:--|:--|
| Docker build best practices | https://docs.docker.com/build/building/best-practices/ |
| Docker build secrets | https://docs.docker.com/build/building/secrets/ |
| Docker multi-platform builds | https://docs.docker.com/build/building/multi-platform/ |
| Compose file reference | https://docs.docker.com/reference/compose-file/ |
| Docker Node.js best practices | https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md |
| pnpm and Docker | https://pnpm.io/docker |
| ECR lifecycle policies | https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html |
