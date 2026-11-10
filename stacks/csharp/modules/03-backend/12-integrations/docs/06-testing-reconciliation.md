---
title: Testing integrations and reconciliation
tech: Stripe CLI, Azurite, Testcontainers, WireMock.Net, Hangfire, Azure Monitor
version: Stripe CLI 1.x, Azurite 3.x, Testcontainers.Azurite 4.x, WireMock.Net 1.x
date: 2026-11-09
covers: [11, 12]
---
# Testing integrations and reconciliation
[← Overview](00-overview.md)

## Why it matters
- Payment tests ran only against a mock that always returned "succeeded". In production, 3-D Secure (`requires_action`) wasn't handled and 8% of European cards failed.
- Upload tests needed a real storage account, so nobody ran them. A SAS permission bug reached production.
- For three weeks, a webhook misconfiguration meant 2% of paid orders stayed "pending". Nobody noticed until finance compared the Stripe payout with the order report.

## Concepts

### Testing integrations
| Level | Tool | Tests |
|:--|:--|:--|
| ⭐ unit | fakes behind ports (`FakePaymentGateway`, `FakeEmailSender`) | use-case logic for every outcome: success, decline, timeout, duplicate |
| ⭐ adapter (HTTP) | WireMock.Net | the adapter's requests, error mapping, retries, timeouts against canned responses |
| ⭐ storage | Azurite in Testcontainers | SAS generation, upload, promotion, deletion |
| ⭐ sandbox | Stripe test mode + Stripe CLI | real API behaviour, webhooks end to end |
| contract | Pact (PactNet) or recorded examples | your expectations of a partner's API, checked against their spec or provider tests |
| smoke in staging | scripted flows with test cards | the full chain after each deploy |

| Stripe test card | Result |
|:--|:--|
| `4242 4242 4242 4242` | succeeds |
| `4000 0025 0000 3155` | requires 3-D Secure authentication |
| `4000 0000 0000 9995` | declined: insufficient funds |
| `4000 0000 0000 0002` | declined: generic |

| Stripe CLI | Does |
|:--|:--|
| `stripe listen --forward-to localhost:5080/webhooks/stripe` | forwards test-mode events to your machine, prints the signing secret |
| `stripe trigger payment_intent.succeeded` | creates the objects and fires the event |
| `stripe events resend evt_...` | replays an event |
| `stripe logs tail` | live API request logs |

Email has no ACS emulator: test the adapter's request shape with a fake or WireMock, and send real emails only in staging to test inboxes.

### Reconciliation and monitoring
| Check | How often | Compares |
|:--|:--|:--|
| ⭐ payments | hourly + daily | Stripe PaymentIntents/charges (by `metadata.order_id`) vs orders: paid in Stripe but pending here, or the reverse, and amount mismatches |
| ⭐ unprocessed webhooks | every 15 min | stored events without `ProcessedAt` older than N minutes |
| refunds and disputes | daily | Stripe refunds/disputes vs order states |
| payouts | per payout | Stripe balance transactions vs accounting export |
| email | daily | sent vs delivered vs bounced; stuck "sending" records |
| uploads | daily | quarantine blobs older than 1 hour; promoted files without a DB record |
| outgoing webhooks | continuous | endpoints failing for > 24 h |

| Per-integration signal | Alert when |
|:--|:--|
| ⭐ error rate and latency (`http.client.request.duration` by `server.address`) | burn rate or p95 above normal |
| ⭐ reconciliation mismatches | > 0 for payments |
| webhook signature failures | > 0 (misconfiguration or attack) |
| bounce / complaint rate | > 2% / > 0.1% |
| malware detections | any |
| circuit breaker open | any, for payments |

A dashboard per integration (10-observability) shows these together, so "is Stripe broken or are we?" takes one look.

## Example
`tests/Shop.Payments.Tests/StripeGatewayTests.cs` (WireMock.Net)
```csharp
using WireMock.RequestBuilders;
using WireMock.ResponseBuilders;
using WireMock.Server;

public sealed class StripeGatewayTests : IDisposable
{
    private readonly WireMockServer _stripe = WireMockServer.Start();

    [Fact]
    public async Task Returns_provider_error_when_Stripe_rejects_the_request()
    {
        _stripe.Given(Request.Create().WithPath("/v1/payment_intents").UsingPost())
               .RespondWith(Response.Create().WithStatusCode(402).WithBodyAsJson(new
               {
                   error = new { type = "card_error", code = "card_declined", message = "Your card was declined." },
               }));
        var client = new StripeClient("sk_test_fake", apiBase: _stripe.Url);
        var gateway = new StripeGateway(client, NullLogger<StripeGateway>.Instance);

        var result = await gateway.CreateAsync(TestData.PaymentRequest(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeFalse();
        result.Error!.Code.ShouldBe("payment.provider_error");
    }

    public void Dispose() => _stripe.Stop();
}
```
`tests/Shop.Catalog.Tests/UploadUrlsTests.cs` (Azurite with Testcontainers)
```csharp
using Azure.Storage.Blobs;
using Testcontainers.Azurite;

public sealed class UploadUrlsTests : IAsyncLifetime
{
    private readonly AzuriteContainer _azurite = new AzuriteBuilder().WithImage("mcr.microsoft.com/azure-storage/azurite:3.33.0").Build();

    public async ValueTask InitializeAsync() => await _azurite.StartAsync();
    public async ValueTask DisposeAsync() => await _azurite.DisposeAsync();

    [Fact]
    public async Task Upload_sas_allows_put_to_one_blob_only()
    {
        var service = new BlobServiceClient(_azurite.GetConnectionString());
        await service.GetBlobContainerClient("quarantine").CreateIfNotExistsAsync();
        // Azurite has no Entra ID: this test uses an account-key SAS through the same builder code path
        var ticket = await TestUploadUrls.For(service).CreateAsync("beans.jpg", 1024, TestContext.Current.CancellationToken);

        var upload = new Azure.Storage.Blobs.Specialized.BlockBlobClient(ticket.Value!.Url);
        await upload.UploadAsync(new MemoryStream(TestImages.SmallJpeg), cancellationToken: TestContext.Current.CancellationToken);

        var other = new BlobClient(new Uri(ticket.Value.Url.ToString().Replace(ticket.Value.BlobName, "other.jpg")));
        await Should.ThrowAsync<Azure.RequestFailedException>(() => other.UploadAsync(new MemoryStream([1]), TestContext.Current.CancellationToken));
    }
}
```
Azurite doesn't support user delegation keys, so production SAS code needs a small seam (an `ISasSigner` with a user-delegation implementation and an account-key one for tests).

