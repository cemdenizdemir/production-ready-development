---
title: Distributed Systems cheatsheet
tech: PostgreSQL 18, Redis 8, BullMQ
version: PostgreSQL 18, Redis 8 / Valkey, BullMQ 5; etcd, Kafka, Temporal, EventStoreDB (also seen)
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Distributed Systems cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Fallacies of distributed computing
| Fallacy | Reality |
|:--|:--|
| ⭐ Network is reliable | drops, resets |
| ⭐ Latency is zero | tails in seconds |
| Bandwidth is infinite | saturation |
| Network is secure | encrypt + authenticate |
| Topology doesn't change | constant change |
| One administrator | many teams/providers |
| Transport cost is zero | serialization, egress |
| Network is homogeneous | mixed versions |

## Partial failure
| Fact | Response |
|:--|:--|
| ⭐ Remote call outcomes | success, failure, unknown |
| ⭐ Timeout = unknown | idempotency key, lookup, reconciliation |
| Slow ≈ dead | timeouts, health checks |
| Process pauses (GC) | leases can expire mid-work |

## CAP and PACELC
| Theorem | Choice |
|:--|:--|
| ⭐ CAP | during a partition: consistency or availability |
| ⭐ PACELC | partition: A or C; else: latency or consistency |
| CAP "C" | linearizability |
| Labels | describe configs and operations, not products |

## Consistency models
| Model | Guarantee |
|:--|:--|
| ⭐ Linearizable | latest write, single-copy behavior |
| Sequential | same order for everyone |
| Causal | cause before effect |
| ⭐ Read-your-writes | see your own writes |
| Monotonic reads | never go back in time |
| ⭐ Eventual | converges when writes stop |
| Isolation levels (one DB) | read committed, repeatable read, serializable |

## Replication
| Style | Note |
|:--|:--|
| ⭐ Single leader | simple; failover |
| Multi-leader | conflicts |
| Leaderless | quorums, eventual |
| ⭐ Sync | no loss on failover, slower writes |
| ⭐ Async | fast, lag, possible loss |
| Quorum rule | W + R > N |
| RDS Multi-AZ instance | synchronous standby |
| RDS read replicas | asynchronous |

## Replication lag fixes
| Anomaly | Fix |
|:--|:--|
| ⭐ Stale own writes | read-your-writes (primary after writes) |
| Non-monotonic reads | sticky replica per session |
| Causality violations | causal tokens, read from leader |
| Monitoring | `pg_stat_replication`, `pg_last_xact_replay_timestamp()` |

## Partitioning
| Strategy | Note |
|:--|:--|
| Range | scans, hot ranges |
| ⭐ Hash | even, no ranges |
| ⭐ Consistent hashing | ~1/n movement |
| Composite | tenant + time |
| Local secondary index | scatter-gather reads |
| Global secondary index | async updates |
| Rebalancing | fixed partitions moved, or splitting |

## Time and ordering
| Concept | Use |
|:--|:--|
| Wall clock | display, not ordering |
| ⭐ Monotonic clock | durations (`performance.now()`) |
| Lamport clock | total order consistent with causality |
| Vector clock | detect concurrent updates |
| Hybrid logical clock | CockroachDB, MongoDB |
| TrueTime | Spanner |
| Last write wins | simple, drops concurrent writes |
| CRDTs | conflict-free merges (Automerge, Yjs) |
| ⭐ Per-aggregate versions | practical ordering |

## Consensus
| Concept | Note |
|:--|:--|
| ⭐ Raft / Paxos / Zab | consensus algorithms |
| Leader election | one coordinator |
| Replicated log | same commands, same order |
| ⭐ Quorum | 3 nodes tolerate 1 failure, 5 tolerate 2 |
| Term / epoch | leader period number |
| Tools | etcd, Consul, ZooKeeper, Kafka KRaft |
| ⭐ Rule | never implement it yourself |

