---
title: Scalability & Performance cheatsheet
tech: ASP.NET Core 10, SQL Server 2025, Redis 8, k6, BenchmarkDotNet, YARP
version: .NET 10, k6 1.x, BenchmarkDotNet 0.15.x, YARP 2.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
---
# Scalability & Performance cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Signals
| Signal | Meaning | Source |
|:--|:--|:--|
| ⭐ p50 / p95 / p99 | typical and tail latency | `http.server.request.duration` |
| ⭐ throughput | req/s at target latency | k6, App Insights |
| ⭐ error rate | failed ÷ total | `http_req_failed` |
| ⭐ saturation | how full a resource is | CPU, pools, queues |
| RED | rate, errors, duration | services |
| USE | utilisation, saturation, errors | resources |
| average | hides tails | avoid alone |

## .NET diagnostics
| Tool | Does | Example |
|:--|:--|:--|
| ⭐ `dotnet-counters monitor` | live counters | `-n Shop.Api --counters System.Runtime` |
| ⭐ `dotnet-trace collect` | CPU/event trace | PerfView, Speedscope |
| `dotnet-gcdump` | heap snapshot | memory growth |
| `dotnet-dump analyze` | process dump | hangs, `clrstack -all` |
| VS profiler / dotTrace | local profiling | allocations, CPU |
| App Insights Profiler | production samples | |
| thread-pool queue length | starvation signal | `dotnet.thread_pool.queue.length` |

## k6 test types
| Type | Shape | Answers |
|:--|:--|:--|
| ⭐ smoke | 1–2 VUs, 1 min | script works |
| ⭐ average load | normal, 10–30 min | SLOs met |
| ⭐ stress | above normal | how it degrades |
| spike | sudden jump | autoscale, shedding |
| soak | hours | leaks, exhaustion |
| breakpoint | ramp to failure | max capacity |

## k6 API
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `constant-arrival-rate` / `ramping-arrival-rate` | open model | realistic |
| `constant-vus` / `ramping-vus` | closed model | hides overload |
| `preAllocatedVUs`, `maxVUs` | VU pool | open model |
| ⭐ `thresholds` | pass/fail | `p(95)<300` |
| `http_req_failed` | error rate metric | `rate<0.01` |
| `tags: { name }` | group URLs | per-endpoint thresholds |
| `check(res, {...})` | assertions | don't fail test alone |
| `SharedArray` | shared test data | memory-efficient |
| `__ENV.X` / `-e X=` | parameters | |
| `sleep()` | think time | |
| `k6 run file.ts` | TypeScript directly | k6 1.x |
| `grafana/run-k6-action` | CI | GitHub Actions |

## BenchmarkDotNet
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `[Benchmark]` / `Baseline = true` | measure, ratio | |
| ⭐ `[MemoryDiagnoser]` | allocations, GCs | |
| `[Params]` / `[ParamsSource]` | inputs | |
| `[GlobalSetup]` | setup once | |
| `[IterationSetup]` | per iteration | distorts micro results |
| `[ShortRunJob]` | quick runs | |
| `BenchmarkRunner.Run<T>()` | run | |
| `BenchmarkSwitcher` | `--filter *Name*` | |
| ⭐ Release, no debugger | valid results | `dotnet run -c Release` |
| return results | no dead-code elimination | |
| exporters | JSON/Markdown | CI compare |

## Runtime performance
| Item | Use | Note |
|:--|:--|:--|
| ⭐ fewer allocations | less GC | |
| ⭐ `Span<T>` / `ReadOnlySpan<T>` | slice without copying | |
| `stackalloc` | small stack buffers | with `Span<T>` |
| ⭐ `ArrayPool<T>.Shared` | rent/return buffers | return in `finally` |
| `string.Create` | one-allocation strings | |
| `FrozenDictionary` | fast read-only lookups | .NET 8+ |
| `SearchValues<T>` | fast any-of search | .NET 8+ |
| `ObjectPool<T>` | reuse objects | Microsoft.Extensions.ObjectPool |
| JSON source generation | no reflection | `JsonSerializerContext` |
| ⭐ no `.Result` / `.Wait()` | thread starvation | `VSTHRD002` |
| `ValueTask` | sync-heavy paths | await once |
| Server GC | ASP.NET Core default | |
| DATAS | adaptive heap | .NET 9+ default |
| LOH | objects ≥ 85 KB | pool big buffers |
| Native AOT | fast startup | reflection limits |

## Stateless checklist
| State | Store | Note |
|:--|:--|:--|
| ⭐ sessions, carts | SQL / Redis | |
| ⭐ Data Protection keys | `PersistKeysToAzureBlobStorage` + `ProtectKeysWithAzureKeyVault` | shared |
| files | Blob Storage | |
| work | Hangfire / Service Bus | |
| SignalR | Azure SignalR Service | |
| L1 cache | per replica | short TTL |

## Container Apps scaling
| Item | Does | Note |
|:--|:--|:--|
| ⭐ HTTP rule | concurrent requests per replica | default 10 |
| CPU / memory rule | utilisation | |
| ⭐ Service Bus rule | messages per replica | workers |
| custom KEDA | Redis, cron, SQL | |
| ⭐ `minReplicas` | ≥ 2 for API | 0 for dev/workers |
| ⭐ `maxReplicas` | cost + DB budget | |
| polling / cooldown | 30 s / 300 s | KEDA defaults |
| workload profiles | Consumption / Dedicated | |
| session affinity | sticky sessions | last resort |

