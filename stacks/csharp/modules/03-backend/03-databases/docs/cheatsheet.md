---
title: Databases cheatsheet
tech: SQL Server 2025, EF Core 10, Dapper, Azure SQL
version: SQL Server 2025, EF Core 10.0.x, Microsoft.Data.SqlClient 6.x, Dapper 2.1.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
---
# Databases cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Modeling
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ primary key | every table | surrogate + unique natural keys |
| ⭐ foreign keys | always | integrity + optimizer |
| 3NF | one fact, one place | |
| snapshots | price/address at order time | deliberate denormalization |
| `CHECK` / `UNIQUE` / `DEFAULT` / `NOT NULL` | constraints | last line of defense |
| join table | many-to-many | composite key |
| soft delete | `IsDeleted` + filtered index + query filter | only if needed |

## Data types
| Need | Type | Avoid |
|:--|:--|:--|
| ⭐ money | `decimal(18,2)` + `char(3)` currency | `float`, `money` |
| ⭐ instant | `datetimeoffset(3)` | `datetime` |
| date | `date` | |
| text | `nvarchar(n)` | `nvarchar(max)` by default |
| case rules | collation | `LOWER()` in WHERE |
| ⭐ clustered key | `bigint IDENTITY` or sequential GUID | random/v7 GUIDs |
| public ID | `uniqueidentifier` + `NEWSEQUENTIALID()` | |
| JSON | `json` (2025) | relational data in JSON |
| vectors | `vector(n)` (2025) | |
| concurrency | `rowversion` | |

## SQL
| Feature | Example | Note |
|:--|:--|:--|
| ⭐ joins | `LEFT JOIN` | |
| ⭐ CTE | `WITH x AS (…)` | |
| ⭐ window functions | `ROW_NUMBER() OVER (PARTITION BY … ORDER BY …)` | |
| running totals | `SUM(x) OVER (ORDER BY d)` | |
| `TOP` / `OFFSET … FETCH` | limits / paging | |
| upsert | `MERGE … WITH (HOLDLOCK)` or update-then-insert | careful |
| `OUTPUT inserted.*` | return changed rows | |
| `EXISTS` | existence checks | |
| `STRING_AGG`, `OPENJSON`, `JSON_VALUE` | strings, JSON | |
| `REGEXP_LIKE` | regex | SQL Server 2025 |

## Indexes
| Index | Use | Note |
|:--|:--|:--|
| ⭐ clustered | table order | narrow, increasing |
| ⭐ nonclustered | lookups | |
| ⭐ composite | equality → range/sort | `(CustomerId, PlacedAt DESC)` |
| ⭐ `INCLUDE` | covering | no key lookups |
| filtered | subset `WHERE …` | open orders |
| unique | constraints | |
| columnstore | analytics | |
| SARGable | no functions on columns | ranges instead |
| `sys.dm_db_index_usage_stats` | unused indexes | drop them |

## Execution plans
| Sign | Means | Note |
|:--|:--|:--|
| ⭐ Index Seek | targeted read | good |
| Scan | reads all | ok if small |
| ⭐ Key Lookup | extra column fetch per row | add `INCLUDE` |
| Hash / Merge / Nested Loops | join types | |
| Sort / spill warning | memory grant | index for order |
| est ≠ actual rows | stats / sniffing | |
| `SET STATISTICS IO, TIME ON` | logical reads | the number to cut |
| parameter sniffing | plan for first values | recompile, PSP, Query Store forcing |

## Operations
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ Query Store | top/regressed queries, force plans | on by default (Azure SQL, 2022+) |
| statistics | auto + `UPDATE STATISTICS` | after big loads |
| index maintenance | rebuild/reorganize | less critical on SSD |
| Azure SQL automatic tuning | create/drop index, force plan | |
| `sys.dm_exec_requests` | running now | |
| `sys.dm_exec_query_stats` | cached plan stats | |
| `sys.dm_os_wait_stats` | wait types | LCK, PAGEIOLATCH |
| `system_health` XE | deadlock graphs | |

