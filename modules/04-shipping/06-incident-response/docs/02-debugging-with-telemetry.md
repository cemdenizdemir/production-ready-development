---
title: Debugging production with telemetry
tech: Grafana, OpenTelemetry, Sentry, PostgreSQL 18
version: Grafana with Mimir (PromQL), Loki (LogQL), Tempo (TraceQL); Sentry; PostgreSQL 18 system views; AWS ECS
date: 2026-11-07
covers: [4, 9]
---
# Debugging production with telemetry
[← Overview](00-overview.md)

## Why it matters
- During an outage engineers SSH-hunt through logs on random tasks. The answer was on one dashboard: p99 latency of one database query jumped at 14:02.
- Everyone stares at CPU graphs while the real problem is a third-party API timing out, visible in traces in two clicks.
- The same "database is slow" incident happens three times a year, and each time the team rediscovers how to find blocking queries.

## Concepts

### The investigation path
| Step | Tool | Question |
|:--|:--|:--|
| 1. Scope | service dashboard, SLO panel | what's broken, for whom, since when? |
| 2. Change | deploy annotations, flag history, Sentry releases | did something change right before? |
| 3. Narrow | RED per route, dependency panels | which route, which dependency? |
| 4. Example | Tempo: slow or failing traces | where in the request does time or failure happen? |
| 5. Detail | Loki: logs for that trace ID | what exactly happened? |
| 6. Error | Sentry issue | stack trace, first seen, release, affected users |
| 7. Resource | DB views, queue metrics, ECS events | is something saturated or stuck? |

Use the **USE** method for resources (utilization, saturation, errors) and **RED** for services (rate, errors, duration). Compare with **last week at the same time** to separate anomalies from normal patterns.

### Common incident patterns and first moves
| Pattern | Signals | First moves |
|:--|:--|:--|
| Bad deploy | errors start right after a deploy annotation; new Sentry issue in the new release | roll back |
| Bad config or flag | change in flag/config history; errors on one feature | revert the change, flag off |
| Database overload | DB CPU high, slow queries, pool wait time up, `idle in transaction` sessions | kill runaway queries, shed load, roll back the query change, scale up |
| Lock contention | queries waiting on locks, one blocker | find the blocking PID, terminate it if safe |
| Dependency outage | client spans to one host failing or slow; provider status page | breaker/fallback, disable the feature, queue the work |
| Traffic spike / bots | request rate up, maybe one IP range or route | rate limits, WAF rules, scale out, load shedding |
| Memory leak | memory climbing, OOM kills (exit 137), restarts | restart/scale for relief, heap snapshots, roll back |
| Queue backlog | oldest job age rising, workers erroring or stalled | scale workers, fix failing jobs, pause producers |
| Expired certificate or DNS | TLS errors, sudden total failure for a domain | renew/fix, check automation |
| Disk or storage full | RDS `FreeStorageSpace` near 0, write errors | increase storage, find the growth (logs, bloat) |

## Example
PromQL (Mimir) — where are the errors and the latency?
```promql
# 5xx ratio per route, last 15 minutes
sum by (http_route) (rate(http_server_request_duration_seconds_count{job="api", http_response_status_code=~"5.."}[5m]))
  / sum by (http_route) (rate(http_server_request_duration_seconds_count{job="api"}[5m]))

# p99 of outgoing calls per peer: is a dependency slow?
histogram_quantile(0.99, sum by (le, server_address) (rate(http_client_request_duration_seconds_bucket{job="api"}[5m])))

# Same time last week, for comparison
sum(rate(http_server_request_duration_seconds_count{job="api"}[5m] offset 1w))
```
TraceQL (Tempo) and LogQL (Loki):
```traceql
{ resource.service.name = "api" && span.http.route = "/api/orders" && status = error }
{ resource.service.name = "api" && duration > 2s } | select(span.db.query.text)
```
```logql
{service_name="api"} | detected_level="error" | trace_id="4bf92f3577b34da6a3ce929d0e0e4736"
sum by (detected_level) (count_over_time({service_name="api"}[1m]))
```
PostgreSQL — what is running, waiting, and blocking right now:
```sql
-- Long-running and idle-in-transaction sessions
SELECT pid, usename, state, now() - xact_start AS xact_age, wait_event_type, wait_event, left(query, 80) AS query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY xact_age DESC NULLS LAST
LIMIT 20;

-- Who blocks whom
SELECT blocked.pid AS blocked_pid, left(blocked.query, 60) AS blocked_query,
       blocking.pid AS blocking_pid, left(blocking.query, 60) AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking ON blocking.pid = ANY (pg_blocking_pids(blocked.pid));

-- Relief, after agreeing in the incident channel
SELECT pg_cancel_backend(12345);      -- cancel the query
SELECT pg_terminate_backend(12345);   -- end the session if cancel isn't enough
```
ECS — why are tasks dying?
```bash
aws ecs describe-services --cluster shop-prod --services api --query 'services[0].events[:5].message'
aws ecs list-tasks --cluster shop-prod --service-name api --desired-status STOPPED --max-items 5
aws ecs describe-tasks --cluster shop-prod --tasks <task-arn> --query 'tasks[0].{stopped:stoppedReason,exit:containers[0].exitCode}'
```

## Production patterns
- **Start from dashboards and deploy annotations**, not from individual hosts.
- **Follow one bad request end to end**: trace → logs by trace ID → Sentry issue.
- **Compare with last week** before calling something abnormal.
- **Pattern-specific first moves** written down as runbooks ([lesson 03](03-communication-oncall-runbooks.md)).
- **Saved queries and dashboard links** in the runbooks, so nobody has to remember PromQL at 3 a.m.

## Mistakes
Wrong: jumping onto tasks with ECS Exec and grepping logs first. Slow, partial, and changes nothing. Right: dashboards, traces, and logs by trace ID across all tasks.

Wrong: chasing CPU when users see errors. Right: RED for the service first, then USE for the resources behind the failing part.

Wrong: terminating database sessions without telling anyone. A migration or a critical job gets killed. Right: announce in the channel, check what the session is, cancel before terminate.

Wrong: treating every symptom as new. Right: match it to the common patterns and use the known first moves.

## Check yourself
1. Describe the path from "error rate is up" to a specific line of code.
2. How do you find which query is blocking others in Postgres?
3. A deploy happened 3 minutes before the errors started. What do you do first?

<details>
<summary>Answers</summary>

1. The service dashboard shows which route's errors rose; TraceQL finds failing traces for that route; a trace shows which span failed; Loki shows that trace's logs; the linked Sentry issue gives the stack trace and the release where it first appeared.
2. Query `pg_stat_activity` joined with `pg_blocking_pids()` to see blocked and blocking PIDs and their queries; then decide with the team whether to cancel (`pg_cancel_backend`) or terminate (`pg_terminate_backend`) the blocker.
3. Roll it back (or turn off its flag), verify the errors drop, and investigate the change afterwards. A deploy right before the impact is the most likely cause, and a rollback is fast and low-risk.
</details>

## Sources
- [Grafana — Explore](https://grafana.com/docs/grafana/latest/explore/)
- [Grafana Tempo — TraceQL](https://grafana.com/docs/tempo/latest/traceql/)
- [Grafana Loki — LogQL](https://grafana.com/docs/loki/latest/query/)
- [PostgreSQL — Monitoring database activity](https://www.postgresql.org/docs/current/monitoring-stats.html)
- [Brendan Gregg — The USE method](https://www.brendangregg.com/usemethod.html)
