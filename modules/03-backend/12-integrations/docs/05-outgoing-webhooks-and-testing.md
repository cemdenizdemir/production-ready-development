---
title: Outgoing webhooks and testing integrations
tech: BullMQ, Node.js 26, Stripe, AWS SES, Vitest
version: BullMQ 5, Node.js 26 LTS, stripe-node + Stripe CLI, Amazon SES mailbox simulator, Vitest 4, supertest
date: 2026-11-07
covers: [9, 11]
---
# Outgoing webhooks and testing integrations
[← Overview](00-overview.md)

## Why it matters
- Customer webhooks are sent inside the request. A customer's slow endpoint makes your API slow, and a down endpoint loses the event forever.
- A customer registers `http://169.254.169.254/latest/meta-data/` as their webhook URL. Your worker fetches it and hands them your cloud credentials (SSRF).
- Payment tests hit Stripe's test API on every CI run: slow, flaky, and the 3DS and decline paths were never tested.

## Concepts

### Sending webhooks to customers
| Practice | Detail |
|:--|:--|
| Deliver from jobs | one BullMQ job per (event, endpoint) |
| Sign every request | HMAC-SHA256 over `id.timestamp.body` with a per-endpoint secret; Standard Webhooks headers `webhook-id`, `webhook-timestamp`, `webhook-signature` |
| Retries | exponential backoff with jitter over about a day; 2xx = delivered; 410 = disable the endpoint |
| Timeouts | 5–10 s per attempt; never follow redirects |
| At-least-once | receivers dedupe on `webhook-id`; ordering isn't guaranteed |
| Delivery log | every attempt: status, latency, short response snippet; customers can view and replay |
| Auto-disable | after repeated failures for days; email the customer |
| SSRF protection | HTTPS only; block private, loopback, link-local, and metadata addresses; no redirects; fixed egress IPs customers can allowlist |
| Secret rotation | two active secrets during rotation (several signatures in one header) |
| Payload | `{ id, type, created, data }`, versioned, small; IDs over full objects |

DNS can change between your check and the request (DNS rebinding). For strong protection, connect to the address you checked, or send all webhook traffic through an egress proxy that enforces the rules (also seen: Smokescreen).

### Testing integrations
| Level | Tool | Covers |
|:--|:--|:--|
| Use cases | fake adapters ([11-architecture lesson 02](../../11-architecture/docs/02-di-ports-adapters.md)) | business logic, no network |
| HTTP adapters | MSW | request shapes, error translation, timeouts |
| AWS adapters | `aws-sdk-client-mock` (also seen) | command inputs, error mapping |
| Webhook routes | `stripe.webhooks.generateTestHeaderString()` + supertest | signature checks, dedupe |
| Stripe flows | Stripe CLI (`listen`, `trigger`), test cards, test clocks for subscriptions | real flows incl. 3DS and declines |
| SES | mailbox simulator addresses | bounce and complaint handling end to end |
| Local email | log or catch locally (also seen: Mailpit) | no real sends from laptops |
| S3 locally | a dev bucket (also seen: MinIO, LocalStack) | presigned flows |
| Provider changes | contract checks on recorded responses (also seen: Pact) | breaking API changes |
| Staging end-to-end | Playwright through checkout with test cards | the whole path |

SES mailbox simulator:
| Address | Simulates |
|:--|:--|
| `success@simulator.amazonses.com` | delivery |
| `bounce@simulator.amazonses.com` | hard bounce |
| `complaint@simulator.amazonses.com` | complaint |
| `ooto@simulator.amazonses.com` | out-of-office reply |
| `suppressionlist@simulator.amazonses.com` | address on the suppression list |

