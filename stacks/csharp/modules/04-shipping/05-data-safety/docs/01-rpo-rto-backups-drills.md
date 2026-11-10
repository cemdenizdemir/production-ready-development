---
title: RPO, RTO, Azure SQL backups, and restore drills
tech: Azure SQL Database automated backups, Azure CLI
version: Azure SQL Database (November 2026), Azure CLI 2.7x
date: 2026-11-09
covers: [1, 2, 3]
---
# RPO, RTO, Azure SQL backups, and restore drills
[← Overview](00-overview.md)

## Why it matters
- A bug deleted 4,000 order lines at 10:12. The team knew "Azure has backups", but nobody had ever restored one. Working out how took three hours while support answered angry customers.
- The restore worked, but it replaced nothing: a point-in-time restore creates a **new** database. Copying the missing rows back needed a script nobody had written.
- Backup retention was the default 7 days. The corruption was found on day 9, after the last good backup had expired.

## Concepts

### RPO and RTO
| Term | Question | Shop target (example) |
|:--|:--|:--|
| ⭐ RPO (recovery point objective) | how much data can we lose? | orders: ≤ 5 minutes |
| ⭐ RTO (recovery time objective) | how long until we're working again? | checkout: ≤ 1 hour |
| MTD | how long can the business survive the outage? | sets the upper bound for RTO |

Set them **per data set and scenario** with the business: losing analytics events for an hour is fine; losing paid orders isn't. They drive cost: lower RPO/RTO needs replication and standby capacity (lesson 03).

| Scenario | Typical recovery | RPO | RTO |
|:--|:--|:--|:--|
| bad `DELETE` / bad migration | point-in-time restore + copy data back | minutes | hours |
| deleted database | restore deleted database | minutes | hours |
| zone outage | zone redundancy (automatic) | 0 | minutes |
| region outage | failover group / geo-restore | seconds / ~1 h | ~1 h / hours |
| ransomware / malicious admin | restore from protected, older backups (LTR) | ≤ retention | hours–days |

### Azure SQL automated backups
| Item | Detail |
|:--|:--|
| ⭐ what | full (weekly), differential (every 12 or 24 h), transaction log (every ~10 min); automatic, no setup |
| ⭐ point-in-time restore (PITR) | any second within the retention window, 1–35 days (default 7) |
| ⭐ long-term retention (LTR) | weekly/monthly/yearly full backups kept up to 10 years |
| ⭐ restore creates a new database | on the same server (PITR) or any server (geo-restore); you then switch or copy data |
| deleted database restore | within the PITR retention of the deleted database |
| backup storage redundancy | LRS / ZRS / GRS (GZRS for Hyperscale); GRS needed for geo-restore |
| restore time | depends on size and log volume; measure it |
| immutable LTR | LTR backups can be made immutable (WORM) to protect against deletion |

### Restore drills
| Step | What to do |
|:--|:--|
| ⭐ schedule | monthly (or quarterly), on the calendar, owned by a person |
| ⭐ restore | PITR to a time 1 hour ago into `shop-drill-YYYYMMDD` |
| ⭐ verify the data | row counts, latest order time, checksums on key tables, the app starts against it |
| ⭐ measure | start → usable database = real RTO; compare with the target |
| practise the copy-back | script that copies selected rows (one customer's orders) from the restored DB |
| document | runbook updated with timings and surprises |
| clean up | delete the drill database (cost) |

## Example
`terminal` (configure retention, then a drill)
```bash
az sql db str-policy set -g rg-shop-prod-weu -s sql-shop-prod -n shop --retention-days 35 --diffbackup-hours 12
az sql db ltr-policy set -g rg-shop-prod-weu -s sql-shop-prod -n shop \
  --weekly-retention P8W --monthly-retention P12M --yearly-retention P7Y --week-of-year 1

# drill: restore to one hour ago into a new database
START=$(date -u +%s)
az sql db restore -g rg-shop-prod-weu -s sql-shop-prod -n shop \
  --dest-name "shop-drill-$(date -u +%Y%m%d)" \
  --time "$(date -u -d '-1 hour' +%Y-%m-%dT%H:%M:%SZ)" \
  --service-objective GP_Gen5_2
echo "restore took $(( $(date -u +%s) - START )) seconds"
```
`scripts/drill-verify.sql` (run against both databases and compare)
```sql
SELECT 'orders' AS t, COUNT_BIG(*) AS rows, MAX(PlacedAt) AS latest FROM ordering.Orders
UNION ALL SELECT 'order_lines', COUNT_BIG(*), NULL FROM ordering.OrderLines
UNION ALL SELECT 'payments', COUNT_BIG(*), MAX(CreatedAt) FROM payments.Payments;

SELECT CHECKSUM_AGG(BINARY_CHECKSUM(Id, Status, TotalMinor)) AS orders_checksum
FROM ordering.Orders WHERE PlacedAt < DATEADD(hour, -2, SYSUTCDATETIME());
```
Copying back one customer's deleted orders (both databases on the same logical server, elastic query or a small .NET tool):
```sql
-- run in a script that connects to the restored DB, reads the rows, and inserts them into production
-- inside a transaction, with IDENTITY_INSERT, after checking they don't exist
SET IDENTITY_INSERT ordering.Orders ON;
INSERT INTO ordering.Orders (Id, Number, CustomerId, Status, TotalMinor, Currency, PlacedAt)
SELECT Id, Number, CustomerId, Status, TotalMinor, Currency, PlacedAt FROM #restored_orders r
WHERE NOT EXISTS (SELECT 1 FROM ordering.Orders o WHERE o.Id = r.Id);
SET IDENTITY_INSERT ordering.Orders OFF;
```

## Production patterns
- RPO and RTO agreed per data set, written in the runbook, and reviewed yearly.
- PITR retention set to 35 days for production and LTR for legal and ransomware needs; backup storage redundancy chosen deliberately.
- Monthly restore drills with verification and measured RTO; the copy-back script exists before it's needed.
- Restores are a team skill: different people run the drill each time.

## Mistakes
Wrong: "Azure does backups, we're fine."
Right: retention configured, LTR where needed, and a drill that proves restore time and data quality.

Wrong: restoring over production in a panic.
Right: restore to a new database, verify, then copy back data or switch connection strings deliberately.

## Check yourself
1. What's the difference between RPO and RTO?
2. What does a point-in-time restore produce?
3. What should a restore drill check besides "it finished"?

<details><summary>Answers</summary>

1. RPO is the maximum acceptable data loss (how far back you may go); RTO is the maximum acceptable time to recover service.
2. A new database containing the data as of the chosen time; production is untouched until you copy data back or switch to it.
3. That the data is correct and recent (row counts, latest timestamps, checksums), that the app works against it, how long it took end to end (real RTO), and that the runbook steps were accurate.
</details>

## Sources
- [Automated backups in Azure SQL Database](https://learn.microsoft.com/azure/azure-sql/database/automated-backups-overview)
- [Point-in-time restore](https://learn.microsoft.com/azure/azure-sql/database/recovery-using-backups#point-in-time-restore)
- [Long-term retention](https://learn.microsoft.com/azure/azure-sql/database/long-term-retention-overview)
- [Change backup settings](https://learn.microsoft.com/azure/azure-sql/database/automated-backups-change-settings)
- [Azure Well-Architected — RPO and RTO](https://learn.microsoft.com/azure/well-architected/reliability/metrics)
