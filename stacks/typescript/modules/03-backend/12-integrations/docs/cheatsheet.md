---
title: Integrations cheatsheet
tech: Stripe, AWS SES, AWS S3, BullMQ
version: stripe-node + Stripe CLI, AWS SDK for JavaScript v3 (client-sesv2, client-s3, s3-presigned-post, s3-request-presigner), BullMQ 5
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Integrations cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Integration principles
| Principle | Practice |
|:--|:--|
| ⭐ Adapter per provider | SDK types and errors stay inside |
| ⭐ Timeouts + few retries | SDK options, job retries |
| ⭐ Idempotency | provider keys; own dedupe rows where none |
| Async | jobs for slow or retryable calls |
| ⭐ Secrets | Secrets Manager/SSM → ECS task; restricted keys |
| Environments | sandbox/test keys outside production |
| ⭐ Webhooks in | raw body, signature, dedupe, job |
| Observability | latency, errors, 429s per provider; provider request IDs |
| ⭐ Reconciliation | scheduled comparison with the provider |

## Client configuration
| Client | Options |
|:--|:--|
| ⭐ `new Stripe(key, { timeout, maxNetworkRetries, appInfo })` | 10 s, 2 retries |
| ⭐ `new SESv2Client({ region, maxAttempts, requestHandler: { connectionTimeout, requestTimeout } })` | AWS SDK v3 |
| `new S3Client({ region })` | credentials from the task role |
| `requestChecksumCalculation: 'WHEN_REQUIRED'` | S3 client used only for presigning (see gotchas) |
| Raw HTTP APIs | `fetch` + `AbortSignal.timeout()` wrapper |

## Stripe objects
| Object | Use |
|:--|:--|
| ⭐ PaymentIntent | one payment attempt |
| ⭐ Checkout Session | hosted/embedded payment page |
| Customer | saved buyer |
| PaymentMethod | card, SEPA, wallets |
| SetupIntent | save a method for later |
| Charge / Refund | money movement / refunds |
| Dispute | chargebacks |
| Event | webhook payload, retrievable for 30 days |
| Subscription / Invoice | Billing |

## PaymentIntent statuses
| Status | Meaning |
|:--|:--|
| `requires_payment_method` | needs a method (or the last one failed) |
| `requires_confirmation` | ready to confirm |
| ⭐ `requires_action` | 3DS or other customer action |
| `processing` | async methods in flight |
| ⭐ `succeeded` | paid |
| `canceled` | abandoned or canceled |
| `requires_capture` | authorized, capture later (manual capture) |

## Stripe API features
| Feature | Detail |
|:--|:--|
| ⭐ Amounts | integers in minor units; zero-decimal currencies (JPY) |
| ⭐ `{ idempotencyKey }` | stable per operation; kept ≥ 24 h; same key + different params = error |
| ⭐ `metadata` | your IDs (`orderId`) on objects |
| `client_reference_id` | your ID on Checkout Sessions |
| Auto-pagination | `for await (const x of stripe.x.list({ limit: 100 }))` |
| `expand: ['payment_intent']` | include related objects |
| API version | pinned by the SDK release; upgrade deliberately |
| Restricted keys | `rk_…` with minimal permissions |
| Rate limits | 100 ops/s live, 25 test (defaults) |
| `Request-Id` header | quote it in support tickets |

## Checkout vs Payment Element
| | Checkout | Payment Element |
|:--|:--|:--|
| Effort | low | more |
| UI | Stripe page (hosted/embedded) | inside your page |
| Payment methods, 3DS | handled | handled, more wiring |
| Use | ⭐ default | custom payment step |
| Confirmation | ⭐ webhook | ⭐ webhook |

## Stripe test cards
| Card | Result |
|:--|:--|
| ⭐ `4242 4242 4242 4242` | success |
| ⭐ `4000 0025 0000 3155` | requires 3DS |
| `4000 0000 0000 9995` | insufficient funds |
| `4000 0000 0000 0002` | generic decline |
| Any future date, any CVC | test mode only |

## Stripe webhooks
| Rule | Detail |
|:--|:--|
| ⭐ Raw body | `express.raw({ type: 'application/json' })` before `express.json()` |
| ⭐ Verify | `stripe.webhooks.constructEvent(raw, sig, whsec)` (5-min tolerance) |
| ⭐ Fast 2xx | enqueue, answer |
| ⭐ Duplicates | `jobId = event.id`; dedupe row in the worker's transaction |
| ⭐ Any order | guarded state transitions |
| Retries | up to 3 days in live mode; failing endpoints get disabled |
| Secrets | one endpoint + `whsec_` per environment |
| Subscribe narrowly | only handled event types |