## Example
`src/webhooks/sign.ts` — Standard Webhooks signature.
```ts
import { createHmac } from 'node:crypto';

export function signWebhook(secret: string, id: string, timestamp: number, body: string) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { 'webhook-id': id, 'webhook-timestamp': String(timestamp), 'webhook-signature': `v1,${signature}` };
}
```
`src/webhooks/deliver.worker.ts` — SSRF checks, signing, delivery log, custom backoff.
```ts
import { lookup } from 'node:dns/promises';
import { BlockList } from 'node:net';
import { UnrecoverableError, Worker } from 'bullmq';
import { signWebhook } from './sign.ts';

const privateRanges = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16],
] as const) privateRanges.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [['::1', 128], ['fc00::', 7], ['fe80::', 10], ['::ffff:0:0', 96]] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv6');
}

async function assertPublicHttps(url: URL) {
  if (url.protocol !== 'https:') throw new UnrecoverableError('webhook URLs must use https');
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.some((a) => privateRanges.check(a.address, a.family === 6 ? 'ipv6' : 'ipv4'))) {
    throw new UnrecoverableError('webhook URL resolves to a private address');
  }
}

new Worker<{ deliveryId: string }>('webhook-deliveries', async (job) => {
  const delivery = await deliveries.get(job.data.deliveryId);          // endpoint, payload, secret
  if (!delivery.endpoint.enabled) return { skipped: 'endpoint disabled' };
  const url = new URL(delivery.endpoint.url);
  await assertPublicHttps(url);

  const body = JSON.stringify(delivery.payload);
  const headers = { 'content-type': 'application/json', ...signWebhook(delivery.endpoint.secret, delivery.eventId, Math.floor(Date.now() / 1000), body) };
  const started = performance.now();
  let status = 0;
  try {
    const res = await fetch(url, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    status = res.status;
    await res.body?.cancel();                                          // the response body isn't needed
  } finally {
    await deliveries.recordAttempt(delivery.id, { attempt: job.attemptsMade + 1, status, ms: Math.round(performance.now() - started) });
  }
  if (status === 410) {
    await deliveries.disableEndpoint(delivery.endpoint.id);
    throw new UnrecoverableError('endpoint is gone (410)');
  }
  if (status < 200 || status >= 300) throw new Error(`endpoint answered ${status}`); // retried with backoff
}, {
  connection,
  concurrency: 50,
  settings: {
    // ~1 min, 2, 4, 8 … capped at 6 h, plus jitter: 12 attempts span about a day
    backoffStrategy: (attemptsMade: number) => Math.min(6 * 3_600_000, 30_000 * 2 ** attemptsMade) + Math.random() * 10_000,
  },
});
// enqueue: deliveriesQueue.add('deliver', { deliveryId }, { jobId: `delivery-${deliveryId}`, attempts: 12, backoff: { type: 'custom' } })
```
`src/payments/stripe.webhook.test.ts` — the webhook route with real signatures.
```ts
import request from 'supertest';
import Stripe from 'stripe';
import { expect, test } from 'vitest';

const stripe = new Stripe('sk_test_dummy');
const secret = 'whsec_test_secret';

test('rejects bad signatures and queues valid events once', async () => {
  const { app, queues } = await createTestApp({ stripeWebhookSecret: secret });
  const payload = JSON.stringify({ id: 'evt_test_1', object: 'event', type: 'checkout.session.completed', data: { object: {} } });

  await request(app).post('/webhooks/stripe').set('content-type', 'application/json').set('stripe-signature', 't=1,v1=bad').send(payload).expect(400);

  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  await request(app).post('/webhooks/stripe').set('content-type', 'application/json').set('stripe-signature', header).send(payload).expect(200);
  await request(app).post('/webhooks/stripe').set('content-type', 'application/json').set('stripe-signature', header).send(payload).expect(200);

  expect(await queues.stripeEvents.getJobCounts('waiting')).toMatchObject({ waiting: 1 }); // the duplicate was deduped
});
```
Stripe CLI against your local API:
```bash
stripe login
stripe listen --forward-to localhost:3000/webhooks/stripe   # prints a whsec_… secret for local use
stripe trigger checkout.session.completed
stripe trigger payment_intent.payment_failed
```

## Production patterns
- **Outgoing webhooks from jobs**, signed, retried with backoff for about a day, logged per attempt, replayable.
- **SSRF defenses on every customer-supplied URL**: HTTPS only, private ranges blocked, no redirects, ideally an egress proxy.
- **Fakes for use cases, MSW and mocks for adapters, sandboxes for flows**, end-to-end tests in staging.
- **Stripe CLI and test cards** cover 3DS, declines, and webhooks before production does.
- **SES mailbox simulator in staging**, so bounce and complaint handling is tested end to end.

## Mistakes
Wrong: delivering webhooks in the request.
```ts
await fetch(customer.webhookUrl, { method: 'POST', body }); // slow endpoint = slow API; failure = lost event
```
Right: enqueue one delivery job per endpoint.

Wrong: fetching customer URLs without checks. Internal services and the cloud metadata endpoint are one URL away. Right: HTTPS only, block private ranges, no redirects, egress proxy.

Wrong: unsigned webhooks. Receivers can't tell yours from forged ones. Right: HMAC signatures with a timestamp, per-endpoint secrets.

Wrong: CI tests calling real provider APIs for every case. Slow, flaky, rate-limited. Right: fakes and MSW in CI; sandbox flows in a few targeted tests and in staging.

## Check yourself
1. What must a receiver do to trust and dedupe your webhooks?
2. Name three SSRF defenses for customer webhook URLs.
3. Which integration behaviors need the providers' sandboxes rather than fakes?

<details>
<summary>Answers</summary>

1. Recompute the HMAC over `id.timestamp.body` with their secret and compare it in constant time, reject old timestamps (replays), and store processed `webhook-id`s so retries and duplicates are ignored.
2. Allow only HTTPS; resolve the hostname and reject private, loopback, link-local, and metadata addresses; don't follow redirects; route webhook traffic through an egress proxy with fixed IPs that enforces the same rules.
3. Behavior only the real provider has: 3DS challenges and real decline codes (Stripe test cards), webhook payloads and signatures (Stripe CLI), subscription timing (test clocks), and bounce and complaint events (SES mailbox simulator).
</details>

## Sources
- [Standard Webhooks specification](https://www.standardwebhooks.com/)
- [OWASP — SSRF prevention cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [BullMQ — Custom backoff strategies](https://docs.bullmq.io/guide/retrying-failing-jobs#custom-back-off-strategies)
- [Stripe CLI](https://docs.stripe.com/stripe-cli)
- [Stripe — Test clocks](https://docs.stripe.com/billing/testing/test-clocks)
- [Amazon SES — Mailbox simulator](https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html)
