---
title: Restore drills, copies, and disaster recovery
tech: AWS RDS, AWS Backup, GitHub Actions
version: RDS PITR restores, AWS Backup (vault lock, cross-region/cross-account copy, restore testing), Terraform AWS provider 6
date: 2026-11-07
covers: [3, 6, 10]
---
# Restore drills, copies, and disaster recovery
[← Overview](00-overview.md)

## Why it matters
- The first real restore happens during an incident. It fails twice: the restore role can't use the KMS key, and nobody remembers the parameter group. RTO was "1 hour"; it took five.
- Ransomware-style compromise of an admin role deletes the database **and** its snapshots, because all copies lived in the same account.
- A regional outage keeps the shop down for a day. There were cross-region copies, but no plan, no tested runbook, and no infrastructure code for the second region.

## Concepts

### Restore drills
| Practice | Why |
|:--|:--|
| Monthly automated restore | proves backups are usable |
| Restore to a temporary instance | never touches production |
| Run checks | row counts, latest timestamps, app smoke test against the copy |
| Measure duration | the real RTO, not the hoped-for one |
| Delete afterwards | no forgotten costly instances |
| Alert on failure | a failed drill is a production problem |
| AWS Backup restore testing | managed, scheduled restore tests (also usable) |

### Copies and immutability
| Protection | Against |
|:--|:--|
| Cross-region copies | regional outages |
| Cross-account copies (backup account) | compromised or deleted production account/roles |
| Vault lock (compliance mode) | anyone, including admins, deleting recovery points early |
| S3 Object Lock | deletion of backup files in S3 |
| Separate KMS keys shared deliberately | restoring needs key access in the target account |

### Disaster recovery strategies
| Strategy | RPO / RTO | Cost | What runs in the second region |
|:--|:--|:--|:--|
| Backup and restore | hours / hours | low | nothing; copies of backups, infrastructure as code |
| Pilot light | minutes / tens of minutes | medium | data replicated (cross-region read replica), app scaled to zero |
| Warm standby | seconds–minutes / minutes | high | small running copy of everything |
| Multi-site active/active | near zero / near zero | highest | full traffic in both regions |

Most products start with **backup and restore across regions** plus Multi-AZ inside the region, and move up only when the business requires it. Whatever the strategy, it must exist as code and a tested runbook.

## Example
`.github/workflows/restore-drill.yml` — monthly restore drill in a sandbox step that measures RTO.
```yaml
name: restore-drill
on:
  schedule:
    - cron: '0 6 1 * *'                       # first day of the month
  workflow_dispatch:
permissions:
  contents: read
  id-token: write
jobs:
  drill:
    runs-on: ubuntu-latest
    timeout-minutes: 180
    steps:
      - uses: actions/checkout@<40-char-commit-sha>
      - uses: aws-actions/configure-aws-credentials@<40-char-commit-sha>
        with:
          role-to-assume: arn:aws:iam::222222222222:role/restore-drill
          aws-region: eu-central-1
      - run: ./ops/restore-drill.sh
```
`ops/restore-drill.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail
TARGET="shop-drill-$(date +%Y%m%d)"
START=$(date +%s)

aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier shop-prod --target-db-instance-identifier "$TARGET" \
  --use-latest-restorable-time --db-instance-class db.t4g.medium \
  --db-subnet-group-name shop-prod-db --vpc-security-group-ids sg-0drill123 --no-multi-az --no-publicly-accessible
trap 'aws rds delete-db-instance --db-instance-identifier "$TARGET" --skip-final-snapshot --delete-automated-backups >/dev/null' EXIT
aws rds wait db-instance-available --db-instance-identifier "$TARGET"

HOST=$(aws rds describe-db-instances --db-instance-identifier "$TARGET" --query 'DBInstances[0].Endpoint.Address' --output text)
export PGHOST="$HOST" PGDATABASE=shop PGUSER=drill PGSSLMODE=verify-full PGSSLROOTCERT=certs/rds-global-bundle.pem
export PGPASSWORD=$(aws secretsmanager get-secret-value --secret-id prod/shop/drill-password --query SecretString --output text)

ORDERS=$(psql -At -c "SELECT count(*) FROM orders")
LATEST=$(psql -At -c "SELECT extract(epoch FROM now() - max(created_at))::int FROM orders")
[ "$ORDERS" -gt 0 ] || { echo "no orders in the restored copy"; exit 1; }
[ "$LATEST" -lt 86400 ] || { echo "newest order is older than a day: backups may be stale"; exit 1; }

echo "restore drill OK: $ORDERS orders, newest ${LATEST}s old, RTO $(( ($(date +%s) - START) / 60 )) minutes"
```
`infra/envs/prod/backup.tf` — AWS Backup with a locked vault and a copy to another account and region.
```hcl
resource "aws_backup_vault" "prod" {
  name        = "shop-prod"
  kms_key_arn = aws_kms_key.backup.arn
}

resource "aws_backup_vault_lock_configuration" "prod" {
  backup_vault_name   = aws_backup_vault.prod.name
  min_retention_days  = 7
  max_retention_days  = 365
  changeable_for_days = 3                     # after 3 days the lock becomes immutable (compliance mode)
}

resource "aws_backup_plan" "daily" {
  name = "shop-prod-daily"
  rule {
    rule_name         = "daily"
    target_vault_name = aws_backup_vault.prod.name
    schedule          = "cron(0 3 * * ? *)"
    lifecycle {
      delete_after = 35
    }
    copy_action {
      destination_vault_arn = "arn:aws:backup:eu-west-1:333333333333:backup-vault:shop-dr"   # backup account, other region
      lifecycle {
        delete_after = 90
      }
    }
  }
}

resource "aws_backup_selection" "rds" {
  name         = "shop-prod-rds"
  plan_id      = aws_backup_plan.daily.id
  iam_role_arn = aws_iam_role.backup.arn
  resources    = [aws_db_instance.main.arn]
}
```