## Stripe events
| Event | Do |
|:--|:--|
| ⭐ `checkout.session.completed` | mark paid if `payment_status === 'paid'` |
| `checkout.session.async_payment_succeeded` / `_failed` | delayed methods |
| `payment_intent.succeeded` / `.payment_failed` | Payment Element flows |
| `charge.refunded` | record refunds |
| `charge.dispute.created` | alert, evidence |
| `invoice.paid` / `invoice.payment_failed` | subscriptions |
| `customer.subscription.updated` / `.deleted` | plan changes, churn |

## Stripe CLI
| Command | Use |
|:--|:--|
| ⭐ `stripe listen --forward-to localhost:3000/webhooks/stripe` | local webhooks (prints `whsec_`) |
| ⭐ `stripe trigger checkout.session.completed` | send a test event |
| `stripe events resend evt_…` | replay an event |
| `stripe logs tail` | API request logs |
| Test clocks | simulate subscription time |
| `stripe.webhooks.generateTestHeaderString({ payload, secret })` | signatures in unit tests |

## Reconciliation
| Check | Action |
|:--|:--|
| ⭐ Succeeded PaymentIntents vs paid orders (daily) | self-heal missed webhooks |
| Paid orders without a succeeded payment | alert |
| `pending` orders > 1 h | look up Stripe state |
| Webhook lag and failures | metrics + alerts |
| Mismatch count | metric, alert when > 0 |

## SES setup
| Step | Detail |
|:--|:--|
| ⭐ Domain identity + Easy DKIM | 3 CNAMEs |
| ⭐ Custom MAIL FROM | `mail.shop.com` MX + SPF |
| ⭐ DMARC | `p=none` + reports → `quarantine`/`reject` |
| ⭐ Production access | leave the sandbox |
| Configuration sets | one per stream, with event destinations |
| Separate streams | transactional vs marketing |
| Quotas | per second and per day; raise before launches |

## Email DNS records
| Record | Example |
|:--|:--|
| DKIM | `<token>._domainkey` CNAME `<token>.dkim.amazonses.com` |
| MAIL FROM MX | `mail` MX `10 feedback-smtp.<region>.amazonses.com` |
| SPF | `mail` TXT `"v=spf1 include:amazonses.com ~all"` |
| DMARC | `_dmarc` TXT `"v=DMARC1; p=quarantine; rua=mailto:dmarc@shop.com"` |

## SES limits and thresholds
| Item | Value |
|:--|:--|
| Sandbox | verified recipients only, 200/24 h, 1/s |
| ⭐ Bounce rate | keep < 2%; review at 5%, pause risk at 10% |
| ⭐ Complaint rate | keep < 0.05%; review at 0.1%, pause risk at 0.5% |
| Gmail spam rate | < 0.1%, never ≥ 0.3% |
| Bulk mail | `List-Unsubscribe` + one-click (RFC 8058) |

## SES events and API
| Item | Detail |
|:--|:--|
| ⭐ `SendEmailCommand` (`@aws-sdk/client-sesv2`) | `Content.Simple` or `Content.Template` |
| `ConfigurationSetName`, `EmailTags` | event routing, tagging |
| ⭐ `Bounce` Permanent | mark undeliverable |
| ⭐ `Complaint` | unsubscribe non-essential |
| `Delivery`, `Reject`, `DeliveryDelay`, `RenderingFailure` | metrics |
| Destinations | EventBridge, SNS, CloudWatch, Firehose |
| Account suppression list | automatic for bounces/complaints |
| Errors | `MessageRejected` (permanent), `TooManyRequestsException` (retry), `SendingPausedException` (alert) |

## SES mailbox simulator
| Address | Simulates |
|:--|:--|
| `success@simulator.amazonses.com` | delivery |
| ⭐ `bounce@simulator.amazonses.com` | hard bounce |
| ⭐ `complaint@simulator.amazonses.com` | complaint |
| `ooto@simulator.amazonses.com` | auto-reply |
| `suppressionlist@simulator.amazonses.com` | suppressed address |

## S3 uploads
| | Presigned PUT | ⭐ Presigned POST |
|:--|:--|:--|
| Package | `@aws-sdk/s3-request-presigner` `getSignedUrl` | `@aws-sdk/s3-presigned-post` `createPresignedPost` |
| Size limit | exact signed `ContentLength` only | `['content-length-range', min, max]` |
| Type | signed `ContentType` | `['eq', '$Content-Type', type]` |
| Client | `PUT` body | form fields, file last |

## S3 calls
| Call | Use |
|:--|:--|
| `PutObjectCommand` / `GetObjectCommand` | write / read (server side) |
| ⭐ `getSignedUrl(s3, new GetObjectCommand(…), { expiresIn })` | presigned download |
| `ResponseContentDisposition` | `attachment; filename*=UTF-8''…` |
| `HeadObjectCommand` | size and metadata check |
| `GetObjectCommand` with `Range: 'bytes=0-15'` | magic bytes |
| `CopyObjectCommand` + `DeleteObjectCommand` | move out of quarantine |
| `Upload` (`@aws-sdk/lib-storage`) | streaming multipart uploads |
| `Body.transformToByteArray()` / `transformToString()` | read bodies |

