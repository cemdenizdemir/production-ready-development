---
title: Human error, retention, encryption, and non-production data
tech: Azure locks and Policy, Blob soft delete, Key Vault purge protection, TDE, Microsoft.Data.SqlClient, Bogus
version: Azure (November 2026), Microsoft.Data.SqlClient 6.x, Bogus 35.x
date: 2026-11-09
covers: [7, 8, 10, 11]
---
# Human error, retention, encryption, and non-production data
[← Overview](00-overview.md)

## Why it matters
- An engineer ran a cleanup script against the wrong subscription and deleted a production storage account. Without soft delete and a lock, the product images were gone.
- A GDPR deletion request was "done" in the database, but the customer's data was still in a staging database copied from production last month, and in 35 days of backups nobody had documented.
- A developer restored a production copy to their laptop to debug. The laptop was stolen with 80,000 customers' addresses on it.

## Concepts

### Protecting against human error
| Control | Protects | How |
|:--|:--|:--|
| ⭐ resource locks (`CanNotDelete`) | accidental deletion of databases, storage, Key Vault | Bicep (03-iac) |
| ⭐ least privilege + PIM | people changing production | Reader by default; just-in-time elevation |
| deployment stack deny settings | changes outside IaC | 03-iac |
| Azure Policy | dangerous settings | deny public access, require soft delete |
| ⭐ Blob soft delete + container soft delete + versioning | deleted or overwritten files | 7–365 days |
| ⭐ Key Vault soft delete + purge protection | deleted secrets, keys (and TDE CMK) | purge protection can't be turned off |
| SQL: deleted database restore, PITR | dropped tables, bad updates | lesson 01 |
| `DELETE` safety in apps | soft-delete flags, `rowversion`, audit logs | code |
| two-person rule | destructive production operations | approvals in CI |
| ledger / temporal tables (also seen) | tamper evidence, history | SQL features |

### Data retention and deletion
| Item | Practice |
|:--|:--|
| ⭐ retention schedule | per data type: why kept, how long, legal basis, deletion method |
| ⭐ automatic deletion | jobs delete or anonymise data past retention (carts 30 days, logs 30–90 days, accounts after closure + grace) |
| legal holds | invoices and orders kept for tax law (often 6–10 years), minimised |
| ⭐ GDPR erasure (Art. 17) | delete or anonymise personal data on request, across the database, files, search index, caches, analytics, third parties |
| ⭐ backups | you usually can't edit backups: document that they expire within the retention window, restrict access, and **re-apply erasures after any restore** using an erasure log |
| telemetry | short retention and redaction (03-backend/10-observability) |

| Data | Retention | Deletion |
|:--|:--|:--|
| orders, invoices | legal minimum (e.g. 10 years) | anonymise customer fields after the active period |
| accounts | while active + 30 days after closure | hard delete + erasure log entry |
| carts, sessions | 30 days | scheduled job |
| uploads in quarantine | 1 day | lifecycle rule |
| application logs | 30–90 days | workspace retention |

### Encryption
| Layer | Default | Stronger option |
|:--|:--|:--|
| ⭐ Azure SQL at rest | TDE on, service-managed keys | customer-managed key (TDE protector) in Key Vault with purge protection |
| column level | none | Always Encrypted for very sensitive columns (also seen) |
| ⭐ in transit to SQL | TLS; minimal TLS version setting | `Encrypt=True` (default in Microsoft.Data.SqlClient 4+), `TrustServerCertificate=False`, TLS 1.2+ |
| Storage at rest | Microsoft-managed keys | CMK; infrastructure encryption (double) |
| backups | encrypted with the database's TDE key | CMK applies to backups too |
| app secrets | Key Vault | managed identities remove most secrets |
| HTTPS everywhere | Front Door, Container Apps ingress | HSTS, TLS 1.2+ minimum |

With a customer-managed key, losing the key means losing the data: Key Vault purge protection and key backups are mandatory.

### Non-production data
| Option | Use |
|:--|:--|
| ⭐ synthetic seed data | default for dev and CI: generated with Bogus, realistic shape and volume |
| ⭐ anonymised copies | staging/performance tests needing real distributions: copy → scrub PII in a secured pipeline → use |
| subset copies | only the rows you need, then anonymised |
| raw production copies | never in dev or on laptops |
| Dynamic Data Masking | hides values from some users; **not** anonymisation (data is still there) |

## Example
`tests/Shop.Seed/ShopFaker.cs` (Bogus)
```csharp
using Bogus;

public static class ShopFaker
{
    public static List<Customer> Customers(int count, int seed = 42)
    {
        Randomizer.Seed = new Random(seed);                                   // reproducible data
        return new Faker<Customer>("de")
            .CustomInstantiator(f => Customer.Create(
                Email.From(f.Internet.Email(provider: "example.test")),         // reserved domain: never a real inbox
                f.Name.FullName(),
                f.Address.FullAddress()))
            .Generate(count);
    }
}
```
`scripts/anonymise-staging.sql` (runs inside the secured copy pipeline, before anyone gets access)
```sql
UPDATE identity.Users
SET Email = CONCAT('user', Id, '@example.test'),
    NormalizedEmail = UPPER(CONCAT('user', Id, '@example.test')),
    PhoneNumber = NULL,
    PasswordHash = NULL;                                                   -- nobody logs in as a real customer
UPDATE ordering.Orders
SET ShippingName = CONCAT('Customer ', CustomerId),
    ShippingStreet = 'Example Street 1',
    ShippingPostalCode = '00000';
DELETE FROM payments.PaymentMethods;                                     -- no tokens leave production
```
`src/Shop.Application/Privacy/ErasureService.cs` (erasure with a log for re-application after restores)
```csharp
public async Task EraseAsync(Guid userId, CancellationToken ct)
{
    await using var tx = await db.Database.BeginTransactionAsync(ct);
    await db.Users.Where(u => u.Id == userId).ExecuteDeleteAsync(ct);
    await db.Orders.Where(o => o.CustomerId == userId).ExecuteUpdateAsync(s => s
        .SetProperty(o => o.ShippingName, "erased")
        .SetProperty(o => o.ShippingStreet, "erased"), ct);
    db.ErasureLog.Add(new ErasureLogEntry(userId, time.GetUtcNow()));        // contains no personal data
    await db.SaveChangesAsync(ct);
    await tx.CommitAsync(ct);
    events.Raise(new UserErased(userId));                                       // search index, blobs, caches, partners
}
```
After restoring a backup, a job replays `ErasureLog` entries newer than the restore point.

Locks and Key Vault protection in Bicep:
```bicep
resource kv 'Microsoft.KeyVault/vaults@2024-11-01' = {
  // ...
  properties: { enableSoftDelete: true, softDeleteRetentionInDays: 90, enablePurgeProtection: true /* ... */ }
}
```

## Production patterns
- Locks, policies, least privilege with PIM, soft delete everywhere it exists, and approvals for destructive operations.
- A retention schedule per data type with automated deletion jobs; erasure requests handled across all stores, logged without personal data, and re-applied after restores.
- TDE and TLS everywhere by default; customer-managed keys only when required, with purge protection and key backups.
- Dev and CI use synthetic data; staging uses anonymised copies produced by a secured pipeline; production data never lands on laptops.

## Mistakes
Wrong: `TrustServerCertificate=True` in production connection strings "to make it connect".
Right: `Encrypt=True` with the server's real certificate; fix the hostname or CA problem instead.

Wrong: restoring production to staging for a bug hunt, as is.
Right: a reproducible synthetic dataset, or an anonymised copy through the secured pipeline.

## Check yourself
1. Which controls stop an accidental deletion of a production storage account, and which recover from it?
2. How do you handle GDPR erasure for data that's in backups?
3. Why is Dynamic Data Masking not enough for test data?

<details><summary>Answers</summary>

1. Stop: a `CanNotDelete` lock, deployment stack deny settings, least privilege with PIM, and Azure Policy. Recover: soft delete for the account (where supported), blob/container soft delete and versioning, and backups or replicas of important data.
2. Keep backups within a documented retention window and restricted access, record each erasure in an erasure log without personal data, and re-apply the logged erasures after any restore.
3. It only hides values from users without unmask permission; the real data is still stored, can be unmasked by privileged users, and may leak through queries. Test environments need data that isn't personal in the first place.
</details>

## Sources
- [Lock resources](https://learn.microsoft.com/azure/azure-resource-manager/management/lock-resources)
- [Blob soft delete](https://learn.microsoft.com/azure/storage/blobs/soft-delete-blob-overview)
- [Key Vault soft delete and purge protection](https://learn.microsoft.com/azure/key-vault/general/soft-delete-overview)
- [Transparent data encryption](https://learn.microsoft.com/azure/azure-sql/database/transparent-data-encryption-tde-overview)
- [Microsoft.Data.SqlClient encryption defaults](https://learn.microsoft.com/sql/connect/ado-net/connection-string-syntax)
- [Bogus](https://github.com/bchavez/Bogus)
- [ICO — right to erasure and backups](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/)
