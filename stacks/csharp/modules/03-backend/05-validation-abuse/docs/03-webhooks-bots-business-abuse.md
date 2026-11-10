---
title: Webhooks, bots, business-logic abuse, and monitoring
tech: Stripe.net, ASP.NET Core 10, Azure Front Door WAF, OpenTelemetry metrics
version: Stripe.net 4x.x, ASP.NET Core 10
date: 2026-11-09
covers: [8, 10, 11, 12]
---
# Webhooks, bots, business-logic abuse, and monitoring
[← Overview](00-overview.md)

## Why it matters
- The Stripe webhook endpoint doesn't verify signatures; anyone can POST a fake `payment_intent.succeeded` and get orders shipped for free.
- Fraudsters use the checkout to test 3,000 stolen cards in an hour; Stripe fees and a high decline rate put the account under review.
- A coupon meant for "one per customer" is applied 40 times by sending parallel requests that all pass the check before any redemption is saved.

## Concepts

### Verifying incoming webhooks
| Step | Why |
|:--|:--|
| ⭐ read the **raw body** before any JSON binding | the signature is computed over exact bytes |
| ⭐ verify the signature with the endpoint secret | authenticity |
| check the timestamp (tolerance ~5 min) | replay protection |
| ⭐ process idempotently by event ID | providers retry and may deliver duplicates |
| respond 2xx quickly, process in a background job | providers time out and retry |
| handle out-of-order events | use the object's current state, not the event sequence |
| don't trust event payloads blindly | for critical actions, fetch the object from the provider's API |

Stripe.net: `EventUtility.ConstructEvent(json, signatureHeader, secret)` verifies signature and timestamp.

### Bots and automated abuse
| Threat | Signals | Controls |
|:--|:--|:--|
| credential stuffing | many accounts per IP, high failure rate | rate limits (lesson 02), MFA, breached-password checks, lockouts |
| ⭐ card testing | many small payments, many cards per customer/IP, high decline rate | rate limit payment attempts per customer/IP/card fingerprint; Stripe Radar rules; require sign-in or CAPTCHA after failures |
| SMS pumping | OTP requests to premium-rate ranges | per-number and per-country limits, country allowlist, prefer email/passkeys |
| signup spam | bursts of signups, disposable emails | email verification, CAPTCHA (Turnstile/hCaptcha/reCAPTCHA) on suspicious traffic, honeypot fields |
| scraping | high request rates to catalog | edge rate limits, Front Door bot protection managed rules, caching |
| inventory hoarding | carts holding stock | reservation timeouts, per-customer quantity limits |

CAPTCHAs cost conversion; show them only when signals say so.

### Business-logic abuse
| Abuse | Defense |
|:--|:--|
| ⭐ race conditions (coupon redeemed twice, gift card double spend) | unique constraints (`UNIQUE (CouponId, CustomerId)`), conditional updates, transactions (03-databases lesson 03) |
| coupon stacking | server-side rules: one code per order, combinability flags, redemption limits |
| negative or huge quantities | validation + domain guards + `CHECK` constraints |
| price tampering | never accept prices/totals from the client; the API computes |
| refund abuse | limits per agent (04-auth lesson 05), audit trails, velocity checks |
| enumeration (gift card codes, order numbers) | long random codes, rate limits on lookups, no oracle errors |
| account sharing / reseller abuse | per-customer limits on promos |

Threat-model business flows like security flows: "What if this is done twice, in parallel, with negative numbers, by a bot?"

### Monitoring abuse
| Signal | Metric |
|:--|:--|
| rate limit rejections | counter per policy/route |
| auth failures | failed sign-ins per minute, per IP, per account |
| payment declines | decline rate per hour, card-testing patterns |
| 4xx spikes | 400/401/403/404/429 per route |
| business anomalies | coupon redemptions per hour, refunds per agent |

Playbooks: what to block (IP ranges/ASNs at the WAF, countries for OTP), who decides, how to roll back. Blocklists live at the edge (Front Door custom rules) with expiry.