`src/Modules/Payments/Shop.Payments/Reconciliation/PaymentReconciliationJob.cs`
```csharp
internal sealed class PaymentReconciliationJob(StripeClient stripe, PaymentsDb db, ShopTelemetry telemetry, ILogger<PaymentReconciliationJob> log)
{
    public async Task RunAsync(CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddHours(-26);                          // overlap windows
        var options = new PaymentIntentListOptions { Created = new DateRangeOptions { GreaterThanOrEqual = since }, Limit = 100 };
        var mismatches = 0;
        await foreach (var pi in new PaymentIntentService(stripe).ListAutoPagingAsync(options, cancellationToken: ct))
        {
            var local = await db.Payments.AsNoTracking().SingleOrDefaultAsync(p => p.ProviderId == pi.Id, ct);
            var problem = (pi.Status, local?.Status) switch
            {
                ("succeeded", null) => "missing locally",
                ("succeeded", not PaymentStatus.Succeeded and not PaymentStatus.Refunded) => "succeeded in Stripe, not here",
                (not "succeeded", PaymentStatus.Succeeded) => "succeeded here, not in Stripe",
                _ when local is not null && pi.AmountReceived > 0 && pi.AmountReceived != local.AmountMinor => "amount mismatch",
                _ => null,
            };
            if (problem is null) continue;
            mismatches++;
            log.LogError("Payment reconciliation: {PaymentIntent} {Problem}", pi.Id, problem);
        }
        telemetry.ReconciliationMismatches("stripe", mismatches);          // alert when > 0
    }
}
```
Scheduled with `recurring.AddOrUpdate<PaymentReconciliationJob>("payments:reconcile", j => j.RunAsync(CancellationToken.None), Cron.Hourly())`.

## Production patterns
- Every adapter has fast tests (fakes, WireMock.Net, Azurite) in CI, plus a sandbox suite (Stripe test mode, Stripe CLI) run before releases.
- Staging runs scripted end-to-end flows with test cards and test inboxes after each deploy.
- Reconciliation jobs per integration, with overlapping windows, metrics for mismatches, alerts, and a runbook for fixing each mismatch type.
- One dashboard per integration combining partner latency and errors, webhook health, and reconciliation results.

## Mistakes
Wrong: a payment mock that only ever succeeds.
Right: tests for success, decline, `requires_action`, timeout, and duplicate webhook, using fakes, WireMock.Net, and Stripe's test cards.

Wrong: trusting webhooks alone to keep payment states right.
Right: webhooks plus scheduled reconciliation against Stripe.

## Check yourself
1. Which test tool fits each: Stripe adapter error mapping, Blob SAS behaviour, real webhook flow?
2. What does payment reconciliation compare, and why use overlapping windows?
3. Why can't Azurite test user delegation SAS, and what do you do about it?

<details><summary>Answers</summary>

1. WireMock.Net for the adapter's error mapping; Azurite (in Testcontainers) for SAS and blob behaviour; Stripe test mode with the Stripe CLI for the real webhook flow.
2. Stripe's payment intents and charges (status and amount, matched by ID or `metadata.order_id`) against local payment and order records. Overlap means a record that changed late or a job that failed once is still checked on the next run.
3. Azurite doesn't implement Entra ID, so it can't issue user delegation keys. Put SAS signing behind a small interface, use an account-key signer in tests, and cover the user-delegation path in a staging smoke test.
</details>

## Sources
- [Stripe — Testing](https://docs.stripe.com/testing)
- [Stripe CLI](https://docs.stripe.com/stripe-cli)
- [Azurite emulator](https://learn.microsoft.com/azure/storage/common/storage-use-azurite)
- [Testcontainers for .NET — Azurite module](https://dotnet.testcontainers.org/modules/azurite/)
- [WireMock.Net](https://github.com/wiremock/WireMock.Net)
- [PactNet](https://github.com/pact-foundation/pact-net)
