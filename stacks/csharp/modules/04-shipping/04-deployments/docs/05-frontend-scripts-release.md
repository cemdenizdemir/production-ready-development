---
title: Frontend deploys, scripts, and release hygiene
tech: Next.js 16 on Azure Container Apps, Azure Front Door, Azure CLI, PowerShell, GitHub Releases, Application Insights
version: Next.js 16, Azure CLI 2.7x, PowerShell 7.5, Az PowerShell 14.x
date: 2026-11-09
covers: [11, 12, 13]
---
# Frontend deploys, scripts, and release hygiene
[← Overview](00-overview.md)

## Why it matters
- After each frontend deploy, users with the old page open saw broken styles and "ChunkLoadError": their browser asked the new revision for old JavaScript files that no longer existed.
- A "quick" production fix was a sequence of 12 `az` commands pasted from a chat. Step 7 failed silently and left the app half-configured.
- An incident review asked "what changed at 14:05?". There was no deploy marker, no changelog, and three candidate commits.

## Concepts

### Deploying the Next.js frontend
| Concern | Practice |
|:--|:--|
| ⭐ own Container App | `ca-shop-web`, independent of the API; same pipeline pattern (build once, digest, revision) |
| ⭐ static assets on the CDN | upload `.next/static` to Blob Storage on every build and set `assetPrefix`, so old and new assets stay available; or rely on Front Door caching with long TTLs |
| ⭐ version skew | `deploymentId` (git SHA) makes clients from an old version reload on navigation instead of calling a mismatched server |
| Server Actions key | the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` for all replicas of an environment (01-containers lesson 05) |
| API compatibility | deploy the API first with backward-compatible changes, then the frontend; the API supports the previous frontend for at least one release |
| caching rules | `/_next/static/*` immutable for a year; HTML and data short or `no-store`; purge Front Door on release only if needed |
| environment config | `NEXT_PUBLIC_*` values are build-time: build per environment only for those, or read config at runtime from the server |

### Deployment scripts
| Practice | Why |
|:--|:--|
| ⭐ scripts in the repo (`scripts/`), reviewed | repeatable, auditable; no copy-paste from chat |
| ⭐ fail fast | Bash `set -euo pipefail`; PowerShell `$ErrorActionPreference = 'Stop'` and `Set-StrictMode -Version Latest` |
| idempotent | running twice is safe (check before create) |
| parameters, not hard-coded names | `--resource-group`, `--environment` |
| dry-run / what-if mode | show what would change |
| logged and run from CI | GitHub Actions `workflow_dispatch` jobs for one-off operations, with approvals |
| Azure CLI vs Az PowerShell | either; CLI in Bash pipelines, PowerShell when the team prefers objects and Windows tooling |
| Bicep `deploymentScripts` | scripts that must run inside a deployment (rare) |

### Release hygiene
| Practice | Tool |
|:--|:--|
| ⭐ versions | SemVer for releases; git SHA for every build (`service.version`) |
| ⭐ changelog | Conventional Commits + release-please (or GitHub generated release notes) |
| version from git | MinVer or GitVersion for .NET assemblies |
| ⭐ deploy markers | Application Insights release annotations; GitHub deployments; a message in the team channel |
| release notes for users | from the changelog, in plain language |
| ⭐ DORA metrics | deployment frequency, lead time for changes, change failure rate, failed deployment recovery time (+ rework rate) |

| DORA metric | Measure from |
|:--|:--|
| deployment frequency | production deploys per day/week (GitHub deployments) |
| lead time for changes | commit time → running in production |
| change failure rate | deploys that caused an incident, rollback, or hotfix ÷ deploys |
| failed deployment recovery time | time from a bad deploy to recovery |

## Example
`frontend/next.config.ts` (assets from the CDN)
```typescript
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  deploymentId: process.env.DEPLOYMENT_ID,
  assetPrefix: process.env.ASSET_PREFIX,          // https://cdn.shop.example in production
};
export default config;
```
Pipeline step after the frontend build (upload static assets; old versions remain):
```bash
az storage blob upload-batch --auth-mode login --account-name stshopprodassets \
  --destination '$web' --destination-path _next/static --source frontend/.next/static \
  --content-cache-control "public, max-age=31536000, immutable" --overwrite false
```
`scripts/Set-MaintenanceMode.ps1` (an idempotent one-off script, run from a `workflow_dispatch` job)
```powershell
param(
  [Parameter(Mandatory)] [string] $ResourceGroup,
  [Parameter(Mandatory)] [ValidateSet('on','off')] [string] $Mode,
  [switch] $WhatIf
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$current = az appconfig kv show --name appcs-shop-prod --key 'Shop:MaintenanceMode' --query value -o tsv 2>$null
$target = if ($Mode -eq 'on') { 'true' } else { 'false' }
if ($current -eq $target) { Write-Host "Already $Mode"; return }
if ($WhatIf) { Write-Host "Would set maintenance mode $current -> $target"; return }

az appconfig kv set --name appcs-shop-prod --key 'Shop:MaintenanceMode' --value $target --yes --auth-mode login | Out-Null
Write-Host "Maintenance mode $Mode"
```
Deploy marker in Application Insights (pipeline step):
```bash
AI_ID=$(az monitor app-insights component show -g "$RG" -a appi-shop-prod --query id -o tsv)
az rest --method put \
  --uri "https://management.azure.com${AI_ID}/Annotations?api-version=2015-05-01" \
  --body "{\"Id\":\"$(uuidgen)\",\"AnnotationName\":\"shop-api ${GITHUB_SHA::7}\",\"EventTime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"Category\":\"Deployment\",\"Properties\":\"{\\\"ReleaseName\\\":\\\"${GITHUB_SHA::7}\\\"}\"}"
```
The annotation appears on Application Insights charts, so "what changed at 14:05?" is answered by looking at the graph.

## Production patterns
- Frontend and API deploy independently with backward-compatible contracts; static assets are versioned on the CDN, and `deploymentId` handles version skew.
- Operational changes run as reviewed scripts from CI, idempotent and with a dry-run mode; nothing is pasted into production shells.
- Every deploy leaves a trace: GitHub deployment, Application Insights annotation, changelog entry, and the version in telemetry.
- DORA metrics reviewed monthly to see whether delivery is getting faster and safer.

## Mistakes
Wrong: deleting old static assets on each deploy (only the newest build's files exist).
Right: keep immutable, content-hashed assets for previous versions available (CDN/blob), and clean them up after weeks.

Wrong: "I'll just run this in the portal / cloud shell".
Right: a script in the repo, run from a pipeline with approval, logged.

## Check yourself
1. Why upload `.next/static` to a CDN or blob storage instead of only serving it from the container?
2. What makes a deployment script safe to run twice?
3. Which DORA metric tells you whether deploys are causing incidents?

<details><summary>Answers</summary>

1. During and after a rollout, browsers with the previous version still request their own content-hashed files. If only the new container serves assets, those requests 404; a CDN or blob store keeps every version's files available.
2. Idempotency: it checks the current state and only changes what differs (and offers a dry run), so a second run is a no-op.
3. Change failure rate: the share of deployments that lead to an incident, rollback, or hotfix.
</details>

## Sources
- [Next.js — assetPrefix](https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix)
- [Next.js — self-hosting and version skew](https://nextjs.org/docs/app/guides/self-hosting)
- [Release annotations in Application Insights](https://learn.microsoft.com/azure/azure-monitor/app/release-and-work-item-insights)
- [release-please](https://github.com/googleapis/release-please)
- [DORA — four keys](https://dora.dev/guides/dora-metrics-four-keys/)
- [PowerShell — about Preference Variables](https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_preference_variables)
