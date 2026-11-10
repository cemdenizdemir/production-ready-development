---
title: Traces and metrics with OpenTelemetry
tech: OpenTelemetry .NET, System.Diagnostics (ActivitySource, Meter)
version: OpenTelemetry.Extensions.Hosting 1.x, OpenTelemetry.Instrumentation.* 1.x, .NET 10
date: 2026-11-09
covers: [3, 4, 5, 6]
---
# Traces and metrics with OpenTelemetry
[← Overview](00-overview.md)

## Why it matters
- Checkout is slow for some users. Logs show nothing wrong. A trace shows the stock-check call to the warehouse API retrying three times for 4 s.
- A metric tagged with `user_id` created 2 million time series. The metrics bill went up 30× and queries timed out.
- An order event published to Service Bus lost its trace context, so the slow email worker couldn't be linked to the request that caused it.

## Concepts

### Traces
| Term | Meaning | .NET type |
|:--|:--|:--|
| ⭐ trace | one end-to-end operation (a request and everything it caused) | `TraceId` |
| ⭐ span | one timed step with attributes and status | `Activity` |
| ⭐ context propagation | passing trace context across processes: W3C `traceparent` / `tracestate` headers | built into `HttpClient`, ASP.NET Core |
| span kinds | server, client, producer, consumer, internal | `ActivityKind` |
| attributes | key-value data on spans (`order.id`, `http.route`) | `activity.SetTag(...)` |
| events and status | `activity.AddEvent(...)`, `SetStatus(ActivityStatusCode.Error)` | |
| baggage | key-values propagated to downstream services (use sparingly) | `Baggage` |

**Auto-instrumentation** (instrumentation packages) creates spans for ASP.NET Core requests, `HttpClient`, SQL, Redis, and Azure SDKs. You add spans only for important internal steps.

### Metrics
| Instrument | Use | Example |
|:--|:--|:--|
| ⭐ `Counter<T>` | things that only go up | `shop.orders.placed` |
| ⭐ `Histogram<T>` | distributions (latency, sizes) | `shop.payment.duration` |
| `UpDownCounter<T>` | goes up and down | items in an in-memory queue |
| `ObservableGauge<T>` | sampled current value | outbox lag, queue depth |

| Method | For | Signals |
|:--|:--|:--|
| ⭐ RED | request-driven services | Rate, Errors, Duration |
| ⭐ USE | resources (CPU, pools, queues) | Utilization, Saturation, Errors |

**Cardinality** = the number of unique tag combinations. Keep tags low-cardinality (route template, status class, payment method, region). Never put IDs, emails, or raw URLs in metric tags; those belong in traces and logs.

### Instrumenting your own code
| Rule | Why |
|:--|:--|
| one `ActivitySource` and one `Meter` per component, named like `Shop.Orders` | filter and enable by name |
| create them once (static or singleton) | cheap, thread-safe |
| `StartActivity` returns `null` when nobody listens | always use `?.` |
| ⭐ follow semantic conventions | `http.*`, `db.*`, `messaging.*` names work in every backend |
| your own names with a prefix | `shop.order.id`, `shop.orders.placed` |
| record errors on the span | `SetStatus(Error)` + `AddException(ex)` (.NET 9+) |

### Correlating signals
| Link | How |
|:--|:--|
| ⭐ trace ID in logs | the OTel logging provider adds `TraceId`/`SpanId` to each log record automatically |
| logs ↔ trace in UI | Aspire dashboard and App Insights jump from a span to its logs |
| exemplars | a metric data point links to a sample trace (`SetExemplarFilter(ExemplarFilterType.TraceBased)`) |
| errors ↔ traces | exceptions recorded on spans; the problem details response includes `traceId` (02-api-design) |
| frontend ↔ backend | browser sends `traceparent` (Sentry `propagateTraceparent: true`, SDK 10.10+; allow the header in CORS) |
| messages | the Service Bus SDK stamps `Diagnostic-Id` from the current span; the outbox stores the original `traceparent` because it sends later (07-background-jobs) |

