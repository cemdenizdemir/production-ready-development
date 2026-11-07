---
title: Image security, runtime configuration, and registries
tech: Docker, Amazon ECR, GitHub Actions
version: Docker Engine with BuildKit, Docker Scout, Amazon ECR (enhanced scanning with Amazon Inspector), Dependabot
date: 2026-11-07
covers: [4, 5, 9]
---
# Image security, runtime configuration, and registries
[← Overview](00-overview.md)

## Why it matters
- An `ARG NPM_TOKEN` used during the build is visible in the image history. Anyone who can pull the image can publish packages as your company.
- The base image hasn't been rebuilt in 14 months. A scanner finds 230 known vulnerabilities, 12 of them critical, in OpenSSL and glibc.
- Production runs `api:latest`. A rollback "deploys" the same broken image, because `latest` was overwritten an hour ago.

## Concepts

### Image security
| Practice | How |
|:--|:--|
| Minimal base | `node:26-slim` or a hardened/distroless image; fewer packages, fewer CVEs |
| Rebuild regularly | weekly rebuilds pick up patched base layers even without code changes |
| Pin by digest | `FROM node:26-slim@sha256:…`; Dependabot or Renovate opens PRs for new digests |
| Scan | Docker Scout (`docker scout cves`), ECR enhanced scanning (Amazon Inspector); also seen: Trivy, Grype |
| Fail CI on fixable criticals | gate on severity **and** "fix available", or the gate is ignored |
| No secrets in images | never `ARG`/`ENV`/`COPY` secrets; use BuildKit secret mounts at build time |
| Non-root, read-only | `USER node`; read-only root filesystem where possible |
| SBOM and provenance | `--sbom=true --provenance=mode=max`; know what's inside and who built it |
| Drop capabilities | ECS/Fargate run without privileged mode; don't add capabilities |

### Runtime configuration
| Concern | Practice |
|:--|:--|
| Configuration | environment variables, validated at startup ([01-foundations/07-config-environments](../../../01-foundations/07-config-environments/README.md)) |
| Secrets | injected at runtime (ECS `secrets` from Secrets Manager or SSM), never baked in |
| Signals | exec-form `CMD`, or an init process (`docker run --init`, ECS `initProcessEnabled`) |
| Health | `HEALTHCHECK` for local Docker/Compose; ECS uses the task definition's `healthCheck` instead |
| Memory | container limit + `NODE_OPTIONS=--max-old-space-size` ≈ 75% of it |
| Logs | JSON to stdout/stderr; the platform collects them |
| Filesystem | stateless; temp files in `/tmp`; persistent data in S3 or a database |
| Time zone | UTC in containers; convert at the edges |

### Registries and tags
| Practice | How |
|:--|:--|
| Immutable tags | git SHA tags; ECR tag immutability turned on |
| Deploy by digest | task definitions reference `image@sha256:…` or an immutable tag |
| Promote, don't rebuild | staging and production run the same digest |
| Lifecycle policy | expire untagged images after days; keep the last N release images |
| Scan on push | ECR enhanced scanning, findings to Security Hub/alerts |
| Access | CI pushes via OIDC role; tasks pull via the execution role |
| `latest` | avoid in deployments; it says nothing about what runs |

## Example
A private registry token at build time, without leaving it in any layer:
```dockerfile
# syntax=docker/dockerfile:1
FROM node:26-slim@sha256:<digest> AS deps
RUN npm install -g pnpm@10.18.0
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile
```
```bash
docker buildx build --secret id=npmrc,src=$HOME/.npmrc -t shop-api:dev .
```
Scanning and attestations:
```bash
docker scout quickview shop-api:dev                     # summary of vulnerabilities and base image advice
docker scout cves --only-fixed --only-severity critical,high shop-api:dev
docker buildx build --sbom=true --provenance=mode=max -t <account>.dkr.ecr.eu-central-1.amazonaws.com/shop-api:sha-3f2a1c9 --push .
```
`.github/dependabot.yml` — new base image digests and Actions versions as PRs.
```yaml
version: 2
updates:
  - package-ecosystem: docker
    directory: /
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```
ECR lifecycle policy (JSON) — expire untagged images, keep the last 50 SHA-tagged ones.
```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "expire untagged images after 7 days",
      "selection": { "tagStatus": "untagged", "countType": "sinceImagePushed", "countUnit": "days", "countNumber": 7 },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 2,
      "description": "keep the last 50 release images",
      "selection": { "tagStatus": "tagged", "tagPrefixList": ["sha-"], "countType": "imageCountMoreThan", "countNumber": 50 },
      "action": { "type": "expire" }
    }
  ]
}
```
A local health check for Compose (ECS ignores this and uses the task definition):
```dockerfile
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health/live').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
```

## Production patterns
- **Digest-pinned, regularly rebuilt base images**, updated through Dependabot PRs.
- **Scans in CI and in the registry**, failing only on fixable high and critical findings.
- **Secrets only at runtime** (and BuildKit secret mounts when a build truly needs one).
- **Immutable SHA tags, deployed by digest**, promoted from staging to production unchanged.
- **Lifecycle policies** so the registry doesn't grow forever, while recent releases stay available for rollback.

## Mistakes
Wrong: secrets as build arguments.
```dockerfile
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && pnpm install   # in the image history forever
```
Right: `RUN --mount=type=secret,id=npmrc,…`.

Wrong: deploying `:latest`. Rollbacks and audits can't tell versions apart. Right: immutable SHA tags or digests.

Wrong: scanning without a policy. 400 findings, nobody acts, the scanner gets ignored. Right: gate on fixable high/critical, track the rest, rebuild weekly.

Wrong: baking environment-specific config into the image (`ENV API_URL=https://staging…`). Right: one image, configuration at runtime.

## Check yourself
1. How do you give a build access to a private registry without leaking the token?
2. Why pin base images by digest, and how do you keep them updated?
3. Why promote the same image instead of rebuilding per environment?

<details>
<summary>Answers</summary>

1. Use a BuildKit secret mount (`RUN --mount=type=secret,id=npmrc,target=/root/.npmrc`) and pass the file with `--secret`. The secret is available only during that `RUN` step and is never stored in a layer or the image history.
2. A tag like `node:26-slim` changes over time, so builds aren't reproducible and changes arrive unreviewed. A digest is exact; Dependabot or Renovate proposes new digests as PRs, so updates are deliberate, tested, and frequent.
3. What you tested is exactly what runs: same bytes, same dependencies. Rebuilding can pull different base layers or packages, so production might run something staging never saw.
</details>

## Sources
- [Docker — Build secrets](https://docs.docker.com/build/building/secrets/)
- [Docker Scout](https://docs.docker.com/scout/)
- [Docker — Build attestations (SBOM and provenance)](https://docs.docker.com/build/metadata/attestations/)
- [Amazon ECR — Lifecycle policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html)
- [Amazon ECR — Image tag mutability](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html)
