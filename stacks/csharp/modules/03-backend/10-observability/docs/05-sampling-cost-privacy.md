---
title: Sampling, cost, and privacy in telemetry
tech: OpenTelemetry .NET, Azure Monitor, Microsoft.Extensions.Compliance.Redaction, Microsoft.Extensions.Telemetry
version: OpenTelemetry .NET 1.x, Microsoft.Extensions.Telemetry 10.x, Microsoft.Extensions.Compliance.Redaction 10.x
date: 2026-11-09
covers: [12, 14]
---
# Sampling, cost, and privacy in telemetry
[← Overview](00-overview.md)

## Why it matters
- Log Analytics ingestion was €9,000 a month, mostly `Information` logs from health checks and EF Core commands nobody read.
- A sampling ratio of 1% kept the bill down but dropped the trace of the one failed payment customer support asked about.
- A GDPR request asked the shop to delete a customer's data. Their email was in 14 months of logs across three workspaces.

## Concepts

### Sampling
| Kind | Decides | .NET / Azure | Trade-off |
|:--|:--|:--|:--|
| ⭐ head sampling | at the start of a trace | `ParentBasedSampler(new TraceIdRatioBasedSampler(0.1))`; distro `SamplingRatio` | cheap; may drop interesting traces |
| ⭐ rate-limited | N traces per second | distro `TracesPerSecond` (default 5 in 1.5+) | predictable cost; low-traffic routes may vanish at peak |
| tail sampling | after the trace finishes | OpenTelemetry Collector `tail_sampling` processor (keep errors, slow traces) | keeps what matters; needs a Collector to run |
| parent-based | follow the caller's decision | default in OTel .NET | whole traces, not fragments |
| log sampling | per log record | `AddRandomProbabilisticSampler(...)`, `AddTraceBasedSampler()` (Microsoft.Extensions.Telemetry) | fewer logs; trace-based keeps logs of kept traces |
| log buffering | keep logs in memory, flush on error | `AddGlobalBuffer(...)`, `AddPerIncomingRequestBuffer(...)` (.NET 9+) | debug detail only when something failed |

Metrics aren't sampled: they are pre-aggregated, so they stay accurate. Use metrics for counts and alerts, sampled traces for examples.

### Cost control
| Lever | How |
|:--|:--|
| ⭐ log levels and filters | `Warning` for framework categories; no request/response bodies; health checks excluded from traces |
| ⭐ cardinality | low-cardinality metric tags only (lesson 02); remove unused dimensions |
| sampling | explicit traces per second or ratio per environment |
| table plans | Analytics (full KQL) vs Basic/Auxiliary logs (cheap ingestion, limited queries) for verbose data |
| ⭐ retention | 30–90 days hot for operational data; archive longer only when required |
| daily cap | a safety net on the workspace, with an alert when reached (it stops ingestion) |
| data collection rule transforms | drop columns or rows at ingestion |
| measure | `Usage` table in Log Analytics: GB per table per day; review monthly |

### Privacy and security in telemetry
| Rule | Practice |
|:--|:--|
| ⭐ no secrets | never log tokens, passwords, API keys, connection strings, `Authorization`/`Cookie` headers |
| ⭐ minimise personal data | log pseudonymous IDs (`user.id`), not names, emails, addresses, IPs, card data |
| ⭐ redaction | Microsoft.Extensions.Compliance.Redaction: classify parameters, then erase or HMAC them |
| HTTP logging | allow-list fields; no bodies on auth, payment, or account endpoints |
| traces | no PII in span names or URLs (route templates, not raw paths with emails) |
| frontend | Sentry `sendDefaultPii: false`, `beforeSend` scrubbing, session replay masking |
| ⭐ access | Log Analytics RBAC (resource-context and table-level); production telemetry only for those who need it |
| retention and deletion | short retention for anything personal; Log Analytics purge API for erasure requests |
| region | workspace in the region your privacy policy names (EU data in an EU region) |

