---
title: Database migrations, environments, and approvals
tech: EF Core 10 migration bundles, Azure Container Apps jobs, GitHub environments
version: EF Core 10 (dotnet-ef 10.x), GitHub Actions
date: 2026-11-09
covers: [7, 8]
---
# Database migrations, environments, and approvals
[← Overview](00-overview.md)

## Why it matters
- `Database.Migrate()` ran in `Program.cs`. During a deploy, three new replicas started at once and all tried to apply the same migration; two failed, and the revision never became healthy.
- A migration renamed a column. The new code was fine, but the old revision (still serving traffic during the rollout) crashed on every query for four minutes.
- A developer merged on Friday at 17:55 and the pipeline deployed straight to production. Nobody was watching when it broke.

## Concepts

### Migrations in the pipeline
| Rule | How |
|:--|:--|
| ⭐ never migrate on app startup in production | races between replicas, slow starts, app identity needs DDL rights |
| ⭐ EF Core migration bundle | `dotnet ef migrations bundle --self-contained -r linux-x64` → one executable, `./efbundle --connection ...` |
| ⭐ run as a Container Apps job | a manual job with the bundle image, started by the pipeline **before** the new revision; the pipeline waits for success |
| separate identity | the migration job's identity has `db_ddladmin` (or owner); the app's identity only reads/writes |
| ⭐ review the SQL | `dotnet ef migrations script --idempotent` output in the PR for every migration |
| ⭐ backward compatible | expand → migrate data → contract across releases (05-data-safety) |
| idempotent and resumable | bundles apply only pending migrations; long backfills run as separate jobs |
| timeouts | lock timeouts in migrations (05-data-safety) so a blocked migration fails fast |

**Expand/contract** for renaming `Customers.Phone` → `PhoneNumber`:
| Release | Schema | Code |
|:--|:--|:--|
| 1 (expand) | add `PhoneNumber` (nullable) | write both, read old |
| 2 (migrate) | backfill `PhoneNumber` in batches | read new, write both |
| 3 (contract) | drop `Phone` | read/write new only |
Each release can roll back to the previous one, because both versions understand the schema at every step.

### Environments and approvals
| GitHub feature | Use |
|:--|:--|
| ⭐ environments (`staging`, `production`) | scoped variables, secrets, and OIDC subjects |
| ⭐ required reviewers | production deploys wait for an approval from the on-call or release owner |
| wait timer | delay before a deploy starts (time to cancel) |
| deployment branches/tags | only `main` (or release tags) can deploy to production |
| ⭐ prevent self-review | the person who triggered the run can't approve it |
| deployment history | every deploy recorded with commit, actor, and status |
| custom protection rules | gates from external systems (change management, monitoring) |

| Production gate | Example |
|:--|:--|
| staging verified | smoke and E2E tests passed on staging with the same digest |
| healthy production | no active incident; SLO burn rate normal |
| deploy windows | not during peak sales or right before the weekend without on-call cover |
| change record | linked PRs, migration scripts, rollback plan |

## Example
`tools/Migrate.Dockerfile` (migration bundle image)
```dockerfile
# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet tool restore && \
    dotnet ef migrations bundle --project src/Shop.Infrastructure --startup-project src/Shop.Api \
      --self-contained -r linux-x64 -o /out/efbundle

FROM mcr.microsoft.com/dotnet/runtime-deps:10.0-noble-chiseled-extra   # ICU for SqlClient and cultures
COPY --from=build /out/efbundle /app/efbundle
USER $APP_UID
ENTRYPOINT ["/app/efbundle"]
```
The job passes `--connection "Server=tcp:sql-shop-prod.database.windows.net;Database=shop;Authentication=Active Directory Default;User Id=<migrator-client-id>"` as its arguments; no password exists.

`scripts/run-migrations.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail
RG=$1; JOB=$2; IMAGE=$3
az containerapp job update -g "$RG" -n "$JOB" --image "$IMAGE"
EXECUTION=$(az containerapp job start -g "$RG" -n "$JOB" --query name -o tsv)
for i in $(seq 1 60); do
  STATUS=$(az containerapp job execution show -g "$RG" -n "$JOB" --job-execution-name "$EXECUTION" --query properties.status -o tsv)
  echo "migration: $STATUS"
  case "$STATUS" in
    Succeeded) exit 0 ;;
    Failed|Stopped|Degraded) az containerapp job logs show -g "$RG" -n "$JOB" --execution "$EXECUTION" --container migrate || true; exit 1 ;;
  esac
  sleep 10
done
echo "migration timed out"; exit 1
```
`.github/workflows/deploy-api.yml` (the step lesson 02 left a placeholder for)
```yaml
      - name: Run migrations
        env:
          MIGRATE_IMAGE: ${{ inputs.migrate-image }}
        run: ./scripts/run-migrations.sh "$RG" "${{ vars.MIGRATE_JOB_NAME }}" "$MIGRATE_IMAGE"
```
The build job builds and pushes the migration image alongside the API image and passes both digests to the deploy workflow.

Reviewing the SQL in a PR:
```bash
dotnet ef migrations script --idempotent --project src/Shop.Infrastructure --startup-project src/Shop.Api -o artifacts/migrations.sql
```

## Production patterns
- Migrations run once per deploy as a Container Apps job with its own identity and DDL rights, before the new revision; a failed migration stops the deploy.
- Every migration is backward compatible with the currently running code; destructive steps wait for a later release.
- Migration SQL is reviewed in the PR; long data changes are separate, batched jobs.
- Production deploys need approval in a GitHub environment, only from `main`, with deploy windows and prevented self-review.

## Mistakes
Wrong:
```csharp
using (var scope = app.Services.CreateScope())
    scope.ServiceProvider.GetRequiredService<ShopDb>().Database.Migrate();   // every replica, every start
```
Right: a migration bundle run once by the pipeline as a job.

Wrong: a migration that renames or drops a column in the same release as the code change.
Right: expand/contract over two or three releases.

## Check yourself
1. Why not run `Database.Migrate()` at startup in production?
2. What are the three steps of expand/contract?
3. Which GitHub environment settings make production deploys safer?

<details><summary>Answers</summary>

1. Several replicas race to apply the same migration, startup gets slow or fails health checks, failures are hard to see, and the app's identity would need schema-changing rights it shouldn't have.
2. Expand (add new schema alongside old, code writes both), migrate (backfill and switch reads to the new schema), contract (remove the old schema once nothing uses it), each in its own release.
3. Required reviewers (with prevent self-review), deployment branch rules (only `main`), a wait timer, environment-scoped OIDC subjects and variables, and optional custom protection rules.
</details>

## Sources
- [Applying migrations (EF Core)](https://learn.microsoft.com/ef/core/managing-schemas/migrations/applying)
- [Migration bundles](https://learn.microsoft.com/ef/core/managing-schemas/migrations/applying#bundles)
- [Jobs in Container Apps](https://learn.microsoft.com/azure/container-apps/jobs)
- [GitHub — managing environments for deployment](https://docs.github.com/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment)
- [Martin Fowler — Parallel change (expand/contract)](https://martinfowler.com/bliki/ParallelChange.html)
