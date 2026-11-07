---
title: Application, resilience, and frontend patterns; anti-patterns
tech: TypeScript 6 (strict), Node.js 26, React 19.2
version: TypeScript 6.0, Drizzle ORM 0.45, React 19.2
date: 2026-11-07
covers: [8, 9, 10, 11, 12]
---
# Application, resilience, and frontend patterns; anti-patterns
[← Overview](00-overview.md)

## Why it matters
- SQL for "active, in-stock products in a category" is written five times with small differences; search and the sitemap disagree about which products exist.
- A `ShopManager` class with 4,000 lines and 30 dependencies does everything. Every change needs its owner's approval and still breaks something.
- A React page fetches data, handles errors, formats prices, and renders 300 lines of JSX in one component. Reusing the price display elsewhere means copying it.

## Concepts

### Application (enterprise) patterns
| Pattern | Problem | Notes |
|:--|:--|:--|
| Repository | collection-like access to aggregates, hiding persistence | one per aggregate; returns domain objects |
| Unit of work | several changes commit together | a transaction passed to repositories (`tx`) |
| Data mapper | domain objects separate from tables | Drizzle rows ↔ domain objects |
| Active record | objects that save themselves (`user.save()`) | simple CRUD; couples domain to persistence (also seen: Mongoose models) |
| Table/row data gateway | thin access per table | fine for simple modules |
| Specification | reusable, composable business rules or queries | `isActive.and(inStock)` |
| Query object / read model | dedicated queries for screens | CQRS-lite |
| Identity map | one object per row per transaction | ORMs; rarely hand-built |
| Service layer / use case | application workflows | orchestrates domain + repositories |
| DTO / mapper | boundary data shapes | API and job payloads |

### Resilience and integration patterns (where they live)
| Pattern | Taught in |
|:--|:--|
| Timeout, retry with backoff and jitter | [03-backend/08-reliability lesson 01](../../../03-backend/08-reliability/docs/01-failure-modes-timeouts-retries.md) |
| Circuit breaker, bulkhead, load shedding | [03-backend/08-reliability lesson 03](../../../03-backend/08-reliability/docs/03-breakers-bulkheads-load-shedding.md) |
| Cache-aside, write-through | [03-backend/06-caching](../../../03-backend/06-caching/README.md) |
| Transactional outbox, idempotent consumer | [03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md) |
| Saga, compensation | [07-distributed-systems](../../07-distributed-systems/README.md) |
| Anti-corruption layer | [05-domain-driven-design](../../05-domain-driven-design/README.md) |
| Strangler fig | [03-backend/11-architecture lesson 04](../../../03-backend/11-architecture/docs/04-events-boundaries-decisions.md) |

### Frontend patterns (React)
| Pattern | Use |
|:--|:--|
| Container / presentational | data and behavior in one component, pure display in another |
| Custom hooks | reusable behavior (`useCart`, `useDebouncedValue`) |
| Composition (children, slots) | flexible layouts instead of prop explosions |
| Compound components | `Tabs` + `Tabs.List` + `Tabs.Panel` sharing context |
| Provider (context) | app-wide dependencies: theme, query client, auth |
| Render props | mostly replaced by hooks; still seen in libraries |
| Higher-order components | legacy; prefer hooks |
| Server/client component split | Next.js: data on the server, interactivity in small client islands |

### Anti-patterns
| Anti-pattern | Sign | Fix |
|:--|:--|:--|
| God object | one class/module knows everything | split by responsibility |
| Service locator | `container.get('x')` inside business code | inject dependencies |
| Singleton abuse | global mutable state | composition root |
| Anemic domain model (when rules matter) | objects are bags of fields, rules scattered in services | move rules into the model |
| Pattern-itis | factories of factories, unused abstractions | delete, inline |
| Lava flow | dead code nobody dares to remove | tests, then delete |
| Golden hammer | one tool for every problem | choose per problem |
| Big ball of mud | no structure, everything depends on everything | modules and boundaries |
| Leaky abstraction | callers must know internals | redesign the interface |
| Premature optimization | complexity without measurements | measure first |

### Choosing a pattern
1. Name the problem and the force (variation? coupling? lifecycle? failure?).
2. Try the simplest thing (a function, a union, a parameter).
3. Refactor **towards** a pattern when the pain repeats; refactor **away** when it stops paying.

