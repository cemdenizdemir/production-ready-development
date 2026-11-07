---
title: Backend cheatsheet
date: 2026-11-07
---
# Backend cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · Language & Runtime](01-language-runtime/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `*Sync` APIs, huge JSON, ReDoS regexes | block the event loop: keep them out of handlers |
| Thread pool (4 threads) | `fs`, `dns.lookup`, pbkdf2/scrypt, zlib |
| `process.nextTick` → microtasks → timers/poll | order of async callbacks |
| `monitorEventLoopDelay()` | loop lag p99: the key health metric |
| Always `await` or return promises | no unhandled rejections (`no-floating-promises`) |
| Operational vs programmer errors | handle vs crash and restart |
| `AbortSignal.timeout()` / `AbortSignal.any()` | deadlines and combined cancellation |
| `SIGTERM` → `server.close()` → close pools | graceful shutdown under the stop timeout |
| `node` as PID 1 (exec-form `CMD`) | signals reach your process |
| `"type": "module"` + explicit `.ts` extensions | ESM with type stripping |
| `--inspect`, `--cpu-prof`, `--heapsnapshot-signal` | debug and profile |
| `pipeline()` | streams with backpressure and error handling |

## [02 · API Design](02-api-design/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Plural nouns, `/me` | resource URLs |
| GET / POST / PATCH / PUT / DELETE | method semantics |
| 201 + `Location`, 204, 202 + status URL | success codes |
| 400 / 401 / 403 / 404 / 409 / 422 / 429 | error codes |
| Problem Details: `type`, `title`, `status`, `detail` | consistent error bodies (RFC 9457) |
| `Schema.parse(req.body)` (also params, query) | Zod at the edge → 422 |
| `.strict()` on write schemas | reject unknown keys |
| Express 5: throw in async handlers | errors forwarded automatically |
| Error handler `(err, req, res, next)` registered last | one place for error responses |
| Keyset (cursor) pagination | stable, fast pages |
| `Idempotency-Key` on POST | safe client retries |
| `ETag` + `If-Match` → 412 | optimistic concurrency |
| Additive changes, `/v1`, `Deprecation` / `Sunset` headers | API evolution |

## [03 · Databases](03-databases/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `uuid DEFAULT uuidv7()` | time-ordered primary keys (PG 18) |
| `timestamptz`, integer cents, constraints | correct types and integrity |
| Composite B-tree `(account_id, status, created_at DESC)` | leftmost-first indexes |
| Partial and expression indexes | smaller, query-shaped indexes |
| `CREATE INDEX CONCURRENTLY` | build without blocking writes |
| `EXPLAIN (ANALYZE, BUFFERS)` | real plan, rows, I/O |
| N+1 → `JOIN` or `WHERE id = ANY($1)` | batch queries |
| Conditional `UPDATE`, `FOR UPDATE`, `SKIP LOCKED` | concurrency control |
| Short transactions, no network calls inside | locks and pool stay free |
| Small pools + `connectionTimeoutMillis` + connection budget | connection management |
| `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout` | server-side guards |
| `drizzle({ client, schema, casing })`, `db.transaction()` | Drizzle basics |
| `drizzle-kit generate` / `migrate` | migrations |
| Expand → migrate → contract | zero-downtime schema changes |

## [04 · Authentication & Authorization](04-auth/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| argon2id with OWASP parameters | password hashing |
| Min length 15, no composition rules, breached-password check | NIST SP 800-63B rev. 4 |
| 32 random bytes, stored as `session:<sha256(id)>` in Redis | session IDs |
| `__Host-sid; HttpOnly; Secure; SameSite=Lax; Path=/` | session cookie |
| Rotate on login, revoke all on password reset | session hygiene |
| Per-IP + per-account limits, generic errors, equal timing | login protection |
| Reset tokens: random, hashed, 15–60 min, single use | account recovery |
| Passkeys, TOTP, recovery codes | MFA |
| `can(user, permission)`, deny by default | authorization |
| Queries scoped by account | tenancy, no IDOR |
| `prefix_live_<random>`, hash stored, shown once | API keys |
| Authorization code + PKCE + `state` | OAuth sign-in |

## [05 · Validation & Abuse](05-validation-abuse/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Strict Zod schemas for body, params, query | allowlist input |
| Server-controlled fields never from clients | no mass assignment |
| Normalize (trim, lowercase email), then validate | consistent data |
| `express.json({ limit: '100kb' })`, `.max()` everywhere | size limits |
| express-rate-limit + `RedisStore` + `standardHeaders: 'draft-8'` | distributed rate limiting |
| Keys by user, account, API key; `ipKeyGenerator` | who gets limited |
| 429 + `Retry-After` | limit responses |
| Token bucket | bursts plus a steady rate |
| Per-account limits, CAPTCHA, country allowlists | stuffing, card testing, SMS pumping |
| Raw body + signature + timestamp window | verify incoming webhooks |
| Enqueue with `jobId = event.id`, dedupe in the worker | idempotent webhooks |
| Server-side prices, `CHECK (quantity > 0)` | business-logic abuse |

## [06 · Caching](06-caching/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Cache-aside with TTL + jitter | default caching pattern |
| `shop:product:v2:{id}`, tenant-scoped keys | namespaced, versioned keys |
| Delete after the DB write | invalidation |
| Versioned keys, tag sets | bulk invalidation |
| Single flight, `SET lock NX PX`, stale-while-revalidate | stampede protection |
| `SCAN` (never `KEYS`), `UNLINK` | safe commands |
| `allkeys-lru` for caches, `noeviction` for queues and sessions | eviction policies |
| Separate Redis for cache and durable data | isolation |
| Cache errors treated as misses | resilience |
| Hit ratio, latency, `evicted_keys` | measuring |
| `public, s-maxage=…`, `private, no-cache`, `no-store` | HTTP caching |
| Portable commands | Valkey (ElastiCache) compatibility |

