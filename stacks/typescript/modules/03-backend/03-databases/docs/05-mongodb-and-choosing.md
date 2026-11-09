---
title: MongoDB, Mongoose, and choosing a database
tech: MongoDB 8, Mongoose 9, PostgreSQL 18
version: MongoDB 8, Mongoose 9, MongoDB Node driver 7
date: 2026-11-07
covers: [11, 12, 14]
---
# MongoDB, Mongoose, and choosing a database
[← Overview](00-overview.md)

## Why it matters
- A `comments` array embedded in a post document grows without bound; a viral post hits the 16 MB document limit and writes start failing.
- A login query passes `req.body` into `findOne`; `{"password": {"$ne": null}}` logs the attacker in.
- Every list endpoint uses full Mongoose documents with getters and change tracking; switching to `lean()` cuts CPU in half.

## Concepts

### Modeling documents
Model for **how data is read**. The question is not "what are the entities?" but "what does each screen or API call need in one read?".

| Embed (subdocument/array) | Reference (store an ID) |
|:--|:--|
| read together almost always | read separately or shared by many parents |
| bounded size (order lines, addresses) | unbounded (comments, events, orders of a user) |
| owned by one parent | many-to-many |
| updated together | updated independently and often |

Useful patterns: **subset** (embed the latest 10 reviews, reference the rest), **extended reference** (copy a few stable fields like customer name into orders), **computed** (store totals updated on write), **bucket** (group time series into one document per hour), **schema versioning** (`schemaVersion` field, migrate lazily).

Limits: 16 MB per document; keep arrays bounded; avoid deeply nested arrays you need to update by position.

### Indexes and queries
| Index | Use |
|:--|:--|
| Single field / compound | `{ accountId: 1, createdAt: -1 }`; follow the **ESR rule**: Equality, Sort, Range |
| Multikey | fields inside arrays |
| Unique / partial | `unique: true`, `partialFilterExpression` |
| TTL | auto-delete documents after a time (sessions, tokens) |
| Text / Atlas Search | search |
| Wildcard | unpredictable keys (use sparingly) |

`explain('executionStats')`: you want `IXSCAN`, not `COLLSCAN`, and `totalDocsExamined` close to `nReturned`.

Transactions: multi-document ACID transactions need a replica set (Atlas always has one); keep them short. Use `writeConcern: majority` for important writes.

### Mongoose 9 essentials
| Feature | Note |
|:--|:--|
| `Schema` + `model` | types, defaults, validation, `timestamps: true` |
| Validation | runs on `save`/`create`; on updates only with `runValidators: true` |
| Middleware | async functions only in Mongoose 9 (no `next()`) |
| `lean()` | plain objects, much faster for reads (no getters/virtuals/save) |
| `select()` | projections: fetch only needed fields |
| `populate()` | extra queries for references; watch for N+1-like costs |
| Indexes | declare in the schema; build deliberately in production (`autoIndex: false`, `syncIndexes()` in a migration step) |
| Injection | validate input types (Zod) and `mongoose.set('sanitizeFilter', true)` |
| Transactions | `connection.transaction(async (session) => …)` |
| Update pipelines | blocked by default in Mongoose 9 (`updatePipeline: true` to allow) |

### Choosing: Postgres, MongoDB, or JSONB
| Need | Pick |
|:--|:--|
| Relational data, joins, constraints, transactions, reporting | **PostgreSQL** (default in this stack) |
| Flexible attributes on mostly relational data | Postgres `jsonb` columns |
| Document-shaped data read as a whole, flexible schemas, MERN codebases | **MongoDB** |
| High-volume simple writes with known access patterns | MongoDB or Postgres (both scale far with good indexes) |
| Strong cross-entity consistency (money, inventory) | Postgres |

Avoid splitting one business flow across two databases without a strong reason: keeping them consistent needs outbox/sync patterns.

