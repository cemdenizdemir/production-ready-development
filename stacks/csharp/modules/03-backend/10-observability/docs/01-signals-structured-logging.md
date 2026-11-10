---
title: Signals, structured logging with ILogger, and Serilog
tech: Microsoft.Extensions.Logging, ASP.NET Core HTTP logging, Serilog
version: .NET 10, Serilog.AspNetCore 9.x, Serilog.Sinks.OpenTelemetry 4.x
date: 2026-11-09
covers: [1, 2, 15]
---
# Signals, structured logging with ILogger, and Serilog
[← Overview](00-overview.md)

## Why it matters
- Logs written as `$"Order {id} failed for {email}"` can't be searched by order ID, and they put an email address into log storage for 90 days.
- Debug logging left on in production costs more than the API's compute, and the one important error is buried under 2 million lines.
- An exception is logged three times at three layers, each without the original stack trace, so on-call can't tell one incident from three.

## Concepts

### Four signals
| Signal | Answers | Example |
|:--|:--|:--|
| ⭐ metrics | is something wrong, and how much? (cheap, aggregated) | checkout error rate 4%, p99 2.1 s |
| ⭐ traces | where is the time or the error in this request? | `POST /orders` → SQL 40 ms → payments 1.9 s |
| ⭐ logs | what exactly happened? (detailed events) | "Payment declined for order 1042: insufficient_funds" |
| errors | which exceptions, how often, since which release? | `TimeoutRejectedException` ×312 since v1.8.2 |

**Monitoring** watches known failure modes (dashboards, alerts). **Observability** lets you ask new questions about unknown failures, by slicing high-quality telemetry by any dimension. You need both.

### ILogger essentials
| Item | Rule |
|:--|:--|
| ⭐ message templates | `log.LogInformation("Order {OrderId} placed", id)`: named placeholders become fields; never string interpolation |
| ⭐ levels | `Trace` / `Debug` (dev), `Information` (business events), `Warning` (unexpected but handled), `Error` (failed operation), `Critical` (app-wide failure) |
| category | `ILogger<T>` sets the category to the class name; filter per category in config |
| ⭐ exceptions | pass the exception first: `LogError(ex, "...")`; log once, at the boundary that handles it |
| scopes | `using (log.BeginScope(new Dictionary<string, object> { ["OrderId"] = id }))` adds fields to every log inside |
| ⭐ `[LoggerMessage]` | source-generated, no boxing or parsing at runtime; checked at compile time; best for hot paths |
| filters | `"Logging": { "LogLevel": { "Default": "Information", "Microsoft.AspNetCore": "Warning" } }` |
| HTTP logging | `AddHttpLogging(...)` + `UseHttpLogging()`; choose fields; never log bodies or auth headers in production |

### Serilog
Many .NET teams use Serilog because of its rich sinks, enrichers, and `ReadFrom.Configuration`. With OpenTelemetry you don't need it for export, but it's still common in existing codebases.
| Option | How |
|:--|:--|
| ⭐ keep `ILogger` in code | app code depends only on `ILogger<T>`; Serilog is an implementation detail |
| Serilog → OTLP | `WriteTo.OpenTelemetry()` (Serilog.Sinks.OpenTelemetry) sends logs with trace IDs |
| Serilog + OpenTelemetry provider | `AddSerilog(..., writeToProviders: true)` so the OTel logging provider still receives events |
| request logging | `UseSerilogRequestLogging()`: one summary line per request |

## Example
`src/Shop.Application/Orders/OrderLog.cs`
```csharp
using Microsoft.Extensions.Logging;

internal static partial class OrderLog
{
    [LoggerMessage(EventId = 1001, Level = LogLevel.Information, Message = "Order {OrderId} placed: {LineCount} lines, total {TotalMinor} {Currency}")]
    public static partial void OrderPlaced(this ILogger logger, long orderId, int lineCount, long totalMinor, string currency);

    [LoggerMessage(EventId = 1002, Level = LogLevel.Warning, Message = "Payment declined for order {OrderId}: {DeclineCode}")]
    public static partial void PaymentDeclined(this ILogger logger, long orderId, string declineCode);

    [LoggerMessage(EventId = 1003, Level = LogLevel.Error, Message = "Order {OrderId} could not be placed")]
    public static partial void OrderFailed(this ILogger logger, Exception ex, long orderId);
}
```
`src/Shop.Application/Orders/OrderService.cs`
```csharp
public async Task<Order> PlaceAsync(PlaceOrder cmd, CancellationToken ct)
{
    using var _ = log.BeginScope(new Dictionary<string, object> { ["CartId"] = cmd.CartId });
    var order = Order.Create(cmd, time.GetUtcNow());
    db.Orders.Add(order);
    await db.SaveChangesAsync(ct);
    log.OrderPlaced(order.Id, order.Lines.Count, order.TotalMinor, order.Currency);
    return order;
}
```
`appsettings.json`
```json
"Logging": {
  "LogLevel": { "Default": "Information", "Microsoft.AspNetCore": "Warning", "Microsoft.EntityFrameworkCore.Database.Command": "Warning" }
}
```
HTTP logging with safe fields only:
```csharp
using Microsoft.AspNetCore.HttpLogging;

builder.Services.AddHttpLogging(o =>
{
    o.LoggingFields = HttpLoggingFields.RequestMethod | HttpLoggingFields.RequestPath | HttpLoggingFields.ResponseStatusCode | HttpLoggingFields.Duration;
    o.CombineLogs = true;            // one log line per request (.NET 8+)
});
app.UseHttpLogging();
```

## Production patterns
- Logs are structured events with stable names (EventId, template) and IDs as fields: order, user (pseudonymous ID), trace.
- Exceptions are logged once, where they're handled (usually the global exception handler, 02-api-design), with the exception object.
- Production level `Information` for app code, `Warning` for framework noise; `Debug` only through a temporary per-category override.
- App code depends on `ILogger<T>` only. Whether Serilog or the OTel provider exports logs is a composition-root decision.

## Mistakes
Wrong:
```csharp
log.LogInformation($"Order {order.Id} placed by {user.Email}");   // not structured, leaks PII
try { ... } catch (Exception ex) { log.LogError(ex.Message); throw; }   // no stack trace, logged again upstream
```
Right: `log.OrderPlaced(order.Id, ...)` with no email; let the exception bubble to the handler that logs it once with `LogError(ex, ...)`.

## Check yourself
1. Which signal tells you *where* time went in one slow request?
2. Why use message templates instead of string interpolation?
3. What does `[LoggerMessage]` give you over `LogInformation(...)`?

<details><summary>Answers</summary>

1. A trace. Its spans show each step (SQL, HTTP calls, Redis) with durations.
2. Templates keep the values as separate, queryable fields (`OrderId = 1042`) with a stable message shape for grouping. Interpolation produces a unique string each time, and it still costs allocations when the level is disabled.
3. Compile-time generated code: no runtime template parsing, no boxing, a level check before any work, compile-time validation of placeholders, and consistent event IDs.
</details>

## Sources
- [Logging in .NET](https://learn.microsoft.com/dotnet/core/extensions/logging)
- [Compile-time logging source generation](https://learn.microsoft.com/dotnet/core/extensions/logger-message-generator)
- [HTTP logging in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/http-logging/)
- [Serilog.AspNetCore](https://github.com/serilog/serilog-aspnetcore)
- [Serilog.Sinks.OpenTelemetry](https://github.com/serilog/serilog-sinks-opentelemetry)
