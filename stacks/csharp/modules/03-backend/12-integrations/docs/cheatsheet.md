---
title: Common Integrations cheatsheet
tech: Stripe.net, Azure Communication Services Email, Azure Blob Storage, Hangfire
version: Stripe.net 50+, Azure.Communication.Email 1.x, Azure.Storage.Blobs 12.x, Hangfire 1.8.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Common Integrations cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Integration principles
| Principle | Practice | Note |
|:--|:--|:--|
| ⭐ adapter behind a port | vendor types stay inside | 11-architecture |
| ⭐ timeouts, limited retries | resilience handler or SDK | one retry layer |
| ⭐ idempotency keys | every create call | |
| ⭐ secrets in Key Vault | restricted keys | |
| sandboxes | test keys outside prod | |
| own record first | pending before calling | |
| partner IDs unique | constraints | |
| ⭐ reconcile | scheduled comparison | |
| observe | metrics, request IDs | per integration |

## Stripe objects
| Object | Meaning | Note |
|:--|:--|:--|
| ⭐ PaymentIntent | one payment attempt | status machine |
| `client_secret` | browser confirms | don't log |
| Checkout Session | hosted/embedded page | |
| Customer | saved details | |
| Charge | the money movement | under the intent |
| Refund | money back | |
| Dispute | chargeback | evidence deadline |
| Event | webhook payload | `evt_...` |
| Balance transaction | ledger entry | payouts |

## Stripe.net APIs
| API | Does | Note |
|:--|:--|:--|
| ⭐ `new StripeClient(key, httpClient: ...)` | client | singleton |
| `SystemNetHttpClient(http, maxNetworkRetries)` | transport, retries | auto idempotency on retry |
| ⭐ `PaymentIntentService.CreateAsync(options, requestOptions, ct)` | create intent | |
| ⭐ `RequestOptions { IdempotencyKey = ... }` | safe retries | per attempt |
| `AutomaticPaymentMethods = new() { Enabled = true }` | methods from dashboard | |
| `Metadata["order_id"]` | link to your data | |
| `ListAutoPagingAsync(...)` | all pages | `await foreach` |
| `StripeException.StripeError` | type, code, message | |
| `StripeResponse.RequestId` | support/debug | log it |
| `apiBase` | point at a stub | WireMock tests |

## Payment UI options
| Option | Use | Note |
|:--|:--|:--|
| ⭐ Checkout | fastest, hosted/embedded | less control |
| ⭐ Payment Element | custom page | PaymentIntents |
| `stripe.confirmPayment({ elements, confirmParams })` | confirm in browser | `return_url` |
| `@stripe/react-stripe-js` | React components | `<PaymentElement />` |
| raw card fields | | avoid |
| PCI SAQ A | card data never touches you | |

## Money
| Rule | Example | Note |
|:--|:--|:--|
| ⭐ minor units | `4990` = €49.90 | `long` |
| ⭐ server computes | from stored order | never client |
| zero-decimal currencies | JPY: `1000` = ¥1,000 | exponent per currency |
| lowercase currency | `"eur"` | Stripe |
| `AmountReceived` check | compare in webhook | |

## Stripe webhooks
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `EventUtility.ConstructEvent(json, sig, secret)` | verify + parse | raw body |
| `Stripe-Signature` | header | timestamp + v1 HMAC |
| `EventUtility.ParseEvent(json)` | parse stored event | |
| ⭐ `EventTypes.PaymentIntentSucceeded` | type constants | |
| ⭐ unique `event.id` | dedupe | |
| ⭐ 2xx fast, process later | Hangfire job | |
| retries | up to 3 days | live mode |
| no ordering | guarded transitions | |
| API version check | throws on mismatch | default |
| rolling secret | rotation | |
| ⭐ paid on webhook | not on `return_url` | |

## Stripe CLI and test cards
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `stripe listen --forward-to URL` | local webhooks | prints `whsec_` |
| ⭐ `stripe trigger <event>` | fire test event | |
| `stripe events resend evt_...` | replay | |
| `stripe logs tail` | request logs | |
| `4242 4242 4242 4242` | success | |
| `4000 0025 0000 3155` | 3-D Secure | |
| `4000 0000 0000 9995` | insufficient funds | |
| `4000 0000 0000 0002` | generic decline | |

## ACS Email
| Item | Does | Note |
|:--|:--|:--|
| ⭐ custom domain | trusted sender | `mail.shop.example` |
| Azure-managed domain | testing only | low limits |
| `MailFrom` addresses | allowed senders | |
| ⭐ `EmailClient(uri, credential)` | send client | managed identity |
| ⭐ `SendAsync(WaitUntil.Started, message)` | send, don't wait | |
| `EmailMessage`, `EmailContent`, `EmailRecipients` | message types | Html + PlainText |
| `message.Headers` | custom headers | correlation |
| quotas | low by default | support request |
| suppression lists | domain-level | plus own table |

## DNS for email
| Record | Proves | Note |
|:--|:--|:--|
| ⭐ SPF | allowed senders | TXT |
| ⭐ DKIM | signed messages | 2 CNAMEs |
| ⭐ DMARC | policy + reports | `p=none` → `reject` |
| verification TXT | ownership | |
| one-click unsubscribe | bulk/marketing | Gmail/Yahoo rules |

