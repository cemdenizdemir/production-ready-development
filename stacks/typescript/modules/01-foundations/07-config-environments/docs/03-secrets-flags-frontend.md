---
title: Secrets, flags, frontend config, and safe changes
tech: Node.js 26, Zod 4, AWS Secrets Manager, Vite 8, Next.js 16
version: Node.js 26 LTS, Zod 4.4, Vite 8, Next.js 16
date: 2026-11-07
covers: [7, 9, 10, 11]
---
# Secrets, flags, frontend config, and safe changes
[← Overview](00-overview.md)

## Why it matters
- A Stripe secret key is put in `NEXT_PUBLIC_STRIPE_KEY` "so the checkout works". It ships in the JavaScript bundle to every visitor.
- A database password rotates in Secrets Manager, but the app only reads it at startup. Hours later, new connections fail across the fleet.
- A half-built feature is merged behind an env var flag. Turning it off in an emergency requires a redeploy, which takes 25 minutes during the incident.

## Concepts

### Secrets vs config
| | Config | Secret |
|:--|:--|:--|
| Examples | port, log level, region, feature defaults | DB password, API keys, signing keys |
| Stored in | IaC / platform env vars, Git-reviewed | secret manager (AWS Secrets Manager, SSM SecureString) |
| Visible to | engineers | the app's runtime role; few humans |
| Rotation | change + redeploy | scheduled and on incident, ideally without downtime |

On AWS ECS, the task definition maps secrets to env vars (`secrets: [{ name, valueFrom: <arn> }]`); the platform fetches them at task start. Nothing lands in the image or the repo.

**Rotation without downtime:** accept old and new values for a while (`SESSION_SECRETS=new,old`: sign with the first, verify with all), use database users with overlapping validity, restart tasks gradually after rotation, or fetch secrets with a short cache.

### Build-time vs runtime config
| Kind | Example | Changes need |
|:--|:--|:--|
| Build-time (inlined into bundles) | Vite `import.meta.env.VITE_API_URL`, Next.js `NEXT_PUBLIC_*` in client code | a rebuild |
| Runtime | server env vars, a `/config.json` endpoint, Server Components reading `process.env` per request | a restart (env) or nothing (fetched) |

Build-time values break "build once, run anywhere". Keep them for values that are truly the same everywhere, or serve frontend config at runtime.

### Public vs private in the frontend
**Anything sent to the browser is public.** `VITE_` and `NEXT_PUBLIC_` prefixes mean "copy into the bundle". Only publishable values go there: public API URL, Stripe *publishable* key, analytics site ID. In Next.js, keep server-only config in a module that imports `server-only`, so importing it from a Client Component fails the build.

### Feature flags
| Type | Lifetime | Example |
|:--|:--|:--|
| Release | days to weeks | new checkout behind a flag, ramped 1% → 100% |
| Ops / kill switch | permanent | disable recommendations when the DB is overloaded |
| Experiment | weeks | A/B test of a pricing page |
| Permission | permanent | beta features for selected accounts |

| Storage | Changes take effect | Good for |
|:--|:--|:--|
| Env var | after restart/redeploy | per-environment defaults |
| DB/Redis table with short cache | seconds | kill switches, per-account rollouts |
| Flag service via OpenFeature SDK | seconds, with targeting and audit | larger teams (also seen: LaunchDarkly, Unleash, Flagsmith, GrowthBook) |

Rules: safe default when the flag source is down; flags are tech debt, so each has an owner and a removal date; never put secrets in flags.

### Changing config safely
- **Additive first:** new key with a default → code reads it → set it per environment → remove the default later.
- **Deprecate, don't break:** read the new key, fall back to the old one with a warning, remove the old one next release.
- **Config is code:** environment config lives in Terraform or the deploy workflow, changed by PR, reviewed, and audited (CloudTrail records Secrets Manager and SSM changes).
- **Roll out config like code:** staging first, then production, with a way back.

