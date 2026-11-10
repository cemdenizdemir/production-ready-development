---
title: Exports, redundancy, and disaster recovery strategies
tech: SqlPackage (BACPAC), database copy, SQL Server 2025 native backups, Azure SQL failover groups, geo-restore
version: SqlPackage 170.x, SQL Server 2025, Azure SQL Database
date: 2026-11-09
covers: [5, 6, 9]
---
# Exports, redundancy, and disaster recovery strategies
[← Overview](00-overview.md)

## Why it matters
- A BACPAC export taken during business hours was "the backup" for a migration. It wasn't transactionally consistent: some orders referenced payments that weren't in the file.
- Backups were stored with local redundancy (LRS) to save money. A regional outage meant geo-restore wasn't available at all.
- The DR plan said "fail over to North Europe". Nobody had ever tried; the Container Apps, Key Vault, and DNS in the second region didn't exist.

## Concepts

### Exports and copies
| Tool | What it produces | Use | Watch out |
|:--|:--|:--|:--|
| ⭐ database copy | a transactionally consistent new database (same or other server) | pre-migration safety copy, test copy | full cost while it exists |
| ⭐ BACPAC (SqlPackage export) | schema + data in a file | move between Azure SQL and SQL Server, archiving | **not** consistent if writes happen: export from a copy |
| DACPAC (SqlPackage extract) | schema only | schema comparison, deployments (also seen: SQL projects) | |
| native `.bak` (`BACKUP DATABASE`) | full/diff/log backups | SQL Server 2025, Managed Instance; `TO URL` for Blob Storage | not available in Azure SQL Database |
| PITR restore | new database at a time | most recovery cases | lesson 01 |

### Redundancy layers
| Layer | Protects against | Azure SQL setting |
|:--|:--|:--|
| local replicas | hardware failure | built in (every tier) |
| ⭐ zone redundancy | data centre (zone) failure | zone-redundant database |
| ⭐ backup storage redundancy | losing backups with the region | LRS / ZRS / **GRS** (geo-restore needs GRS) |
| ⭐ geo-restore | region loss (RPO ~1 h, RTO hours) | restore geo-replicated backup in another region |
| ⭐ active geo-replication / failover groups | region loss (RPO ~seconds, RTO ~1 h policy) | readable secondary in a paired region; failover group listener names |
| LTR (immutable) | deletion, ransomware | lesson 01 |

Failover group endpoints: `fog-shop.database.windows.net` (read-write) and `fog-shop.secondary.database.windows.net` (read-only). Apps use the listener, so failover needs no connection string change. Customer-managed failover is the safe default (you decide), with an automatic grace period if you choose that policy.

### Disaster recovery strategies
| Strategy | What runs in the second region | RPO / RTO | Cost |
|:--|:--|:--|:--|
| ⭐ backup and restore | nothing; restore from geo-redundant backups and redeploy with IaC | hours / hours–day | lowest |
| pilot light | data replicated (failover group); compute defined in IaC, not running | seconds / ~1 h | low–medium |
| ⭐ warm standby | scaled-down full stack running; scale up on failover | seconds / minutes | medium |
| active/active | full stack in both regions serving traffic | ~0 / ~0 | highest; hardest (writes) |

The shop starts with **backup and restore** for non-critical data and **pilot light** for orders: a failover group for SQL, IaC that deploys Container Apps in the second region, Front Door ready to switch origins. Whatever you pick, the plan includes DNS/Front Door, secrets (Key Vault per region), storage (GRS or replication), and messaging, not just the database.

## Example
`terminal` (safety copy before a risky migration, then a consistent BACPAC from it)
```bash
az sql db copy -g rg-shop-prod-weu -s sql-shop-prod -n shop --dest-name shop-premigration-20261109
sqlpackage /Action:Export \
  /SourceConnectionString:"Server=tcp:sql-shop-prod.database.windows.net;Database=shop-premigration-20261109;Authentication=Active Directory Default;Encrypt=True" \
  /TargetFile:./shop-20261109.bacpac
```
Failover group (Bicep excerpt):
```bicep
resource fog 'Microsoft.Sql/servers/failoverGroups@2023-08-01' = {
  parent: sqlPrimary
  name: 'fog-shop'
  properties: {
    partnerServers: [ { id: sqlSecondary.id } ]
    databases: [ shopDb.id ]
    readWriteEndpoint: { failoverPolicy: 'Manual' }
    readOnlyEndpoint: { failoverPolicy: 'Disabled' }
  }
}
```
Planned failover drill (no data loss) and failback:
```bash
az sql failover-group set-primary -g rg-shop-dr-neu -s sql-shop-dr -n fog-shop      # run against the secondary
# verify the app through the listener, then fail back the same way from the original primary's server
```
SQL Server 2025 self-hosted (for example a partner's on-premises copy): backup to Blob Storage
```sql
CREATE CREDENTIAL [https://stshopbackups.blob.core.windows.net/sql]
  WITH IDENTITY = 'SHARED ACCESS SIGNATURE', SECRET = '<sas-token-without-leading-question-mark>';
BACKUP DATABASE shop TO URL = 'https://stshopbackups.blob.core.windows.net/sql/shop-20261109.bak'
  WITH COMPRESSION, CHECKSUM, FORMAT;
RESTORE VERIFYONLY FROM URL = 'https://stshopbackups.blob.core.windows.net/sql/shop-20261109.bak';
```
The SAS comes from Key Vault at run time and is never committed.

## Production patterns
- A database copy before risky migrations; BACPACs only from a copy, for portability and archives, not as the primary backup.
- Zone redundancy for production databases; geo-redundant backup storage; a failover group for data with a seconds-level RPO.
- A written DR strategy per component (data, compute, secrets, storage, DNS) matching the agreed RPO/RTO, deployable from IaC in the second region.
- DR is tested: planned failovers at least yearly, with failback, timings, and runbook updates.

## Mistakes
Wrong: BACPAC export of the live production database as "the backup".
Right: automated backups for recovery; BACPAC from a copy when you need a file.

Wrong: a DR plan that only covers the database.
Right: compute, secrets, storage, messaging, DNS/Front Door, and the steps to switch them, all rehearsed.

## Check yourself
1. Why export a BACPAC from a database copy?
2. What's the difference between geo-restore and a failover group?
3. What does a pilot-light DR setup keep running?

<details><summary>Answers</summary>

1. BACPAC export isn't transactionally consistent; rows written during the export can produce a file with broken relationships. A database copy is consistent, so exporting from it gives a consistent file.
2. Geo-restore creates a database in another region from geo-replicated backups (RPO about an hour, RTO hours). A failover group continuously replicates to a readable secondary and switches the listener on failover (RPO seconds, RTO about an hour or less).
3. The data layer (replicated databases and storage), while compute is defined in IaC but not running (or scaled to zero) until a failover.
</details>

## Sources
- [Copy a database](https://learn.microsoft.com/azure/azure-sql/database/database-copy)
- [SqlPackage Export](https://learn.microsoft.com/sql/tools/sqlpackage/sqlpackage-export)
- [Failover groups](https://learn.microsoft.com/azure/azure-sql/database/failover-group-sql-db)
- [Geo-restore](https://learn.microsoft.com/azure/azure-sql/database/recovery-using-backups#geo-restore)
- [SQL Server backup to URL](https://learn.microsoft.com/sql/relational-databases/backup-restore/sql-server-backup-to-url)
- [Disaster recovery strategies (Well-Architected)](https://learn.microsoft.com/azure/well-architected/reliability/disaster-recovery)
