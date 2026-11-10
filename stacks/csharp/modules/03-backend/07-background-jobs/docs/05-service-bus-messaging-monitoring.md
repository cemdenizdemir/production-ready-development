---
title: Azure Service Bus, messaging options, and monitoring queues
tech: Azure.Messaging.ServiceBus, Service Bus emulator, Event Grid, Hangfire
version: Azure.Messaging.ServiceBus 7.x, Microsoft.Extensions.Azure 1.x
date: 2026-11-09
covers: [12, 13, 14, 15]
---
# Azure Service Bus, messaging options, and monitoring queues
[← Overview](00-overview.md)

## Why it matters
- The email consumer throws on one malformed message; it's retried forever and blocks the queue for everyone (poison message).
- Order status updates are processed out of order: "Shipped" arrives before "Paid" and the order ends up "Paid".
- A queue silently grows to 400,000 messages over a weekend because the consumer was crashing; nobody had an alert on queue depth.

## Concepts

### Service Bus entities
| Entity | Model | Use |
|:--|:--|:--|
| ⭐ queue | point-to-point: one consumer group competes for messages | commands, work items (`send-email`) |
| ⭐ topic + subscriptions | publish/subscribe: each subscription gets a copy, with filters | events (`order-events` → email, analytics, warehouse) |
| dead-letter queue (per queue/subscription) | messages that failed `MaxDeliveryCount` times or were dead-lettered explicitly | poison handling |

| Feature | What it gives |
|:--|:--|
| peek-lock | receive with a lock; `Complete` / `Abandon` / `DeadLetter` / `Defer` |
| `MaxDeliveryCount` (default 10) | retries before DLQ |
| ⭐ duplicate detection | drop resends with the same `MessageId` within a window |
| ⭐ sessions | ordered processing per `SessionId` (e.g. per order) |
| scheduled messages | `ScheduledEnqueueTime` |
| TTL | expire stale messages |
| filters/rules on subscriptions | SQL-like filters on properties (`Subject = 'OrderPlaced'`) |
| transactions | send/complete atomically within Service Bus |
| emulator | Docker image for local development |

SDK: one `ServiceBusClient` per app (singleton) with `DefaultAzureCredential`; `ServiceBusSender` per entity; `ServiceBusProcessor` for consuming (`MaxConcurrentCalls`, `AutoCompleteMessages = false`, `PrefetchCount`). In Container Apps, KEDA scale rules can scale consumers by queue length.

### Pub/sub and messaging options
| Option | Model | Use |
|:--|:--|:--|
| ⭐ Azure Service Bus | enterprise broker: queues, topics, sessions, DLQ, transactions | business messages |
| Azure Event Grid | push events (HTTP/webhooks), Azure resource events | "blob created", lightweight event routing |
| Azure Event Hubs | high-throughput event streaming (Kafka-compatible) | telemetry, clickstreams |
| Azure Storage Queues | simple, cheap queue | basic work queues |
| Redis pub/sub / streams | in-memory, low latency | cache invalidation, SignalR backplane; not durable business messages |
| Kafka | log-based streaming | large event platforms |
| Hangfire | durable jobs inside one app | jobs, schedules |

### Libraries and licences
| Library | Licence | Note |
|:--|:--|:--|
| ⭐ Azure.Messaging.ServiceBus (plain SDK) | MIT | this stack |
| MassTransit 9 | commercial (v8 OSS, security fixes through 2026) | abstractions, sagas, outbox |
| NServiceBus | commercial | mature, sagas |
| Wolverine | MIT | messaging + outbox + handlers |
| Rebus, Brighter | MIT | lighter alternatives |

A thin in-house wrapper (send/receive, serialization, trace propagation, inbox) over the SDK is often enough; adopt a framework when you need sagas, many message types, and routing conventions.

### Monitoring queues
| Signal | Source | Alert |
|:--|:--|:--|
| ⭐ queue depth (active messages) | Service Bus metrics / Hangfire Enqueued | growing for > 10 min |
| ⭐ oldest message / job age | custom metric | > SLO (e.g. 5 min for emails) |
| ⭐ dead-lettered messages / failed jobs | metrics | > 0 on critical queues |
| processing rate / failure rate | consumer metrics | drop or spike |
| outbox lag | custom metric | > 1 min |
| traces across producer → consumer | OpenTelemetry with `traceparent` | |

