---
title: Test doubles with NSubstitute and TimeProvider
tech: NSubstitute, Microsoft.Extensions.TimeProvider.Testing, xUnit v3
version: NSubstitute 5.x, Microsoft.Extensions.TimeProvider.Testing 10.x
date: 2026-11-09
covers: [4, 5]
---
# Test doubles with NSubstitute and TimeProvider
[← Overview](00-overview.md)

## Why it matters
- A test suite mocks `DbContext`, `IRepository`, and every service. All tests pass; the first real query fails because EF Core can't translate a LINQ expression.
- A "token expires after 15 minutes" test calls `Thread.Sleep(900_000)`, so nobody runs it.
- A test checks that `_logger.Log` was called exactly 3 times; adding one log line breaks 40 tests.

## Concepts

### Kinds of doubles
| Double | What it does | Example |
|:--|:--|:--|
| Dummy | fills a parameter, never used | `Substitute.For<ILogger<T>>()` passed but ignored |
| Stub | returns canned answers | `rates.GetRate("EUR").Returns(1.08m)` |
| Spy | records calls for later checks | `gateway.Received(1).Charge(...)` |
| Mock | stub + expectations about calls | same as spy in NSubstitute |
| Fake | working light implementation | in-memory repository, `FakeTimeProvider` |

### When not to mock
| Don't mock | Use instead |
|:--|:--|
| your own domain objects | the real ones |
| `DbContext` / EF Core | a real SQL Server in a container (lesson 04) |
| `HttpClient` internals | a fake `HttpMessageHandler`, or a fake service behind your own interface |
| types you don't own, directly | wrap them in your own interface (port), then fake that |
| logging | `NullLogger<T>.Instance`, or `FakeLogger` when logs are the behavior |

Mock at **boundaries you own**: `IPaymentGateway`, `IEmailSender`, `IClock`-like abstractions. Prefer state-based checks (what was returned or stored) over interaction checks (what was called).

### NSubstitute in one table
| Want | Code |
|:--|:--|
| create | `var gw = Substitute.For<IPaymentGateway>();` |
| return a value | `gw.Charge(Arg.Any<Money>(), default).Returns(new ChargeResult("ch_1"));` |
| async return | `.Returns(Task.FromResult(x))` or just `.Returns(x)` for `Task<T>` methods |
| match arguments | `Arg.Is<Money>(m => m.Amount > 100)` |
| any args | `.ReturnsForAnyArgs(x)` |
| throw | `.ThrowsAsync(new TimeoutException())` (`NSubstitute.ExceptionExtensions`) |
| verify called | `await gw.Received(1).Charge(Arg.Any<Money>(), Arg.Any<CancellationToken>());` |
| verify not called | `gw.DidNotReceive().Refund(default!)` |
| capture an argument | `Arg.Do<Money>(m => captured = m)` |

Add `NSubstitute.Analyzers.CSharp` to catch mistakes like substituting non-virtual members.

### Time: `TimeProvider` and `FakeTimeProvider`
Inject `TimeProvider` (built into .NET 8+) instead of calling `DateTime.UtcNow`.
```csharp
builder.Services.AddSingleton(TimeProvider.System);   // production
```
```csharp
var time = new FakeTimeProvider(new DateTimeOffset(2026, 11, 9, 9, 0, 0, TimeSpan.Zero));
time.Advance(TimeSpan.FromMinutes(16));               // tests
```
`FakeTimeProvider` also drives `Task.Delay(…, time)` and `PeriodicTimer`, so timeouts and schedules are testable without waiting.

Randomness and IDs: inject `Random` or a small `IIdGenerator` and pass a seeded or fixed one in tests.