## Locks and leases
| Approach | Safety |
|:--|:--|
| ⭐ Postgres advisory lock | strong (one DB) |
| ⭐ `FOR UPDATE SKIP LOCKED` | strong per row |
| ⭐ Unique "claim" rows | strong |
| Redis `SET NX PX` | lease, best effort |
| Redlock | lease (debated) |
| etcd lease + fencing token | strong |
| ⭐ Fencing token | resource rejects stale holders |
| Owner-checked release | compare-and-delete |

## Delivery guarantees
| Guarantee | How |
|:--|:--|
| At-most-once | ack before work |
| ⭐ At-least-once | ack after work, retries |
| Exactly-once delivery | impossible in general |
| ⭐ Effectively-once | at-least-once + idempotent consumer |
| Exactly-once in one system | transactions (outbox + dedupe, Kafka transactions) |
| Ordering | per partition/key at best |

## Idempotency techniques
| Technique | Example |
|:--|:--|
| ⭐ Dedupe table | `processed_messages (consumer, message_id)` |
| ⭐ Idempotency keys | provider APIs |
| Upserts | `ON CONFLICT DO UPDATE` |
| Conditional updates | `WHERE version = n` |
| Natural keys | one invoice per (account, month) |

## 2PC vs sagas
| | 2PC | ⭐ Saga |
|:--|:--|:--|
| Atomicity | yes | no; compensations |
| Availability | blocks on coordinator | high |
| External services | unsupported | works with idempotent APIs |
| Intermediate states | hidden | visible (semantic locks) |

## Saga design
| Rule | Detail |
|:--|:--|
| ⭐ Compensations | semantic undo (refund, release) |
| ⭐ Idempotent steps | retries everywhere |
| Pivot step | only forward after it |
| Timeouts | compensate or alert |
| Persisted state | resume after restarts |
| Choreography | events, few steps |
| ⭐ Orchestration | state machine, many steps |
| Workflow engines | Temporal, Step Functions (also seen) |

## CQRS and event sourcing
| Term | Meaning |
|:--|:--|
| Command side | changes aggregates |
| Query side | read models |
| ⭐ Projection | builds read models from events |
| Event store | append-only per-aggregate streams |
| Rehydration | replay events → state |
| Snapshot | faster rehydration |
| Upcasting | migrate old event versions |
| Replay | rebuild projections |
| Tools | EventStoreDB, Marten, Axon (also seen) |

## Testing distributed behavior
| Technique | Finds |
|:--|:--|
| ⭐ Run handlers twice | idempotency bugs |
| ⭐ Reorder + duplicate events | ordering bugs |
| ⭐ Fault injection | crashes between steps |
| Concurrent commands | lost updates |
| Property-based tests | invariant violations (fast-check) |
| Jepsen analyses | database consistency claims |
| Deterministic simulation | rare interleavings (Antithesis) |
| ⭐ Reconciliation | what tests missed |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Timeout treated as failure | duplicate side effects | resolve unknowns |
| Replica reads after writes | stale UI | read-your-writes |
| Clock-based ordering | lost updates | versions/sequences |
| TTL lock for correctness | double execution | DB constraints, fencing |
| Plain `DEL` unlock | deletes others' locks | owner check |
| Ack before processing | lost work | ack after, dedupe |
| "Exactly-once" promises | false confidence | effectively-once |
| 2PC with external APIs | unsupported, blocking | sagas |
| Technical compensations | lost history | semantic undo |
| Saga state in memory | lost on restart | persisted state machine |

## Sources
| Source | Link |
|:--|:--|
| Designing Data-Intensive Applications | https://dataintensive.net/ |
| Jepsen consistency models | https://jepsen.io/consistency |
| PACELC | https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf |
| Raft | https://raft.github.io/ |
| Distributed locking (Kleppmann) | https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html |
| Saga pattern | https://microservices.io/patterns/data/saga.html |
| Event sourcing | https://martinfowler.com/eaaDev/EventSourcing.html |
