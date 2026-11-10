---
title: "Hangfire: jobs, retries, schedules, continuations"
tech: Hangfire, Hangfire.SqlServer, ASP.NET Core 10
version: Hangfire 1.8.x, Hangfire.SqlServer 1.8.25
date: 2026-11-09
covers: [3, 4, 6, 8]
---
# Hangfire: jobs, retries, schedules, continuations
[← Overview](00-overview.md)

## Why it matters
- The confirmation email provider is down for 20 minutes; without retries, 600 customers never get their confirmation.
- A nightly report job is scheduled at "02:00" on a server in UTC; customers in Istanbul get yesterday's report at 05:00.
- The Hangfire dashboard is exposed at `/hangfire` without authentication; anyone can see job arguments and trigger jobs.

## Concepts

### Job types
| Type | API | Use |
|:--|:--|:--|
| ⭐ fire-and-forget | `jobs.Enqueue<T>(x => x.Method(args, CancellationToken.None))` | send email, call webhook |
| ⭐ delayed | `jobs.Schedule<T>(x => …, TimeSpan.FromMinutes(30))` | abandoned-cart reminder |
| ⭐ recurring | `recurring.AddOrUpdate<T>("id", x => …, cron, options)` | nightly reconciliation |
| continuation | `jobs.ContinueJobWith<T>(parentId, x => …)` | generate export → then email the link |
| batches | Hangfire Pro (commercial) | groups of jobs with a callback |

How it works: the job's method call expression (type, method, **serialized arguments**) is stored in SQL Server; workers fetch, deserialize, resolve `T` from DI (a scope per job), and invoke. Arguments should be **IDs and small values**, not entities or large objects; the job loads current data when it runs.

`CancellationToken` parameters: pass `CancellationToken.None` when enqueuing; Hangfire supplies a token that fires on server shutdown or job deletion.

### Retries
- Default: `AutomaticRetry` with 10 attempts and growing delays (seconds → hours).
- Customize per job: `[AutomaticRetry(Attempts = 5, OnAttemptsExceeded = AttemptsExceededAction.Fail)]`.
- Non-retryable errors (validation, 4xx from partners, "order not found"): catch and finish (or `Attempts = 0`), log, and alert if needed; don't burn retries on permanent failures.
- After the last attempt, the job goes to **Failed**: visible in the dashboard, retryable by hand (lesson 03).

### Schedules and time zones
| Item | Example |
|:--|:--|
| cron helpers | `Cron.Daily(2)`, `Cron.Hourly()`, `Cron.Weekly(DayOfWeek.Monday, 6)` |
| cron expressions | `"0 2 * * *"` (02:00 daily), `"*/15 * * * *"` |
| ⭐ time zone | `new RecurringJobOptions { TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul") }` |
| IDs | stable string IDs; `AddOrUpdate` at startup is idempotent |
| removal | `recurring.RemoveIfExists("old-job")` |
| DST | cron in a zone with DST can skip/duplicate runs at transitions; schedule outside 01:00–03:00 or make jobs idempotent |

Use IANA IDs (`Europe/Istanbul`); .NET on Linux and Windows (with ICU) understands them.

### Setup and dashboard
| Item | API |
|:--|:--|
| storage | `UseSqlServerStorage(cs, options)` (schema `HangFire`; tables created/migrated automatically) |
| serializer settings | `SetDataCompatibilityLevel(CompatibilityLevel.Version_180)`, `UseRecommendedSerializerSettings()` |
| server | `AddHangfireServer(o => { o.WorkerCount = …; o.Queues = [...]; })` |
| dashboard | `app.MapHangfireDashboard("/admin/jobs", options)` |
| ⭐ dashboard auth | clear the default local-only filter and require your admin policy |
| separate worker process | run servers in a dedicated container (same image, `--role worker`) to scale independently |

