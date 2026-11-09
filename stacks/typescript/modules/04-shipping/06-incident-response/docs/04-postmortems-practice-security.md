---
title: Postmortems, practice, security incidents, and metrics
tech: Sentry, Grafana, OpenTelemetry
version: Blameless postmortems, game days and AWS Fault Injection Service, GDPR breach notification (Art. 33/34), incident metrics in Grafana
date: 2026-11-07
covers: [8, 10, 11, 12]
---
# Postmortems, practice, security incidents, and metrics
[← Overview](00-overview.md)

## Why it matters
- The postmortem concludes "human error: engineer ran the wrong command". Nothing changes, and three months later someone else runs the same command.
- The first time the team handles a SEV1 is the real SEV1. Nobody knows who the IC is or where the runbooks are.
- A leaked API key is "fixed" by rotating it, but nobody checks what it was used for, preserves logs, or considers whether customer data was exposed and must be reported.

## Concepts

### Blameless postmortems
| Principle | Meaning |
|:--|:--|
| Blameless | people acted reasonably with what they knew; ask how the system allowed the failure |
| For every SEV1/SEV2 | and for near misses worth learning from |
| Within a week | while memory is fresh |
| Facts first | timeline from the incident channel, alerts, deploys |
| Contributing factors | usually several, not a single root cause |
| Action items | specific, owned, dated, tracked like product work |
| Shared | published internally; patterns reviewed monthly |

| Section | Content |
|:--|:--|
| Summary | what happened, impact, duration |
| Impact | users affected, failed requests, revenue, data |
| Timeline | detection, declaration, mitigation, resolution (UTC) |
| Detection | how we found out; could we have known sooner? |
| Contributing factors | technical and process causes |
| What went well / poorly | response, tooling, communication |
| Action items | prevent, detect faster, mitigate faster; owner + due date |

### Practicing
| Exercise | What it trains |
|:--|:--|
| Tabletop | walk through a scenario on paper: roles, decisions, communication |
| Game day | inject a real failure in staging (or carefully in production) and respond |
| Fault injection | AWS FIS experiments: stop tasks, add latency, fail over RDS ([03-backend/08-reliability](../../../03-backend/08-reliability/docs/04-degradation-slos-failure-testing.md)) |
| Restore drills | backups ([05-data-safety](../../05-data-safety/README.md)) |
| New on-call shadowing | a shift alongside an experienced person first |

### Security incidents
| Difference | Practice |
|:--|:--|
| Involve security and legal early | they decide on notifications and evidence |
| Preserve evidence | don't wipe; keep CloudTrail, logs, snapshots; record what you do |
| Contain | revoke or rotate credentials, block access, isolate resources |
| Scope | what did the attacker access? CloudTrail, access logs, database audit |
| Eradicate and recover | remove persistence, patch, rebuild from known-good images |
| Notify | GDPR: supervisory authority within 72 hours of awareness for personal data breaches with risk; affected people when the risk is high; NIS2 has 24 h early warnings for covered entities |
| Communicate carefully | facts only; coordinated with legal |

### Measuring and improving
| Metric | Measures |
|:--|:--|
| Time to detect (TTD) | impact start → alert or report |
| Time to acknowledge | page → human on it |
| Time to mitigate / restore | detection → user impact stopped |
| Incidents per severity per month | trend |
| Detected by monitoring vs by customers | alert coverage |
| Action items completed on time | follow-through |
| Error budget burn by incident | which incidents cost the most reliability ([03-backend/08-reliability](../../../03-backend/08-reliability/README.md)) |

