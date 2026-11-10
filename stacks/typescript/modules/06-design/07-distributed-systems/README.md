---
title: Distributed Systems
module: 06-design
tech: PostgreSQL 18, Redis 8, BullMQ
---
# Distributed Systems
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ The fallacies of distributed computing; partial failure and unknown outcomes
- [ ] ⭐ CAP and PACELC
- [ ] ⭐ Consistency models: linearizable, sequential, causal, read-your-writes, eventual
- [ ] Replication: single leader, multi-leader, leaderless, quorums, replication lag
- [ ] Partitioning and rebalancing
- [ ] Time and ordering: clock skew, Lamport and vector clocks, hybrid clocks, per-aggregate versions
- [ ] Consensus and coordination: Raft, leader election, distributed locks, fencing tokens
- [ ] ⭐ Delivery guarantees: at-most-once, at-least-once, effectively-once; idempotent consumers
- [ ] ⭐ Distributed transactions: 2PC vs sagas (choreography, orchestration), compensations
- [ ] CQRS and event sourcing in depth: projections, snapshots, upcasting, replays
- [ ] Testing distributed behavior: duplicates, reordering, fault injection, reconciliation

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Partial failure, CAP and PACELC, consistency models](docs/01-failure-cap-consistency.md)
- [02 · Replication, partitioning, and time](docs/02-replication-partitioning-time.md)
- [03 · Consensus, distributed locks, and delivery guarantees](docs/03-consensus-locks-delivery.md)
- [04 · Sagas, CQRS, event sourcing, and testing distributed behavior](docs/04-sagas-cqrs-event-sourcing.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn typescript/06-design/07-distributed-systems mode=tasks` when you are ready to build._
