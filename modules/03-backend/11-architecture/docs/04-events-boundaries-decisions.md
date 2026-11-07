---
title: Events, service boundaries, decisions, and enforcement
tech: Node.js 26, TypeScript, BullMQ, ESLint
version: Node.js 26 LTS, TypeScript 6.0, BullMQ 5, ESLint 10 (flat config), Vitest 4
date: 2026-11-07
covers: [8, 9, 10, 12]
---
# Events, service boundaries, decisions, and enforcement
[← Overview](00-overview.md)

## Why it matters
- `orders.checkout()` calls notifications, analytics, loyalty points, and the search indexer directly. Each new reaction edits checkout, and a slow analytics call slows every purchase.
- A team splits the app into eight services that share one database and call each other synchronously. Every deploy needs all eight; every outage spreads to all eight. It's a distributed monolith.
- Two years later nobody knows why payments run in a separate service, so nobody dares to touch the setup.

## Concepts

### Events between modules
| Kind | How | Use |
|:--|:--|:--|
| Direct call | `catalog.reserveStock(tx, lines)` | the caller needs the result now, inside its workflow |
| In-process event | handlers run in the same process and request | rare; their failures and latency hit the caller |
| **Outbox event → BullMQ** | event row in the business transaction; relay enqueues one job per subscriber | side effects that must happen: emails, webhooks, search index, analytics |

| Concept | Rule |
|:--|:--|
| Command vs event | command = "do X" (one handler); event = "X happened" (zero or more subscribers) |
| Naming | past tense, owned by the publisher: `order.paid`, `user.registered` |
| Payload | IDs plus a few stable facts; `eventId`, `occurredAt`, `version` |
| Subscribers | idempotent (dedupe on `eventId`), each in its own job so one failure doesn't block others |
| Direction | the publisher doesn't know its subscribers: orders never imports notifications |
| Cost | indirection and eventual consistency; tracing makes it debuggable ([10-observability](../../10-observability/README.md)) |

### Monolith or microservices
| | Modular monolith | Microservices |
|:--|:--|:--|
| Deployables | one API (+ workers from the same code) | many, independently deployed |
| Calls between parts | function calls | network calls that can fail and time out |
| Transactions | local ACID | sagas, eventual consistency |
| Debugging | one process, one log stream | distributed tracing required |
| Teams | works well up to several teams with module ownership | many autonomous teams |
| Operations | one pipeline, one dashboard | a pipeline, dashboards, alerts, and on-call per service |

Good reasons to extract a module into a service: very different **resource needs** (video transcoding next to a light API), very different **availability or scaling** needs, **isolation** for security or compliance (card data), or **team friction** around a shared deployable. Bad reasons: "cleaner code", "it's modern", résumé building.

The **distributed monolith** warning signs: services that must deploy together, share database tables, or call each other in synchronous chains. Running API and worker processes from one codebase is not microservices; it's one application with several process types.

**Strangler fig** for extraction: route one capability at a time to the new service (behind the same API), keep the old path until traffic has moved, then delete it.

### Recording decisions
Write an **ADR** for every decision that is expensive to reverse: module boundaries, adopting events, extracting a service, choosing a framework ([01-foundations/08-documentation lesson 02](../../../01-foundations/08-documentation/docs/02-decisions-runbooks-changelogs.md)). Context, decision, consequences, status. Superseded ADRs stay, marked as superseded.

### Enforcing boundaries
| Tool | Enforces |
|:--|:--|
| ESLint `no-restricted-imports` | cross-module imports only via `index.ts`; no Express, Drizzle, or SDKs in domain files |
| Architecture tests (Vitest) | no cycles between modules; fitness functions you write yourself |
| CODEOWNERS | module owners review changes to their module |
| Workspace packages with `exports` | hard boundaries in a monorepo (also seen) |
| eslint-plugin-boundaries, dependency-cruiser | richer layer rules and dependency graphs (also seen) |

## Example
`src/orders/orders.events.ts` — the contract other modules may subscribe to.
```ts
export type OrderPaid = {
  type: 'order.paid';
  version: 1;
  eventId: string;
  occurredAt: string;
  orderId: string;
  accountId: string;
};
```
`src/events/subscriptions.ts` — wiring lives outside the publisher: one job per subscriber.
```ts
import type { Deps } from '#src/deps.ts';
import type { OrderPaid } from '#src/orders/index.ts';
import { onOrderPaid as sendConfirmation } from '#src/notifications/index.ts';
import { onOrderPaid as awardPoints } from '#src/loyalty/index.ts';
import { onOrderPaid as reindexOrder } from '#src/search/index.ts';

type Handler<E> = (event: E, deps: Deps) => Promise<void>;

export const subscriptions: { 'order.paid': Record<string, Handler<OrderPaid>> } = {
  'order.paid': {
    'notifications.send-confirmation': sendConfirmation,
    'loyalty.award-points': awardPoints,
    'search.reindex-order': reindexOrder,
  },
};
// The outbox relay adds one BullMQ job per subscriber:
//   jobId `${eventId}-${subscriberName}` → retries and failures are per subscriber
```
`eslint.config.js` (excerpt) — boundaries as lint errors.
```js
const crossModule = {
  regex: '^#src/(?!shared/)[^/]+/(?!index\\.ts$).+',
  message: 'Import other modules through their index.ts.',
};

export default [
  // ...base configs (05-code-quality)
  {
    files: ['src/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [crossModule] }] },
  },
  {
    files: ['src/**/*.domain.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: ['express', 'drizzle-orm', 'pg', 'stripe', 'bullmq', 'redis'].map((name) => ({
          name,
          message: 'Domain code stays pure: no I/O libraries.',
        })),
        patterns: [crossModule, { regex: '^#src/shared/(db|redis|logger)', message: 'Domain code stays pure.' }],
      }],
    },
  },
];
```
The second block repeats `crossModule` because a later config object replaces the earlier rule options for the files it matches.

