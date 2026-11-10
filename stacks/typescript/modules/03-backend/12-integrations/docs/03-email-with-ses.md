---
title: Transactional email with AWS SES
tech: AWS SES, BullMQ, Node.js 26
version: Amazon SES (API v2, @aws-sdk/client-sesv2), BullMQ 5, Node.js 26 LTS
date: 2026-11-07
covers: [4, 5]
---
# Transactional email with AWS SES
[← Overview](00-overview.md)

## Why it matters
- Mail goes out from `noreply@shop.com` without DKIM or DMARC. Gmail files password resets as spam, and support tickets pile up.
- A marketing import adds 20,000 stale addresses. The bounce rate reaches 12%, and AWS pauses sending for the whole account, password resets included.
- Hard-bounced addresses are retried forever and complaints are ignored, so the domain's reputation keeps sinking.

## Concepts

### Setting up SES
| Step | Detail |
|:--|:--|
| Verify the domain identity | Easy DKIM: three CNAME records |
| Custom MAIL FROM domain | `mail.shop.com` with MX and SPF records, so SPF aligns with your domain |
| DMARC | start with `p=none` and reports, move to `quarantine`/`reject` when reports are clean |
| Leave the sandbox | the sandbox only sends to verified addresses, 200 messages per 24 h, 1 per second |
| Configuration sets | one per stream (transactional, marketing), each with event destinations |
| Sending quota | messages per second and per day; ask for increases before launches |
| Separate streams | transactional and marketing on different configuration sets and subdomains, so a campaign can't hurt password resets |

DNS records (example for `eu-central-1`):
| Record | Value |
|:--|:--|
| DKIM | 3 × CNAME `<token>._domainkey.shop.com` → `<token>.dkim.amazonses.com` |
| MAIL FROM MX | `mail.shop.com` MX `10 feedback-smtp.eu-central-1.amazonses.com` |
| MAIL FROM SPF | `mail.shop.com` TXT `"v=spf1 include:amazonses.com ~all"` |
| DMARC | `_dmarc.shop.com` TXT `"v=DMARC1; p=quarantine; rua=mailto:dmarc@shop.com"` |

### Deliverability
| Practice | Why |
|:--|:--|
| Send only mail people expect | complaints destroy reputation fastest |
| Handle bounces and complaints automatically | stop mailing hard bounces and complainers |
| Account-level suppression list | SES drops sends to addresses that bounced or complained |
| Keep bounces under 2%, complaints under 0.05% | SES reviews accounts at 5% bounces / 0.1% complaints and may pause at 10% / 0.5% |
| Gmail spam rate | below 0.1%, never 0.3% or more |
| HTML and text parts | spam filters and accessibility |
| `List-Unsubscribe` with one-click (RFC 8058) | required by Gmail and Yahoo for bulk/marketing mail |
| Consistent sender, no link shorteners | trust signals |

### SES events
| Event | Act |
|:--|:--|
| `Bounce` (Permanent) | mark the address undeliverable, stop sending, ask the user to update it |
| `Bounce` (Transient) | SES retries; track repeated soft bounces |
| `Complaint` | unsubscribe from everything non-essential |
| `Delivery`, `Send`, `Reject`, `DeliveryDelay`, `RenderingFailure` | metrics and support lookups |
| `Open`, `Click` | only if you need them (privacy) |

Destinations: EventBridge, SNS, CloudWatch, Firehose. A simple robust setup: configuration set → EventBridge → rule → SQS queue → a small consumer.

