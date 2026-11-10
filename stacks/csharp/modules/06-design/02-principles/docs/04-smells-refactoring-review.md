---
title: Code smells, safe refactoring, and principles in review
tech: C# 14, Visual Studio / C# Dev Kit refactorings, xUnit v3
version: C# 14 / .NET 10, xUnit v3
date: 2026-11-09
covers: [10, 11]
---
# Code smells, safe refactoring, and principles in review
[← Overview](00-overview.md)

## Why it matters
- A "quick cleanup" of `PriceCalculator` changed rounding in one branch. There were no tests for that path; customers in one country were overcharged for a week.
- A refactoring PR mixed renames, moves, and a behaviour change in 900 lines. The reviewer couldn't see the behaviour change and approved it.
- A reviewer wrote "this violates SOLID". The author didn't know what to change; the comment started an argument instead of an improvement.

## Concepts

### Code smells and their refactorings
| Smell | Sign | Refactoring |
|:--|:--|:--|
| ⭐ long method | > ~30 lines, comments separating sections | extract method; compose method |
| ⭐ large class / god object | many responsibilities, many dependencies | extract class by reason to change |
| ⭐ long parameter list | 5+ parameters, flags | introduce parameter object (record); split method |
| ⭐ feature envy | method uses another object's data more than its own | move method to that object |
| primitive obsession | `string email`, `decimal price` everywhere | value objects (`Email`, `Money`) |
| ⭐ switch on type / status in many places | repeated `switch` | polymorphism, dispatch table, sum type |
| shotgun surgery | one change touches many classes | move related code together |
| divergent change | one class changes for many reasons | split by responsibility |
| data clumps | the same 3 fields travel together | introduce a type |
| speculative generality | unused abstractions, hooks | inline, delete |
| dead code | unused members | delete (analyzers IDE0051/IDE0052) |
| comments explaining *what* | code unclear | rename, extract |
| temporal coupling | methods must be called in order | constructor/factory enforces order |

### Refactoring safely
| Step | Practice |
|:--|:--|
| ⭐ tests first | characterisation tests that pin current behaviour (even if odd) before changing structure |
| ⭐ small steps | each step compiles and passes tests; commit often |
| ⭐ automated refactorings | IDE rename, extract method/interface, change signature, move type: no typos |
| ⭐ separate refactoring from behaviour change | "tidy first": refactoring PRs change no behaviour; feature PRs come after |
| preparatory refactoring | "make the change easy, then make the easy change" (Kent Beck) |
| strangler for big ones | replace gradually (03-backend/11-architecture) |
| analyzers | complexity (CA1502), coupling (CA1506), unused code |

### Principles in code review
| Instead of | Write |
|:--|:--|
| "violates SOLID" | "suggestion: `OrderService` now changes for pricing and email templates; moving email to an `OrderPlaced` handler keeps checkout changes independent of marketing." |
| "too complex" | "question: could the 4 nested ifs become a switch expression on `(Status, PaymentMethod)`? It would make the missing combination visible." |
| "use a pattern here" | "issue: carriers are added monthly and each needs edits in 3 switches; one `IShippingRateProvider` per carrier would make it one new class." |

| Spot over-engineering | Sign |
|:--|:--|
| ⭐ abstractions with one implementation and no boundary | `IFooService` / `FooService` pairs everywhere |
| ⭐ generic frameworks for 2 cases | plugin systems, base classes with hooks |
| layers that only forward calls | repository over repository over `DbContext` |
| configuration for things that never change | |
| patterns named in class names without a reason | `OrderStrategyFactoryProvider` |

## In our stack
- Characterisation tests with xUnit v3 and Testcontainers: [01-foundations/03-testing](../../../01-foundations/03-testing/README.md).
- Analyzers and `dotnet format` in CI: [01-foundations/05-code-quality](../../../01-foundations/05-code-quality/README.md).
- Review habits and labels: [05-practice lesson 02](../../../05-practice/01-engineering-practice/docs/02-code-review.md).

## When not to
- Don't refactor code that's about to be deleted or rarely changes; spend effort where change happens (hotspots).
- Don't refactor without tests on critical paths (money, auth); write the tests first or leave it.
- Don't block a feature PR on unrelated refactoring wishes; file a ticket.

