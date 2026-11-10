---
title: Microservices, event-driven architecture, CQRS, and event sourcing
tech: C#, ASP.NET Core 10, Azure Service Bus, EF Core 10
version: .NET 10, Azure.Messaging.ServiceBus 7.x
date: 2026-11-09
covers: [7, 8, 9]
---
# Microservices, event-driven architecture, CQRS, and event sourcing
[← Overview](00-overview.md)

## Why it matters
- The shop split Catalog, Cart, Orders, and Payments into services that shared one database. Every schema change needed four teams; it was a distributed monolith.
- Services published events like `OrderUpdated { orderId }`. Every consumer called back to the Orders API to find out what changed, and an Orders outage took everything down.
- A team adopted event sourcing for the product catalog "for auditability". Simple fixes like correcting a typo in a product name became migrations of the event stream.

## Concepts

### Microservices
| Benefit | Cost |
|:--|:--|
| ⭐ independent deployment per service | network calls: latency, partial failure, retries, timeouts |
| independent scaling and technology | distributed data: no cross-service transactions; eventual consistency |
| team autonomy (one team, one service) | operations: many pipelines, dashboards, on-call surfaces |
| fault isolation (if designed well) | testing across services, versioning contracts |

| Rule | Why |
|:--|:--|
| ⭐ each service owns its data | no shared database; others use its API or events |
| ⭐ split along business capabilities / bounded contexts | not along technical layers |
| ⭐ prefer async events for reactions | avoid synchronous call chains |
| ⭐ split only with a reason | separate team, scaling, security, or technology need (03-backend/11-architecture lesson 06) |

### Event-driven architecture
| Concept | Meaning |
|:--|:--|
| ⭐ event | a fact that happened (`OrderPlaced`), past tense, immutable |
| event notification | thin event: "something happened, call me for details" (creates coupling back) |
| ⭐ event-carried state transfer | the event contains the data consumers need (`OrderPlaced` with lines, totals, customer ID) |
| ⭐ choreography | each service reacts to events and publishes its own; no central coordinator |
| ⭐ orchestration | a coordinator (saga/process manager) tells services what to do and tracks state |
| broker | Azure Service Bus topics (business events), Event Grid (resource events), Event Hubs (streams) |

| Choreography | Orchestration |
|:--|:--|
| loose coupling, easy to add reactions | the workflow is visible in one place |
| flow is implicit, spread across services | coordinator can become a hub of logic |
| good for simple reactions (send email, award points) | good for multi-step processes with compensation (checkout) |

### CQRS and event sourcing
| Pattern | Means | Use when |
|:--|:--|:--|
| ⭐ CQRS | separate models for writes (commands, rich domain) and reads (queries, denormalised projections) | read and write needs differ a lot (complex domain, heavy reporting) |
| CQRS-lite | same database, separate code paths: domain for commands, projections/Dapper for queries | most apps (the shop does this) |
| ⭐ event sourcing | store the sequence of events as the source of truth; state is derived by replaying | full audit history, temporal queries, complex domains with event-centred thinking |

Event sourcing costs: event versioning (upcasting), projections to rebuild, snapshots for long streams, GDPR erasure in immutable logs, and a learning curve. It's an architecture choice per aggregate, not a default (07-distributed-systems covers the mechanics).

## In our stack
- Modules communicate with integration events through the outbox, ready to become services: [03-backend/11-architecture lesson 04](../../../03-backend/11-architecture/docs/04-events-transactions.md).
- Service Bus topics/subscriptions for events: [03-backend/07-background-jobs lesson 05](../../../03-backend/07-background-jobs/docs/05-service-bus-messaging-monitoring.md).
- CQRS-lite: domain model for writes, projections and read replicas for reads ([03-backend/09-scalability lesson 04](../../../03-backend/09-scalability/docs/04-database-scaling-reads.md)).
- Sagas, delivery guarantees, event sourcing mechanics: [07-distributed-systems](../../07-distributed-systems/README.md).

## When not to
- Don't start with microservices for one team and an unproven domain; start modular.
- Don't use events for things that need an immediate answer (price lookup at checkout); use a direct call or local data.
- Don't adopt event sourcing for CRUD-like data (catalog, settings) or because you need an audit log (an audit table is simpler).
- Don't apply full CQRS with separate databases unless read and write loads or models really diverge.

