---
title: Images and production Dockerfiles
tech: Docker, Node.js 26, pnpm
version: Docker Engine with BuildKit, Dockerfile syntax 1, node:26-slim, pnpm 10
date: 2026-11-07
covers: [1, 2, 3]
---
# Images and production Dockerfiles
[← Overview](00-overview.md)

## Why it matters
- The API image is 1.4 GB because it contains build tools, dev dependencies, tests, and the `.git` folder. Every deploy pulls it to new Fargate tasks, and scale-out takes minutes.
- `COPY . .` comes before `pnpm install`, so changing one line of code reinstalls every dependency. Each CI build takes nine minutes.
- The container runs as root. A remote code execution bug gives the attacker root inside the container and write access to the app's own code.

## Concepts

### Images, layers, containers
| Concept | Meaning |
|:--|:--|
| Image | read-only layers + metadata (entrypoint, env, user, exposed ports) |
| Layer | the filesystem change from one Dockerfile instruction; cached and shared between images |
| Container | a process running from an image, with its own filesystem view, network, and limits |
| Registry | stores images by repository and tag or digest (ECR, GHCR, Docker Hub) |
| Tag | a movable name (`:sha-3f2a1c9`, `:1.4.2`) |
| Digest | the content hash (`@sha256:…`); never changes |
| vs a VM | containers share the host kernel: faster and lighter, weaker isolation than VMs |

### Base images for Node
| Base | Good | Watch out |
|:--|:--|:--|
| `node:26` (full Debian) | everything included, compiles native modules | large, many packages to patch |
| **`node:26-slim`** | small Debian, glibc, good default | add build tools in a build stage if a native module needs them |
| `node:26-alpine` | smallest common choice | musl libc: some native modules and DNS behave differently |
| Distroless / hardened images | no shell or package manager, tiny attack surface | harder to debug (also seen: Google distroless, Chainguard, Docker Hardened Images) |

### Production Dockerfile rules
| Rule | Why |
|:--|:--|
| Multi-stage build | build tools and dev dependencies never reach the final image |
| Dependencies before source | the install layer stays cached until the lockfile changes |
| `.dockerignore` | keeps `node_modules`, `.git`, `.env*`, tests out of the build context |
| Production dependencies only | `pnpm install --prod --frozen-lockfile` |
| BuildKit cache mounts | reuse the pnpm store across builds without storing it in a layer |
| `USER node` | never run as root; the official images include a `node` user |
| App files owned by root | the process can read its code but not change it |
| `NODE_ENV=production` | libraries switch to production behavior |
| Exec-form `CMD ["node", …]` | Node is the process that receives SIGTERM |
| One process per container | API and worker are separate containers from the same image |

### Layer caching
Docker reuses a layer when the instruction and its inputs are unchanged, and rebuilds every layer after the first change. Order instructions **from least to most frequently changed**: base image → system packages → package manager → lockfile + install → source code.

## Example
`.dockerignore`
```text
node_modules
.git
.github
.env*
!.env.example
coverage
dist
*.log
**/*.test.ts
test
Dockerfile*
compose*.yaml
```
`Dockerfile` — the Express API and the BullMQ worker share one image; Node 26 runs the TypeScript sources directly.
```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:26-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN npm install -g pnpm@10.18.0           # same version as "packageManager" in package.json
WORKDIR /app

# 1. Production dependencies: cached until package.json or the lockfile changes
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

# 2. Runtime: no pnpm, no dev dependencies, no build tools
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER node
EXPOSE 3000
CMD ["node", "--import", "./src/instrumentation.ts", "src/server.ts"]
# the worker task overrides the command: ["node", "--import", "./src/instrumentation.ts", "src/jobs/worker.ts"]
```
Building and checking:
```bash
docker buildx build -t shop-api:dev .                 # BuildKit is the default builder
docker image ls shop-api                              # size check
docker image history shop-api:dev                     # which layer is big?
docker run --rm -p 3000:3000 --env-file .env shop-api:dev
docker run --rm shop-api:dev id                       # uid=1000(node): not root
```
If a native module needs compiling (no prebuilt binary for your platform), install `python3 make g++` in the `deps` stage only; the runtime stage stays clean. In a pnpm workspace, `pnpm deploy --prod --filter api /out` produces a self-contained folder for one package to copy into the runtime stage.

## Production patterns
- **Multi-stage builds on `node:26-slim`**, production dependencies only, `USER node`, code owned by root.
- **Cache-friendly order** plus `.dockerignore` and BuildKit cache mounts; CI reuses the layer cache ([01-foundations/04-ci-cd lesson 04](../../../01-foundations/04-ci-cd/docs/04-docker-and-reuse.md)).
- **One image, several process types** (API, worker, migrations) selected by the command.
- **No build step for the API** thanks to type stripping; a build stage only where needed (Next.js).
- **Image size and layer history** checked when the Dockerfile changes.

## Mistakes
Wrong: copying everything before installing.
```dockerfile
COPY . .
RUN pnpm install          # any code change invalidates the dependency layer
```
Right: copy `package.json` and `pnpm-lock.yaml`, install, then copy the source.

Wrong: a single stage with dev dependencies and build tools.
```dockerfile
FROM node:26
COPY . .
RUN pnpm install && pnpm build
CMD npm start             # huge image, root user, shell form, npm swallowing signals
```
Right: multi-stage, `--prod` dependencies, `USER node`, exec-form `CMD ["node", …]`.

Wrong: no `.dockerignore`. The context includes `.env` and `.git`, and secrets can end up in a layer. Right: ignore them, and keep secrets out of builds entirely (lesson 02).

Wrong: `chown -R node:node /app` on everything. The process can rewrite its own code after a compromise. Right: code owned by root, readable by `node`; only writable paths (if any) owned by `node`.

## Check yourself
1. Why do dependency files get copied before the source code?
2. What does a multi-stage build remove from the final image?
3. Why should the app files be owned by root while the process runs as `node`?

<details>
<summary>Answers</summary>

1. Docker caches each layer and rebuilds everything after the first changed one. The dependency install only depends on `package.json` and the lockfile, so copying them first keeps the slow install cached while the frequently changing source is copied afterwards.
2. Everything only needed to build: compilers and build tools, the package manager, dev dependencies, caches, and intermediate files. Only what the final stage copies in survives.
3. The process can read and run its code but can't modify it, so a compromised process can't plant changes in the application files; it also can't bind privileged ports or change system files.
</details>

## Sources
- [Docker — Building best practices](https://docs.docker.com/build/building/best-practices/)
- [Docker — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker — Optimize cache usage](https://docs.docker.com/build/cache/optimize/)
- [Docker Node.js best practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [pnpm — Working with Docker](https://pnpm.io/docker)
