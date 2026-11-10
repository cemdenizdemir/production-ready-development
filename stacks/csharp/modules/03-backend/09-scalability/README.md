---
title: Scalability & Performance
module: 03-backend
tech: ASP.NET Core 10, SQL Server 2025, Redis 8, k6, BenchmarkDotNet, YARP
---
# Scalability & Performance
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Measure first: latency percentiles, throughput, saturation, and where the time goes
- [ ] ⭐ Load testing with k6: test types, open vs closed models, thresholds, realistic data
- [ ] ⭐ Micro-benchmarks with BenchmarkDotNet: setup, the memory diagnoser, avoiding misleading results
- [ ] ⭐ Stateless services and horizontal scaling; autoscaling on Azure Container Apps
- [ ] ⭐ Load balancing and traffic management: algorithms, sticky sessions, YARP, Azure Front Door, Application Gateway
- [ ] ⭐ Database scaling: query tuning at scale, connection budgets and pooling, read replicas
- [ ] Offloading reads with CDNs, caches, and precomputation
- [ ] .NET performance: allocations, GC pauses, `Span<T>`, `ArrayPool<T>`, async overhead
- [ ] Partitioning and sharding: SQL Server table partitioning, when to shard
- [ ] Queues for throughput: async processing, absorbing spikes, scaling workers
- [ ] Capacity planning: Little's law, utilization headroom, shared limits
- [ ] Payloads and batching: pagination, lean DTOs, compression, bulk endpoints, streaming
- [ ] Scaling real-time connections: SignalR with a Redis backplane or Azure SignalR Service
- [ ] Performance budgets and load tests in CI

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Measuring and load testing with k6](docs/01-measure-load-testing.md)
- [02 · BenchmarkDotNet and .NET runtime performance](docs/02-benchmarks-dotnet-performance.md)
- [03 · Stateless scaling, load balancing, and real-time connections](docs/03-horizontal-scaling-load-balancing.md)
- [04 · Scaling the database and offloading reads](docs/04-database-scaling-reads.md)
- [05 · Queues, capacity planning, payloads, and batching](docs/05-queues-capacity-payloads.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/09-scalability mode=tasks` when you are ready to build._