## Traffic management
| Service | Layer | Does |
|:--|:--|:--|
| ⭐ Azure Front Door | global L7 | CDN, WAF, TLS, failover |
| Application Gateway | regional L7 | WAF, VNet |
| Azure Load Balancer | L4 | TCP/UDP |
| Traffic Manager | DNS | region failover |
| Container Apps ingress | app | replicas, revisions |
| ⭐ YARP | in-app proxy | BFF, gateway, strangler fig |

## YARP
| Item | Does | Note |
|:--|:--|:--|
| `AddReverseProxy().LoadFromConfig(...)` | setup | |
| `MapReverseProxy()` | endpoint | |
| Routes / Clusters / Destinations | config | |
| `PowerOfTwoChoices` | default policy | |
| `RoundRobin`, `LeastRequests`, `Random` | policies | |
| active/passive health checks | remove bad destinations | |
| transforms | headers, paths | |
| session affinity | sticky | cookie-based |

## SignalR scale-out
| Option | How | Note |
|:--|:--|:--|
| ⭐ Azure SignalR Service | `AddAzureSignalR()` | no sticky sessions |
| Redis backplane | `AddStackExchangeRedis(cs)` | sticky sessions |
| `SkipNegotiation` | WebSockets only | no sticky needed |
| one replica | | doesn't scale |

## Database scaling
| Item | Does | Note |
|:--|:--|:--|
| ⭐ Query Store | top queries, plan history | |
| actual plan / `STATISTICS IO` | diagnose | |
| covering / filtered indexes | faster reads | `INCLUDE` |
| PSP optimization | parameter sniffing | SQL 2022+ |
| automatic tuning | indexes, plan forcing | Azure SQL |
| ⭐ `Max Pool Size` | pool cap | default 100 |
| ⭐ connection budget | replicas × pool ≤ tier limit | |
| `Application Name` | separate pools, monitoring | |
| `AddDbContextPool<T>()` | reuse contexts | |
| ⭐ `ApplicationIntent=ReadOnly` | readable secondary | Premium / Business Critical |
| Hyperscale named replicas | read scale | |
| replication lag | stale reads | read-your-writes on primary |

## Offloading reads
| Technique | Example | Note |
|:--|:--|:--|
| ⭐ CDN | Front Door caching | `Cache-Control: public` |
| ⭐ HybridCache | catalog, prices | |
| output cache | anonymous pages | |
| precomputed tables | bestsellers | job-refreshed |
| indexed views | aggregates | write cost |
| Azure AI Search | full text, facets | |

## Partitioning and sharding
| Approach | Use | Note |
|:--|:--|:--|
| ⭐ table partitioning | huge time-based tables | partition function + scheme |
| `TRUNCATE ... WITH (PARTITIONS (n))` | fast purge | |
| `SWITCH` | archive a partition | |
| archiving | old rows out | |
| split by module | different load | |
| sharding | last resort | cross-shard pain |
| Hyperscale | very large single DB | up to 128 TB |

## Capacity and throughput
| Item | Formula / rule | Note |
|:--|:--|:--|
| ⭐ Little's law | concurrency = throughput × latency | L = λW |
| ⭐ headroom | peak ≤ 60–70% utilisation | |
| N+1 | survive one replica loss | |
| shared limits | DB, Redis, partners, SNAT | don't scale out |
| ⭐ queue-based load leveling | absorb spikes | workers drain |
| 202 Accepted | async operations | |

## Payloads
| Technique | .NET | Note |
|:--|:--|:--|
| ⭐ keyset pagination | `Where(x => x.Number < after)` | max page size |
| ⭐ projections | `.Select(...)` to DTOs | |
| ⭐ compression | Front Door / `AddResponseCompression()` | BREACH care |
| streaming | `IAsyncEnumerable<T>`, `Results.Stream` | |
| bulk writes | `ExecuteUpdateAsync`, `ExecuteDeleteAsync`, `SqlBulkCopy` | |
| bulk endpoints | `:batch` with limits | per-item results |
| sparse fields | `?fields=` | |

## Performance budgets in CI
| Check | Tool | When |
|:--|:--|:--|
| ⭐ k6 smoke with thresholds | `grafana/run-k6-action` | every PR |
| full load / stress | k6 vs staging | nightly |
| micro-benchmarks | BenchmarkDotNet JSON | on demand |
| frontend | Lighthouse CI | 02-frontend |
| keep results | artifacts, dashboards | compare runs |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| averages only | hide tails | p95/p99 |
| closed-model tests | hide overload | arrival rate |
| one test ID | all cache hits | realistic data |
| Debug benchmarks | wrong numbers | Release |
| in-memory state | breaks on scale-out | shared stores |
| local Data Protection keys | random logouts | shared key ring |
| replicas × pool > DB limit | connection failures | budget |
| replica reads after write | "not found" | primary |
| scale out to fix SQL | more load | tune queries |
| 85% utilisation | queueing collapse | headroom |
| unbounded list endpoints | huge payloads | paginate |

## Sources
| Source | Link |
|:--|:--|
| ASP.NET Core best practices | https://learn.microsoft.com/aspnet/core/fundamentals/best-practices |
| k6 docs | https://grafana.com/docs/k6/latest/ |
| BenchmarkDotNet | https://benchmarkdotnet.org/ |
| dotnet-counters | https://learn.microsoft.com/dotnet/core/diagnostics/dotnet-counters |
| Container Apps scaling | https://learn.microsoft.com/azure/container-apps/scale-app |
| YARP | https://learn.microsoft.com/aspnet/core/fundamentals/servers/yarp/yarp-overview |
| SignalR Redis backplane | https://learn.microsoft.com/aspnet/core/signalr/redis-backplane |
| Azure SQL read scale-out | https://learn.microsoft.com/azure/azure-sql/database/read-scale-out |
| Query Store | https://learn.microsoft.com/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store |