## Transactions and isolation
| Item | Meaning | Note |
|:--|:--|:--|
| ACID | atomic, consistent, isolated, durable | |
| ⭐ `SaveChangesAsync` | one transaction | |
| `BeginTransactionAsync` + `CommitAsync` | explicit | short! |
| ⭐ execution strategy | retry whole unit | with `EnableRetryOnFailure` |
| READ COMMITTED | default | |
| ⭐ RCSI | readers don't block writers | default in Azure SQL |
| SNAPSHOT | transaction-wide snapshot | update conflict 3960 |
| SERIALIZABLE | range locks | most blocking |
| `NOLOCK` | dirty reads | avoid |
| optimized locking | fewer locks held | SQL Server 2025 |

## Locking patterns
| Need | Pattern | Note |
|:--|:--|:--|
| ⭐ stock decrement | `UPDATE … SET Stock = Stock - @q WHERE Stock >= @q` | check rows |
| read-then-update | `WITH (UPDLOCK, ROWLOCK)` | in transaction |
| ⭐ queue claim | `WITH (UPDLOCK, READPAST, ROWLOCK)` | skip locked |
| deadlock 1205 | retry | consistent order |
| no external calls in transactions | Stripe, HTTP | outbox |

## Optimistic concurrency
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `IsRowVersion()` / `[Timestamp]` | version column | `rowversion` |
| `IsConcurrencyToken()` | custom token | |
| `DbUpdateConcurrencyException` | conflict | → 412 / merge |
| `Entry(e).Property(p).OriginalValue` | client's version | ETag flow |

## EF Core model
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `DbContext` scoped | unit of work | not thread-safe |
| ⭐ `IEntityTypeConfiguration<T>` | mapping per entity | `ApplyConfigurationsFromAssembly` |
| `ConfigureConventions` | global defaults | precision, lengths |
| `HasMany/WithOne`, `OnDelete` | relationships | |
| `HasConversion<string>()` | enum as string | |
| owned types / ⭐ `ComplexProperty(..., c => c.ToJson())` | value objects / JSON | EF 10 |
| `HasIndex(...).IsDescending().IncludeProperties()` | indexes | SQL Server |
| ⭐ `HasQueryFilter("name", …)` | named filters | EF 10 |
| `IgnoreQueryFilters(["name"])` | disable one | EF 10 |
| `UsePropertyAccessMode(Field)` | backing fields | encapsulated collections |
| `AddDbContextPool` | pooling | stateless contexts |

## Change tracking
| API | Effect | Note |
|:--|:--|:--|
| tracked queries | change detection | writes |
| ⭐ `AsNoTracking()` | read-only | reads |
| `AsNoTrackingWithIdentityResolution` | dedupe instances | |
| ⭐ `ExecuteUpdateAsync` / `ExecuteDeleteAsync` | set-based SQL | bypasses tracker |
| `Entry(e).State` | inspect/override | |
| `ChangeTracker.Clear()` | batch jobs | |

## Migrations
| Command | Does | Note |
|:--|:--|:--|
| ⭐ `dotnet ef migrations add Name -p Infra -s Api` | create | |
| ⭐ `dotnet ef migrations script --idempotent` | review SQL | |
| ⭐ `dotnet ef migrations bundle --self-contained -r linux-x64` | pipeline executable | |
| `dotnet ef database update` | apply locally | |
| `dotnet ef migrations remove` | undo last | unapplied only |
| `has-pending-model-changes` | CI check | |
| `migrationBuilder.RenameColumn` | fix drop+add | review! |
| `migrationBuilder.Sql(...)` | procs, data fixes | |
| `UseSeeding` / `UseAsyncSeeding` | reference data | EF 9+ |
| ⭐ expand → migrate → contract | zero downtime | 04-shipping/05 |
| no `Migrate()` at prod startup | races | |

## Query performance
| Technique | Effect | Note |
|:--|:--|:--|
| ⭐ projection `Select` | one query, few columns | fixes N+1 |
| `Include` / `ThenInclude` | eager load | |
| ⭐ `AsSplitQuery()` | avoid cartesian explosion | multiple collections |
| no lazy loading | no hidden N+1 | |
| `TagWith("…")` | label SQL | Query Store |
| `ToQueryString()` | see SQL | tests |
| log `Database.Command` | all SQL + time | Development |
| `EF.CompileAsyncQuery` | hot queries | |
| `EnableSensitiveDataLogging` | parameter values | dev only |

