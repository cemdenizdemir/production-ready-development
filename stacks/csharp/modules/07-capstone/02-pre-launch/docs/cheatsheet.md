---
title: Pre-Launch Checklist cheatsheet
tech: Next.js 16, ASP.NET Core 10, SQL Server 2025, Redis 8, Azure, Bicep
version: .NET 10 LTS, Next.js 16, Azure SQL, Azure Managed Redis, Azure Container Apps, Bicep 0.3x
date: 2026-11-10
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Pre-Launch Checklist cheatsheet
[← Overview](00-overview.md) · The checklist on one page: each item needs evidence. ⭐ = launch blocker if missing.

## Security
| Item | Evidence | Topic |
|:--|:--|:--|
| ⭐ authorization on every endpoint | inventory test + wrong-user tests | 03-backend/04 |
| ⭐ OWASP Top 10:2025 reviewed | review notes per category | 01-foundations/06 |
| ⭐ auth hardening | lockout, rate limits, staff MFA, `__Host-` cookies | 03-backend/04 |
| security headers | CSP, HSTS, frame-ancestors | 02-frontend/11 |
| ⭐ secrets | secret scanning, Key Vault, managed identities | 04-shipping/02 |
| ⭐ supply chain | NuGet/npm audit, Dependabot, SBOM, pinned images/actions | 04-shipping/01 |
| webhooks | signatures verified, events deduped | 03-backend/12 |
| uploads, SSRF | quarantine/scan; URL validation | 03-backend/12 |

## Privacy and legal
| Item | Evidence | Topic |
|:--|:--|:--|
| ⭐ data inventory | document | 04-shipping/05 |
| ⭐ privacy policy | published, matches inventory | |
| consent | cookie banner, marketing opt-in | |
| ⭐ access + erasure | end-to-end test, erasure log | 04-shipping/05 |
| breach process | 72 h runbook | 04-shipping/06 |
| telemetry privacy | redaction, retention | 03-backend/10 |
| terms, imprint, withdrawal | pages | |
| accessibility statement | page | |

## Reliability
| Item | Evidence | Topic |
|:--|:--|:--|
| ⭐ timeouts everywhere | config + chaos test | 03-backend/08 |
| ⭐ safe retries | handler config, idempotency keys | 03-backend/08 |
| breakers + fallbacks | chaos test | 03-backend/08 |
| ⭐ probes | live/ready/startup | 03-backend/08 |
| ⭐ graceful shutdown | deploy under load, 0 errors | 03-backend/08 |
| degradation | Redis-down test | 03-backend/08 |
| load shedding | stress test 503s | 03-backend/08 |

## Data safety
| Item | Evidence | Topic |
|:--|:--|:--|
| ⭐ PITR 35 days + redundancy | policy | 04-shipping/05 |
| LTR / locked copies | policy | 04-shipping/05 |
| ⭐ locks, purge protection, soft delete | Bicep | 04-shipping/05 |
| ⭐ restore drill, RTO ≤ 1 h | drill notes | 04-shipping/05 |
| safe migrations | expand-only latest | 04-shipping/05 |
| failover plan | ADR + drill | 04-shipping/05 |

## Observability
| Item | Evidence | Topic |
|:--|:--|:--|
| structured logs, no PII | samples | 03-backend/10 |
| ⭐ end-to-end traces | screenshot | 03-backend/10 |
| business metrics | dashboard | 03-backend/10 |
| ⭐ error tracking | App Insights + Sentry | 03-backend/10 |
| ⭐ SLOs + burn-rate alerts | SLO doc, rules | 03-backend/08 |
| ⭐ alerts have runbooks | links | 04-shipping/06 |
| sampling, caps, retention | config | 03-backend/10 |

## Operations
| Item | Evidence | Topic |
|:--|:--|:--|
| ⭐ on-call + escalation | rota, test page | 04-shipping/06 |
| ⭐ status page off-platform | link | 04-shipping/06 |
| incident process | runbook | 04-shipping/06 |
| ⭐ runbooks tested | game-day notes | 04-shipping/06 |
| budgets | forecast alerts | 04-shipping/02 |
| support briefed | notes | |

