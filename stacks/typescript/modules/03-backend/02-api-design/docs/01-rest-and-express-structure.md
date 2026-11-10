---
title: Resources, Express 5 structure, and API styles
tech: Express 5, TypeScript 6
version: Express 5.2, Node.js 26 LTS
date: 2026-11-07
covers: [1, 2, 13]
---
# Resources, Express 5 structure, and API styles
[← Overview](00-overview.md)

## Why it matters
- Endpoints like `POST /getOrders`, `GET /deleteUser?id=7`, and `POST /orders/updateStatusToShipped` grow into an API nobody can predict or cache.
- Auth middleware is registered after the routes in one file; a new router mounted earlier is accidentally public.
- One route returns errors as `{ msg }`, another as `{ error: { message } }`, a third crashes with an HTML stack trace.

## Concepts

### Resource-oriented design
| Rule | Example |
|:--|:--|
| URLs name resources (nouns, plural) | `/orders`, `/orders/{orderId}` |
| Methods say what happens | `GET` read, `POST` create, `PATCH` partial update, `PUT` replace, `DELETE` remove |
| Sub-resources for ownership | `/orders/{orderId}/items` |
| Query strings for filters, sorting, paging | `/orders?status=paid&sort=-createdAt&limit=20` |
| Actions that don't fit CRUD | a sub-resource noun: `POST /orders/{id}/cancellation` (or `POST /orders/{id}:cancel`) |
| Status codes carry meaning | 201 + `Location`, 204, 404, 409, 422 ([02-http-networking](../../../01-foundations/02-http-networking/docs/02-methods-status-headers.md)) |
| Consistent naming | kebab-case paths, camelCase JSON fields |
| Current user | `/me`, `/me/orders` instead of trusting IDs from clients |

### Express 5 structure
```text
src/
  app.ts              createApp(deps): middleware, routers, 404, error handler
  server.ts           listen + graceful shutdown
  http/
    errors.ts         AppError classes + error handler (Problem Details)
    middleware/       requestId, auth, rateLimit
  orders/
    orders.routes.ts  Router: HTTP only (parse input, call service, send DTO)
    orders.service.ts business rules
    orders.repo.ts    SQL / Drizzle
    orders.schemas.ts Zod schemas (shared package if the frontend uses them)
```
Middleware runs **in registration order**. A typical order:
1. request ID / context, 2. request logging, 3. security headers (Helmet), 4. CORS (only if not same-origin), 5. body parsing with size limits, 6. rate limiting, 7. authentication (attach `req.user`), 8. routers (authorization inside), 9. 404 handler, 10. error handler (4 arguments, last).

### Express 5 changes that bite
| Change | Do |
|:--|:--|
| Async errors forwarded automatically | throw in async handlers; no `try/catch` + `next(err)` boilerplate |
| Wildcards must be named | `/files/*splat` (not `/files/*`); optional: `/{*splat}` |
| Optional segments use braces | `/users{/:id}` (no `?` suffix) |
| No regex characters in paths | validate params with Zod instead |
| `req.query` read-only, "simple" parser | `?a[b]=1` isn't parsed into objects unless configured |
| `req.body` undefined without a parser | check before use; parse with Zod |
| Removed: `app.del`, `req.param()`, `res.send(status)`, `res.redirect('back')` | use `delete`, explicit params, `res.sendStatus` |

### Choosing an API style
| Style | Strengths | Costs | Fits |
|:--|:--|:--|:--|
| REST + OpenAPI | simple, HTTP caching, universal tooling | over/under-fetching for complex UIs | public and most internal APIs (this course) |
| GraphQL | clients pick fields, one round trip for nested data | caching, N+1, query cost limits, more server complexity | many diverse clients, aggregation layers |
| tRPC | end-to-end TypeScript types in a monorepo | TS-only, tight coupling | internal full-stack TS apps |
| gRPC | fast binary protocol, streaming, codegen | browsers need a proxy | service-to-service |
| Webhooks / events | push instead of polling | delivery, ordering, retries | notifying integrators (lesson 04) |

