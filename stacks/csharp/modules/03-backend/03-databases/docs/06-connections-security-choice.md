---
title: Connections, security, and choosing a database
tech: Microsoft.Data.SqlClient, Azure SQL Database, Microsoft Entra ID
version: Microsoft.Data.SqlClient 6.x, Azure SQL Database, SQL Server 2025
date: 2026-11-09
covers: [13, 14, 17]
---
# Connections, security, and choosing a database
[← Overview](00-overview.md)

## Why it matters
- At peak, requests fail with "Timeout expired. The timeout period elapsed prior to obtaining a connection from the pool." Connections leak in one code path and the pool of 100 is exhausted.
- The app logs in as `sa`; a SQL injection bug in one report becomes `DROP DATABASE`.
- Azure SQL fails over during maintenance; without retries, 30 seconds of 500s hit customers.

## Concepts

### Connections in production
| Setting | Default | Note |
|:--|:--|:--|
| pooling | on | one pool per connection string |
| `Max Pool Size` | 100 | per app instance; sum across replicas must fit the database's limits |
| `Connect Timeout` | 15 s | lower (5 s) fails faster |
| command timeout | 30 s | EF Core `CommandTimeout`, Dapper `commandTimeout` |
| ⭐ `Encrypt=True` | on (SqlClient 4+) | `TrustServerCertificate=True` only for local containers |
| ⭐ transient retries | off | `EnableRetryOnFailure()` (EF Core) / Polly for Dapper; Azure SQL fails over and throttles |
| `ApplicationIntent=ReadOnly` | | route to a readable secondary (read scale-out) |
| `Application Name=Shop.Api` | | shows in DMVs and Query Store |

Pool exhaustion causes: connections not disposed, long transactions, slow queries holding connections, thread-pool starvation (01-language-runtime lesson 04). Monitor with SqlClient's event counters / OpenTelemetry metrics.

Budget: replicas × max pool size ≤ the Azure SQL tier's worker/session limits.

### SQL security
| Control | How |
|:--|:--|
| ⭐ no passwords | Microsoft Entra authentication with managed identity: `Authentication=Active Directory Managed Identity` (or `Active Directory Default` to also work locally with `az login`) |
| Entra-only authentication | disable SQL logins on Azure SQL |
| ⭐ least privilege | app identity: `db_datareader`, `db_datawriter`, `EXECUTE` on needed procs; **no** DDL |
| migration identity | separate identity with `db_ddladmin`, used only by the pipeline |
| contained users | `CREATE USER [id-shop-api] FROM EXTERNAL PROVIDER;` in the database |
| network | private endpoint; public access off; firewall only for CI if needed |
| encryption in transit / at rest | TLS (`Encrypt=True`) / TDE (on by default in Azure SQL) |
| row-level security | security policies filtering rows per tenant/user |
| Always Encrypted | client-side encrypted columns (keys in Key Vault); server never sees plaintext |
| dynamic data masking | masks columns for non-privileged users (not a security boundary) |
| auditing | Azure SQL auditing to Log Analytics / storage |
| injection | parameters everywhere (01-foundations/06) |

### Choosing a database
| Option | Strengths | Trade-offs | Choose when |
|:--|:--|:--|:--|
| ⭐ SQL Server / Azure SQL | mature, rich T-SQL, Query Store, great .NET tooling, managed HA/backups in Azure | licensing cost on-prem, T-SQL lock-in | .NET/Azure shops, transactional business data (this stack) |
| PostgreSQL (Azure Database for PostgreSQL) | open source, excellent SQL, `jsonb`, extensions | fewer .NET-shop conventions; Npgsql is excellent | cost-sensitive, open-source-first, multi-cloud |
| Cosmos DB / MongoDB (document) | flexible schema, global distribution, scale-out | joins, transactions across partitions, query cost model | large-scale key-value/document access patterns |
| JSON columns in SQL | flexible attributes inside a relational model | indexing/query complexity | product attributes, snapshots |

Start relational; add JSON columns for flexible parts; adopt a document database only for access patterns that need it.

