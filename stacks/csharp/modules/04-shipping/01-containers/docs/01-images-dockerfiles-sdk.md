---
title: Images, Dockerfiles for .NET, and SDK container builds
tech: Docker, .NET SDK container publishing
version: .NET 10 SDK 10.0.x, Docker BuildKit
date: 2026-11-09
covers: [1, 2, 3]
---
# Images, Dockerfiles for .NET, and SDK container builds
[← Overview](00-overview.md)

## Why it matters
- The image was built `FROM mcr.microsoft.com/dotnet/sdk` and shipped as is: 900 MB, with compilers, a shell, and source code. Every deploy pulled almost a gigabyte, and a scanner found 140 vulnerabilities in tools the app never used.
- The container ran as root. A path-traversal bug let an attacker write to `/etc`, which a non-root user couldn't have done.
- `dotnet publish` ran on the developer's laptop and the output was copied into the image. A CI build would have produced different bytes.

## Concepts

### Containers vs VMs
| | VM | Container |
|:--|:--|:--|
| isolates | a whole machine with its own kernel | a process tree with namespaces and cgroups, sharing the host kernel |
| starts in | tens of seconds to minutes | milliseconds to seconds |
| size | GBs | MBs |
| unit you ship | disk image | ⭐ OCI image: layers + config |

| Term | Meaning |
|:--|:--|
| ⭐ image | read-only layers and metadata, addressed by digest (`sha256:...`) |
| ⭐ layer | the filesystem change from one build step; shared and cached |
| ⭐ container | a running (or stopped) instance of an image with a writable layer |
| ⭐ registry | stores images: Docker Hub, MCR (Microsoft), ACR (yours) |
| tag | a movable name (`shop-api:1.4.0`); digest is the immutable identity |

### Production Dockerfile for ASP.NET Core
| Practice | Why |
|:--|:--|
| ⭐ multi-stage: `sdk` to build, `aspnet` to run | the runtime image has no SDK, sources, or build tools |
| ⭐ chiseled / distroless runtime | no shell, no package manager, far fewer CVEs |
| ⭐ non-root user | `USER $APP_UID` (built into .NET 8+ images; chiseled images default to it) |
| restore before copying sources | dependency layers stay cached (lesson 02) |
| `ENTRYPOINT ["dotnet", "Shop.Api.dll"]` (exec form) | the app is PID 1 and receives SIGTERM |
| port 8080 | default `ASPNETCORE_HTTP_PORTS=8080`; no root needed for ports > 1024 |
| ⭐ globalization and time zones | plain chiseled images have no ICU or tzdata and run in invariant mode; the shop formats prices by culture and schedules Hangfire jobs in `Europe/Istanbul`, so it uses the `-extra` variant |

| Runtime base | Size / content | Use |
|:--|:--|:--|
| `aspnet:10.0` | Ubuntu 24.04 with shell | debugging, if you need tools |
| ⭐ `aspnet:10.0-noble-chiseled` | Ubuntu chiseled, no shell, no ICU/tzdata | production, if invariant culture and UTC are enough |
| ⭐ `aspnet:10.0-noble-chiseled-extra` | chiseled + ICU + tzdata | production for this shop (cultures, time zones) |
| `aspnet:10.0-azurelinux3.0-distroless` | Azure Linux distroless | Microsoft-supported distro |
| `runtime-deps:10.0-noble-chiseled` | no .NET runtime | self-contained or Native AOT apps |

### Building without a Dockerfile
The .NET SDK can build an OCI image directly: `dotnet publish -t:PublishContainer`. It picks the right base image, sets the non-root user, port, and entrypoint, and can push to a registry, all without Docker installed.
| MSBuild property | Example |
|:--|:--|
| `ContainerRepository` | `shop-api` |
| `ContainerImageTags` | `1.4.0;sha-3f2c1ab` |
| ⭐ `ContainerFamily` | `noble-chiseled-extra` |
| `ContainerBaseImage` | `mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled-extra` |
| `ContainerRegistry` | `shopacr.azurecr.io` (push directly) |
| `ContainerUser` | defaults to `app` |
| `ContainerPort` | `8080` |
| `ContainerArchiveOutputPath` | write a `.tar.gz` instead of loading into Docker |

