---
title: Migrations, environments, and rollbacks
tech: GitHub Actions, AWS ECS, Drizzle ORM, PostgreSQL 18
version: GitHub environments, Amazon ECS run-task, drizzle-orm migrator, PostgreSQL 18
date: 2026-11-07
covers: [7, 8, 10]
---
# Migrations, environments, and rollbacks
[← Overview](00-overview.md)

## Why it matters
- The new version renames a column and the migration runs before the rollout. Old tasks, still serving traffic, fail every query for four minutes.
- Migrations run at application startup. Six tasks start together, all try to migrate, and two deadlock.
- A bad release goes out at 5 p.m. Rolling back would mean undoing a migration that dropped a column, so the team spends the evening writing a fix forward under pressure.

## Concepts

### Migrations in the pipeline
| Rule | Why |
|:--|:--|
| Migrate as a separate step before deploying | one runner, visible result, deploy stops if it fails |
| One-off ECS task with the release image | same code and network access as the app |
| Advisory lock + `lock_timeout` | never two migrators; never hang behind locks |
| A dedicated migration role | the app's database role can't change the schema |
| **Expand only** in the same release | new code and old code both work with the schema |
| Contract later | drop old columns in a later release, once nothing uses them |
| Not at app startup | races between tasks, slow boots, unclear failures |

Expand/contract for a column rename (`name` → `display_name`):
| Release | Schema | Code |
|:--|:--|:--|
| 1 | add `display_name` (nullable) | write both, read `name` |
| 2 | backfill in batches | read `display_name`, write both |
| 3 | — | stop writing `name` |
| 4 | drop `name` | — |

Details and the dangerous-operations list are in [05-data-safety lesson 03](../../05-data-safety/docs/03-safe-migrations.md).

### Environments and approvals
| GitHub environment feature | Use |
|:--|:--|
| Required reviewers | production deploys need an approval |
| Deployment branches/tags | only `main` (or release tags) may deploy to production |
| Wait timer | optional delay before production |
| Environment variables and secrets | role ARNs, cluster names, URLs per environment |
| Deployment history | who deployed what, when |

| Environment | Deploys | Data |
|:--|:--|:--|
| Preview (optional) | per pull request | seeded, disposable |
| Staging | every merge to `main`, automatically | anonymized or synthetic, production-like size |
| Production | after staging checks and approval | real |

### Rollbacks
| Situation | Action |
|:--|:--|
| New tasks fail to start or health checks fail | circuit breaker rolls back automatically |
| Errors or latency after rollout | redeploy the previous image digest (task definition revision) |
| Migration was expand-only | the previous image works with the new schema: roll back freely |
| A migration destroyed data | restore (PITR) or roll forward; prevent this with expand/contract |
| Bug in a feature behind a flag | turn the flag off; no deploy needed |
| Bad config or secret | fix the value, force a new deployment |

Rollback should be a **routine, practiced, one-command action**, not an improvisation.