## [07 · Background Jobs & Messaging](07-background-jobs/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `Queue`, `Worker`, connection with `maxRetriesPerRequest: null` | BullMQ basics |
| `attempts` + exponential `backoff` | retries |
| `UnrecoverableError` | fail without retrying |
| Claim rows, idempotency keys | jobs safe to run twice |
| Deterministic `jobId` (no `:`) | dedupe while the job is stored |
| `removeOnComplete` / `removeOnFail` | retention |
| `concurrency`, `limiter` | throughput and provider limits |
| `upsertJobScheduler(id, { pattern, tz })` | scheduled jobs |
| `FlowProducer` + `getChildrenValues()` | parent and child jobs |
| `await worker.close()` on SIGTERM | graceful worker shutdown |
| Outbox + `FOR UPDATE SKIP LOCKED` relay | no dual writes |
| Oldest waiting job age, failure rate | queue alerts |

## [08 · Reliability & Resilience](08-reliability/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Timeouts on every call, request budgets | bound slowness |
| Transient-only retries, full jitter, one layer | safe retries |
| Shallow `/health/live`, local `/health/ready` | health checks that don't kill healthy tasks |
| Deregistration delay 30–60 s, `stopTimeout` > app deadline | clean deploys on ECS/ALB |
| Exec-form `CMD` or `initProcessEnabled` | SIGTERM reaches Node |
| Circuit breaker per dependency | fail fast |
| Bulkheads: semaphores, separate pools and queues | contain slowness |
| In-flight + event loop delay → 503 + `Retry-After` | load shedding |
| `Promise.allSettled` + fallbacks | graceful degradation |
| `pool.on('error')`, cache errors as misses | survive dependency outages |
| 99.9% = 43 min per 30 days | error budget |
| Burn rate 14.4× over 1 h and 5 min | SLO paging alert |

## [09 · Scalability & Performance](09-scalability/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| p95/p99 per route, RED and USE | measure first |
| k6 arrival-rate executors + thresholds | realistic load tests |
| Smoke, load, stress, spike, breakpoint, soak | test types |
| Sessions in Redis, files in S3 | stateless tasks |
| ECS target tracking ~60% CPU, min 2 tasks | autoscaling |
| `--cpu-prof`, heap snapshots, worker thread pool | Node performance |
| Connection budget, RDS Proxy / PgBouncer | database connections |
| Replicas + `db.$primary` for read-your-writes | read scaling |
| RANGE partitions + `DETACH … CONCURRENTLY` | big tables and retention |
| CDN, Redis, precomputation, queues | offloading |
| Little's law `L = λ × W` | capacity planning |
| 50–70% utilization at peak | headroom |

## [10 · Observability](10-observability/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Pino JSON to stdout, `redact`, `req.log` | structured logs |
| `info` in production, log once at the boundary | log hygiene |
| `node --import ./src/instrumentation.ts` | OpenTelemetry loads first |
| Auto-instrumentation + manual spans | traces |
| `OTEL_SEMCONV_STABILITY_OPT_IN=http` | stable HTTP metric names |
| Counters, histograms, bounded attributes | metrics without cardinality blowups |
| `trace_id` on log lines, exemplars | correlation |
| Loki, Grafana, Tempo, Mimir + Alloy | the LGTM stack |
| Rate, errors, p95, saturation per service | service overview dashboard |
| Page on symptoms, with runbooks | alerting |
| `setupExpressErrorHandler`, releases, shared OTel setup | Sentry |
| Head sampling 5–20%, tail sampling in Alloy | sampling and cost |

## [11 · Architecture](11-architecture/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Modular monolith with feature modules | default structure |
| Routes → use cases → domain; repos and adapters outside | the dependency rule |
| `index.ts` public API, no deep imports | module boundaries |
| `createDeps(config)` | composition root, DI without a framework |
| Ports + adapters, fakes in tests | external systems |
| Pure domain functions, integer cents, branded IDs | domain modeling |
| `DomainError(code)` → HTTP mapping in one place | error architecture |
| Use case owns short transactions, repos take `tx` | unit of work |
| Outbox events, one job per subscriber | decoupled modules |
| ADR + strangler fig, only with a real reason | extracting services |
| `no-restricted-imports` + architecture test | enforced boundaries |
| No `enum`, decorators, parameter properties | erasable TypeScript |

## [12 · Common Integrations](12-integrations/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Adapter + timeouts + idempotency keys | integration basics |
| Server-side amounts, webhook confirms payment | Stripe payments |
| Checkout (default) vs Payment Element | payment UI choice |
| `4242 4242 4242 4242`, `4000 0025 0000 3155` (3DS) | Stripe test cards |
| `express.raw` + `constructEvent` + `jobId = event.id` | Stripe webhooks |
| Dedupe row + change in one transaction | exactly-once in effect |
| Daily reconciliation | catch missed events |
| Easy DKIM, custom MAIL FROM, DMARC | SES domain setup |
| Bounces < 2%, complaints < 0.05%, event destinations | deliverability |
| Presigned POST with `content-length-range` | S3 uploads |
| Quarantine → scan → magic bytes → release | upload security |
| Signed outgoing webhooks, retries, SSRF block list | webhooks to customers |
