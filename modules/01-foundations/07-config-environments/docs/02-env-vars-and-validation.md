---
title: Env vars and validated config in Node 26
tech: Node.js 26 (--env-file), Zod 4, TypeScript
version: Node.js 26 LTS, Zod 4.4
date: 2026-11-07
covers: [3, 4, 5, 6]
---
# Env vars and validated config in Node 26
[← Overview](00-overview.md)

## Why it matters
- `PORT` is `"3000"`, a string. `PORT + 1` is `"30001"`, and the health check probes the wrong port.
- `ENABLE_BILLING=false` turns billing **on**, because `"false"` is a truthy string.
- A typo in `DATABSE_URL` isn't noticed until the first query, minutes after the deploy "succeeded" and the old version was already gone.

## Concepts

### Loading env files in Node 26
| API | Use |
|:--|:--|
| `node --env-file=.env app.ts` | load a file before the app starts |
| several `--env-file` flags | later files override earlier ones |
| `--env-file-if-exists=.env` | don't fail when the file is missing (CI, containers) |
| `process.loadEnvFile('.env')` | load from code |
| `util.parseEnv(text)` | parse dotenv text into an object |

Rules: variables already set in the real environment win over file values; `#` starts a comment; quoted values may span lines; there is no `${VAR}` expansion. also seen: `dotenv`, `dotenvx`.

In containers and the cloud there is no `.env` file: the platform sets real environment variables (ECS task definition, GitHub environment).

### Validate once, at startup
Everything in `process.env` is `string | undefined`. Parse it into a typed object with Zod, and **exit** with a clear message if anything is wrong. A failed start blocks the rollout; a failed request hurts users.

| Zod 4 tool | Use |
|:--|:--|
| `z.coerce.number().int()` | `"3000"` → `3000` |
| `z.stringbool()` | `"true"`, `"1"`, `"yes"` → `true`; `"false"`, `"0"`, `"no"` → `false` |
| `z.url()` / `z.email()` | formats |
| `z.enum([...])` | allowed values (`LOG_LEVEL`, `APP_ENV`) |
| `.default(v)` | safe defaults for non-secrets |
| `.transform()` + `.pipe()` | `"a,b"` → `['a', 'b']`, then validate items |
| `z.prettifyError(err)` | human-readable error list |

### One config module
- Only `src/config.ts` reads `process.env`. Everyone else imports `config`.
- Group by concern: `config.http.port`, `config.db.url`.
- Freeze it. Config doesn't change at runtime (runtime toggles are flags, lesson 03).
- Export a `loadConfig(source)` function, so tests can pass a plain object.

### `.env` files
| File | Committed? | Contains |
|:--|:--|:--|
| `.env` | ✗ never | your local values |
| `.env.example` | ✓ | every key, safe placeholder values, a comment per key |
| `.env.test` | ✓ if no secrets | values for local test runs |
| `.env.production` | ✗ don't create it | production config lives in the platform |

## Example
`.env.example`
```bash
# Runtime
NODE_ENV=development
APP_ENV=local
PORT=3000
LOG_LEVEL=debug

# Backing services (docker compose up -d --wait)
DATABASE_URL=postgres://app:app_local_only@localhost:5432/shop
REDIS_URL=redis://localhost:6379

# Secrets: generate your own, e.g. `openssl rand -base64 48`
SESSION_SECRET=replace-me-with-at-least-32-characters

# Comma-separated
CORS_ORIGINS=http://localhost:5173
FEATURE_NEW_CHECKOUT=false
```
`src/config.ts`
```ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'test', 'preview', 'staging', 'production']).default('local'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  CORS_ORIGINS: z
    .string()
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean))
    .pipe(z.array(z.url())),
  FEATURE_NEW_CHECKOUT: z.stringbool().default(false),
});

export function loadConfig(source: Record<string, string | undefined>) {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`); // names keys, never values
  }
  const env = result.data;
  return Object.freeze({
    env: { node: env.NODE_ENV, app: env.APP_ENV },
    http: { port: env.PORT, corsOrigins: env.CORS_ORIGINS },
    log: { level: env.LOG_LEVEL },
    db: { url: env.DATABASE_URL },
    redis: { url: env.REDIS_URL },
    session: { secret: env.SESSION_SECRET },
    features: { newCheckout: env.FEATURE_NEW_CHECKOUT },
  });
}