## Example
`src/Shop.Api/appsettings.json` (no secrets)
```json
{
  "ConnectionStrings": {
    "Shop": "Server=tcp:sql-shop-prod.database.windows.net,1433;Database=shop;Authentication=Active Directory Default;Encrypt=True;Connect Timeout=5;Application Name=Shop.Api",
    "ShopReadOnly": "Server=tcp:sql-shop-prod.database.windows.net,1433;Database=shop;Authentication=Active Directory Default;Encrypt=True;ApplicationIntent=ReadOnly;Application Name=Shop.Api.Reports"
  }
}
```
`db/security.sql` (run once by an admin / IaC)
```sql
CREATE USER [id-shop-api] FROM EXTERNAL PROVIDER;             -- the app's managed identity
ALTER ROLE db_datareader ADD MEMBER [id-shop-api];
ALTER ROLE db_datawriter ADD MEMBER [id-shop-api];
GRANT EXECUTE ON SCHEMA::dbo TO [id-shop-api];

CREATE USER [id-shop-migrations] FROM EXTERNAL PROVIDER;      -- pipeline identity
ALTER ROLE db_ddladmin ADD MEMBER [id-shop-migrations];
ALTER ROLE db_datareader ADD MEMBER [id-shop-migrations];
ALTER ROLE db_datawriter ADD MEMBER [id-shop-migrations];
```
Row-level security for a multi-tenant table:
```sql
CREATE FUNCTION security.fn_TenantPredicate(@TenantId int)
RETURNS TABLE WITH SCHEMABINDING
AS RETURN SELECT 1 AS ok WHERE @TenantId = CAST(SESSION_CONTEXT(N'TenantId') AS int);

CREATE SECURITY POLICY security.TenantFilter
ADD FILTER PREDICATE security.fn_TenantPredicate(TenantId) ON dbo.Orders
WITH (STATE = ON);
-- the app sets: EXEC sp_set_session_context @key = N'TenantId', @value = @tenant;
```

## Production patterns
- Managed identity + Entra-only auth; no SQL passwords anywhere (local dev uses the container's SA via user-secrets).
- Separate identities for the running app (DML only) and migrations (DDL), plus a read-only string for reports.
- `EnableRetryOnFailure` + short connect timeout; monitor pool usage; size pools against tier limits.
- Private endpoints and public network access disabled for production databases (04-shipping/02).

## Mistakes
Wrong:
```text
Server=...;User Id=sa;Password=...;TrustServerCertificate=True
```
Right: `Authentication=Active Directory Managed Identity;Encrypt=True` with a least-privilege contained user.

Wrong: raising `Max Pool Size` to 1,000 to "fix" pool timeouts.
Right: find the leak or slow query; pool timeouts are symptoms.

## Check yourself
1. Name three causes of connection pool exhaustion.
2. Why give migrations a different identity from the app?
3. When would you pick PostgreSQL or Cosmos DB instead of Azure SQL?

<details><summary>Answers</summary>

1. Connections not disposed, long-running transactions or slow queries holding connections, thread-pool starvation delaying their release (and too many replicas for the pool budget).
2. The app then can't change schema (or drop tables) even if compromised; DDL rights exist only in the pipeline step.
3. PostgreSQL: open-source/cost or multi-cloud preference with relational needs. Cosmos DB: very large scale, global distribution, and access patterns that fit documents/keys rather than joins and transactions.
</details>

## Sources
- [SQL Server connection pooling (ADO.NET)](https://learn.microsoft.com/sql/connect/ado-net/sql-server-connection-pooling)
- [Connect with Microsoft Entra authentication (SqlClient)](https://learn.microsoft.com/sql/connect/ado-net/sql/azure-active-directory-authentication)
- [Azure SQL — Managed identity for apps](https://learn.microsoft.com/azure/azure-sql/database/authentication-azure-ad-user-assigned-managed-identity)
- [Row-level security](https://learn.microsoft.com/sql/relational-databases/security/row-level-security)
- [Always Encrypted](https://learn.microsoft.com/sql/relational-databases/security/encryption/always-encrypted-database-engine)
- [Azure SQL resource limits](https://learn.microsoft.com/azure/azure-sql/database/resource-limits-vcore-single-databases)