## Example
`src/catalog/product.model.ts` — Mongoose 9 schema.
```ts
import mongoose, { Schema, type InferSchemaType } from 'mongoose';

mongoose.set('sanitizeFilter', true);            // wraps $-operators in filters with $eq

const productSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, required: true, index: true },
    sku: { type: String, required: true, trim: true, maxlength: 64 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    priceCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
    currency: { type: String, required: true, enum: ['EUR', 'USD', 'GBP'] },
    attributes: { type: Map, of: String },        // flexible key/value attributes
    latestReviews: {                               // subset pattern: bounded array
      type: [{ author: String, rating: { type: Number, min: 1, max: 5 }, text: String, at: Date }],
      validate: [(v: unknown[]) => v.length <= 10, 'Keep at most 10 embedded reviews'],
    },
    schemaVersion: { type: Number, default: 2 },
  },
  { timestamps: true, autoIndex: false },          // build indexes deliberately in production
);

productSchema.index({ accountId: 1, sku: 1 }, { unique: true });
productSchema.index({ accountId: 1, createdAt: -1 });  // ESR: equality, then sort

productSchema.pre('save', async function () {      // Mongoose 9: async middleware, no next()
  this.name = this.name.replace(/\s+/g, ' ');
});

export type Product = InferSchemaType<typeof productSchema>;
export const ProductModel = mongoose.model('Product', productSchema);
```
Queries with lean reads, projections, and validated input:
```ts
import { z } from 'zod';
import { ProductModel } from './product.model.ts';

const ListQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

export async function listProducts(accountId: string, rawQuery: unknown) {
  const { limit } = ListQuery.parse(rawQuery);
  return ProductModel.find({ accountId })
    .select({ sku: 1, name: 1, priceCents: 1, currency: 1 })   // only what the list needs
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();                                                    // plain objects, faster
}

export async function addReview(accountId: string, productId: string, review: { author: string; rating: number; text: string }) {
  await ProductModel.updateOne(
    { _id: productId, accountId },
    { $push: { latestReviews: { $each: [{ ...review, at: new Date() }], $slice: -10 } } }, // keep the array bounded
    { runValidators: true },
  );
  // the full review history goes to a separate `reviews` collection (reference pattern)
}
```
Check a query plan in `mongosh`:
```js
db.products.find({ accountId: ObjectId("…") }).sort({ createdAt: -1 }).limit(20).explain("executionStats")
// winningPlan: IXSCAN { accountId: 1, createdAt: -1 }   totalDocsExamined: 20   nReturned: 20
```

## Production patterns
- **Model per access pattern**; embed bounded data read together, reference unbounded or shared data.
- **Indexes follow ESR**, created deliberately (not `autoIndex` at startup in production), verified with `explain`.
- **`lean()` + projections for reads**, full documents only when you need middleware and `save()`.
- **Validate input types before querying** and enable `sanitizeFilter`; never pass raw request objects as filters.
- **Postgres by default**; MongoDB where documents fit naturally, with clear ownership of each dataset.

## Mistakes
Wrong: unbounded embedded arrays.
```ts
{ $push: { comments: newComment } } // grows forever toward 16 MB
```
Right: a separate `comments` collection (plus an optional bounded subset embedded).

Wrong: request bodies as filters.
```ts
await User.findOne({ email: req.body.email, password: req.body.password }); // { $ne: null } attacks
```
Right: validate with Zod (strings only), enable `sanitizeFilter`, and compare password hashes in code ([04-auth](../../04-auth/README.md)).

Wrong: `autoIndex: true` in production; index builds start on every deploy and add load at the worst time. Right: build indexes in a controlled migration step.

Wrong: Mongoose 8-style middleware in Mongoose 9.
```ts
schema.pre('save', function (next) { /* … */ next(); }); // next() no longer supported
```
Right: an `async function` without `next`.

## Check yourself
1. When should order line items be embedded in the order document?
2. What does the ESR rule say about compound index order?
3. When would you choose Postgres `jsonb` over a MongoDB collection?

<details>
<summary>Answers</summary>

1. Almost always: they're read with the order, bounded in number, owned by the order, and represent the purchase at that time.
2. Put fields matched by Equality first, then fields used for Sort, then fields used in Range filters.
3. When most of the data is relational and needs joins, constraints, and transactions, and only some attributes are flexible: keep everything in one consistent database with `jsonb` for the flexible part.
</details>

## Sources
- [MongoDB — Data modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [MongoDB — Building with patterns](https://www.mongodb.com/blog/post/building-with-patterns-a-summary)
- [MongoDB — ESR rule for indexes](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/)
- [Mongoose — Docs](https://mongoosejs.com/docs/)
- [Mongoose — Migrating to 9](https://mongoosejs.com/docs/migrating_to_9.html)
