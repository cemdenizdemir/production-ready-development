---
title: Next.js in containers and debugging containers
tech: Next.js 16 standalone output, Docker, Azure Container Apps
version: Next.js 16, Node.js 24 LTS, Docker Engine 28+
date: 2026-11-09
covers: [10, 13]
---
# Next.js in containers and debugging containers
[← Overview](00-overview.md)

## Why it matters
- The frontend image copied the whole repo with `node_modules`: 1.4 GB, 90 seconds to pull on every scale-out.
- Replicas from two separate builds of the same version were live at once. Server Actions failed at random with "Failed to find Server Action", because each build had generated its own encryption key.
- A container exited with code 139 and restarted in a loop. Nobody knew that means a segfault, or how to look inside a chiseled image with no shell.

## Concepts

### Next.js standalone output
| Item | Practice |
|:--|:--|
| ⭐ `output: "standalone"` | Next.js traces the files the server needs into `.next/standalone` (a minimal `node_modules` and `server.js`) |
| ⭐ copy static files | `.next/static` and `public/` are **not** in standalone; copy them (or serve them from a CDN) |
| run | `node server.js` with `HOSTNAME=0.0.0.0` and `PORT=3000` |
| base image | `node:24-slim` or a distroless Node image; non-root `node` user |
| build-time vs runtime env | `NEXT_PUBLIC_*` values are inlined at build; read server-only config at runtime |

### Multiple instances
| Concern | Fix |
|:--|:--|
| ⭐ Server Actions encryption key | set the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (base64 AES key) for every build and replica of a version |
| ⭐ version skew | set `deploymentId` (for example the git SHA) so clients from an old version reload instead of calling a new server |
| shared cache | the default cache is per instance; for consistent ISR/`use cache` across replicas, configure a shared cache handler (Redis) or keep caching at the CDN |
| static assets | serve `/_next/static/*` from Front Door with long, immutable caching; old assets must stay available during rollout |
| image optimisation | `next/image` uses CPU and disk per replica; consider a CDN or a loader |

### Debugging containers
| Need | Command |
|:--|:--|
| ⭐ logs | `docker logs -f <c>`; Container Apps: `az containerapp logs show -n api -g rg --follow` |
| ⭐ status and exit code | `docker ps -a`, `docker inspect <c> --format '{{.State.ExitCode}} {{.State.OOMKilled}}'` |
| shell (when the image has one) | `docker exec -it <c> sh`; Container Apps: `az containerapp exec -n api -g rg` |
| no shell (chiseled) | `docker debug <c>` (Docker Desktop), or a debug sidecar sharing the process namespace; or run the same app on the non-chiseled `aspnet:10.0` tag |
| resource use | `docker stats`; `dotnet-counters` / `dotnet-dump` via a diagnostics sidecar or `DOTNET_DiagnosticPorts` |
| config | `docker inspect` (env, mounts, user, entrypoint) |
| image content | `docker history`, `docker image inspect`, `dive` |

| Exit code | Usually means |
|:--|:--|
| 0 | clean exit (did the app finish instead of serving?) |
| 1 | unhandled exception at startup (config missing, can't bind port) |
| ⭐ 137 | SIGKILL: OOM-killed or killed after the shutdown grace period |
| 139 | segfault (native crash) |
| 143 | SIGTERM handled, but exited with the signal code |

## Example
`frontend/next.config.ts`
```typescript
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  deploymentId: process.env.DEPLOYMENT_ID,     // git SHA from CI
};
export default config;
```
`frontend/Dockerfile`
```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DEPLOYMENT_ID
ENV DEPLOYMENT_ID=$DEPLOYMENT_ID NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=secret,id=sa_key,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY npm run build

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```
The Server Actions key is a build secret from Key Vault (same value for every build of the environment); the deployment ID is the git SHA.

Debugging a crashing API container:
```bash
docker ps -a --filter name=api
docker inspect api --format '{{.State.ExitCode}} OOM={{.State.OOMKilled}}'
docker logs api --tail 100
docker run --rm -it --entrypoint sh mcr.microsoft.com/dotnet/aspnet:10.0   # a shell image to test the same runtime
az containerapp logs show -n shop-api -g rg-shop-prod --type system --follow  # platform events: probes, OOM, restarts
```

## Production patterns
- The frontend is its own image with standalone output, static files copied (or on the CDN), a non-root user, and runtime config from the platform.
- Every replica of a version shares the Server Actions key and deployment ID; old static assets stay available during rollouts.
- Debugging starts with exit codes, `OOMKilled`, logs, and platform system logs, then a debug sidecar or a non-chiseled image, never by adding a shell to production images.

## Mistakes
Wrong:
```dockerfile
FROM node:24
COPY . .
RUN npm install && npm run build
CMD ["npm", "start"]          # huge image, dev dependencies, npm as PID 1
```
Right: multi-stage with `output: "standalone"`, copy `.next/static` and `public`, run `node server.js` as `node`.

Wrong: adding `curl` and `bash` to the production API image "for debugging".
Right: keep the image minimal; use `docker debug`, a sidecar, or the non-chiseled tag in a debug session.

## Check yourself
1. Which folders must you copy next to `.next/standalone`?
2. Why must all replicas share `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`?
3. What does exit code 137 tell you, and how do you confirm it?

<details><summary>Answers</summary>

1. `.next/static` (to `.next/static`) and `public/`, unless a CDN serves them.
2. Server Action IDs and closures are encrypted with that key. A request built against one key fails on a replica or build that uses another.
3. The process was killed with SIGKILL, usually by the OOM killer or after the shutdown grace period. `docker inspect` shows `OOMKilled: true`, and Container Apps system logs show OOM or termination events.
</details>

## Sources
- [Next.js — output: standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Next.js — self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js — deploymentId and version skew](https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId)
- [docker debug](https://docs.docker.com/reference/cli/docker/debug/)
- [Container Apps logs](https://learn.microsoft.com/azure/container-apps/logging)
- [Debug .NET in containers](https://learn.microsoft.com/dotnet/core/diagnostics/diagnostics-in-containers)
