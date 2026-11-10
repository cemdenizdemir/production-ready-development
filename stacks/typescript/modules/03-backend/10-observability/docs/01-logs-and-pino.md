---
title: Observability basics and structured logging with Pino
tech: Pino, Express 5, Node.js 26
version: Pino 9+, pino-http, Express 5.2, Node.js 26 LTS
date: 2026-11-07
covers: [1, 2, 12]
---
# Observability basics and structured logging with Pino
[← Overview](00-overview.md)

## Why it matters
- An outage at 2 a.m.: the logs are `console.log('error', err)` strings spread over 12 tasks. Nobody can tell which requests failed, for which customers, or why.
- A debug line prints the whole request body. Password-reset tokens end up in logs that 40 people can read and that are kept for a year.
- Debug logging left on in production costs more per month than the database.

## Concepts

### Signals: what each one answers
| Signal | Answers | Strength | Weakness |
|:--|:--|:--|:--|
| Metrics | how much, how fast, how often? | cheap, aggregated, alertable | no per-request detail; cardinality limits |
| Traces | where did this request spend its time, across services? | causality, latency breakdown | sampled; needs instrumentation |
| Logs | what exactly happened? | full detail and context | volume and cost; hard to aggregate |
| Errors (Sentry) | which bugs hit users, since which release? | grouping, stack traces, releases | errors only |
| Profiles | which code burns CPU? | continuous profiling (also seen: Pyroscope) | another system |

**Monitoring** answers questions you knew to ask (dashboards, alerts). **Observability** lets you ask new questions of rich telemetry without shipping new code. A typical path: alert (metric) → dashboard → trace of a slow request → logs for that trace → Sentry issue with the stack trace.

### Structured logging
| Practice | Example |
|:--|:--|
| JSON to stdout | the platform ships it; the app never writes log files |
| Message + fields | `logger.info({ orderId, totalCents }, 'order placed')` |
| Stable messages | the message names the event; values go in fields, so you can search for it |
| Context on every line | request ID, trace ID, user/account ID (never email), route |
| Child loggers | `logger.child({ module: 'payments' })`; `req.log` per request |
| Errors as objects | `logger.error({ err }, '...')` keeps type, message, stack, and `cause` |
| One line per event | no multi-line strings |

| Level | Use |
|:--|:--|
| `fatal` | the process is about to exit |
| `error` | a request or job failed and someone may need to act |
| `warn` | unexpected but handled: fallback used, retry happened |
| `info` | business events and lifecycle: started, order placed, shutting down |
| `debug` / `trace` | developer detail; off in production by default |

### Privacy and security in telemetry
| Risk | Defense |
|:--|:--|
| Secrets (tokens, cookies, API keys) | Pino `redact` paths; never log headers wholesale |
| Personal data (emails, addresses, IPs) | log IDs, not personal data |
| Request and response bodies | not logged by default |
| Tokens in URLs | keep them out of query strings: URLs land in logs, traces, CDN logs |
| SQL with values | parameterized queries; the pg instrumentation records the statement, not the values |
| Error messages containing data | scrub in Sentry's `beforeSend`; don't put user input in messages |
| Access and retention | least privilege in Grafana/Sentry; retention limits; handle deletion requests (GDPR) |
| Last line of defense | collector processors drop or hash attributes ([lesson 03](03-lgtm-dashboards-alerting.md)) |

## Example
`src/logger.ts`
```ts
import pino from 'pino';
import { config } from './config.ts';

export const logger = pino({
  level: config.log.level,                                   // 'info' in production, 'debug' locally
  base: { service: 'api', version: config.app.version, env: config.app.env },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },      // "level":"error" instead of 50
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
    ],
    censor: '[redacted]',
  },
  transport: config.app.env === 'local' ? { target: 'pino-pretty' } : undefined, // pretty output only on laptops
});
```
`src/app.ts` — request logging with pino-http.
```ts
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.ts';

app.use(pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID(); // don't trust arbitrary input
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
  customProps: (req) => ({ userId: req.user?.id, accountId: req.user?.accountId }), // IDs, never emails
  autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },        // no health-check noise
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),               // no headers, no body
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));
```
Logging in handlers and services:
```ts
router.post('/orders', async (req, res) => {
  const order = await orders.place(req.user!.accountId, PlaceOrderBody.parse(req.body));
  req.log.info({ orderId: order.id, totalCents: order.totalCents, items: order.items.length }, 'order placed');
  res.status(201).json(toOrderDTO(order));
});

// In code without a request: a child logger with a fixed module field
const log = logger.child({ module: 'payments' });
log.warn({ provider: 'stripe', attempt: 2 }, 'payment provider slow, retrying');
```
A typical production line (one line in reality; `trace_id`/`span_id` are added by the OpenTelemetry Pino instrumentation, lesson 02):
```json
{"level":"info","time":"2026-11-07T09:12:44.120Z","service":"api","version":"2026.11.07-a1b2c3d","env":"production","req":{"id":"9b2f…","method":"POST","url":"/api/orders"},"userId":"usr_42","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736","span_id":"00f067aa0ba902b7","orderId":"ord_981","totalCents":4599,"items":3,"msg":"order placed"}
```

## Production patterns
- **JSON logs to stdout** with service, version, environment, request ID, trace ID, and user/account IDs on every line.
- **Redaction configured once in the logger**, plus a rule: no bodies, no headers, no personal data.
- **`info` in production**, `debug` switchable per service via config when investigating.
- **Log once, where the error is handled** (the error handler), with context; don't log and rethrow.
- **Health checks and static assets excluded** from request logs.

## Mistakes
Wrong: string logs.
```ts
console.log('Order ' + order.id + ' failed for ' + user.email + ': ' + err); // unsearchable, leaks email, loses the stack
```
Right: `req.log.error({ err, orderId: order.id }, 'order failed')`.

Wrong: logging whole objects.
```ts
logger.info({ req }, 'incoming request'); // headers with cookies and tokens, maybe the body
```
Right: serializers that pick safe fields, plus `redact`.

Wrong: log and rethrow at every layer. One failure produces five error lines and five alerts. Right: add context to the error (`new Error('charge failed', { cause: err })`) and log it once at the boundary.

Wrong: `debug` logs in production "just in case". Volume, cost, and noise. Right: `info` by default; raise the level for one service temporarily when needed.

## Check yourself
1. Which signal would you use to detect a problem, and which to explain a specific failed request?
2. Why should log messages be stable strings with values in fields?
3. Name three things that must never appear in logs, and how Pino helps.

<details>
<summary>Answers</summary>

1. Metrics detect it (error rate, latency, alerts). To explain one failed request, use its trace (where the time and error happened) and the logs for that trace ID; Sentry adds the stack trace and release.
2. A stable message ("order placed") can be searched and counted exactly, and fields can be filtered and aggregated (`orderId`, `totalCents`). Values concatenated into messages make every line unique and impossible to query.
3. Secrets (passwords, tokens, API keys, session cookies), personal data (emails, addresses, card data), and full request/response bodies. Pino's `redact` paths replace known sensitive fields, and custom serializers log only safe request fields.
</details>

## Sources
- [Pino — API and options](https://getpino.io/#/docs/api)
- [Pino — Redaction](https://getpino.io/#/docs/redaction)
- [pino-http](https://github.com/pinojs/pino-http)
- [OWASP — Logging cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OpenTelemetry — Observability primer](https://opentelemetry.io/docs/concepts/observability-primer/)
