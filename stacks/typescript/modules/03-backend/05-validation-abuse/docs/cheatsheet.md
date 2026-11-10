---
title: Validation & Abuse Protection cheatsheet
tech: Zod 4, express-rate-limit, Redis 8
version: Zod 4.4, express-rate-limit 8, rate-limit-redis 4, Redis 8, Express 5.2
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Validation & Abuse Protection cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## What to validate
| Input | How | Note |
|:--|:--|:--|
| ⭐ Body | strict Zod object | mass assignment |
| ⭐ Path params | `z.uuid()` etc. | |
| ⭐ Query | coercion + bounds + enums | strings by nature |
| Headers | formats (`Idempotency-Key`, custom) | |
| Cookies | expected format | |
| Files | size + magic bytes | not extension |
| ⭐ Third-party data | webhooks, API responses | verify + parse |
| ⭐ Allowlist, not blocklist | define valid input | |

## Zod patterns
| API | Use | Note |
|:--|:--|:--|
| ⭐ `.strict()` | reject unknown keys | writes |
| default strip | drop unknown keys | reads |
| `.passthrough()` / `z.looseObject` | keep unknown keys | rarely |
| ⭐ `.max()` on strings/arrays | bound size | |
| ⭐ `z.coerce.number().int().min().max()` | query numbers | |
| `z.stringbool()` | query booleans | |
| ⭐ `z.enum([...])` | sorts, statuses | safe column mapping |
| `.trim()` / `.toLowerCase()` | normalize | |
| `.transform().pipe(schema)` | normalize then validate | |
| `.refine()` / `.superRefine()` | cross-field rules | |
| `.extend()` / `.pick()` / `.omit()` / `.partial()` | derive per-operation schemas | |
| `z.discriminatedUnion` | typed variants | |
| ⭐ `safeParse` / `parse` | handle / throw | |
| `z.flattenError` / `z.treeifyError` | error shapes | |

## Typed handlers
| Piece | What it does |
|:--|:--|
| ⭐ `handle({ body, query, params }, fn)` | parse inputs, pass typed values |
| `req.query` read-only (Express 5) | return parsed values, don't reassign |
| ZodError → 422 Problem Details | central error handler |
| Shared schemas package | front + back |

## Mass assignment
| Rule | Practice |
|:--|:--|
| ⭐ Separate schemas | create / update / admin update |
| ⭐ Server-controlled fields | id, accountId, role, status, price, timestamps never from clients |
| ⭐ No `{...req.body}` into queries/ORM | |
| `.strict()` on writes | visible over-posting |
| Tests | send forbidden fields, expect 422 |

## Normalization
| Data | Normalize |
|:--|:--|
| ⭐ Strings | trim |
| ⭐ Emails | trim + lowercase, unique normalized column |
| Usernames/slugs | NFKC, lowercase, strip zero-width, safe alphabet |
| Phones | E.164 (libphonenumber, also seen) |
| URLs | `new URL()`, scheme/host checks, `href` |
| Whitespace | collapse where meaningful |
| ⭐ Validate after normalizing | |

## Resource limits
| Limit | Example |
|:--|:--|
| ⭐ Body size | `express.json({ limit: '100kb' })` |
| Per-route exceptions | `express.json({ limit: '5mb' })` on imports |
| `express.urlencoded({ parameterLimit })` | form field count |
| ⭐ Page size | `max(100)` |
| ⭐ Array/string lengths | `.max()` |
| Request timeout | `server.requestTimeout` |
| DB timeout | `statement_timeout` |
| Upload size | presigned conditions |
| Concurrency per user | e.g. 2 exports |
| Plan quotas | per day/month |

## Rate-limit algorithms
| Algorithm | Behavior |
|:--|:--|
| Fixed window | simple, edge bursts |
| Sliding window | smoother |
| ⭐ Token bucket | bursts + steady average |
| Leaky bucket | constant drain |
| Concurrency limit | max in flight |
| Cost-weighted | expensive calls cost more tokens |

## express-rate-limit 8
| Option | What it does | Note |
|:--|:--|:--|
| ⭐ `windowMs` / `limit` | window / max requests | `limit` can be a function |
| ⭐ `standardHeaders: 'draft-8'` | `RateLimit` + `RateLimit-Policy` | |
| `legacyHeaders: false` | drop `X-RateLimit-*` | |
| ⭐ `store: new RedisStore({ sendCommand })` | shared counters | rate-limit-redis |
| ⭐ `keyGenerator` | user/account/API key keys | |
| ⭐ `ipKeyGenerator(ip)` | IPv6-safe IP keys | v8 |
| `ipv6Subnet` | group IPv6 (default 56) | |
| `skip(req)` | exempt health checks | |
| `skipSuccessfulRequests` | count failures only | login |
| `handler` | custom 429 (Problem Details) | |
| `requestPropertyName` | info on `req` | |
| `validate` | config sanity checks | trust proxy warnings |