## Example
`src/flags.ts` — runtime kill switches with a safe fallback.
```ts
import type { Pool } from 'pg';

type FlagName = 'new-checkout' | 'recommendations';
const DEFAULTS: Record<FlagName, boolean> = { 'new-checkout': false, recommendations: true };

export function createFlags(db: Pool, ttlMs = 10_000) {
  let cache: { at: number; values: Partial<Record<FlagName, boolean>> } = { at: 0, values: {} };

  async function refresh() {
    try {
      const { rows } = await db.query<{ name: FlagName; enabled: boolean }>('SELECT name, enabled FROM feature_flags');
      cache = { at: Date.now(), values: Object.fromEntries(rows.map((r) => [r.name, r.enabled])) };
    } catch {
      cache = { ...cache, at: Date.now() }; // keep last known values; retry after the TTL
    }
  }

  return {
    async isEnabled(name: FlagName): Promise<boolean> {
      if (Date.now() - cache.at > ttlMs) await refresh();
      return cache.values[name] ?? DEFAULTS[name]; // unknown or unreachable → safe default
    },
  };
}
```
Next.js 16: split server and client config.
```ts
// src/env.server.ts
import 'server-only';
import { z } from 'zod';

export const serverEnv = z.object({
  API_INTERNAL_URL: z.url(),
  SESSION_SECRET: z.string().min(32),
}).parse(process.env);
```
```ts
// src/env.client.ts — only NEXT_PUBLIC_ values; they are inlined at build time
import { z } from 'zod';

export const clientEnv = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
}).parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,             // must be written out in full
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});
```
Next.js only inlines `process.env.NEXT_PUBLIC_X` when written literally; `process.env[name]` stays undefined in the browser.

Vite equivalent: `import.meta.env.VITE_API_URL`, typed in `src/vite-env.d.ts` via `interface ImportMetaEnv { readonly VITE_API_URL: string }`.

## Production patterns
- **Secrets from a secret manager, injected at runtime**, scoped to the service's IAM role.
- **Plan rotation before you need it:** dual-value support for signing keys, gradual restarts for DB credentials.
- **Frontend gets only publishable values**; anything else stays on the server, behind your API.
- **Kill switches for risky dependencies** (recommendations, third-party calls), readable at runtime without a deploy.
- **Remove release flags within weeks** of reaching 100%; track them like tickets.

## Mistakes
Wrong: a secret with a public prefix.
```bash
NEXT_PUBLIC_STRIPE_SECRET_KEY=sk_live_...   # shipped to every browser
```
Right: `STRIPE_SECRET_KEY` server-side only; the browser gets `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_...`).

Wrong: secrets in the image.
```dockerfile
COPY .env /app/.env
```
Right: secrets injected by the platform at runtime (`secrets:` in the ECS task definition).

Wrong: a flag check that fails open on errors for a risky feature.
```ts
const enabled = await flags.isEnabled('new-checkout').catch(() => true);
```
Right: default to the safe, old behavior when the flag source is unavailable.

Wrong: renaming a config key in one deploy. Instances with the old env break immediately.
Right: read both keys for one release, warn on the old one, then remove it.

## Check yourself
1. Why does a value in `NEXT_PUBLIC_*` count as public even if your UI never shows it?
2. How can you rotate a session signing secret without logging everyone out?
3. Which feature-flag type should be permanent, and why?

<details>
<summary>Answers</summary>

1. It is inlined into the JavaScript bundle at build time; anyone can download the bundle and read it.
2. Support several secrets: sign new sessions with the new secret, verify with new and old for one session lifetime, then remove the old one.
3. Ops kill switches (and permission flags): they protect the system during incidents or define access, so they stay. Release and experiment flags should be removed after they finish.
</details>

## Sources
- [AWS — Pass Secrets Manager secrets to ECS as environment variables](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html)
- [Next.js — Environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Vite — Env variables and modes](https://vite.dev/guide/env-and-mode)
- [OpenFeature](https://openfeature.dev/)
- [Martin Fowler — Feature Toggles](https://martinfowler.com/articles/feature-toggles.html)
