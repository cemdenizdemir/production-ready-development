---
title: Methods, status codes, and headers
tech: HTTP, Node.js 26, Express 5, curl
version: Node.js 26 LTS, Express 5.2, RFC 9110
date: 2026-11-07
covers: [2, 3]
---
# Methods, status codes, and headers
[← Overview](00-overview.md)

## Why it matters
- A `GET /users/7/delete` link gets prefetched by a browser or crawled by a bot, and accounts vanish.
- A mobile client retries a timed-out `POST /payments`, and the customer pays twice.
- An API answers `200 {"error":"not found"}`: caches store the error and the dashboards show a 0% error rate during an outage.

## Concepts

### Methods
| Method | Purpose | Safe | Idempotent | Body |
|:--|:--|:-:|:-:|:-:|
| GET | read | ✓ | ✓ | no |
| HEAD | headers of a GET only | ✓ | ✓ | no |
| OPTIONS | capabilities, CORS preflight | ✓ | ✓ | no |
| POST | create, or run an action | ✗ | ✗ | yes |
| PUT | create or replace at a known URL | ✗ | ✓ | yes |
| PATCH | partial update | ✗ | ✗ | yes |
| DELETE | remove | ✗ | ✓ | rare |

- **Safe:** no state change. Crawlers, link prefetchers, and caches assume GET is safe.
- **Idempotent:** doing it twice has the same effect as once. Clients and proxies may retry idempotent requests on their own.
- POST can be made retry-safe with an `Idempotency-Key` header ([03-backend/02-api-design](../../../03-backend/02-api-design/README.md)).

### Status codes
| Code | Meaning | Use when |
|:--|:--|:--|
| 200 OK | success with a body | reads, updates returning data |
| 201 Created | resource created | POST that created something; send `Location` |
| 202 Accepted | queued, not done yet | async jobs; send a status URL |
| 204 No Content | success, no body | DELETE, updates with nothing to return |
| 301 / 308 | moved permanently | 308 keeps the method and body |
| 302 / 307 | temporary redirect | 307 keeps the method and body |
| 303 See Other | go GET this URL | after a form POST |
| 304 Not Modified | your cached copy is valid | conditional GET (lesson 05) |
| 400 Bad Request | malformed or invalid input | syntax or validation errors |
| 401 Unauthorized | not authenticated | missing or bad credentials; send `WWW-Authenticate` |
| 403 Forbidden | authenticated, not allowed | missing permission |
| 404 Not Found | no such resource | also to hide that something exists |
| 405 Method Not Allowed | wrong method | send `Allow` |
| 409 Conflict | conflicts with current state | duplicate email, version clash |
| 412 Precondition Failed | `If-Match` failed | optimistic concurrency |
| 415 Unsupported Media Type | wrong `Content-Type` | XML sent to a JSON API |
| 422 Unprocessable Content | well-formed, semantically invalid | pick 400 or 422 for validation and stay consistent |
| 429 Too Many Requests | rate limited | send `Retry-After` |
| 500 Internal Server Error | unexpected bug | never on purpose |
| 502 Bad Gateway | upstream sent a bad response | proxies, load balancers |
| 503 Service Unavailable | overloaded or in maintenance | send `Retry-After` |
| 504 Gateway Timeout | upstream too slow | proxies, load balancers |

Rule of thumb: 4xx means the client can fix it, 5xx means you must fix it. Never 200 for an error.

### Headers that matter
| Header | Direction | Purpose |
|:--|:--|:--|
| `Content-Type` | both | body format: `application/json; charset=utf-8` |
| `Accept` | request | formats the client can handle |
| `Authorization` | request | credentials: `Bearer <token>` |
| `Location` | response | URL of a created resource or redirect target |
| `Retry-After` | response | seconds (or a date) to wait; with 429 and 503 |
| `Allow` | response | permitted methods; with 405 |
| `WWW-Authenticate` | response | how to authenticate; with 401 |
| `Content-Length` | both | body size in bytes |
| `User-Agent` | request | client identity, for logs and analytics |
| `X-Request-Id`, `traceparent` | both | correlate logs and traces across services |

## Example
`orders.ts` — correct codes and headers in Express 5. Run with `node orders.ts`.
```ts
import express from 'express';
import { randomUUID } from 'node:crypto';

type Order = { id: string; item: string; qty: number };
const orders = new Map<string, Order>();

const app = express();
app.use(express.json({ limit: '100kb' }));

app.post('/orders', (req, res) => {
  if (!req.is('application/json')) return res.status(415).json({ error: 'Send application/json' });
  const { item, qty } = req.body ?? {};
  if (typeof item !== 'string' || !Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'item (string) and qty (integer >= 1) are required' });
  }
  const order: Order = { id: randomUUID(), item, qty };
  orders.set(order.id, order);
  res.status(201).location(`/orders/${order.id}`).json(order);
});

app.get('/orders/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.delete('/orders/:id', (req, res) => {
  orders.delete(req.params.id); // deleting twice still ends in "gone": idempotent
  res.status(204).end();
});

app.all('/orders', (_req, res) => res.status(405).set('Allow', 'POST').end());

app.listen(3000);
```
Try it:
```bash
curl -i --json '{"item":"book","qty":2}' localhost:3000/orders    # 201 + Location
curl -i localhost:3000/orders/nope                                 # 404
curl -i -X PUT localhost:3000/orders                               # 405 + Allow: POST
```

## Production patterns
- **One error shape for every 4xx and 5xx.** RFC 9457 Problem Details (`application/problem+json` with `type`, `title`, `status`, `detail`) is the standard; [03-backend/02-api-design](../../../03-backend/02-api-design/README.md) builds it.
- **Return 404, not 403, when the 403 would confirm that another tenant's record exists.**
- **Always send `Retry-After` with 429 and 503** so well-behaved clients back off instead of hammering you.
- **Log method, route, status, duration, and request ID for every response.** Alerts are built on 5xx rates.
- **Long work returns 202 plus a status URL** instead of holding a connection open for minutes.

## Mistakes
Wrong: an error with a success status.
```ts
res.json({ error: 'not found' }); // 200: cached, counted as success
```
Right:
```ts
res.status(404).json({ error: 'Order not found' });
```

Wrong: a GET that changes state.
```ts
app.get('/orders/:id/cancel', cancelOrder); // prefetchers and crawlers will call it
```
Right:
```ts
app.post('/orders/:id/cancel', cancelOrder);
```

Wrong: 401 for "logged in, but not allowed". Right: 403. A 401 tells the client to log in again, which won't help.

Wrong: a 301 for a temporary redirect. Browsers cache 301s indefinitely. Right: 302 or 307 until the move is permanent.

## Check yourself
1. Why is PUT idempotent but POST is not?
2. Which status for: valid JSON, but the email is already registered?
3. A client retries a timed-out `POST /payments`. What makes the retry safe?

<details>
<summary>Answers</summary>

1. PUT sends the full new state to a known URL, so repeating it leaves the same state. POST asks the server to create or do something, so repeating it can create a second resource.
2. 409 Conflict: the request is valid but clashes with current state.
3. An `Idempotency-Key` header: the server stores the first result under that key and returns it for repeats instead of charging again.
</details>

## Sources
- [RFC 9110 — Methods](https://www.rfc-editor.org/rfc/rfc9110#name-methods) and [status codes](https://www.rfc-editor.org/rfc/rfc9110#name-status-codes)
- [MDN — HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
- [Express 5 API — `res`](https://expressjs.com/en/5x/api.html#res)
