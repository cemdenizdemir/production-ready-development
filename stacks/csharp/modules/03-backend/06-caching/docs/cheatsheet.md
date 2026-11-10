---
title: Caching cheatsheet
tech: HybridCache, IMemoryCache, Redis 8, output caching
version: Microsoft.Extensions.Caching.Hybrid 10.x, StackExchange.Redis 2.x, Redis 8 (local), Azure Managed Redis (cloud)
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Caching cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Cache layers
| Layer | Good for | Watch out |
|:--|:--|:--|
| browser | assets, public data | can't purge |
| ⭐ CDN (Front Door) | public responses | headers decide |
| output cache | whole anonymous GET responses | vary rules |
| ⭐ HybridCache L1 | hot data per instance | short TTL |
| ⭐ HybridCache L2 (Redis) | shared data | network hop |
| database | buffer pool | |

## What to cache
| Cache | Avoid |
|:--|:--|
| ⭐ hot, expensive, rarely changing | must-be-exact data (stock at checkout) |
| reference data, catalog | per-user data under shared keys |
| slow external API results | data changing on every read |
| aggregates | non-rebuildable data |

## .NET APIs
| API | Use | Note |
|:--|:--|:--|
| `IMemoryCache` | tiny local lookups | `SizeLimit` + entry `Size` |
| `IDistributedCache` | low-level byte[] | no stampede protection |
| ⭐ `HybridCache` | default app cache | L1 + L2 |
| `AddStackExchangeRedisCache` | L2 backend | `InstanceName` prefix |
| ⭐ `AddHybridCache(o => …)` | register | default options |
| ⭐ `GetOrCreateAsync(key, factory, options, tags, ct)` | cache-aside | coalesced |
| `SetAsync` | write-through | |
| ⭐ `RemoveAsync` / `RemoveByTagAsync` | invalidate | after commit |
| `Expiration` / `LocalCacheExpiration` | L2 / L1 TTL | |
| `MaximumPayloadBytes` | size cap | |
| FusionCache | backplane, fail-safe | also seen |

## Keys
| Practice | Example | Note |
|:--|:--|:--|
| ⭐ namespace + version | `product:v2:{slug}` | bump on shape change |
| ⭐ user/tenant in key | `dashboard:v1:{userId}` | no leaks |
| TTL always | `Expiration` | |
| small values | DTOs | not entities |
| negative caching | short TTL for "not found" | |

## Invalidation
| Strategy | How | Note |
|:--|:--|:--|
| ⭐ TTL | expire | baseline |
| ⭐ delete after commit | `RemoveAsync` | order matters |
| versioned keys | new version, old ages out | |
| ⭐ tags | `RemoveByTagAsync` | groups |
| events | outbox → consumers | multi-service |
| write-through | update on write | |

## Stampedes
| Defense | How | Note |
|:--|:--|:--|
| ⭐ coalescing | HybridCache built-in | per instance |
| jitter | +0–10% TTL | hot keys |
| stale-while-revalidate | serve old, refresh one | |
| distributed lock | `LockTakeAsync` / `SET NX PX` | expensive values |
| refresh-ahead | background job | |

## Write patterns
| Pattern | Use | Risk |
|:--|:--|:--|
| ⭐ cache-aside | default | race windows |
| write-through | read-after-write | complexity |
| write-behind | counters | data loss |
| read-through | `GetOrCreateAsync` | |
| refresh-ahead | known hot keys | |

## Output caching
| API | Does | Note |
|:--|:--|:--|
| ⭐ `AddOutputCache` + `UseOutputCache` | enable | after CORS/auth |
| `AddPolicy(name, b => …)` | named policy | |
| `.Expire(ts)` | TTL | |
| ⭐ `.SetVaryByQuery(...)` | per parameter | |
| `.SetVaryByHeader(...)` / `.SetVaryByRouteValue(...)` | variants | |
| ⭐ `.Tag("x")` + `EvictByTagAsync` | eviction | `IOutputCacheStore` |
| `.CacheOutput("name")` / `[OutputCache]` | per endpoint | |
| ⭐ `AddStackExchangeRedisOutputCache` | shared store | |
| defaults | 200 GET/HEAD, no auth, no cookies | |

