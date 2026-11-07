---
title: Boundary validation with Zod
tech: Zod 4, Express 5, TypeScript 6
version: Zod 4.4, Express 5.2
date: 2026-11-07
covers: [1, 2, 3, 8]
---
# Boundary validation with Zod
[← Overview](00-overview.md)

## Why it matters
- `PATCH /me` spreads `req.body` into an update; a user sends `{"role":"admin","accountId":"…"}` and becomes an admin of another company.
- Two accounts exist for `Ada@Example.com` and `ada@example.com`, and a third for `ada@example.com` with a zero-width space; support merges them by hand.
- A query param `?limit=1e9` reaches the database as a number; one request tries to load a billion rows.

## Concepts

### What to validate
| Input | Examples | Risk if not validated |
|:--|:--|:--|
| Body | JSON payloads | wrong types, extra fields (mass assignment), huge arrays |
| Path params | `:orderId` | DB errors, enumeration, injection |
| Query string | filters, sort, limit, cursor | unbounded work, injection via sort columns |
| Headers | `Idempotency-Key`, `Content-Type`, custom headers | spoofing, crashes |
| Cookies | session IDs | malformed values reach Redis |
| Files | uploads | wrong types, huge sizes, malware |
| Third-party data | webhooks, API responses | trusting unverified data |

**Allowlist** what's valid (types, formats, ranges, enums) rather than blocklisting bad patterns.

### Validation layers
| Layer | Job |
|:--|:--|
| Schema (Zod) | shape, types, formats, lengths, ranges, enums; normalization |
| Business rules (service) | "coupon still valid", "stock available", state transitions |
| Database constraints | final guarantee: NOT NULL, CHECK, UNIQUE, FK |

### Mass assignment
- Create, update, and admin-update get **different schemas**.
- Server-controlled fields (`id`, `role`, `accountId`, `status`, `price`, `createdAt`) are **never** in client schemas.
- `.strict()` makes unknown keys an error (good for writes: clients learn fast); default stripping silently drops them (good for lenient reads).
- Never spread `req.body` into queries or ORM `update` calls.

### Normalization (canonicalize, then validate)
| Data | Normalize |
|:--|:--|
| Strings | `trim()`; collapse inner whitespace where it makes sense |
| Emails | trim + lowercase (store a normalized column for uniqueness) |
| Identifiers (usernames, slugs) | Unicode NFKC, lowercase, strip zero-width characters, restrict to a safe alphabet |
| Phone numbers | E.164 format (also seen: libphonenumber) |
| URLs | parse with `new URL()`, check scheme and host, store `url.href` |
| Booleans in query strings | `z.stringbool()` |
| Numbers in query strings | `z.coerce.number().int()` with min/max |

Validate **after** normalizing, and use the normalized value everywhere (uniqueness checks, storage, comparisons).

## Example
`src/http/handle.ts` — typed, validated handlers for Express 5.
```ts
import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

type Schemas = { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType; headers?: z.ZodType };
type Parsed<S extends Schemas> = { [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never };

export function handle<S extends Schemas>(
  schemas: S,
  fn: (input: Parsed<S>, req: Request, res: Response) => Promise<unknown> | unknown,
): RequestHandler {
  return async (req, res) => {
    const input = {} as Record<string, unknown>;
    if (schemas.params) input.params = schemas.params.parse(req.params);
    if (schemas.query) input.query = schemas.query.parse(req.query);    // req.query is read-only in Express 5
    if (schemas.headers) input.headers = schemas.headers.parse(req.headers);
    if (schemas.body) input.body = schemas.body.parse(req.body);        // ZodError → 422 in the error handler
    await fn(input as Parsed<S>, req, res);
  };
}
```
`src/users/users.schemas.ts` — normalization and separate write schemas.
```ts
import { z } from 'zod';

const zeroWidth = /[​-‍﻿]/g;

export const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const Username = z.string()
  .transform((s) => s.normalize('NFKC').replace(zeroWidth, '').trim().toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9_]{3,30}$/, '3–30 characters: a–z, 0–9, underscore'));

export const UpdateMeBody = z.object({                 // what a user may change about themselves
  displayName: z.string().trim().min(1).max(80).optional(),
  username: Username.optional(),
  locale: z.enum(['en', 'de', 'tr']).optional(),
}).strict();                                            // "role", "accountId" → 422, not silently ignored

export const AdminUpdateUserBody = UpdateMeBody.extend({ // a different endpoint, different permission
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
}).strict();

export const ListUsersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  active: z.stringbool().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', '-name', 'createdAt', '-createdAt']).default('-createdAt'),
});
```
`src/users/users.routes.ts`
```ts
router.patch('/me', handle({ body: UpdateMeBody }, async ({ body }, req, res) => {
  const user = await users.updateProfile(req.user!.id, body);  // only allowlisted fields reach the service
  res.json(toUserDTO(user));
}));

router.get('/users', requirePermission('members:read'), handle({ query: ListUsersQuery }, async ({ query }, req, res) => {
  res.json(await users.list(req.user!.accountId, query));      // sort is an enum: safe to map to a column
}));

router.patch('/users/:userId', requirePermission('members:manage'),
  handle({ params: z.object({ userId: z.uuid() }), body: AdminUpdateUserBody }, async ({ params, body }, req, res) => {
    res.json(toUserDTO(await users.adminUpdate(req.user!.accountId, params.userId, body)));
  }));
```

## Production patterns
- **Every input parsed by a schema** before use; handlers receive typed, normalized data.
- **Separate schemas per operation and permission level**; server-controlled fields never accepted.
- **Normalize identifiers** (email, username) before uniqueness checks, and store the normalized form with a unique index.
- **Bounds on everything**: string `.max()`, array `.max()`, number ranges, enum sorts.
- **Shared schemas with the frontend**, but the server always re-validates.

## Mistakes
Wrong: spreading the body.
```ts
await db.update(users).set(req.body).where(eq(users.id, req.user!.id)); // role, accountId, … all writable
```
Right: `set(UpdateMeBody.parse(req.body))`.

Wrong: case-sensitive uniqueness on emails. `Ada@` and `ada@` become two accounts. Right: normalize to lowercase and enforce a unique index on the normalized value.

Wrong: user-controlled sort strings in SQL.
```ts
db.query(`SELECT … ORDER BY ${req.query.sort}`); // injection
```
Right: `z.enum([...])` mapped to known columns.

Wrong: one schema reused for create, update, and admin actions. Over-posting slips in. Right: a schema per operation.

## Check yourself
1. What's the difference between `.strict()` and default stripping, and when do you use each?
2. Why normalize before validating?
3. Which fields should never appear in a user-facing update schema?

<details>
<summary>Answers</summary>

1. `.strict()` rejects unknown keys with an error; default behavior silently removes them. Use strict for writes (clients learn they sent something unsupported, and over-posting is visible), stripping for lenient reads or third-party payloads.
2. Validation must judge the value you'll actually store and compare; otherwise `" Ada@Example.com "` and `"ada@example.com"` pass as different values and break uniqueness.
3. Server-controlled ones: IDs, `accountId`/tenant, `role`/permissions, `status` driven by workflows, prices/totals, timestamps, verification flags.
</details>

## Sources
- [OWASP — Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP — Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
- [Zod — Objects (`strict`, `strip`)](https://zod.dev/api#objects)
- [Zod — Transforms and pipes](https://zod.dev/api#transforms)
- [Unicode — Normalization forms](https://unicode.org/reports/tr15/)
