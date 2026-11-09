---
title: Caching cheatsheet
tech: Redis 8
version: Redis 8.x (local), node-redis 5, AWS ElastiCache (Valkey / Redis OSS) in the cloud
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Caching cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Cache layers
| Layer | Good for | Watch out |
|:--|:--|:--|
| Browser | assets, public data | can't purge |
| ⭐ CDN | assets, public API responses | cache keys |
| In-process L1 | tiny, hot, stable data | per-instance, memory |
| ⭐ Redis L2 | shared computed data, sessions | network, eviction |
| DB buffer / materialized views | repeated queries | refresh |

## What to cache
| Cache | Avoid |
|:--|:--|
| ⭐ hot, expensive, rarely changing | must-be-exact data (balances, checkout stock) |
| slow external API results | per-user data under shared keys |
| aggregates, dashboards | data changing on nearly every read |
| reference data, flags | non-rebuildable data |

## Patterns
| Pattern | How | Note |
|:--|:--|:--|
| ⭐ Cache-aside | read cache → miss → load → set with TTL | default |
| Read-through | cache layer loads | library |
| Write-through | write DB + cache | warm, slower writes |
| Write-behind | cache then async DB | risky |
| Refresh-ahead | refresh before expiry | hot keys |
| ⭐ Negative caching | cache "not found" briefly | 30 s |
| Two-level | L1 seconds + L2 minutes | |

## Keys and values
| Practice | Example |
|:--|:--|
| ⭐ Namespaces | `shop:product:v2:{id}` |
| ⭐ Tenant/user scope | `shop:acct:{id}:dashboard` |
| ⭐ Version segment | `v2` → `v3` on shape change |
| ⭐ TTL on every key | `EX 300` + jitter |
| Small values | per-entity, needed fields |
| Serialization | JSON DTOs; MessagePack (also seen) |
| Hash tags in cluster | `{acct:1}:cart` same slot |

## Invalidation
| Strategy | Note |
|:--|:--|
| TTL only | bounded staleness |
| ⭐ Delete after DB write | not before |
| Delayed double delete | narrows races |
| Update on write | single writer |
| ⭐ Versioned keys | bulk invalidation, shape changes |
| Tag sets | `SADD tag:x key`, delete members |
| Pub/sub events | invalidate L1 on all instances |
| Keyspace notifications | react to expirations (configure carefully) |

## Stampede protection
| Technique | How |
|:--|:--|
| ⭐ Single flight | share in-flight promise per key |
| ⭐ Lock | `SET lock:k token NX PX 10000` |
| ⭐ Owner-checked release | Lua compare-and-delete (`DELEX IFEQ` in Redis 8.4+) |
| ⭐ Stale-while-revalidate | soft expiry in value, refresh in background |
| ⭐ TTL jitter | ±10% |
| Early refresh / XFetch | probabilistic refresh |
| Warm-up | prefill after deploy/flush |

## Redis commands (cache-relevant)
| Command | Use |
|:--|:--|
| ⭐ `SET k v EX n` / `GET` | cache entries |
| `SET … NX PX` | locks, first-writer-wins |
| `MGET` / `MSET` | batch |
| ⭐ `DEL` / `UNLINK` | invalidate (async free) |
| `EXPIRE` / `TTL` / `PERSIST` | lifetimes |
| `INCR` / `INCRBY` | counters |
| `HSET` / `HGET` / `HGETALL` / `HINCRBY` | object fields |
| `HEXPIRE` (7.4+) / `HGETEX` / `HSETEX` (8.0+) | per-field TTL |
| `SADD` / `SMEMBERS` / `SREM` | tags |
| `ZADD` / `ZRANGE … REV` / `ZREMRANGEBYSCORE` | rankings, windows |
| `PFADD` / `PFCOUNT` | unique counts |
| ⭐ `SCAN … MATCH … COUNT` | iterate keys (never `KEYS`) |
| `MULTI` / `EXEC` | batched atomic commands |
| `EVAL` | atomic scripts |
| `OBJECT ENCODING` / `MEMORY USAGE` | inspection |

