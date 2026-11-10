---
title: Validation & Abuse Protection cheatsheet
tech: ASP.NET Core 10 validation, FluentValidation, rate limiting middleware, Redis 8
version: ASP.NET Core 10, FluentValidation 12.x, StackExchange.Redis 2.x, Stripe.net 4x.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Validation & Abuse Protection cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Validation layers
| Layer | Guards | Note |
|:--|:--|:--|
| ⭐ request validation | shape, lengths, ranges | DataAnnotations / FluentValidation |
| custom binding | value objects | `TryParse` |
| ⭐ domain guards | invariants | `ArgumentOutOfRangeException.ThrowIfNegativeOrZero` |
| ⭐ database constraints | final guard | `CHECK`, `UNIQUE`, FK |
| authorization | may act on resource | 04-auth |

## Validation tools
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ `AddValidation()` | DataAnnotations on parameters | .NET 10 |
| `[Required]` `[MaxLength]` `[Range]` `[EmailAddress]` `[Url]` `[RegularExpression]` | field rules | in OpenAPI |
| `IValidatableObject` | cross-field | |
| FluentValidation + endpoint filter | complex rules | free |
| `TypedResults.ValidationProblem` | 400 response | |

## Normalization
| Value | Normalize | Note |
|:--|:--|:--|
| ⭐ text | trim, NFC, strip control chars | `Normalize(NormalizationForm.FormC)` |
| ⭐ email | trim + lowercase | Identity `NormalizedEmail` |
| usernames | case-fold, confusables | impersonation |
| URLs | `Uri.TryCreate`, scheme allowlist | |
| phone | E.164 | libphonenumber-csharp |
| codes/SKUs | uppercase, no spaces | |
| money | max scale | `decimal` |

## Limits
| Limit | Setting | Note |
|:--|:--|:--|
| ⭐ body | `Limits.MaxRequestBodySize` | 30 MB default → lower |
| per endpoint | `[RequestSizeLimit]` | uploads |
| forms | `FormOptions` | `ValueCountLimit` |
| JSON depth | `MaxDepth` | 64 default |
| ⭐ collections | `[MaxLength(n)]` on lists | |
| ⭐ strings | `[MaxLength]` everywhere | match DB |
| headers | `MaxRequestHeadersTotalSize` | |
| page size | clamp | |
| ⭐ regex | `matchTimeout`, `NonBacktracking`, `[GeneratedRegex]` | ReDoS |
| time | request + command timeouts | |

## Over-posting
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ DTOs only | never bind entities | |
| explicit mapping | `SetProperty` / mappers | |
| separate admin DTOs | different powers | |
| `[JsonIgnore]` on entities | not a defense | |

## Rate limit keys
| Endpoint | Key | Note |
|:--|:--|:--|
| ⭐ login / reset / OTP | IP + account | Redis |
| signup | IP, fingerprint | |
| API | user id | token bucket |
| partners | API key | contract |
| exports/search | user + concurrency | |
| payments | customer + IP + card fingerprint | card testing |

## Rate limiting middleware
| API | Does | Note |
|:--|:--|:--|
| ⭐ `AddRateLimiter` + `UseRateLimiter` | enable | |
| `GlobalLimiter` | all requests | |
| ⭐ `AddPolicy(name, ctx => RateLimitPartition…)` | partitioned policy | |
| `GetFixedWindowLimiter` / `GetSlidingWindowLimiter` | windows | |
| ⭐ `GetTokenBucketLimiter` | bursts + rate | |
| `GetConcurrencyLimiter` | in-flight cap | |
| `PartitionedRateLimiter.CreateChained` | combine | |
| `RejectionStatusCode = 429` | status | default 503 |
| ⭐ `OnRejected` + `MetadataName.RetryAfter` | `Retry-After` | |
| `RequireRateLimiting` / `DisableRateLimiting` | per endpoint | |
| per instance | multiplies with replicas | |

## Distributed limits
| Option | Does | Note |
|:--|:--|:--|
| ⭐ Redis Lua `INCR` + `PEXPIRE` | atomic fixed window | |
| Redis token bucket script | smoother | |
| RedisRateLimiting | library | also seen |
| ⭐ Front Door WAF rate rules | edge limits | IP/geo/path |
| API Management | partner quotas | |
| fail open / closed | general / sensitive | |

## Headers
| Header | Use | Note |
|:--|:--|:--|
| ⭐ `Retry-After` | when to retry | 429/503 |
| `RateLimit-Limit` / `-Remaining` / `-Reset` | common quota headers | |
| `RateLimit-Policy` / `RateLimit` | IETF draft | |

## Incoming webhooks
| Step | Rule | Note |
|:--|:--|:--|
| ⭐ raw body | read before binding | |
| ⭐ signature | verify with secret | `EventUtility.ConstructEvent` |
| timestamp tolerance | ~5 min | replay |
| ⭐ idempotency | unique event ID | |
| fast 2xx | process in background | Hangfire |
| out-of-order | use current state | |
| refetch for critical actions | provider API | |
| `.ExcludeFromDescription()` | keep out of public docs | |

## Bots and fraud
| Threat | Control | Note |
|:--|:--|:--|
| credential stuffing | limits, MFA, breached checks | |
| ⭐ card testing | payment limits, Stripe Radar, step-up | |
| SMS pumping | per-number/country limits, allowlist | |
| signup spam | email verification, CAPTCHA on signals | Turnstile, hCaptcha |
| scraping | edge limits, bot rules, caching | |
| hoarding | reservation timeouts | |
| honeypot fields | cheap bot filter | |

## Business-logic abuse
| Abuse | Defense | Note |
|:--|:--|:--|
| ⭐ races (double redeem) | unique constraints, conditional updates | |
| coupon stacking | server-side rules | |
| negative quantities | validation + CHECK | |
| ⭐ price tampering | server computes totals | |
| refund abuse | limits, audit | |
| code enumeration | long random codes, limits | |

## Monitoring
| Signal | Metric | Note |
|:--|:--|:--|
| rejections | per policy/route | |
| auth failures | per IP/account | |
| payment declines | rate per hour | |
| 4xx spikes | per route | |
| business anomalies | redemptions, refunds | |
| playbooks | block/rollback steps | |
| edge blocklists | with expiry | Front Door custom rules |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| validate without normalizing | duplicates | normalize first |
| unbounded collections | OOM | max lengths |
| user regexes | ReDoS | timeouts / no user patterns |
| entity binding | privilege escalation | DTOs |
| IP-only login limits | rotated IPs | account too |
| in-memory limits at scale | multiplied | Redis/edge |
| 429 without Retry-After | retry storms | header |
| bound webhook body | broken signatures | raw body |
| check-then-insert | races | constraints |
| CAPTCHA everywhere | lost sales | signal-based |

## Sources
| Source | Link |
|:--|:--|
| Rate limiting | https://learn.microsoft.com/aspnet/core/performance/rate-limit |
| Minimal API validation | https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis#validation |
| Regex best practices | https://learn.microsoft.com/dotnet/standard/base-types/best-practices-regex |
| OWASP input validation | https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html |
| OWASP mass assignment | https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html |
| OWASP automated threats | https://owasp.org/www-project-automated-threats-to-web-applications/ |
| Stripe webhooks | https://docs.stripe.com/webhooks |
| Stripe card testing | https://docs.stripe.com/disputes/prevention/card-testing |
| Front Door WAF | https://learn.microsoft.com/azure/web-application-firewall/afds/afds-overview |
