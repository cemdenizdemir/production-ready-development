---
title: Limits and rate limiting
tech: express-rate-limit, Redis 8, Express 5, Zod 4
version: express-rate-limit 8, rate-limit-redis 4, Redis 8
date: 2026-11-07
covers: [4, 5, 6]
---
# Limits and rate limiting
[← Overview](00-overview.md)

## Why it matters
- A 50 MB JSON body is accepted and parsed; ten such requests at once exhaust memory and crash the instance.
- One customer's runaway script calls the export endpoint 30 times per second; every other customer's API slows down.
- In-memory rate limits on six instances allow six times the intended traffic, and they reset on every deploy.

## Concepts

### Bound the cost of every request
| Limit | Where | Example |
|:--|:--|:--|
| Body size | `express.json({ limit })`, proxy | `100kb` default, larger only on specific routes |
| Strings and arrays | Zod `.max()` | names ≤ 200, items ≤ 50 |
| Page size | Zod `max(100)` on `limit` | |
| Search complexity | max terms, min length, no leading wildcards on big tables | |
| Request time | `server.requestTimeout`, per-request `AbortSignal` | 30 s |
| Database time | `statement_timeout` | 5 s |
| Upload size | presigned URL conditions, proxy limits | 25 MB |
| Concurrency | per-user parallel exports, queue limits | 2 exports at a time |
| Expensive features | quotas per plan | 100 exports/day |

### Rate limiting algorithms
| Algorithm | Behavior | Notes |
|:--|:--|:--|
| Fixed window | N requests per clock window | simple; allows bursts at window edges |
| Sliding window | N requests in the last T seconds | smoother; a bit more state |
| Token bucket | bucket refills at rate R up to capacity C | allows short bursts, enforces average rate |
| Leaky bucket | requests drain at a constant rate | smooth output |
| Concurrency limit | at most K in flight | protects slow endpoints |

### Choosing keys
| Key | Use | Watch out |
|:--|:--|:--|
| IP | anonymous endpoints | NAT/mobile carriers share IPs; IPv6 needs subnet grouping (`/56`); correct `trust proxy` |
| User ID | logged-in traffic | fair per user |
| API key / account | integrations, plan tiers | |
| Route + key | tight limits on login, signup, password reset, OTP send, search, export | |
| Cost-weighted | expensive calls count more | |

### Headers and responses
- `429 Too Many Requests` with `Retry-After` (seconds).
- IETF draft headers: `RateLimit-Policy: 100;w=60` and `RateLimit: limit=100, remaining=37, reset=21` (express-rate-limit `standardHeaders: 'draft-8'`); legacy `X-RateLimit-*` also seen.
- Problem Details body with a human-readable `detail`.

### Distributed limits
Several instances must share counters: a Redis store (`rate-limit-redis`). Decide what happens if Redis is unavailable: **fail open** (allow, alert) for general traffic, or **fail closed** for abuse-sensitive endpoints. Volumetric attacks belong at the edge (AWS WAF rate-based rules, CDN) before they reach your app.

