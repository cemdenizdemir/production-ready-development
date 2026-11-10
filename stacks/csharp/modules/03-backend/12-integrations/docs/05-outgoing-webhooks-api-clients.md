---
title: Outgoing webhooks and third-party API clients
tech: Hangfire, IHttpClientFactory, Microsoft.Extensions.Http.Resilience, System.Security.Cryptography
version: Hangfire 1.8.x, .NET 10
date: 2026-11-09
covers: [9, 10]
---
# Outgoing webhooks and third-party API clients
[← Overview](00-overview.md)

## Why it matters
- The shop sent order webhooks to partners without signatures. A partner's endpoint accepted forged "order shipped" events from anyone who knew the URL.
- A partner registered `http://169.254.169.254/metadata/...` as their webhook URL. The shop's server fetched cloud metadata and returned it in the delivery log (SSRF).
- A supplier API allowed 100 requests per minute. A nightly sync made 6,000 calls in a burst, got blocked for the day, and stock levels went stale.

## Concepts

### Sending webhooks to customers
| Practice | How |
|:--|:--|
| ⭐ sign every delivery | HMAC-SHA256 over `id.timestamp.body` with a per-endpoint secret; send `webhook-id`, `webhook-timestamp`, `webhook-signature` (Standard Webhooks) |
| timestamps | receivers reject old deliveries (replay protection) |
| ⭐ durable retries | Hangfire job per delivery with backoff (minutes → hours, up to ~3 days); disable endpoints that keep failing and notify the owner |
| ⭐ delivery log | each attempt: status code, latency, response snippet (truncated, no secrets) visible to the customer |
| at-least-once | include a stable event ID so receivers can dedupe |
| small payloads | event type, ID, and key fields; receivers fetch details from your API |
| ordering | not guaranteed; include `occurred_at` and a version |
| secret rotation | two active secrets during rotation; signatures for both |
| ⭐ SSRF protection | HTTPS only; resolve DNS and reject private, loopback, link-local, and metadata IP ranges, checked at connect time; no redirects; short timeouts; response size limit |

### Third-party API clients
| Topic | Practice |
|:--|:--|
| ⭐ rate limits | read limits from docs and headers (`Retry-After`, `X-RateLimit-Remaining`); throttle yourself with a shared limiter; back off on 429 |
| ⭐ pagination | cursor-based (`starting_after`, `next` links) over offset; process page by page; resume from the last cursor |
| ⭐ SDK vs raw HTTP | official SDK when it's maintained and covers what you need (Stripe.net, Azure SDKs); typed `HttpClient` for small APIs or unmaintained SDKs |
| generated clients | Kiota or NSwag from OpenAPI (also seen: Refit for hand-declared interfaces) |
| timeouts and resilience | standard resilience handler per client (08-reliability) |
| versioning | pin the partner's API version; watch deprecation headers and changelogs |
| errors | map partner errors to your `Error` codes in the adapter; log partner request IDs |
| data | store partner IDs with unique constraints; don't depend on partner data shape outside the adapter |

## Example
`src/Modules/Integrations/Shop.Integrations/Webhooks/WebhookSigner.cs`
```csharp
using System.Security.Cryptography;
using System.Text;

public static class WebhookSigner
{
    public static string Sign(string id, long timestamp, string body, byte[] secret)
    {
        var payload = Encoding.UTF8.GetBytes($"{id}.{timestamp}.{body}");
        var mac = HMACSHA256.HashData(secret, payload);
        return $"v1,{Convert.ToBase64String(mac)}";
    }
}
```
`src/Modules/Integrations/Shop.Integrations/Webhooks/WebhookDeliveryJob.cs`
```csharp
using System.Text;
using Hangfire;

internal sealed class WebhookDeliveryJob(IntegrationsDb db, IHttpClientFactory http, TimeProvider time, ILogger<WebhookDeliveryJob> log)
{
    [AutomaticRetry(Attempts = 12)]                                        // backoff grows to hours
    public async Task DeliverAsync(long deliveryId, CancellationToken ct)
    {
        var d = await db.Deliveries.Include(x => x.Endpoint).SingleAsync(x => x.Id == deliveryId, ct);
        if (d.SucceededAt is not null || d.Endpoint.Disabled) return;

        var ts = time.GetUtcNow().ToUnixTimeSeconds();
        using var req = new HttpRequestMessage(HttpMethod.Post, d.Endpoint.Url)
        {
            Content = new StringContent(d.Payload, Encoding.UTF8, "application/json"),
        };
        req.Headers.Add("webhook-id", d.EventId);
        req.Headers.Add("webhook-timestamp", ts.ToString());
        req.Headers.Add("webhook-signature", WebhookSigner.Sign(d.EventId, ts, d.Payload, d.Endpoint.Secret));

        var started = time.GetTimestamp();
        using var resp = await http.CreateClient("webhooks").SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        d.RecordAttempt((int)resp.StatusCode, time.GetElapsedTime(started), time.GetUtcNow());
        await db.SaveChangesAsync(ct);

        if (!resp.IsSuccessStatusCode)
            throw new WebhookDeliveryException(d.Id, (int)resp.StatusCode);   // Hangfire retries with backoff
    }
}
```
The endpoint secret is stored encrypted (Data Protection or Key Vault), never in plain text.

