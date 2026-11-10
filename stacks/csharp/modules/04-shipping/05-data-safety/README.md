---
title: Data Safety
module: 04-shipping
tech: Azure SQL backups, SQL Server 2025, EF Core migrations
---
# Data Safety
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ RPO and RTO: how much data you can lose and how fast you must recover
- [ ] ⭐ Azure SQL automated backups, point-in-time restore, and long-term retention
- [ ] ⭐ Restore drills: restoring regularly, checking the data, measuring the real RTO
- [ ] ⭐ Safe migrations in production: lock timeouts, online index operations, expand/contract, batched backfills
- [ ] Exports and copies: BACPAC, database copy, and native `.bak` backups in SQL Server
- [ ] Backup copies and redundancy: backup storage redundancy, geo-restore, failover groups
- [ ] Protecting against human error: resource locks, Azure Policy, least privilege, soft deletes, Key Vault purge protection
- [ ] Data retention and deletion: retention schedules, GDPR erasure, backups that contain deleted data
- [ ] Disaster recovery strategies: backup and restore, pilot light, warm standby, active/active
- [ ] Encryption at rest and in transit: TDE, customer-managed keys in Key Vault, TLS
- [ ] Non-production data: synthetic seeds and anonymized copies, never raw production data

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · RPO, RTO, Azure SQL backups, and restore drills](docs/01-rpo-rto-backups-drills.md)
- [02 · Safe migrations in production](docs/02-safe-migrations.md)
- [03 · Exports, redundancy, and disaster recovery strategies](docs/03-exports-redundancy-dr.md)
- [04 · Human error, retention, encryption, and non-production data](docs/04-human-error-retention-encryption.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/04-shipping/05-data-safety mode=tasks` when you are ready to build._
