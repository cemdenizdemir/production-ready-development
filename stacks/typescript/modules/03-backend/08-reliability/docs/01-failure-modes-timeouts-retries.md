---
title: Failure modes, timeouts, and retries
tech: Node.js 26, Express 5, PostgreSQL 18
version: Node.js 26 LTS (undici 8 fetch), Express 5.2, node-postgres 8, PostgreSQL 18
date: 2026-11-07
covers: [1, 2, 3]
---
# Failure modes, timeouts, and retries
[← Overview](00-overview.md)

## Why it matters
- A shipping partner's API accepts connections but never answers. `fetch` waits up to 5 minutes (undici's default headers timeout), sockets pile up, and the whole API becomes unresponsive.
- Three layers (client, API, partner SDK) each retry 3 times. During an incident one slow call becomes 27, and the retries keep the dependency down.
- A `POST /payments` timed out and was retried without an idempotency key. The first attempt had succeeded, so the customer paid twice.

## Concepts

### How production systems fail
| Failure | Example | Main defenses |
|:--|:--|:--|
| Slow dependency | lock contention, partner latency | timeouts, breakers, bulkheads |
| Dependency down | Redis restart, RDS failover | retries, fallbacks, degradation |
| Overload | traffic spike, retry storm | load shedding, backoff, autoscaling |
| Bad deploy | bug, wrong config | health checks, rollback ([04-shipping](../../../04-shipping/README.md)) |
| Resource exhaustion | DB pool, memory, file descriptors, disk | limits, monitoring |
| Partial failure | one AZ, one shard, one endpoint | isolation, redundancy |

**Slow is worse than down.** A fast failure frees its resources right away. A hang holds a socket, a pool connection, and memory until something gives up. Cascading failures usually start with something slow.

### Timeouts everywhere
| Layer | Setting | Typical value |
|:--|:--|:--|
| Outgoing HTTP | `AbortSignal.timeout(ms)` per attempt | 0.5–10 s, inside the caller's budget |
| undici (fetch) defaults | `connectTimeout` 10 s, `headersTimeout` 300 s, `bodyTimeout` 300 s | far too long: always pass a signal |
| node-postgres pool | `connectionTimeoutMillis` (wait for a free connection) | 2–5 s; default 0 = wait forever |
| Postgres server | `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`, `transaction_timeout` (17+) | 5 s / 2 s / 30 s / per use case |
| Redis | `connectTimeout`, `disableOfflineQueue: true` | fail fast; cache is optional |
| Node HTTP server | `requestTimeout` (300 s), `headersTimeout` (60 s), `keepAliveTimeout` (5 s) | 120 s / 66 s / 65 s behind an ALB (`headersTimeout` ≤ `requestTimeout`) |
| Load balancer | ALB idle timeout (60 s) | above the slowest legitimate request |
| Background jobs | timeout inside the processor | per job type |

**Deadlines, not just timeouts.** A request has a total budget (say 2.5 s). Each downstream call gets at most what's left, and work stops when the budget runs out or the client disconnects. Otherwise a request the client abandoned keeps calling dependencies.

### Retries
| Rule | Why |
|:--|:--|
| Retry only transient failures | network errors, timeouts, 408, 429, 500, 502, 503, 504 |
| Never blind-retry non-idempotent calls | `POST` only with an idempotency key ([02-api-design lesson 03](../../02-api-design/docs/03-pagination-idempotency-concurrency.md)) |
| Exponential backoff + **full jitter** | spreads retries out, no synchronized waves |
| Cap attempts and total time | stay inside the request's budget |
| Respect `Retry-After` | the server tells you when to come back |
| Retry at **one** layer | 3 layers × 3 attempts = 27 calls |
| Retry budget | retries ≤ ~10% of calls; when everything fails, stop (breaker, lesson 03) |

Full jitter: `delay = random(0, min(cap, base × 2^attempt))`. Without jitter, every client that failed at the same moment retries at the same moment.

In background jobs, BullMQ does the retrying with backoff ([07-background-jobs lesson 02](../../07-background-jobs/docs/02-retries-idempotency-failures.md)). In requests, keep retries few and fast; the user is waiting.

