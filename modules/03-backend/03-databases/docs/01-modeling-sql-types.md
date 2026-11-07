---
title: Relational modeling, SQL, and data types
tech: PostgreSQL 18
version: PostgreSQL 18
date: 2026-11-07
covers: [1, 2, 8]
---
# Relational modeling, SQL, and data types
[← Overview](00-overview.md)

## Why it matters
- Customer addresses are copied into every order row "for convenience"; a customer moves, and half the reports show the old city.
- `created_at timestamp` (without time zone) stores local times from servers in two regions; ordering events across them is now impossible.
- Prices in `float` columns sum to 19.989999; finance spends a week reconciling.

## Concepts

### Modeling basics
| Concept | Practice |
|:--|:--|
| Entities → tables | one table per thing: `accounts`, `customers`, `orders`, `order_items` |
| Primary keys | surrogate keys: `uuid DEFAULT uuidv7()` (PG 18, time-ordered) or `bigint GENERATED ALWAYS AS IDENTITY` |
| Natural keys | enforce with `UNIQUE` constraints (email per account), don't use as PK |
| 1:N | foreign key on the "many" side (`orders.customer_id`) |
| N:M | join table with a composite PK (`product_tags(product_id, tag_id)`) |
| Normalization (to ~3NF) | each fact stored once; derive the rest with joins |
| Deliberate denormalization | copy data when it must not change (price at purchase time, shipping address on the order) |
| Multi-tenancy | `account_id` on every tenant table, in every query and index |
| Audit columns | `created_at`, `updated_at` (timestamptz, defaults) |
| Soft delete | `deleted_at timestamptz` + partial unique indexes, or archive tables |

**Constraints** are executable business rules: `NOT NULL`, `UNIQUE`, `CHECK (quantity > 0)`, `FOREIGN KEY ... ON DELETE RESTRICT|CASCADE|SET NULL`, `EXCLUDE` (no overlapping bookings). The application validates for nice errors; the database guarantees correctness even with bugs, scripts, and races.

### Data types
| Need | Type | Avoid |
|:--|:--|:--|
| Text | `text` (+ `CHECK (length(x) <= n)` if needed) | `varchar(255)` by habit |
| Case-insensitive email | `citext` extension, or unique index on `lower(email)` | case-sensitive duplicates |
| Moment in time | `timestamptz` (stored as UTC) | `timestamp` without zone |
| Calendar date | `date` | timestamps at midnight |
| Money | `bigint`/`integer` minor units + `currency char(3)`, or `numeric(14,2)` | `float`, `real`, `money` |
| IDs | `uuid` (`uuidv7()`), or identity `bigint` | `serial` (legacy) |
| Flexible attributes | `jsonb` (indexable with GIN) | core relational data in JSON |
| Fixed set of values | `text` + `CHECK (status IN (...))`, or an enum type | free text |
| Yes/no | `boolean` | `'Y'`/`'N'` strings |
| Derived value | generated column (virtual by default in PG 18, or `STORED`) | duplicated logic |

### SQL you must know
| Feature | Use |
|:--|:--|
| `JOIN` / `LEFT JOIN` | combine related rows; `LEFT` keeps rows without matches |
| `NOT EXISTS (subquery)` | anti-join: "customers without orders" |
| `GROUP BY` + `HAVING`, `count(*) FILTER (WHERE …)` | aggregates and conditional counts |
| CTE `WITH … AS (…)` | readable multi-step queries; `WITH RECURSIVE` for trees |
| Window functions `OVER (PARTITION BY … ORDER BY …)` | ranking, running totals, previous row (`lag`) |
| `DISTINCT ON (col)` | first row per group (latest order per customer) |
| Upsert `INSERT … ON CONFLICT (…) DO UPDATE SET x = EXCLUDED.x` | insert or update atomically |
| `RETURNING` (PG 18: `OLD`/`NEW`) | get written rows without a second query |
| `MERGE` | complex insert/update/delete in one statement |
| `jsonb` operators `->`, `->>`, `@>`, `?` | query JSON documents |
| `LATERAL` | per-row subqueries ("top 3 items per order") |