## Example
`src/scripts/migrate.ts` — the migrator inside the release image (Dockerfile also copies `drizzle/`).
```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.MIGRATOR_DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query("SET lock_timeout = '5s'");                 // fail fast instead of blocking traffic
  await client.query('SELECT pg_advisory_lock(727274)');         // only one migrator at a time
  await migrate(drizzle({ client }), { migrationsFolder: './drizzle' });
  console.log('migrations applied');
} finally {
  await client.query('SELECT pg_advisory_unlock(727274)').catch(() => {});
  client.release();
  await pool.end();
}
```
`deploy/migrate.sh` — run it as a one-off task and fail the pipeline on a non-zero exit.
```bash
#!/usr/bin/env bash
set -euo pipefail
# inputs: CLUSTER, TASKDEF (shop-migrate revision with the new image), SUBNETS, SECURITY_GROUP
TASK_ARN=$(aws ecs run-task --cluster "$CLUSTER" --task-definition "$TASKDEF" --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUP],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' --output text)
echo "migration task: $TASK_ARN"
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN"
EXIT_CODE=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' --output text)
if [ "$EXIT_CODE" != "0" ]; then
  echo "migration failed (exit code $EXIT_CODE); see /ecs/shop-migrate logs"
  exit 1
fi
```
The production part of `.github/workflows/deploy.yml`:
```yaml
  migrate-prod:
    needs: [build, smoke-staging]
    runs-on: ubuntu-latest
    environment: prod                     # required reviewers approve here
    steps:
      - uses: actions/checkout@<40-char-commit-sha>
      - uses: aws-actions/configure-aws-credentials@<40-char-commit-sha>
        with:
          role-to-assume: ${{ vars.DEPLOY_ROLE_ARN }}
          aws-region: eu-central-1
      - id: render
        uses: aws-actions/amazon-ecs-render-task-definition@<40-char-commit-sha>
        with:
          task-definition: deploy/taskdef.migrate.prod.json
          container-name: migrate
          image: ${{ needs.build.outputs.image }}
      - id: register
        run: |
          ARN=$(aws ecs register-task-definition --cli-input-json file://${{ steps.render.outputs.task-definition }} \
            --query 'taskDefinition.taskDefinitionArn' --output text)
          echo "arn=$ARN" >> "$GITHUB_OUTPUT"
      - run: ./deploy/migrate.sh
        env:
          CLUSTER: shop-prod
          TASKDEF: ${{ steps.register.outputs.arn }}
          SUBNETS: ${{ vars.PRIVATE_SUBNETS }}
          SECURITY_GROUP: ${{ vars.MIGRATE_SG }}

  deploy-prod:
    needs: [build, migrate-prod]
    runs-on: ubuntu-latest
    environment: prod
    steps:
      # same steps as deploy-staging, with taskdef.prod.json and cluster shop-prod
```
Rolling back by hand (the workflow's `workflow_dispatch` with a SHA does the same through the pipeline):
```bash
aws ecs list-task-definitions --family-prefix shop-api --sort DESC --max-items 5
aws ecs update-service --cluster shop-prod --service api --task-definition shop-api:41
aws ecs wait services-stable --cluster shop-prod --services api
```

## Production patterns
- **Migrations as a separate, locked, one-off task** with the release image and a migration-only role.
- **Expand in this release, contract in a later one**, so the previous version always works with the current schema.
- **Staging on every merge, production after checks and an approval**, both with the same image.
- **Rollback is one command** (previous revision or previous SHA) and gets practiced.
- **Flags for risky features**, so many "rollbacks" are just a flag change.

## Mistakes
Wrong: migrating at application startup.
```ts
await migrate(db, { migrationsFolder: './drizzle' }); // in server.ts: six tasks race, boots get slow
```
Right: one migration task before the deploy.

Wrong: destructive changes in the same release as the code that stops using the column. Old tasks still read it during the rollout, and rollback is impossible. Right: expand/contract across releases.

Wrong: production deploys without an approval gate or branch restriction. Any branch could deploy. Right: GitHub environment with reviewers and `main` only.

Wrong: discovering how to roll back during an incident. Right: a documented, tested rollback command or workflow.

## Check yourself
1. Why run migrations as a separate step instead of at startup?
2. What makes a migration "expand-only", and why does it matter for rollbacks?
3. Which rollback options exist, from fastest to slowest?

<details>
<summary>Answers</summary>

1. One runner avoids races between tasks; the step's result is visible in the pipeline; a failure stops the deploy before new code runs; and app startup stays fast and predictable.
2. It only adds things (nullable columns, new tables, indexes built concurrently) and never removes or changes what the current code relies on. The previous version keeps working with the new schema, so rolling back is just redeploying the old image.
3. Turning off a feature flag (seconds), the automatic circuit breaker rollback (during the deploy), redeploying the previous task definition or image (minutes), rolling forward with a fix (tens of minutes), and restoring data from backups (slowest, last resort).
</details>

## Sources
- [Drizzle — Migrations](https://orm.drizzle.team/docs/migrations)
- [PostgreSQL — Advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [GitHub — Managing environments for deployment](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment)
- [AWS CLI — ecs run-task](https://docs.aws.amazon.com/cli/latest/reference/ecs/run-task.html)
- [Martin Fowler — Parallel change (expand/contract)](https://martinfowler.com/bliki/ParallelChange.html)
