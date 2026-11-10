---
title: Transactional email with Azure Communication Services
tech: Azure Communication Services Email, Azure Event Grid, Hangfire
version: Azure.Communication.Email 1.x, Azure.Messaging.EventGrid 4.x
date: 2026-11-09
covers: [4, 5]
---
# Transactional email with Azure Communication Services
[← Overview](00-overview.md)

## Why it matters
- Order confirmations were sent from `no-reply@shop.example` with no SPF, DKIM, or DMARC. Gmail sent 40% of them to spam, and support calls doubled.
- A bug sent password-reset emails to 3,000 invalid addresses in an hour. The bounce rate crossed the provider's threshold and sending was throttled for everyone.
- Emails were sent inside the checkout request. When the provider was slow, checkout was slow.

## Concepts

### Azure Communication Services (ACS) Email
| Piece | Role |
|:--|:--|
| Email Communication Service | holds domains (Azure-managed or custom) |
| ⭐ custom domain | `mail.shop.example`, verified with DNS records; needed for production quotas and trust |
| Communication Services resource | the endpoint your app calls, linked to the email domain |
| `MailFrom` addresses | allowed sender addresses on the domain (`orders@mail.shop.example`) |
| `EmailClient` (Azure.Communication.Email) | send API; managed identity with `DefaultAzureCredential` |
| ⭐ quotas | custom domains start with low per-minute/per-hour limits; raise by support request once reputation is good |
| Azure-managed domain | `*.azurecomm.net`, testing only, very low limits |

### Authentication records
| Record | Proves | DNS |
|:--|:--|:--|
| ⭐ SPF | which servers may send for the domain | TXT `v=spf1 include:spf.protection.outlook.com -all` (ACS shows the exact value) |
| ⭐ DKIM | messages are signed by the domain | two CNAMEs (`selector1-azurecomm-prod-net._domainkey`, `selector2-...`) |
| ⭐ DMARC | policy when SPF/DKIM fail, and reports | TXT `_dmarc` `v=DMARC1; p=quarantine; rua=mailto:dmarc@shop.example` |
| domain verification | ownership | TXT from ACS |

Start DMARC at `p=none` with reports, then move to `quarantine` and `reject` once reports are clean. Gmail and Yahoo require SPF, DKIM, and DMARC for bulk senders, plus one-click unsubscribe for marketing.

### Deliverability
| Practice | Why |
|:--|:--|
| ⭐ separate transactional and marketing | marketing complaints shouldn't hurt order emails (different subdomain or provider) |
| ⭐ handle bounces | hard bounce → stop sending to that address (suppression) |
| ⭐ handle complaints | "marked as spam" → suppress; investigate content |
| suppression lists | ACS supports domain-level suppression lists; also keep your own `EmailSuppressions` table |
| validate addresses at signup | confirm email with a link; reject obvious typos |
| plain-text part, clear sender, real reply-to | spam filters and humans trust it more |
| warm up volume | raise volume gradually on a new domain |
| monitor | bounce rate (< 2%), complaint rate (< 0.1%), delivery latency |

Delivery status: ACS publishes `Microsoft.Communication.EmailDeliveryReportReceived` (Delivered, Bounced, Suppressed, Failed, ...) and engagement events to **Event Grid**. Subscribe a webhook endpoint or a Service Bus queue to them.