## HTTP caching
| Response | Cache-Control | Note |
|:--|:--|:--|
| public catalog | `public, max-age=60, stale-while-revalidate=300` | + ETag |
| product | `public, max-age=300` | |
| ⭐ personal | `private, no-store` | |
| auth/checkout | `no-store` | |
| conditional | `ETag` + `If-None-Match` → 304 | |
| CDN TTL | `s-maxage` | |
| `Vary` | encoding, language | |

## Redis structures
| Structure | Commands | Use |
|:--|:--|:--|
| ⭐ string | `GET`/`SET EX`/`INCR` | DTOs, counters |
| hash | `HSET`/`HGET`/`HEXPIRE` | field objects |
| set | `SADD`/`SMEMBERS` | tags, membership |
| sorted set | `ZADD`/`ZRANGE` | rankings, windows |
| list / stream | `LPUSH`/`XADD` | light queues |
| pub/sub | `PUBLISH`/`SUBSCRIBE` | invalidation, backplane |

## StackExchange.Redis
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ `ConnectionMultiplexer` singleton | one per app | |
| `GetDatabase()` | per operation | cheap |
| async APIs | always | |
| `ScriptEvaluateAsync` | Lua atomics | rate limits |
| `LockTakeAsync` / `LockReleaseAsync` | locks | owner token |
| timeouts / reconnect | built in | configure |

## Redis operations
| Item | Setting | Note |
|:--|:--|:--|
| ⭐ `maxmemory-policy` | `allkeys-lru` / `allkeys-lfu` | not `noeviction` for caches |
| TTLs | every key | |
| ⭐ `SCAN` | iterate | never `KEYS` |
| `--bigkeys` / hot keys | inspect | |
| separate instances | cache vs sessions vs queues | |
| TLS + Entra auth + private endpoint | security | Azure Managed Redis |
| HA / zones | managed | |
| Valkey / versions | core commands portable | avoid niche commands |

## Measuring
| Metric | Source | Note |
|:--|:--|:--|
| ⭐ hit ratio | own counters / `keyspace_hits` | |
| latency | traces | Redis vs SQL span |
| memory, evictions | Azure Monitor / `INFO` | |
| SQL load | Query Store | before/after |
| `IMeterFactory` counters | custom metrics | `shop.cache.lookups` |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| invalidate before commit | old value re-cached | commit first |
| shared keys for user data | data leak | user in key |
| caching entities | tracking, size | DTOs |
| no TTL | stale forever | TTL always |
| `noeviction` | write failures | LRU/LFU |
| `KEYS *` | blocks Redis | `SCAN` |
| per-query cache keys | cardinality explosion | normalize/skip |
| long L1 TTL | cross-instance staleness | short L1 |
| output cache without vary | wrong pages | `SetVaryByQuery` |
| `public` on personal data | CDN leak | `private, no-store` |

## Sources
| Source | Link |
|:--|:--|
| HybridCache | https://learn.microsoft.com/aspnet/core/performance/caching/hybrid |
| Output caching | https://learn.microsoft.com/aspnet/core/performance/caching/output |
| Distributed caching | https://learn.microsoft.com/aspnet/core/performance/caching/distributed |
| Caching guidance | https://learn.microsoft.com/azure/architecture/best-practices/caching |
| Redis data types | https://redis.io/docs/latest/develop/data-types/ |
| Redis eviction | https://redis.io/docs/latest/develop/reference/eviction/ |
| StackExchange.Redis | https://stackexchange.github.io/StackExchange.Redis/ |
| Azure Managed Redis | https://learn.microsoft.com/azure/redis/overview |
| RFC 9111 | https://www.rfc-editor.org/rfc/rfc9111 |