## Example
`src/Shop.Api/Program.cs` (clients)
```csharp
using Azure.Identity;
using Microsoft.Extensions.Azure;

builder.Services.AddAzureClients(b =>
{
    b.AddServiceBusClientWithNamespace(builder.Configuration["ServiceBus:Namespace"]);   // sb-shop.servicebus.windows.net
    b.UseCredential(new DefaultAzureCredential());
});
builder.Services.AddSingleton(sp => sp.GetRequiredService<ServiceBusClient>().CreateSender("order-events"));
builder.Services.AddHostedService<ShippingEmailConsumer>();
```
`src/Shop.Workers/ShippingEmailConsumer.cs`
```csharp
using Azure.Messaging.ServiceBus;

public sealed class ShippingEmailConsumer(ServiceBusClient client, IServiceScopeFactory scopes, ILogger<ShippingEmailConsumer> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await using var processor = client.CreateProcessor("order-events", "shipping-emails", new ServiceBusProcessorOptions
        {
            MaxConcurrentCalls = 8,
            AutoCompleteMessages = false,
        });

        processor.ProcessMessageAsync += async args =>
        {
            if (args.Message.Subject != "OrderShipped") { await args.CompleteMessageAsync(args.Message); return; }

            OrderShipped? evt;
            try { evt = args.Message.Body.ToObjectFromJson<OrderShipped>(); }
            catch (Exception ex)
            {
                await args.DeadLetterMessageAsync(args.Message, "invalid-payload", ex.Message);   // poison: don't retry
                return;
            }

            await using var scope = scopes.CreateAsyncScope();
            var handler = scope.ServiceProvider.GetRequiredService<ShippingEmailHandler>();
            await handler.HandleAsync(args.Message.MessageId, evt!, args.CancellationToken);       // idempotent (inbox)
            await args.CompleteMessageAsync(args.Message);
        };
        processor.ProcessErrorAsync += args =>
        {
            log.LogError(args.Exception, "Service Bus error on {Entity}", args.EntityPath);
            return Task.CompletedTask;                     // unhandled exceptions in ProcessMessageAsync → abandon → retry → DLQ
        };

        await processor.StartProcessingAsync(stoppingToken);
        try { await Task.Delay(Timeout.Infinite, stoppingToken); }
        catch (OperationCanceledException) { }
        await processor.StopProcessingAsync();
    }
}
```
Local emulator (Compose profile `messaging`, 01-foundations/07): connection string `Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true;`.

## Production patterns
- Topics for events, queues for commands; one subscription per consumer purpose, with filters.
- Peek-lock with explicit `Complete`; poison messages dead-lettered with a reason; idempotent handlers; sessions where order per entity matters.
- Managed identity (`Azure Service Bus Data Sender/Receiver` roles), duplicate detection on, sensible `MaxDeliveryCount` and TTL.
- Dashboards and alerts on depth, age, DLQ count, and outbox lag; KEDA scaling on queue length.

## Mistakes
Wrong: `AutoCompleteMessages = true` and swallowing exceptions.
```csharp
processor.ProcessMessageAsync += async a => { try { await Handle(a); } catch { } };   // failures silently completed
```
Right: complete only after success; dead-letter poison; let transient errors abandon and retry.

Wrong: Redis pub/sub for order events.
Right: Service Bus (durable, retries, DLQ) for business messages.

## Check yourself
1. When do you use a topic instead of a queue?
2. What does a session give you?
3. Which three queue metrics deserve alerts?

<details><summary>Answers</summary>

1. When several independent consumers each need their own copy of a message (publish/subscribe), like an `OrderPlaced` event used by email, analytics, and the warehouse.
2. Ordered, one-at-a-time processing of messages with the same `SessionId` (e.g. all messages for one order), while different sessions run in parallel.
3. Queue depth (growing), oldest message age, and dead-lettered/failed message count (plus outbox lag).
</details>

## Sources
- [Service Bus queues, topics, and subscriptions](https://learn.microsoft.com/azure/service-bus-messaging/service-bus-queues-topics-subscriptions)
- [Azure.Messaging.ServiceBus client library](https://learn.microsoft.com/dotnet/api/overview/azure/messaging.servicebus-readme)
- [Service Bus message sessions](https://learn.microsoft.com/azure/service-bus-messaging/message-sessions)
- [Service Bus emulator](https://learn.microsoft.com/azure/service-bus-messaging/overview-emulator)
- [Choose between Azure messaging services](https://learn.microsoft.com/azure/service-bus-messaging/compare-messaging-services)
- [MediatR and MassTransit going commercial](https://milanjovanovic.tech/blog/mediatr-and-masstransit-going-commercial-what-this-means-for-you)
