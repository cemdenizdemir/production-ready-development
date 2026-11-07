---
title: Validation & Abuse Protection
module: 03-backend
tech: Zod 4, express-rate-limit, Redis 8
---
# Validation & Abuse Protection
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Validate everything at the boundary: body, params, query, headers, files
- [ ] ⭐ Zod in Express: reusable validation helpers, typed requests, coercion
- [ ] Normalization and canonicalization: trimming, case, Unicode, emails, URLs
- [ ] ⭐ Size and complexity limits: body size, arrays, string lengths, page sizes, timeouts
- [ ] ⭐ Rate limiting strategies: per IP, user, API key, and route; algorithms
- [ ] Distributed rate limiting with Redis; `RateLimit` headers and `Retry-After`
- [ ] Bot and abuse protection: credential stuffing, card testing, SMS pumping, signup spam, scraping
- [ ] Mass assignment and over-posting protection
- [ ] Verifying incoming webhooks: raw body, signatures, timestamps, replay protection
- [ ] Business-logic abuse: coupon stacking, race conditions, negative quantities
- [ ] Monitoring abuse: metrics, alerts, blocklists, and response playbooks

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Boundary validation with Zod](docs/01-boundary-validation-zod.md)
- [02 · Limits and rate limiting](docs/02-limits-and-rate-limiting.md)
- [03 · Bots, webhooks, business abuse, and monitoring](docs/03-bots-webhooks-business-abuse.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 03-backend/05-validation-abuse mode=tasks` when you are ready to build._