## Example
`src/Shop.Api/Telemetry/ShopTaxonomy.cs`
```csharp
using Microsoft.Extensions.Compliance.Classification;

public static class ShopTaxonomy
{
    public static string Name => "Shop";
    public static DataClassification Personal => new(Name, nameof(Personal));
    public static DataClassification Secret => new(Name, nameof(Secret));
}

// Not named PersonalData: ASP.NET Core Identity already has a [PersonalData] attribute.
public sealed class PiiAttribute() : DataClassificationAttribute(ShopTaxonomy.Personal);
public sealed class SecretAttribute() : DataClassificationAttribute(ShopTaxonomy.Secret);
```
`src/Shop.Application/Accounts/AccountLog.cs`
```csharp
internal static partial class AccountLog
{
    [LoggerMessage(EventId = 2001, Level = LogLevel.Information, Message = "Password reset requested for {Email}")]
    public static partial void ResetRequested(this ILogger logger, [Pii] string email);
}
```
`src/Shop.Api/Program.cs`
```csharp
using Microsoft.Extensions.Compliance.Redaction;
using OpenTelemetry.Trace;

builder.Logging.EnableRedaction();                     // Microsoft.Extensions.Telemetry
builder.Services.AddRedaction(r =>
{
    r.SetRedactor<ErasingRedactor>(new DataClassificationSet(ShopTaxonomy.Secret));
#pragma warning disable EXTEXP0002                     // HMAC redactor is experimental
    r.SetHmacRedactor(builder.Configuration.GetSection("Redaction:Hmac"), new DataClassificationSet(ShopTaxonomy.Personal));
#pragma warning restore EXTEXP0002
});

builder.Logging.AddTraceBasedSampler();               // keep logs only for sampled traces
builder.Services.AddOpenTelemetry().WithTracing(t => t
    .SetSampler(new ParentBasedSampler(new TraceIdRatioBasedSampler(0.2))));   // 20% head sampling (non-Azure exporters)
```
The HMAC key (`Redaction:Hmac:Key`, base64, at least 44 characters) comes from Key Vault, never from appsettings. The same email always produces the same hash, so support can still correlate events without seeing the address.

Ingestion by table, last 30 days:
```kusto
Usage
| where TimeGenerated > ago(30d) and IsBillable
| summarize GB = sum(Quantity) / 1024 by DataType
| order by GB desc
```

## Production patterns
- Sampling chosen per environment and written down: 100% in dev and staging, explicit traces per second or ratio in production, errors kept (tail sampling or a high enough rate).
- A monthly cost review from the `Usage` table; the top tables get filters, lower levels, or a cheaper plan.
- Personal data classified in code (`[Pii]`), redacted or hashed before export; secrets never reach a logger.
- Production telemetry access is role-based and audited; retention is as short as operations allow.

## Mistakes
Wrong:
```csharp
log.LogInformation("Login {Email} with token {Token}", email, token);
```
Right: log the user ID; never the token. Classify any personal field so redaction applies.

Wrong: `SamplingRatio = 0.01` everywhere to save money.
Right: metrics for counts, a sampling rate that still keeps enough traces per route, and errors kept.

## Check yourself
1. What is the difference between head and tail sampling?
2. Why are metrics not sampled?
3. What does the HMAC redactor give you that erasing doesn't?

<details><summary>Answers</summary>

1. Head sampling decides at the start of a trace (by ratio or rate), before knowing the outcome. Tail sampling decides after the trace completes, so it can keep all errors and slow traces, but it needs a component (the OpenTelemetry Collector) that sees whole traces.
2. They're aggregated in the process (counts, sums, histograms) before export, so their cost depends on the number of time series, not the number of requests, and they stay exact.
3. A stable pseudonym: the same input always produces the same hash (per key), so you can correlate events for one user without storing the real value.
</details>

## Sources
- [Sampling in Azure Monitor OpenTelemetry](https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-sampling)
- [OpenTelemetry — Sampling](https://opentelemetry.io/docs/concepts/sampling/)
- [Log sampling in .NET](https://learn.microsoft.com/dotnet/core/extensions/log-sampling)
- [Log buffering in .NET](https://learn.microsoft.com/dotnet/core/extensions/log-buffering)
- [Data redaction in .NET](https://learn.microsoft.com/dotnet/core/extensions/data-redaction)
- [Azure Monitor cost and usage](https://learn.microsoft.com/azure/azure-monitor/cost-usage)