## Bucket settings
| Setting | Value |
|:--|:--|
| ⭐ Block Public Access | on |
| Object ownership | bucket owner enforced |
| Encryption | SSE-S3 (default) or SSE-KMS |
| ⭐ CORS | your origins, `POST`/`PUT`, `content-type`, expose `ETag` |
| Lifecycle | expire `quarantine/` (1 day); abort multipart (7 days) |
| Versioning | on for important files |
| IAM | task role limited to prefixes |

## Serving files
| Need | Approach |
|:--|:--|
| ⭐ Private download | authorize → presigned GET (≤ 15 min) |
| Public assets | CloudFront + Origin Access Control |
| Private at scale | CloudFront signed URLs/cookies |
| Image sizes | resize in a job |

## Upload security
| Risk | Defense |
|:--|:--|
| ⭐ Size | policy limit + post-upload check |
| ⭐ Forged type | magic bytes vs allowlist |
| ⭐ XSS via files | separate domain, `attachment`, `nosniff`, no inline SVG/HTML |
| ⭐ Malware | quarantine + GuardDuty Malware Protection (`NO_THREATS_FOUND`) |
| ⭐ Keys | `{accountId}/{uuidv7}`, names only in DB |
| Access | authorize every download |
| EXIF | strip on re-encode |
| Bombs | pixel and archive limits |

## Outgoing webhooks
| Practice | Detail |
|:--|:--|
| ⭐ Jobs | one per (event, endpoint) |
| ⭐ Signature | HMAC-SHA256 of `id.timestamp.body`; `webhook-id`, `webhook-timestamp`, `webhook-signature: v1,…` |
| ⭐ Retries | custom backoff, ~1 day; 410 disables |
| Timeout | 5–10 s; `redirect: 'manual'` |
| Delivery log | attempt, status, latency |
| Receivers | dedupe on `webhook-id`; no ordering promise |
| Rotation | two secrets, two signatures |

## SSRF block list
| Range | What |
|:--|:--|
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | private networks |
| `127.0.0.0/8`, `::1` | loopback |
| ⭐ `169.254.0.0/16` | link-local, cloud metadata (`169.254.169.254`) |
| `100.64.0.0/10` | carrier-grade NAT |
| `fc00::/7`, `fe80::/10` | IPv6 private, link-local |
| `::ffff:0:0/96` | IPv4-mapped IPv6 |
| Node API | `new BlockList()` + `addSubnet` + `check` |
| Stronger | egress proxy (also seen: Smokescreen) |

## Testing integrations
| Level | Tool |
|:--|:--|
| Use cases | fake adapters |
| HTTP adapters | MSW |
| AWS adapters | `aws-sdk-client-mock` (also seen) |
| ⭐ Webhook routes | `generateTestHeaderString` + supertest |
| ⭐ Stripe flows | CLI, test cards, test clocks |
| ⭐ SES | mailbox simulator |
| Local email | console / Mailpit (also seen) |
| Local S3 | dev bucket / MinIO / LocalStack (also seen) |
| Staging | Playwright checkout with test cards |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Amount from the client | €0.01 orders | server-side prices |
| Success page = paid | forgeable; closed tabs | webhook confirmation |
| Random idempotency key per retry | duplicate charges | key from order ID + version |
| `express.json()` before the webhook route | signature fails | `express.raw()` first |
| Marking events processed before enqueue | lost events | enqueue first, dedupe in the worker |
| Live keys in staging | real charges | test keys/sandboxes |
| Launching while still in the SES sandbox | mail only to verified addresses | request production access early |
| One email stream | campaigns hurt resets | separate configuration sets/subdomains |
| Presigned PUT for size limits | can't cap size | presigned POST |
| File field not last in the POST form | S3 rejects the upload | append the file last |
| SDK default checksums on presigned URLs | browser uploads fail with signature errors | `requestChecksumCalculation: 'WHEN_REQUIRED'` on the presigning client |
| Keys with special characters in `CopySource` | copy fails | URL-encode, or use safe generated keys |
| Customer URLs fetched blindly | SSRF to metadata/internal services | HTTPS, block lists, no redirects |

## Sources
| Source | Link |
|:--|:--|
| Stripe webhooks | https://docs.stripe.com/webhooks |
| Stripe idempotent requests | https://docs.stripe.com/api/idempotent_requests |
| Stripe testing | https://docs.stripe.com/testing |
| SES developer guide | https://docs.aws.amazon.com/ses/latest/dg/Welcome.html |
| S3 presigned URLs | https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html |
| Standard Webhooks | https://www.standardwebhooks.com/ |
| OWASP file upload | https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html |
