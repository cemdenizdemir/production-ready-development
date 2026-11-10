---
title: Containers
module: 04-shipping
tech: Docker, Docker Compose, .NET SDK containers, Aspire
---
# Containers
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Containers vs VMs: images, layers, containers, registries
- [ ] ⭐ Production Dockerfiles for .NET: multi-stage builds from SDK to runtime, chiseled images, non-root user
- [ ] ⭐ Building images without a Dockerfile: `dotnet publish /t:PublishContainer`, base images, tags
- [ ] ⭐ Layer caching and build speed: instruction order, `.dockerignore`, BuildKit cache mounts
- [ ] ⭐ Image security: minimal and pinned bases, scanning, no secrets in images, SBOMs
- [ ] Runtime configuration: environment variables, runtime secrets, signals and PID 1, memory limits
- [ ] Docker Compose for local development: healthchecks, ordered startup, volumes, profiles, watch
- [ ] SQL Server in a container for development: image, memory, volumes, healthchecks
- [ ] Aspire for local orchestration: the AppHost, resources, references; Aspire vs Docker Compose
- [ ] Next.js in containers: standalone output, static assets, multiple instances
- [ ] Multi-architecture images: amd64 and arm64, cross-building with `--platform`
- [ ] Tags, registries, and retention: immutable SHA tags, digests, Azure Container Registry retention
- [ ] Debugging containers: logs, exec, inspect, exit codes, resource limits

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Images, Dockerfiles for .NET, and SDK container builds](docs/01-images-dockerfiles-sdk.md)
- [02 · Build speed and image security](docs/02-build-speed-security.md)
- [03 · Runtime configuration, multi-arch, tags, and registries](docs/03-runtime-multiarch-registries.md)
- [04 · Local orchestration: Compose, SQL Server, and Aspire](docs/04-compose-sql-aspire.md)
- [05 · Next.js in containers and debugging containers](docs/05-nextjs-debugging.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/04-shipping/01-containers mode=tasks` when you are ready to build._
