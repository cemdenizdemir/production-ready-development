---
title: Scalability & Performance
module: 03-backend
tech: Node.js 26, PostgreSQL 18, Redis 8, k6
---
# Scalability & Performance
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Measure first: latency percentiles, throughput, saturation, and where the time goes
- [ ] ⭐ Load testing with k6: test types, open vs closed models, thresholds, realistic data
- [ ] ⭐ Stateless services and horizontal scaling; autoscaling on ECS
- [ ] ⭐ Database scaling: query tuning at scale, connection budgets and pooling, read replicas
- [ ] Offloading reads with CDNs, caches, and precomputation
- [ ] Node.js performance: CPU profiling, memory, worker threads, cluster vs containers
- [ ] Partitioning and sharding: Postgres table partitioning, when to shard
- [ ] Queues for throughput: async processing, absorbing spikes, scaling workers
- [ ] Capacity planning: Little's law, utilization headroom, shared limits
- [ ] Payloads and batching: pagination, lean DTOs, compression, bulk endpoints, streaming
- [ ] Scaling real-time connections: SSE and WebSockets with Redis pub/sub
- [ ] Performance budgets and load tests in CI

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Measuring and load testing with k6](docs/01-measuring-and-load-testing.md)
- [02 · Scaling Node.js: stateless tasks, profiling, worker threads, real-time](docs/02-scaling-nodejs.md)
- [03 · Scaling PostgreSQL: pooling, replicas, partitioning, sharding](docs/03-scaling-postgresql.md)
- [04 · Offloading work and capacity planning](docs/04-offloading-and-capacity.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 03-backend/09-scalability mode=tasks` when you are ready to build._
