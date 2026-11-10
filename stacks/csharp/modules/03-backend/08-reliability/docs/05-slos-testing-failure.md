---
title: SLOs, error budgets, and testing failure
tech: Azure Monitor, Application Insights, Polly chaos strategies, Testcontainers, Azure Chaos Studio
version: Polly 8.3+, Testcontainers 4.x
date: 2026-11-09
covers: [12, 14]
---
# SLOs, error budgets, and testing failure
[← Overview](00-overview.md)

## Why it matters
- The team alerts on CPU > 80%. Checkout was failing for 5% of users for two hours with CPU at 40%, and nobody was paged.
- "Five nines" was promised with no measurement. Every release is now a fight between speed and stability with no data to settle it.
- The circuit breaker and fallback were never exercised. In the first real outage, the fallback threw `NullReferenceException`.

## Concepts

### SLIs, SLOs, error budgets
| Term | Meaning | Shop example |
|:--|:--|:--|
| ⭐ SLI | a ratio of good events to valid events | checkout requests that returned non-5xx in < 1 s ÷ all checkout requests |
| ⭐ SLO | target for an SLI over a window | 99.5% over 30 days |
| ⭐ error budget | 1 − SLO | 0.5% of checkouts in 30 days may be bad |
| SLA | contract with penalties | usually looser than the SLO |

| SLO | Budget per 30 days |
|:--|:--|
| 99% | 7 h 12 min |
| 99.5% | 3 h 36 min |
| 99.9% | 43 min |
| 99.95% | 21.6 min |
| 99.99% | 4.3 min |

Pick SLIs at the user's edge (API gateway or frontend), per user journey: browse, search, checkout, login. Use availability and latency SLIs for each.

**Error budget policy:** while budget remains, ship freely. When it's spent, focus on reliability work (pause risky launches, fix top incident causes).

### Burn-rate alerts
Burn rate = how fast you're spending the budget (1 = exactly on track to use it all in 30 days).
| Severity | Long window | Short window | Burn rate | Budget used |
|:--|:--|:--|:--|:--|
| ⭐ page | 1 h | 5 min | 14.4 | 2% in 1 hour |
| page | 6 h | 30 min | 6 | 5% in 6 hours |
| ticket | 3 days | 6 h | 1 | 10% in 3 days |
Both windows must exceed the threshold: the long window proves it matters, and the short one proves it's still happening. These alerts replace most cause-based alerts like CPU or memory.

### Testing failure
| Level | Tool | Example |
|:--|:--|:--|
| ⭐ unit/integration | fakes returning errors and delays | `FakeShippingClient` throws → fallback is used |
| ⭐ in-process fault injection | Polly chaos strategies | 10% of shipping calls get +3 s latency in staging |
| network faults | Toxiproxy (Testcontainers module) | latency/reset between API and SQL in a test |
| dependency kill | stop the Redis container in an integration test | API still serves from SQL |
| infrastructure chaos | Azure Chaos Studio | stop a Container Apps replica, fail over Azure SQL, block network |
| load + failure | k6 while injecting faults | does shedding hold p99? (09-scalability) |
| ⭐ game day | scheduled team exercise | "Redis is down": follow the runbook, time detection and recovery |

Chaos experiments start with a **hypothesis** ("if Redis is down, checkout p99 stays < 1.5 s and the error rate < 0.1%"), a limited blast radius, an abort switch, and monitoring in place.

## Example
`src/Shop.Api/Program.cs` (chaos in staging, controlled by config)
```csharp
using Microsoft.Extensions.Http.Resilience;
using Polly;

var chaos = builder.Configuration.GetSection("Chaos").Get<ChaosOptions>() ?? new();
builder.Services.AddHttpClient<ShippingClient>(c => c.BaseAddress = new Uri(builder.Configuration["Shipping:BaseUrl"]!))
    .AddResilienceHandler("shipping", b =>
    {
        b.AddTimeout(TimeSpan.FromSeconds(5));                               // total
        b.AddRetry(new HttpRetryStrategyOptions { MaxRetryAttempts = 2, UseJitter = true, BackoffType = DelayBackoffType.Exponential });
        b.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions { FailureRatio = 0.2, MinimumThroughput = 20, SamplingDuration = TimeSpan.FromSeconds(30) });
        b.AddTimeout(TimeSpan.FromSeconds(2));                               // per attempt
        if (chaos.Enabled)                                                   // innermost: faults look like real network issues
        {
            b.AddChaosLatency(chaos.LatencyRate, TimeSpan.FromSeconds(3));
            b.AddChaosFault(chaos.FaultRate, () => new HttpRequestException("chaos: injected fault"));
        }
    });

public sealed class ChaosOptions { public bool Enabled { get; init; } public double LatencyRate { get; init; } = 0.1; public double FaultRate { get; init; } = 0.05; }
```
`tests/Shop.Api.Tests/RedisOutageTests.cs`
```csharp
public sealed class RedisOutageTests(ShopApiFactory factory) : IClassFixture<ShopApiFactory>
{
    [Fact]
    public async Task Product_page_still_works_when_Redis_is_down()
    {
        var client = factory.CreateClient();
        await factory.Redis.StopAsync(TestContext.Current.CancellationToken);    // Testcontainers Redis container

        var response = await client.GetAsync("/products/1", TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
```
Burn-rate alert query (Application Insights, KQL) for the checkout SLO:
```kusto
let slo = 0.995;
requests
| where timestamp > ago(1h) and name has "POST /orders"
| summarize total = count(), bad = countif(toint(resultCode) >= 500 or duration > 1000)
| extend burn = (todouble(bad) / total) / (1 - slo)
| where burn > 14.4
```
Pair it with the same query over 5 minutes, and alert only when both fire (10-observability).

## Production patterns
- Two to four SLOs per critical journey, owned by the team, reviewed monthly, with an error budget policy everyone agreed to.
- Paging alerts are burn-rate alerts on SLOs. Cause-based signals (CPU, pool usage) go on dashboards and become tickets.
- Every fallback, circuit breaker, and outage plan has an automated test. Chaos runs in staging and game days happen quarterly.
- Postmortems feed the reliability backlog when the error budget burns (04-shipping/06-incident-response).

## Mistakes
Wrong: an SLO of 100%, or one measured on server CPU.
Right: a user-facing SLI with a realistic target below 100%, leaving budget for change.

Wrong: chaos in production first, with no hypothesis or abort switch.
Right: start in tests and staging, small blast radius, monitoring ready, abort criteria written.

## Check yourself
1. What is the error budget for a 99.9% monthly SLO, in minutes?
2. Why do burn-rate alerts use two windows?
3. What four things does a chaos experiment need before it runs?

<details><summary>Answers</summary>

1. About 43 minutes per 30 days (0.1% of 43,200 minutes).
2. The long window shows the problem is big enough to matter; the short window shows it's still happening, so the alert resolves quickly after recovery and doesn't page for old spikes.
3. A hypothesis about steady state, a limited blast radius, monitoring to observe it, and an abort switch (stop criteria).
</details>

## Sources
- [Google SRE workbook — Implementing SLOs](https://sre.google/workbook/implementing-slos/)
- [Google SRE workbook — Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
- [Polly — Chaos engineering](https://www.pollydocs.org/chaos/)
- [Azure Chaos Studio](https://learn.microsoft.com/azure/chaos-studio/chaos-studio-overview)
- [Testcontainers for .NET](https://dotnet.testcontainers.org/)
- [Principles of chaos engineering](https://principlesofchaos.org/)
