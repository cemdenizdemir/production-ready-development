---
title: Build speed and image security
tech: Docker BuildKit, Trivy, Docker Scout, Microsoft Defender for Containers
version: Docker BuildKit (buildx 0.2x), Trivy 0.6x
date: 2026-11-09
covers: [4, 5]
---
# Build speed and image security
[← Overview](00-overview.md)

## Why it matters
- `COPY . .` came before `dotnet restore`, so changing one line of code re-downloaded every NuGet package. Builds took 6 minutes per PR.
- The `.git` folder and `appsettings.Development.json` with a real connection string ended up inside the image. Anyone with pull access to the registry could read them.
- `FROM mcr.microsoft.com/dotnet/aspnet:latest` pulled a new major version on a Tuesday. The build passed and the app failed at startup in production.

## Concepts

### Layer caching
Each instruction creates a layer. If an instruction and its inputs haven't changed, BuildKit reuses the cached layer, and so on down the file until the first change.
| Practice | Effect |
|:--|:--|
| ⭐ copy project files, restore, then copy sources | code changes don't invalidate the restore layer |
| ⭐ `.dockerignore` | smaller build context, no `bin/`, `obj/`, `.git`, secrets |
| ⭐ BuildKit cache mounts | `RUN --mount=type=cache,target=/root/.nuget/packages dotnet restore`: the NuGet cache persists between builds |
| CI layer cache | `docker/build-push-action` with `cache-from/cache-to: type=gha` (or registry cache) |
| least-changing first | base image → OS packages → dependencies → code |
| small contexts | build from the repo root, but ignore everything you don't need |

### Image security
| Practice | How |
|:--|:--|
| ⭐ minimal base | chiseled / distroless runtime images (lesson 01) |
| ⭐ pinned base | a patch tag (`10.0.14-noble-chiseled-extra`) or digest (`@sha256:...`); Dependabot/Renovate bumps it |
| ⭐ scanning | Trivy or Docker Scout in CI (fail on fixable critical/high); Defender for Containers scans ACR |
| ⭐ no secrets in images | not in `COPY`, `ENV`, `ARG`, or layers; build secrets via `RUN --mount=type=secret` |
| SBOM and provenance | `docker buildx build --sbom=true --provenance=mode=max`, or `syft`; attach to the image |
| non-root, read-only | `USER $APP_UID`; read-only root filesystem where the platform allows |
| rebuild regularly | weekly rebuilds pick up base image patches even without code changes |
| signing (also seen) | Notation / cosign signatures verified before deploy |

Secrets removed in a later layer are still in the earlier one: `docker history` and layer extraction reveal them.

## Example
`.dockerignore`
```text
**/bin/
**/obj/
**/node_modules/
**/.next/
.git/
.github/
.vs/
.vscode/
**/*.user
**/appsettings.*.local.json
**/.env
**/.env.*
!**/.env.example
**/TestResults/
```
`src/Shop.Api/Dockerfile` (cache mount version, build stage)
```dockerfile
# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build      # pin a patch tag or @sha256 digest in real builds
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props global.json ./   # add nuget.config if you use private feeds
COPY src/Shop.Api/Shop.Api.csproj src/Shop.Api/
COPY src/Shop.Application/Shop.Application.csproj src/Shop.Application/
COPY src/Shop.Infrastructure/Shop.Infrastructure.csproj src/Shop.Infrastructure/
RUN --mount=type=cache,id=nuget,target=/root/.nuget/packages \
    dotnet restore src/Shop.Api/Shop.Api.csproj
COPY src/ src/
RUN --mount=type=cache,id=nuget,target=/root/.nuget/packages \
    dotnet publish src/Shop.Api/Shop.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false
```
A private feed token as a build secret (never `ARG`):
```dockerfile
RUN --mount=type=secret,id=nuget_token,env=NUGET_TOKEN \
    --mount=type=cache,id=nuget,target=/root/.nuget/packages \
    dotnet restore src/Shop.Api/Shop.Api.csproj
```
`docker buildx build --secret id=nuget_token,env=NUGET_TOKEN ...`

`.github/workflows/image.yml` (excerpt: cached build, scan, SBOM)
```yaml
- uses: docker/setup-buildx-action@v3
- uses: docker/build-push-action@v6
  with:
    context: .
    file: src/Shop.Api/Dockerfile
    tags: shop-api:${{ github.sha }}
    load: true
    cache-from: type=gha
    cache-to: type=gha,mode=max
    sbom: true
    provenance: mode=max
- uses: aquasecurity/trivy-action@<pinned-version-or-commit-sha>
  with:
    image-ref: shop-api:${{ github.sha }}
    severity: CRITICAL,HIGH
    ignore-unfixed: true
    exit-code: "1"
```

## Production patterns
- Dockerfiles ordered for caching, `.dockerignore` from day one, cache mounts locally and GitHub Actions cache in CI.
- Base images pinned and updated by bots; images rebuilt at least weekly; scans gate merges on fixable critical/high findings.
- No secrets anywhere in the image or its history; runtime secrets come from the platform (Key Vault references, managed identity).
- SBOM and provenance attached to every pushed image; Defender for Containers watches the registry.

## Mistakes
Wrong:
```dockerfile
COPY . .
RUN dotnet restore && dotnet publish -c Release -o /app
ARG NUGET_TOKEN                                   # visible in image history
```
Right: project files → restore (with cache mount and secret mount) → sources → publish.

Wrong: `FROM mcr.microsoft.com/dotnet/aspnet:latest`.
Right: a pinned tag or digest, updated deliberately through PRs.

## Check yourself
1. Why copy `.csproj` files and restore before copying the rest of the source?
2. Why is `ARG` not safe for secrets?
3. What does an SBOM give you after a new CVE is announced?

<details><summary>Answers</summary>

1. The restore layer then depends only on project and package files. Code changes leave it cached, so builds skip the slow package download.
2. Build arguments are recorded in the image metadata and history, so anyone who can pull the image can read them. Build secrets mounted with `--mount=type=secret` never become part of a layer.
3. A list of every package and version inside each image, so you can find which images contain the vulnerable component in minutes instead of rebuilding and rescanning everything.
</details>

## Sources
- [Docker build cache](https://docs.docker.com/build/cache/)
- [Build secrets](https://docs.docker.com/build/building/secrets/)
- [Cache mounts](https://docs.docker.com/build/cache/optimize/#use-cache-mounts)
- [SBOM and provenance attestations](https://docs.docker.com/build/metadata/attestations/)
- [Trivy](https://trivy.dev/)
- [Microsoft Defender for Containers](https://learn.microsoft.com/azure/defender-for-cloud/defender-for-containers-introduction)
