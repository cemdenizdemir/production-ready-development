---
title: "Functional C#: pure functions, ADTs, and results"
tech: C# 14
version: C# 14 / .NET 10 (C# 15 unions noted)
date: 2026-11-09
covers: [5, 6, 9]
---
# Functional C#: pure functions, ADTs, and results
[← Overview](00-overview.md)

## Why it matters
- `CalculateTotal` read `DateTime.Now` and a static config value. Its tests failed every night at midnight and whenever someone changed configuration.
- A payment status was a `string` (`"paid"`, `"Paid"`, `"PAID "`). A typo created a fourth status nobody handled, and those orders never shipped.
- "Not found" was an exception thrown deep in a repository and caught by message text in three places. A refactor changed the message and 404s became 500s.

## Concepts

### Functional essentials
| Idea | Meaning | C# |
|:--|:--|:--|
| ⭐ pure function | same input → same output, no side effects | `static long Discount(long total, int pct)` |
| ⭐ immutability | values don't change after creation; you create new ones | `record`, `with`, `readonly`, `ImmutableArray<T>`, `IReadOnlyList<T>` |
| ⭐ higher-order function | takes or returns functions | `Where(Func<T,bool>)`, `Func<Money, Money>` rules |
| ⭐ closure | a lambda capturing variables from its scope | `var limit = 5; items.Where(i => i.Qty > limit)` |
| ⭐ composition | build bigger functions from smaller ones | LINQ pipelines; `x => f(g(x))` |
| expressions over statements | switch expressions, ternaries, `with` | fewer mutable temporaries |
| side effects at the edges | I/O, time, randomness passed in | `TimeProvider`, results returned to the shell |

Watch closures in loops and async code: captured variables are shared, and capturing `this` or a `DbContext` in a long-lived lambda keeps it alive.

### Algebraic data types (ADTs) in C#
| Kind | Meaning | C# 14 | C# 15 (.NET 11) |
|:--|:--|:--|:--|
| ⭐ product type | "A **and** B" | `record Address(string Street, string City)` | same |
| ⭐ sum type | "A **or** B" (a closed set of cases) | abstract record + sealed case records, matched with `switch` | `union PaymentResult(Paid, Declined, Failed);` |
| ⭐ exhaustive matching | the compiler warns on unhandled cases | warning CS8509 for non-exhaustive switches (not airtight for open hierarchies) | exhaustive for unions |

Model states as types so illegal states can't be represented: a `Declined` result has a decline code; a `Paid` result has a payment ID; neither has the other's fields.

### Error handling styles
| Style | Use for | Trade-off |
|:--|:--|:--|
| ⭐ exceptions | unexpected failures: bugs, infrastructure down, broken invariants | invisible in signatures; costly when used for flow control |
| ⭐ result types | expected outcomes the caller must handle: validation, not found, declined | explicit; more code at call sites |
| `Try` pattern | simple parse-like operations | `bool TryParse(string s, out T value)` |
| nullable returns | "maybe absent" with no reason needed | `Order?` + `is null` |

The shop rule (03-backend/11-architecture lesson 03): expected business outcomes → `Result<T>`; everything else → exceptions handled globally.

## In our stack
- `Result<T>` and `Error` with stable codes: [03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-ports.md).
- Pure pricing/discount logic and records as value objects: [05-domain-driven-design](../../05-domain-driven-design/README.md).
- `TimeProvider` injected instead of `DateTime.Now`: [03-backend/01-language-runtime](../../../03-backend/01-language-runtime/README.md).
- Immutable messages and events as records: [03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md).

## When not to
- Don't build monad libraries and `Bind`/`Map` chains for every operation; a few `if (!result.IsSuccess) return result.Error;` lines are clearer to most C# teams.
- Don't make hot-path code allocate new immutable objects in tight loops when a local mutable variable is simpler and faster (keep the mutation local).
- Don't use results for truly exceptional failures (database down); exceptions with a global handler are the right tool.