## Example
Specification: one definition of "sellable product", used by queries and in-memory checks.
```ts
import { and, eq, gt, isNull, type SQL } from 'drizzle-orm';
import { products } from '#src/catalog/catalog.tables.ts';

type Product = typeof products.$inferSelect;
type Spec = { sql: SQL; test: (p: Product) => boolean };

const spec = (sql: SQL, test: (p: Product) => boolean): Spec => ({ sql, test });
const allOf = (...specs: Spec[]): Spec => spec(and(...specs.map((s) => s.sql))!, (p) => specs.every((s) => s.test(p)));

export const active = spec(eq(products.active, true), (p) => p.active);
export const notDeleted = spec(isNull(products.deletedAt), (p) => p.deletedAt === null);
export const inStock = spec(gt(products.stock, 0), (p) => p.stock > 0);
export const sellable = allOf(active, notDeleted, inStock);

// Same rule in SQL and in memory
const rows = await db.select().from(products).where(and(sellable.sql, eq(products.categoryId, categoryId)));
if (!sellable.test(product)) throw new ConflictError('catalog.not_sellable', 'Product is not available');
```
Repository + unit of work (the transaction is the unit of work):
```ts
export async function cancelOrder(db: Db, orderId: string) {
  await db.transaction(async (tx) => {
    const order = await ordersRepo.get(tx, orderId);           // repository returns a domain object
    order.cancel();                                            // rules inside the model
    await ordersRepo.save(tx, order);
    await stockRepo.release(tx, order.lines);                  // same unit of work
    await appendOutbox(tx, { topic: 'order.cancelled', payload: { orderId } });
  });
}
```
Container / presentational with a custom hook:
```tsx
// Presentational: pure, reusable, easy to test
export function Price({ cents, currency }: { cents: number; currency: 'EUR' | 'USD' }) {
  return <span>{new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100)}</span>;
}

// Behavior in a hook
function useProduct(id: string) {
  return useQuery({ queryKey: ['product', id], queryFn: () => api.getProduct(id) });
}

// Container: wires data to presentation
export function ProductCard({ id }: { id: string }) {
  const { data, isPending, error } = useProduct(id);
  if (isPending) return <ProductCardSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  return <article><h2>{data.name}</h2><Price cents={data.priceCents} currency="EUR" /></article>;
}
```

## In our stack
- Repositories with `tx`, use cases, DTO mappers: [03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-transactions.md).
- Data mapper (Drizzle) vs active record (Mongoose models): [03-backend/03-databases](../../../03-backend/03-databases/README.md).
- Frontend patterns: [02-frontend/04-framework](../../../02-frontend/04-framework/README.md) and [02-frontend/06-rendering](../../../02-frontend/06-rendering/README.md).

## When not to
- No repository abstraction over a single simple query in a small CRUD module; a query function is enough.
- No specification objects for a rule used once.
- Active record is fine for simple CRUD screens; data mapper pays off when rules get rich.

## Production patterns
- **One repository per aggregate**, transactions passed in as the unit of work.
- **Specifications or shared query helpers** for business rules used in several places.
- **Resilience patterns at every network boundary**, implemented once as decorators.
- **Small presentational components and hooks** on the frontend.
- **Refactor towards patterns** when the pain repeats, and remove them when it doesn't.

## Mistakes
Wrong: generic `Repository<T>` with `findAll`, `findBy(any)`, `update(any)` for everything. It leaks query details and helps nobody. Right: repositories per aggregate with intention-revealing methods.

Wrong: a `container.get('mailer')` call deep inside a use case. Dependencies are hidden. Right: inject them.

Wrong: a "pattern" added for its own sake (a strategy with one implementation, a factory returning `new X()`). Right: wait for real variation.

## Check yourself
1. What's the difference between a repository and a data mapper?
2. How does a specification keep a rule consistent between SQL queries and in-memory checks?
3. Name three anti-patterns and their fixes.

<details>
<summary>Answers</summary>

1. A data mapper translates between domain objects and database rows; a repository offers a collection-like interface for aggregates (`get`, `save`, intention-revealing queries) and usually uses a mapper internally. Callers of a repository don't see SQL or rows.
2. The rule is defined once with two faces: an SQL condition for queries and a predicate for objects in memory, both composed the same way. Search, sitemaps, and checkout use the same definition, so they can't disagree.
3. God object → split by responsibility; service locator → inject dependencies; singleton abuse → create instances in the composition root; pattern-itis → inline and delete unused abstractions; big ball of mud → modules with enforced boundaries.
</details>

## Sources
- [Martin Fowler — Catalog of Patterns of Enterprise Application Architecture](https://martinfowler.com/eaaCatalog/)
- [Martin Fowler — Specification (with Eric Evans)](https://martinfowler.com/apsupp/spec.pdf)
- [Martin Fowler — Anemic domain model](https://martinfowler.com/bliki/AnemicDomainModel.html)
- [patterns.dev — React patterns](https://www.patterns.dev/react/)
- [Microsoft — Cloud design patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/)
