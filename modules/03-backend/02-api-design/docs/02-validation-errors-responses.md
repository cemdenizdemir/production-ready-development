---
title: Validation, errors, and response shapes
tech: Express 5, Zod 4, TypeScript 6
version: Express 5.2, Zod 4.4, RFC 9457
date: 2026-11-07
covers: [3, 4, 8]
---
# Validation, errors, and response shapes
[← Overview](00-overview.md)

## Why it matters
- `quantity: "5"` passes through as a string; `"5" * price` works, but `"5" + 1` becomes `"51"` in a total and an invoice is wrong.
- A database row is returned directly; a new `password_reset_token` column ships to every client the next day.
- Every error looks different, so the mobile team writes a parser per endpoint, and support can't match a user's error to a log line.

## Concepts

### Validate every input at the boundary
| Input | Schema | Note |
|:--|:--|:--|
| Body | `z.object({...})` (strips unknown keys) or `.strict()` (rejects them) | mass assignment protection |
| Path params | `z.object({ orderId: z.uuid() })` | invalid IDs → 404 or 422, never a DB error |
| Query | `z.coerce.number()`, enums, defaults, max limits | strings by nature |
| Headers | e.g. `Idempotency-Key` format | |

400 vs 422: use **400** for malformed requests (invalid JSON, wrong content type) and **422** for well-formed but invalid data (failed validation). Stay consistent; document it.

### Problem Details (RFC 9457)
One error format for every non-2xx response, with `Content-Type: application/problem+json`:

| Field | Meaning |
|:--|:--|
| `type` | URI identifying the problem type (documentation link) |
| `title` | short, human-readable summary, same for every occurrence of the type |
| `status` | the HTTP status code |
| `detail` | explanation for this occurrence |
| `instance` | URI of this occurrence (often the request path) |
| extensions | `errors` (field errors), `requestId`, `retryAfter`, ... |

### Error architecture
- **Services throw typed application errors** (`NotFoundError`, `ConflictError`, `ForbiddenError`) that know nothing about Express.
- **One error handler** maps them (and `ZodError`, JSON syntax errors) to Problem Details.
- **Unknown errors** become a generic 500, logged with full detail and the request ID; never leak stack traces or SQL.

### Response shapes
| Concern | Convention |
|:--|:--|
| Representation | DTOs mapped from domain objects; never raw DB rows |
| Field names | camelCase, consistent across endpoints |
| IDs | strings (UUIDs; Postgres `bigint` as strings: JSON numbers lose precision above 2^53) |
| Timestamps | ISO 8601 in UTC: `"2026-11-07T09:30:00Z"` |
| Dates without time | `"2026-11-12"` |
| Money | `{ "amount": 2599, "currency": "EUR" }` in minor units |
| Enums | lowercase strings: `"paid"` |
| Nulls | include nullable fields as `null` (consistent shape), omit only optional expansions |
| Lists | `{ "data": [...], "nextCursor": "…" }` (lesson 03) |
| Booleans | `isActive`, `hasPassword`; never `"true"` strings |