## Deliverability
| Practice | Why | Note |
|:--|:--|:--|
| ⭐ separate marketing | protect transactional | subdomain |
| ⭐ suppress hard bounces | reputation | |
| suppress complaints | reputation | |
| warm up | new domains | |
| plain-text part | spam filters | |
| bounce rate | < 2% | alert |
| complaint rate | < 0.1% | alert |
| ⭐ Event Grid delivery events | `EmailDeliveryReportReceived` | Delivered, Bounced, ... |
| `SubscriptionValidationEventData` | webhook handshake | |

## Blob uploads
| Item | Does | Note |
|:--|:--|:--|
| ⭐ private containers | no anonymous access | account setting |
| ⭐ user delegation SAS | Entra-signed | no account key |
| `GetUserDelegationKeyAsync(start, expiry)` | key | up to 7 days, cache |
| ⭐ `BlobSasBuilder` | SAS definition | one blob |
| `BlobSasPermissions.Create \| Write` | upload only | |
| `ExpiresOn` | 5–15 min | |
| `SasProtocol.Https` | HTTPS only | |
| `BlobUriBuilder { Sas = ... }` | final URL | |
| ⭐ GUID blob names | no overwrite/traversal | |
| quarantine container | until checked | |
| size check after upload | SAS can't limit | `ContentLength` |
| storage CORS | browser `PUT` | |
| lifecycle rules | clean quarantine | |

## Serving files
| Option | Use | Note |
|:--|:--|:--|
| ⭐ short read SAS | private files | after authz |
| `ContentDisposition` override | download name | `attachment` |
| `ContentType` override | correct type | |
| Front Door + Private Link | public assets | CDN |
| immutable names | long cache | `immutable` |
| API streaming | per-byte checks | costly |

## Upload security
| Threat | Defence | Note |
|:--|:--|:--|
| ⭐ malware | Defender for Storage scanning | on upload |
| ⭐ type spoofing | magic bytes | not `Content-Type` |
| polyglots | re-encode images | |
| ⭐ stored XSS | no HTML/SVG inline | separate domain |
| huge files | size and pixel limits | |
| EXIF location | strip metadata | |
| abuse | rate limits, quotas | |

## Outgoing webhooks
| Item | Does | Note |
|:--|:--|:--|
| ⭐ HMAC-SHA256 signature | authenticity | `HMACSHA256.HashData` |
| `webhook-id`, `webhook-timestamp`, `webhook-signature` | Standard Webhooks headers | |
| ⭐ durable retries | Hangfire backoff | ~3 days |
| ⭐ delivery log | per attempt | customer-visible |
| disable failing endpoints | notify owner | |
| secret rotation | two secrets | |
| ⭐ SSRF-safe client | `ConnectCallback` IP check | blocks rebinding |
| `AllowAutoRedirect = false` | no redirects | |
| blocked ranges | 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10, IPv6 private | |

## Third-party APIs
| Topic | Practice | Note |
|:--|:--|:--|
| ⭐ rate limits | shared limiter, honour 429 | `Retry-After` |
| ⭐ cursor pagination | resume from cursor | |
| ⭐ SDK vs HTTP | maintained SDK first | |
| Kiota / NSwag | OpenAPI clients | generated |
| Refit | interface clients | also seen |
| version pinning | partner API version | changelogs |

## Testing integrations
| Tool | Tests | Note |
|:--|:--|:--|
| ⭐ fakes behind ports | use cases | every outcome |
| ⭐ WireMock.Net | adapter HTTP behaviour | |
| ⭐ Azurite (Testcontainers) | storage | no user delegation |
| ⭐ Stripe test mode + CLI | real flows | |
| PactNet | contracts | |
| staging smoke | full chain | test cards, inboxes |

## Reconciliation and monitoring
| Check | Compares | Alert |
|:--|:--|:--|
| ⭐ payments | Stripe intents vs orders | mismatches > 0 |
| ⭐ unprocessed webhooks | stored events age | > N min |
| refunds/disputes | Stripe vs orders | |
| payouts | balance transactions vs accounting | |
| email | sent vs delivered | bounce rate |
| uploads | stale quarantine | |
| partner latency/errors | `http.client.request.duration` | burn rate |
| signature failures | webhooks | > 0 |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| client-sent amounts | tampering | server computes |
| no idempotency key | double charges | per attempt key |
| float money | rounding | minor units |
| model-bound webhook | no signature check | raw body |
| slow webhook handler | retries, duplicates | enqueue, 200 |
| paid on redirect | unpaid orders shipped | webhook |
| no SPF/DKIM/DMARC | spam folder | DNS records |
| public containers | data leaks | SAS |
| trusting `Content-Type` | XSS, malware | magic bytes, scan |
| unvalidated webhook URLs | SSRF | IP checks |
| offset pagination | missed/duplicate rows | cursors |
| no reconciliation | silent drift | scheduled jobs |

## Sources
| Source | Link |
|:--|:--|
| Stripe payments | https://docs.stripe.com/payments/accept-a-payment |
| Stripe webhooks | https://docs.stripe.com/webhooks |
| Stripe testing | https://docs.stripe.com/testing |
| Stripe.net | https://github.com/stripe/stripe-dotnet |
| ACS Email | https://learn.microsoft.com/azure/communication-services/concepts/email/email-overview |
| User delegation SAS | https://learn.microsoft.com/azure/storage/blobs/storage-blob-user-delegation-sas-create-dotnet |
| Defender malware scanning | https://learn.microsoft.com/azure/defender-for-cloud/introduction-malware-scanning |
| OWASP file upload | https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html |
| OWASP SSRF | https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html |
| Standard Webhooks | https://www.standardwebhooks.com/ |
