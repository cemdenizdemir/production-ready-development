---
title: Streams, built-ins, memory, and runtime security
tech: Node.js 26, TypeScript 6, pg
version: Node.js 26 LTS, V8 14.6
date: 2026-11-07
covers: [6, 7, 9, 12]
---
# Streams, built-ins, memory, and runtime security
[← Overview](00-overview.md)

## Why it matters
- A CSV export loads 2 million rows into an array before sending; the container hits its 1 GB limit and is OOM-killed (exit 137) every time a big customer exports.
- A leak in an in-memory cache grows memory 50 MB per hour; the service restarts nightly and nobody knows why.
- A dependency adds a `postinstall` script that reads `~/.aws/credentials`; with Node's permission model the process couldn't have read it.

## Concepts

### Streams and backpressure
| Stream type | Example |
|:--|:--|
| Readable | file read, HTTP request body, DB cursor |
| Writable | HTTP response, file write, S3 upload |
| Transform | gzip, CSV formatting, JSON lines |
| Duplex | TCP socket |

**Backpressure:** a fast producer must slow down when the consumer is slow. `writable.write()` returns `false` when the buffer is full; you wait for `'drain'`. `pipeline()` from `node:stream/promises` handles backpressure, errors, and cleanup for you. Async iteration (`for await (const chunk of readable)`) also respects backpressure.

Web Streams (`ReadableStream`, used by `fetch`) convert with `Readable.fromWeb()` / `Readable.toWeb()`.

