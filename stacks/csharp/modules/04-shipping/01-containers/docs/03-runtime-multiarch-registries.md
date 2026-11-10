---
title: Runtime configuration, multi-arch, tags, and registries
tech: Docker, .NET 10 runtime, Azure Container Registry
version: .NET 10, Docker buildx, ACR (Premium for retention)
date: 2026-11-09
covers: [6, 11, 12]
---
# Runtime configuration, multi-arch, tags, and registries
[← Overview](00-overview.md)

## Why it matters
- The API ran with a 512 MB memory limit and was OOM-killed every few hours. The heap limit wasn't set and a cache grew without bounds; `dotnet-counters` showed it in minutes once someone looked.
- Production was deployed with `shop-api:latest`. A rollback "to the previous version" redeployed the same broken image, because `latest` had moved.
- A developer on an Apple Silicon Mac pushed an `arm64` image to the registry. Production (`amd64`) failed with `exec format error`.

## Concepts

### Runtime configuration
| Item | Practice |
|:--|:--|
| ⭐ environment variables | `ASPNETCORE_ENVIRONMENT`, `ConnectionStrings__Shop` (`__` = `:` in config keys) |
| ⭐ runtime secrets | from the platform: Container Apps secrets backed by Key Vault, managed identity; never baked in |
| ⭐ signals and PID 1 | exec-form `ENTRYPOINT` so .NET receives SIGTERM and shuts down gracefully (03-backend/08-reliability) |
| ⭐ memory limits | .NET reads the cgroup limit; GC heap defaults to 75% of it; tune `DOTNET_GCHeapHardLimitPercent` if needed |
| CPU limits | `Environment.ProcessorCount` reflects the CPU quota; thread pool and GC adapt |
| GC mode | Server GC with DATAS (.NET 9+) adapts to small containers; `DOTNET_gcServer=0` for tiny sidecars |
| ports | `ASPNETCORE_HTTP_PORTS=8080`; TLS terminates at the ingress |
| read-only filesystem | write only to `/tmp` or mounted volumes |
| time zone / culture | plain chiseled images: no tzdata/ICU (invariant mode); use the `-extra` variant when you need them |

### Multi-architecture images
| Item | Meaning |
|:--|:--|
| `linux/amd64`, `linux/arm64` | the two platforms that matter (x64 servers, ARM servers and Apple Silicon) |
| ⭐ manifest list (image index) | one tag pointing to one image per platform; the runtime pulls the right one |
| `docker buildx build --platform linux/amd64,linux/arm64` | build both |
| ⭐ cross-compile, don't emulate | `FROM --platform=$BUILDPLATFORM ...sdk` + `dotnet publish -a $TARGETARCH`: the SDK runs natively and targets the other CPU, avoiding slow QEMU emulation |
| SQL Server | `mssql/server` is amd64-only; on Apple Silicon it runs under emulation |

Build multi-arch only when you deploy to both (for example ARM-based nodes for cost). For Container Apps on x64, `linux/amd64` alone is fine; just set `--platform linux/amd64` explicitly on ARM laptops.

### Tags, digests, and registries
| Practice | Why |
|:--|:--|
| ⭐ immutable tags | `sha-3f2c1ab` (git SHA) and `1.4.0` (release); never reuse |
| ⭐ deploy by digest | `shopacr.azurecr.io/shop-api@sha256:...` is exactly what was tested |
| `latest` | convenience for local use only |
| ⭐ Azure Container Registry | private registry; managed identity pull (`AcrPull`) from Container Apps |
| ACR SKUs | Basic / Standard / Premium (geo-replication, private link, retention policy) |
| retention | untagged manifests purged after N days (Premium), or `acr purge` on a schedule (ACR Tasks) |
| tag locking | `az acr repository update --write-enabled false` for release images |
| Defender for Containers | scans images in ACR |

## Example
`src/Shop.Api/Dockerfile` (multi-arch build stage)
```dockerfile
# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /src
COPY . .
RUN dotnet publish src/Shop.Api/Shop.Api.csproj -c Release -a $TARGETARCH -o /app /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled-extra
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
ENTRYPOINT ["dotnet", "Shop.Api.dll"]
```
(Shortened: use the cached restore layout from lesson 02, restoring with `-a $TARGETARCH`.)

`terminal`
```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t shopacr.azurecr.io/shop-api:sha-3f2c1ab --push -f src/Shop.Api/Dockerfile .
docker buildx imagetools inspect shopacr.azurecr.io/shop-api:sha-3f2c1ab    # shows both platforms and the digest

docker run --rm -m 512m --cpus 1 -e DOTNET_GCHeapHardLimitPercent=60 shop-api:dev   # try limits locally

az acr run --registry shopacr --cmd "acr purge --filter 'shop-api:sha-.*' --ago 90d --keep 50 --untagged" /dev/null
```
Container Apps pulling from ACR with a managed identity (Bicep excerpt, 02-cloud):
```bicep
configuration: {
  registries: [ { server: 'shopacr.azurecr.io', identity: 'system' } ]
}
template: {
  containers: [ { name: 'api', image: 'shopacr.azurecr.io/shop-api@${imageDigest}', resources: { cpu: json('0.5'), memory: '1Gi' } } ]
}
```

## Production patterns
- Configuration through environment variables and platform secrets; nothing environment-specific in the image.
- Memory and CPU limits set on every container and tested locally with `docker run -m --cpus`; GC behaviour checked with `dotnet-counters`.
- Images tagged with the git SHA (and a release version), deployed by digest, never with `latest`.
- ACR with managed identity pulls, retention for old images, and Defender scanning; multi-arch only where you run both architectures.

## Mistakes
Wrong: `image: shop-api:latest` in production.
Right: `shop-api@sha256:...` from the pipeline that tested it.

Wrong: `docker buildx build --platform linux/arm64,linux/amd64` with the SDK stage emulated under QEMU (20-minute builds).
Right: `FROM --platform=$BUILDPLATFORM` for the build stage and `-a $TARGETARCH` for publish.

## Check yourself
1. How does .NET decide its GC heap limit in a container?
2. Why deploy by digest instead of by tag?
3. How do you avoid slow emulated builds for multi-arch .NET images?

<details><summary>Answers</summary>

1. It reads the container's cgroup memory limit and, by default, limits the GC heap to 75% of it. `DOTNET_GCHeapHardLimit` or `DOTNET_GCHeapHardLimitPercent` override that.
2. A digest identifies one exact image forever; a tag can be moved or overwritten. Deploying the digest guarantees production runs exactly what was tested, and rollbacks are precise.
3. Run the SDK stage on the build machine's own platform (`FROM --platform=$BUILDPLATFORM`) and cross-publish for the target with `-a $TARGETARCH`; only the final runtime stage is per-platform.
</details>

## Sources
- [Runtime configuration options for garbage collection](https://learn.microsoft.com/dotnet/core/runtime-config/garbage-collector)
- [Multi-platform builds](https://docs.docker.com/build/building/multi-platform/)
- [Improving multi-platform container support (.NET blog)](https://devblogs.microsoft.com/dotnet/improving-multiplatform-container-support/)
- [ACR best practices](https://learn.microsoft.com/azure/container-registry/container-registry-best-practices)
- [Purge images in ACR](https://learn.microsoft.com/azure/container-registry/container-registry-auto-purge)
- [Container Apps: managed identity image pull](https://learn.microsoft.com/azure/container-apps/managed-identity-image-pull)
