---
title: System Design cheatsheet
tech: PostgreSQL 18, Redis 8, BullMQ, AWS
version: PostgreSQL 18, Redis 8 / Valkey, BullMQ 5, AWS; Kafka, Cassandra, DynamoDB, OpenSearch (also seen)
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# System Design cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## The method
| Step | Output |
|:--|:--|
| ⭐ Requirements | use cases, non-functional numbers, out of scope |
| ⭐ Estimates | QPS avg/peak, storage/year, bandwidth, cache |
| API | endpoints/events, pagination, idempotency |
| Data model | entities, keys, access patterns |
| ⭐ High-level design | diagram + one read and one write walked through |
| ⭐ Deep dives | 2–3 bottlenecks/failure modes |
| Wrap-up | trade-offs, 10×/100×, operability |

## Non-functional questions
| Ask about | Example |
|:--|:--|
| ⭐ Scale | DAU, requests/user/day, item size |
| ⭐ Latency | p95/p99 per operation |
| ⭐ Availability | 99.9%? which operations |
| Consistency | stale reads OK? how long |
| Durability | can data be lost |
| Ordering | per which key |
| Compliance | personal data, region, retention |
| Cost | budget, team |

## Estimation numbers
| Shortcut | Value |
|:--|:--|
| ⭐ Seconds/day | ~10⁵ (86,400) |
| ⭐ 1M/day | ~12/s |
| 1B/day | ~12,000/s |
| ⭐ Peak factor | 2–5× (10× launches) |
| 1 KB × 1M | 1 GB |
| 1 KB × 1B | 1 TB |
| Seconds/year | ~3 × 10⁷ |

## Latency orders of magnitude
| Operation | Time |
|:--|:--|
| Memory reference | ~100 ns |
| SSD random read | ~10–100 µs |
| ⭐ Same-AZ round trip | ~0.5 ms |
| ⭐ Redis GET (network) | ~0.5–1 ms |
| ⭐ Indexed Postgres query | ~1–5 ms |
| Read 1 MB from SSD | ~1 ms |
| Cross-AZ round trip | ~1–2 ms |
| ⭐ Cross-continent | ~100–150 ms |

## Capacity rules of thumb
| Component | Order of magnitude |
|:--|:--|
| Postgres primary | 10³–10⁴ simple queries/s |
| Redis node | ~10⁵ simple ops/s |
| Node.js process | 10²–10³ simple requests/s |
| ⭐ Rule | measure your own with load tests |

## Building blocks
| Block | Stack / also seen |
|:--|:--|
| DNS | Route 53 |
| ⭐ CDN | CloudFront |
| ⭐ Load balancer | ALB (L7), NLB (L4) |
| API gateway | ALB + middleware; API Gateway, Kong |
| ⭐ Stateless app servers | Express on ECS |
| ⭐ Cache | Redis/Valkey, CDN, in-process |
| ⭐ Relational DB | PostgreSQL |
| Object storage | S3 |
| ⭐ Queue | BullMQ, SQS |
| Pub/sub | SNS, EventBridge, Redis pub/sub |
| Stream / log | Kafka, Kinesis, Redis Streams |
| Search | Postgres FTS/pg_trgm, OpenSearch |
| Coordination | advisory locks; etcd, ZooKeeper |

## Storage types
| Type | Fits | Examples |
|:--|:--|:--|
| ⭐ Relational | transactions, joins, integrity | PostgreSQL |
| Document | aggregate-shaped, flexible | MongoDB, JSONB |
| ⭐ Key-value | fast lookups, TTL | Redis, DynamoDB |
| Wide-column | huge writes, fixed queries | Cassandra, ScyllaDB |
| Search | relevance, facets | OpenSearch |
| Time-series | metrics | Mimir, TimescaleDB |
| Graph | traversals | Neo4j |
| ⭐ Object | blobs | S3 |
| Columnar | analytics | Redshift, BigQuery, ClickHouse |
| ⭐ Default | Postgres + S3 + Redis | specialize with evidence |

## Caching layers
| Layer | Invalidation |
|:--|:--|
| Browser | hashed names, `max-age` |
| ⭐ CDN | TTL, purge, `s-maxage` |
| ⭐ Redis | delete on write, TTL, versioned keys |
| In-process | short TTL |
| DB buffer / materialized views | automatic / refresh |

## Scaling data
| Technique | Cost |
|:--|:--|
| Vertical | ceiling |
| ⭐ Read replicas | lag |
| ⭐ Cache | invalidation |
| Partitioning | key in queries |
| ⭐ Sharding | routing, cross-shard queries |
| Denormalized read models | update paths |

