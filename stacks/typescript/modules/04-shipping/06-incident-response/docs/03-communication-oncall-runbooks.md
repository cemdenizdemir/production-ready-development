---
title: Communication, on-call, and runbooks
tech: Grafana, Sentry
version: Grafana Alerting (contact points, notification policies), a paging tool (Grafana Cloud IRM, PagerDuty, incident.io), a hosted status page
date: 2026-11-07
covers: [5, 6, 7]
---
# Communication, on-call, and runbooks
[← Overview](00-overview.md)

## Why it matters
- Customers learn about the outage on social media. The status page still says "All systems operational" two hours in.
- One engineer has been on call for six weeks straight and gets paged twelve times a night by flapping alerts. They quit; the next on-call misses a real outage.
- An alert fires at 3 a.m.: "HighErrorRate". No link, no context, no steps. The on-call spends 40 minutes figuring out what the alert even measures.

## Concepts

### Communication
| Audience | Channel | Cadence |
|:--|:--|:--|
| Responders | incident channel | continuous |
| Company (support, sales, leadership) | `#incidents` summary | every 30 min for SEV1, 60 min for SEV2 |
| Customers | status page, in-app banner, email for big incidents | first update within 15–30 min, then on schedule |
| Affected key accounts | account managers, direct email | as agreed |

| Good update | Avoid |
|:--|:--|
| what users experience, in plain words | internal jargon, guesses about causes |
| what you're doing | blame |
| when the next update comes | going silent |
| clear "resolved" with the time window | "should be fine now" |

The status page should be **hosted outside your infrastructure** (also seen: Atlassian Statuspage, Instatus, Better Stack), so it works when you don't.

### On-call
| Practice | Detail |
|:--|:--|
| Rotation | weekly, primary + secondary, handover notes |
| Load | small enough to sleep: review if pages exceed ~2 per shift |
| Escalation | primary → secondary → engineering manager, with timeouts |
| Alert quality | every page actionable and urgent; others become tickets |
| Compensation and time off | after night pages; on-call is work |
| Readiness | laptop, access, VPN/SSO tested; runbooks known |
| Tools | Grafana Cloud IRM, PagerDuty, incident.io (also seen): schedules, escalations, acknowledgements |
| Ownership | services have owning teams; teams carry their own pager |

### Runbooks
| Part | Content |
|:--|:--|
| Title and alert | which alert links here |
| Meaning | what the alert measures and why it matters |
| Impact | what users experience |
| Triage | dashboards and queries to check first (links) |
| Mitigations | step-by-step, safest first, with commands |
| Escalation | who to call and when |
| Verification | how to know it's fixed |
| History | links to past incidents |

Runbooks live **next to the code** (`docs/runbooks/`), are linked from every paging alert (`runbook_url`), and get updated after every incident that used them.

## Example
Status page updates for a SEV2:
```text
[14:20 UTC] Investigating — Some customers can't complete checkout. We're investigating and will update by 14:50.
[14:38 UTC] Identified — A change deployed at 14:02 caused payment errors. We're reverting it. Next update by 15:00.
[14:52 UTC] Monitoring — The change has been reverted and checkouts are succeeding again. We're monitoring.
[15:25 UTC] Resolved — Between 14:02 and 14:45 UTC, about 30% of checkout attempts failed. Customers were not charged
            for failed attempts. We'll publish a summary of what happened and how we'll prevent it.
```
`docs/runbooks/checkout-error-rate.md` — linked from the alert.
```markdown
# Checkout error rate high

**Alert:** `CheckoutErrorRateHigh` (5xx ratio on POST /api/orders > 5% for 5 min) · **Owner:** checkout team · **Severity:** SEV2 by default

## What it means
Customers are failing to place orders. Every minute costs revenue.

## Triage (first 5 minutes)
1. Service dashboard → "Checkout" row: <https://grafana.shop.com/d/shop-api?viewPanel=checkout>
2. Deploy annotations in the last hour? Flag changes? (`#deploys`, flag admin)
3. Failing traces: Tempo query `{ span.http.route = "/api/orders" && status = error }`
4. Stripe status: <https://status.stripe.com> · Sentry: new issues in the latest release

## Mitigations (safest first)
1. Deploy in the last hour → roll back: `aws ecs update-service --cluster shop-prod --service api --task-definition <previous>`
2. New checkout flag on → turn off `newCheckout` in the flag admin
3. Stripe errors/timeouts → enable "payments degraded" banner; orders are retried by the worker
4. Database saturation → see `database-overload.md`

## Escalate
After 15 minutes without improvement: page the checkout secondary; SEV1 if error rate > 50%.

## Verify
5xx ratio < 1% for 15 minutes and orders/min back near last week's level.
```
Alert routing (Grafana Alerting notification policy, provisioning YAML excerpt):
```yaml
apiVersion: 1
policies:
  - orgId: 1
    receiver: team-chat
    group_by: [alertname, service]
    routes:
      - receiver: checkout-pager
        object_matchers:
          - [severity, =, page]
          - [team, =, checkout]
        group_wait: 30s
        repeat_interval: 1h
      - receiver: checkout-tickets
        object_matchers:
          - [severity, =, ticket]
          - [team, =, checkout]
```

## Production patterns
- **Scheduled, plain-language updates** for responders, the company, and customers, from a status page outside your infrastructure.
- **Humane on-call**: weekly rotations, secondaries, escalations, time off after nights, page volume reviewed.
- **Only actionable, urgent alerts page**; everything else becomes a ticket.
- **A runbook for every paging alert**, versioned with the code and linked via `runbook_url`.
- **Runbooks improved after each incident** that used (or lacked) them.

## Mistakes
Wrong: silence until the fix. Customers assume the worst and support drowns. Right: an update within 15–30 minutes, then on schedule.

Wrong: a status page hosted on the same infrastructure that's down. Right: a hosted third-party status page.

Wrong: paging for things that can wait until morning. Alert fatigue makes people miss real pages. Right: severity labels and routing; review noisy alerts weekly.

Wrong: runbooks in a wiki nobody updates. They describe a system that no longer exists. Right: in the repository, changed in the same PRs as the system.

## Check yourself
1. What should every customer-facing incident update contain?
2. What makes an on-call rotation sustainable?
3. What belongs in a runbook, and where should it live?

<details>
<summary>Answers</summary>

1. What users are experiencing in plain language, what you're doing about it, and when the next update will come; at the end, a clear resolved message with the impact window.
2. Enough people to rotate weekly with a secondary, clear escalation, few and actionable pages (reviewed regularly), compensation or time off after night pages, and working access and runbooks before the shift starts.
3. What the alert means and its impact, triage steps with dashboard and query links, mitigations from safest to riskiest with commands, escalation contacts, and how to verify the fix. It lives in the repository next to the code and is linked from the alert.
</details>

## Sources
- [Google SRE book — Being on-call](https://sre.google/sre-book/being-on-call/)
- [PagerDuty — Incident communication](https://response.pagerduty.com/during/external_communication_guidelines/)
- [Atlassian — Incident communication templates](https://www.atlassian.com/incident-management/incident-communication/templates)
- [Grafana — Notification policies](https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/notification-policies/)
- [Google SRE workbook — On-call](https://sre.google/workbook/on-call/)
