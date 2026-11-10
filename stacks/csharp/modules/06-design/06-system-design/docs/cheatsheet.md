---
title: System Design cheatsheet
tech: SQL Server 2025, Redis 8, Azure Service Bus, Azure
version: SQL Server 2025 / Azure SQL, Redis 8 / Azure Managed Redis, Azure Service Bus, Azure (November 2026)
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# System Design cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## The method
| Step | Output | Note |
|:--|:--|:--|
| ⭐ requirements | functional, non-functional, out of scope | ask first |
| ⭐ estimates | QPS, storage, bandwidth | orders of magnitude |
| ⭐ API | endpoints/events | |
| ⭐ data model | entities, keys, access patterns | picks the store |
| ⭐ high-level design | boxes + labelled arrows | covers all requirements |
| ⭐ deep dives | bottlenecks, failures | the hard part |
| ⭐ trade-offs | why, and what at 10× | |

## Estimation
| Rule | Value | Note |
|:--|:--|:--|
| ⭐ seconds/day | ~10^5 | |
| ⭐ QPS | per day ÷ 10^5 | |
| peak | 2–10× average | campaigns more |
| storage | items × size × days × replicas | |
| bandwidth | QPS × payload | |
| 1 million/day | ~12/s | |
| 100 million/day | ~1,200/s | |

## Latency orders of magnitude
| Operation | ~Time | Note |
|:--|:--|:--|
| memory reference | 100 ns | |
| 1 MB from memory | 10 µs | |
| SSD random read | 100 µs | |
| ⭐ same-region round trip | 0.5–1 ms | |
| ⭐ Redis GET | ~1 ms | |
| ⭐ indexed SQL query | 1–5 ms | |
| 1 MB from SSD | 1 ms | |
| ⭐ cross-continent | 100–150 ms | |

## Building blocks
| Block | Use when | Azure |
|:--|:--|:--|
| ⭐ CDN | static/public content | Front Door |
| ⭐ load balancer | spread over replicas | Front Door, ACA ingress, App Gateway |
| ⭐ API gateway | auth, limits, routing | APIM, YARP |
| ⭐ stateless services | logic, scale out | Container Apps |
| ⭐ cache | hot reads | Managed Redis + HybridCache |
| ⭐ queue/topic | async, spikes, decoupling | Service Bus |
| stream | ordered, replayable events | Event Hubs |
| ⭐ object storage | files | Blob Storage |
| ⭐ search | text, facets, autocomplete | Azure AI Search |
| real-time | WebSockets at scale | SignalR Service |

## Storage choices
| Type | Use for | Azure |
|:--|:--|:--|
| ⭐ relational | system of record, transactions | Azure SQL |
| document | flexible schemas | Cosmos DB, SQL `json` |
| ⭐ key-value | cache, sessions, counters | Redis |
| wide-column | huge write volumes | Cosmos DB (Cassandra) |
| ⭐ search | relevance, facets | AI Search |
| time-series | metrics, tracking | Data Explorer |
| ⭐ object | blobs | Blob Storage |
| vector | similarity | SQL Server 2025 `vector`, AI Search |

## Scaling data
| Technique | Use when | Cost |
|:--|:--|:--|
| ⭐ tune + index | always first | |
| ⭐ cache | hot reads | staleness |
| ⭐ read replicas | read-heavy | lag |
| vertical scale | quick headroom | ceiling |
| ⭐ partitioning | huge tables | cross-partition queries |
| ⭐ sharding | write scale beyond one DB | joins, rebalancing |
| ⭐ consistent hashing | adding nodes moves ~1/N keys | complexity |
| directory sharding | flexible placement | lookup dependency |
| hot key mitigation | skewed traffic | split, L1 cache |

## Caching strategies
| Strategy | Use when | Note |
|:--|:--|:--|
| ⭐ cache-aside | default | delete on write |
| read/write-through | library supports it | |
| write-behind | counters, analytics | loss risk |
| refresh-ahead | predictable hot keys | |
| ⭐ stampede protection | hot keys expiring | coalescing, jitter |
| ⭐ edge caching | public content | versioned URLs |

