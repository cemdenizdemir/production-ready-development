---
title: Distributed Systems cheatsheet
tech: SQL Server 2025, Redis 8, Azure Service Bus
version: SQL Server 2025 / Azure SQL, Redis 8 / Azure Managed Redis, Azure.Messaging.ServiceBus 7.x, C# 14
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Distributed Systems cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Fallacies
| Fallacy | Reality | Response |
|:--|:--|:--|
| ⭐ network is reliable | drops, resets | timeouts, retries, idempotency |
| ⭐ latency is zero | tails are long | fewer hops, batching |
| bandwidth is infinite | payloads cost | lean payloads |
| network is secure | it isn't | TLS, auth |
| topology is static | it changes | health checks, discovery |
| one administrator | many owners | contracts |
| transport is free | serialisation, egress | measure |
| homogeneous network | mixed clients | standards |

## Call outcomes
| Outcome | Handle | Note |
|:--|:--|:--|
| ⭐ success | proceed | |
| ⭐ definite failure | error path | 4xx, refused |
| ⭐ unknown | idempotent retry / status query / reconcile | timeouts |

## CAP and PACELC
| Term | Means | Note |
|:--|:--|:--|
| ⭐ CAP | in a partition: consistency or availability | partitions only |
| ⭐ PACELC | else: latency or consistency | everyday trade-off |
| CP behaviour | reject/queue writes without quorum | primary DB |
| AP behaviour | answer with possibly stale data | caches, replicas |

## Consistency models
| Model | Guarantee | Use for |
|:--|:--|:--|
| ⭐ linearizable | latest write always visible | stock, payments |
| sequential | same order everywhere | |
| causal | cause before effect | replies, comments |
| ⭐ read-your-writes | see your own changes | profile, address |
| monotonic reads | never go back in time | page navigation |
| ⭐ eventual | converges | listings, search, read models |

## Replication
| Topology | Pros | Cons |
|:--|:--|:--|
| ⭐ single leader | simple, no conflicts | write bottleneck, failover |
| multi-leader | local writes | ⭐ conflicts |
| leaderless | high availability | quorums, eventual |
| ⭐ sync | no loss on failover | latency |
| ⭐ async | fast | RPO > 0, lag |
| quorum W + R > N | overlap guarantee | |

## Partitioning
| Strategy | Good for | Risk |
|:--|:--|:--|
| ⭐ hash | even spread | range queries |
| ⭐ range | time queries, archiving | hot newest partition |
| tenant/list | isolation | uneven tenants |
| ⭐ key choice | high cardinality, access pattern | skew |
| rebalancing | node changes | data movement |

## Time and ordering
| Tool | Gives | Limit |
|:--|:--|:--|
| ⭐ wall clock | human time | skew, jumps |
| monotonic clock | local durations | one machine |
| ⭐ Lamport clock | causal total order | no concurrency detection |
| vector clock | concurrency detection | size |
| HLC | wall-time-ish + causality | |
| ⭐ aggregate version | per-entity order | one aggregate |
| ⭐ Service Bus sessions | FIFO per session | per session |
| DB sequence | total order | single source |

## Coordination
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ consensus (Raft/Paxos) | agreement under failures | use systems that have it |
| leader election | one active worker | leases |
| ⭐ `sp_getapplock` | SQL app lock | session/transaction scope |
| Redis `SET NX PX` | efficiency locks | not correctness alone |
| Blob lease | leader election | 15–60 s / infinite |
| ⭐ fencing token | reject stale holders | resource checks it |
| Hangfire `DisableConcurrentExecution` | one job at a time | SQL lock |

## Delivery guarantees
| Guarantee | How | Risk |
|:--|:--|:--|
| at-most-once | ack first | ⭐ loss |
| ⭐ at-least-once | ack after work | duplicates |
| exactly-once delivery | | not achievable end to end |
| ⭐ effectively-once | at-least-once + idempotency | the goal |
| receive-and-delete | Service Bus at-most-once | avoid for business |
| ⭐ peek-lock + complete | Service Bus at-least-once | default |

## Idempotent consumers
| Technique | Example | Note |
|:--|:--|:--|
| ⭐ inbox table | unique (MessageId, Handler) | same transaction |
| ⭐ conditional updates | `WHERE Status = 'Placed'` | natural idempotency |
| upserts | MERGE / insert-if-absent | |
| version checks | apply only newer | |
| downstream keys | Stripe idempotency keys | |
| broker dedupe | `MessageId` window | first filter only |

## Distributed transactions
| Approach | Use when | Note |
|:--|:--|:--|
| local transaction | one database | prefer |
| 2PC | all participants support it | rare, blocking |
| ⭐ saga (orchestrated) | multi-step with compensations | visible state |
| ⭐ saga (choreographed) | simple reactions | implicit flow |
| ⭐ compensation | undo by new action | refund, release |
| deadlines | stuck sagas | compensate on timeout |
| irreversible steps last | emails, carrier labels | |

## Event sourcing
| Concept | Means | Note |
|:--|:--|:--|
| ⭐ event stream | append-only per aggregate | expected version |
| ⭐ rehydrate | replay to rebuild | |
| ⭐ snapshot | saved state every N | faster loads |
| ⭐ projection | read model from events | rebuildable |
| ⭐ upcasting | old → new shape on read | never edit events |
| replay | rebuild projections | idempotent handlers |
| crypto-shredding | GDPR erasure | per-user keys |

## Testing distributed behaviour
| Test | How | Note |
|:--|:--|:--|
| ⭐ duplicates | same message, sequential + concurrent | races |
| ⭐ reordering | all permutations | latest wins |
| delays | latency injection | timeouts |
| ⭐ partial failure | fail after step N | recovery |
| unknown outcomes | lost responses | idempotent retry |
| ⭐ compensations | fail each saga step | |
| poison | malformed payload | DLQ |
| time | `FakeTimeProvider` | deadlines |
| ⭐ reconciliation | scheduled checks | production net |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| timeout = failure | double charges | treat as unknown |
| replica read after write | stale data | read-your-writes |
| wall-clock ordering | wrong order | versions, sessions |
| multi-leader for invariants | conflicts | single leader |
| lock without fencing | two holders | fencing tokens |
| ack before work | lost messages | complete after commit |
| check-then-insert dedupe | races | unique constraint |
| no compensations | stuck orders | sagas |
| editing stored events | broken replays | upcasting |
| happy-path tests only | prod surprises | failure tests |

## Sources
| Source | Link |
|:--|:--|
| DDIA | https://dataintensive.net/ |
| Jepsen consistency | https://jepsen.io/consistency |
| Distributed locking (Kleppmann) | https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html |
| Raft | https://raft.github.io/ |
| Lamport clocks | https://lamport.azurewebsites.net/pubs/time-clocks.pdf |
| Saga pattern | https://learn.microsoft.com/azure/architecture/reference-architectures/saga/saga |
| Event sourcing | https://learn.microsoft.com/azure/architecture/patterns/event-sourcing |
| Service Bus settlement | https://learn.microsoft.com/azure/service-bus-messaging/message-transfers-locks-settlement |
| PACELC | https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf |
