---
title: Protection, retention, encryption, and staging data
tech: AWS RDS, AWS KMS, AWS Organizations, PostgreSQL 18
version: RDS deletion protection, AWS Organizations SCPs, AWS KMS, S3 Object Lock, PostgreSQL 18
date: 2026-11-07
covers: [7, 8, 11, 12]
---
# Protection, retention, encryption, and staging data
[← Overview](00-overview.md)

## Why it matters
- An engineer runs a cleanup script with production credentials by accident. Nothing stops it: the role can delete anything.
- A customer asks for their data to be deleted. It's gone from the database, but a restore two weeks later brings it back.
- Staging is a full copy of production. A contractor's laptop with a staging dump is stolen, and it's a reportable data breach.

## Concepts

### Protecting against human error
| Guardrail | Effect |
|:--|:--|
| RDS `deletion_protection` | the instance can't be deleted until it's turned off |
| Terraform `prevent_destroy` | plans that destroy it fail |
| SCP denying destructive actions | nobody except a break-glass role can delete databases, snapshots, recovery points |
| Least privilege | engineers get read-only production access by default |
| Break-glass role | temporary elevated access, audited and alerted |
| Reviewed SQL for manual changes | data fixes go through a PR and a script, run by a pipeline |
| Soft deletes for user-facing data | `deleted_at` lets support undo mistakes |
| S3 versioning + Object Lock | deleted or overwritten files can be recovered |

### Retention and deletion
| Topic | Practice |
|:--|:--|
| Retention schedule | per data type: sessions days, logs weeks, orders years (tax law), backups 14–35 days |
| Deletion jobs | scheduled jobs enforce the schedule; nothing is kept "just in case" |
| Erasure requests (GDPR Art. 17) | delete or anonymize personal data; keep what the law requires (invoices) without personal details where possible |
| Backups | not edited; they age out within retention; record erasures and reapply them after any restore |
| Logs and telemetry | short retention, no personal data ([03-backend/10-observability](../../../03-backend/10-observability/README.md)) |
| Legal hold | suspend deletion for data under investigation |

### Encryption
| Layer | Practice |
|:--|:--|
| RDS at rest | KMS encryption chosen at creation (encrypting later means snapshot copy + restore) |
| In transit | TLS with certificate verification (`verify-full`, RDS CA bundle) |
| Snapshots and backups | inherit encryption; copies across accounts need key access |
| S3 | SSE-S3 by default; SSE-KMS for audit and key policies |
| ElastiCache | at rest and in transit |
| KMS keys | customer-managed for production data, automatic rotation, key policies limited to the roles that need them |
| Application-level | encrypt especially sensitive fields (tax IDs) before storing |

### Data for non-production environments
| Option | Use |
|:--|:--|
| Synthetic seed data | default for development and CI |
| Anonymized copy | realistic volumes for staging and performance tests |
| Subset + anonymization | smaller, still realistic |
| Raw production copy | never outside production access controls |

Anonymize **before** the data leaves production controls, in a pipeline, not on a laptop. Also seen: PostgreSQL Anonymizer.

## Example
SCP in AWS Organizations — protect production data from everyone but the break-glass role.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ProtectProductionData",
      "Effect": "Deny",
      "Action": [
        "rds:DeleteDBInstance",
        "rds:DeleteDBCluster",
        "rds:DeleteDBSnapshot",
        "rds:ModifyDBInstance",
        "backup:DeleteRecoveryPoint",
        "backup:DeleteBackupVault",
        "s3:DeleteBucket"
      ],
      "Resource": "*",
      "Condition": {
        "ArnNotLike": { "aws:PrincipalArn": ["arn:aws:iam::*:role/break-glass-admin", "arn:aws:iam::*:role/terraform-apply"] }
      }
    }
  ]
}
```
Soft deletes with Drizzle and a partial unique index:
```ts
import { pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const products = pgTable('products', {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  sku: text().notNull(),
  name: text().notNull(),
  deletedAt: timestamp({ withTimezone: true }),
}, (t) => [
  uniqueIndex('products_sku_active_key').on(t.sku).where(sql`${t.deletedAt} IS NULL`), // SKU reusable after deletion
]);
```
An erasure job that also records the erasure for replay after restores:
```ts
export async function eraseUser(userId: string, requestId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE users SET email = 'erased+' || id || '@invalid', name = 'Erased user',
        phone = NULL, password_hash = NULL, erased_at = now()
      WHERE id = ${userId}`);
    await tx.execute(sql`DELETE FROM addresses WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM sessions WHERE user_id = ${userId}`);
    // orders stay for tax retention, now linked to an anonymized user
    await tx.execute(sql`INSERT INTO erasure_log (user_id, request_id, erased_at) VALUES (${userId}, ${requestId}, now())`);
  });
}
// After any restore: re-run eraseUser for every erasure_log entry newer than the restore point.
// Keep erasure_log outside the restored database (or export it daily) so it survives the restore.
```
Anonymizing a staging copy (run against a scratch restore inside the production account, then dump):
```sql
UPDATE users SET
  email = 'user+' || id || '@example.test',
  name = 'User ' || left(id::text, 8),
  phone = NULL,
  password_hash = NULL;
UPDATE addresses SET line1 = 'Teststraße 1', city = 'Teststadt', postal_code = '00000';
TRUNCATE sessions, password_reset_tokens, api_keys, webhook_endpoints;
```

## Production patterns
- **Layered protection**: deletion protection, `prevent_destroy`, SCPs, read-only defaults, audited break-glass access.
- **A written retention schedule** enforced by jobs, including logs and backups.
- **Erasure requests handled in code**, logged, and reapplied after restores.
- **Encryption everywhere** with customer-managed KMS keys for production data and verified TLS.
- **Synthetic or anonymized data outside production**, produced by a pipeline.

## Mistakes
Wrong: engineers with write access to production by default. One wrong terminal tab deletes real data. Right: read-only by default, elevated access on request, audited.

Wrong: keeping everything forever. More data to breach, more to search for erasure requests. Right: retention schedule and deletion jobs.

Wrong: restoring a backup and forgetting erasure requests made since. Deleted personal data comes back. Right: an erasure log stored outside the database, reapplied after restores.

Wrong: production dumps on laptops for "realistic testing". Right: anonymized copies built inside production controls.

## Check yourself
1. Name three layers that stop an accidental database deletion.
2. How do you honor an erasure request when backups still contain the data?
3. Why anonymize before data leaves production, not after?

<details>
<summary>Answers</summary>

1. RDS deletion protection (AWS refuses the delete), Terraform `prevent_destroy` (plans fail), an SCP that denies deletes for everyone but a break-glass role, plus read-only default access for people.
2. Delete or anonymize it in the live systems, record the erasure in a log kept outside the database, let backups expire within their retention, and reapply all logged erasures after any restore so the data doesn't come back.
3. Once raw data is outside production's access controls (a laptop, a staging account with broad access), any leak is a breach. Anonymizing inside production means only harmless data ever leaves.
</details>

## Sources
- [AWS Organizations — Service control policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)
- [Amazon RDS — Encrypting resources](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html)
- [AWS KMS — Key rotation](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html)
- [GDPR — Article 17, right to erasure](https://gdpr-info.eu/art-17-gdpr/)
- [Amazon S3 — Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
