---
title: Common Integrations
module: 03-backend
tech: Stripe, AWS SES, AWS S3, BullMQ
---
# Common Integrations
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Integration principles: adapters, timeouts, retries, idempotency, secrets, sandboxes
- [ ] ⭐ Payments with Stripe: PaymentIntents, Checkout vs Payment Element, amounts in minor units, test mode
- [ ] ⭐ Stripe webhooks: raw-body signature verification, idempotent handlers, ordering, retries
- [ ] ⭐ Transactional email with AWS SES: domain identity, SPF, DKIM, DMARC, leaving the sandbox
- [ ] Email deliverability: bounces, complaints, suppression lists, event destinations
- [ ] ⭐ Uploads to S3 with presigned URLs: size and type limits, private buckets, key design
- [ ] Serving files: presigned GETs, CloudFront with origin access control, caching
- [ ] Upload security: validation, magic bytes, malware scanning, quarantine
- [ ] Sending webhooks to customers: signing, retries with BullMQ, delivery logs, SSRF protection
- [ ] Third-party API clients: rate limits, pagination, SDK vs raw HTTP
- [ ] Testing integrations: Stripe CLI and test cards, SES mailbox simulator, fakes, contract tests
- [ ] Reconciliation and monitoring: reconciliation jobs, dashboards, alerts per integration

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Integration principles and Stripe payments](docs/01-principles-and-stripe-payments.md)
- [02 · Stripe webhooks and reconciliation](docs/02-stripe-webhooks-reconciliation.md)
- [03 · Transactional email with AWS SES](docs/03-email-with-ses.md)
- [04 · Files with S3: uploads, serving, security](docs/04-files-with-s3.md)
- [05 · Outgoing webhooks and testing integrations](docs/05-outgoing-webhooks-and-testing.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn typescript/03-backend/12-integrations mode=tasks` when you are ready to build._