## Production patterns
- **Monthly automated restore drills** with data checks, measured RTO, automatic cleanup, and alerts on failure.
- **Copies in another account and region**, in a locked vault, with KMS keys shared on purpose.
- **A chosen DR strategy** (usually backup and restore across regions) with infrastructure as code that can target the second region.
- **A restore runbook** written from the drills, not from memory.
- **Snapshots and copies tagged** with source, date, and reason.

## Mistakes
Wrong: "we have backups" without ever restoring one. Right: monthly drills that fail loudly.

Wrong: all backups in the production account. One compromised admin role deletes everything. Right: cross-account copies in a vault with compliance-mode lock.

Wrong: a DR plan that lives in a slide deck. Right: Terraform that can create the environment in the second region, plus a tested runbook.

Wrong: forgetting the encryption keys. Copies encrypted with a key the target account can't use are unrestorable. Right: key policies that grant the backup and DR accounts access, tested in drills.

## Check yourself
1. What should a restore drill check besides "the restore finished"?
2. What do cross-account copies and vault lock protect against?
3. When is "backup and restore" enough as a DR strategy?

<details>
<summary>Answers</summary>

1. That the data is real and recent (row counts, newest timestamps within the RPO), that the app can connect and work against it (smoke test), how long it took (the real RTO), and that the drill cleaned up after itself.
2. Cross-account copies protect against the loss or compromise of the production account and its roles; vault lock in compliance mode prevents anyone, even administrators or attackers with admin rights, from deleting recovery points before their retention ends.
3. When the business accepts an RTO of hours and an RPO of minutes to hours for a whole-region disaster. Multi-AZ already covers the common failures inside a region; higher tiers (pilot light, warm standby) cost much more and are worth it only for stricter targets.
</details>

## Sources
- [AWS Backup — Vault lock](https://docs.aws.amazon.com/aws-backup/latest/devguide/vault-lock.html)
- [AWS Backup — Cross-account and cross-region copies](https://docs.aws.amazon.com/aws-backup/latest/devguide/create-cross-account-backup.html)
- [AWS Backup — Restore testing](https://docs.aws.amazon.com/aws-backup/latest/devguide/restore-testing.html)
- [AWS — Disaster recovery options in the cloud](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)
- [Amazon RDS — Copying a DB snapshot](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CopySnapshot.html)
