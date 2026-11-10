---
title: Data Safety cheatsheet
tech: Azure SQL backups, SQL Server 2025, EF Core migrations
version: Azure SQL Database (November 2026), SQL Server 2025, EF Core 10, SqlPackage 170.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Data Safety cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Objectives
| Term | Means | Note |
|:--|:--|:--|
| ⭐ RPO | max data loss | per data set |
| ⭐ RTO | max time to recover | measured in drills |
| MTD | max tolerable downtime | business limit |
| per scenario | bad delete, zone, region, ransomware | different answers |

## Azure SQL backups
| Item | Detail | Note |
|:--|:--|:--|
| full / diff / log | weekly / 12–24 h / ~10 min | automatic |
| ⭐ PITR retention | 1–35 days | default 7 |
| ⭐ LTR | weekly/monthly/yearly up to 10 years | immutable option |
| ⭐ restore = new database | switch or copy back | |
| deleted DB restore | within retention | |
| ⭐ backup storage redundancy | LRS / ZRS / GRS | GRS for geo-restore |
| `az sql db str-policy set --retention-days 35` | PITR retention | |
| `az sql db ltr-policy set --weekly-retention P8W ...` | LTR | ISO 8601 |
| `az sql db restore --time ... --dest-name ...` | PITR | |

## Restore drills
| Step | Check | Note |
|:--|:--|:--|
| ⭐ schedule | monthly/quarterly | owner |
| ⭐ restore | to a new DB | |
| ⭐ verify | counts, latest timestamps, checksums | app works |
| ⭐ measure | real RTO | vs target |
| copy-back script | selected rows | ready before needed |
| rotate people | team skill | |
| clean up | delete drill DB | cost |

## Migration risk
| Change | Risk | Safe way |
|:--|:--|:--|
| add nullable column | none | |
| ⭐ NOT NULL + constant default | metadata-only (Azure SQL/Enterprise) | no `NEWID()` defaults |
| ⭐ create index | table lock | `ONLINE = ON, RESUMABLE = ON` |
| change type/length | rewrite under lock | new column + backfill |
| rename | breaks old code | expand/contract |
| drop column | no rollback | contract step only |
| ⭐ add FK/CHECK | full scan | `WITH NOCHECK`, validate later |
| ⭐ big UPDATE/DELETE | log, locks | batches |

## Migration guards
| Guard | How | Note |
|:--|:--|:--|
| ⭐ `SET LOCK_TIMEOUT 5000` | fail fast | avoids lock pile-ups |
| ⭐ review SQL | `dotnet ef migrations script --idempotent` | |
| `IsCreatedOnline()` | EF Core online index | SQL Server |
| ⭐ `UPDATE TOP (5000)` loop | batching | `WAITFOR DELAY` |
| backfill as job | outside migration | resumable |
| production-size rehearsal | restored copy | timings |
| watch blocking | `sys.dm_exec_requests.blocking_session_id` | |
| optimized locking | less lock memory | Azure SQL, SQL 2025 |

## Exports and copies
| Tool | Gives | Note |
|:--|:--|:--|
| ⭐ `az sql db copy` | consistent new DB | pre-migration |
| ⭐ SqlPackage `/Action:Export` | BACPAC | from a copy |
| SqlPackage `/Action:Extract` | DACPAC (schema) | |
| `CREATE DATABASE x AS COPY OF y` | T-SQL copy | |
| `BACKUP DATABASE ... TO URL` | native `.bak` | SQL Server 2025, MI |
| `RESTORE VERIFYONLY` | check a `.bak` | |
| `WITH CHECKSUM, COMPRESSION` | safer, smaller | |

## Redundancy
| Layer | Protects | Note |
|:--|:--|:--|
| local replicas | hardware | built in |
| ⭐ zone redundancy | zone | prod |
| ⭐ GRS backups | region (geo-restore) | RPO ~1 h |
| ⭐ failover group | region | RPO seconds |
| listener | `fog-shop.database.windows.net` | no conn string change |
| `.secondary` listener | read-only | |
| `az sql failover-group set-primary` | planned failover | drills |