export type Config = ReturnType<typeof loadConfig>;
export const config = loadConfig(process.env);
```
`src/server.ts` and scripts:
```ts
import { config } from './config.ts'; // throws at import: the process exits before listening
import { createApp } from './app.ts';

createApp(config).listen(config.http.port);
```
```json
{
  "scripts": {
    "dev": "node --watch --env-file-if-exists=.env src/server.ts",
    "start": "node src/server.ts"
  }
}
```
Keep `process.env` out of the rest of the code with a core ESLint rule:
```js
// eslint.config.js (excerpt)
{
  ignores: ['src/config.ts'],
  rules: {
    'no-restricted-properties': ['error', { object: 'process', property: 'env', message: 'Import config from src/config.ts' }],
  },
}
```
Test it without touching the real environment:
```ts
import { expect, it } from 'vitest';
import { loadConfig } from './config.ts';

it('rejects a short session secret and names the key', () => {
  expect(() => loadConfig({ DATABASE_URL: 'postgres://x@y/z', REDIS_URL: 'redis://r', SESSION_SECRET: 'short', CORS_ORIGINS: '' }))
    .toThrow(/SESSION_SECRET/);
});
```

## Production patterns
- **Fail fast on startup.** Combined with health checks and rolling deploys, a bad config never takes traffic.
- **Error messages name keys, never values**, so secrets don't end up in logs.
- **Defaults only for safe, non-secret settings.** Secrets and URLs have no defaults: missing means stop.
- **Document every key in `.env.example`**, and add a CI check that the schema and the example list the same keys.
- **Typed config passed into factories** (`createApp(config)`) makes tests and multiple instances easy.

## Mistakes
Wrong: reading env vars everywhere.
```ts
const timeout = Number(process.env.HTTP_TIMEOUT) || 5000; // scattered, untyped, "0" becomes 5000
```
Right: one schema field `HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000)`.

Wrong: boolean parsing by truthiness.
```ts
if (process.env.ENABLE_BILLING) startBilling(); // "false" is truthy
```
Right: `z.stringbool()`.

Wrong: logging config on startup.
```ts
logger.info({ config }, 'starting'); // session secret and DB password in logs
```
Right: log non-secret fields only (`APP_ENV`, port, feature flags), or redact.

Wrong: `z.coerce.boolean()` for env flags. It uses JavaScript truthiness, so `"false"` → `true`.
Right: `z.stringbool()`.

## Check yourself
1. When a variable exists both in the shell and in the `--env-file`, which wins?
2. Why exit on invalid config instead of logging a warning?
3. Why export `loadConfig()` as well as `config`?

<details>
<summary>Answers</summary>

1. The real environment (shell or platform) wins; the file only fills in missing variables.
2. A warning lets a broken instance take traffic and fail on real requests. Exiting fails the deploy's health checks, so the rollout stops and the old version keeps serving.
3. Tests can build configs from plain objects (valid and invalid) without mutating `process.env` or re-importing modules.
</details>

## Sources
- [Node.js — `--env-file`](https://nodejs.org/api/cli.html#--env-filefile)
- [Node.js — `process.loadEnvFile()`](https://nodejs.org/api/process.html#processloadenvfilepath)
- [Zod — Coercion and `z.stringbool()`](https://zod.dev/api#stringbool)
- [Zod — Formatting errors](https://zod.dev/error-formatting)
- [ESLint — `no-restricted-properties`](https://eslint.org/docs/latest/rules/no-restricted-properties)
