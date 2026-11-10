---
title: Docker images and reusable workflows
tech: GitHub Actions, Docker
version: GitHub Actions (Nov 2026), Docker Buildx, docker/build-push-action v6
date: 2026-11-07
covers: [8, 9]
---
# Docker images and reusable workflows
[← Overview](00-overview.md)

## Why it matters
- Images are tagged only `latest`. A rollback means guessing which build was running yesterday.
- Every build starts from zero: 9 minutes per image, because no layer cache survives between runs.
- Ten repos copy-paste the same 80-line pipeline. A security fix must be made ten times, and three get missed.

## Concepts

### Building images in CI
| Piece | Role |
|:--|:--|
| `docker/setup-buildx-action` | enables BuildKit features: cache export, multi-platform, attestations |
| `docker/login-action` | logs in to a registry (GHCR with `GITHUB_TOKEN`; ECR in [04-shipping](../../../04-shipping/04-deployments/README.md)) |
| `docker/metadata-action` | computes tags and OCI labels from git: SHA, branch, semver tag |
| `docker/build-push-action` | builds, caches, pushes, and attests |
| `cache-from/to: type=gha` | layer cache stored in the GitHub Actions cache |
| `provenance` / `sbom` | signed build provenance and a software bill of materials attached to the image |

### Tagging strategy
| Tag | Example | Use |
|:--|:--|:--|
| Commit SHA | `ghcr.io/acme/api:sha-3f2a1c9` | ⭐ what you deploy; immutable by convention |
| Semver (from a git tag) | `:1.4.2`, `:1.4` | releases |
| Branch | `:main` | moving pointer for humans; never deploy by it |
| `latest` | `:latest` | avoid in deployments |

Deploy by SHA tag, or better by digest (`@sha256:...`), so "what is running" is never ambiguous.

### Reuse: reusable workflows vs composite actions
| | Reusable workflow | Composite action |
|:--|:--|:--|
| Defined in | `.github/workflows/x.yml` with `on: workflow_call` | `action.yml` with `runs.using: composite` |
| Called as | a **job**: `jobs.ci.uses: org/repo/.github/workflows/x.yml@<sha>` | a **step**: `uses: ./.github/actions/setup` |
| Contains | whole jobs, runners, environments | steps only |
| Secrets | passed explicitly or `secrets: inherit` | from the caller's context |
| Good for | a standard pipeline shared by many repos | repeated setup inside jobs |

## Example
`.github/actions/setup/action.yml` — composite action for the repeated setup.
```yaml
name: setup
description: Install pnpm, Node, and dependencies
runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v5
      with:
        node-version-file: .nvmrc
        cache: pnpm
    - run: pnpm install --frozen-lockfile
      shell: bash
```
`.github/workflows/image.yml` — build on PRs, push on main and tags.
```yaml
name: image
on:
  pull_request:
  push:
    branches: [main]
    tags: ['v*']

permissions:
  contents: read

jobs:
  image:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      packages: write          # push to GHCR
      id-token: write          # sign provenance
      attestations: write
    steps:
      - uses: actions/checkout@v5
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        if: github.event_name != 'pull_request'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha,format=short
            type=semver,pattern={{version}}
            type=ref,event=branch
      - id: build
        uses: docker/build-push-action@v6
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: mode=max
          sbom: true
      - uses: actions/attest-build-provenance@v3
        if: github.event_name != 'pull_request'
        with:
          subject-name: ghcr.io/${{ github.repository }}
          subject-digest: ${{ steps.build.outputs.digest }}
          push-to-registry: true
```
Verify an image later: `gh attestation verify oci://ghcr.io/acme/api:sha-3f2a1c9 --owner acme`.

A reusable workflow and its caller:
```yaml
# .github/workflows/node-ci.yml (shared)
on:
  workflow_call:
    inputs:
      node-version-file: { type: string, default: .nvmrc }
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: ./.github/actions/setup
      - run: pnpm typecheck && pnpm lint && pnpm test
```
```yaml
# .github/workflows/ci.yml (caller)
on: pull_request
jobs:
  ci:
    uses: ./.github/workflows/node-ci.yml
```

## Production patterns
- **Build once per commit, tag with the SHA, deploy that digest everywhere.** Never rebuild for production.
- **Build (without pushing) on PRs** so Dockerfile breakage is caught before merge.
- **Layer cache in `type=gha` or the registry** (`type=registry,ref=...:buildcache`); order Dockerfile steps so dependencies cache well.
- **Provenance and SBOM on release images**; verify attestations before deploy when you can.
- **Central reusable workflows, pinned by SHA in callers.** Upgrade them deliberately, like a dependency.

## Mistakes
Wrong: deploy `latest`.
```yaml
image: ghcr.io/acme/api:latest # which build is this? rollback to what?
```
Right: `ghcr.io/acme/api:sha-3f2a1c9` or `ghcr.io/acme/api@sha256:...`.

Wrong: rebuilding the image in each environment's deploy job. Different base image patches or dependencies can sneak in between staging and production.
Right: build once, promote the same digest.

Wrong: `docker build` without Buildx cache settings. Every CI run starts cold.
Right: `cache-from: type=gha` and `cache-to: type=gha,mode=max`.

Wrong: a composite action that calls `run:` without `shell:`. Composite run steps require an explicit shell.
Right: `shell: bash` on every `run` step.

## Check yourself
1. Why deploy by digest rather than by tag?
2. When would you choose a reusable workflow over a composite action?
3. What does `cache-to: type=gha,mode=max` store that `mode=min` does not?

<details>
<summary>Answers</summary>

1. A digest names the exact image content and can't be changed; a tag can be moved by any later push. Digests make deploys and rollbacks exact.
2. When you want to share whole jobs (runner choice, environments, permissions, several steps across jobs), such as a standard pipeline for many repos. Composite actions only bundle steps inside a job.
3. Layers of all build stages, including intermediate stages of a multi-stage build. `min` keeps only the final image's layers, so stages like dependency install rebuild more often.
</details>

## Sources
- [Docker — GitHub Actions](https://docs.docker.com/build/ci/github-actions/)
- [docker/build-push-action](https://github.com/docker/build-push-action)
- [docker/metadata-action](https://github.com/docker/metadata-action)
- [GitHub — Reusing workflows](https://docs.github.com/en/actions/sharing-automations/reusing-workflows)
- [GitHub — Creating a composite action](https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-composite-action)
- [GitHub — Artifact attestations](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations)
