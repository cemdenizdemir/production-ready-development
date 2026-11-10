---
title: Validation & Abuse Protection
module: 03-backend
tech: ASP.NET Core 10 validation, FluentValidation, rate limiting middleware, Redis 8
---
# Validation & Abuse Protection
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Validate everything at the boundary: body, params, query, headers, files
- [ ] ⭐ Validation in ASP.NET Core: DataAnnotations, `IValidatableObject`, FluentValidation, endpoint filters
- [ ] Normalization and canonicalization: trimming, case, Unicode, emails, URLs
- [ ] ⭐ Size and complexity limits: body size, arrays, string lengths, page sizes, timeouts
- [ ] ⭐ Rate limiting strategies: per IP, user, API key, and route; algorithms
- [ ] The rate limiting middleware: fixed window, sliding window, token bucket, and concurrency limiters; partitions; `OnRejected`
- [ ] Distributed rate limiting with Redis; `RateLimit` headers and `Retry-After`
- [ ] Bot and abuse protection: credential stuffing, card testing, SMS pumping, signup spam, scraping
- [ ] Mass assignment and over-posting protection
- [ ] Verifying incoming webhooks: raw body, signatures, timestamps, replay protection
- [ ] Business-logic abuse: coupon stacking, race conditions, negative quantities
- [ ] Monitoring abuse: metrics, alerts, blocklists, and response playbooks

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Validating at the boundary, normalization, limits, and over-posting](docs/01-boundary-normalization-limits.md)
- [02 · Rate limiting: strategies, the middleware, and Redis](docs/02-rate-limiting.md)
- [03 · Webhooks, bots, business-logic abuse, and monitoring](docs/03-webhooks-bots-business-abuse.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/05-validation-abuse mode=tasks` when you are ready to build._
