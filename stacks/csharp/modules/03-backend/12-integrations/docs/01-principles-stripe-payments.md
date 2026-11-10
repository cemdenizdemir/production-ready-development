---
title: Integration principles and Stripe payments
tech: Stripe.net, Stripe.js / React Stripe.js, Microsoft.Extensions.Http.Resilience, Azure Key Vault
version: Stripe.net 50+, @stripe/stripe-js and @stripe/react-stripe-js (current majors)
date: 2026-11-09
covers: [1, 2]
---
# Integration principles and Stripe payments
[← Overview](00-overview.md)

## Why it matters
- The client sent `amount: 4990` with the request, and the server charged it. Someone changed it to `amount: 1` in DevTools and bought €49.90 of coffee for one cent.
- A timeout on `PaymentIntent` creation was retried without an idempotency key. The customer saw two authorisations on their card.
- `19.99m * 100` was stored as `1998.9999` in a float field. Japanese yen (no minor unit) were multiplied by 100, so a ¥1,000 order was charged ¥100,000.

## Concepts

### Integration principles
| Principle | In practice |
|:--|:--|
| ⭐ adapter behind a port | `IPaymentGateway` → `StripeGateway`; vendor types stay in the adapter (11-architecture) |
| ⭐ timeouts and limited retries | resilience handler or SDK settings; POST retries only with idempotency keys (08-reliability) |
| ⭐ idempotency | keys on every create call; your own records keyed by partner IDs (unique constraints) |
| ⭐ secrets | API keys in Key Vault, loaded through configuration; restricted keys with only needed permissions |
| sandboxes | test mode keys in dev and staging; production keys only in production |
| own records first | store what you asked for (pending payment) before calling the partner |
| observe | per-integration metrics, logs with partner request IDs, alerts (lesson 06) |
| reconcile | scheduled comparison of your records with the partner's (lesson 06) |

### Stripe payments
| Concept | Meaning |
|:--|:--|
| ⭐ PaymentIntent | one attempt to collect a payment: amount, currency, status (`requires_payment_method` → `processing` → `succeeded` / `requires_action` / `canceled`) |
| client secret | lets the browser confirm that PaymentIntent; never log or store it beyond the session |
| ⭐ amounts in minor units | `long` cents (`4990` = €49.90); zero-decimal currencies (JPY) have no minor unit |
| ⭐ server decides the amount | compute from the order in your DB, never from the request |
| `automatic_payment_methods` | Stripe offers the methods enabled in the dashboard (cards, wallets, local methods) |
| 3-D Secure / SCA | `requires_action` handled by Stripe.js in the browser |
| metadata | attach `order_id` for reconciliation and support |
| test mode | `sk_test_...` keys, test cards, no real money |

| Option | What | Choose when |
|:--|:--|:--|
| ⭐ Stripe Checkout (hosted or embedded) | Stripe-built payment page/session | fastest, least PCI scope, good conversion; less UI control |
| ⭐ Payment Element | embeddable UI component + PaymentIntents | the checkout must be part of your page and design |
| Card Element / raw card fields | legacy | avoid |

Both keep card data off your servers (PCI SAQ A). Never send card numbers to your API.