## Example
`src/Shop.Api/Telemetry/ShopTelemetry.cs`
```csharp
using System.Diagnostics;
using System.Diagnostics.Metrics;

public sealed class ShopTelemetry
{
    public static readonly ActivitySource Source = new("Shop.Orders");
    private readonly Counter<long> _ordersPlaced;
    private readonly Histogram<double> _paymentDuration;

    public ShopTelemetry(IMeterFactory meters)
    {
        var meter = meters.Create("Shop.Orders");
        _ordersPlaced = meter.CreateCounter<long>("shop.orders.placed", unit: "{order}");
        _paymentDuration = meter.CreateHistogram<double>("shop.payment.duration", unit: "s");
    }

    public void OrderPlaced(string paymentMethod, string currency) =>
        _ordersPlaced.Add(1, new("payment.method", paymentMethod), new("currency", currency));

    public void PaymentTook(TimeSpan elapsed, string outcome) =>
        _paymentDuration.Record(elapsed.TotalSeconds, new KeyValuePair<string, object?>("outcome", outcome));
}
```
Using it in a use case:
```csharp
using var activity = ShopTelemetry.Source.StartActivity("PlaceOrder");
activity?.SetTag("shop.cart.id", cmd.CartId);
try
{
    var started = Stopwatch.GetTimestamp();
    var payment = await payments.ChargeAsync(order, ct);
    telemetry.PaymentTook(Stopwatch.GetElapsedTime(started), payment.Outcome);
    telemetry.OrderPlaced(payment.Method, order.Currency);
}
catch (Exception ex)
{
    activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
    activity?.AddException(ex);
    throw;
}
```
`src/Shop.Api/Program.cs`
```csharp
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

builder.Services.AddSingleton<ShopTelemetry>();
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("shop-api", serviceVersion: typeof(Program).Assembly.GetName().Version?.ToString()))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation(o => o.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/health"))
        .AddHttpClientInstrumentation()
        .AddSqlClientInstrumentation()                  // prerelease package; or AddEntityFrameworkCoreInstrumentation()
        .AddRedisInstrumentation()                      // prerelease package; needs IConnectionMultiplexer in DI
        .AddSource("Azure.*")                           // Service Bus, Blob Storage
        .AddSource("Shop.*"))
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddMeter("Shop.*"))
    .WithLogging();

if (!string.IsNullOrEmpty(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]))
    builder.Services.AddOpenTelemetry().UseOtlpExporter();   // Aspire dashboard locally (lesson 03)
```
Stamp the assembly version in CI (`-p:Version=1.8.2`) so traces show which release served each request.

## Production patterns
- Auto-instrumentation for every inbound and outbound call; custom spans only around meaningful business steps (place order, charge, reserve stock).
- A small set of custom metrics per module with low-cardinality tags, named `shop.<area>.<thing>` with units.
- `service.name`, `service.version`, and `deployment.environment` resource attributes on everything, so you can compare releases.
- Trace context crosses every boundary: HTTP, Service Bus, Hangfire (pass `traceparent` as a job argument or use a filter), and the browser.

## Mistakes
Wrong:
```csharp
_ordersPlaced.Add(1, new("user.id", userId), new("order.id", orderId));   // unbounded cardinality
```
Right: tags like `payment.method` and `currency`; put the IDs on the span instead.

Wrong: `new ActivitySource("x")` inside each method call.
Right: one static `ActivitySource` per component, registered with `AddSource(...)`.

## Check yourself
1. What carries trace context between the frontend, API, and workers?
2. Why are user IDs fine on spans but not on metric tags?
3. Which instrument records checkout latency, and why not a counter?

<details><summary>Answers</summary>

1. The W3C `traceparent` header (and `tracestate`) on HTTP calls, and the same values in message application properties for Service Bus or job arguments.
2. Each unique tag combination is a separate time series that's stored and aggregated forever. Spans are individual records (and sampled), so high-cardinality attributes are fine there.
3. A `Histogram`. It keeps a distribution, so you can compute p50/p95/p99. A counter only counts events, so it can't show percentiles.
</details>

## Sources
- [.NET distributed tracing](https://learn.microsoft.com/dotnet/core/diagnostics/distributed-tracing)
- [Creating metrics in .NET](https://learn.microsoft.com/dotnet/core/diagnostics/metrics-instrumentation)
- [OpenTelemetry .NET — getting started](https://opentelemetry.io/docs/languages/dotnet/getting-started/)
- [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [Sentry — trace propagation with OpenTelemetry backends](https://docs.sentry.io/concepts/otlp/sentry-with-otel)
