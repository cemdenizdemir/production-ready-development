---
title: Pagination, idempotency, and concurrency
tech: Express 5, Zod 4, PostgreSQL 18, pg
version: Express 5.2, PostgreSQL 18, pg 8
date: 2026-11-07
covers: [5, 6, 9]
---
# Pagination, idempotency, and concurrency
[← Overview](00-overview.md)

## Why it matters
- Page 5,000 of the orders list (`OFFSET 100000`) takes 4 seconds and grows slower every month; while users page, new orders shift the offsets and they see duplicates.
- A mobile client retries a `POST /payments` after a timeout. The first request had succeeded; the customer is charged twice.
- Two support agents edit the same customer at once; the second save silently overwrites the first agent's changes.

## Concepts

### Pagination
| | Offset (`?page=3&pageSize=20`) | Cursor / keyset (`?limit=20&cursor=…`) |
|:--|:--|:--|
| Query | `LIMIT 20 OFFSET 40` | `WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 21` |
| Deep pages | slow (scans skipped rows) | fast with an index |
| Concurrent inserts | duplicates/skips | stable |
| Jump to page N | yes | no |
| Total count | often expected, expensive | usually omitted |
| Use for | small admin tables | feeds, APIs, large lists |

Cursor details: order by a unique, indexed key combination (e.g. `created_at, id`); encode the last row's values as an **opaque** cursor (base64url JSON); fetch `limit + 1` rows to know whether there's a next page; cap `limit` (e.g. 100).

Filtering and sorting: explicit query params (`status=paid`, `createdAfter=2026-11-01T00:00:00Z`), sort with an allowlist (`sort=-createdAt`), and indexes that match the common filters.

### Idempotency keys
The client generates a unique key per logical operation and sends it as `Idempotency-Key`. The server:
1. Looks up the key (scoped to the user/account).
2. **New key:** records it as in-progress, processes the request, stores the status and response body.
3. **Same key, same request:** returns the stored response without doing the work again.
4. **Same key, different request body:** rejects it (422) — the client reused a key by mistake.
5. **Same key still in progress:** 409 (the client retries later).
Keep keys for a limited time (e.g. 24 hours). Clients reuse the same key on retries of the same operation and make a new one for a new operation.

### Concurrency control
| Technique | How | Use |
|:--|:--|:--|
| Optimistic locking | `version` column; `UPDATE … WHERE id = $1 AND version = $2`; 0 rows → conflict | edits by humans, low contention |
| ETag + `If-Match` | GET returns `ETag: "7"`; PATCH sends `If-Match: "7"`; mismatch → `412 Precondition Failed` | HTTP-native optimistic locking |
| `428 Precondition Required` | reject writes without `If-Match` | strict APIs |
| Pessimistic locking | `SELECT … FOR UPDATE` in a transaction | short, high-contention updates (stock counters) |
| Atomic updates | `UPDATE stock SET qty = qty - 1 WHERE qty > 0` | counters without read-modify-write |

## Example
Cursor pagination, `src/orders/orders.repo.ts` (excerpt):
```ts
import type { Pool } from 'pg';

type Cursor = { createdAt: string; id: string };
const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
const decode = (s: string): Cursor => JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor;

export async function listOrders(db: Pool, accountId: string, opts: { limit: number; cursor?: string; status?: string }) {
  const c = opts.cursor ? decode(opts.cursor) : null;
  const { rows } = await db.query(
    `SELECT id, status, total_cents, currency, created_at FROM orders
     WHERE account_id = $1
       AND ($2::text IS NULL OR status = $2)
       AND ($3::timestamptz IS NULL OR (created_at, id) < ($3, $4::uuid))
     ORDER BY created_at DESC, id DESC
     LIMIT $5`,
    [accountId, opts.status ?? null, c?.createdAt ?? null, c?.id ?? null, opts.limit + 1],
  );
  const page = rows.slice(0, opts.limit);
  const last = page.at(-1);
  return {
    data: page,
    nextCursor: rows.length > opts.limit && last ? encode({ createdAt: last.created_at.toISOString(), id: last.id }) : null,
  };
}
// index: CREATE INDEX orders_account_created_idx ON orders (account_id, created_at DESC, id DESC);
```
A malformed cursor should produce a 422, not a 500: wrap `decode` in validation (Zod) in the route.

