---
title: Why we test, good tests, and xUnit v3 basics
tech: xUnit v3, Shouldly, .NET 10 SDK
version: xunit.v3 3.2.x, Shouldly 4.x
date: 2026-11-09
covers: [1, 2, 3, 15]
---
# Why we test, good tests, and xUnit v3 basics
[← Overview](00-overview.md)

## Why it matters
- A discount rule is changed for one campaign; three other prices change silently. No test pinned the rule.
- A suite of 900 tests named `Test1`…`Test900` fails; nobody can tell what broke without reading code.
- Tests that assert on private fields break on every refactor, so the team stops refactoring.

## Concepts

### What a suite is for
| Level | Scope | Speed | In this stack |
|:--|:--|:--|:--|
| Unit | one class or function, no I/O | ms | domain logic, mappers, validators |
| Integration | app + real dependencies | 10s–100s of ms | `WebApplicationFactory` + SQL Server container |
| End-to-end | browser → frontend → API → DB | seconds | Playwright (02-frontend/13) |

Test **behavior through public APIs**, not implementation details. A good test fails when the behavior breaks and only then.

### Good tests
- **Arrange, Act, Assert**, separated by blank lines.
- **One behavior per test**; several asserts are fine if they describe one outcome.
- **Names that read as specs:** `Cancel_after_shipment_is_rejected`, or `Method_State_Expected`.
- **Deterministic:** no real clock, random, network, or test order.
- **Fast enough to run on every save.**

### xUnit v3 essentials
```bash
dotnet new install xunit.v3.templates
dotnet new xunit3 -n Shop.Domain.Tests -o tests/Shop.Domain.Tests
dotnet add tests/Shop.Domain.Tests package Shouldly
dotnet add tests/Shop.Domain.Tests reference src/Shop.Domain
```
| Feature | Use |
|:--|:--|
| `[Fact]` | a test with no parameters |
| `[Theory]` + `[InlineData(...)]` | one test, several inputs |
| `[MemberData(nameof(Cases))]` / `TheoryData<T1, T2>` | typed or computed cases |
| `[Trait("Category", "Slow")]` | tag for filtering |
| `Assert.Skip("reason")` / `[Fact(Skip = "...")]` | skip dynamically / statically |
| `[Fact(Explicit = true)]` | runs only when asked for explicitly |
| `TestContext.Current.CancellationToken` | cancels when the run is aborted or times out |
| `ITestOutputHelper` (constructor) | write output shown with the test |
| constructor / `Dispose` | per-test setup and teardown (a new class instance per test) |

### Shouldly assertions
| Assertion | Reads as |
|:--|:--|
| `total.ShouldBe(12.50m)` | equality |
| `items.ShouldContain(i => i.Sku == "COF-1")` | collection contains |
| `order.ShouldNotBeNull()` | null check (and narrows nullability) |
| `dto.ShouldBeEquivalentTo(expected)` | deep equality |
| `Should.Throw<DomainException>(() => order.Cancel())` | sync exception |
| `await Should.ThrowAsync<HttpRequestException>(() => call())` | async exception |
| `value.ShouldBeInRange(1, 10)` | ranges |

Failure messages quote your code: `total should be 12.50m but was 12.00m`.

### Running tests
| Command | Does |
|:--|:--|
| `dotnet test` | build and run all test projects in the solution |
| `dotnet test --filter "FullyQualifiedName~Order"` | VSTest-style filter |
| `dotnet test -- --filter-class "*OrderTests"` | xUnit v3 native filter on MTP |
| `dotnet watch test --project tests/Shop.Domain.Tests` | rerun on save |
| `dotnet run --project tests/Shop.Domain.Tests` | v3 test projects are executables |

VSTest vs Microsoft.Testing.Platform (MTP): VSTest is the classic host; MTP is the newer, faster, in-process platform. xUnit v3 supports both. On the .NET 10 SDK you can opt the whole repo into MTP:

`global.json`
```json
{
  "sdk": { "version": "10.0.402", "rollForward": "latestFeature" },
  "test": { "runner": "Microsoft.Testing.Platform" }
}
```

## Example
`src/Shop.Domain/Pricing.cs`
```csharp
namespace Shop.Domain;

public static class Pricing
{
    public static decimal Total(decimal unitPrice, int quantity, decimal discountPercent)
    {
        if (quantity <= 0) throw new ArgumentOutOfRangeException(nameof(quantity));
        var gross = unitPrice * quantity;
        return Math.Round(gross * (1 - discountPercent / 100m), 2, MidpointRounding.AwayFromZero);
    }
}
```
`tests/Shop.Domain.Tests/PricingTests.cs`
```csharp
using Shop.Domain;
using Shouldly;

namespace Shop.Domain.Tests;

public class PricingTests
{
    // decimal can't appear in attributes, so typed TheoryData holds the cases
    public static TheoryData<decimal, int, decimal, decimal> Cases => new()
    {
        { 10.00m, 2, 0m, 20.00m },
        { 10.00m, 3, 10m, 27.00m },
        { 0.25m, 1, 50m, 0.13m },        // 0.125 is a midpoint: away from zero, not banker's rounding
    };

    [Theory]
    [MemberData(nameof(Cases))]
    public void Total_applies_discount_and_rounds(decimal price, int qty, decimal discount, decimal expected)
    {
        var total = Pricing.Total(price, qty, discount);

        total.ShouldBe(expected);
    }

    [Fact]
    public void Total_rejects_zero_quantity()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => Pricing.Total(10m, 0, 0));
    }
}
```
`terminal`
```bash
dotnet test tests/Shop.Domain.Tests
```

## Production patterns
- One test project per production project (`Shop.Domain.Tests`, `Shop.Api.IntegrationTests`), mirrored folders.
- Pure domain logic gets dense `[Theory]` tables; endpoints get integration tests.
- Pass `TestContext.Current.CancellationToken` to async calls (xUnit analyzer `xUnit1051` reminds you).
- Keep the whole unit suite under ~10 s so people run it locally.

## Mistakes
Wrong: testing internals.
```csharp
typeof(Order).GetField("_status", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(order).ShouldBe(2);
```
Right: assert on public behavior.
```csharp
order.Status.ShouldBe(OrderStatus.Cancelled);
```

Wrong: computing the expected value with the same formula as the code.
```csharp
total.ShouldBe(Math.Round(price * qty * (1 - discount / 100m), 2));   // repeats the bug if there is one
```
Right: expected values worked out by hand, as `decimal` literals in `TheoryData`.

## Check yourself
1. What is the difference between `[Fact]` and `[Theory]`?
2. Why is a new instance of the test class created for each test?
3. How do you run only tests whose name contains `Order` with VSTest-style filtering?

<details><summary>Answers</summary>

1. A fact has no parameters; a theory runs once per data row.
2. Isolation: state in fields cannot leak between tests. Shared state goes in fixtures (lesson 04).
3. `dotnet test --filter "FullyQualifiedName~Order"`.
</details>

## Sources
- [xUnit.net v3 — Getting started](https://xunit.net/docs/getting-started/v3/getting-started)
- [xUnit.net v3 — Microsoft Testing Platform](https://xunit.net/docs/getting-started/v3/microsoft-testing-platform)
- [Unit testing best practices for .NET](https://learn.microsoft.com/dotnet/core/testing/unit-testing-best-practices)
- [dotnet test](https://learn.microsoft.com/dotnet/core/tools/dotnet-test)
- [Shouldly docs](https://docs.shouldly.org/)