## node-redis 5
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `createClient({ url })` + `await connect()` | client | |
| ⭐ `client.on('error', …)` | required listener | |
| `set(k, v, { EX, NX, PX })` | options object | |
| `get`, `del`, `expire`, `incr` | camelCase commands | |
| `hSet(k, obj)` / `hGetAll` | hashes | |
| `multi().set().sAdd().exec()` | transactions/pipelines | |
| `scanIterator({ MATCH, COUNT })` | async iteration | |
| `eval(script, { keys, arguments })` | Lua | |
| `sendCommand([...])` | raw commands | new commands, rate-limit-redis |
| RESP3 + client-side caching | local cache invalidated by server | v5 feature |
| ioredis | used by BullMQ | also seen |

## Operations
| Setting | Value / why |
|:--|:--|
| ⭐ `maxmemory` | explicit budget |
| ⭐ `allkeys-lru` / `allkeys-lfu` | pure caches |
| ⭐ `noeviction` | queues, sessions (BullMQ requires) |
| ⭐ Separate instances | cache vs durable data |
| Persistence | none/RDB for cache; AOF everysec for durable |
| Replication + failover | Multi-AZ |
| Cluster mode | sharding, hash tags |
| TLS + ACLs | security |
| `SLOWLOG` / `LATENCY DOCTOR` | slow commands |
| `--bigkeys` / `MEMORY USAGE` / `HOTKEYS` (8.6) | big and hot keys |
| `volatile-lrm` / `allkeys-lrm` | new eviction policies (8.6) |

## Redis 8 vs Valkey (ElastiCache)
| Feature | Redis 8 | Valkey (ElastiCache) |
|:--|:--|:--|
| Core strings/hashes/sets/zsets/streams | ✓ | ✓ |
| Hash field expiration | ✓ (7.4+) | ✓ (Valkey 9) |
| Built-in JSON / Search / vector sets | ✓ | modules vary: check |
| `DELEX` / `SET IFEQ` (8.4) | ✓ | check before use |
| License | tri-license incl. AGPLv3 | BSD |
| ⭐ Rule | prefer portable commands | |

## Measuring
| Metric | Source |
|:--|:--|
| ⭐ Hit ratio per cache | app counters `{cache, result}` |
| `keyspace_hits` / `keyspace_misses` | `INFO stats` |
| ⭐ Cache call latency p99 | traces/metrics |
| `used_memory` / `evicted_keys` / `expired_keys` | `INFO` |
| DB load before/after | DB metrics |
| Value sizes | sampling |

## HTTP caching for APIs
| Response | Cache-Control |
|:--|:--|
| ⭐ Public shared | `public, max-age=60, s-maxage=300, stale-while-revalidate=600` |
| ⭐ Per-user | `private, no-cache` |
| Sensitive | `no-store` |
| Default for API routes | `private, no-cache` |
| ⭐ Polled resources | cheap `ETag` → 304 |
| `Vary` | headers that change the response |
| `CDN-Cache-Control` | CDN-specific TTL |
| CloudFront cache policy | minimal key: needed query strings only |

## Pitfalls
| Pitfall | Fix |
|:--|:--|
| ⭐ Shared keys for personal data | scope keys by user/tenant |
| ⭐ No Cache-Control on dynamic responses | explicit headers |
| Stale after writes | invalidate after commit |
| ⭐ Unbounded key cardinality | TTL, normalize, cap |
| Long negative/error caching | short TTLs |
| JSON type loss | DTOs, explicit revival |
| Big values | per-entity |
| Cache as source of truth | rebuildable data only |
| Cold cache storms | warm-up, gradual version bumps |
| Inconsistent L1 | short TTL, pub/sub invalidation |
| Shared Redis for cache + queue | separate instances |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Delete-then-update | old value re-cached | update-then-delete |
| Plain `DEL` lock release | deletes others' locks | owner token check |
| `KEYS *` | blocks Redis | `SCAN` |
| Missing `'error'` listener | process crash | listen |
| Failing requests on cache errors | outage amplification | treat as miss |
| Global version bump at peak | DB stampede | off-peak, warm |
| Redis-8-only commands on Valkey | runtime errors | portable commands |

## Sources
| Source | Link |
|:--|:--|
| Redis caching | https://redis.io/solutions/caching/ |
| Redis commands | https://redis.io/docs/latest/commands/ |
| Redis eviction | https://redis.io/docs/latest/develop/reference/eviction/ |
| AWS caching strategies | https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html |
| node-redis | https://github.com/redis/node-redis |
| Valkey docs | https://valkey.io/docs/ |
| RFC 9111 | https://www.rfc-editor.org/rfc/rfc9111 |
