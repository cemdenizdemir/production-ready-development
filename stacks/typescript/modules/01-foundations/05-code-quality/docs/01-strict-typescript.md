---
title: Strict TypeScript and safe boundaries
tech: TypeScript 6 (strict), Zod 4
version: TypeScript 6.0, Node.js 26 LTS
date: 2026-11-07
covers: [1, 2, 3]
---
# Strict TypeScript and safe boundaries
[← Overview](00-overview.md)

## Why it matters
- `user.address.city` crashes in production with "Cannot read properties of undefined". With `strictNullChecks`, the compiler would have refused to build.
- `items[0].price` compiles, but the array is empty for new customers. `noUncheckedIndexedAccess` makes you handle it.
- A webhook body typed as `any` flows through ten functions. One renamed field later, wrong data is saved silently.

## Concepts

### Why tooling at all
| Tool | Catches | Cost |
|:--|:--|:--|
| Types | impossible states, typos, missing cases, null access | annotations at boundaries |
| Linting | legal but risky code, conventions | config once, occasional suppressions |
| Formatting | nothing; removes a whole category of review comments | zero after setup |

### What `strict` turns on
| Flag | Catches |
|:--|:--|
| `strictNullChecks` | using a value that may be `null` or `undefined` |
| `noImplicitAny` | parameters and variables silently typed `any` |
| `strictFunctionTypes` | unsafe function parameter variance (callbacks) |
| `strictBindCallApply` | wrong arguments to `bind`, `call`, `apply` |
| `strictPropertyInitialization` | class fields never assigned |
| `useUnknownInCatchVariables` | `catch (e)` is `unknown`, not `any` |
| `noImplicitThis` / `alwaysStrict` | untyped `this`; emit `"use strict"` |
| `strictBuiltinIteratorReturn` | built-in iterators return `undefined`, not `any` |

### Worth adding on top
| Flag | Catches |
|:--|:--|
| `noUncheckedIndexedAccess` | `arr[i]` and `record[key]` may be `undefined` |
| `exactOptionalPropertyTypes` | `{ a?: string }` doesn't accept an explicit `undefined` |
| `noImplicitOverride` | subclass methods must say `override` |
| `noImplicitReturns` / `noFallthroughCasesInSwitch` | paths that forget to return or `break` |
| `verbatimModuleSyntax` | type-only imports must use `import type` |
| `erasableSyntaxOnly` | `enum`, `namespace`, parameter properties (Node can't strip them) |

### Safe boundaries
Types are only true inside your program. At every boundary (HTTP bodies, env vars, JSON files, third-party responses, `JSON.parse`), data is `unknown` until validated at runtime.

| Tool | Use |
|:--|:--|
| `unknown` | "I don't know yet": forces narrowing before use |
| Narrowing | `typeof`, `in`, `Array.isArray`, `instanceof`, discriminant checks |
| Type predicates | `function isUser(x: unknown): x is User` |
| Zod schemas | validate and infer the type from one source (`z.infer`) |
| `satisfies` | check a value against a type without widening it |
| `as const` | literal types for config and lookup tables |
| `never` in a default branch | compile error when a union gains a case |

## Example
`tsconfig.json` for a Node 26 service that runs `.ts` directly and type-checks with `tsc`:
```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```
`src/webhook.ts` — `unknown` at the edge, validated once, typed after.
```ts
import { z } from 'zod';

const OrderPaid = z.object({
  type: z.literal('order.paid'),
  orderId: z.string().uuid(),
  amountCents: z.number().int().positive(),
});
const OrderRefunded = z.object({
  type: z.literal('order.refunded'),
  orderId: z.string().uuid(),
  reason: z.string().max(500),
});
const WebhookEvent = z.discriminatedUnion('type', [OrderPaid, OrderRefunded]);
type WebhookEvent = z.infer<typeof WebhookEvent>;

export function parseWebhook(body: unknown): WebhookEvent {
  return WebhookEvent.parse(body); // throws a ZodError with every problem listed
}

export function describe(event: WebhookEvent): string {
  switch (event.type) {
    case 'order.paid':
      return `Paid ${event.amountCents} for ${event.orderId}`; // narrowed: amountCents exists
    case 'order.refunded':
      return `Refunded ${event.orderId}: ${event.reason}`;
    default: {
      const unhandled: never = event; // adding a third event type breaks the build here
      throw new Error(`Unhandled event: ${JSON.stringify(unhandled)}`);
    }
  }
}

const retryPolicy = { attempts: 3, backoff: 'exponential' } as const satisfies {
  attempts: number;
  backoff: 'fixed' | 'exponential';
}; // checked against the type, but keeps the literal 'exponential'
```
Run the check: `pnpm tsc` (with `noEmit`, it only type-checks).

## Production patterns
- **Turn on strict from day one.** Retrofitting it later means thousands of errors.
- **Validate at the edges, trust inside.** One schema per boundary; internal functions take typed values.
- **Derive types from schemas** (`z.infer`) or from code, so the type and the runtime check can't drift apart.
- **Model states as discriminated unions** instead of objects full of optional fields: `{ status: 'paid'; paidAt: Date } | { status: 'pending' }`.
- **Exhaustive `switch` with `never`** (and the lint rule in lesson 02) so new cases can't be forgotten.

## Mistakes
Wrong: `any` from `JSON.parse` flows everywhere.
```ts
const config = JSON.parse(raw); // any: every property access compiles
startServer(config.port);
```
Right:
```ts
const config = z.object({ port: z.coerce.number().int() }).parse(JSON.parse(raw));
```

Wrong: casting to silence the compiler.
```ts
const user = req.body as User; // a claim, not a check
```
Right: parse with a schema; a cast is only acceptable when you have checked the shape yourself.

Wrong: non-null assertions as a habit.
```ts
const first = orders[0]!.total; // crashes on an empty list
```
Right:
```ts
const first = orders[0];
if (!first) return 0;
return first.total;
```

Wrong: `enum` in code Node runs directly. Node's type stripping can't erase it, so the file fails to load.
Right: a union of literals: `type Role = 'member' | 'admin'`, or an `as const` object.

## Check yourself
1. What does `noUncheckedIndexedAccess` change about `const x = list[0]`?
2. Why is `satisfies` often better than a type annotation for config objects?
3. Where should runtime validation happen, and why not everywhere?

<details>
<summary>Answers</summary>

1. `x` becomes `T | undefined`, so you must handle the empty case before using it.
2. It checks the value against the type but keeps the narrower inferred type (literals, exact keys), so later code gets precise types and autocomplete.
3. At trust boundaries: incoming requests, env vars, files, external APIs, the database for loosely typed columns. Inside the program, types already guarantee the shape; validating again costs time and duplicates logic.
</details>

## Sources
- [TypeScript — `strict`](https://www.typescriptlang.org/tsconfig/#strict)
- [TypeScript — `noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess)
- [TypeScript — Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript 5.8 — `erasableSyntaxOnly`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html)
- [Zod 4 documentation](https://zod.dev/)