## Example
`src/Shop.Api/Program.cs`
```csharp
using Hangfire;
using Hangfire.SqlServer;

builder.Services.AddHangfire(c => c
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UseSqlServerStorage(builder.Configuration.GetConnectionString("Shop"), new SqlServerStorageOptions
    {
        PrepareSchemaIfNecessary = true,
        QueuePollInterval = TimeSpan.FromSeconds(5),
    }));
builder.Services.AddHangfireServer(o =>
{
    o.Queues = ["critical", "default", "low"];       // order = priority
    o.WorkerCount = Environment.ProcessorCount * 2;
});

var app = builder.Build();
app.MapHangfireDashboard("/admin/jobs", new DashboardOptions { Authorization = [], DisplayStorageConnectionString = false })
   .RequireAuthorization(Policies.AdminOnly);

var recurring = app.Services.GetRequiredService<IRecurringJobManager>();
recurring.AddOrUpdate<PaymentReconciliation>("payments:reconcile", j => j.RunAsync(CancellationToken.None),
    Cron.Daily(4), new RecurringJobOptions { TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul") });
```
`src/Shop.Application/Orders/OrderEmails.cs`
```csharp
using Hangfire;

public sealed class OrderEmails(ShopDb db, IEmailSender email, ILogger<OrderEmails> log)
{
    [Queue("critical")]
    [AutomaticRetry(Attempts = 8, OnAttemptsExceeded = AttemptsExceededAction.Fail)]
    public async Task SendConfirmationAsync(long orderId, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Lines).SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) { log.LogWarning("Order {OrderId} not found; skipping email", orderId); return; }   // permanent: don't retry
        if (order.ConfirmationSentAt is not null) return;                                                       // idempotent

        await email.SendAsync(OrderTemplates.Confirmation(order), ct);
        await db.Orders.Where(o => o.Id == orderId)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.ConfirmationSentAt, DateTimeOffset.UtcNow), ct);
    }
}
```
Enqueue, schedule, continue:
```csharp
jobs.Enqueue<OrderEmails>(x => x.SendConfirmationAsync(order.Id, CancellationToken.None));
jobs.Schedule<CartReminders>(x => x.RemindAsync(cartId, CancellationToken.None), TimeSpan.FromHours(2));
var exportId = jobs.Enqueue<Exports>(x => x.BuildOrdersCsvAsync(userId, CancellationToken.None));
jobs.ContinueJobWith<Exports>(exportId, x => x.EmailDownloadLinkAsync(userId, CancellationToken.None));
```

## Production patterns
- Job arguments are IDs; jobs load fresh data and check whether work is still needed (idempotent).
- Queues for priority (`critical`, `default`, `low`); dedicated worker containers when jobs are heavy.
- Retries for transient failures only; permanent failures end cleanly with a log and, if important, an alert.
- Dashboard behind the admin policy (with MFA); hide connection strings; recurring jobs with explicit time zones.

## Mistakes
Wrong:
```csharp
jobs.Enqueue(() => email.SendAsync(orderEntity));   // serializes the whole entity; stale data; huge payload
```
Right: `jobs.Enqueue<OrderEmails>(x => x.SendConfirmationAsync(orderId, CancellationToken.None))`.

Wrong: `app.UseHangfireDashboard()` with defaults in production behind a proxy (the local-only filter is bypassed or blocks everyone).
Right: explicit authorization with your policy.

## Check yourself
1. Why pass IDs instead of objects to Hangfire jobs?
2. How do you make a recurring job run at 04:00 Istanbul time?
3. What should a job do when it hits a permanent failure?

<details><summary>Answers</summary>

1. Arguments are serialized and stored; objects bloat storage, go stale, and break when classes change. IDs let the job load current state.
2. `AddOrUpdate` with `Cron.Daily(4)` and `RecurringJobOptions { TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul") }`.
3. Stop retrying: log (and alert if it matters), and finish or fail explicitly instead of using up retries on something that can't succeed.
</details>

## Sources
- [Hangfire — Getting started (ASP.NET Core)](https://docs.hangfire.io/en/latest/getting-started/aspnet-core-applications.html)
- [Hangfire — Background methods](https://docs.hangfire.io/en/latest/background-methods/index.html)
- [Hangfire — Recurring jobs](https://docs.hangfire.io/en/latest/background-methods/performing-recurrent-tasks.html)
- [Hangfire — Dashboard authorization](https://docs.hangfire.io/en/latest/configuration/using-dashboard.html)
- [Hangfire.SqlServer on NuGet](https://www.nuget.org/packages/Hangfire.SqlServer)