## Dapper and ADO.NET
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `QueryAsync<T>(CommandDefinition)` | map rows | with ct |
| ⭐ parameters `@X` + anonymous object | safe SQL | |
| `QuerySingleOrDefaultAsync` / `ExecuteAsync` | single / commands | |
| `QueryMultipleAsync` | several result sets | |
| `commandType: StoredProcedure` | procs | |
| `commandTimeout` | slow reports | |
| `await using SqlConnection` | pooled | |
| `GetDbConnection()` / `GetDbTransaction()` | share EF transaction | |

## Procedures, views, functions
| Object | Use | Note |
|:--|:--|:--|
| view | reusable read shape | keyless entity |
| ⭐ stored procedure | set-based logic, reports, EXECUTE boundary | version in migrations |
| inline TVF | parameterized view | composable |
| scalar UDF | helpers | perf caution |
| `SqlQuery<T>($"EXEC …")` | call from EF | |

## Connections
| Setting | Default | Note |
|:--|:--|:--|
| pooling | on | per connection string |
| ⭐ `Max Pool Size` | 100 | per instance |
| `Connect Timeout` | 15 s | lower |
| command timeout | 30 s | |
| ⭐ `Encrypt=True` | on | |
| `TrustServerCertificate` | false | local only |
| ⭐ `EnableRetryOnFailure()` | transient retries | Azure SQL |
| `ApplicationIntent=ReadOnly` | read replicas | reports |
| `Application Name` | identify app | DMVs |

## Security
| Control | How | Note |
|:--|:--|:--|
| ⭐ managed identity auth | `Authentication=Active Directory Managed Identity` | no passwords |
| `Active Directory Default` | MI in Azure, `az login` locally | |
| Entra-only auth | disable SQL logins | |
| ⭐ least privilege | reader/writer + EXECUTE | no DDL for app |
| migration identity | `db_ddladmin` | pipeline only |
| `CREATE USER … FROM EXTERNAL PROVIDER` | contained Entra user | |
| private endpoint | no public access | |
| TDE / TLS | at rest / in transit | |
| row-level security | tenant filters | `SESSION_CONTEXT` |
| Always Encrypted | client-side column encryption | |
| auditing | Log Analytics | |

## Choosing
| Option | Choose when | Note |
|:--|:--|:--|
| ⭐ SQL Server / Azure SQL | .NET/Azure, transactional | this stack |
| PostgreSQL | open source, cost, multi-cloud | Npgsql |
| Cosmos DB / MongoDB | document/key access at scale | partitions |
| JSON columns | flexible attributes in relational | |

## Tools
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ SSMS 21+ | admin, plans, Query Store | Windows |
| ⭐ VS Code mssql | queries, plans | |
| `sqlcmd` (go) | scripts, CI | |
| SQL Server 2025 container | dev/tests | Testcontainers |
| Azure Data Studio | retired Feb 2026 | avoid |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `float` money | rounding | `decimal` |
| random/v7 GUID clustered key | fragmentation | identity / sequential GUID |
| functions on indexed columns | scans | ranges |
| N+1 | query storms | projection |
| multiple collection includes | cartesian explosion | split queries |
| read-modify-write stock | oversell | conditional UPDATE |
| external calls in transactions | long locks | outbox |
| `Migrate()` on startup | races | bundles |
| drop+add renames | data loss | `RenameColumn` |
| `sa` from the app | blast radius | least privilege |
| pool size as a fix | hides leaks | fix cause |

## Sources
| Source | Link |
|:--|:--|
| SQL Server 2025 | https://learn.microsoft.com/sql/sql-server/what-s-new-in-sql-server-2025 |
| Index design guide | https://learn.microsoft.com/sql/relational-databases/sql-server-index-design-guide |
| Locking and versioning | https://learn.microsoft.com/sql/relational-databases/sql-server-transaction-locking-and-row-versioning-guide |
| Query Store | https://learn.microsoft.com/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store |
| EF Core 10 | https://learn.microsoft.com/ef/core/what-is-new/ef-core-10.0/whatsnew |
| EF Core performance | https://learn.microsoft.com/ef/core/performance/ |
| EF Core migrations | https://learn.microsoft.com/ef/core/managing-schemas/migrations/ |
| Dapper | https://github.com/DapperLib/Dapper |
| Azure SQL security | https://learn.microsoft.com/azure/azure-sql/database/security-overview |
