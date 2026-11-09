---
title: Reliability, data, observability, and operations review
tech: Express 5, PostgreSQL 18, Redis 8, AWS
version: AWS ECS, RDS, ElastiCache, AWS Backup; Pino, OpenTelemetry, Grafana, Sentry
date: 2026-11-07
covers: [3, 4, 5, 6]
---
# Reliability, data, observability, and operations review
[← Overview](00-overview.md)

## Why it matters
- The first real incident tests everything at once: health checks, rollbacks, alerts, runbooks, on-call, backups. Gaps compound.
- "We have backups" without a measured restore is the most common false sense of safety.
- Alerts that page nobody, or page everyone for noise, are equally useless.

## Reliability
| Check | How to verify |
|:--|:--|
| Timeouts on every outgoing call (Stripe, SES, carrier, DB pool, Redis) | code review; failure test with MSW `delay('infinite')` |
| Retries only for transient errors, with jitter and idempotency | tests for 503 vs 404 behavior |
| Health checks: shallow liveness, local readiness | `curl /health/live`, `/health/ready`; DB outage test doesn't restart tasks |
| Graceful shutdown under load | `docker stop` during a k6 run: zero failed requests |
| Degradation of optional features (recommendations, carrier rates) | `docker compose stop` the dependency: pages still work |
| Load shedding and rate limits | overload test returns 503/429 quickly |
| Circuit breaker on the carrier adapter | breaker opens in a fault test, fallback used |

## Data safety
| Check | How to verify |
|:--|:--|
| RDS automated backups, 14+ days, retained after deletion | `aws rds describe-db-instances` query below |
| Deletion protection and `prevent_destroy` | same query; Terraform code |
| Cross-account/region copy in a locked vault | AWS Backup console/CLI |
| Restore drill done, RTO measured | drill log in `docs/launch/readiness.md` |
| Migrations expand-only, `lock_timeout` set | migration review |
| Erasure log and replay after restore | script + test |
| Encryption at rest and verified TLS | RDS `StorageEncrypted`, app config |

## Observability
| Check | How to verify |
|:--|:--|
| Structured logs with trace IDs, no personal data | Loki query sample |
| Traces across web → API → worker → Stripe calls | one checkout trace in Tempo |
| Metrics: RED per route, queues, business (orders/min, payment success) | dashboards linked |
| Sentry with releases and source of truth for errors | a test error shows the release |
| SLOs: availability and latency for browse and checkout | SLO dashboard |
| Burn-rate alerts with runbook links | alert rules list, each with `runbook_url` |
| Alerts reach a human | test page acknowledged |

## Operations
| Check | How to verify |
|:--|:--|
| On-call rotation with escalation | schedule exists for launch weeks |
| Status page outside AWS | URL |
| Incident process: severities, roles, templates | `docs/runbooks/incident-process.md` |
| Runbooks for top alerts (checkout errors, DB overload, queue backlog, payment webhooks) | files exist and were rehearsed |
| Cost budgets and anomaly alerts | AWS Budgets configured |
| Game day before launch | notes and fixes from the exercise |

## Example
`scripts/readiness-aws.sh` — evidence for data-safety and platform settings.
```bash
#!/usr/bin/env bash
set -euo pipefail
aws rds describe-db-instances --db-instance-identifier roastery-prod --query 'DBInstances[0].{
  multiAZ: MultiAZ, encrypted: StorageEncrypted, deletionProtection: DeletionProtection,
  backupDays: BackupRetentionPeriod, latestRestorable: LatestRestorableTime}'

echo "Log groups without retention (should be empty):"
aws logs describe-log-groups --query 'logGroups[?!retentionInDays].logGroupName'

echo "ECS services without circuit breaker rollback (should be empty):"
aws ecs describe-services --cluster roastery-prod --services api web worker \
  --query 'services[?!deploymentConfiguration.deploymentCircuitBreaker.rollback].serviceName'

echo "Budgets:"
aws budgets describe-budgets --account-id "$(aws sts get-caller-identity --query Account --output text)" --query 'Budgets[].BudgetName'
```
A readiness record entry (`docs/launch/readiness.md`):
```markdown
| Item | Evidence | Owner | Date |
|---|---|---|---|
| Restore drill | ops/restore-drill.sh run #14: 42 min RTO, 2,318 orders, newest 3 min old | Dana | 2026-11-05 |
| Checkout SLO alert | alert `CheckoutBurnRateFast` → PagerDuty test page acked in 2 min | Sam | 2026-11-06 |
| Graceful shutdown | k6 100 req/s + rolling deploy: 0 errors (run link) | Lee | 2026-11-06 |
```

## Mistakes
Wrong: readiness claims without evidence ("alerts are set up"). Right: link the test page acknowledgment, the drill log, the trace.

Wrong: runbooks written but never used. Right: rehearse them in a game day before launch.

Wrong: launching without an on-call schedule for the first weeks. Right: named people, escalation, and status page access.

## Check yourself
1. What evidence proves graceful shutdown works?
2. Why must at least one test page be acknowledged before launch?
3. Which four runbooks are most likely to be needed in the first month?

<details>
<summary>Answers</summary>

1. A load test running while a rolling deploy (or `docker stop`) happens, showing zero failed requests and no 502s at the load balancer.
2. Alert rules can be correct but routed nowhere (wrong contact point, muted channel, expired integration). An acknowledged test page proves the whole path from alert to human works.
3. Checkout error rate or SLO burn, payment webhook failures/reconciliation mismatches, database overload or slow queries, and queue backlog (emails, saga steps); a security incident runbook is also required.
</details>

## Sources
- [Google SRE book — Reliable product launches at scale](https://sre.google/sre-book/reliable-product-launches/)
- [AWS Well-Architected — Reliability pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html)
- [Amazon RDS — Backing up and restoring](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.BackupRestore.html)
- [Google SRE workbook — Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
