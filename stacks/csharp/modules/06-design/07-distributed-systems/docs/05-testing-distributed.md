---
title: Testing distributed behaviour
tech: xUnit v3, Testcontainers, Service Bus emulator, Polly chaos strategies, Toxiproxy, C# 14
version: xUnit v3, Testcontainers 4.x, Polly 8.x
date: 2026-11-09
covers: [11]
---
# Testing distributed behaviour
[← Overview](00-overview.md)

## Why it matters
- The inbox was "tested" by sending one message. In production, Service Bus redelivered a message after a lock timeout, the handler ran twice in parallel, and both passed the "already processed?" check before either committed.
- Events arrived out of order only under load; nobody had a test that delivered `OrderShipped` before `OrderPaid`.
- The saga's compensation path had never run outside a unit test; when the carrier API failed for real, a null reference in the refund step left orders stuck.

## Concepts

### What to test
| Behaviour | Test by |
|:--|:--|
| ⭐ duplicates | deliver the same message twice (sequentially and **concurrently**) → one effect |
| ⭐ reordering | deliver events in every relevant order → same final state (or a defined result) |
| ⭐ delays and timeouts | inject latency in dependencies → timeouts fire, retries behave, deadlines hold |
| ⭐ partial failure | fail after step N (before ack, after commit) → recovery path works |
| unknown outcomes | the call succeeds but the response is lost → retry is safe (idempotency key) |
| compensations | force each saga step to fail → compensations run, final state consistent |
| poison messages | malformed payload → dead-lettered, not retried forever |
| clock issues | `FakeTimeProvider` jumps → deadlines, TTLs, schedules behave |
| ⭐ reconciliation | drift between systems is detected and repaired by scheduled jobs |

### How
| Level | Tool | Notes |
|:--|:--|:--|
| ⭐ unit (pure logic) | xUnit v3 + property-style loops over permutations | sagas and projections as pure functions are easy to test |
| ⭐ integration | Testcontainers (SQL Server, Redis), Service Bus emulator | real constraints, real transactions |
| concurrency | `Parallel.ForEachAsync` / `Task.WhenAll` with the same message | finds race conditions in inbox logic |
| fault injection | Polly chaos strategies, Toxiproxy (latency, resets), fakes that fail on the Nth call | 03-backend/08-reliability lesson 05 |
| time | `FakeTimeProvider.Advance(...)` | |
| staging chaos | Azure Chaos Studio, game days | 04-shipping/06-incident-response |
| production | reconciliation jobs + alerts | the last safety net (03-backend/12-integrations lesson 06) |

## In our stack
- Testcontainers and integration tests: [01-foundations/03-testing](../../../01-foundations/03-testing/README.md).
- Chaos strategies and failure tests: [03-backend/08-reliability lesson 05](../../../03-backend/08-reliability/docs/05-slos-testing-failure.md).
- Reconciliation: [03-backend/12-integrations lesson 06](../../../03-backend/12-integrations/docs/06-testing-reconciliation.md).
- Service Bus emulator: [03-backend/07-background-jobs lesson 05](../../../03-backend/07-background-jobs/docs/05-service-bus-messaging-monitoring.md).

## When not to
- Don't try to test every interleaving of a large system; test the invariants at each boundary (idempotency, ordering rules, compensations) and rely on reconciliation for the rest.
- Don't use real cloud resources for every test run; emulators and containers give fast, isolated feedback; keep a small cloud smoke suite.