## Example
`src/http/limits.ts`
```ts
import { rateLimit, ipKeyGenerator, type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '#src/redis.ts';

const store = (prefix: string) => new RedisStore({ prefix, sendCommand: (...args: string[]) => redis.sendCommand(args) });

const base: Partial<Options> = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res, _next, options) =>
    res.status(options.statusCode).type('application/problem+json').json({
      type: 'https://api.example.com/problems/rate-limited',
      title: 'Too many requests',
      status: options.statusCode,
      detail: `Try again in ${Math.ceil(options.windowMs / 1000)} seconds.`,
      requestId: req.id,
    }),
};

// Baseline for every request: by user when logged in, else by IP
export const globalLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: (req) => (req.user ? 600 : 120),
  keyGenerator: (req) => (req.user ? `u:${req.user.id}` : `ip:${ipKeyGenerator(req.ip ?? '')}`),
  store: store('rl:global:'),
  skip: (req) => req.path.startsWith('/health'),
});

// Expensive endpoint: per account, small budget
export const exportLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 20,
  keyGenerator: (req) => `acct:${req.user!.accountId}`,
  store: store('rl:export:'),
});
```
`src/app.ts` (excerpt)
```ts
app.set('trust proxy', 1);                              // correct client IPs (01-foundations/02)
app.use(express.json({ limit: '100kb' }));             // global cap; raise per route only where needed
app.use(authenticate(deps.sessions));                  // so limits can key on the user
app.use(globalLimiter);
app.post('/v1/exports', requireUser, exportLimiter, exportsHandler);
app.post('/v1/imports', requireUser, express.json({ limit: '5mb' }), importsHandler); // explicit exception
```
A Redis token bucket for custom needs (atomic via Lua):
```ts
const TOKEN_BUCKET = `
local tokens = tonumber(redis.call('HGET', KEYS[1], 't') or ARGV[1])
local ts = tonumber(redis.call('HGET', KEYS[1], 'ts') or ARGV[3])
local refill = (tonumber(ARGV[3]) - ts) / 1000 * tonumber(ARGV[2])
tokens = math.min(tonumber(ARGV[1]), tokens + refill)
local allowed = tokens >= 1
if allowed then tokens = tokens - 1 end
redis.call('HSET', KEYS[1], 't', tokens, 'ts', ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
return allowed and 1 or 0`;

export async function takeToken(key: string, capacity = 10, refillPerSec = 1): Promise<boolean> {
  const result = await redis.eval(TOKEN_BUCKET, {
    keys: [`tb:${key}`],
    arguments: [String(capacity), String(refillPerSec), String(Date.now()), String(Math.ceil(capacity / refillPerSec) * 1000)],
  });
  return result === 1;
}
```

## Production patterns
- **Cap body size globally**, raise it only on routes that need it.
- **Layered limits**: edge (volumetric), global per user/IP, tight per-route limits for sensitive and expensive endpoints, quotas per plan.
- **Shared Redis store**, with an explicit fail-open/fail-closed decision and alerts when Redis errors.
- **Standard headers and a Problem Details 429** so clients can back off automatically.
- **Key logged-in traffic by user/account**, not IP; group IPv6 by subnet.

## Mistakes
Wrong: in-memory limits across instances.
```ts
rateLimit({ windowMs: 60_000, limit: 100 }); // per instance, resets on deploy
```
Right: a Redis store shared by all instances.

Wrong: one big body limit for everything.
```ts
app.use(express.json({ limit: '50mb' })); // every route can be sent 50 MB
```
Right: a small default, exceptions per route.

Wrong: IP-only limits for logged-in APIs; offices and mobile carriers share IPs and get blocked together. Right: user/account keys after authentication.

Wrong: unbounded `limit` or array sizes in query and body schemas. Right: `max()` on every list and page size.

## Check yourself
1. Why does a token bucket suit APIs better than a fixed window?
2. Why must rate limiting come after authentication for per-user limits, but some limits come before it?
3. What should happen when the rate-limit store (Redis) is down?

<details>
<summary>Answers</summary>

1. It allows short bursts (up to the bucket capacity) while enforcing a steady average rate, and avoids the double-burst at fixed window boundaries.
2. Per-user limits need `req.user`, which authentication sets. But login, signup, and other pre-auth endpoints (and volumetric protection) must be limited by IP before authentication, or attackers can hammer them freely.
3. It's a deliberate choice: fail open (allow requests, raise alerts) for general traffic to stay available, fail closed (or fall back to strict local limits) for abuse-sensitive endpoints like login or SMS sending.
</details>

## Sources
- [express-rate-limit — Configuration](https://express-rate-limit.mintlify.app/reference/configuration)
- [rate-limit-redis](https://github.com/express-rate-limit/rate-limit-redis)
- [OWASP API4:2023 — Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
- [IETF — RateLimit header fields](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/)
- [AWS WAF — Rate-based rules](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html)