Use the SDK route for plain .NET services; use a Dockerfile when you need extra OS packages, a custom build process, or one tool for all languages in the repo.

## Example
`src/Shop.Api/Dockerfile`
```dockerfile
# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props global.json ./
COPY src/Shop.Api/Shop.Api.csproj src/Shop.Api/
COPY src/Shop.Application/Shop.Application.csproj src/Shop.Application/
COPY src/Shop.Infrastructure/Shop.Infrastructure.csproj src/Shop.Infrastructure/
RUN dotnet restore src/Shop.Api/Shop.Api.csproj
COPY src/ src/
RUN dotnet publish src/Shop.Api/Shop.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled-extra AS final
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Shop.Api.dll"]
```
`terminal`
```bash
docker build -f src/Shop.Api/Dockerfile -t shop-api:dev .
docker run --rm -p 8080:8080 -e ASPNETCORE_ENVIRONMENT=Development shop-api:dev
docker image ls shop-api            # compare sizes: sdk ~ 900 MB vs chiseled runtime ~ 120 MB
```
The same image without a Dockerfile:
```bash
dotnet publish src/Shop.Api -c Release -t:PublishContainer \
  -p ContainerFamily=noble-chiseled-extra -p ContainerRepository=shop-api -p ContainerImageTags=dev
```
Or set the properties once in `src/Shop.Api/Shop.Api.csproj`:
```xml
<PropertyGroup>
  <ContainerRepository>shop-api</ContainerRepository>
  <ContainerFamily>noble-chiseled-extra</ContainerFamily>   <!-- ICU + tzdata: cultures and IANA time zones -->
</PropertyGroup>
```

## Production patterns
- Multi-stage builds (or SDK container publishing) into chiseled or distroless runtime images, running as non-root on port 8080.
- Images are built only in CI from a clean checkout, never on laptops for release.
- One image per deployable (API, worker, frontend), promoted unchanged through environments (04-deployments).
- A debugging variant (with a shell) is a separate tag, never the production image (lesson 05).

## Mistakes
Wrong:
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0
COPY . .
RUN dotnet publish -c Release -o out
ENTRYPOINT dotnet out/Shop.Api.dll          # shell form: dotnet isn't PID 1, SIGTERM is lost; runs as root
```
Right: multi-stage, chiseled runtime, `USER $APP_UID`, exec-form `ENTRYPOINT`.

Wrong: `COPY bin/Release/net10.0/publish/ .` from a local build.
Right: build inside the Dockerfile (or with the SDK in CI) so every image is reproducible.

## Check yourself
1. What's the difference between a tag and a digest?
2. Why use a chiseled runtime image?
3. When would you choose `dotnet publish -t:PublishContainer` over a Dockerfile?

<details><summary>Answers</summary>

1. A tag is a movable name that can point to different images over time. A digest (`sha256:...`) is the content hash of one exact image and never changes.
2. It contains only what the .NET app needs: no shell, no package manager, a non-root user by default. That means a smaller image, fewer vulnerabilities, and less for an attacker to use.
3. For standard .NET services where the SDK's defaults (base image, user, port, entrypoint) are enough, especially in CI without Docker. Use a Dockerfile when you need OS packages, custom steps, or a single build tool across languages.
</details>

## Sources
- [Containerize a .NET app](https://learn.microsoft.com/dotnet/core/docker/build-container)
- [Containerize a .NET app with dotnet publish](https://learn.microsoft.com/dotnet/core/containers/sdk-publish)
- [.NET 10: default images use Ubuntu](https://learn.microsoft.com/dotnet/core/compatibility/containers/10.0/default-images-use-ubuntu)
- [Ubuntu chiseled .NET images](https://github.com/dotnet/dotnet-docker/blob/main/documentation/ubuntu-chiseled.md)
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