## Async processing
| Pattern | Use when | Azure |
|:--|:--|:--|
| ⭐ work queue | one consumer per task | Service Bus queue |
| ⭐ pub/sub | many consumers per event | Service Bus topics |
| ⭐ stream | replay, ordering, analytics | Event Hubs |
| ⭐ fan-out | one → many | topic + workers, batches |
| fan-out on write | read-heavy feeds | celebrity problem |
| fan-out on read | huge follower counts | slower reads |
| ⭐ backpressure | consumers behind | bounded queues, scaling |
| batching | many small items | fewer calls |

## Rate limiting
| Algorithm | Behaviour | Use |
|:--|:--|:--|
| fixed window | simple, edge bursts | quotas |
| ⭐ sliding window | smooth | per-user limits |
| ⭐ token bucket | bursts + average | APIs |
| leaky bucket | constant outflow | smoothing |
| concurrency | in-flight cap | expensive endpoints |
| where | edge (WAF), app, Redis (global) | |
| ⭐ `429` + `Retry-After` | client contract | |

## API at scale
| Practice | Why | Note |
|:--|:--|:--|
| ⭐ idempotency keys | safe retries | store key → response |
| ⭐ idempotent consumers | duplicates | inbox |
| ⭐ cursor pagination | large lists | max page size |
| `202` + status URL | long work | |
| ETags | caching, concurrency | `If-None-Match`, `If-Match` |
| bulk endpoints | fewer calls | limits |
| additive versioning | compatibility | |

## Availability
| Rule | Formula | Example |
|:--|:--|:--|
| ⭐ serial | product of parts | 0.999³ ≈ 0.997 |
| ⭐ parallel | 1 − (1 − a)^n | two 0.999 ≈ 0.999999 |
| ⭐ 99.9% | ~43 min/month | |
| 99.95% | ~22 min/month | |
| 99.99% | ~4.3 min/month | |
| ⭐ off the critical path | fallbacks, async | caches fail open |
| failover | active-passive / active-active | regions |

## Security, privacy, cost
| Area | Ask | Note |
|:--|:--|:--|
| ⭐ trust boundaries | where is auth enforced? | every entry |
| least privilege | which identity can do what? | managed identities |
| abuse | scraping, enumeration, fraud | limits, WAF |
| ⭐ personal data | what, where, who, how long | GDPR |
| residency | which region | |
| ⭐ cost drivers | compute, DB, egress, logs | per 1,000 orders |
| threat model | STRIDE on data flows | |

## Classic designs
| Design | Key decisions | Note |
|:--|:--|:--|
| ⭐ URL shortener | ID gen (counter + Base62), cache, 301 vs 302 | async analytics |
| ⭐ news feed | fan-out on write/read/hybrid | cursor pages |
| ⭐ chat | WebSockets (SignalR Service), per-conversation seq | resend from last seen |
| ⭐ notifications | event → preferences → channel queues | idempotent senders |
| ⭐ autocomplete | trie / suggester, popular-prefix cache | debounce UI |

## Communicating
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ C4 context | system + users + externals | |
| ⭐ C4 container | deployables + stores | most useful |
| C4 component | inside one container | sparingly |
| Mermaid | diagrams as code | in docs |
| design doc / ADR | decisions | 05-practice |
| interviews | think aloud, check in | timebox steps |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| designing before requirements | wrong problem | ask first |
| no estimates | over/under-building | numbers |
| `LIKE '%x%'` search | full scans | search engine |
| cache as source of truth | data loss | DB of record |
| `hash % n` sharding | mass rebalancing | consistent hashing |
| hot keys | one node saturated | split, L1 |
| sync fan-out | timeouts | queues |
| no idempotency | duplicate orders | keys |
| ignoring serial availability | broken promises | compute the chain |
| unlabelled diagrams | confusion | C4 + labels |

## Sources
| Source | Link |
|:--|:--|
| Azure Architecture Center | https://learn.microsoft.com/azure/architecture/ |
| Choose a data store | https://learn.microsoft.com/azure/architecture/guide/technology-choices/data-store-overview |
| Cloud design patterns | https://learn.microsoft.com/azure/architecture/patterns/ |
| Latency numbers | https://gist.github.com/jboner/2841832 |
| C4 model | https://c4model.com/ |
| DDIA | https://dataintensive.net/ |
| Sharding pattern | https://learn.microsoft.com/azure/architecture/patterns/sharding |
| Rate limiting pattern | https://learn.microsoft.com/azure/architecture/patterns/rate-limiting-pattern |
