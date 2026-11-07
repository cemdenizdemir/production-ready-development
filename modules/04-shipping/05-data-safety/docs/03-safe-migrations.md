---
title: Safe production migrations
tech: PostgreSQL 18, Drizzle Kit, Drizzle ORM
version: PostgreSQL 18, Drizzle Kit (generate, custom migrations), drizzle-orm migrator
date: 2026-11-07
covers: [4]
---
# Safe production migrations
[← Overview](00-overview.md)

## Why it matters
- `ALTER TABLE orders ADD CONSTRAINT … FOREIGN KEY` waits behind a long analytics query. Every query on `orders` queues behind the migration's lock, and checkout is down for six minutes.
- `CREATE INDEX` on a 200-million-row table blocks writes for 40 minutes.
- A single `UPDATE users SET …` backfills 30 million rows in one transaction. Replication lag hits 20 minutes, the table bloats, and the migration can't be stopped without rolling everything back.

## Concepts

### Why migrations hurt
Most DDL needs an `ACCESS EXCLUSIVE` lock, even if only for a moment. If it has to **wait** for a long-running query, every new query on that table waits behind it in the lock queue. A "fast" migration can therefore cause an outage. `lock_timeout` turns that into a quick, retryable failure.

| Setting | Use |
|:--|:--|
| `SET lock_timeout = '5s'` | give up instead of blocking traffic; retry later |
| `SET statement_timeout = '…'` | cap long statements in the migration session |
| Short transactions | locks are released at commit |
| Off-peak timing | for anything that rewrites or scans big tables |

### Operations and their safe versions
| Operation | Risk | Safe way |
|:--|:--|:--|
| `ADD COLUMN` nullable or with a constant default | metadata only, fast | fine (with `lock_timeout`) |
| `ADD COLUMN` with a volatile default (`clock_timestamp()`) | rewrites the table | add nullable, backfill, then set the default |
| `ADD COLUMN … NOT NULL` without default | fails on existing rows | nullable → backfill → constraint |
| `SET NOT NULL` | full scan under an exclusive lock | `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE CONSTRAINT` → `SET NOT NULL` → drop the check |
| `CREATE INDEX` | blocks writes for the whole build | `CREATE INDEX CONCURRENTLY` (outside a transaction) |
| `DROP INDEX` | exclusive lock | `DROP INDEX CONCURRENTLY` |
| Add a foreign key | locks and validates both tables | `ADD CONSTRAINT … NOT VALID`, then `VALIDATE CONSTRAINT` |
| `ALTER COLUMN TYPE` | most changes rewrite the table | new column + backfill + switch (expand/contract) |
| Rename column or table | breaks running code | expand/contract across releases |
| `DROP COLUMN` | old code still reads it during rollout | stop using it, drop in a later release |
| Large `UPDATE` / `DELETE` | long locks, bloat, replication lag | batches of 1,000–10,000 with pauses |
| `VACUUM FULL` | rewrites under an exclusive lock | avoid; also seen: pg_repack |

### The workflow with Drizzle Kit
| Step | Detail |
|:--|:--|
| Generate | `drizzle-kit generate --name add_display_name` writes SQL into `drizzle/` |
| Review | read the SQL in the PR like code; check against the table above |
| Custom SQL | `drizzle-kit generate --custom --name …` for hand-written steps |
| `CONCURRENTLY` | the Drizzle migrator wraps migrations in a transaction, so run concurrent index builds in a separate, idempotent step |
| Apply | the pipeline's migration task ([04-deployments lesson 03](../../04-deployments/docs/03-migrations-environments-rollbacks.md)) |
| Never in production | `drizzle-kit push` (no reviewable SQL, no history) |
| Lint | also seen: squawk to flag dangerous statements in CI |

### Migration review checklist
| Question | If yes |
|:--|:--|
| Does it take a strong lock on a busy table? | `lock_timeout`, off-peak, or a safer variant |
| Does it rewrite or scan a large table? | expand/contract or batches |
| Will the currently running version still work? | if not, split across releases |
| Is it reversible, or is a snapshot taken first? | manual snapshot before destructive steps |
| Does it touch data (backfill)? | separate, batched, resumable job |