## Example
`src/app.ts`
```ts
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { contextMiddleware } from './http/middleware/context.ts';
import { authenticate } from './http/middleware/auth.ts';
import { errorHandler, NotFoundError } from './http/errors.ts';
import { ordersRouter } from './orders/orders.routes.ts';
import type { Deps } from './deps.ts';

export function createApp(deps: Deps) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(contextMiddleware);                       // request ID first, so every log has it
  app.use(pinoHttp({ logger: deps.logger }));
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health/live', (_req, res) => res.json({ ok: true }));   // public, before auth

  app.use(authenticate(deps.sessions));            // sets req.user or leaves it undefined
  app.use('/v1/orders', ordersRouter(deps));

  app.use((req) => { throw new NotFoundError(`No route for ${req.method} ${req.path}`); });
  app.use(errorHandler(deps.logger));              // must be last
  return app;
}
```
`src/orders/orders.routes.ts` — thin HTTP layer.
```ts
import { Router } from 'express';
import { CreateOrderBody, OrderIdParams } from './orders.schemas.ts';
import { toOrderDTO } from './orders.dto.ts';
import { requireUser } from '../http/middleware/auth.ts';
import type { Deps } from '../deps.ts';

export function ordersRouter({ orders }: Deps) {
  const router = Router();
  router.use(requireUser);                          // 401 unless authenticated

  router.post('/', async (req, res) => {
    const body = CreateOrderBody.parse(req.body);   // ZodError → 422 in the error handler
    const order = await orders.create(req.user!.accountId, body);
    res.status(201).location(`/v1/orders/${order.id}`).json(toOrderDTO(order));
  });

  router.get('/:orderId', async (req, res) => {
    const { orderId } = OrderIdParams.parse(req.params);
    const order = await orders.getForAccount(req.user!.accountId, orderId); // throws NotFoundError
    res.json(toOrderDTO(order));
  });

  router.post('/:orderId/cancellation', async (req, res) => {
    const { orderId } = OrderIdParams.parse(req.params);
    const order = await orders.cancel(req.user!.accountId, orderId);        // ConflictError if shipped
    res.json(toOrderDTO(order));
  });

  return router;
}
```
Express 5 route syntax:
```ts
app.get('/files/*splat', (req, res) => res.json({ path: req.params.splat }));   // splat is an array of segments
app.get('/users{/:id}', (req, res) => res.json({ id: req.params.id ?? null })); // optional segment
```

## Production patterns
- **Thin routes, logic in services, SQL in repositories** ([11-architecture](../../11-architecture/README.md)).
- **One middleware order for the whole app**, defined in `createApp`; routers add authorization, never authentication.
- **Health endpoints before auth and rate limits**; everything else authenticated by default.
- **`/me` endpoints** derive the user from the session instead of trusting IDs.
- **REST + OpenAPI as the default**; reach for GraphQL or gRPC only for a concrete need.

## Mistakes
Wrong: verbs in URLs and state changes over GET.
```text
GET  /deleteOrder?id=7
POST /getOrders
```
Right: `DELETE /orders/7`, `GET /orders`.

Wrong: Express 4 wildcard syntax in Express 5.
```ts
app.get('/files/*', handler); // throws at startup: wildcards need a name
```
Right: `app.get('/files/*splat', handler)`.

Wrong: try/catch + `next(err)` in every async route. Right: throw; Express 5 forwards rejections to the error handler.

Wrong: an error handler with three parameters; Express treats it as normal middleware. Right: `(err, req, res, next)` with four parameters, registered last.

## Check yourself
1. How would you model "cancel an order" in a resource-oriented API?
2. Why does middleware order matter for security?
3. What changed about wildcards and optional parameters in Express 5?

<details>
<summary>Answers</summary>

1. As a resource or action under the order: `POST /orders/{id}/cancellation` (creating a cancellation) or a status change via `PATCH /orders/{id}` with business rules in the service; not `GET /cancelOrder`.
2. Middleware runs in registration order: routes mounted before authentication or rate limiting skip them. Body limits must run before parsing; the error handler must come last.
3. Wildcards must be named (`/*splat`, values arrive as arrays), optional segments use braces (`/users{/:id}`), and regex characters in paths are no longer supported.
</details>

## Sources
- [Express 5 — Routing](https://expressjs.com/en/guide/routing.html)
- [Express — Migrating to Express 5](https://expressjs.com/en/guide/migrating-5.html)
- [Express — Writing middleware](https://expressjs.com/en/guide/writing-middleware.html)
- [Google — API design guide: resource-oriented design](https://cloud.google.com/apis/design/resources)
- [Zalando — RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/)
