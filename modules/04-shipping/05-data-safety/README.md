---
title: Data Safety
module: 04-shipping
tech: PostgreSQL 18, AWS RDS backups, Drizzle Kit migrations, MongoDB Atlas backups
---
# Data Safety
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ RPO and RTO: how much data you can lose and how fast you must recover
- [ ] ⭐ RDS automated backups, point-in-time recovery, and manual snapshots
- [ ] ⭐ Restore drills: restoring regularly, checking the data, measuring the real RTO
- [ ] ⭐ Safe migrations in production: lock timeouts, concurrent indexes, expand/contract, batched backfills
- [ ] Logical backups with `pg_dump` and `pg_restore`: when and how
- [ ] Backup copies and immutability: cross-account and cross-region copies, AWS Backup vault lock
- [ ] Protecting against human error: deletion protection, `prevent_destroy`, SCPs, least privilege, soft deletes
- [ ] Data retention and deletion: retention schedules, GDPR erasure, backups that contain deleted data
- [ ] MongoDB Atlas backups: continuous cloud backup, point-in-time restore, `mongodump`
- [ ] Disaster recovery strategies: backup and restore, pilot light, warm standby, active/active
- [ ] Encryption at rest and in transit; KMS key management
- [ ] Non-production data: synthetic seeds and anonymized copies, never raw production data

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · RPO, RTO, and backups](docs/01-rpo-rto-backups.md)
- [02 · Restore drills, copies, and disaster recovery](docs/02-restores-copies-dr.md)
- [03 · Safe production migrations](docs/03-safe-migrations.md)
- [04 · Protection, retention, encryption, and staging data](docs/04-protection-retention-encryption.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 04-shipping/05-data-safety mode=tasks` when you are ready to build._
