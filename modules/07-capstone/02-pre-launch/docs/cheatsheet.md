---
title: Pre-Launch Checklist cheatsheet
tech: Next.js 16, Express 5, PostgreSQL 18, Redis 8, AWS, Terraform
version: OWASP Top 10:2025, WCAG 2.2 AA, GDPR, k6 1.x, Lighthouse CI, axe-core, Terraform 1.14
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Pre-Launch Checklist cheatsheet
[← Overview](00-overview.md) · Reminder tables: claim → evidence → owner. ⭐ = must know.

## Security (OWASP 2025)
| Item | Evidence |
|:--|:--|
| ⭐ A01 access control | authorization test matrix (401/403/404) |
| A02 misconfiguration | header check, CORS review, IAM Access Analyzer |
| ⭐ A03 supply chain | `pnpm audit --prod`, Dependabot, CodeQL, pinned actions |
| A04 cryptography | SSL Labs A, argon2id, Secrets Manager |
| ⭐ A05 injection | CodeQL, parameterized queries |
| A06 insecure design | threat model, rate limits, server-side prices |
| A07 authentication | staff MFA, session rotation, breached-password check |
| A08 integrity | webhook signature tests |
| A09 logging/alerting | security events logged and alerted |
| A10 exceptional conditions | fail closed, no stack traces to clients |
| ⭐ Secrets | `gitleaks detect` clean, none in images |
| Headers | HSTS, CSP, nosniff, Referrer-Policy, no `X-Powered-By` |

## Privacy and legal
| Item | Evidence |
|:--|:--|
| ⭐ Data inventory | `docs/privacy/data-inventory.md` |
| ⭐ Privacy policy | matches inventory and processors |
| ⭐ Consent | no analytics before consent (test) |
| Access and erasure | flows + erasure log replay |
| Processor agreements | DPAs (AWS, Stripe, SES, Sentry) |
| ⭐ Breach process | 72-hour path in a runbook |
| Terms, imprint, withdrawal info | pages |
| Accessibility statement | page |

## Reliability
| Item | Evidence |
|:--|:--|
| ⭐ Timeouts everywhere | hang tests (MSW `delay('infinite')`) |
| Safe retries | 503 vs 404 tests |
| ⭐ Health checks | DB outage doesn't restart tasks |
| ⭐ Graceful shutdown | deploy under load: 0 errors |
| Degradation | dependency stopped, pages work |
| Shedding, rate limits | overload returns 503/429 fast |
| Circuit breaker | fault test opens it |

## Data safety
| Item | Evidence |
|:--|:--|
| ⭐ PITR backups 14+ days | `describe-db-instances` |
| ⭐ Deletion protection | same query + `prevent_destroy` |
| Locked cross-account copy | AWS Backup |
| ⭐ Restore drill + RTO | drill log |
| Expand-only migrations | review |
| Erasure replay | script + test |
| Encryption + verified TLS | config |

## Observability
| Item | Evidence |
|:--|:--|
| Structured logs, trace IDs, no PII | Loki sample |
| ⭐ End-to-end checkout trace | Tempo link |
| ⭐ RED + business dashboards | links |
| Sentry releases | test error |
| ⭐ SLOs + burn-rate alerts with runbooks | rules list |
| ⭐ Alert path works | acknowledged test page |

## Operations
| Item | Evidence |
|:--|:--|
| ⭐ On-call rotation + escalation | schedule |
| Status page outside AWS | URL |
| Incident process | runbook |
| ⭐ Top runbooks rehearsed | game day notes |
| Budgets + anomaly alerts | AWS Budgets |

## Performance
| Item | Target |
|:--|:--|
| ⭐ k6 at campaign peak | 100 req/s; p95 < 300 ms browse, < 800 ms checkout; errors < 1% |
| ⭐ LCP / INP / CLS | < 2.5 s / < 200 ms / < 0.1 |
| CDN + Redis hit ratio | product pages cached, > 80% |
| Images | sized, modern formats, LCP prioritized |
| Bundles | within budget |
| Queries | indexed, no N+1 |

## Accessibility (WCAG 2.2 AA)
| Item | Evidence |
|:--|:--|
| ⭐ axe scan in CI | `@axe-core/playwright`, 0 violations |
| ⭐ Keyboard journey | manual pass |
| Screen reader journey | VoiceOver/NVDA pass |
| Forms | labels, linked errors, autocomplete |
| Contrast, 200% zoom | checks |
| Target size, focus not obscured | WCAG 2.2 checks |
| Reduced motion | respected |

## SEO
| Item | Evidence |
|:--|:--|
| Titles/descriptions | `generateMetadata` |
| Canonical URLs | page source |
| ⭐ `sitemap.xml`, `robots.txt` | URLs |
| Open Graph | preview tools |
| Product JSON-LD | Rich Results Test |
| ⭐ `noindex` outside prod | `X-Robots-Tag` on staging |

## Infrastructure and delivery
| Item | Evidence |
|:--|:--|
| ⭐ No drift | nightly plan exit 0 |
| Separate accounts | Organizations |
| ⭐ OIDC, no static keys | workflows, credential report |
| ⭐ Same digest staging → prod | deploy logs |
| Prod approval gate | environment rules |
| ⭐ Rollback timed | drill |
| Locked migration tasks | pipeline logs |
| Image scanning, SBOM | registry |

## Code health
| Item | Evidence |
|:--|:--|
| ⭐ Boundaries enforced | lint + architecture test in CI |
| ADRs current | `docs/adr/` |
| Domain unit tests | coverage of domain folders |
| No critical/high review findings | `/review` reports |
| Glossary matches code | spot check |
| Tech debt visible | issues |

## Launch plan
| Phase | Actions |
|:--|:--|
| T−14 | readiness complete, game day, load test |
| T−7 | freeze, flags, support ready |
| T−1 | on-call briefed, rollback rehearsed |
| ⭐ T0 | internal → 5% → 25% → 100% with gates |
| T+1 | errors, tickets, payments, Web Vitals |
| ⭐ T+7–14 | post-launch review, remove launch flags |

## Rollout gates
| Gate | Continue if |
|:--|:--|
| Errors | ≤ baseline, burn rate under page thresholds |
| Checkout | ≥ 97% reach payment; payment success ≥ 90% |
| Latency | p95 within SLO |
| Support | no new ticket class |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Claims without evidence | false confidence | link the proof |
| Auth middleware = authorization | IDOR | per-object tests |
| Analytics before consent | legal risk | consent gate |
| Never-restored backups | failed recovery | drill + RTO |
| Alerts routed nowhere | silent outages | test page |
| Home-page-only load tests | checkout collapses | realistic mix |
| axe only | missed a11y issues | manual passes |
| Indexed staging | SEO damage | `noindex` |
| Disabled architecture test | boundary erosion | fix or ADR |
| 100% launch on Friday | maximal blast radius | gradual, working hours |

## Sources
| Source | Link |
|:--|:--|
| OWASP Top 10 | https://owasp.org/Top10/ |
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ |
| Core Web Vitals | https://web.dev/articles/vitals |
| GDPR | https://gdpr-info.eu/ |
| Reliable product launches | https://sre.google/sre-book/reliable-product-launches/ |
| Lighthouse CI | https://github.com/GoogleChrome/lighthouse-ci |
| Feature toggles | https://martinfowler.com/articles/feature-toggles.html |