### Built-ins worth knowing
| Module / global | Use |
|:--|:--|
| `node:fs/promises` | async file system |
| `node:crypto` | `randomUUID`, `randomBytes`, `createHash`, `createHmac`, `timingSafeEqual`, `scrypt`; `crypto.subtle` (Web Crypto) |
| `node:stream/promises` | `pipeline`, `finished` |
| `node:timers/promises` | `setTimeout`, `setInterval` as promises with `AbortSignal` |
| `node:events` | `once`, `on` (async iterator) |
| `node:util` | `parseArgs`, `styleText`, `promisify`, `inspect`, `types`, `parseEnv` |
| `node:async_hooks` `AsyncLocalStorage` | request-scoped context (request ID, user) without passing it everywhere |
| `node:worker_threads` | CPU work in parallel |
| `node:child_process` | `execFile`/`spawn` external programs |
| `node:test` + `node:assert` | built-in test runner (also seen; Vitest is the stack's runner) |
| `node:sqlite` | embedded SQLite (`DatabaseSync`) for tools and tests |
| `node:zlib` | gzip, brotli |
| Globals | `fetch`, `WebSocket`, `URLPattern`, `Temporal`, `structuredClone`, `AbortController`, `navigator` |

### Memory
| Concept | What to know |
|:--|:--|
| V8 heap | young generation (short-lived) + old generation; garbage collected |
| `process.memoryUsage()` | `rss` (total), `heapUsed`, `heapTotal`, `external` (buffers) |
| Heap limit | `--max-old-space-size=<MB>`; set it explicitly to ~75% of the container's memory limit |
| OOM kill | container exceeds its limit → SIGKILL, exit code 137 |
| Leaks | unbounded caches/maps, listeners never removed, timers, closures holding big objects, global arrays |
| Finding leaks | heap snapshots taken minutes apart (`--heapsnapshot-signal`, `v8.writeHeapSnapshot()`), compare in DevTools "Comparison" view |
| `--heapsnapshot-near-heap-limit=2` | write snapshots automatically before an OOM |

### Runtime security
| Feature | Effect |
|:--|:--|
| Permission model `--permission` | deny file system, child processes, workers, native addons by default |
| `--allow-fs-read=/app`, `--allow-fs-write=/tmp` | allow specific paths |
| `--allow-child-process`, `--allow-worker` | opt in |
| `--disallow-code-generation-from-strings` | blocks `eval` and `new Function` |
| `--disable-proto=throw` | blocks `__proto__` (prototype pollution) |
| Patch promptly | Node security releases fix HTTP parser and TLS issues |
| Non-root user, read-only filesystem in containers | limit damage ([04-shipping/01-containers](../../../04-shipping/01-containers/README.md)) |

## Example
`exports.ts` — stream a large CSV from Postgres to the client with constant memory.
```ts
import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { createGzip } from 'node:zlib';
import QueryStream from 'pg-query-stream';
import { pool } from '#src/db.ts';

export async function exportOrders(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    const rows = client.query(new QueryStream(
      'SELECT id, created_at, total_cents FROM orders WHERE account_id = $1 ORDER BY created_at',
      [req.user!.accountId],
      { batchSize: 1000 },
    ));
    const HEADER = 'id,created_at,total_cents\n';
    let headerSent = false;
    const toCsv = new Transform({
      objectMode: true,
      transform(row: { id: string; created_at: Date; total_cents: number }, _enc, done) {
        const prefix = headerSent ? '' : HEADER;            // header goes through the same gzip stream
        headerSent = true;
        done(null, `${prefix}${row.id},${row.created_at.toISOString()},${row.total_cents}\n`);
      },
      flush(done) {
        if (!headerSent) this.push(HEADER);                 // empty export still gets a header row
        done();
      },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');

    await pipeline(rows, toCsv, createGzip(), res, { signal: AbortSignal.timeout(10 * 60_000) }); // backpressure + cleanup
  } finally {
    client.release();
  }
}
```
Memory stays flat no matter how many rows: the cursor fetches 1,000 rows at a time and only reads more when the client has consumed what was sent.

`context.ts` — request context with `AsyncLocalStorage`.
```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

type Ctx = { requestId: string; userId?: string };
export const requestContext = new AsyncLocalStorage<Ctx>();

export function contextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const requestId = req.get('x-request-id') ?? randomUUID();
  requestContext.run({ requestId }, next);      // everything in this request sees the context
}

export const currentRequestId = () => requestContext.getStore()?.requestId;
```
Container-friendly start command with an explicit heap limit and permissions:
```dockerfile
# 1 GB container memory limit → ~750 MB heap
CMD ["node", "--max-old-space-size=750", "--heapsnapshot-signal=SIGUSR2", \
     "--permission", "--allow-fs-read=/app", "--allow-fs-write=/tmp", "src/server.ts"]
```
Test permission flags in staging first: some dependencies read unexpected paths or spawn processes.

## Production patterns
- **Stream large data** (exports, uploads, proxies) with `pipeline`; never buffer unbounded data in memory.
- **Bounded caches only** (max entries + TTL); no global arrays that grow per request.
- **Explicit heap limits** sized to the container, plus memory metrics and alerts; heap snapshots on demand.
- **`AsyncLocalStorage` for request IDs** in logs and traces ([10-observability](../../10-observability/README.md)).
- **Least privilege at runtime**: non-root, read-only filesystem, and the permission model where dependencies allow it.

## Mistakes
Wrong: buffering everything.
```ts
const { rows } = await pool.query('SELECT * FROM orders'); // 2M rows in memory
res.send(toCsv(rows));
```
Right: a cursor/stream through `pipeline`.

Wrong: `readable.pipe(writable)` without error handling; a failed source leaves the destination open and leaks resources.
Right: `await pipeline(readable, writable)`.

Wrong: an unbounded memoization map.
```ts
const cache = new Map<string, Result>(); // grows forever with user input keys
```
Right: an LRU with a max size and TTL, or Redis ([06-caching](../../06-caching/README.md)).

Wrong: no heap limit in a small container; V8 picks a default that doesn't match the cgroup limit, and the kernel kills the process instead of V8 collecting garbage harder.
Right: `--max-old-space-size` at ~75% of the container limit.

## Check yourself
1. What is backpressure, and which API handles it for you?
2. What does exit code 137 usually mean for a container?
3. What problem does `AsyncLocalStorage` solve?

<details>
<summary>Answers</summary>

1. Slowing a fast producer when the consumer can't keep up, so memory doesn't fill with buffered data. `pipeline()` (and async iteration) handles it, plus error propagation and cleanup.
2. The process was killed with SIGKILL (128 + 9), most often by the kernel's OOM killer because the container exceeded its memory limit.
3. Carrying request-scoped data (request ID, user ID) through async calls without passing it as a parameter everywhere, so logs and traces from deep in the call stack can include it.
</details>

## Sources
- [Node.js — Stream API](https://nodejs.org/api/stream.html)
- [Node.js — Backpressuring in streams](https://nodejs.org/en/learn/modules/backpressuring-in-streams)
- [Node.js — AsyncLocalStorage](https://nodejs.org/api/async_context.html)
- [Node.js — Permissions](https://nodejs.org/api/permissions.html)
- [Node.js — Memory diagnostics](https://nodejs.org/en/learn/diagnostics/memory)
- [pg-query-stream](https://github.com/brianc/node-postgres/tree/master/packages/pg-query-stream)
