---
title: Bots, webhooks, business abuse, and monitoring
tech: Express 5, Redis 8, Zod 4, PostgreSQL 18
version: Express 5.2, Redis 8, Stripe Node SDK
date: 2026-11-07
covers: [7, 9, 10, 11]
---
# Bots, webhooks, business abuse, and monitoring
[← Overview](00-overview.md)

## Why it matters
- Card testers use your checkout to try thousands of stolen cards at €1; your Stripe account gets flagged for fraud.
- An SMS verification endpoint is abused for "SMS pumping": bots request codes to premium-rate numbers, and the SMS bill hits five figures in a weekend.
- A gift card is redeemed twice by firing two requests at the same millisecond; the balance check passed for both.

## Concepts

### Common automated abuse
| Abuse | Signals | Defenses |
|:--|:--|:--|
| Credential stuffing | many accounts, few tries each, high failure rate | per-account limits, breached passwords, MFA ([04-auth](../../04-auth/README.md)) |
| Card testing | many small payments, high decline rate | rate limits on payment attempts per account/IP/card fingerprint, CAPTCHA, Stripe Radar rules |
| SMS / email pumping | OTP sends to unusual countries, number ranges | per-number and per-IP limits, country allowlists, CAPTCHA before sending |
| Signup spam | bursts of signups, disposable domains | email verification, rate limits, CAPTCHA, delayed privileges |
| Scraping | high-volume reads, sequential IDs | rate limits, auth for data, random IDs, pagination caps |
| Promo/referral abuse | many new accounts per device/payment method | limits per payment method, delayed rewards |

CAPTCHA-like challenges (also seen: Cloudflare Turnstile, hCaptcha, reCAPTCHA) add friction only when risk signals appear. Edge bot management (AWS WAF Bot Control) filters known bots before they reach you.

### Verifying incoming webhooks
| Step | Why |
|:--|:--|
| Use the **raw body** for signature checks | JSON re-serialization changes bytes |
| Verify HMAC signature with `timingSafeEqual` | authenticity |
| Check timestamp tolerance (~5 min) | replay protection |
| Dedupe by event ID (unique constraint) | providers retry; handle each event once |
| Respond 2xx quickly, process in a queue | providers time out and retry slow endpoints |
| Fetch the current state from the provider for critical events | events can be out of order |
| Rotate secrets; support two during rotation | |

### Business-logic abuse
| Abuse | Fix |
|:--|:--|
| Client-sent prices or totals | compute on the server from your data |
| Negative or zero quantities | schema `min(1)`; DB `CHECK (quantity > 0)` |
| Huge numbers / overflow | schema `max()`; integer types |
| Coupon stacking | rules on the server: one coupon per order, per-user usage limits (unique constraint) |
| Double redemption (race) | atomic updates or unique redemption rows, not check-then-act |
| Skipping workflow steps | server-side state machine: allowed transitions only |
| Free-tier resource farming | quotas per account, verification before high-value features |

OWASP calls this "Unrestricted Access to Sensitive Business Flows" (API6:2023): ask, for each flow, "what happens if a bot does this 10,000 times?"

### Monitoring abuse
| Metric | Alert on |
|:--|:--|
| 429s per route | sudden spikes (attack) or steady high levels (limits too tight) |
| Login failure rate | stuffing |
| Signups per hour, % unverified | spam waves |
| Payment decline rate | card testing |
| OTP sends per country/number range | pumping |
| Webhook signature failures | probing |

Response playbooks: tighten limits, enable challenges, block IP ranges/ASNs temporarily (with expiry), disable a flow with a kill switch, contact the provider; review afterwards.

