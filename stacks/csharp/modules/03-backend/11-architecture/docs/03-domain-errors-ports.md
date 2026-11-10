---
title: Domain logic, error architecture, and ports and adapters
tech: C# 14, ASP.NET Core 10 (ProblemDetails), Stripe.net, Azure SDKs
version: .NET 10, C# 14
date: 2026-11-09
covers: [5, 6, 7]
---
# Domain logic, error architecture, and ports and adapters
[← Overview](00-overview.md)

## Why it matters
- "An order can't be cancelled after shipping" was checked in the endpoint, but not in the admin tool or the Hangfire job. Shipped orders got cancelled and refunded.
- Prices were `decimal` in some places and `long` cents in others. A rounding bug undercharged every order with 3+ items by 1 cent, for months.
- Errors were thrown as `Exception("not found")` and caught by string matching. A message change turned 404s into 500s and broke the mobile app.

## Concepts

### Domain logic out of HTTP and SQL
| Put in the domain | Keep out of the domain |
|:--|:--|
| ⭐ invariants: "an order has 1–50 lines", "total ≥ 0" | HTTP status codes, routes, headers |
| ⭐ state transitions: `Pay()`, `Ship()`, `Cancel()` with rules | SQL, EF Core queries, transactions |
| calculations: totals, discounts, tax | calls to Stripe, email, storage |
| domain events: `OrderPlaced`, `OrderCancelled` | logging and telemetry setup |

| Tool | C# |
|:--|:--|
| ⭐ value objects | `readonly record struct Money(long Minor, string Currency)`, `Sku`, `Email`: validated on creation, immutable, equal by value |
| ⭐ encapsulated entities | private setters, private collections exposed as `IReadOnlyList<T>`, methods that enforce rules |
| factory methods | `Order.Create(...)` returns a valid order or an error |
| strongly typed IDs | `readonly record struct OrderId(long Value)` prevents mixing IDs |

### Error architecture
| Kind | Example | Represent as | HTTP |
|:--|:--|:--|:--|
| ⭐ expected domain error | out of stock, invalid transition | `Result` with an `Error(Code, Message, Type)` | 409 / 422 |
| validation | missing field, bad format | validation problem details (02-api-design) | 400 |
| not found | unknown order | `Error.NotFound(...)` | 404 |
| unauthorised / forbidden | not your order | `Error.Forbidden(...)` (or 404 to avoid leaking existence) | 403 / 404 |
| ⭐ unexpected failure | bug, dependency down | exception, caught by the global handler | 500 / 503 |

Rules: expected outcomes are **return values**, unexpected ones are **exceptions**. Error codes (`order.already_shipped`) are stable and documented; messages can change. Map errors to HTTP **in one place**.
Also seen: ErrorOr, OneOf, FluentResults libraries. A 40-line `Result` type is usually enough.

### Ports and adapters
| Port (interface owned by the use case) | Adapter (implementation at the edge) |
|:--|:--|
| ⭐ `IPaymentGateway` | `StripeGateway` (Stripe.net), `FakePaymentGateway` (tests) |
| `IEmailSender` | `AcsEmailSender` (Azure Communication Services), `FakeEmailSender` |
| `IFileStorage` | `BlobFileStorage` (Azure Blob Storage), `LocalFileStorage` (dev) |
| `TimeProvider` (built in) | `TimeProvider.System`, `FakeTimeProvider` |

The port speaks the domain's language (`ChargeAsync(Money, PaymentMethodToken)`), not the vendor's. Switching or upgrading a provider changes one adapter. Don't create ports for things you won't swap or fake (your own `DbContext` for example).

