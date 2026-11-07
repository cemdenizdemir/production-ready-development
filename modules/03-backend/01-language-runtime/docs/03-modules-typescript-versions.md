---
title: Modules, TypeScript on Node, and release lines
tech: Node.js 26, TypeScript 6
version: Node.js 26 LTS, TypeScript 6.0
date: 2026-11-07
covers: [4, 5, 11]
---
# Modules, TypeScript on Node, and release lines
[← Overview](00-overview.md)

## Why it matters
- A service imports `./db` without an extension. It works with a bundler, then fails in production with `ERR_MODULE_NOT_FOUND` when run by Node directly.
- An `enum` added to a shared file makes Node refuse to start: type stripping can't erase it.
- A team stays on Node 20 past end of life; a security release ships for 22 and 24 but not 20, and the audit fails.

## Concepts

### ESM and CommonJS
| | ES modules | CommonJS |
|:--|:--|:--|
| Syntax | `import` / `export` | `require` / `module.exports` |
| Enabled by | `"type": "module"` in package.json, or `.mjs` | default for `.js` without `"type"`, or `.cjs` |
| Loading | async, static analysis, top-level await | sync |
| `__dirname` | `import.meta.dirname` (Node 20.11+) | built in |
| Interop | `import cjs from './x.cjs'` works | `require(esm)` works for ESM without top-level await (Node 20.19+/22.12+) |

Use ESM for new code. Relative imports need the full file name with extension (`./db.ts`, `./db.js`).

### package.json `exports` and `imports`
| Field | Use |
|:--|:--|
| `exports` | the public entry points of a package; blocks deep imports of internals; conditions `types`, `import`, `require`, `default` |
| `imports` | private aliases starting with `#`, resolved by Node at runtime: `"#src/*": "./src/*"` |
| `engines` | supported Node range |
| `packageManager` | exact pnpm version |

`imports` replaces TypeScript `paths` aliases for code Node runs directly: Node resolves `#src/db.ts`, and TypeScript understands it too.

### TypeScript on Node 26
Node **strips** type annotations and runs the remaining JavaScript. It does not type-check, transform, or read `tsconfig.json`.

| Works | Doesn't (without extra flags) |
|:--|:--|
| annotations, interfaces, type aliases, generics | `enum`, `const enum` |
| `import type` / `export type` | `namespace` with runtime code |
| `satisfies`, `as`, non-null `!` | parameter properties (`constructor(private db: Db)`) |
| `.ts` imports with extensions | `import x = require()`, legacy decorators |
| `#imports` aliases | tsconfig `paths` (Node ignores tsconfig) |

Set `erasableSyntaxOnly` and `verbatimModuleSyntax` in tsconfig so the editor and `tsc` reject what Node can't run. Type-check with `tsc --noEmit` in CI.

When to compile anyway (`tsc` emit, `rewriteRelativeImportExtensions`): publishing libraries (consumers need `.js` + `.d.ts`), supporting older Node versions, or bundling for size/startup (serverless). also seen: `tsx` (dev runner with full TS support).

### Node release lines
| Line | Meaning |
|:--|:--|
| Current | newest major, 6 months before an even major becomes LTS |
| Active LTS | even majors from October; recommended for production |
| Maintenance LTS | security and critical fixes only |
| End of life | no fixes at all: upgrade |

Status in November 2026: **Node 26** active LTS (to April 2029), **24** and **22** maintenance, **20** end of life (April 2026). From Node 27, one major per year. Pin the version per repo (`.nvmrc`, `engines`, Docker base image) and upgrade on a schedule; version managers: fnm, nvm, mise.

## Example
`package.json`
```json
{
  "name": "@acme/api",
  "type": "module",
  "packageManager": "pnpm@10.18.0",
  "engines": { "node": ">=26" },
  "imports": {
    "#src/*": "./src/*"
  },
  "scripts": {
    "dev": "node --watch --env-file-if-exists=.env src/server.ts",
    "start": "node src/server.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```
`tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
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
`src/orders/service.ts` — erasable TypeScript only.
```ts
import type { Pool } from 'pg';                       // type-only import: erased
import { logger } from '#src/logger.ts';               // runtime alias via package.json "imports"

export const OrderStatus = { Pending: 'pending', Paid: 'paid' } as const; // instead of enum
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export class OrderService {
  readonly #db: Pool;                                  // field instead of a parameter property
  constructor(db: Pool) {
    this.#db = db;
  }

  async markPaid(id: string): Promise<void> {
    await this.#db.query('UPDATE orders SET status = $1 WHERE id = $2', [OrderStatus.Paid, id]);
    logger.info({ id }, 'order paid');
  }
}
```
`.nvmrc`
```text
26
```

## Production patterns
- **ESM everywhere, explicit `.ts` extensions, `#` imports for aliases.**
- **Run `.ts` directly with Node 26** in dev and production for services; `tsc --noEmit` in CI catches type errors.
- **`erasableSyntaxOnly` on**, so unsupported syntax fails in the editor, not at startup.
- **Pin Node in one place per artifact** (`.nvmrc` for dev, Docker base image tag for prod, `engines` for tooling) and upgrade to each new LTS within a few months.
- **Subscribe to Node security releases**; patch within days.

## Mistakes
Wrong: extensionless relative imports in ESM.
```ts
import { pool } from './db'; // ERR_MODULE_NOT_FOUND at runtime
```
Right: `import { pool } from './db.ts';` (or `#src/db.ts`).

Wrong: TypeScript `paths` aliases with native type stripping. Node doesn't read tsconfig, so `@/db` fails at runtime.
Right: package.json `imports` (`#src/*`).

Wrong: parameter properties and enums in Node-run code.
```ts
constructor(private readonly db: Pool) {} // not erasable
```
Right: declare the field and assign it in the constructor.

Wrong: running an end-of-life Node in production "because it works". Right: active or maintenance LTS only, with a planned upgrade path.

## Check yourself
1. What does Node 26 do with a `.ts` file, and what doesn't it do?
2. Why use package.json `imports` instead of tsconfig `paths`?
3. Which Node versions are suitable for production in November 2026?

<details>
<summary>Answers</summary>

1. It removes type annotations and runs the JavaScript. It doesn't type-check, doesn't read tsconfig, and doesn't transform non-erasable syntax like enums or parameter properties.
2. Node resolves `imports` at runtime (and TypeScript understands them); tsconfig `paths` only exist at compile time, so code run directly by Node can't resolve them.
3. Node 26 (active LTS), and Node 24 or 22 (maintenance LTS) while you plan upgrades. Node 20 and older are end of life.
</details>

## Sources
- [Node.js — Modules: packages (`exports`, `imports`)](https://nodejs.org/api/packages.html)
- [Node.js — Modules: ECMAScript modules](https://nodejs.org/api/esm.html)
- [Node.js — TypeScript (type stripping)](https://nodejs.org/api/typescript.html)
- [TypeScript 5.8 — `erasableSyntaxOnly`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html)
- [Node.js — Release schedule](https://github.com/nodejs/release#release-schedule)
