---
title: Transactions, pg, and connections
tech: PostgreSQL 18, pg
version: PostgreSQL 18, pg 8, AWS RDS Proxy
date: 2026-11-07
covers: [4, 5, 10]
---
# Transactions, pg, and connections
[← Overview](00-overview.md)

## Why it matters
- Two customers buy the last ticket at the same moment; both succeed because the code checks stock and then decrements it in separate statements.
- A transaction calls a payment API in the middle; the API is slow, locks pile up, and the whole checkout stalls.
- Autoscaling adds 30 instances with a pool of 20 each; Postgres hits `max_connections`, and every instance starts failing.

## Concepts

### Transactions and isolation
A transaction makes several statements **atomic** (all or nothing) and **isolated** from concurrent ones, to a degree:

| Level | Sees | Possible anomalies | Notes |
|:--|:--|:--|:--|
| Read committed (default) | data committed before **each statement** | non-repeatable reads, lost updates with read-modify-write | fine with atomic updates and row locks |
| Repeatable read | a snapshot from the **first statement** | write skew | conflicting updates fail with `40001`: retry |
| Serializable | as if transactions ran one at a time | none | more `40001` failures under contention: always retry |

### Locking tools
| Tool | Use |
|:--|:--|
| Atomic update | `UPDATE … SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock` |
| `SELECT … FOR UPDATE` | lock rows you'll change in this transaction |
| `FOR UPDATE SKIP LOCKED` | work queues: each worker grabs different rows |
| `FOR UPDATE NOWAIT` | fail immediately instead of waiting |
| `pg_advisory_xact_lock(key)` | app-defined lock ("only one billing run per account") |
| `lock_timeout` | don't wait forever for a lock |

Rules: keep transactions **short**; **no network calls** (HTTP, email) inside them; lock rows in a **consistent order** to avoid deadlocks (Postgres detects deadlocks and aborts one transaction: retry it).

### Using `pg` safely
| Practice | How |
|:--|:--|
| One `Pool` per process | create at startup, share it |
| Parameterized queries | `pool.query('… WHERE id = $1', [id])` |
| Transactions on one client | `pool.connect()` → `BEGIN` … `COMMIT`/`ROLLBACK` → `release()` in `finally` |
| Pool error handler | `pool.on('error', …)` (idle clients can error) |
| Timeouts | `connectionTimeoutMillis`, `statement_timeout`, `idle_in_transaction_session_timeout` |
| TLS to managed databases | `ssl: { rejectUnauthorized: true, ca }` with the provider's CA bundle |
| Type parsing | `bigint` (int8) arrives as **string**; `numeric` as string; `date` becomes a JS Date at local midnight (often wrong): parse deliberately |
| `application_name` | identifies your service in `pg_stat_activity` |

### Connections in production
| Concern | Practice |
|:--|:--|
| Pool size | small per instance (5–20); more connections ≠ more throughput |
| Total connections | instances × pool max + admin/migrations headroom < `max_connections` |
| Many instances / serverless | a connection pooler: AWS RDS Proxy or PgBouncer (transaction mode) |
| Transaction pooling caveats | no session state across transactions (`SET`, session advisory locks, `LISTEN`); prepared statements need pooler support |
| Waiting for a connection | `connectionTimeoutMillis` (default 0 = forever!) |
| Failover | managed DBs change the primary; reconnect and retry idempotent work |
| Read replicas | for read-heavy endpoints that tolerate replication lag ([09-scalability](../../09-scalability/README.md)) |

