---
title: ESLint with type-aware rules
tech: ESLint, typescript-eslint, TypeScript 6
version: ESLint 10, typescript-eslint 8.6x, TypeScript 6.0
date: 2026-11-07
covers: [4, 5]
---
# ESLint with type-aware rules
[← Overview](00-overview.md)

## Why it matters
- `sendReceipt(order)` without `await` in a request handler: errors become unhandled rejections and receipts silently go missing. `no-floating-promises` flags it.
- `if (user.isAdmin)` where `isAdmin` is an async function: the promise is always truthy, so everyone is admin. `no-misused-promises` flags it.
- A new order status is added, and the shipping `switch` silently falls through to "do nothing". `switch-exhaustiveness-check` flags it.

## Concepts

### Flat config
ESLint 10 reads only `eslint.config.js` (or `.mjs`/`.ts`): an array of config objects applied in order. Later objects override earlier ones for the files they match.

| Key | Purpose |
|:--|:--|
| `files` / `ignores` | which files an object applies to |
| `globalIgnores([...])` | ignore paths everywhere (`dist/`, `coverage/`) |
| `extends` | include shared configs inside an object (`defineConfig` helper) |
| `languageOptions` | parser, globals, `parserOptions` |
| `rules` | `'off'` / `'warn'` / `'error'`, with options |
| `linterOptions.reportUnusedDisableDirectives` | flag `eslint-disable` comments that no longer suppress anything |

### Type-aware linting
Normal lint rules see only syntax. typescript-eslint's **type-checked** rules ask the TypeScript compiler about types, so they can tell that a value is a Promise, `any`, or a union. `projectService: true` lets typescript-eslint find the right `tsconfig.json` for each file.

| Preset | Contents |
|:--|:--|
| `recommended` | syntax-only rules, low noise |
| `recommendedTypeChecked` | + type-aware bug rules |
| `strictTypeChecked` | + stricter opinionated rules (good for new projects) |
| `stylisticTypeChecked` | consistent style choices (no formatting) |
| `disableTypeChecked` | turn type-aware rules off, e.g. for plain JS config files |

### Rules that prevent real bugs
| Rule | Catches |
|:--|:--|
| `@typescript-eslint/no-floating-promises` | promises nobody awaits or handles |
| `@typescript-eslint/no-misused-promises` | promises in `if`, or async callbacks where void is expected (`forEach`, event handlers) |
| `@typescript-eslint/await-thenable` | `await` on a non-promise |
| `@typescript-eslint/switch-exhaustiveness-check` | `switch` missing union members |
| `@typescript-eslint/no-unsafe-*` (assignment, call, member-access, return, argument) | `any` leaking into typed code |
| `@typescript-eslint/no-unnecessary-condition` | conditions that are always true/false by type |
| `@typescript-eslint/restrict-template-expressions` | `${obj}` printing `[object Object]` |
| `@typescript-eslint/only-throw-error` | throwing strings or plain objects |
| `@typescript-eslint/prefer-nullish-coalescing` | `\|\|` swallowing `0` and `''` |
| `@typescript-eslint/no-unused-vars` | dead variables and imports |
| `@typescript-eslint/consistent-type-imports` | `import type` for types (pairs with `verbatimModuleSyntax`) |
| `eqeqeq`, `no-console` (server code uses a logger) | coercion bugs, stray logs |

## Example
```bash
pnpm add -D eslint @eslint/js typescript-eslint eslint-config-prettier globals
```
`eslint.config.js`
```js
// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', 'coverage/', 'reviews/']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked], // config files aren't in tsconfig
  },
  {
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' }, // tests may assert presence
  },
  prettier, // last: turns off any rule that would fight Prettier
);
```
What it catches, `src/handlers.ts`:
```ts
app.post('/orders', async (req, res) => {
  const order = await createOrder(req.body);
  sendReceipt(order);            // error: no-floating-promises
  if (isFraudulent(order)) {     // error: no-misused-promises (isFraudulent is async)
    flag(order);
  }
  res.status(201).json(order);
});
```
Fixed:
```ts
app.post('/orders', async (req, res) => {
  const order = await createOrder(req.body);
  if (await isFraudulent(order)) await flag(order);
  void sendReceipt(order).catch((err: unknown) => logger.error({ err }, 'receipt failed')); // explicit fire-and-forget
  res.status(201).json(order);
});
```
`pnpm eslint .` to check, `pnpm eslint . --fix` to apply safe fixes. Inspect the resolved config with `pnpm eslint --inspect-config`.

## Production patterns
- **Type-checked presets in new projects**; `recommendedTypeChecked` first when adopting in a big codebase, then tighten.
- **Errors, not warnings.** Warnings are ignored; either a rule matters (error) or it doesn't (off).
- **`reportUnusedDisableDirectives: 'error'`** so stale suppressions get cleaned up.
- **Turn off formatting rules with `eslint-config-prettier`** and let Prettier own layout.
- **Each disable comment carries a reason**: `// eslint-disable-next-line no-console -- CLI output`.
- **Keep lint fast:** `--cache` locally and in CI; type-aware linting costs about one `tsc` run.

## Mistakes
Wrong: fire-and-forget without saying so.
```ts
sendReceipt(order); // rejection becomes an unhandled rejection, may crash the process
```
Right:
```ts
await sendReceipt(order);
// or, when you truly don't want to wait:
void sendReceipt(order).catch((err: unknown) => logger.error({ err }, 'receipt failed'));
```

Wrong: async callback in `forEach`.
```ts
orders.forEach(async (o) => { await ship(o); }); // forEach doesn't wait; errors escape
```
Right:
```ts
for (const o of orders) await ship(o);           // sequential
await Promise.all(orders.map((o) => ship(o)));   // parallel
```

Wrong: blanket disables.
```ts
/* eslint-disable */
```
Right: disable one rule on one line, with a reason after `--`.

Wrong: copying an old `.eslintrc.json`. ESLint 10 ignores it entirely and lints with no rules.
Right: `npx @eslint/migrate-config .eslintrc.json`, then review the generated `eslint.config.js`.

## Check yourself
1. Why can't plain ESLint (without types) detect a floating promise reliably?
2. When should you start with `recommendedTypeChecked` rather than `strictTypeChecked`?
3. What does `eslint-config-prettier` do, and why put it last?

<details>
<summary>Answers</summary>

1. From syntax alone, `sendReceipt(order)` is just a call. Only the type checker knows it returns a Promise.
2. When adding linting to an existing large codebase: it finds real bugs with little noise. Move to strict once the backlog is clean.
3. It turns off rules that conflict with Prettier's formatting. Configs later in the array override earlier ones, so placing it last guarantees nothing re-enables those rules.
</details>

## Sources
- [typescript-eslint — Linting with type information](https://typescript-eslint.io/getting-started/typed-linting)
- [typescript-eslint — Shared configs](https://typescript-eslint.io/users/configs)
- [typescript-eslint — `no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises/)
- [ESLint — Configuration files](https://eslint.org/docs/latest/use/configure/configuration-files)
- [ESLint — Migrate to flat config](https://eslint.org/docs/latest/use/configure/migration-guide)
- [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier)