## Example
`src/Modules/Payments/Shop.Payments/Stripe/StripeGateway.cs`
```csharp
using Stripe;

internal sealed class StripeGateway(StripeClient stripe, ILogger<StripeGateway> log) : IPaymentGateway
{
    public async Task<Result<PaymentSession>> CreateAsync(PaymentRequest req, CancellationToken ct)
    {
        var intents = new PaymentIntentService(stripe);
        try
        {
            var intent = await intents.CreateAsync(new PaymentIntentCreateOptions
            {
                Amount = req.Amount.Minor,                         // from the order in our DB
                Currency = req.Amount.Currency.ToLowerInvariant(),
                AutomaticPaymentMethods = new() { Enabled = true },
                Metadata = new() { ["order_id"] = req.OrderId.ToString() },
                Description = $"Order {req.OrderNumber}",
            }, new RequestOptions { IdempotencyKey = $"pi:{req.OrderId}:{req.AttemptNumber}" }, ct);

            return new PaymentSession(intent.Id, intent.ClientSecret);
        }
        catch (StripeException ex)
        {
            log.LogWarning(ex, "Stripe error {Code} creating PaymentIntent (request {RequestId})",
                ex.StripeError?.Code, ex.StripeResponse?.RequestId);
            return new Error("payment.provider_error", "Payment could not be started.", ErrorType.Unprocessable);
        }
    }
}
```
`src/Modules/Payments/Shop.Payments/PaymentsModule.cs` (registration)
```csharp
services.AddOptions<StripeOptions>().BindConfiguration("Payments:Stripe").ValidateDataAnnotations().ValidateOnStart();
services.AddSingleton(sp =>
{
    var o = sp.GetRequiredService<IOptions<StripeOptions>>().Value;   // SecretKey from Key Vault via configuration
    var http = new HttpClient(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(2) })
    {
        Timeout = TimeSpan.FromSeconds(20),
    };
    return new StripeClient(o.SecretKey, httpClient: new SystemNetHttpClient(http, maxNetworkRetries: 2));
});
```
The `StripeClient` is a long-lived singleton, so it gets one `HttpClient` with `PooledConnectionLifetime` (08-reliability lesson 02) instead of a factory client captured forever. Stripe.net retries network failures itself (adding idempotency keys to retried POSTs), so don't add a second retry layer.

Endpoint: the server creates the intent from the order, the browser confirms it.
```csharp
app.MapPost("/orders/{number:long}/payment", async (long number, ClaimsPrincipal user, OrderingDb db, IPaymentGateway payments, CancellationToken ct) =>
{
    var order = await db.Orders.SingleOrDefaultAsync(o => o.Number == number && o.CustomerId == user.GetUserId(), ct);
    if (order is null) return Results.NotFound();
    var result = await payments.CreateAsync(PaymentRequest.For(order), ct);
    return result.ToHttp(s => TypedResults.Ok(new { s.ClientSecret }));
}).RequireAuthorization();
```
`frontend/app/checkout/payment-form.tsx` (Payment Element)
```tsx
"use client";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

export function PaymentForm({ orderNumber }: { orderNumber: number }) {
  const stripe = useStripe();
  const elements = useElements();
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/orders/${orderNumber}/complete` },
    });
    if (error) alert(error.message);   // show inline in a real UI
  }
  return <form onSubmit={onSubmit}><PaymentElement /><button disabled={!stripe}>Pay</button></form>;
}
```
The order becomes **paid only when the webhook arrives** (lesson 02), not when the browser redirects to `return_url`.

## Production patterns
- The server computes amounts from its own data; the browser never sends prices.
- A pending payment record exists before Stripe is called; Stripe IDs are stored with unique constraints.
- Idempotency keys per payment attempt; metadata with order IDs; Stripe request IDs in logs.
- Restricted API keys from Key Vault; test keys outside production; webhook-driven state changes.

## Mistakes
Wrong:
```csharp
Amount = (long)(req.Total * 100)          // decimal → cents in the endpoint, from the client's total
```
Right: `Money` in minor units computed from the stored order, respecting the currency's exponent.

Wrong: marking the order paid in the `return_url` page.
Right: mark it paid in the `payment_intent.succeeded` webhook handler.

## Check yourself
1. Why must the server, not the client, set the payment amount?
2. When would you choose Checkout over the Payment Element?
3. What does an idempotency key protect against in `PaymentIntent` creation?

<details><summary>Answers</summary>

1. Anything from the browser can be changed by the user. The amount must come from the order and prices stored on the server.
2. When speed of delivery, conversion, and minimal PCI and UI work matter more than full control of the checkout design.
3. Duplicate intents (and duplicate charges) when the same create request is retried after a timeout or network error; Stripe returns the original result for the repeated key.
</details>

## Sources
- [Stripe — Accept a payment (Payment Element)](https://docs.stripe.com/payments/accept-a-payment?platform=web&ui=elements)
- [Stripe — Checkout](https://docs.stripe.com/payments/checkout)
- [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Stripe — Currencies and zero-decimal currencies](https://docs.stripe.com/currencies#zero-decimal)
- [Stripe — PaymentIntents lifecycle](https://docs.stripe.com/payments/paymentintents/lifecycle)
- [Stripe.net](https://github.com/stripe/stripe-dotnet)
