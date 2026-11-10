---
title: Containers cheatsheet
tech: Docker, Docker Compose, .NET SDK containers, Aspire
version: Docker Engine 28+, Compose v2, .NET 10 images (Ubuntu 24.04 "noble"), Aspire 13
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Containers cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Core terms
| Term | Meaning | Note |
|:--|:--|:--|
| ⭐ image | layers + config | OCI |
| ⭐ layer | one build step's changes | cached, shared |
| ⭐ container | running image + writable layer | |
| ⭐ registry | stores images | MCR, Docker Hub, ACR |
| tag | movable name | `1.4.0` |
| ⭐ digest | immutable content hash | `@sha256:...` |
| manifest list | multi-platform index | one tag, many images |
| namespaces / cgroups | isolation / limits | shared kernel |

## Docker CLI
| Command | Does | Note |
|:--|:--|:--|
| ⭐ `docker build -t name -f Dockerfile .` | build | context = `.` |
| ⭐ `docker buildx build --platform ... --push` | multi-arch build | BuildKit |
| ⭐ `docker run --rm -p 8080:8080 -e K=V img` | run | |
| `docker run -m 512m --cpus 1` | limits | test locally |
| ⭐ `docker logs -f c` | logs | |
| `docker exec -it c sh` | shell | if image has one |
| `docker debug c` | debug shell for slim images | Docker Desktop |
| ⭐ `docker inspect c` | config, state, exit code | `OOMKilled` |
| `docker stats` | live resource use | |
| `docker history img` | layers | secrets leak here |
| `docker buildx imagetools inspect` | platforms, digest | |
| `docker image prune` | clean up | |

## .NET images
| Tag | Content | Use |
|:--|:--|:--|
| `sdk:10.0` | SDK, Ubuntu 24.04 | build stage |
| `aspnet:10.0` | runtime + shell | debugging |
| `aspnet:10.0-noble-chiseled` | minimal, no shell, invariant culture | production without cultures/time zones |
| ⭐ `aspnet:10.0-noble-chiseled-extra` | + ICU, tzdata | production for this shop |
| `aspnet:10.0-azurelinux3.0-distroless` | Azure Linux distroless | |
| `runtime-deps:10.0-noble-chiseled` | no runtime | self-contained, AOT |
| Debian images | | not published for .NET 10 |
| ⭐ port 8080, `$APP_UID` | defaults | .NET 8+ |

## Dockerfile instructions
| Instruction | Does | Note |
|:--|:--|:--|
| ⭐ `FROM img AS build` | stage | multi-stage |
| `FROM --platform=$BUILDPLATFORM` | native build stage | cross-compile |
| ⭐ `COPY --from=build` | copy between stages | |
| `RUN --mount=type=cache,target=...` | persistent cache | NuGet, npm |
| `RUN --mount=type=secret,id=x` | build secret | not in layers |
| ⭐ `USER $APP_UID` | non-root | |
| ⭐ `ENTRYPOINT ["dotnet","App.dll"]` | exec form | PID 1, signals |
| `ARG TARGETARCH` | target CPU | `-a $TARGETARCH` |
| `ENV` | runtime env | no secrets |
| `EXPOSE 8080` | documents port | |
| `HEALTHCHECK` | Docker health | platforms use probes |

## SDK container publishing
| Property | Does | Example |
|:--|:--|:--|
| ⭐ `-t:PublishContainer` | build image | `dotnet publish` |
| `ContainerRepository` | image name | `shop-api` |
| `ContainerImageTags` | tags | `1.4.0;sha-3f2c1ab` |
| ⭐ `ContainerFamily` | base variant | `noble-chiseled-extra` |
| `ContainerBaseImage` | explicit base | |
| `ContainerRegistry` | push target | `shopacr.azurecr.io` |
| `ContainerUser` / `ContainerPort` | user, port | `app`, 8080 |
| `ContainerArchiveOutputPath` | tarball output | no Docker needed |

## Build speed
| Practice | Effect | Note |
|:--|:--|:--|
| ⭐ csproj → restore → sources | cached restore | |
| ⭐ `.dockerignore` | small context | bin, obj, .git, .env |
| ⭐ cache mounts | reuse packages | BuildKit |
| `cache-from/to: type=gha` | CI cache | build-push-action |
| registry cache | shared cache | `type=registry` |
| least-changing first | more hits | |

## Image security
| Practice | How | Note |
|:--|:--|:--|
| ⭐ minimal base | chiseled / distroless | |
| ⭐ pinned base | patch tag or digest | bots update |
| ⭐ scan | Trivy, Docker Scout | gate CI |
| Defender for Containers | ACR scanning | |
| ⭐ no secrets | no COPY/ENV/ARG secrets | secret mounts |
| SBOM | `--sbom=true`, syft | |
| provenance | `--provenance=mode=max` | |
| signing | Notation, cosign | also seen |
| weekly rebuilds | pick up patches | |

## Runtime configuration
| Item | Practice | Note |
|:--|:--|:--|
| ⭐ env vars | `ConnectionStrings__Shop` | `__` = `:` |
| ⭐ secrets | platform + Key Vault | not in image |
| ⭐ SIGTERM | exec-form entrypoint | graceful shutdown |
| ⭐ memory limit | GC heap 75% of limit | `DOTNET_GCHeapHardLimitPercent` |
| CPU limit | `ProcessorCount` follows quota | |
| `ASPNETCORE_HTTP_PORTS` | listen port | 8080 |
| `DOTNET_gcServer=0` | workstation GC | tiny containers |
| read-only root fs | write to `/tmp` | |