Idempotency middleware with Postgres:
```sql
CREATE TABLE idempotency_keys (
  account_id   uuid        NOT NULL,
  key          text        NOT NULL,
  request_hash text        NOT NULL,
  status_code  int,
  response     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, key)
);
```
```ts
import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { ConflictError } from './errors.ts';

export const idempotent = (db: Pool): RequestHandler => async (req, res, next) => {
  const key = req.get('Idempotency-Key');
  if (!key) return next();                                       // or require it for payment routes
  const accountId = req.user!.accountId;
  const hash = createHash('sha256').update(`${req.method} ${req.originalUrl} ${JSON.stringify(req.body)}`).digest('hex');

  const inserted = await db.query(
    `INSERT INTO idempotency_keys (account_id, key, request_hash) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING RETURNING key`, [accountId, key, hash]);

  if (inserted.rowCount === 0) {                                 // key seen before
    const { rows: [row] } = await db.query(
      'SELECT request_hash, status_code, response FROM idempotency_keys WHERE account_id = $1 AND key = $2', [accountId, key]);
    if (row.request_hash !== hash) return res.status(422).json({ title: 'Idempotency-Key reused with a different request' });
    if (row.status_code === null) throw new ConflictError('A request with this Idempotency-Key is still in progress');
    return res.status(row.status_code).json(row.response);       // replay the stored result
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {                                // store the response when it's sent
    void db.query('UPDATE idempotency_keys SET status_code = $3, response = $4 WHERE account_id = $1 AND key = $2',
      [accountId, key, res.statusCode, JSON.stringify(body)]);
    return originalJson(body);
  };
  next();
};
// cleanup job: DELETE FROM idempotency_keys WHERE created_at < now() - interval '24 hours';
```
If the handler fails with a 5xx, delete the key (or store the failure) according to your retry semantics; clients retrying a failed request should be allowed to try again.

Optimistic locking with ETags:
```ts
router.patch('/customers/:id', async (req, res) => {
  const ifMatch = req.get('If-Match');
  if (!ifMatch) return res.status(428).json({ title: 'If-Match header required' });
  const version = Number(ifMatch.replaceAll('"', ''));
  const body = UpdateCustomer.parse(req.body);
  const { rows } = await db.query(
    `UPDATE customers SET name = $1, version = version + 1, updated_at = now()
     WHERE id = $2 AND account_id = $3 AND version = $4 RETURNING *`,
    [body.name, req.params.id, req.user!.accountId, version]);
  if (!rows[0]) return res.status(412).json({ title: 'This customer was changed by someone else. Reload and try again.' });
  res.set('ETag', `"${rows[0].version}"`).json(toCustomerDTO(rows[0]));
});
```

## Production patterns
- **Cursor pagination by default**, with a stable sort (timestamp + ID), a matching index, opaque cursors, and a max page size.
- **Idempotency keys on every non-idempotent write that clients may retry** (payments, orders, emails), scoped per account, kept ~24 h.
- **Optimistic locking for human edits** (ETag/`If-Match` or version fields); atomic SQL for counters.
- **Document all three** in the OpenAPI spec: cursor params, `Idempotency-Key`, `ETag`/`If-Match` behavior.

## Mistakes
Wrong: deep offsets on large tables.
```sql
SELECT * FROM events ORDER BY created_at DESC LIMIT 20 OFFSET 200000;
```
Right: keyset pagination on an indexed `(created_at, id)`.

Wrong: ordering by a non-unique column only (`ORDER BY created_at`); rows with equal timestamps get skipped or duplicated across pages. Right: add a unique tie-breaker (`id`).

Wrong: "idempotency" by checking whether a similar order exists. Races and legitimate duplicates break it. Right: an explicit client key with a unique constraint.

Wrong: read-modify-write for counters.
```ts
const { qty } = await getStock(sku); await setStock(sku, qty - 1); // two buyers, one item, both succeed
```
Right: `UPDATE stock SET qty = qty - 1 WHERE sku = $1 AND qty > 0 RETURNING qty` and check the row count.

## Check yourself
1. Why does keyset pagination stay fast on page 10,000?
2. What should the server do when the same `Idempotency-Key` arrives with a different body?
3. When is `SELECT … FOR UPDATE` better than optimistic locking?

<details>
<summary>Answers</summary>

1. It seeks directly to the position using the index on `(created_at, id)` instead of scanning and discarding all earlier rows like `OFFSET` does.
2. Reject it (422): the key identifies one operation; a different body means a client bug, and replaying the old response would be wrong.
3. For short transactions on hot rows where conflicts are frequent (inventory, balances): waiting briefly for a lock beats repeatedly failing and retrying. Optimistic locking suits rare conflicts, like humans editing records.
</details>

## Sources
- [Use The Index, Luke — Paging through results](https://use-the-index-luke.com/no-offset)
- [IETF draft — The Idempotency-Key HTTP header field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
- [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [MDN — `If-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match)
- [PostgreSQL — Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