## Example
Characterisation test before refactoring a messy method:
```csharp
public sealed class ShippingCostCharacterisationTests
{
    [Theory]
    [InlineData("DE", 499, 0, 590)]       // current behaviour, recorded as is
    [InlineData("DE", 5001, 0, 0)]        // free over €50
    [InlineData("TR", 1000, 2500, 1290)]  // heavy parcel surcharge
    [InlineData("US", 1000, 0, 2490)]
    public void Matches_current_behaviour(string country, long subtotalMinor, int grams, long expectedMinor) =>
        LegacyShipping.Cost(country, subtotalMinor, grams).ShouldBe(expectedMinor);
}
```
Refactoring a long method in small steps (each step compiles and passes the tests):
```csharp
// Before
public static long Cost(string country, long subtotal, int grams)
{
    long cost;
    if (country == "DE" || country == "AT") { cost = subtotal > 5000 ? 0 : 590; }
    else if (country == "TR") { cost = 990; if (grams > 2000) cost += 300; }
    else { cost = 2490; }
    return cost;
}

// After: extract + data-driven rules; same results for every characterised case
private sealed record Zone(long BaseMinor, long? FreeOverMinor, int? HeavyOverGrams, long HeavySurchargeMinor);
private static readonly Dictionary<string, Zone> Zones = new()
{
    ["DE"] = new(590, 5000, null, 0),
    ["AT"] = new(590, 5000, null, 0),
    ["TR"] = new(990, null, 2000, 300),
};
private static readonly Zone World = new(2490, null, null, 0);

public static long Cost(string country, long subtotal, int grams)
{
    var zone = Zones.GetValueOrDefault(country, World);
    if (subtotal > zone.FreeOverMinor) return 0;
    return zone.BaseMinor + (grams > zone.HeavyOverGrams ? zone.HeavySurchargeMinor : 0);
}
```
Comparisons with a null `long?` or `int?` are `false` in C#, so zones without a threshold never trigger it.

Introduce parameter object:
```csharp
// Before: PlaceOrder(Guid customerId, string street, string city, string zip, string country, string carrier, string? code)
public sealed record PlaceOrder(Guid CustomerId, Address ShipTo, string Carrier, string? DiscountCode);
```

## Production patterns
- Refactor where change hurts (hotspots), with characterisation tests first, in small automated steps.
- Refactoring and behaviour changes go in separate commits or PRs.
- Review comments name the concrete smell, the consequence, and a specific alternative; over-engineering is called out as clearly as under-engineering.

## Mistakes
Wrong: a 900-line PR titled "cleanup + fix discount rounding".
Right: PR 1 "refactor: extract DiscountRules (no behaviour change)", PR 2 "fix: round discounts per line".

Wrong: deleting "weird" branches during refactoring because they look wrong.
Right: pin them with characterisation tests, ask why they exist, change behaviour deliberately in a separate step.

## Check yourself
1. What's a characterisation test?
2. Why separate refactoring from behaviour changes?
3. How do you turn "this violates SOLID" into useful feedback?

<details><summary>Answers</summary>

1. A test that records what the code does today (not what it should do), so you can restructure it and prove behaviour didn't change.
2. Reviewers can verify a pure refactoring quickly (tests unchanged, behaviour same) and focus on behaviour changes separately; bugs are easier to find and revert.
3. Name the specific problem (two reasons to change, a switch repeated in three places), its consequence (merge conflicts, missed cases), and a concrete alternative, with a label saying whether it blocks.
</details>

## Sources
- [Martin Fowler — Refactoring catalog](https://refactoring.com/catalog/)
- [Michael Feathers — Working Effectively with Legacy Code](https://www.oreilly.com/library/view/working-effectively-with/0131177052/)
- [Kent Beck — Tidy First?](https://www.oreilly.com/library/view/tidy-first/9781098151232/)
- [Refactoring in Visual Studio](https://learn.microsoft.com/visualstudio/ide/refactoring-in-visual-studio)
- [Code metrics — cyclomatic complexity](https://learn.microsoft.com/visualstudio/code-quality/code-metrics-cyclomatic-complexity)
- [Refactoring.Guru — Code smells](https://refactoring.guru/refactoring/smells)