## Example
`docs/postmortems/2026-11-07-checkout-errors.md`
```markdown
# Postmortem: checkout errors after deploy (SEV2)

**Date:** 2026-11-07 · **Duration:** 14:02–14:45 UTC (43 min) · **Authors:** Dana, Sam · **Status:** action items in progress

## Summary
A refactor of the price calculation sent amounts in euros instead of cents to the payment adapter for orders
with discounts. Stripe rejected those requests; ~30% of checkout attempts failed. No customer was charged incorrectly.

## Impact
1,240 failed checkout attempts; estimated 310 lost orders; no data loss.

## Timeline (UTC)
- 14:02 deploy sha-3f2a1c9 to production
- 14:09 CheckoutErrorRateHigh alert fires (5xx > 5%)
- 14:12 incident declared, SEV2, Dana IC
- 14:31 failing traces show Stripe 400 "invalid amount" on discounted orders
- 14:38 rollback started · 14:45 error rate back to normal · 15:25 resolved

## Contributing factors
- Unit tests covered pricing without discounts only.
- The canary stage was skipped because "small change".
- The 5xx alert waited 5 minutes, then the team spent 19 minutes before rolling back.

## What went well / poorly
+ Alert fired within 7 minutes; deploy annotation made the suspect obvious.
− Rollback started 26 minutes after declaration; we looked for the cause first.

## Action items
| Action | Owner | Due |
|---|---|---|
| Property-based tests for pricing with discounts and currencies | Sam | 2026-11-14 |
| Money type that makes euros/cents mix-ups a type error | Lee | 2026-11-21 |
| Runbook: "deploy in last hour → roll back first" made explicit | Dana | 2026-11-10 |
| Canary required for checkout changes (pipeline rule) | Platform | 2026-11-28 |
```
Security incident first steps for a leaked AWS access key (checklist for the IC):
```text
1. Declare SEV1 security incident; add the security lead; private channel; no details in public channels.
2. Contain: deactivate the key (aws iam update-access-key --status Inactive …); do not delete it yet (evidence).
3. Scope: CloudTrail lookups for the key ID in all regions since its creation; list resources it created or read.
4. Preserve: export CloudTrail events and relevant logs to a locked bucket; snapshot affected resources.
5. Eradicate: delete resources the attacker created, rotate related secrets, remove the key from the source.
6. Assess data exposure with legal: personal data accessed? → GDPR 72-hour notification decision.
7. Postmortem: how did the key exist and leak? Replace with roles/OIDC so the class of incident disappears.
```

## Production patterns
- **Blameless postmortems within a week** for every SEV1/SEV2, with owned and dated action items tracked to completion.
- **Regular practice**: tabletops, game days, restore drills, shadow shifts for new on-call engineers.
- **A separate security incident path** with security and legal involved, evidence preserved, notification deadlines known.
- **Incident metrics reviewed monthly**: detection, mitigation times, customer-detected incidents, action item follow-through.
- **Fix classes of problems** (roles instead of keys, type-safe money), not just the instance.

## Mistakes
Wrong: "root cause: human error". It ends learning and makes people hide mistakes. Right: ask why the system made the error easy and the impact large.

Wrong: action items without owners or dates ("improve testing"). They never happen. Right: specific, owned, dated, tracked.

Wrong: wiping a compromised resource immediately. Evidence of what the attacker did is gone. Right: contain, preserve, then eradicate.

Wrong: never practicing. The first SEV1 is chaos. Right: tabletops and game days on a schedule.

## Check yourself
1. What makes a postmortem blameless, and why does it matter?
2. How does a security incident differ from an availability incident?
3. Which metrics show whether incident response is improving?

<details>
<summary>Answers</summary>

1. It assumes people acted reasonably with the information they had and looks for how tools, processes, and design allowed the failure. People then share what really happened, which reveals the real fixes; blame makes people hide details and the same failure returns.
2. Security and legal join early, evidence must be preserved before cleanup, the scope of attacker access must be investigated, communication is restricted, and legal notification deadlines (GDPR 72 hours, NIS2 where it applies) may apply.
3. Time to detect, acknowledge, and mitigate; the share of incidents found by monitoring instead of customers; incident counts by severity over time; and the share of postmortem action items completed on time.
</details>

## Sources
- [Google SRE book — Postmortem culture](https://sre.google/sre-book/postmortem-culture/)
- [Google SRE workbook — Postmortem culture: learning from failure](https://sre.google/workbook/postmortem-culture/)
- [PagerDuty — Postmortems](https://postmortems.pagerduty.com/)
- [GDPR — Article 33, notification of a personal data breach](https://gdpr-info.eu/art-33-gdpr/)
- [NIST SP 800-61 Rev. 3 — Incident response recommendations](https://csrc.nist.gov/pubs/sp/800/61/r3/final)