## Example
`schema.sql`
```sql
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE accounts (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  name       text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email      citext NOT NULL,
  name       text NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- an email can be reused only after the old customer is soft-deleted
CREATE UNIQUE INDEX customers_account_email_uq ON customers (account_id, email) WHERE deleted_at IS NULL;

CREATE TABLE orders (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  account_id   uuid NOT NULL REFERENCES accounts(id),
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
  currency     char(3) NOT NULL,
  total_cents  bigint NOT NULL CHECK (total_cents >= 0),
  ship_to      jsonb NOT NULL,                      -- copied at purchase: must not change later
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  order_id         uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku              text NOT NULL,
  quantity         int  NOT NULL CHECK (quantity > 0),
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0), -- price at purchase time
  PRIMARY KEY (order_id, sku)
);
```
Queries worth having in your fingers:
```sql
-- Revenue per day in the account's local zone, paid orders only
SELECT date_trunc('day', created_at AT TIME ZONE 'Europe/Berlin') AS day,
       sum(total_cents) AS revenue_cents,
       count(*) FILTER (WHERE total_cents > 10000) AS big_orders
FROM orders
WHERE account_id = $1 AND status = 'paid' AND created_at >= now() - interval '30 days'
GROUP BY 1 ORDER BY 1;

-- Latest order per customer
SELECT DISTINCT ON (customer_id) customer_id, id, created_at
FROM orders WHERE account_id = $1
ORDER BY customer_id, created_at DESC;

-- Customers who never ordered (anti-join)
SELECT c.id, c.email FROM customers c
WHERE c.account_id = $1 AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);

-- Running total with a window function
SELECT id, created_at, sum(total_cents) OVER (ORDER BY created_at) AS running_total
FROM orders WHERE account_id = $1 AND status = 'paid';

-- Upsert a daily counter atomically
INSERT INTO daily_stats (account_id, day, orders) VALUES ($1, current_date, 1)
ON CONFLICT (account_id, day) DO UPDATE SET orders = daily_stats.orders + 1
RETURNING orders;
```

## Production patterns
- **Constraints first**: every rule that must always hold is a constraint, not just app code.
- **`timestamptz` everywhere, integer minor units for money**, `uuidv7()` or identity keys.
- **`account_id` on every tenant row** and leading every tenant index ([02 · indexes](02-indexes-performance-operations.md)).
- **Copy facts that must not change** (prices, addresses at purchase) instead of joining to mutable data.
- **Prefer `text` + `CHECK` for small evolving value sets**; enum types are hard to shrink.

## Mistakes
Wrong: floats for money.
```sql
price real -- 0.1 + 0.2 problems inside your database
```
Right: `price_cents bigint` + `currency char(3)` (or `numeric(14,2)`).

Wrong: timestamps without zone.
```sql
created_at timestamp DEFAULT now()  -- loses the offset; server time zone leaks in
```
Right: `created_at timestamptz NOT NULL DEFAULT now()`.

Wrong: uniqueness only in code (`SELECT` then `INSERT`); two concurrent requests create duplicates. Right: a `UNIQUE` index, and handle error `23505` as a 409.

Wrong: storing core relational data (orders, items) in one big `jsonb` blob "for flexibility". Right: tables for what you query and constrain; `jsonb` for truly flexible attributes.

## Check yourself
1. Why copy the unit price into `order_items` instead of joining to `products.price`?
2. What does a partial unique index like `WHERE deleted_at IS NULL` allow?
3. What does `DISTINCT ON (customer_id)` return when combined with `ORDER BY customer_id, created_at DESC`?

<details>
<summary>Answers</summary>

1. The price at purchase time is a historical fact; product prices change later, and orders must keep what the customer actually paid.
2. Uniqueness only among active rows: a soft-deleted customer's email can be used again by a new customer in the same account.
3. One row per customer: the first row of each customer group in that order, i.e. their most recent order.
</details>

## Sources
- [PostgreSQL — Data types](https://www.postgresql.org/docs/current/datatype.html)
- [PostgreSQL — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL — UUID functions (`uuidv7`)](https://www.postgresql.org/docs/18/functions-uuid.html)
- [PostgreSQL wiki — Don't do this](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- [PostgreSQL — Window functions tutorial](https://www.postgresql.org/docs/current/tutorial-window.html)
