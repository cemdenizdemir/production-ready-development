---
title: Data Safety cheatsheet
tech: PostgreSQL 18, AWS RDS backups, Drizzle Kit migrations, MongoDB Atlas backups
version: RDS automated backups and PITR, AWS Backup (vault lock, copies, restore testing), PostgreSQL 18, Drizzle Kit, MongoDB Atlas cloud backups
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Data Safety cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Targets
| Term | Meaning |
|:--|:--|
| ⭐ RPO | how much data you can lose |
| ⭐ RTO | how long recovery may take |
| Retention | how far back you can restore |
| ⭐ Rule | Multi-AZ and replicas are availability, not backups |

## Backup types
| Type | RPO | Note |
|:--|:--|:--|
| ⭐ RDS automated backups | ~5 min (PITR) | 1–35 days, restores to a new instance |
| Manual snapshot | snapshot time | before risky changes; kept until deleted |
| AWS Backup | plan schedule | vault lock, cross-account/region copies |
| `pg_dump` | dump time | single tables, version moves |
| Atlas continuous backup | minutes (PITR) | dedicated clusters |
| `mongodump` | dump time | logical copies |

## RDS backup settings
| Setting | Value |
|:--|:--|
| ⭐ `backup_retention_period` | 14–35 |
| `backup_window` | quiet hours (UTC) |
| ⭐ `delete_automated_backups = false` | keep backups after instance deletion |
| ⭐ `deletion_protection = true` | |
| ⭐ `skip_final_snapshot = false` + `final_snapshot_identifier` | |
| `copy_tags_to_snapshot = true` | traceability |

## Restore commands
| Command | Use |
|:--|:--|
| `aws rds describe-db-instances --query 'DBInstances[0].LatestRestorableTime'` | newest restorable second |
| ⭐ `aws rds restore-db-instance-to-point-in-time --restore-time …` | PITR to a new instance |
| `--use-latest-restorable-time` | newest possible |
| `aws rds restore-db-instance-from-db-snapshot` | from a snapshot |
| `aws rds wait db-instance-available` | block until ready |
| `aws rds create-db-snapshot` | manual snapshot |
| `aws rds copy-db-snapshot` | copy (region/account, re-encrypt) |

## pg_dump / pg_restore
| Command | Use |
|:--|:--|
| ⭐ `pg_dump --format=custom --file=x.dump "$URL"` | compressed logical backup |
| `pg_dump --table=orders --data-only` | one table's data |
| ⭐ `pg_restore --jobs=4 --no-owner --dbname="$URL" x.dump` | parallel restore |
| `pg_restore --list x.dump` | inspect contents |
| `pg_restore --table=orders` | selective restore |
| Version | pg_dump ≥ server major (18) |

## Restore drills
| Step | Detail |
|:--|:--|
| ⭐ Monthly, automated | CI job or AWS Backup restore testing |
| Restore to a temp instance | never production |
| ⭐ Checks | row counts, newest timestamp within RPO, smoke test |
| ⭐ Measure | actual RTO |
| Cleanup | `trap … delete-db-instance --skip-final-snapshot` |
| Alert | failed drill = incident |

## Copies and immutability
| Protection | Against |
|:--|:--|
| ⭐ Cross-account copies | compromised/deleted prod account |
| Cross-region copies | regional outage |
| ⭐ Vault lock (compliance mode) | early deletion by anyone |
| S3 Object Lock | deleted backup files |
| KMS key sharing | copies restorable in the target account |

## AWS Backup (Terraform)
| Resource | Use |
|:--|:--|
| `aws_backup_vault` | storage with a KMS key |
| `aws_backup_vault_lock_configuration` | `min/max_retention_days`, `changeable_for_days` |
| `aws_backup_plan` + `rule` + `copy_action` | schedule, lifecycle, copies |
| `aws_backup_selection` | which resources |

## DR strategies
| Strategy | RPO / RTO | Cost |
|:--|:--|:--|
| ⭐ Backup and restore | hours / hours | low |
| Pilot light | minutes / tens of minutes | medium |
| Warm standby | seconds–minutes / minutes | high |
| Active/active | ~0 / ~0 | highest |

## Locks and timeouts in migrations
| Setting | Use |
|:--|:--|
| ⭐ `SET lock_timeout = '5s'` | fail fast instead of blocking the lock queue |
| `SET statement_timeout` | cap long statements |
| Short transactions | release locks quickly |
| Retry in the pipeline | after a lock timeout |