`src/Modules/Integrations/Shop.Integrations/IntegrationsModule.cs` (SSRF-safe client)
```csharp
using System.Net;
using System.Net.Sockets;

services.AddHttpClient("webhooks", c => c.Timeout = TimeSpan.FromSeconds(10))
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
    {
        AllowAutoRedirect = false,
        ConnectCallback = async (ctx, ct) =>
        {
            var addresses = await Dns.GetHostAddressesAsync(ctx.DnsEndPoint.Host, ct);
            if (addresses.Length == 0 || addresses.Any(IpRules.IsPrivateOrReserved))
                throw new HttpRequestException("Webhook target resolves to a blocked address.");
            var ip = addresses[0];
            var socket = new Socket(ip.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try { await socket.ConnectAsync(new IPEndPoint(ip, ctx.DnsEndPoint.Port), ct); return new NetworkStream(socket, ownsSocket: true); }
            catch { socket.Dispose(); throw; }
        },
    });
```
Checking the IP inside `ConnectCallback` (not just when the URL is saved) blocks DNS rebinding, where a hostname resolves to a public IP at registration and a private one later. `IpRules.IsPrivateOrReserved` covers 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10, `::1`, `fc00::/7`, `fe80::/10`, and IPv4-mapped IPv6 forms of these.

Paging through a supplier API under its rate limit:
```csharp
string? cursor = state.LastCursor;
do
{
    using var lease = await limiter.AcquireAsync(1, ct);                 // shared TokenBucketRateLimiter: 90/min
    var page = await supplier.GetStockAsync(cursor, pageSize: 200, ct);
    await stock.UpsertAsync(page.Items, ct);
    cursor = page.NextCursor;
    state.LastCursor = cursor; await db.SaveChangesAsync(ct);            // resume here after a crash
} while (cursor is not null);
```

## Production patterns
- Outgoing webhooks: signed, timestamped, retried by durable jobs, logged per attempt, delivered through an SSRF-safe client with no redirects.
- Endpoints that fail for days are disabled automatically, and their owners are notified; customers can replay deliveries from the log.
- Each third-party API has one adapter with its own resilience settings, a shared rate limiter below the partner's limit, and resumable pagination.
- SDKs are pinned and upgraded deliberately; partner deprecation notices are tracked.

## Mistakes
Wrong:
```csharp
await http.PostAsync(customerUrl, json);     // any URL, redirects followed, no signature, no retry, no log
```
Right: a Hangfire delivery job with signing, logging, and the SSRF-safe `webhooks` client.

Wrong: `for (page = 1; ; page++)` offset pagination over data that changes during the sync.
Right: cursor pagination, saving the cursor after each page.

## Check yourself
1. What do receivers need to verify your webhooks?
2. Why must the private-IP check run at connect time?
3. When is raw HTTP better than a vendor SDK?

<details><summary>Answers</summary>

1. The shared secret for their endpoint, and the signed content: the webhook ID, timestamp, and raw body. They recompute the HMAC, compare in constant time, and reject old timestamps.
2. DNS can change after the URL was validated (DNS rebinding). Checking the resolved address on every connection ensures the request never reaches internal networks.
3. When the SDK is unmaintained, too heavy, or doesn't cover the endpoints you need, or for small APIs where a typed `HttpClient` (maybe generated from OpenAPI) is simpler to control and test.
</details>

## Sources
- [Standard Webhooks specification](https://www.standardwebhooks.com/)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [SocketsHttpHandler.ConnectCallback](https://learn.microsoft.com/dotnet/api/system.net.http.socketshttphandler.connectcallback)
- [Kiota API client generator](https://learn.microsoft.com/openapi/kiota/overview)
- [Stripe — Pagination](https://docs.stripe.com/api/pagination)
- [RFC 6585 — 429 Too Many Requests](https://www.rfc-editor.org/rfc/rfc6585#section-4)