## Example
`src/Shop.Domain/Checkout.cs`
```csharp
namespace Shop.Domain;

public record Money(decimal Amount, string Currency);
public record ChargeResult(string ChargeId);

public interface IPaymentGateway
{
    Task<ChargeResult> Charge(Money amount, CancellationToken ct);
}

public sealed class Checkout(IPaymentGateway gateway, TimeProvider time)
{
    private static readonly TimeSpan HoldFor = TimeSpan.FromMinutes(15);

    public async Task<string> Pay(Money amount, DateTimeOffset cartCreatedAt, CancellationToken ct)
    {
        if (time.GetUtcNow() - cartCreatedAt > HoldFor)
            throw new InvalidOperationException("Cart hold expired.");
        var result = await gateway.Charge(amount, ct);
        return result.ChargeId;
    }
}
```
`tests/Shop.Domain.Tests/CheckoutTests.cs`
```csharp
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Shop.Domain;
using Shouldly;

namespace Shop.Domain.Tests;

public class CheckoutTests
{
    private readonly IPaymentGateway _gateway = Substitute.For<IPaymentGateway>();
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 11, 9, 9, 0, 0, TimeSpan.Zero));

    [Fact]
    public async Task Pays_within_hold_window()
    {
        _gateway.Charge(Arg.Any<Money>(), Arg.Any<CancellationToken>()).Returns(new ChargeResult("ch_1"));
        var checkout = new Checkout(_gateway, _time);
        var created = _time.GetUtcNow();
        _time.Advance(TimeSpan.FromMinutes(10));

        var id = await checkout.Pay(new Money(20m, "EUR"), created, TestContext.Current.CancellationToken);

        id.ShouldBe("ch_1");
        await _gateway.Received(1).Charge(Arg.Is<Money>(m => m.Amount == 20m), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Rejects_after_hold_window_without_charging()
    {
        var checkout = new Checkout(_gateway, _time);
        var created = _time.GetUtcNow();
        _time.Advance(TimeSpan.FromMinutes(16));

        await Should.ThrowAsync<InvalidOperationException>(
            () => checkout.Pay(new Money(20m, "EUR"), created, TestContext.Current.CancellationToken));
        await _gateway.DidNotReceiveWithAnyArgs().Charge(default!, default);
    }
}
```

## Production patterns
- Design for testability with constructor injection: `TimeProvider`, your own ports, options. No static `DateTime.UtcNow` in domain code.
- Fakes for anything with behavior (in-memory email outbox); substitutes for one-off stubbing.
- Verify interactions only when the interaction **is** the behavior (a charge was made, an email was sent).
- `NullLogger<T>.Instance` in tests unless logging is part of the contract.

## Mistakes
Wrong: mocking EF Core.
```csharp
var set = Substitute.For<DbSet<Order>>();   // LINQ, includes, and SQL are not tested at all
```
Right: real SQL Server via Testcontainers (lesson 04), or keep queries behind a repository and test that with the real database.

Wrong: sleeping in tests.
```csharp
await Task.Delay(TimeSpan.FromMinutes(16));
```
Right: `FakeTimeProvider.Advance(TimeSpan.FromMinutes(16))`.

## Check yourself
1. What is the difference between a stub and a fake?
2. Why wrap a third-party SDK client behind your own interface before faking it?
3. What does `FakeTimeProvider.Advance` affect besides `GetUtcNow()`?

<details><summary>Answers</summary>

1. A stub returns canned values for specific calls; a fake is a working simplified implementation (e.g. in-memory store).
2. You control a small, stable interface shaped for your needs; faking a large SDK couples tests to its internals and changes.
3. Timers and delays created from that provider (`Task.Delay(ts, provider)`, `CreateTimer`, `PeriodicTimer` via the provider).
</details>

## Sources
- [NSubstitute — Getting started](https://nsubstitute.github.io/help/getting-started/)
- [NSubstitute.Analyzers](https://github.com/nsubstitute/NSubstitute.Analyzers)
- [TimeProvider class](https://learn.microsoft.com/dotnet/api/system.timeprovider)
- [FakeTimeProvider](https://learn.microsoft.com/dotnet/api/microsoft.extensions.time.testing.faketimeprovider)
- [Martin Fowler — Mocks aren't stubs](https://martinfowler.com/articles/mocksArentStubs.html)
