---
title: Deploying to Container Apps, rolling updates, and rollbacks
tech: Azure Container Apps revisions, Azure CLI, Azure Monitor alerts, GitHub Actions
version: Azure CLI 2.7x (containerapp extension), November 2026
date: 2026-11-09
covers: [4, 5, 10]
---
# Deploying to Container Apps, rolling updates, and rollbacks
[← Overview](00-overview.md)

## Why it matters
- The pipeline reported "deployed" as soon as the update command returned. The new revision was still failing its readiness probe; nobody found out until users did.
- A rollback meant re-running the whole pipeline for the old commit: 25 minutes of build and tests while checkout was broken.
- A release dropped a database column. Rolling back the code wasn't possible because the old code needed that column.

## Concepts

### How a Container Apps deployment works
| Step | What happens |
|:--|:--|
| 1 | `az containerapp update --image ...@sha256:...` creates a **new revision** |
| 2 | replicas of the new revision start; startup, then readiness probes must pass |
| 3 | single revision mode: traffic moves to the new revision once it's ready; the old one is deactivated |
| 4 | multiple revision mode: the new revision gets the traffic you assign (0% by default if you set it so) |
| ⭐ rolling | replicas are replaced gradually; probes gate each step; old replicas drain (03-backend/08-reliability graceful shutdown) |

| Property to watch | Meaning |
|:--|:--|
| ⭐ `provisioningState` | revision created (`Provisioned`) or `Failed` |
| ⭐ `healthState` | `Healthy` when probes pass; `Unhealthy` otherwise |
| `runningState` | `Running`, `Processing`, `Degraded`, `Failed`, `Stopped` |
| replicas | `az containerapp replica list` |

The pipeline must **wait for the new revision to be healthy** and then run smoke tests before declaring success.

### Revision modes
| Mode | Behaviour | Use |
|:--|:--|:--|
| ⭐ single | one active revision; automatic cut-over when ready | simple rolling updates |
| ⭐ multiple | several active revisions with traffic weights and labels | blue/green, canary, instant rollback |
| labels | stable URL per label (`ca-shop-api---green.<env-domain>`) | test a revision before it gets traffic |

### Rollbacks
| Situation | Fastest safe rollback |
|:--|:--|
| ⭐ multiple revision mode, old revision still active | shift traffic back: `az containerapp ingress traffic set ... --revision-weight <old>=100` (seconds) |
| old revision deactivated | `az containerapp revision activate` + traffic shift (a minute) |
| single revision mode | `az containerapp update --image <previous digest>` (a new revision with the old image) |
| bad configuration, not code | revert the config change (also creates a new revision) |
| ⭐ migration already applied | only possible if the schema change was backward compatible (expand/contract, lesson 04) |

**Alert-based rollback:** after a release, the pipeline (or an Azure Monitor alert through an action group calling a webhook or GitHub `repository_dispatch`) watches error rate and latency for the new revision and shifts traffic back automatically when they breach thresholds.

Keep the previous production digest in the deployment record (GitHub deployment, release notes) so "redeploy the last good image" is one command, not a search.

## Example
`.github/workflows/deploy-api.yml` (reusable; single revision mode, wait for health, smoke test)
```yaml
on:
  workflow_call:
    inputs:
      environment: { type: string, required: true }
      image: { type: string, required: true }

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    permissions: { contents: read, id-token: write }
    env:
      RG: ${{ vars.RESOURCE_GROUP }}
      APP: ${{ vars.API_APP_NAME }}
      IMAGE: ${{ inputs.image }}
    steps:
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      # lesson 04 adds a step here that runs the migrations job before the new revision
      - name: Deploy new revision
        run: |
          az containerapp update -g "$RG" -n "$APP" --image "$IMAGE" --revision-suffix "r${GITHUB_RUN_NUMBER}"
      - name: Wait until healthy
        run: |
          REV="$APP--r${GITHUB_RUN_NUMBER}"
          for i in $(seq 1 30); do
            STATE=$(az containerapp revision show -g "$RG" -n "$APP" --revision "$REV" --query "properties.healthState" -o tsv)
            echo "health: $STATE"; [ "$STATE" = "Healthy" ] && exit 0
            sleep 10
          done
          echo "Revision did not become healthy"; exit 1
      - name: Smoke test
        run: |
          FQDN=$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)
          curl --fail --retry 3 "https://$FQDN/health/ready"
          curl --fail "https://$FQDN/products?pageSize=1"
```
The image reference comes from `inputs` through `env:` (not interpolated straight into the script), so a crafted value can't inject shell commands.

`scripts/rollback-api.sh` (multiple revision mode)
```bash
#!/usr/bin/env bash
set -euo pipefail
RG=$1; APP=$2
PREVIOUS=$(az containerapp revision list -g "$RG" -n "$APP" \
  --query "sort_by([?properties.active], &properties.createdTime)[-2].name" -o tsv)
az containerapp ingress traffic set -g "$RG" -n "$APP" --revision-weight "$PREVIOUS=100"
echo "Traffic moved to $PREVIOUS"
```

## Production patterns
- Deploys create a new revision from a digest, wait for `Healthy`, run smoke tests, and only then report success.
- Production uses multiple revision mode with the previous revision kept active (at 0%) for instant rollback during the watch window.
- Every release has an automated watch (SLO burn rate, new error groups) and a one-command rollback; rollbacks are rehearsed.
- Schema changes are backward compatible, so code rollbacks are always possible.

## Mistakes
Wrong: "deploy succeeded" when `az containerapp update` returns.
Right: wait for the revision's `healthState` and run smoke tests.

Wrong: rollback = rebuild the old commit.
Right: move traffic back to the previous revision, or redeploy the previous digest.

## Check yourself
1. What gates traffic moving to a new revision?
2. Why keep the previous revision active in multiple revision mode?
3. When can't you roll back the code?

<details><summary>Answers</summary>

1. Its replicas must start and pass startup and readiness probes; in single revision mode traffic switches only after that, and in multiple revision mode only when you assign it.
2. Rolling back is then just a traffic change, which takes seconds and needs no new replicas, builds, or image pulls.
3. When the new release made a non-backward-compatible change the old code can't work with, typically a destructive or renaming database migration. Expand/contract migrations avoid that.
</details>

## Sources
- [Revisions in Container Apps](https://learn.microsoft.com/azure/container-apps/revisions)
- [Manage revisions](https://learn.microsoft.com/azure/container-apps/revisions-manage)
- [Traffic splitting](https://learn.microsoft.com/azure/container-apps/traffic-splitting)
- [Health probes](https://learn.microsoft.com/azure/container-apps/health-probes)
- [az containerapp reference](https://learn.microsoft.com/cli/azure/containerapp)