## Example
Event-carried state transfer (consumers don't call back):
```csharp
public sealed record OrderPlacedV1(
    long OrderNumber, Guid CustomerId, string Currency, long TotalMinor,
    IReadOnlyList<OrderPlacedLineV1> Lines, ShippingAddressV1 ShipTo, DateTimeOffset PlacedAt);
public sealed record OrderPlacedLineV1(string Sku, string Name, int Quantity, long UnitPriceMinor);
public sealed record ShippingAddressV1(string Name, string Street, string PostalCode, string City, string Country);
```
Choreography: each consumer reacts on its own subscription
```csharp
// Loyalty module
internal sealed class AwardPoints(LoyaltyDb db) : IIntegrationEventHandler<OrderPlacedV1> { /* points from TotalMinor */ }
// Notifications module
internal sealed class SendConfirmation(IEmailSender email) : IIntegrationEventHandler<OrderPlacedV1> { /* email from Lines + ShipTo */ }
// Warehouse service (separate deployable, subscribes to the Service Bus topic)
```
CQRS-lite: commands through the domain, queries through a projection
```csharp
// write side
app.MapPost("/orders", (PlaceOrderRequest r, PlaceOrderHandler h, CancellationToken ct) => h.HandleAsync(r, ct));

// read side: a denormalised view kept up to date by an event handler
internal sealed class CustomerOrderHistoryProjection(ReadDb db) : IIntegrationEventHandler<OrderPlacedV1>
{
    public async Task HandleAsync(OrderPlacedV1 e, Guid messageId, CancellationToken ct)
    {
        db.OrderHistory.Add(new OrderHistoryRow(e.CustomerId, e.OrderNumber, e.PlacedAt, e.TotalMinor, e.Lines.Count));
        await db.SaveChangesAsync(ct);
    }
}
app.MapGet("/me/orders", (ReadDb db, ClaimsPrincipal u, CancellationToken ct) =>
    db.OrderHistory.Where(h => h.CustomerId == u.GetUserId()).OrderByDescending(h => h.PlacedAt).Take(20).ToListAsync(ct));
```

## Production patterns
- A modular monolith with event-based module communication; services extracted only for concrete reasons, owning their data.
- Events are versioned facts carrying the state consumers need; choreography for simple reactions, orchestration for workflows with compensation.
- CQRS-lite by default (separate read paths); full CQRS or event sourcing only for aggregates where the benefits are clear and the team accepts the costs.

## Mistakes
Wrong: `OrderUpdated { OrderId }` events and consumers calling `GET /orders/{id}` for every event.
Right: specific events (`OrderPlaced`, `OrderShipped`) with the data consumers need.

Wrong: four services, one database.
Right: one database per service (or stay a modular monolith with schemas per module).

## Check yourself
1. What makes a microservice architecture a distributed monolith?
2. When would you choose orchestration over choreography?
3. What's the difference between CQRS and event sourcing?

<details><summary>Answers</summary>

1. Services that can't change or deploy independently: shared databases, synchronous call chains for each request, shared libraries forcing lockstep upgrades, and changes that always span several services.
2. For multi-step workflows that need visible state, timeouts, and compensations (checkout: reserve stock → charge → ship, refund on failure), where implicit choreography would be hard to follow and debug.
3. CQRS separates the write model from the read model; event sourcing stores state as a sequence of events. They're often combined but independent: you can use CQRS with a normal database, and event sourcing with simple reads.
</details>

## Sources
- [Martin Fowler — Microservices](https://martinfowler.com/articles/microservices.html)
- [Azure — Microservices architecture style](https://learn.microsoft.com/azure/architecture/guide/architecture-styles/microservices)
- [Martin Fowler — What do you mean by "event-driven"?](https://martinfowler.com/articles/201701-event-driven.html)
- [Azure — CQRS pattern](https://learn.microsoft.com/azure/architecture/patterns/cqrs)
- [Azure — Event sourcing pattern](https://learn.microsoft.com/azure/architecture/patterns/event-sourcing)
- [Azure — Choreography pattern](https://learn.microsoft.com/azure/architecture/patterns/choreography)