## Example
`src/Shop.Api/Webhooks/StripeWebhook.cs`
```csharp
using Stripe;

public static class StripeWebhook
{
    public static void MapStripeWebhook(this IEndpointRouteBuilder app) =>
        app.MapPost("/webhooks/stripe", async (HttpRequest req, IOptions<StripeOptions> opt, ShopDb db,
            IBackgroundJobClient jobs, ILogger<Program> log, CancellationToken ct) =>
        {
            using var reader = new StreamReader(req.Body);
            var json = await reader.ReadToEndAsync(ct);                               // raw body, not model-bound

            Event evt;
            try
            {
                evt = EventUtility.ConstructEvent(json, req.Headers["Stripe-Signature"], opt.Value.WebhookSecret);  // signature + timestamp
            }
            catch (StripeException ex)
            {
                log.LogWarning(ex, "Invalid Stripe webhook signature");
                return Results.BadRequest();
            }

            // idempotency: unique index on ProcessedWebhooks.EventId
            db.ProcessedWebhooks.Add(new ProcessedWebhook(evt.Id, evt.Type, DateTimeOffset.UtcNow));
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { return Results.Ok(); }                      // already received

            jobs.Enqueue<StripeEventProcessor>(p => p.ProcessAsync(evt.Id, CancellationToken.None));   // 03-backend/07
            return Results.Ok();
        })
        .AllowAnonymous()
        .DisableRateLimiting()
        .ExcludeFromDescription();
}
```
Race-safe coupon redemption:
```csharp
// table CouponRedemptions with UNIQUE (CouponId, CustomerId); Coupons.Remaining with CHECK (Remaining >= 0)
var updated = await db.Coupons
    .Where(c => c.Id == couponId && c.Remaining > 0 && c.ExpiresAt > now)
    .ExecuteUpdateAsync(s => s.SetProperty(c => c.Remaining, c => c.Remaining - 1), ct);
if (updated == 0) throw new CouponUnavailableException();
db.CouponRedemptions.Add(new CouponRedemption(couponId, customerId, orderId));
await db.SaveChangesAsync(ct);                     // second parallel redemption hits the unique index → rollback
```
Payment attempt limiting (card testing):
```csharp
var key = $"pay:{customerId}:{ip}";
var (allowed, retry) = await limiter.HitAsync(key, limit: 5, window: TimeSpan.FromHours(1));
if (!allowed) return TypedResults.Problem(statusCode: 429, title: "Too many payment attempts. Try again later.");
```

## Production patterns
- Webhook endpoints: raw body, signature check, event-ID idempotency, fast 2xx, background processing, excluded from public docs.
- Business invariants enforced in the database (unique indexes, conditional updates), not just in C# checks.
- Card-testing defenses: per-customer/IP payment limits, Stripe Radar, step-up challenges after declines.
- Abuse dashboards and playbooks owned by the team; edge blocklists with expiry.

## Mistakes
Wrong: model-binding the webhook body.
```csharp
app.MapPost("/webhooks/stripe", (StripeEventDto body) => …)   // re-serialized JSON ≠ signed bytes; no verification
```
Right: read the raw body, verify, then deserialize.

Wrong: check-then-insert in C# for one-per-customer coupons.
Right: unique constraint + conditional update in one transaction.

## Check yourself
1. Why must a webhook be verified against the raw body?
2. What makes webhook processing idempotent?
3. Why do race conditions bypass "has this customer used the coupon?" checks?

<details><summary>Answers</summary>

1. The signature is computed over the exact bytes sent; parsing and re-serializing changes whitespace and ordering, so verification fails or is skipped.
2. Recording each provider event ID once (unique constraint) and skipping events already recorded.
3. Parallel requests all run the check before any of them saves a redemption, so all pass; only a database constraint or atomic update serializes them.
</details>

## Sources
- [Stripe — Verify webhook signatures](https://docs.stripe.com/webhooks#verify-events)
- [Stripe — Card testing](https://docs.stripe.com/disputes/prevention/card-testing)
- [OWASP — Automated Threats (OAT)](https://owasp.org/www-project-automated-threats-to-web-applications/)
- [OWASP — Business Logic Security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [Azure Front Door — Bot protection](https://learn.microsoft.com/azure/web-application-firewall/afds/afds-overview#bot-protection-rule-set)
