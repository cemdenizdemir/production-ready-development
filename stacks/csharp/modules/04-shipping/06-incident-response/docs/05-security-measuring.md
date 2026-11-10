---
title: Security incidents and measuring improvement
tech: Microsoft Defender for Cloud, Microsoft Sentinel, Entra ID sign-in logs, Azure activity log, Application Insights
version: November 2026
date: 2026-11-09
covers: [11, 12]
---
# Security incidents and measuring improvement
[← Overview](00-overview.md)

## Why it matters
- After a leaked API key was used to read customer data, the team rotated the key and rebuilt the containers right away. The logs that showed what was accessed were gone, and the regulator asked questions nobody could answer.
- The breach was found on Monday; legal heard on Thursday. The 72-hour GDPR deadline had passed.
- "We had fewer incidents this quarter" turned out to mean fewer were declared; customers were finding problems before the team did.

## Concepts

### Security incidents are different
| Step | Practice |
|:--|:--|
| ⭐ declare and involve security and legal early | security incidents have legal clocks |
| ⭐ preserve evidence first | export activity logs, Entra sign-in and audit logs, App Insights/Log Analytics data, Key Vault and storage logs; snapshot disks if relevant; don't delete or rebuild yet |
| ⭐ contain | revoke sessions and tokens, rotate exposed secrets/keys, disable compromised accounts, block IPs/routes (WAF), isolate resources |
| eradicate | remove the attacker's access paths (backdoors, new role assignments, app registrations, federated credentials) |
| recover | restore clean versions; monitor closely for return |
| ⭐ restrict the channel | a private channel; need-to-know; assume the attacker may read normal channels |
| communicate | legal decides external wording; no speculation |

| Obligation | Deadline |
|:--|:--|
| ⭐ GDPR (Art. 33): notify the supervisory authority of a personal data breach | within **72 hours** of becoming aware (unless unlikely to risk people's rights) |
| GDPR (Art. 34): notify affected people | without undue delay when high risk |
| NIS2 (essential/important entities) | early warning within 24 h, notification within 72 h, final report within a month |
| PCI DSS (card data) | notify acquirer/card brands per contract |
| contracts | partners and B2B customers often have their own notice periods |

The 72 hours start when you become **aware**, not when you finish investigating: report what you know, then add details.

| Azure tool | Use |
|:--|:--|
| Microsoft Defender for Cloud | alerts on suspicious activity (storage, Key Vault, containers, SQL), secure score |
| Microsoft Sentinel | SIEM: correlate logs, hunting queries, automated responses |
| Entra ID sign-in and audit logs | who signed in from where; role and app changes |
| activity log | control-plane changes (new role assignments, keys listed, firewall changes) |
| Key Vault / Storage / SQL auditing | data-plane access |

### Measuring and improving
| Metric | Meaning | Target direction |
|:--|:--|:--|
| ⭐ MTTD (time to detect) | onset → alert/declaration | down |
| MTTA (time to acknowledge) | page → human ack | down |
| ⭐ MTTM (time to mitigate) | declaration → user impact stopped | down |
| MTTR (time to resolve) | onset → resolved | down |
| ⭐ customer-detected share | incidents first reported by customers ÷ all | down |
| incidents by severity per month | volume and trend | down (with honest declaring) |
| ⭐ action item follow-through | postmortem actions done by due date | up |
| repeat incidents | same contributing factor again | down |
| error budget spent | SLO view of reliability | within budget |
| pages per on-call shift | load | low and stable |

Averages hide variation: look at the distribution and at the worst incidents. Count near misses; a team that declares freely will show *more* low-severity incidents and fewer big ones.

## Example
Evidence preservation first (security incident runbook excerpt):
```bash
# export the last 14 days of control-plane activity for the subscription (read-only)
az monitor activity-log list --start-time "$(date -u -d '-14 days' +%Y-%m-%dT%H:%M:%SZ)" --max-events 50000 \
  -o json > evidence/activity-log-$(date -u +%Y%m%d%H%M).json
# role assignments as they are now (to diff later)
az role assignment list --all -o json > evidence/role-assignments-$(date -u +%Y%m%d%H%M).json
# then contain: rotate the leaked key and revoke sessions
az keyvault secret set --vault-name kv-shop-prod --name partner-api-key --value "$NEW_VALUE" > /dev/null
```
Store evidence in a locked-down storage container with immutability (WORM) and restricted access.

KQL: who used the leaked key (Key Vault audit logs in Log Analytics)?
```kusto
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.KEYVAULT" and OperationName == "SecretGet"
| where TimeGenerated > ago(14d) and id_s has "partner-api-key"
| project TimeGenerated, CallerIPAddress, identity_claim_oid_g, ResultSignature
| order by TimeGenerated asc
```
Incident metrics from a simple incidents table (one row per incident, filled from postmortems):
```sql
SELECT
  FORMAT(DeclaredAt, 'yyyy-MM') AS month,
  COUNT(*) AS incidents,
  AVG(DATEDIFF(minute, StartedAt, DetectedAt)) AS avg_mttd_min,
  AVG(DATEDIFF(minute, DeclaredAt, MitigatedAt)) AS avg_mttm_min,
  100.0 * SUM(CASE WHEN DetectedBy = 'customer' THEN 1 ELSE 0 END) / COUNT(*) AS customer_detected_pct
FROM ops.Incidents
WHERE Severity IN ('SEV1', 'SEV2')
GROUP BY FORMAT(DeclaredAt, 'yyyy-MM')
ORDER BY month;
```

## Production patterns
- A separate security incident runbook: involve security and legal immediately, preserve evidence before changing anything, contain, then eradicate and recover; private channels.
- Notification deadlines (GDPR 72 h, NIS2, contracts) known in advance, with prepared templates and a named decision-maker.
- Defender for Cloud and audit logs on; logs retained long enough for investigations and protected from tampering.
- Incident metrics reviewed monthly (detection, mitigation, customer-detected share, follow-through), with the worst incidents discussed, not just averages.

## Mistakes
Wrong: rotate everything and redeploy immediately, then try to investigate.
Right: export and secure logs and state first (minutes), then contain.

Wrong: waiting for full certainty before telling legal about a possible personal data breach.
Right: escalate as soon as you're aware; the regulator deadline starts then.

## Check yourself
1. Why preserve evidence before containing a security incident?
2. When does the GDPR 72-hour clock start?
3. Why can "fewer incidents" be a bad sign?

<details><summary>Answers</summary>

1. Containment actions (rotations, rebuilds, deletions) can destroy the logs and state that show how the attacker got in and what they accessed, which you need for eradication, legal notifications, and affected-user decisions. Exporting takes minutes.
2. When the organisation becomes aware of a personal data breach (has reasonable certainty one happened), not when the investigation is finished.
3. It may mean people aren't declaring incidents, or customers are finding problems first. Check the customer-detected share and near misses alongside the count.
</details>

## Sources
- [GDPR Article 33 — notification to the supervisory authority](https://gdpr-info.eu/art-33-gdpr/)
- [NIS2 Directive reporting obligations](https://digital-strategy.ec.europa.eu/en/policies/nis2-directive)
- [NIST SP 800-61 Rev. 3 — Incident response recommendations](https://csrc.nist.gov/pubs/sp/800/61/r3/final)
- [Microsoft Defender for Cloud](https://learn.microsoft.com/azure/defender-for-cloud/defender-for-cloud-introduction)
- [Microsoft Sentinel](https://learn.microsoft.com/azure/sentinel/overview)
- [Google SRE workbook — Incident response](https://sre.google/workbook/incident-response/)
