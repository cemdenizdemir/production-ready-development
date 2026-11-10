---
title: The event loop, promises, async/await, and errors
tech: JavaScript, TypeScript
version: ECMAScript 2025
date: 2026-11-09
covers: [3, 4, 7]
---
# The event loop, promises, async/await, and errors
[← Overview](00-overview.md)

## Why it matters
- A filter computes 50,000 product combinations synchronously on each keystroke; the page freezes, and INP fails.
- Four API calls are awaited one after another; the dashboard takes 1.6 s instead of 400 ms.
- A user types quickly in a search box; responses come back out of order and the results show an older query.
- A rejected promise nobody awaited logs "Uncaught (in promise)" and the UI shows nothing.

## Concepts

### The event loop in practice
| Queue | Contains | Runs |
|:--|:--|:--|
| call stack | current synchronous code | to completion; nothing interrupts it |
| microtasks | promise reactions, `await` continuations, `queueMicrotask` | all of them, after each task |
| rendering | style, layout, paint (~every 16 ms when needed) | between tasks |
| tasks | events, `setTimeout`, network callbacks, `MessageChannel` | one per loop turn |

Consequences: long synchronous work blocks input and painting; a promise chain that never ends can starve rendering; `await` always yields at least to the microtask queue. Break long work into chunks (`scheduler.yield()` where available, `setTimeout(0)`), or move it to a Web Worker.

### Promises and async/await
| Combinator | Resolves when | C# equivalent |
|:--|:--|:--|
| ⭐ `Promise.all([a, b])` | all fulfil (rejects on first rejection) | `Task.WhenAll` |
| `Promise.allSettled` | all settle; gives each result | `WhenAll` + inspect each task |
| `Promise.any` | first fulfils (AggregateError if all fail) | — |
| `Promise.race` | first settles | `Task.WhenAny` |
| `Promise.withResolvers()` | create promise + resolve/reject | `TaskCompletionSource` |
| `Promise.try(fn)` | run sync-or-async function as a promise | |

Start independent work first, then await:
```ts
const [order, shipments] = await Promise.all([getOrder(id, { signal }), getShipments(id, { signal })]);
```

### Cancellation with AbortController
`AbortController`/`AbortSignal` is JavaScript's `CancellationTokenSource`/`CancellationToken`.
| API | Use |
|:--|:--|
| `new AbortController()` + `controller.abort()` | cancel your own work |
| `fetch(url, { signal })` | cancel requests |
| `AbortSignal.timeout(5000)` | deadline |
| `AbortSignal.any([a, b])` | either cancels |
| `signal.throwIfAborted()` | check in loops |
| `addEventListener(…, { signal })` | remove listeners on abort |

TanStack Query passes a `signal` to query functions and aborts superseded requests automatically (05-state-management).

### Errors
```ts
export class ApiError extends Error {
  constructor(public status: number, public problem: ProblemDetails, options?: ErrorOptions) {
    super(problem.title ?? `HTTP ${status}`, options);
    this.name = "ApiError";
  }
}
throw new ApiError(409, problem, { cause: originalError });
```
| Item | Note |
|:--|:--|
| `Error` subclasses with `name` | distinguish error kinds (`instanceof`) |
| `cause` | keep the original error |
| `AggregateError` | several errors (`Promise.any`) |
| `try/catch` around `await` | catches async rejections |
| unhandled rejections | `window.addEventListener("unhandledrejection", …)`; Sentry captures them |
| `catch (e: unknown)` | TypeScript: narrow before use |
| `finally` | cleanup (spinners) |

ASP.NET Core returns errors as Problem Details (`application/problem+json`). Turn them into a typed `ApiError` in one place: the fetch wrapper Orval uses (05-state-management).

## Example
`web/src/api/fetcher.ts`
```ts
export type ProblemDetails = { type?: string; title?: string; status?: number; detail?: string; code?: string;
  errors?: Record<string, string[]> };

export async function apiFetch<T>(input: string, init: RequestInit = {}): Promise<T> {
  const signal = AbortSignal.any([init.signal ?? new AbortController().signal, AbortSignal.timeout(10_000)]);
  const res = await fetch(`/api${input}`, { ...init, signal, credentials: "include",
    headers: { Accept: "application/json", ...init.headers } });

  if (!res.ok) {
    const problem: ProblemDetails = res.headers.get("content-type")?.includes("problem+json")
      ? await res.json()
      : { title: res.statusText, status: res.status };
    throw new ApiError(res.status, problem);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
```
Latest-wins search:
```ts
let current: AbortController | undefined;
export async function search(q: string) {
  current?.abort();                         // cancel the previous request
  current = new AbortController();
  return apiFetch<Product[]>(`/products?q=${encodeURIComponent(q)}`, { signal: current.signal });
}
```

## Production patterns
- Independent requests in parallel (`Promise.all`); dependent ones in sequence.
- Every network call has a deadline (`AbortSignal.timeout`) and is cancellable.
- One fetch wrapper maps HTTP errors and Problem Details to typed errors; UI code never parses responses itself.
- Report unhandled rejections (Sentry); treat them as bugs.

## Mistakes
Wrong: sequential awaits for independent data.
```ts
const order = await getOrder(id);
const user = await getUser(userId);
```
Right: `const [order, user] = await Promise.all([getOrder(id), getUser(userId)]);`

Wrong: `forEach` with async callbacks.
```ts
items.forEach(async (i) => await save(i));   // nobody awaits these
```
Right: `await Promise.all(items.map(save))` (or a `for…of` loop with `await` for sequential).

## Check yourself
1. Does a `.then()` callback run before or after a `setTimeout(fn, 0)` scheduled earlier?
2. What happens to `Promise.all` if one promise rejects?
3. Which browser API is the equivalent of a C# `CancellationToken`?

<details><summary>Answers</summary>

1. Before: promise reactions are microtasks, drained before the next task (the timer).
2. It rejects immediately with that reason; the other promises keep running but their results are ignored.
3. `AbortSignal` (created by an `AbortController`).
</details>

## Sources
- [MDN — Using promises](https://developer.mozilla.org/docs/Web/JavaScript/Guide/Using_promises)
- [MDN — AbortController](https://developer.mozilla.org/docs/Web/API/AbortController)
- [MDN — Error cause](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)
- [web.dev — Optimize long tasks](https://web.dev/articles/optimize-long-tasks)
- [Jake Archibald — Tasks, microtasks, queues and schedules](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/)