## Example
`src/notifications/mailer.port.ts` and `ses.adapter.ts`
```ts
export type Email = { to: string; subject: string; html: string; text: string; type: string };
export interface Mailer {
  send(email: Email): Promise<{ messageId: string }>;
}
```
```ts
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { Mailer } from './mailer.port.ts';

export function createSesMailer(cfg: { region: string; from: string; configurationSet: string }): Mailer {
  const ses = new SESv2Client({ region: cfg.region, maxAttempts: 3, requestHandler: { connectionTimeout: 2_000, requestTimeout: 5_000 } });
  return {
    async send(email) {
      const out = await ses.send(new SendEmailCommand({
        FromEmailAddress: cfg.from,                                   // "Shop <orders@shop.com>"
        Destination: { ToAddresses: [email.to] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: 'UTF-8' },
            Body: { Html: { Data: email.html, Charset: 'UTF-8' }, Text: { Data: email.text, Charset: 'UTF-8' } },
          },
        },
        ConfigurationSetName: cfg.configurationSet,                   // routes bounce and complaint events
        EmailTags: [{ Name: 'type', Value: email.type }],
      }));
      return { messageId: out.MessageId! };
    },
  };
}
```
`src/notifications/email.worker.ts` — sends from a job, claims each send once, respects the SES rate.
```ts
import { UnrecoverableError, Worker } from 'bullmq';
import { MessageRejected } from '@aws-sdk/client-sesv2';

new Worker<{ kind: 'order-confirmation'; orderId: string }>('email', async (job) => {
  const order = await ordersRepo.findById(db, job.data.orderId);
  if (!order) throw new UnrecoverableError(`order ${job.data.orderId} not found`);
  const user = await usersRepo.findById(db, order.userId);
  if (!user?.emailDeliverable) return { skipped: 'address undeliverable' };    // set by bounce/complaint handling

  if (!(await emailSends.claim(db, job.data.kind, order.id))) return { skipped: 'already sent' }; // unique (kind, entity_id)
  try {
    const { messageId } = await mailer.send(renderOrderConfirmation(order, user));
    await emailSends.complete(db, job.data.kind, order.id, messageId);
  } catch (err) {
    await emailSends.release(db, job.data.kind, order.id);
    if (err instanceof MessageRejected) throw new UnrecoverableError(err.message); // permanent
    throw err;                                                                      // throttling, network: retry with backoff
  }
}, { connection, concurrency: 10, limiter: { max: 14, duration: 1_000 } });          // below the account's sending rate
```
`src/notifications/ses-events.consumer.ts` — bounces and complaints from EventBridge via SQS.
```ts
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

const sqs = new SQSClient({ region: config.aws.region });

export async function consumeSesEvents(signal: AbortSignal) {
  while (!signal.aborted) {
    const { Messages = [] } = await sqs.send(
      new ReceiveMessageCommand({ QueueUrl: config.ses.eventsQueueUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: 20 }),
      { abortSignal: signal },
    );
    for (const message of Messages) {
      const event = JSON.parse(message.Body!).detail;                 // EventBridge envelope → SES event
      if (event.eventType === 'Bounce' && event.bounce.bounceType === 'Permanent') {
        for (const r of event.bounce.bouncedRecipients) await users.markEmailUndeliverable(r.emailAddress, 'bounce');
      } else if (event.eventType === 'Complaint') {
        for (const r of event.complaint.complainedRecipients) await users.unsubscribeNonEssential(r.emailAddress, 'complaint');
      }
      await sqs.send(new DeleteMessageCommand({ QueueUrl: config.ses.eventsQueueUrl, ReceiptHandle: message.ReceiptHandle! }));
    }
  }
}
```
Templates: render HTML and text in the app with plain functions and escaped values (also seen: React Email, MJML, SES stored templates). Never put user input into HTML without escaping.

## Production patterns
- **Authenticated domain**: Easy DKIM, custom MAIL FROM, DMARC with reports.
- **Separate streams** for transactional and marketing mail.
- **Emails sent from jobs**, claimed once per (kind, entity), rate-limited below the SES quota.
- **Bounce and complaint events processed automatically** and reflected on the user record; dashboards and alerts on both rates.
- **Staging uses the SES mailbox simulator** ([lesson 05](05-outgoing-webhooks-and-testing.md)); development doesn't send real mail.

## Mistakes
Wrong: sending inside the request.
```ts
await mailer.send(welcomeEmail(user)); // SES throttles or times out → signup fails
```
Right: enqueue an email job; return immediately.

Wrong: one configuration set and domain for everything. A bad campaign pauses password resets. Right: separate streams.

Wrong: ignoring bounce and complaint events. The account gets reviewed or paused. Right: event destination → queue → consumer that updates users.

Wrong: no DMARC, or jumping straight to `p=reject`. Either spam folders, or legitimate mail from other tools rejected. Right: `p=none` with reports first, then tighten.

## Check yourself
1. What do DKIM, SPF (with custom MAIL FROM), and DMARC each do?
2. What happens when the bounce rate climbs, and how do you keep it low?
3. Why send email from a job rather than the request?

<details>
<summary>Answers</summary>

1. DKIM signs each message so receivers can verify it came from your domain unmodified. SPF lists which servers may send for the envelope domain; a custom MAIL FROM makes that domain yours, so SPF aligns. DMARC tells receivers what to do when checks fail and sends you reports.
2. SES puts the account under review around 5% bounces and may pause all sending around 10%. Keep it low by sending only to confirmed addresses, processing bounce events automatically, using the suppression list, and never importing old lists.
3. SES calls can be slow, throttled, or fail; a job retries with backoff without blocking the user, smooths bursts below the sending rate, and can dedupe so a retry doesn't send twice.
</details>

## Sources
- [Amazon SES — Easy DKIM](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim-easy.html)
- [Amazon SES — Custom MAIL FROM domain](https://docs.aws.amazon.com/ses/latest/dg/mail-from.html)
- [Amazon SES — Request production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- [Amazon SES — Event publishing](https://docs.aws.amazon.com/ses/latest/dg/monitor-using-event-publishing.html)
- [Amazon SES — Account-level suppression list](https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html)
- [Google — Email sender guidelines](https://support.google.com/a/answer/81126)