## Dangerous operations
| Operation | Safe way |
|:--|:--|
| ⭐ `CREATE INDEX` | `CREATE INDEX CONCURRENTLY` (no transaction) |
| `DROP INDEX` | `DROP INDEX CONCURRENTLY` |
| ⭐ `SET NOT NULL` | `CHECK … NOT VALID` → `VALIDATE` → `SET NOT NULL` → drop check |
| ⭐ Add FK | `NOT VALID` → `VALIDATE CONSTRAINT` |
| `ALTER COLUMN TYPE` | new column + backfill + switch |
| ⭐ Rename / drop column | expand/contract across releases |
| Volatile default | add nullable, backfill, set default |
| ⭐ Big `UPDATE`/`DELETE` | batches with pauses |
| `VACUUM FULL` | avoid; pg_repack (also seen) |
| Constant-default `ADD COLUMN` | fine (metadata only) |

## Drizzle Kit workflow
| Step | Command / rule |
|:--|:--|
| ⭐ Generate | `drizzle-kit generate --name <change>` |
| Custom SQL | `drizzle-kit generate --custom --name <change>` |
| ⭐ Review | SQL in the PR |
| `CONCURRENTLY` | separate idempotent step (migrator uses a transaction) |
| Apply | pipeline migration task |
| ⭐ Never in prod | `drizzle-kit push` |
| Lint | squawk (also seen) |

## Backfills
| Practice | Detail |
|:--|:--|
| ⭐ Batches | 1,000–10,000 rows, `FOR UPDATE SKIP LOCKED` |
| Pauses | room for replication and vacuum |
| Resumable | `WHERE new_col IS NULL` |
| Separate job | not inside schema migrations |
| Invalid indexes | `SELECT … FROM pg_index WHERE NOT indisvalid` |

## Human-error guardrails
| Guardrail | Effect |
|:--|:--|
| ⭐ Deletion protection | AWS refuses deletes |
| ⭐ `prevent_destroy` | Terraform refuses |
| ⭐ SCP deny + break-glass exception | nobody else can delete |
| Read-only default access | fewer accidents |
| Reviewed data-fix scripts | no ad-hoc SQL in prod |
| Soft deletes (`deleted_at`) | undo for users and support |
| S3 versioning / Object Lock | recover files |

## Retention and erasure
| Topic | Practice |
|:--|:--|
| ⭐ Retention schedule | per data type, enforced by jobs |
| ⭐ Erasure (GDPR Art. 17) | delete/anonymize; keep legally required records without personal details |
| ⭐ Erasure log | stored outside the DB; reapply after restores |
| Backups | age out within retention |
| Legal hold | pause deletion |

## Encryption
| Layer | Practice |
|:--|:--|
| ⭐ RDS at rest | KMS, chosen at creation |
| ⭐ In transit | TLS `verify-full` + RDS CA bundle |
| S3 | SSE-S3 / SSE-KMS |
| ElastiCache | at rest + in transit |
| KMS | customer-managed keys, rotation, tight key policies |
| Field-level | extra-sensitive fields |

## Non-production data
| Option | Use |
|:--|:--|
| ⭐ Synthetic seeds | dev, CI |
| ⭐ Anonymized copy (inside prod controls) | staging, load tests |
| Raw prod copy | never outside prod |
| Tools | PostgreSQL Anonymizer (also seen) |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Multi-AZ as backup | bad writes replicate | PITR + copies |
| 1-day retention | slow corruption outlives backups | 14–35 days |
| Never restored | restores fail when needed | monthly drills |
| Backups only in the prod account | one compromise deletes all | cross-account + vault lock |
| Lost KMS access | copies unrestorable | shared key policies, tested |
| `CREATE INDEX` without `CONCURRENTLY` | writes blocked | concurrent build |
| No `lock_timeout` | lock queue outage | 5 s + retry |
| One huge backfill | lag, bloat, no pause | batches |
| `drizzle-kit push` in prod | no review, no history | generate + pipeline |
| Restore resurrects erased data | GDPR violation | erasure log replay |
| Raw dumps on laptops | breach | anonymize inside prod |

## Sources
| Source | Link |
|:--|:--|
| RDS point-in-time recovery | https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html |
| AWS Backup vault lock | https://docs.aws.amazon.com/aws-backup/latest/devguide/vault-lock.html |
| DR options on AWS | https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html |
| PostgreSQL ALTER TABLE | https://www.postgresql.org/docs/current/sql-altertable.html |
| PostgreSQL explicit locking | https://www.postgresql.org/docs/current/explicit-locking.html |
| Drizzle migrations | https://orm.drizzle.team/docs/migrations |
| MongoDB Atlas backups | https://www.mongodb.com/docs/atlas/backup/cloud-backup/overview/ |