## Example
Adding a NOT NULL column to a big table, safely, across releases:
```sql
-- release 1 (migration): add the column, no rewrite
SET lock_timeout = '5s';
ALTER TABLE users ADD COLUMN display_name text;

-- release 1 (separate step outside the migrator's transaction): concurrent index
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_display_name_idx ON users (display_name);

-- release 2 (after the backfill job finished): enforce NOT NULL without a long lock
SET lock_timeout = '5s';
ALTER TABLE users ADD CONSTRAINT users_display_name_not_null CHECK (display_name IS NOT NULL) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_display_name_not_null;   -- scans without blocking writes
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;             -- uses the validated check, no scan
ALTER TABLE users DROP CONSTRAINT users_display_name_not_null;
```
`src/scripts/backfill-display-name.ts` — a batched, resumable backfill run as a one-off task.
```ts
import { setTimeout as sleep } from 'node:timers/promises';
import { sql } from 'drizzle-orm';
import { db } from '#src/db.ts';
import { logger } from '#src/logger.ts';

let total = 0;
for (;;) {
  const result = await db.execute(sql`
    UPDATE users SET display_name = name
    WHERE id IN (
      SELECT id FROM users
      WHERE display_name IS NULL AND name IS NOT NULL
      LIMIT 2000
      FOR UPDATE SKIP LOCKED
    )`);
  const updated = result.rowCount ?? 0;
  total += updated;
  if (updated === 0) break;                          // done; rerunning later is harmless
  logger.info({ total }, 'backfill progress');
  await sleep(200);                                  // room for replication, autovacuum, and traffic
}
logger.info({ total }, 'backfill finished');
```
If a concurrent index build fails, it leaves an invalid index behind:
```sql
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;   -- find invalid indexes
DROP INDEX CONCURRENTLY IF EXISTS users_display_name_idx;         -- then build it again
```

## Production patterns
- **`lock_timeout` on every migration session**, with retries in the pipeline instead of blocking traffic.
- **Concurrent index builds and `NOT VALID` constraints** for big tables, run as separate idempotent steps.
- **Expand/contract** for renames, type changes, and drops; the running version always works.
- **Backfills as batched, resumable jobs**, separate from schema migrations.
- **Every migration reviewed as SQL**, with a snapshot before destructive steps.

## Mistakes
Wrong: a plain `CREATE INDEX` on a large production table. Writes block for the whole build. Right: `CREATE INDEX CONCURRENTLY` outside a transaction.

Wrong: no `lock_timeout`. A migration queues behind a slow query and blocks everything after it. Right: `SET lock_timeout = '5s'` and retry.

Wrong: one huge `UPDATE` for a backfill. Long locks, bloat, replication lag, and no way to pause. Right: batches with pauses, resumable.

Wrong: `drizzle-kit push` against production. Unreviewed changes, no migration history. Right: `generate`, review, and apply through the pipeline.

## Check yourself
1. How can a migration that takes milliseconds cause an outage?
2. How do you add `NOT NULL` to a column on a huge table without a long lock?
3. Why can't `CREATE INDEX CONCURRENTLY` run in a normal Drizzle migration?

<details>
<summary>Answers</summary>

1. It needs an exclusive lock. While it waits for a long-running query that holds a conflicting lock, all new queries on the table queue behind it, so the table is effectively unavailable until the slow query finishes. `lock_timeout` makes it give up quickly instead.
2. Backfill the column first, add `CHECK (col IS NOT NULL) NOT VALID` (instant), `VALIDATE CONSTRAINT` (scans without blocking writes), then `SET NOT NULL`, which uses the validated check instead of scanning under an exclusive lock, and finally drop the check.
3. `CONCURRENTLY` can't run inside a transaction block, and Drizzle's migrator wraps migrations in a transaction. Run concurrent index builds in a separate, idempotent step (`IF NOT EXISTS`) outside the migrator.
</details>

## Sources
- [PostgreSQL — ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL — Building indexes concurrently](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- [PostgreSQL — Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Drizzle Kit — generate](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [squawk — PostgreSQL migration linter](https://squawkhq.com/)
