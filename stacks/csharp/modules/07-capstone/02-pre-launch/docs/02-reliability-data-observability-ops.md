---
title: Reliability, data safety, observability, and operations
tech: ASP.NET Core 10, Microsoft.Extensions.Http.Resilience, Azure SQL, Azure Monitor, Application Insights, Sentry
version: .NET 10, Azure (November 2026)
date: 2026-11-10
covers: [3, 4, 5, 6]
---
# Reliability, data safety, observability, and operations
[← Overview](00-overview.md)

## Why it matters
- On launch day the payment provider will have a slow minute, a deploy will happen, and a replica will restart. Whether customers notice depends on timeouts, retries, probes, and graceful shutdown.
- The first data incident (a bad migration, a wrong refund script) is survivable only with backups you've actually restored.
- Without SLOs, dashboards, and alerts with runbooks, the team learns about problems from customers, and nobody knows what to do first.

## Reliability
| Item | Check | Evidence |
|:--|:--|:--|
| ⭐ timeouts | request timeouts on the API; total/attempt timeouts on Stripe, carrier, ACS clients; SQL command timeout; Redis timeouts | config + chaos test |
| ⭐ safe retries | resilience handlers with `DisableForUnsafeHttpMethods()` or idempotency keys; one retry layer | code review |
| circuit breakers | on partner clients; fallback paths (flat-rate shipping, "payments temporarily unavailable") | test |
| ⭐ health checks | `/health/live` (no deps), `/health/ready` (SQL, critical config), startup probe | probe config |
| ⭐ graceful shutdown | readiness flips on SIGTERM, drain delay, `ShutdownTimeout` < grace period; zero errors during a deploy under load | k6 run during deploy |
| degradation | Redis down → app still serves (fail open); search down → category browse works | chaos test |
| load shedding | global concurrency limiter → 503 + `Retry-After`; rate limits on login, coupon, checkout | k6 stress run |
| min replicas | ≥ 2 for web and API in production | Bicep |

## Data safety
| Item | Check | Evidence |
|:--|:--|:--|
| ⭐ PITR | 35-day retention; backup storage redundancy chosen (ZRS/GRS) | `az sql db str-policy show` |
| LTR | weekly/monthly/yearly per legal needs | policy |
| ⭐ deletion protection | `CanNotDelete` locks on SQL, storage, Key Vault; stack deny settings; Key Vault purge protection; blob soft delete + versioning | Bicep, portal |
| locked copies | immutable LTR or a locked copy for ransomware scenarios | policy |
| ⭐ restore drill | restore to a new DB, verify counts/checksums, app works against it; measured RTO ≤ 1 h | drill notes |
| migrations | expand/contract; lock timeouts; online indexes; migration job tested in staging | PR history |
| failover | failover group (or documented geo-restore plan) matching RPO 5 min / RTO 1 h | ADR + drill |

## Observability
| Item | Check | Evidence |
|:--|:--|:--|
| ⭐ logs | structured `ILogger` with `[LoggerMessage]`; trace IDs; no PII/secrets; levels tuned | log samples |
| ⭐ traces | OpenTelemetry for ASP.NET Core, HttpClient, SQL, Redis, Azure SDKs; browser → API trace propagation | end-to-end trace screenshot |
| metrics | RED per route; business metrics (`roastery.orders.placed`, payment success rate, reservation expiries) | dashboard |
| ⭐ error tracking | App Insights exceptions by version; Sentry for the web app with source maps and releases | issue list |
| ⭐ SLOs | browse and checkout availability + latency SLOs; error budget policy | SLO doc |
| ⭐ alerts | burn-rate alerts (14.4× / 6×) for checkout and browse; DLQ > 0; outbox lag; reconciliation mismatches; certificate/secret expiry; each with a runbook link | alert rules |
| dashboards | service overview, dependencies, business, release (as code) | links |
| sampling and cost | explicit `TracesPerSecond`; Log Analytics daily cap alert; retention set | config |

## Operations
| Item | Check | Evidence |
|:--|:--|:--|
| ⭐ on-call | rotation with secondary, escalation, paging tool wired to action groups, test page acknowledged | rota + test |
| ⭐ status page | hosted outside Azure Container Apps; templates ready | link |
| incident process | severities, roles, channel naming, comms cadence | runbook |
| ⭐ runbooks | checkout errors, payment provider down, SQL saturation, Redis down, queue backlog, rollback, restore; each tested in a game day | runbook links + game-day notes |
| cost | budgets with forecast alerts per subscription; tags; expected monthly cost documented | budget |
| support | support team briefed: common issues, refunds process, escalation path | briefing notes |

## Example
Game-day plan before launch (`docs/game-days/pre-launch.md`):
```text
1. Deploy a new revision during a k6 run at 50 req/s → expect 0 failed requests (graceful shutdown).
2. Stop Redis in staging for 10 min → expect p95 < 600 ms, error rate < 0.5%, alert "cache unavailable" (ticket, not page).
3. Point Stripe client at a WireMock returning 503 → expect breaker opens, checkout shows "payments temporarily unavailable", carts kept, fast-burn alert pages on-call, runbook followed.
4. Restore production backup to staging-restore-<date> → measure RTO, run verification queries.
5. Inject 2 s latency into carrier API → expect shipment job retries, no user impact.
Record: detection time, mitigation time, runbook gaps → tickets.
```
Checkout SLO definition (excerpt):
```markdown
SLI: share of POST /checkout requests that succeed (non-5xx) in under 800 ms, measured at Front Door.
SLO: 99.9% over 30 days (≈ 43 min of budget).
Alerts: 14.4× burn over 1 h and 5 min → page; 6× over 6 h and 30 min → page; 1× over 3 days → ticket.
Policy: budget exhausted → pause feature launches; top two incident causes fixed first.
```

## Mistakes
Wrong: "Azure does backups" without a drill.
Right: a restore drill with measured RTO and verified data before launch.

Wrong: alerts on CPU and memory only.
Right: SLO burn-rate alerts on user journeys, plus specific alerts (DLQ, outbox lag, reconciliation), each with a runbook.

## Check yourself
1. How do you prove graceful shutdown works?
2. What must a restore drill measure and verify?
3. Which alerts should page on launch day, and which should be tickets?

<details><summary>Answers</summary>

1. Run a load test (k6) and deploy a new revision during it; zero failed requests (and no connection resets) shows readiness flipping, draining, and shutdown timeouts work together.
2. The real time from start to a usable database (RTO vs target), and data correctness: row counts, latest timestamps, checksums on key tables, and the app working against the restored database.
3. Page: SLO fast-burn alerts for checkout and browse, payment failures or reconciliation mismatches, DLQ growth on critical queues. Tickets: slow burns, cache unavailability with graceful degradation, cost and capacity warnings.
</details>

## Sources
- [03-backend/08-reliability](../../../03-backend/08-reliability/README.md)
- [03-backend/10-observability](../../../03-backend/10-observability/README.md)
- [04-shipping/05-data-safety](../../../04-shipping/05-data-safety/README.md)
- [04-shipping/06-incident-response](../../../04-shipping/06-incident-response/README.md)
- [Google SRE workbook — Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
- [Azure SQL automated backups](https://learn.microsoft.com/azure/azure-sql/database/automated-backups-overview)