`test/architecture.test.ts` — a fitness function: modules must not depend on each other in cycles.
```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');
const NOT_MODULES = new Set(['shared', 'http', 'events', 'jobs']);
const modules = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !NOT_MODULES.has(d.name))
  .map((d) => d.name);

function dependenciesOf(mod: string): string[] {
  const deps = new Set<string>();
  for (const file of readdirSync(join(SRC, mod), { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.ts')) continue;
    for (const [, target] of readFileSync(join(SRC, mod, file), 'utf8').matchAll(/from '#src\/([^/']+)\//g)) {
      if (target && target !== mod && modules.includes(target)) deps.add(target);
    }
  }
  return [...deps];
}

test('modules have no dependency cycles', () => {
  const graph = new Map(modules.map((m) => [m, dependenciesOf(m)]));
  const done = new Set<string>();
  const findCycle = (mod: string, path: string[]): string[] | null => {
    if (path.includes(mod)) return [...path, mod];
    if (done.has(mod)) return null;
    for (const dep of graph.get(mod) ?? []) {
      const cycle = findCycle(dep, [...path, mod]);
      if (cycle) return cycle;
    }
    done.add(mod);
    return null;
  };
  for (const mod of modules) expect(findCycle(mod, [])?.join(' → ') ?? null).toBeNull();
});
```
`docs/adr/0007-extract-media-processing.md` — a good reason to split, written down.
```markdown
# 7. Extract media processing into its own service

- Status: accepted
- Date: 2026-11-07

## Context
Video transcoding needs 8 GB of memory and 4 vCPUs per job; the API needs 0.5 vCPU.
Running both from one deployable forces large, expensive API tasks and slows API deploys.

## Decision
Move the `media` module into a separate ECS service fed by the existing `media` BullMQ queue.
The API publishes `media.uploaded` through the outbox; the service publishes `media.processed`.

## Consequences
- Independent sizing and scaling; API deploys no longer wait for media tests.
- A second pipeline and dashboard; media events become a versioned contract.
```

## Production patterns
- **Direct calls for what the workflow needs now, outbox events for side effects**, one job per subscriber.
- **Versioned event contracts** owned by the publishing module, with `eventId` for idempotency.
- **Extract a service only with a concrete reason** recorded in an ADR, along an existing module boundary, using the strangler fig.
- **Boundaries enforced in CI**: lint rules for imports, an architecture test for cycles, CODEOWNERS for ownership.
- **ADRs for expensive decisions**, kept next to the code and superseded rather than deleted.

## Mistakes
Wrong: the publisher calls every reaction.
```ts
await notifications.sendConfirmation(order); // checkout now depends on notifications, analytics, loyalty…
await analytics.track('order_paid', order);
await loyalty.awardPoints(order);
```
Right: append `order.paid` to the outbox; subscribers react in their own jobs.

Wrong: services that share tables. A schema change in one breaks the others, and every deploy is coordinated. Right: each service owns its data and exposes an API or events.

Wrong: synchronous call chains (`A → B → C → D`). Availability multiplies down (four services at 99.9% give about 99.6%), and latency adds up. Right: fewer hops; events for anything that doesn't need an answer now.

Wrong: boundaries that exist only in a diagram. Six months later the imports go everywhere. Right: lint rules and tests that fail the build.

## Check yourself
1. When is a direct call between modules better than an event?
2. Name two good and two bad reasons to extract a microservice.
3. How do you stop module boundaries from eroding?

<details>
<summary>Answers</summary>

1. When the caller needs the result to continue its workflow (reserving stock during checkout, checking a price). Events fit side effects that may happen slightly later and that the publisher shouldn't know about (emails, indexing, analytics).
2. Good: very different resource or scaling needs (heavy media processing), isolation required for security or compliance, team friction around one shared deployable. Bad: "cleaner code", following a trend, splitting before the boundaries are understood.
3. Make violations fail the build: `no-restricted-imports` rules for cross-module and domain imports, an architecture test for cycles, CODEOWNERS on module folders, and ADRs that explain the boundaries so people know why they exist.
</details>

## Sources
- [Martin Fowler — What do you mean by "event-driven"?](https://martinfowler.com/articles/201701-event-driven.html)
- [Martin Fowler — Strangler fig application](https://martinfowler.com/bliki/StranglerFigApplication.html)
- [Martin Fowler — Microservice premium](https://martinfowler.com/bliki/MicroservicePremium.html)
- [Michael Nygard — Documenting architecture decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ESLint — `no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports)
