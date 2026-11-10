---
title: Health checks and graceful shutdown
tech: ASP.NET Core health checks, generic host, Azure Container Apps
version: ASP.NET Core 10, AspNetCore.HealthChecks.* 9.x
date: 2026-11-09
covers: [6, 7]
---
# Health checks and graceful shutdown
[← Overview](00-overview.md)

## Why it matters
- The liveness probe checks SQL. During a 2-minute database failover, every replica fails liveness, so Container Apps restarts all of them, and the outage gets longer.
- A deploy kills old replicas while they still have requests in flight; 0.5% of checkouts fail on every release.
- A new revision is marked healthy before it has warmed up and connected to Redis; its first requests time out.

## Concepts

### Probe types
| Probe | Question | Failing means | Checks |
|:--|:--|:--|:--|
| ⭐ startup | has the app finished starting? | keep waiting (liveness and readiness don't run yet) | migrations checked, caches warmed |
| ⭐ liveness | is the process stuck? | **restart** the container | the process responds; nothing external |
| ⭐ readiness | can it serve traffic now? | stop sending traffic (no restart) | SQL, Redis, critical config |

Rule: **liveness never checks dependencies.** If the database is down, restarting the API doesn't help.

### ASP.NET Core health checks
| API | Does |
|:--|:--|
| `AddHealthChecks().AddCheck<T>("name", tags: ["ready"])` | register a check |
| `AddDbContextCheck<ShopDb>()` | EF Core check (Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore) |
| `AddSqlServer(cs)`, `AddRedis(cs)`, `AddAzureServiceBusQueue(...)` | community AspNetCore.HealthChecks.* packages |
| `MapHealthChecks("/health/ready", new() { Predicate = c => c.Tags.Contains("ready") })` | filtered endpoint |
| `HealthCheckResult.Healthy / Degraded / Unhealthy` | result; `Degraded` returns 200 by default |
| `ResultStatusCodes` | map statuses to HTTP codes |
| `AddCheck(..., timeout: TimeSpan)` | per-check timeout |
| `IHealthCheckPublisher` | push results periodically (Application Insights) |

Keep health endpoints anonymous but cheap and quiet: no details in the response body for the public, exclude them from request logs, and don't rate-limit them.

### Graceful shutdown
```mermaid
sequenceDiagram
  participant ACA as Container Apps
  participant App as Shop API
  ACA->>App: SIGTERM (revision scaling in or replaced)
  App->>App: ApplicationStopping: readiness → 503, delay ~5 s for ingress to notice
  App->>App: Kestrel stops accepting, drains in-flight requests
  App->>App: BackgroundServices get stoppingToken; Hangfire finishes or requeues jobs
  App-->>ACA: exit 0 (within ShutdownTimeout and the grace period)
  ACA->>App: SIGKILL if still running after the grace period
```
| Setting | Default | Note |
|:--|:--|:--|
| `HostOptions.ShutdownTimeout` | 30 s | total time for hosted services to stop |
| Container Apps `terminationGracePeriodSeconds` | 30 s | must be ≥ the app's shutdown time |
| `IHostApplicationLifetime.ApplicationStopping` | — | hook to flip readiness and log |
| `IHostedLifecycleService` (.NET 8+) | — | `StoppingAsync` / `StoppedAsync` hooks |

### Zero-downtime deploys on Container Apps
- **Revisions:** single-revision mode starts the new revision, waits for its probes, shifts traffic, then stops the old one. Multiple-revision mode allows traffic splitting for blue-green and canary releases (04-shipping/04-deployments).
- Backward-compatible database migrations (expand → migrate → contract) so old and new revisions can run side by side.
- Min replicas ≥ 2 in production, so one replica restarting doesn't take you offline.

## Example
`src/Shop.Api/Health/ReadinessGate.cs`
```csharp
using Microsoft.Extensions.Diagnostics.HealthChecks;

public sealed class ReadinessGate(IHostApplicationLifetime lifetime) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default) =>
        Task.FromResult(lifetime.ApplicationStopping.IsCancellationRequested
            ? HealthCheckResult.Unhealthy("shutting down")
            : HealthCheckResult.Healthy());
}
```
`src/Shop.Api/Program.cs`
```csharp
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

builder.Services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromSeconds(25));
builder.Services.AddHealthChecks()
    .AddCheck<ReadinessGate>("shutdown", tags: ["ready"])
    .AddDbContextCheck<ShopDb>("sql", tags: ["ready"])
    .AddRedis(builder.Configuration.GetConnectionString("Redis")!, "redis", HealthStatus.Degraded, tags: ["ready"],
              timeout: TimeSpan.FromSeconds(2));   // Redis down = degraded, still ready (cache fails open)

var app = builder.Build();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });   // process only
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") });

app.Lifetime.ApplicationStopping.Register(() => Thread.Sleep(TimeSpan.FromSeconds(5)));  // let ingress see "not ready"
```
The `Thread.Sleep` blocks the stopping callback on purpose. It keeps the server accepting requests for a few seconds while the ingress stops routing to this replica.

Bicep probes for the container (04-shipping/03-infrastructure-as-code):
```bicep
probes: [
  { type: 'Startup',   httpGet: { path: '/health/ready', port: 8080 }, periodSeconds: 5, failureThreshold: 24 }
  { type: 'Liveness',  httpGet: { path: '/health/live',  port: 8080 }, periodSeconds: 10, failureThreshold: 3 }
  { type: 'Readiness', httpGet: { path: '/health/ready', port: 8080 }, periodSeconds: 5,  failureThreshold: 2 }
]
```

## Production patterns
- Liveness = process only. Readiness = critical dependencies with short timeouts. Startup = generous, for slow boots.
- Non-critical dependencies (Redis as a cache, email) report `Degraded` rather than `Unhealthy`, so the replica keeps serving.
- Shutdown sequence tested: flip readiness, delay, drain, stop workers, exit before SIGKILL.
- At least two replicas, backward-compatible migrations, and revisions that must pass probes before they get traffic.

## Mistakes
Wrong:
```csharp
app.MapHealthChecks("/health");          // one endpoint used for liveness, checks SQL → restart storms
```
Right: separate `/health/live` (no checks) and `/health/ready` (tagged checks).

Wrong: long-running work ignoring `stoppingToken`, killed mid-write by SIGKILL.
Right: honour the token, keep units of work short, and rely on durable queues to pick up the rest.

## Check yourself
1. Why must liveness not check the database?
2. What happens between SIGTERM and SIGKILL in a well-behaved app?
3. Why report Redis as `Degraded` rather than `Unhealthy`?

<details><summary>Answers</summary>

1. A database outage would fail liveness on every replica, and the platform would restart all of them. That adds a restart storm and cold starts to an outage that restarts can't fix.
2. The app marks itself not ready, waits briefly so the ingress stops routing to it, stops accepting new connections, drains in-flight requests, lets background services stop (jobs finish or return to the queue), and exits before the grace period ends.
3. The cache fails open: requests still work (slower, straight from SQL). Taking replicas out of rotation because of a cache problem would turn a slowdown into an outage.
</details>

## Sources
- [Health checks in ASP.NET Core](https://learn.microsoft.com/aspnet/core/host-and-deploy/health-checks)
- [Health probes in Azure Container Apps](https://learn.microsoft.com/azure/container-apps/health-probes)
- [Revisions in Azure Container Apps](https://learn.microsoft.com/azure/container-apps/revisions)
- [.NET Generic Host — host shutdown](https://learn.microsoft.com/dotnet/core/extensions/generic-host#host-shutdown)
- [AspNetCore.Diagnostics.HealthChecks (Xabaril)](https://github.com/Xabaril/AspNetCore.Diagnostics.HealthChecks)