## Example
`src/db.ts`
```ts
import pg from 'pg';
import { config } from '#src/config.ts';
import { logger } from '#src/logger.ts';

pg.types.setTypeParser(20, (v) => v);          // int8 → keep as string (IDs, counts beyond 2^53)
pg.types.setTypeParser(1082, (v) => v);        // date → keep 'YYYY-MM-DD' (no time-zone shift)

export const pool = new pg.Pool({
  connectionString: config.db.url,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,              // fail fast when the pool is exhausted
  application_name: 'orders-api',
  options: '-c statement_timeout=5000 -c idle_in_transaction_session_timeout=30000',
});

pool.on('error', (err) => logger.error({ err }, 'idle pg client error'));

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```
`src/orders/checkout.ts` — stock, order, and outbox in one short transaction.
```ts
import { withTransaction } from '#src/db.ts';
import { ConflictError } from '#src/http/errors.ts';

export async function placeOrder(accountId: string, customerId: string, sku: string, qty: number) {
  return withTransaction(async (tx) => {
    const stock = await tx.query(
      'UPDATE inventory SET quantity = quantity - $1 WHERE sku = $2 AND quantity >= $1 RETURNING quantity',
      [qty, sku],
    );                                                  // atomic: no read-then-write race
    if (stock.rowCount === 0) throw new ConflictError(`Not enough stock for ${sku}`);

    const { rows: [order] } = await tx.query(
      `INSERT INTO orders (account_id, customer_id, status, currency, total_cents, ship_to)
       SELECT $1, $2, 'pending', p.currency, p.price_cents * $4, '{}'::jsonb FROM products p WHERE p.sku = $3
       RETURNING id, total_cents`,
      [accountId, customerId, sku, qty],
    );
    await tx.query(
      `INSERT INTO outbox (topic, payload) VALUES ('order.created', $1)`, // email sent later by a worker
      [JSON.stringify({ orderId: order.id })],
    );
    return order;                                        // no HTTP calls inside the transaction
  });
}
```
A queue table processed by several workers with `SKIP LOCKED`:
```sql
WITH next AS (
  SELECT id FROM outbox WHERE processed_at IS NULL
  ORDER BY id LIMIT 10
  FOR UPDATE SKIP LOCKED                -- other workers skip rows already taken
)
UPDATE outbox SET processed_at = now() FROM next WHERE outbox.id = next.id
RETURNING outbox.*;
```
Retrying serialization failures:
```ts
export async function withSerializableRetry<T>(fn: (c: pg.PoolClient) => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await withTransaction(async (c) => { await c.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'); return fn(c); });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if ((code === '40001' || code === '40P01') && i < attempts) continue; // serialization failure / deadlock
      throw err;
    }
  }
}
```

## Production patterns
- **Atomic SQL or row locks for check-then-act logic**; never read-modify-write across statements without locks.
- **Short transactions with no external calls**; side effects go through an outbox processed after commit ([07-background-jobs](../../07-background-jobs/README.md)).
- **Small pools, explicit timeouts, and a pooler** (RDS Proxy) when instance counts grow.
- **Parse `int8`, `numeric`, and `date` deliberately**; don't let defaults silently change values.
- **Retry `40001`/`40P01`** for serializable transactions and deadlocks, with the whole transaction re-run.

## Mistakes
Wrong: check then act.
```ts
const { rows: [s] } = await pool.query('SELECT quantity FROM inventory WHERE sku = $1', [sku]);
if (s.quantity >= qty) await pool.query('UPDATE inventory SET quantity = $1 WHERE sku = $2', [s.quantity - qty, sku]);
```
Right: one atomic `UPDATE … WHERE quantity >= $1 RETURNING …`.

Wrong: transactions through `pool.query`.
```ts
await pool.query('BEGIN'); await pool.query('UPDATE …'); await pool.query('COMMIT'); // possibly 3 different connections
```
Right: one client from `pool.connect()` for the whole transaction.

Wrong: forgetting `client.release()` on errors; the pool drains and the app hangs. Right: release in `finally`.

Wrong: `max: 100` per instance "for performance". Right: small pools; scale with poolers and fewer, faster queries.

## Check yourself
1. Why is `UPDATE … WHERE quantity >= $1` safe under concurrency when SELECT-then-UPDATE isn't?
2. Why shouldn't you call an external API inside a transaction?
3. What breaks when you put PgBouncer in transaction mode in front of an app?

<details>
<summary>Answers</summary>

1. The check and the change happen in one statement that locks the row; a concurrent update waits and then re-evaluates the condition, so stock can't go negative.
2. The transaction holds locks and a connection while waiting on the network; a slow API blocks other transactions and drains the pool, and the external side effect can't be rolled back if the transaction fails.
3. Anything relying on session state across transactions: `SET` session settings, session-level advisory locks, `LISTEN/NOTIFY`, temporary tables, and prepared statements unless the pooler supports them.
</details>

## Sources
- [PostgreSQL — Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL — Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [node-postgres — Transactions](https://node-postgres.com/features/transactions)
- [node-postgres — Pooling](https://node-postgres.com/features/pooling)
- [AWS — Amazon RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)