## Performance
| Item | Evidence | Topic |
|:--|:--|:--|
| ⭐ campaign-peak load test | k6 report | 03-backend/09 |
| stress + soak | reports | 03-backend/09 |
| capacity budget | worksheet | 03-backend/09 |
| ⭐ caching verified | hit ratios, headers | 03-backend/06 |
| query review | Query Store | 03-backend/03 |
| ⭐ Core Web Vitals budgets | Lighthouse CI, RUM | 02-frontend/07 |

## Accessibility
| Item | Evidence | Topic |
|:--|:--|:--|
| ⭐ axe gate | CI | 02-frontend/08 |
| ⭐ keyboard purchase flow | notes | 02-frontend/08 |
| ⭐ screen reader pass | notes | 02-frontend/08 |
| forms, contrast, zoom | review | 02-frontend/08 |
| WCAG 2.2 additions | review | 02-frontend/08 |

## SEO
| Item | Evidence | Topic |
|:--|:--|:--|
| titles, descriptions | page source | 02-frontend/12 |
| canonical URLs | page source | 02-frontend/12 |
| sitemap, robots | files | 02-frontend/12 |
| Open Graph | preview | 02-frontend/12 |
| structured data | Rich Results Test | 02-frontend/12 |
| ⭐ noindex outside prod | headers | 02-frontend/12 |

## Infrastructure and delivery
| Item | Evidence | Topic |
|:--|:--|:--|
| ⭐ no drift | what-if output | 04-shipping/03 |
| ⭐ OIDC, no CI secrets | identity config | 04-shipping/04 |
| ⭐ same digest staging → prod | pipeline logs | 04-shipping/04 |
| ⭐ approval gate | environment settings | 04-shipping/04 |
| ⭐ rollback rehearsed | drill | 04-shipping/04 |
| policies, locks, private endpoints | Bicep, compliance | 04-shipping/02, 03 |
| supported runtimes | scans | 04-shipping/01 |

## Code health
| Item | Evidence | Topic |
|:--|:--|:--|
| ⭐ architecture tests green | CI | 03-backend/11 |
| ⭐ ADRs current | docs/adr | 03-backend/11 |
| ⭐ no critical review findings | review report | 05-practice |
| tests and analyzers green | CI | 01-foundations/03, 05 |
| licences checked | CI | 06-design/04 |

## Launch plan
| Step | Gate | Note |
|:--|:--|:--|
| T−14 dry run | blockers closed | |
| T−7 freeze, load test, restore drill | thresholds, RTO | |
| ⭐ T−1 go/no-go | all owners go | |
| ⭐ T0 staff only | real orders + refunds | |
| ⭐ 10% → 50% → 100% | burn < 1×, no new error groups | flags |
| T+7 post-launch review | action items | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| opinions as evidence | false confidence | links to proof |
| hidden admin "security" | data exposure | policies + tests |
| untested restore | unknown RTO | drill |
| CPU-only alerts | missed outages | SLO burn alerts |
| status page on same platform | down together | external host |
| small load tests | launch day is the test | campaign peak |
| automated a11y only | missed barriers | manual passes |
| indexed staging | duplicate content | noindex |
| big-bang launch | large blast radius | gradual rollout |
| untried rollback | slow recovery | rehearse |

## Sources
| Source | Link |
|:--|:--|
| OWASP Top 10:2025 | https://owasp.org/Top10/ |
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ |
| Web Vitals | https://web.dev/articles/vitals |
| SRE: reliable launches | https://sre.google/sre-book/reliable-product-launches/ |
| SRE: alerting on SLOs | https://sre.google/workbook/alerting-on-slos/ |
| Azure SQL backups | https://learn.microsoft.com/azure/azure-sql/database/automated-backups-overview |
| Feature targeting | https://learn.microsoft.com/azure/azure-app-configuration/howto-targetingfilter |
| GDPR | https://gdpr-info.eu/ |
