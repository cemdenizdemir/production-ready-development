---
title: Common Integrations
module: 03-backend
tech: Stripe.net, Azure Communication Services Email, Azure Blob Storage, Hangfire
---
# Common Integrations
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Integration principles: adapters, timeouts, retries, idempotency, secrets, sandboxes
- [ ] ⭐ Payments with Stripe: PaymentIntents, Checkout vs Payment Element, amounts in minor units, test mode
- [ ] ⭐ Stripe webhooks: raw-body signature verification, idempotent handlers, ordering, retries
- [ ] ⭐ Transactional email with Azure Communication Services: custom domains, SPF, DKIM, DMARC, sending limits
- [ ] Email deliverability: bounces, complaints, suppression lists, delivery events through Event Grid
- [ ] ⭐ Uploads to Azure Blob Storage with SAS URLs: size and type limits, private containers, blob naming
- [ ] Serving files: short-lived read SAS, user delegation SAS, Azure Front Door, caching
- [ ] Upload security: validation, magic bytes, malware scanning, quarantine
- [ ] Sending webhooks to customers: signing, retries with Hangfire, delivery logs, SSRF protection
- [ ] Third-party API clients: rate limits, pagination, SDK vs raw HTTP
- [ ] Testing integrations: Stripe CLI and test cards, Azurite for Blob Storage, fakes, contract tests
- [ ] Reconciliation and monitoring: reconciliation jobs, dashboards, alerts per integration

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Integration principles and Stripe payments](docs/01-principles-stripe-payments.md)
- [02 · Stripe webhooks](docs/02-stripe-webhooks.md)
- [03 · Transactional email with Azure Communication Services](docs/03-email-acs-deliverability.md)
- [04 · Uploads and file serving with Blob Storage](docs/04-blob-uploads-serving-security.md)
- [05 · Outgoing webhooks and third-party API clients](docs/05-outgoing-webhooks-api-clients.md)
- [06 · Testing integrations and reconciliation](docs/06-testing-reconciliation.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/12-integrations mode=tasks` when you are ready to build._