## Example
`src/orders/orders.schemas.ts`
```ts
import { z } from 'zod';

export const OrderIdParams = z.object({ orderId: z.uuid() });

export const CreateOrderBody = z.object({
  items: z.array(z.object({
    sku: z.string().trim().min(1).max(64),
    quantity: z.number().int().min(1).max(100),
  })).min(1).max(50),
  note: z.string().trim().max(500).optional(),
}).strict();                                      // unknown keys like "status" → 422

export const ListOrdersQuery = z.object({
  status: z.enum(['pending', 'paid', 'shipped', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
});
```
`src/http/errors.ts`
```ts
import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';

export class AppError extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  constructor(status: number, type: string, title: string, detail?: string) {
    super(detail ?? title);
    this.status = status; this.type = type; this.title = title;
  }
}
export class NotFoundError extends AppError {
  constructor(detail?: string) { super(404, 'not-found', 'Resource not found', detail); }
}
export class ConflictError extends AppError {
  constructor(detail?: string) { super(409, 'conflict', 'Conflict with current state', detail); }
}
export class ForbiddenError extends AppError {
  constructor(detail?: string) { super(403, 'forbidden', 'Not allowed', detail); }
}

const TYPE_BASE = 'https://api.example.com/problems/';

export const errorHandler = (logger: Logger): ErrorRequestHandler => (err, req, res, _next) => {
  const requestId = req.id;
  const send = (status: number, body: Record<string, unknown>) =>
    res.status(status).type('application/problem+json').json({ status, instance: req.originalUrl, requestId, ...body });

  if (err instanceof z.ZodError) {
    return send(422, {
      type: `${TYPE_BASE}validation-error`,
      title: 'Validation failed',
      errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code })),
    });
  }
  if (err instanceof SyntaxError && 'body' in err) {        // malformed JSON from express.json()
    return send(400, { type: `${TYPE_BASE}malformed-json`, title: 'Malformed JSON body' });
  }
  if (err instanceof AppError) {
    return send(err.status, { type: `${TYPE_BASE}${err.type}`, title: err.title, detail: err.message });
  }
  logger.error({ err, requestId }, 'unhandled error');      // full detail in logs only
  return send(500, { type: `${TYPE_BASE}internal`, title: 'Internal server error' });
};
```
`src/orders/orders.dto.ts`
```ts
import type { Order } from './orders.repo.ts';

export type OrderDTO = {
  id: string;
  status: 'pending' | 'paid' | 'shipped' | 'cancelled';
  total: { amount: number; currency: string };
  items: { sku: string; quantity: number }[];
  note: string | null;
  createdAt: string;
};

export function toOrderDTO(o: Order): OrderDTO {
  return {
    id: o.id,
    status: o.status,
    total: { amount: o.totalCents, currency: o.currency },
    items: o.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
    note: o.note ?? null,
    createdAt: o.createdAt.toISOString(),         // never internal fields like o.internalNotes
  };
}
```
A validation error response:
```json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Validation failed",
  "status": 422,
  "instance": "/v1/orders",
  "requestId": "req_8f2a3c",
  "errors": [{ "path": "items.0.quantity", "message": "Too big: expected number to be <=100", "code": "too_big" }]
}
```

## Production patterns
- **Parse, don't trust**: every handler parses its input with a schema before using it.
- **Strict schemas for writes** (reject unknown keys), lenient reading of optional query params with defaults and caps.
- **One Problem Details format**, documented, with a `requestId` users can quote.
- **DTOs for every response**; reviewing a DTO change is reviewing an API change.
- **Same Zod schemas shared with the frontend** ([02-frontend/10-forms](../../../02-frontend/10-forms/README.md)).

## Mistakes
Wrong: using `req.body` fields directly.
```ts
await db.query('INSERT INTO orders (status, total_cents) VALUES ($1, $2)', [req.body.status, req.body.total]);
// client sets its own status and total
```
Right: parse with a strict schema; compute totals and status on the server.

Wrong: returning DB rows.
```ts
res.json(await db.query('SELECT * FROM users WHERE id = $1', [id]).then((r) => r.rows[0]));
```
Right: a DTO with explicit fields.

Wrong: leaking internals in errors.
```ts
res.status(500).json({ error: err.message, stack: err.stack }); // SQL, file paths, versions
```
Right: generic 500 with a request ID; details in logs.

Wrong: `bigint` IDs as JSON numbers. `9007199254740993` silently becomes `9007199254740992` in JavaScript clients. Right: send them as strings.

## Check yourself
1. When do you return 400 and when 422?
2. Which Problem Details fields are standard, and what would you add?
3. Why should money be sent as integer minor units plus a currency?

<details>
<summary>Answers</summary>

1. 400 when the request is malformed (unparseable JSON, wrong content type); 422 when it's well-formed but the data fails validation. Whichever convention you choose, apply it everywhere.
2. `type`, `title`, `status`, `detail`, `instance`. Common extensions: field-level `errors`, a `requestId`, and `retryAfter` for 429/503.
3. Integers are exact (no floating-point rounding), and the currency is part of the value's meaning; formatting is the client's job.
</details>

## Sources
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
- [Zod — Basic usage and error handling](https://zod.dev/basics)
- [Express — Error handling](https://expressjs.com/en/guide/error-handling.html)
- [Zalando — JSON guidelines](https://opensource.zalando.com/restful-api-guidelines/#json-guidelines)
- [OWASP — Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