## Example
Stripe webhook route with raw body, verification, and dedupe:
```ts
import express from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(config.stripe.secretKey);

app.post('/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature') ?? '', config.stripe.webhookSecret); // checks signature + timestamp
  } catch {
    metrics.webhookSignatureFailures.add(1);
    return res.status(400).json({ title: 'Invalid signature' });
  }

  // Enqueue first: if this throws, Stripe gets a 500 and retries. jobId = event.id dedupes redeliveries.
  await webhookQueue.add(event.type, { eventId: event.id }, { jobId: event.id });
  res.status(200).json({ received: true });
});
// register this route BEFORE app.use(express.json()) so the body stays raw
```
The worker records the event in `processed_webhooks` (unique `provider, event_id`) **in the same transaction** as the business change, and skips events it has already recorded. Don't mark an event as processed in the route before it's safely queued: if the enqueue fails, Stripe's retry would be skipped as a "duplicate" and the event lost ([12-integrations lesson 02](../../12-integrations/docs/02-stripe-webhooks-reconciliation.md)).
Generic HMAC verification for other providers:
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyHmac(rawBody: Buffer, timestamp: string, signatureHex: string, secret: string) {
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;                     // replay window
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest();
  const given = Buffer.from(signatureHex, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
```
Race-safe gift card redemption:
```ts
export async function redeemGiftCard(accountId: string, code: string, orderId: string, amountCents: number) {
  return withTransaction(async (tx) => {
    const { rows: [card] } = await tx.query(
      `UPDATE gift_cards SET balance_cents = balance_cents - $3
       WHERE code_hash = $1 AND account_id = $2 AND balance_cents >= $3 AND expires_at > now()
       RETURNING id, balance_cents`,
      [sha256(code), accountId, amountCents]);                              // atomic check + decrement
    if (!card) throw new ConflictError('Gift card is invalid, expired, or has insufficient balance');
    await tx.query('INSERT INTO gift_card_redemptions (gift_card_id, order_id, amount_cents) VALUES ($1, $2, $3)',
      [card.id, orderId, amountCents]);                                     // UNIQUE (gift_card_id, order_id)
    return card.balance_cents;
  });
}
```
OTP send limits (anti-pumping):
```ts
export async function canSendOtp(phoneE164: string, ip: string) {
  const country = phoneE164.slice(0, 3);   // simplified: country codes are 1–3 digits; use a phone library in real code
  if (!ALLOWED_PREFIXES.has(country)) return false;                         // only countries you serve
  const [perNumber, perIp] = await Promise.all([
    redis.incr(`otp:num:${phoneE164}`), redis.incr(`otp:ip:${ip}`),
  ]);
  await Promise.all([redis.expire(`otp:num:${phoneE164}`, 3600), redis.expire(`otp:ip:${ip}`, 3600)]);
  return perNumber <= 3 && perIp <= 10;
}
```

## Production patterns
- **Threat-model each sensitive flow** (signup, OTP, payment, coupons, exports) for automation at scale.
- **Risk-based friction**: invisible by default, challenges when signals appear, hard limits always.
- **Webhooks: raw body, signature + timestamp, dedupe table, async processing.**
- **Business rules atomic and server-side**, backed by constraints.
- **Abuse metrics with alerts and written playbooks**; kill switches for expensive flows.

## Mistakes
Wrong: verifying signatures on parsed JSON.
```ts
app.use(express.json());
app.post('/webhooks/stripe', (req) => stripe.webhooks.constructEvent(JSON.stringify(req.body), …)); // bytes differ → fails or is bypassed
```
Right: `express.raw()` on that route, mounted before the JSON parser.

Wrong: processing webhooks synchronously with slow side effects; the provider times out, retries, and you process duplicates. Right: dedupe, enqueue, respond 200.

Wrong: check-then-act for balances.
```ts
if (card.balance >= amount) await setBalance(card.id, card.balance - amount); // two requests, both pass
```
Right: one conditional `UPDATE … WHERE balance >= $amount RETURNING`.

Wrong: unlimited OTP sends to any country. Right: allowlist countries, per-number and per-IP limits, challenges.

## Check yourself
1. Why must webhook signature checks use the raw request body?
2. What makes "redeem gift card" race-safe?
3. Which metrics would reveal card testing on your checkout?

<details>
<summary>Answers</summary>

1. The signature covers the exact bytes the provider sent; parsing and re-serializing JSON can change whitespace, key order, or number formatting, so the computed HMAC wouldn't match (or a verifier on parsed data could be tricked).
2. The balance check and decrement happen in one atomic conditional `UPDATE`, plus a unique constraint on redemptions per order, so concurrent requests can't both succeed.
3. A spike in payment attempts and declines (especially many small amounts), many different cards per account/IP/session, and Stripe Radar risk signals.
</details>

## Sources
- [OWASP API6:2023 — Unrestricted Access to Sensitive Business Flows](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/)
- [OWASP — Automated Threats to Web Applications](https://owasp.org/www-project-automated-threats-to-web-applications/)
- [Stripe — Verify webhook signatures](https://docs.stripe.com/webhooks#verify-events)
- [Stripe — Card testing](https://docs.stripe.com/disputes/prevention/card-testing)
- [Twilio — Preventing SMS pumping fraud](https://www.twilio.com/docs/glossary/what-is-sms-pumping-fraud)