## Example
`src/http/fetch-json.ts` — timeouts, deadline, and safe retries in one helper.
```ts
import { setTimeout as sleep } from 'node:timers/promises';

export class UpstreamError extends Error {
  readonly status: number | undefined;
  readonly retryable: boolean;
  constructor(message: string, status: number | undefined, retryable: boolean) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
    this.retryable = retryable;
  }
}

type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;     // per attempt
  attempts?: number;      // total tries
  budget?: AbortSignal;   // the caller's deadline and client disconnect
  retryUnsafe?: boolean;  // true only when the request carries an idempotency key
};

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 3_000, attempts = 3, budget, retryUnsafe = false, ...init } = opts;
  const method = (init.method ?? 'GET').toUpperCase();
  const canRetry = SAFE_METHODS.has(method) || retryUnsafe;

  for (let attempt = 1; ; attempt++) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = budget ? AbortSignal.any([budget, timeout]) : timeout;
    let retryAfterMs: number | undefined;

    try {
      const res = await fetch(url, { ...init, method, signal });
      if (res.ok) return (await res.json()) as T;
      const retryable = RETRYABLE_STATUS.has(res.status);
      if (!retryable || !canRetry || attempt >= attempts) {
        await res.body?.cancel();
        throw new UpstreamError(`${method} ${url} returned ${res.status}`, res.status, retryable);
      }
      retryAfterMs = parseRetryAfter(res.headers.get('retry-after'));
      await res.body?.cancel();                                   // release the socket before waiting
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      if (budget?.aborted) throw err;                             // the caller gave up: don't retry
      if (!canRetry || attempt >= attempts) {
        throw new UpstreamError(`${method} ${url} failed: ${(err as Error).message}`, undefined, true);
      }
      // network error or per-attempt timeout: back off and try again
    }

    const backoff = Math.random() * Math.min(2_000, 100 * 2 ** attempt); // full jitter, capped at 2 s
    await sleep(retryAfterMs ?? backoff, undefined, budget ? { signal: budget } : undefined);
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(seconds * 1_000, 10_000);
  const at = Date.parse(value);                                    // HTTP-date form
  return Number.isNaN(at) ? undefined : Math.max(0, Math.min(at - Date.now(), 10_000));
}
```
`src/http/budget.ts` — a deadline for the whole request that also fires when the client disconnects.
```ts
import type { Response } from 'express';

export function requestBudget(res: Response, ms: number): AbortSignal {
  const disconnected = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) disconnected.abort(new Error('client disconnected'));
  });
  return AbortSignal.any([disconnected.signal, AbortSignal.timeout(ms)]);
}
```
Using both in a route:
```ts
import { requestBudget } from '#src/http/budget.ts';
import { fetchJson } from '#src/http/fetch-json.ts';
import { NotFoundError } from '#src/http/errors.ts';

router.get('/orders/:id/shipping', async (req, res) => {
  const budget = requestBudget(res, 2_500);                        // the whole request: 2.5 s
  const order = await orders.findById(req.params.id);              // bounded by statement_timeout
  if (!order) throw new NotFoundError(`Order ${req.params.id} not found`);
  const tracking = await fetchJson<Tracking>(`${config.carrier.url}/track/${order.trackingId}`, {
    timeoutMs: 800,
    attempts: 2,
    budget,
  });
  res.json({ order: toOrderDTO(order), tracking });
});
```
`src/db.ts` — timeouts on the pool and on the server side.
```ts
import { Pool } from 'pg';
import { config } from '#src/config.ts';
import { logger } from '#src/logger.ts';

export const pool = new Pool({
  connectionString: config.db.url,
  max: 10,
  connectionTimeoutMillis: 3_000,              // waiting for a free connection (default: forever)
  idleTimeoutMillis: 30_000,
  statement_timeout: 5_000,                    // Postgres cancels queries running longer
  lock_timeout: 2_000,                         // don't queue behind a long lock
  idle_in_transaction_session_timeout: 30_000, // kill sessions that forgot to COMMIT
  application_name: 'api',
});
pool.on('error', (err) => logger.error({ err }, 'idle pg client error')); // without this, the process crashes
```
For a slow report, raise the limit only inside its transaction: `SET LOCAL statement_timeout = '60s'`.

## Production patterns
- **Every outgoing call has a timeout**, shorter than the caller's own timeout, and every request has a total budget.
- **Retries are rare, jittered, capped, and idempotent**, and happen at one layer only.
- **Postgres protects itself** with `statement_timeout`, `lock_timeout`, and `idle_in_transaction_session_timeout`, set per role or per connection.
- **Stop work for abandoned requests**: pass the request's signal down.
- **Timeouts line up across the chain**: client > ALB idle > server request timeout > downstream timeouts.

## Mistakes
Wrong: `fetch` with no timeout.
```ts
const res = await fetch(partnerUrl); // waits up to 300 s for headers when the partner hangs
```
Right: `fetch(partnerUrl, { signal: AbortSignal.timeout(2_000) })`, or the helper above.

Wrong: retrying immediately in a tight loop.
```ts
for (let i = 0; i < 5; i++) { try { return await call(); } catch {} } // 5 instant hits on a struggling service
```
Right: exponential backoff with full jitter, few attempts, and only for retryable errors.

Wrong: retrying `POST /payments` after a timeout. A timeout doesn't mean it failed. Right: send an idempotency key so the server can return the first result.

Wrong: a downstream timeout longer than the caller's. The API times out at 3 s while it waits 10 s for the partner, still holding resources. Right: downstream timeouts fit inside the caller's budget.

## Check yourself
1. Why is a slow dependency more dangerous than one that is down?
2. What is full jitter, and what problem does it solve?
3. Which failures should never be retried automatically?

<details>
<summary>Answers</summary>

1. A dependency that's down fails fast and frees resources. A slow one holds sockets, pool connections, and memory for every in-flight request, so the slowness spreads to unrelated endpoints until the whole service stalls.
2. Waiting a random time between 0 and the exponential backoff cap. Without it, all clients that failed together retry together, hitting the recovering service in synchronized waves.
3. Non-idempotent operations without an idempotency key (a retry may repeat a side effect), 4xx errors other than 408/429 (retrying won't change the answer), and requests whose caller has already given up (budget aborted).
</details>

## Sources
- [AWS Builders' Library — Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [AWS Architecture Blog — Exponential backoff and jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [MDN — `AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
- [PostgreSQL — Client connection defaults (`statement_timeout`, `lock_timeout`)](https://www.postgresql.org/docs/current/runtime-config-client.html)
- [node-postgres — Pool](https://node-postgres.com/apis/pool)