## Keys for limits
| Key | Use |
|:--|:--|
| IP | anonymous, pre-auth |
| ⭐ User ID | logged-in traffic |
| ⭐ Account / API key | integrations, plan tiers |
| Route + key | login, signup, reset, OTP, export, search |
| Phone number / email | OTP and email sends |
| Card fingerprint | payment attempts |

## Responses and headers
| Item | Value |
|:--|:--|
| ⭐ Status | 429 |
| ⭐ `Retry-After` | seconds |
| `RateLimit-Policy` | `100;w=60` |
| `RateLimit` | `limit=100, remaining=37, reset=21` |
| Body | Problem Details with `detail` |
| Redis down | fail open (alert) or closed (sensitive flows) |
| Edge limits | AWS WAF rate-based rules, CDN |

## Bot abuse
| Abuse | Defense |
|:--|:--|
| ⭐ Credential stuffing | per-account limits, MFA, breach checks |
| ⭐ Card testing | payment attempt limits, CAPTCHA, Radar rules |
| ⭐ SMS pumping | country allowlist, per-number/IP limits, challenge before send |
| Signup spam | verification, limits, disposable domain checks |
| Scraping | auth, limits, random IDs, page caps |
| Promo abuse | per-payment-method limits, delayed rewards |
| Challenges | Turnstile, hCaptcha, reCAPTCHA (also seen) |
| Edge bot control | AWS WAF Bot Control (also seen) |

## Incoming webhooks
| Step | Practice |
|:--|:--|
| ⭐ Raw body | `express.raw({ type: 'application/json' })` before JSON parser |
| ⭐ Signature | provider SDK or HMAC + `timingSafeEqual` |
| ⭐ Timestamp window | ~5 min |
| ⭐ Dedupe | `processed_webhooks` unique `(provider, event_id)` |
| ⭐ Fast 200, async work | queue job with `jobId = event.id` |
| Out-of-order events | fetch current state for critical flows |
| Secret rotation | accept two secrets temporarily |
| `stripe.webhooks.constructEvent(raw, sig, secret)` | Stripe verification |

## Business-logic abuse
| Abuse | Fix |
|:--|:--|
| ⭐ Client prices/totals | compute server-side |
| ⭐ Negative quantities | `min(1)` + `CHECK` |
| Huge numbers | `max()` |
| ⭐ Coupon stacking | server rules + per-user unique usage |
| ⭐ Double redemption races | atomic conditional UPDATE / unique rows |
| Workflow skipping | server-side state machine |
| Free-tier farming | quotas, verification |
| Question per flow | "what if a bot does this 10,000 times?" |

## Abuse monitoring
| Metric | Alert on |
|:--|:--|
| ⭐ 429s per route | spikes |
| ⭐ Login failure rate | stuffing |
| Signups/hour, % unverified | spam |
| ⭐ Payment decline rate | card testing |
| OTP sends by country | pumping |
| Webhook signature failures | probing |
| Playbooks | tighten limits, challenges, temporary blocks (with expiry), kill switch |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `{...req.body}` updates | privilege escalation | strict per-operation schemas |
| Case-sensitive emails | duplicate accounts | normalize + unique |
| User-controlled sort | SQL injection | enums |
| Unbounded arrays/pages | resource exhaustion | `.max()` |
| One huge body limit | memory DoS | small default, exceptions |
| In-memory limits | ×instances, reset on deploy | Redis store |
| IP-only limits after login | shared IPs blocked | user/account keys |
| Parsed-body signature checks | broken verification | raw body |
| Sync webhook processing | retries, duplicates | dedupe + queue |
| Check-then-act balances | double spend | atomic SQL |
| Unlimited OTP sends | SMS bills | allowlists + limits |

## Sources
| Source | Link |
|:--|:--|
| OWASP Input Validation | https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html |
| OWASP Mass Assignment | https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html |
| OWASP API Top 10 (2023) | https://owasp.org/API-Security/editions/2023/en/0x11-t10/ |
| OWASP Automated Threats | https://owasp.org/www-project-automated-threats-to-web-applications/ |
| express-rate-limit | https://express-rate-limit.mintlify.app/ |
| rate-limit-redis | https://github.com/express-rate-limit/rate-limit-redis |
| Stripe webhooks | https://docs.stripe.com/webhooks |
| Zod | https://zod.dev/ |