## Example
`PaymentOutcome.cs` (a sum type with C# 14)
```csharp
public abstract record PaymentOutcome
{
    private PaymentOutcome() { }                       // only nested cases can derive: a closed set
    public sealed record Paid(string PaymentId, long AmountMinor) : PaymentOutcome;
    public sealed record Declined(string Code, string Message) : PaymentOutcome;
    public sealed record RequiresAction(string ClientSecret) : PaymentOutcome;
}

public static class CheckoutMessages
{
    public static string For(PaymentOutcome outcome) => outcome switch
    {
        PaymentOutcome.Paid p => $"Thank you! Payment {p.PaymentId} received.",
        PaymentOutcome.Declined { Code: "insufficient_funds" } => "Your card was declined: insufficient funds.",
        PaymentOutcome.Declined d => $"Your card was declined ({d.Code}).",
        PaymentOutcome.RequiresAction => "Please confirm the payment with your bank.",
        _ => throw new UnreachableException(),          // the private constructor keeps the set closed
    };
}
```
The same with C# 15 union types (.NET 11; not used in this stack yet):
```csharp
public record Paid(string PaymentId, long AmountMinor);
public record Declined(string Code, string Message);
public record RequiresAction(string ClientSecret);
public union PaymentOutcome(Paid, Declined, RequiresAction);   // exhaustive switch, no discard arm needed
```
Pure functions and composition:
```csharp
public static class Discounts
{
    public static Func<long, long> Percent(int pct) => total => total - total * pct / 100;
    public static Func<long, long> Cap(long maxOffMinor, Func<long, long> rule) =>
        total => Math.Max(rule(total), total - maxOffMinor);
    public static Func<long, long> Then(this Func<long, long> first, Func<long, long> second) => x => second(first(x));
}

var newsletter = Discounts.Cap(10_00, Discounts.Percent(15));     // 15% off, at most €10
var total = newsletter(89_90);                                    // 79_90 (cap applied)
```
Results for expected outcomes, exceptions for the unexpected:
```csharp
public static Result<Quantity> ParseQuantity(string input) =>
    int.TryParse(input, out var q) && q is > 0 and <= 99
        ? new Quantity(q)
        : new Error("cart.invalid_quantity", "Quantity must be 1–99.", ErrorType.Validation);
```

## Production patterns
- Business rules and calculations are pure functions over immutable inputs; time, randomness, and I/O are passed in or kept in the shell.
- Closed sets of states are sum types (sealed records today, unions with C# 15) matched with switch expressions, so new cases surface at compile time.
- Results for expected outcomes with stable error codes; exceptions for the unexpected, handled in one place.

## Mistakes
Wrong:
```csharp
public string Status { get; set; } = "pending";                    // any string is "valid"
if (order.Status == "paid") ...
```
Right: an enum for simple states, or a sum type when states carry different data.

Wrong: `catch (Exception ex) when (ex.Message.Contains("not found"))`.
Right: return `Error.NotFound("order.not_found", ...)` and map it once.

## Check yourself
1. What makes a function pure?
2. How do you make a closed set of record types in C# 14?
3. When should an operation return a result instead of throwing?

<details><summary>Answers</summary>

1. Its output depends only on its inputs, and it has no side effects (no I/O, no mutation of shared state, no reading the clock or random numbers).
2. An abstract base record with a private constructor and sealed nested case records; only the nested types can derive, so a `switch` over them covers all cases.
3. When the outcome is an expected part of the business process the caller must handle (validation failures, not found, declined payment), as opposed to bugs or infrastructure failures.
</details>

## Sources
- [Pattern matching (C#)](https://learn.microsoft.com/dotnet/csharp/fundamentals/functional/pattern-matching)
- [Records (C#)](https://learn.microsoft.com/dotnet/csharp/language-reference/builtin-types/record)
- [Lambda expressions and closures](https://learn.microsoft.com/dotnet/csharp/language-reference/operators/lambda-expressions)
- [C# 15 union types](https://devblogs.microsoft.com/dotnet/csharp-15-union-types/)
- [Exception handling best practices](https://learn.microsoft.com/dotnet/standard/exceptions/best-practices-for-exceptions)
- [Scott Wlaschin — Designing with types](https://fsharpforfunandprofit.com/series/designing-with-types/)
