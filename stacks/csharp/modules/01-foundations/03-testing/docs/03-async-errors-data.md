---
title: Async code, errors, edge cases, and test data
tech: xUnit v3, Shouldly, C# 14
version: xunit.v3 3.2.x, Shouldly 4.x
date: 2026-11-09
covers: [6, 9]
---
# Async code, errors, edge cases, and test data
[← Overview](00-overview.md)

## Why it matters
- A test calls an `async` method without `await`; it passes before the method even runs. The bug ships.
- Every test builds an `Order` with 14 constructor arguments; adding one field means editing 200 tests.
- Nobody tested an empty cart, a quantity of `int.MaxValue`, or a currency mismatch. Production did.

## Concepts

### Testing async code
| Rule | Why |
|:--|:--|
| test methods are `async Task` (or `ValueTask`) | xUnit awaits them; `async void` tests are not supported |
| always `await` the call under test | otherwise assertions run before the work |
| `await Should.ThrowAsync<T>(() => sut.DoAsync())` | async exceptions surface on await |
| pass `TestContext.Current.CancellationToken` | aborted runs stop cleanly |
| no `.Result` / `.Wait()` | can deadlock and hides `AggregateException` details |
| test cancellation explicitly | `new CancellationTokenSource()` + `Cancel()`; expect `OperationCanceledException` |

### Errors and edge cases
Check the error **type** and the **meaningful part** of the message or code, not the full text.
```csharp
var ex = Should.Throw<DomainException>(() => order.AddLine("COF-1", 0));
ex.Code.ShouldBe("quantity.invalid");
```
Edge-case checklist for most inputs:
| Input kind | Cases |
|:--|:--|
| numbers | 0, negative, 1, max, overflow, decimal rounding midpoints |
| strings | `null`, empty, whitespace, very long, Unicode (`"Café"`, emoji), different case |
| collections | empty, one item, duplicates, large |
| time | midnight, DST change, end of month, leap day, time zones |
| money | currency mismatch, minor units, rounding |
| concurrency | two updates at once (integration test with `rowversion`) |
| state | operation on already-cancelled / already-shipped entity |

### Test data: fixtures, factories, builders
| Technique | Good for |
|:--|:--|
| inline literals | small, readable tests |
| `[Theory]` + `TheoryData<…>` | tables of inputs and expected outputs |
| object mother (`TestOrders.Shipped()`) | named, common scenarios |
| ⭐ test data builder | defaults for everything; override what the test cares about |
| `with` expressions on records | quick variations: `order with { Status = Shipped }` |
| fixture classes (lesson 04) | expensive shared resources (DB, web app) |

Builder rule: a test should only mention the values that matter for its behavior.

## Example
`tests/Shop.Domain.Tests/Builders/OrderBuilder.cs`
```csharp
using Shop.Domain;

namespace Shop.Domain.Tests.Builders;

public sealed class OrderBuilder
{
    private Guid _customerId = Guid.CreateVersion7();
    private readonly List<(string Sku, int Qty, decimal Price)> _lines = [("COF-1", 1, 10m)];
    private OrderStatus _status = OrderStatus.Placed;

    public OrderBuilder ForCustomer(Guid id) { _customerId = id; return this; }
    public OrderBuilder WithLine(string sku, int qty, decimal price) { _lines.Add((sku, qty, price)); return this; }
    public OrderBuilder WithNoLines() { _lines.Clear(); return this; }
    public OrderBuilder Shipped() { _status = OrderStatus.Shipped; return this; }

    public Order Build()
    {
        var order = Order.Create(_customerId);
        foreach (var (sku, qty, price) in _lines) order.AddLine(sku, qty, price);
        if (_status == OrderStatus.Shipped) order.MarkShipped();
        return order;
    }
}
```
`tests/Shop.Domain.Tests/OrderTests.cs`
```csharp
using Shop.Domain;
using Shop.Domain.Tests.Builders;
using Shouldly;

namespace Shop.Domain.Tests;

public class OrderTests
{
    [Fact]
    public void Cancel_after_shipment_is_rejected()
    {
        var order = new OrderBuilder().Shipped().Build();

        var ex = Should.Throw<DomainException>(() => order.Cancel());

        ex.Code.ShouldBe("order.already_shipped");
        order.Status.ShouldBe(OrderStatus.Shipped);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(1001)]
    public void AddLine_rejects_quantities_outside_1_to_1000(int qty)
    {
        var order = new OrderBuilder().WithNoLines().Build();

        Should.Throw<DomainException>(() => order.AddLine("COF-1", qty, 10m)).Code.ShouldBe("quantity.invalid");
    }

    [Fact]
    public async Task Confirm_honours_cancellation()
    {
        var order = new OrderBuilder().Build();
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Should.ThrowAsync<OperationCanceledException>(() => order.ConfirmAsync(cts.Token));
    }
}
```

## Production patterns
- One builder per aggregate, in the test project; defaults are valid and boring.
- Turn bug reports into tests first: reproduce, see it fail, then fix.
- Name edge-case tests after the rule they protect (`..._rejects_quantities_outside_1_to_1000`).
- Keep the xUnit analyzers on; they flag `async void` tests, blocking calls, and missing cancellation tokens.

## Mistakes
Wrong: not awaiting.
```csharp
[Fact]
public void Saves() { repo.SaveAsync(order); repo.Count.ShouldBe(1); }
```
Right:
```csharp
[Fact]
public async Task Saves() { await repo.SaveAsync(order, TestContext.Current.CancellationToken); repo.Count.ShouldBe(1); }
```

Wrong: asserting the full exception message (`"Quantity must be between 1 and 1000 (was 0)."`).
Right: assert the exception type and a stable code.

## Check yourself
1. Why is `async void` a problem in tests?
2. What does a test data builder give you that a constructor call doesn't?
3. Name three edge cases for a `quantity` parameter.

<details><summary>Answers</summary>

1. The runner can't await it, so exceptions and assertions after the first `await` are lost; xUnit v3 doesn't support it.
2. Valid defaults for everything, so each test only states what matters, and new fields don't break existing tests.
3. 0, negative, the upper bound + 1 (and `int.MaxValue` for overflow).
</details>

## Sources
- [xUnit.net — Async tests](https://xunit.net/docs/getting-started/v3/whats-new)
- [Shouldly — ShouldThrow](https://docs.shouldly.org/documentation/exceptions/throw)
- [Unit testing best practices for .NET](https://learn.microsoft.com/dotnet/core/testing/unit-testing-best-practices)
- [Nat Pryce — Test Data Builders](http://www.natpryce.com/articles/000714.html)