## Example
`src/Modules/Notifications/Shop.Notifications/Email/AcsEmailSender.cs`
```csharp
using Azure;
using Azure.Communication.Email;

internal sealed class AcsEmailSender(EmailClient client, IOptions<EmailOptions> options, NotificationsDb db) : IEmailSender
{
    public async Task<Result<string>> SendAsync(OutgoingEmail mail, CancellationToken ct)
    {
        if (await db.EmailSuppressions.AnyAsync(s => s.Address == mail.To, ct))
            return new Error("email.suppressed", "Recipient is suppressed.", ErrorType.Unprocessable);

        var message = new EmailMessage(
            senderAddress: options.Value.From,                                // orders@mail.shop.example
            content: new EmailContent(mail.Subject) { Html = mail.Html, PlainText = mail.Text },
            recipients: new EmailRecipients([new EmailAddress(mail.To)]));
        message.ReplyTo.Add(new EmailAddress(options.Value.ReplyTo));
        message.Headers.Add("X-Shop-Message-Id", mail.Id.ToString());     // correlate delivery events

        var operation = await client.SendAsync(WaitUntil.Started, message, ct);   // don't block on delivery
        return operation.Id;                                                      // store with the email record
    }
}
```
Registration with managed identity:
```csharp
services.AddSingleton(_ => new EmailClient(new Uri(config["Email:Endpoint"]!), new DefaultAzureCredential()));
```
Send from a Hangfire job (or an event handler), never inside the request:
```csharp
jobs.Enqueue<OrderEmails>(x => x.SendConfirmationAsync(orderId, CancellationToken.None));
```
`src/Modules/Notifications/Shop.Notifications/Email/DeliveryEventsEndpoint.cs` (Event Grid webhook, simplified)
```csharp
using Azure.Messaging.EventGrid;
using Azure.Messaging.EventGrid.SystemEvents;

app.MapPost("/webhooks/email-events", async (HttpRequest req, NotificationsDb db, CancellationToken ct) =>
{
    var events = EventGridEvent.ParseMany(await BinaryData.FromStreamAsync(req.Body, ct));
    foreach (var e in events)
    {
        if (e.TryGetSystemEventData(out var data))
        {
            if (data is SubscriptionValidationEventData v)                    // Event Grid handshake
                return Results.Ok(new SubscriptionValidationResponse { ValidationResponse = v.ValidationCode });
            if (data is AcsEmailDeliveryReportReceivedEventData report &&
                report.Status == AcsEmailDeliveryReportStatus.Bounced)
                db.EmailSuppressions.Add(new EmailSuppression(report.Recipient, "bounced", DateTimeOffset.UtcNow));
        }
    }
    await db.SaveChangesAsync(ct);
    return Results.Ok();
}).RequireAuthorization("EventGridWebhook");   // e.g. Entra ID-protected webhook delivery
```
Use the Event Grid schema you configured (Event Grid or CloudEvents). Protect the endpoint with Entra ID authentication on the subscription, or deliver to a Service Bus queue instead of a public webhook.

## Production patterns
- A custom subdomain for transactional mail with SPF, DKIM, and DMARC; quotas raised before launch; marketing on a separate domain.
- Emails sent asynchronously through jobs, with templates, a plain-text part, and an email record (status, operation ID).
- Bounces and complaints from Event Grid feed a suppression table checked before every send.
- Dashboards and alerts for bounce rate, complaint rate, failures, and queue age.

## Mistakes
Wrong: `await client.SendAsync(WaitUntil.Completed, message)` inside `POST /orders`.
Right: enqueue a job; send with `WaitUntil.Started`; track delivery through events.

Wrong: retrying sends to addresses that hard-bounced.
Right: suppress them and ask the user to fix their address.

## Check yourself
1. What do SPF, DKIM, and DMARC each do?
2. Why separate transactional and marketing email?
3. How does the app learn that an email bounced?

<details><summary>Answers</summary>

1. SPF lists servers allowed to send for the domain; DKIM signs messages so receivers can verify they came from the domain unchanged; DMARC tells receivers what to do when those checks fail and sends reports.
2. Marketing mail gets more complaints and unsubscribes. On a shared domain or reputation, that damage would push order confirmations and password resets into spam.
3. ACS publishes delivery report events to Event Grid; the app subscribes (webhook or Service Bus) and records bounces in its suppression list.
</details>

## Sources
- [ACS Email overview](https://learn.microsoft.com/azure/communication-services/concepts/email/email-overview)
- [Add a custom verified email domain](https://learn.microsoft.com/azure/communication-services/quickstarts/email/add-custom-verified-domains)
- [Send email with ACS (.NET)](https://learn.microsoft.com/azure/communication-services/quickstarts/email/send-email)
- [Handle email events (Event Grid)](https://learn.microsoft.com/azure/communication-services/quickstarts/email/handle-email-events)
- [ACS service limits (email)](https://learn.microsoft.com/azure/communication-services/concepts/service-limits)
- [Google — Email sender guidelines](https://support.google.com/a/answer/81126)