## Shard keys
| Strategy | Note |
|:--|:--|
| Hash | even, no ranges |
| Range | ranges, hot spots |
| Directory | flexible, extra lookup |
| ⭐ Consistent hashing | ~1/n keys move; virtual nodes |
| Tenant | locality, big tenants |
| avoid | `hash % n` when n changes |

## Hot keys
| Fix | Note |
|:--|:--|
| Cache + replicas | spread reads |
| Key splitting | `counter:42:{0..9}` |
| Request coalescing | single flight |
| Per-key rate limits | protect backends |

## Async patterns
| Pattern | Use |
|:--|:--|
| ⭐ Queue + workers | slow/retryable work |
| ⭐ Fan-out on write | precomputed feeds |
| Fan-out on read | celebrities, rare readers |
| ⭐ Hybrid fan-out | both |
| Streams | ordered, replayable |
| ⭐ Backpressure | bounded queues, shedding |
| Batching | fewer writes |
| ⭐ Idempotent consumers | at-least-once |

## API at scale
| Concern | Answer |
|:--|:--|
| ⭐ Abuse/overload | rate limits (token bucket, sliding window) |
| ⭐ Client retries | idempotency keys |
| Big lists | cursor pagination |
| Chatty clients | aggregate endpoints, BFF |
| Payload size | compression, field selection |
| Change | additive versions |

## Availability
| Technique | Against |
|:--|:--|
| ⭐ Multi-AZ redundancy | instance/AZ failure |
| Failover + health checks | dead nodes |
| Multi-region | regional outage |
| ⭐ Timeouts, retries, breakers | slow dependencies |
| Degradation, shedding | partial outages, overload |
| ⭐ Series availability | multiply (3 × 99.9% ≈ 99.7%) |
| Parallel redundancy | adds nines (2 × 99% ≈ 99.99%) |

## Security, privacy, cost in designs
| Area | Check |
|:--|:--|
| ⭐ Security | authN/authZ per endpoint, least privilege, TLS, encryption, secrets, rate limits, audit |
| ⭐ Privacy | minimization, inventory, retention, residency, deletion |
| ⭐ Cost | egress, cross-AZ, per-request services, idle capacity, log volume |

## Classic designs
| Design | Key ideas |
|:--|:--|
| ⭐ URL shortener | base62 IDs, cache hot codes, 302 for analytics, async clicks |
| ⭐ News feed | hybrid fan-out, Redis feed lists, cursor pagination |
| ⭐ Chat | WebSockets, persist then ack, pub/sub routing, per-conversation ordering, presence TTL |
| ⭐ Notifications | outbox → per-channel queues, preferences, idempotency, provider limits, priorities |
| Autocomplete | precomputed top-k per prefix, sorted sets/trie, debounce, CDN |
| Rate limiter | token bucket in Redis ([03-backend/05-validation-abuse](../../../03-backend/05-validation-abuse/README.md)) |
| File upload | presigned URLs, async processing ([03-backend/12-integrations](../../../03-backend/12-integrations/README.md)) |
| Payments | idempotency, webhooks, reconciliation |

## Communicating designs
| Tool | Use |
|:--|:--|
| ⭐ C4 model | context, containers, components, code |
| Mermaid | diagrams in markdown |
| Sequence diagrams | request paths |
| ⭐ Design doc | requirements with numbers, alternatives, risks |
| ADRs | decisions |
| `/design "<problem>"` | practice and record a DESIGN.md |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Tech before requirements | wrong components | numbers first |
| Averages only | peak overload | design for peak |
| `LIKE '%x%'` at scale | full scans | trigram index or search engine |
| NoSQL "for scale" with relational needs | reinvented joins | Postgres first |
| Shared caches for personal data | data leaks | per-user keys, `private` |
| `hash % n` sharding | mass key moves | consistent hashing |
| Synchronous fan-out | backlogs, slow writes | queue + hybrid fan-out |
| Ack before persist | lost messages | persist, then ack |
| Long synchronous chains | availability multiplies down | fewer hops, degradation |
| No cost estimate | surprise bills | estimate egress/storage/requests |

## Sources
| Source | Link |
|:--|:--|
| Designing Data-Intensive Applications | https://dataintensive.net/ |
| System Design Primer | https://github.com/donnemartin/system-design-primer |
| Latency numbers (interactive) | https://colin-scott.github.io/personal_website/research/interactive_latency.html |
| C4 model | https://c4model.com/ |
| AWS Well-Architected | https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html |
| Idempotency (Stripe) | https://stripe.com/blog/idempotency |
| Redis sorted sets | https://redis.io/docs/latest/develop/data-types/sorted-sets/ |
