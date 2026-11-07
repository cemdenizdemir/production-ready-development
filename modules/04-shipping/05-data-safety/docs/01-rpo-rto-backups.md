---
title: RPO, RTO, and backups
tech: AWS RDS, PostgreSQL 18, MongoDB Atlas
version: RDS automated backups and snapshots, pg_dump/pg_restore 18, MongoDB Atlas cloud backups
date: 2026-11-07
covers: [1, 2, 5, 9]
---
# RPO, RTO, and backups
[← Overview](00-overview.md)

## Why it matters
- A script deletes 40,000 orders at 09:41. The team has nightly `pg_dump` files only, so the best they can do is restore last night's data and lose a morning of orders.
- Backup retention was set to 1 day. A data corruption bug is discovered on Monday, after it started on Friday: every backup already contains the bad data.
- The production RDS instance is deleted while tearing down "an old environment". Its automated backups are deleted with it.

## Concepts

### RPO and RTO
| Term | Question | Example target |
|:--|:--|:--|
| RPO (recovery point objective) | how much data can we lose? | 5 minutes |
| RTO (recovery time objective) | how long can we be down? | 1 hour |
| Retention | how far back can we go? | 14–35 days |

Set them per data store with the business: orders and payments usually need minutes; analytics can lose a day. The targets decide the tooling and the cost.

### Backup types
| Type | RPO | Restore | Use |
|:--|:--|:--|:--|
| **RDS automated backups** (daily snapshot + transaction logs) | ~5 min (point-in-time) | new instance, to any second in the window | the main safety net |
| Manual snapshots | at snapshot time | new instance | before risky changes, long-term copies |
| AWS Backup recovery points | per plan schedule | new instance | central policy, vault lock, cross-account copies |
| `pg_dump` (logical) | at dump time | into any Postgres (also other versions) | single tables, migrations between versions, small databases |
| Multi-AZ standby | 0 for hardware failure | automatic failover | **availability, not backup**: replicates deletes too |
| Read replica | seconds | promote | availability, also replicates deletes |

### RDS automated backups
| Fact | Implication |
|:--|:--|
| Retention 1–35 days | choose at least 7, usually 14–35 for production |
| PITR to any second, up to `LatestRestorableTime` | typically about 5 minutes behind now |
| Restores create a **new** instance | plan for new endpoints, then switch the app or copy data back |
| Deleted with the instance unless retained | enable "retain automated backups", take a final snapshot, keep deletion protection on |
| Encrypted with the instance's KMS key | key access is needed to restore |

### Logical backups with pg_dump
| Command | Use |
|:--|:--|
| `pg_dump --format=custom` | compressed, selective restores |
| `pg_restore --jobs=4` | parallel restore |
| `pg_restore --table=orders` | restore one table |
| `--no-owner --no-privileges` | restore into a different setup |
| Same or newer `pg_dump` major version as the server | pg_dump 18 for PostgreSQL 18 |

### MongoDB Atlas backups
| Feature | Detail |
|:--|:--|
| Cloud backups | scheduled snapshots with retention policies |
| Continuous cloud backup | point-in-time restore within a window |
| Restore targets | the same or another cluster |
| Backup compliance policy | prevents disabling or shortening backups |
| `mongodump` / `mongorestore` | logical copies of collections |

## Example
Backup settings on the instance (from [02-cloud lesson 03](../../02-cloud/docs/03-managed-data.md)):
```hcl
resource "aws_db_instance" "main" {
  # …
  backup_retention_period   = 14                       # PITR window in days (max 35)
  backup_window             = "02:00-02:30"            # UTC, before the maintenance window
  copy_tags_to_snapshot     = true
  delete_automated_backups  = false                    # keep them if the instance is deleted
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "shop-prod-final"
}
```
Point-in-time restore to just before the bad `DELETE`:
```bash
aws rds describe-db-instances --db-instance-identifier shop-prod \
  --query 'DBInstances[0].LatestRestorableTime'

aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier shop-prod \
  --target-db-instance-identifier shop-prod-restore-0940 \
  --restore-time 2026-11-07T09:40:00Z \
  --db-subnet-group-name shop-prod-db \
  --vpc-security-group-ids sg-0db1234 \
  --db-parameter-group-name shop-pg18 \
  --no-publicly-accessible

aws rds wait db-instance-available --db-instance-identifier shop-prod-restore-0940
```
Copying back only the lost rows from the restored instance (often better than switching the whole database):
```bash
pg_dump --format=custom --table=orders --data-only \
  --file=orders-0940.dump "postgres://migrator@shop-prod-restore-0940…/shop?sslmode=require"
pg_restore --list orders-0940.dump | head                       # inspect before touching production
# load into a staging table in production, then INSERT … SELECT the missing rows inside a transaction
```
A manual snapshot before a risky operation:
```bash
aws rds create-db-snapshot --db-instance-identifier shop-prod \
  --db-snapshot-identifier shop-prod-before-orders-split-2026-11-07
```
Atlas logical export of one collection:
```bash
mongodump --uri "$ATLAS_URI" --db shop --collection product_reviews --archive=reviews.archive.gz --gzip
```

## Production patterns
- **RPO and RTO written down per data store**, agreed with the business, checked against the tooling.
- **Automated backups with 14–35 days of retention**, retained after deletion, plus deletion protection and final snapshots.
- **Snapshots before risky changes** (big migrations, data fixes, major upgrades).
- **`pg_dump` as a complement** for targeted restores and version moves, not as the only backup.
- **Atlas continuous backups** on production clusters, with a compliance policy.

## Mistakes
Wrong: treating Multi-AZ or replicas as backups. A `DROP TABLE` reaches them in milliseconds. Right: point-in-time backups plus copies.

Wrong: a one-day retention window. Slow-burning corruption is found after the good backups have expired. Right: 14–35 days, longer copies in AWS Backup.

Wrong: restoring over the production instance in a panic. RDS restores to a new instance; rushing to switch endpoints can lose the writes made since. Right: restore beside it, compare, copy back what's missing (or switch deliberately).

Wrong: deleting an instance with `skip_final_snapshot = true` and automated backups not retained. Right: final snapshot, retained backups, deletion protection.

## Check yourself
1. What's the difference between RPO and RTO, and which tool mainly decides each?
2. Why isn't Multi-AZ a backup?
3. Why is copying back the lost rows often better than switching to the restored instance?

<details>
<summary>Answers</summary>

1. RPO is how much data you can lose (decided by how often backups or logs are captured: PITR gives about 5 minutes); RTO is how long recovery may take (decided by restore speed, size, automation, and practice).
2. The standby receives every change synchronously, including bad deletes, broken migrations, and corruption from bugs. It protects against hardware and AZ failure, not against bad writes.
3. Production kept receiving valid writes after the incident. Switching to a copy restored to 09:40 would lose those; copying only the missing rows back keeps both. Switching is right when the whole database is unusable.
</details>

## Sources
- [Amazon RDS — Point-in-time recovery](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html)
- [Amazon RDS — Automated backups](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html)
- [PostgreSQL — pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL — pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)
- [MongoDB Atlas — Continuous cloud backups](https://www.mongodb.com/docs/atlas/backup/cloud-backup/overview/)
