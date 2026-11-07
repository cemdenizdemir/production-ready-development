---
title: Scalability cheatsheet
tech: Node.js 26, PostgreSQL 18, Redis 8, k6
version: k6 1.x, Node.js 26 LTS, PostgreSQL 18 (RDS), Redis 8, AWS ECS Fargate
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Scalability cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## What to measure
| Signal | What |
|:--|:--|
| ⭐ Latency | p50 / p95 / p99 per route, never averages |
| ⭐ Throughput | requests/s per route |
| ⭐ Errors | 5xx, timeouts under load |
| ⭐ Saturation | CPU, event loop delay, pool wait, DB CPU/locks, queue depth |
| Where time goes | traces: DB, Redis, external calls, app code |
| RED (services) | Rate, Errors, Duration |
| USE (resources) | Utilization, Saturation, Errors |
| Tail math | 10 calls at 1% slow each → ~10% of pages slow |

## k6 concepts
| Concept | Meaning |
|:--|:--|
| VU | virtual user looping a function |
| Iteration | one run of the scenario function |
| ⭐ Scenario + executor | how load is generated |
| ⭐ Open model | arrival-rate executors: requests keep coming |
| Closed model | fixed VUs: slow server = fewer requests (hides problems) |
| ⭐ Thresholds | pass/fail; exit code 99 on failure |
| Checks | per-response assertions (don't stop the test) |
| Tags | `{ tags: { name: 'GET /api/products/:id' } }` |
| `SharedArray` | test data loaded once for all VUs |
| `setup()` / `teardown()` | once before/after (login, seed) |
| `__ENV` | `-e KEY=value` variables |
| `open()` | read files in the init context |

## k6 executors
| Executor | Model | Use |
|:--|:--|:--|
| ⭐ `constant-arrival-rate` | open | steady request rate |
| ⭐ `ramping-arrival-rate` | open | ramp a request rate up/down |
| `constant-vus` | closed | fixed users |
| `ramping-vus` | closed | ramp users |
| `per-vu-iterations` | closed | N iterations per VU |
| `shared-iterations` | closed | N iterations shared |
| `externally-controlled` | either | change load at runtime |

## Test types
| Type | Load | Duration | Answers |
|:--|:--|:--|:--|
| ⭐ Smoke | 1–5 VUs | 1 min | script works |
| ⭐ Average load | normal peak | 10–60 min | SLOs at peak |
| Stress | 1.5–2× peak | 10–60 min | how it degrades |
| Spike | sudden jump | minutes | autoscaling, shedding |
| Breakpoint | ramp to failure | until it breaks | max capacity |
| Soak | normal | hours | leaks, slow drift |

## k6 metrics
| Metric | Type | Meaning |
|:--|:--|:--|
| ⭐ `http_req_duration` | trend | full request time |
| ⭐ `http_req_failed` | rate | share of failed requests |
| `http_reqs` | counter | total requests |
| `http_req_waiting` | trend | time to first byte |
| `http_req_connecting` / `http_req_tls_handshaking` | trend | connection setup |
| ⭐ `dropped_iterations` | counter | arrival rate not reached: raise `maxVUs` |
| `checks` | rate | share of passed checks |
| `iterations` / `iteration_duration` | counter / trend | loop stats |
| `vus` / `vus_max` | gauge | active / allocated VUs |
| `data_sent` / `data_received` | counter | bytes |

## k6 thresholds and CLI
| Syntax | Meaning |
|:--|:--|
| ⭐ `http_req_duration: ['p(95)<300', 'p(99)<800']` | latency SLOs |
| ⭐ `http_req_failed: ['rate<0.01']` | under 1% errors |
| `checks: ['rate>0.99']` | 99% checks pass |
| `'http_req_duration{scenario:browse}': [...]` | per scenario / tag |
| `{ threshold: 'p(99)<1000', abortOnFail: true }` | stop early |
| ⭐ `k6 run load/shop.ts` | run (TypeScript works directly) |
| `-e BASE_URL=…` | pass variables |
| `--out experimental-prometheus-rw` | metrics to Prometheus |
| `--out json=results.json` | raw results |
| `k6 cloud run` | Grafana Cloud k6 (also seen) |
| `k6 new` | scaffold a script |
| `handleSummary(data)` | custom end-of-test summary |

## Realistic load tests
| Practice | Why |
|:--|:--|
| ⭐ Production-sized data | small tables lie |
| ⭐ Varied IDs and users | same ID = 100% cache hits |
| Realistic endpoint mix | weight by real traffic |
| Prod-like environment | results transfer |
| Watch the generator's CPU | don't measure k6 |
| Observe during the test | traces, metrics, `pg_stat_statements` |
| Stub third parties | never load-test Stripe or email providers |

## Budgets in CI
| Check | When |
|:--|:--|
| ⭐ k6 smoke + small load with thresholds | every deploy to staging |
| Full load test vs baseline | nightly / before launches |
| Query count per request | integration tests (N+1) |
| Actions | `grafana/setup-k6-action`, `grafana/run-k6-action` (pin SHAs) |

## Stateless checklist
| State | Lives in |
|:--|:--|
| ⭐ Sessions | Redis |
| ⭐ Files, uploads | S3 |
| Caches | Redis; in-process only small + short TTL |
| Schedules | BullMQ job schedulers |
| Locks, counters, rate limits | Redis / Postgres |
| Real-time fan-out | Redis pub/sub |
| ⭐ Test | kill any task anytime, nobody notices |

## Scaling on ECS Fargate
| Lever | Value |
|:--|:--|
| Task size | 0.25–16 vCPU; ~1 vCPU per Node process |
| ⭐ Min tasks | 2+ across AZs |
| ⭐ Target tracking | `ECSServiceAverageCPUUtilization` ~60% |
| Alternative metric | `ALBRequestCountPerTarget` |
| Cooldowns | out 60 s, in 300 s+ |
| Scheduled scaling | known peaks |
| ⭐ Max tasks | within the DB connection budget |
| Faster scale-out | small images, little boot work |

## Node.js performance
| Need | Tool |
|:--|:--|
| ⭐ CPU profile | `node --cpu-prof --cpu-prof-dir=./profiles` → Chrome DevTools |
| Live inspect | `node --inspect` |
| ⭐ Heap snapshot | `--heapsnapshot-signal=SIGUSR2`, `v8.writeHeapSnapshot()` |
| Near-OOM snapshot | `--heapsnapshot-near-heap-limit=1` |
| ⭐ Heap limit | `--max-old-space-size` ≈ 75% of task memory |
| ⭐ Event loop delay | `monitorEventLoopDelay()` |
| Threadpool | `UV_THREADPOOL_SIZE` (default 4): fs, `dns.lookup`, crypto, zlib |
| ⭐ CPU-heavy work | `worker_threads` pool; Piscina (also seen) |
| Core count | `os.availableParallelism()` |
| Flame graphs | 0x, Clinic.js (also seen) |
| avoid | `cluster`/PM2 inside containers, sync APIs in handlers |

## Real-time at scale
| Concern | Approach |
|:--|:--|
| ⭐ Fan-out across tasks | Redis pub/sub (`pSubscribe`, `publish`) |
| Socket.IO | `@socket.io/redis-adapter`; sticky sessions only for long-polling |
| ⭐ Heartbeats | every 25–30 s (< ALB idle 60 s) |
| Deploys | close gradually, clients reconnect with jitter |
| Scaling signal | connections per task |
| Subscriber | dedicated connection (`redis.duplicate()`) |
| Big clusters | sharded pub/sub `SSUBSCRIBE` / `SPUBLISH` |

## Database scaling ladder
| Step | Note |
|:--|:--|
| ⭐ 1. Queries + indexes | biggest wins |
| ⭐ 2. Cache hot reads | Redis, CDN |
| ⭐ 3. Pooling + connection budget | RDS Proxy, PgBouncer |
| 4. Bigger instance | short failover on Multi-AZ |
| 5. Read replicas | lag, read-your-writes |
| 6. Partitioning | retention, pruning |
| 7. Move workloads out | warehouse, search engine |
| 8. Sharding | last resort |

## Query tuning tools
| Tool | Use |
|:--|:--|
| ⭐ `pg_stat_statements` | top by `total_exec_time` |
| ⭐ `EXPLAIN (ANALYZE, BUFFERS)` | real plan + I/O |
| Performance Insights / Database Insights | load by query and wait event |
| `auto_explain` | plans of slow queries |
| `log_min_duration_statement` | slow query log |
| `pg_stat_user_indexes` | unused indexes |
| `pg_stat_statements_reset()` | start a fresh measurement window |

## Connections and pooling
| Item | Value |
|:--|:--|
| ⭐ Budget | tasks × pool max + workers × pool max + admin ≤ `max_connections` − reserve |
| App pool `max` | 5–10 per task |
| ⭐ `connectionTimeoutMillis` | 2–5 s |
| RDS Proxy | managed; watch pinning |
| PgBouncer transaction mode | no session state; `max_prepared_statements` for prepared statements |
| Rule | no external calls inside transactions |

## Read replicas
| Item | Detail |
|:--|:--|
| ⭐ Use for | stale-tolerant reads |
| ⭐ Read-your-writes | `db.$primary` |
| Drizzle | `withReplicas(primary, [replica])` |
| Monitor | `ReplicaLag` |
| Multi-AZ standby | not readable (DB clusters: readable standbys) |

## Partitioning
| Item | Detail |
|:--|:--|
| ⭐ RANGE by time | events, logs, orders |
| LIST / HASH | known values / even spread |
| ⭐ Retention | `DETACH PARTITION … CONCURRENTLY` + `DROP TABLE` |
| ⭐ Keys | PK/unique must include the partition key |
| Pruning | queries must filter on the key |
| Future partitions | job creates them ahead; pg_partman (also seen) |
| When | table bigger than server memory |
| Drizzle | custom SQL migration (`drizzle-kit generate --custom`) |

## Sharding
| Item | Detail |
|:--|:--|
| Shard key | tenant/account |
| Routing | lookup table or hash |
| Cross-shard | avoid; warehouse for analytics |
| Managed | Citus, Aurora Limitless (also seen) |
| ⭐ When | after every cheaper step, with evidence |

## Offloading
| Layer | Takes |
|:--|:--|
| Browser | repeat visits (`max-age`, immutable assets) |
| ⭐ CDN | static files, images, public GETs (`s-maxage`) |
| ⭐ Redis | computed reads |
| Replicas | read queries |
| Precomputation | rollups, materialized views |
| ⭐ Queues | heavy, slow, bursty work (`202 Accepted`) |
| Search | Postgres FTS first; OpenSearch (also seen) |

## Payloads and batching
| Technique | Effect |
|:--|:--|
| ⭐ Keyset pagination | constant cost per page |
| Lean DTOs | less I/O and JSON work |
| Compression | Brotli/gzip at CloudFront |
| Bulk endpoints | one call for many items (size-limited) |
| ⭐ Streaming / export jobs | flat memory; S3 presigned URL |
| Multi-row `INSERT`, `COPY` | fast bulk writes |
| Screen-shaped endpoints | fewer round trips |

## Capacity planning
| Formula / rule | Example |
|:--|:--|
| ⭐ Little's law `L = λ × W` | 800 req/s × 0.15 s = 120 in flight |
| Tasks | in flight ÷ per-task capacity × headroom + AZ spare |
| DB connections busy | req/s × queries × query time |
| Workers | jobs/s × job time = concurrent jobs |
| ⭐ Utilization target | 50–70% at peak |
| Queueing at 80% / 90% / 95% | 4× / 9× / 19× service time |
| Third-party limits | e.g. Stripe default 100 ops/s live |
| Cost | per 1,000 requests |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Averages | hide the tail | p95/p99 |
| Closed-model tests | hide slowdowns | arrival-rate executors |
| `dropped_iterations` > 0 | the test didn't send the planned load | more `maxVUs` / generators |
| Same test ID everywhere | caches fake the result | varied data |
| Bigger task for blocked loop | one JS thread | fix code, worker threads |
| New `Worker` per request | slow, memory-hungry | fixed pool |
| Pool × max tasks unchecked | connection exhaustion at peak | written budget, pooler |
| Own writes from a replica | stale data shown | primary for read-after-write |
| Partitioned table queried without key | scans every partition | filter on the key |
| `CREATE INDEX` on a partitioned parent | locks, can't be `CONCURRENTLY` | build per partition concurrently, then attach |
| Planning from averages | peaks are 5–10× higher | plan for peak + headroom |
| Ignoring external limits | provider rejects at peak | queue and smooth calls |

## Sources
| Source | Link |
|:--|:--|
| Grafana k6 docs | https://grafana.com/docs/k6/latest/ |
| k6 open vs closed models | https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/ |
| Node.js profiling | https://nodejs.org/en/learn/getting-started/profiling |
| ECS service auto scaling | https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html |
| PostgreSQL partitioning | https://www.postgresql.org/docs/current/ddl-partitioning.html |
| Drizzle read replicas | https://orm.drizzle.team/docs/read-replicas |
| Queue backlogs (AWS) | https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/ |