## Multi-architecture
| Item | Does | Note |
|:--|:--|:--|
| `linux/amd64`, `linux/arm64` | platforms | |
| ⭐ `--platform` | target platforms | buildx |
| ⭐ `$BUILDPLATFORM` + `-a $TARGETARCH` | no emulation | .NET |
| QEMU | emulation | slow |
| SQL Server image | amd64 only | emulated on Apple Silicon |
| `exec format error` | wrong arch | set `--platform` |

## Tags and registries
| Practice | Why | Note |
|:--|:--|:--|
| ⭐ git SHA tags | traceable | `sha-3f2c1ab` |
| ⭐ deploy by digest | exact image | |
| `latest` | local only | never prod |
| ⭐ ACR + managed identity | `AcrPull` | no passwords |
| ACR Premium | geo-replication, private link, retention | |
| `acr purge` | delete old tags | ACR Tasks schedule |
| write-disabled tags | lock releases | |

## Compose (local)
| Feature | Use | Note |
|:--|:--|:--|
| ⭐ `condition: service_healthy` | ordered start | |
| `service_completed_successfully` | migrations first | |
| ⭐ named volumes | persistent data | `down -v` wipes |
| ⭐ `profiles` | optional services | `--profile app` |
| `docker compose watch` | sync / rebuild | `develop.watch` |
| `include:` | split files | |
| `compose.override.yaml` | personal overrides | |
| `mem_limit`, `cpus` | production-like limits | |

## SQL Server container
| Item | Value | Note |
|:--|:--|:--|
| ⭐ image | `mssql/server:2025-latest` | pin CU |
| env | `ACCEPT_EULA`, `MSSQL_SA_PASSWORD`, `MSSQL_PID=Developer` | |
| ⭐ memory | ≥ 2 GB | `MSSQL_MEMORY_LIMIT_MB` |
| ⭐ volume | `/var/opt/mssql` | |
| health | `/opt/mssql-tools18/bin/sqlcmd -C ...` | |
| seed | migration container | |

## Aspire
| API / command | Does | Note |
|:--|:--|:--|
| ⭐ `DistributedApplication.CreateBuilder` | AppHost | |
| `AddSqlServer(...).AddDatabase(...)` | SQL resource | |
| `AddRedis(...)` | Redis resource | |
| `AddProject<Projects.X>(...)` | .NET project | |
| `AddJavaScriptApp(...)` | JS app | Aspire 13; replaces `AddNpmApp` |
| ⭐ `WithReference(x)` | inject connection info | |
| ⭐ `WaitFor(x)` | ordered start | |
| `WithDataVolume()` | persistent data | |
| `WithLifetime(ContainerLifetime.Persistent)` | keep container running | |
| `AddParameter(name, secret: true)` | parameters | |
| `aspire run` | start + dashboard | |
| `aspire publish` / `deploy`, `azd` | deployment artefacts | |
| service defaults | OTel, health, resilience | shared project |

## Next.js in containers
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `output: "standalone"` | minimal server bundle | |
| ⭐ copy `.next/static`, `public` | assets | not in standalone |
| `node server.js` | start | `HOSTNAME=0.0.0.0` |
| ⭐ `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | same key everywhere | build secret |
| ⭐ `deploymentId` | version skew handling | git SHA |
| shared cache handler | consistent cache | Redis |
| `NEXT_PUBLIC_*` | build-time values | rebuild to change |
| `USER node` | non-root | |

## Exit codes
| Code | Meaning | Check |
|:--|:--|:--|
| 0 | clean exit | app ended? |
| 1 | startup exception | logs |
| ⭐ 137 | SIGKILL / OOM | `OOMKilled` |
| 139 | segfault | native crash |
| 143 | SIGTERM | shutdown |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| SDK image in production | huge, many CVEs | runtime stage |
| shell-form entrypoint | no SIGTERM | exec form |
| root user | bigger blast radius | `USER $APP_UID` |
| `COPY . .` before restore | slow builds | restore first |
| secrets in `ARG`/`ENV` | readable by anyone | secret mounts |
| `latest` in prod | wrong rollbacks | digests |
| arm64 image on amd64 | `exec format error` | `--platform` |
| chiseled + culture | missing ICU/tzdata | `-extra` or invariant |
| SQL with 1 GB | crashes | ≥ 2 GB |
| per-build Server Actions keys | broken actions | shared key |
| missing `.next/static` | 404 assets | copy it |

## Sources
| Source | Link |
|:--|:--|
| Containerize .NET | https://learn.microsoft.com/dotnet/core/docker/build-container |
| SDK container publish | https://learn.microsoft.com/dotnet/core/containers/sdk-publish |
| .NET container images | https://learn.microsoft.com/dotnet/core/docker/container-images |
| Docker build best practices | https://docs.docker.com/build/building/best-practices/ |
| Compose reference | https://docs.docker.com/reference/compose-file/ |
| SQL Server containers | https://learn.microsoft.com/sql/linux/sql-server-linux-docker-container-configure |
| Aspire | https://aspire.dev/ |
| Next.js self-hosting | https://nextjs.org/docs/app/guides/self-hosting |
| ACR best practices | https://learn.microsoft.com/azure/container-registry/container-registry-best-practices |