## DR strategies
| Strategy | Second region | RPO / RTO |
|:--|:--|:--|
| ⭐ backup and restore | nothing running | hours / hours–day |
| pilot light | data replicated, compute off | seconds / ~1 h |
| ⭐ warm standby | small full stack | seconds / minutes |
| active/active | full stack serving | ~0 / ~0 |
| whole stack | data, compute, secrets, DNS, messaging | not just SQL |

## Human-error controls
| Control | Stops / recovers | Note |
|:--|:--|:--|
| ⭐ `CanNotDelete` lock | deletion | data resources |
| ⭐ PIM, least privilege | risky access | |
| stack deny settings | out-of-band changes | |
| Azure Policy | bad settings | |
| ⭐ blob soft delete + versioning | deleted/overwritten files | |
| container soft delete | deleted containers | |
| ⭐ Key Vault purge protection | permanent secret/key loss | can't disable |
| two-person approval | destructive ops | CI |
| temporal / ledger tables | history, tamper evidence | also seen |

## Retention and erasure
| Item | Practice | Note |
|:--|:--|:--|
| ⭐ retention schedule | per data type | legal basis |
| ⭐ deletion jobs | automatic | carts, logs, closed accounts |
| legal holds | invoices, orders | minimise fields |
| ⭐ GDPR Art. 17 | erase everywhere | DB, files, search, caches, partners |
| ⭐ erasure log | re-apply after restore | no personal data |
| backups | expire within retention | restricted access |

## Encryption
| Layer | Default | Stronger |
|:--|:--|:--|
| ⭐ SQL at rest | TDE, service-managed key | CMK in Key Vault |
| columns | none | Always Encrypted |
| ⭐ SQL in transit | `Encrypt=True` default | TLS 1.2+, no `TrustServerCertificate` |
| storage at rest | Microsoft keys | CMK, infrastructure encryption |
| backups | TDE key | CMK too |
| CMK risk | lost key = lost data | purge protection + backups |

## Non-production data
| Option | Use | Note |
|:--|:--|:--|
| ⭐ synthetic (Bogus) | dev, CI | seeded, reproducible |
| ⭐ anonymised copy | staging, perf | secured pipeline |
| subset | small realistic set | then anonymise |
| `example.test` emails | no real inboxes | reserved domain |
| Dynamic Data Masking | | not anonymisation |
| raw prod copies | | never in dev |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| never restored | unknown RTO | drills |
| 7-day default retention | late discoveries | 35 days + LTR |
| LRS backups | no geo-restore | GRS |
| restore over prod | more damage | new DB, copy back |
| offline index build | table locked | online |
| one giant UPDATE | log full, blocking | batches |
| BACPAC of live DB | inconsistent | export a copy |
| DR = database only | can't serve | whole stack |
| erasure only in prod DB | data elsewhere | all stores + log |
| prod data in dev | breach risk | synthetic |
| `TrustServerCertificate=True` | MITM risk | real certs |

## Sources
| Source | Link |
|:--|:--|
| Automated backups | https://learn.microsoft.com/azure/azure-sql/database/automated-backups-overview |
| Recovery using backups | https://learn.microsoft.com/azure/azure-sql/database/recovery-using-backups |
| Long-term retention | https://learn.microsoft.com/azure/azure-sql/database/long-term-retention-overview |
| Failover groups | https://learn.microsoft.com/azure/azure-sql/database/failover-group-sql-db |
| Online index operations | https://learn.microsoft.com/sql/relational-databases/indexes/perform-index-operations-online |
| SqlPackage | https://learn.microsoft.com/sql/tools/sqlpackage/sqlpackage |
| TDE | https://learn.microsoft.com/azure/azure-sql/database/transparent-data-encryption-tde-overview |
| Blob soft delete | https://learn.microsoft.com/azure/storage/blobs/soft-delete-blob-overview |
| Disaster recovery | https://learn.microsoft.com/azure/well-architected/reliability/disaster-recovery |
| GDPR Art. 17 | https://gdpr-info.eu/art-17-gdpr/ |