## Example
Concurrent duplicate delivery against a real SQL Server (Testcontainers):
```csharp
public sealed class ShipOrderHandlerTests(SqlServerFixture sql) : IClassFixture<SqlServerFixture>
{
    [Fact]
    public async Task Same_message_delivered_concurrently_has_one_effect()
    {
        var ct = TestContext.Current.CancellationToken;
        await sql.SeedOrderAsync(orderNumber: 1001, status: OrderStatus.Placed, ct);
        var evt = new PaymentSucceededV1(OrderNumber: 1001, PaymentId: "pi_123");
        var messageId = Guid.NewGuid();

        await Parallel.ForEachAsync(Enumerable.Range(0, 8), ct, async (_, c) =>
        {
            await using var db = sql.CreateDb();
            try { await new ShipOrderHandler(db).HandleAsync(evt, messageId, c); }
            catch (DbUpdateException) { /* a concurrent duplicate may lose the race on the unique key: fine */ }
        });

        await using var check = sql.CreateDb();
        (await check.Inbox.CountAsync(i => i.MessageId == messageId, ct)).ShouldBe(1);
        (await check.Orders.SingleAsync(o => o.Number == 1001, ct)).Status.ShouldBe(OrderStatus.Paid);
    }
}
```
Reordering: every permutation ends in the same state
```csharp
public sealed class OrderViewProjectionTests
{
    public static TheoryData<int[]> Orders => new([0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]);

    [Theory]
    [MemberData(nameof(Orders))]
    public void Any_delivery_order_ends_with_latest_version(int[] permutation)
    {
        OrderStatusChanged[] events = [new(1001, 1, "Placed"), new(1001, 2, "Paid"), new(1001, 3, "Shipped")];
        var view = new InMemoryOrderView();

        foreach (var i in permutation) view.Apply(events[i]);
        view.Apply(events[1]);                                          // plus a duplicate

        view.Status(1001).ShouldBe("Shipped");
        view.Version(1001).ShouldBe(3);
    }
}
```
Saga failure paths with a fake clock:
```csharp
[Fact]
public void Shipment_failure_after_payment_refunds_and_releases_stock()
{
    var saga = CheckoutSagaBuilder.AtStep(CheckoutStep.PaymentCaptured, orderNumber: 1001);
    var commands = saga.Handle(new ShipmentFailed(1001, "carrier_down"), now: DateTimeOffset.Parse("2026-11-09T10:00:00Z")).ToList();

    commands.ShouldContain(c => c is RefundPayment);
    commands.ShouldContain(c => c is ReleaseStock);
    saga.Step.ShouldBe(CheckoutStep.Compensating);
}

[Fact]
public void Deadline_passed_without_progress_compensates()
{
    var time = new FakeTimeProvider(DateTimeOffset.Parse("2026-11-09T10:00:00Z"));
    var saga = CheckoutSagaBuilder.Started(orderNumber: 1001, deadline: time.GetUtcNow().AddMinutes(15));
    time.Advance(TimeSpan.FromMinutes(16));

    saga.Handle(new Tick(), time.GetUtcNow()).ShouldContain(c => c is ReleaseStock);
}
```
Fault injection in an integration test: the dependency fails on the second call only
```csharp
public sealed class FlakyCarrier(ICarrierClient inner) : ICarrierClient
{
    private int _calls;
    public Task<Label> CreateLabelAsync(Shipment s, CancellationToken ct) =>
        Interlocked.Increment(ref _calls) == 2 ? throw new HttpRequestException("injected") : inner.CreateLabelAsync(s, ct);
}
```

## Production patterns
- Every consumer has tests for sequential and concurrent duplicates; every projection for reordering; every saga for each failure path and its deadline.
- Integration tests run against real SQL/Redis containers and the Service Bus emulator; fault injection covers timeouts, resets, and Nth-call failures.
- Production keeps reconciliation jobs and alerts as the final net for anything tests missed.

## Mistakes
Wrong: an idempotency test that sends the same message twice, one after the other, only.
Right: also deliver it concurrently; races hide in "check then insert" logic.

Wrong: testing sagas only on the happy path.
Right: fail each step (and let the deadline pass) and assert the compensations.

## Check yourself
1. Why test duplicates concurrently, not just sequentially?
2. How do you test that a projection handles out-of-order events?
3. What catches the distributed bugs your tests miss?

<details><summary>Answers</summary>

1. Sequential duplicates only test the "already processed" check; concurrent duplicates expose race conditions where both deliveries pass the check before either commits, which only a unique constraint or lock prevents.
2. Feed the same set of events in every relevant permutation (plus duplicates) and assert the same final state, typically "latest version wins".
3. Production reconciliation jobs with alerts, plus monitoring (DLQ counts, outbox lag, saga timeouts) and chaos experiments or game days in staging.
</details>

## Sources
- [Testcontainers for .NET](https://dotnet.testcontainers.org/)
- [Service Bus emulator](https://learn.microsoft.com/azure/service-bus-messaging/overview-emulator)
- [Polly chaos engineering](https://www.pollydocs.org/chaos/)
- [FakeTimeProvider](https://learn.microsoft.com/dotnet/api/microsoft.extensions.time.testing.faketimeprovider)
- [Jepsen analyses](https://jepsen.io/analyses)
- [xUnit v3 — theories and data](https://xunit.net/docs/getting-started/v3/whats-new)