## Example
`src/Shared/Shop.SharedKernel/Result.cs`
```csharp
public enum ErrorType { Validation, NotFound, Conflict, Forbidden, Unprocessable }

public sealed record Error(string Code, string Message, ErrorType Type)
{
    public static Error NotFound(string code, string message) => new(code, message, ErrorType.NotFound);
    public static Error Conflict(string code, string message) => new(code, message, ErrorType.Conflict);
}

public readonly record struct Result<T>
{
    public T? Value { get; }
    public Error? Error { get; }
    public bool IsSuccess => Error is null;
    private Result(T? value, Error? error) { Value = value; Error = error; }
    public static Result<T> Ok(T value) => new(value, null);
    public static Result<T> Fail(Error error) => new(default, error);
    public static implicit operator Result<T>(T value) => Ok(value);
    public static implicit operator Result<T>(Error error) => Fail(error);
}
```
`src/Modules/Ordering/Shop.Ordering/Domain/Order.cs`
```csharp
public sealed class Order
{
    private readonly List<OrderLine> _lines = [];
    private readonly List<IDomainEvent> _events = [];
    public OrderId Id { get; private set; }
    public OrderStatus Status { get; private set; } = OrderStatus.Pending;
    public string Currency { get; private set; } = "EUR";
    public IReadOnlyList<OrderLine> Lines => _lines;
    public Money Total => _lines.Aggregate(Money.Zero(Currency), (sum, l) => sum + l.Subtotal);

    public Result<Order> Cancel(DateTimeOffset now)
    {
        if (Status is OrderStatus.Shipped or OrderStatus.Delivered)
            return Error.Conflict("order.already_shipped", "Shipped orders can't be cancelled; request a return instead.");
        if (Status is OrderStatus.Cancelled) return this;                 // idempotent
        Status = OrderStatus.Cancelled;
        _events.Add(new OrderCancelled(Id, now));
        return this;
    }
}
```
`src/Shop.Api/Http/ResultHttpExtensions.cs` (the one mapping to HTTP)
```csharp
using Microsoft.AspNetCore.Http.HttpResults;

public static class ResultHttpExtensions
{
    public static IResult ToHttp<T>(this Result<T> result, Func<T, IResult> onSuccess) =>
        result.IsSuccess ? onSuccess(result.Value!) : result.Error!.ToProblem();

    public static IResult ToProblem(this Error error) => TypedResults.Problem(
        title: error.Message,
        statusCode: error.Type switch
        {
            ErrorType.Validation => StatusCodes.Status400BadRequest,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            ErrorType.Unprocessable => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status500InternalServerError,
        },
        extensions: new Dictionary<string, object?> { ["code"] = error.Code });
}
```
`src/Modules/Payments/Shop.Payments/Ports/IPaymentGateway.cs` and its adapter
```csharp
public interface IPaymentGateway
{
    Task<Result<PaymentId>> ChargeAsync(ChargeRequest request, CancellationToken ct);
}

internal sealed class StripeGateway(PaymentIntentService intents) : IPaymentGateway
{
    public async Task<Result<PaymentId>> ChargeAsync(ChargeRequest req, CancellationToken ct)
    {
        try
        {
            var intent = await intents.CreateAsync(new PaymentIntentCreateOptions
            {
                Amount = req.Amount.Minor, Currency = req.Amount.Currency.ToLowerInvariant(),
                PaymentMethod = req.PaymentMethodToken, Confirm = true,
            }, new RequestOptions { IdempotencyKey = req.IdempotencyKey }, ct);   // one key per payment attempt
            return new PaymentId(intent.Id);
        }
        catch (StripeException ex) when (ex.StripeError?.Type == "card_error")
        {
            return new Error("payment.declined", ex.StripeError.Message ?? "Card declined", ErrorType.Unprocessable);
        }
    }
}
```
Stripe types never leave the adapter; the rest of the app sees `Result<PaymentId>`.

## Production patterns
- Rules live on entities and value objects, tested with plain unit tests (no database). Use cases orchestrate; endpoints translate.
- Money is a value object in minor units with a currency; IDs are strongly typed.
- Expected errors are results with stable codes, mapped to problem details in one extension; unexpected errors are exceptions handled globally (02-api-design).
- Every external service is behind a port with a fake for tests and an adapter per provider.

## Mistakes
Wrong:
```csharp
app.MapPost("/orders/{id}/cancel", async (long id, ShopDb db) =>
{
    var o = await db.Orders.FindAsync(id);
    if (o!.Status == "Shipped") return Results.BadRequest("can't");   // rule in the endpoint, stringly typed
    o.Status = "Cancelled"; await db.SaveChangesAsync(); return Results.Ok();
});
```
Right: `order.Cancel(now)` returns a result; the endpoint calls the use case and maps the result.

Wrong: `throw new Exception("Order not found")` caught by message text.
Right: `Error.NotFound("order.not_found", ...)` mapped to 404 with `code` in problem details.

## Check yourself
1. Which errors should be results and which exceptions?
2. Why should the payment port not use Stripe's types?
3. What makes `Money` a value object?

<details><summary>Answers</summary>

1. Expected business outcomes (not found, conflicts, declined payments, invalid transitions) are results the caller handles. Bugs and infrastructure failures (null references, timeouts, database down) are exceptions handled by the global handler.
2. So the domain and use cases don't depend on one vendor. Changing provider, upgrading the SDK, or faking payments in tests only touches the adapter.
3. It's immutable, validated on creation, has no identity, and two values with the same amount and currency are equal.
</details>

## Sources
- [Design a DDD-oriented microservice (.NET)](https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/ddd-oriented-microservice)
- [Implement value objects](https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/implement-value-objects)
- [Handle errors in ASP.NET Core APIs](https://learn.microsoft.com/aspnet/core/fundamentals/error-handling-api)
- [Alistair Cockburn — Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Stripe .NET library](https://github.com/stripe/stripe-dotnet)
