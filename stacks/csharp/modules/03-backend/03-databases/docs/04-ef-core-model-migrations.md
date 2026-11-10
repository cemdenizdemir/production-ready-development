---
title: "EF Core: model, change tracking, and migrations"
tech: EF Core 10, Microsoft.EntityFrameworkCore.SqlServer, dotnet-ef
version: EF Core 10.0.x, dotnet-ef 10.0.x
date: 2026-11-09
covers: [6, 7]
---
# EF Core: model, change tracking, and migrations
[← Overview](00-overview.md)

## Why it matters
- A migration generated on a laptop drops and recreates a column instead of renaming it; production loses a year of delivery notes.
- `Database.Migrate()` at startup runs in three replicas at once during a deploy; two of them fail halfway and the app won't start.
- A read-only list endpoint tracks 5,000 entities per request; memory and CPU double for nothing.

## Concepts

### The model
| Piece | Does |
|:--|:--|
| `DbContext` | a session: change tracker + connection + model; ⭐ scoped (one per request) |
| `DbSet<T>` | queryable set of an entity type |
| entity | class with a key, mapped to a table |
| ⭐ `IEntityTypeConfiguration<T>` | fluent mapping per entity (keys, columns, indexes, relationships) |
| relationships | `HasMany/WithOne`, `HasOne/WithMany`, many-to-many via join entity, `OnDelete` behavior |
| owned / ⭐ complex types | value objects stored in the owner's table (or as JSON, EF 10) |
| value converters | `HasConversion<string>()` for enums, strongly typed IDs |
| query filters | soft delete, multi-tenancy; EF 10 named filters (disable one by name) |
| conventions | `Id` keys, `{Nav}Id` foreign keys, nullable → optional |

Register:
```csharp
builder.Services.AddDbContext<ShopDb>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("Shop"),
        sql => sql.EnableRetryOnFailure()));            // transient-fault retries (Azure SQL)
```
`AddDbContextPool<ShopDb>` reuses context instances for very hot paths (contexts must then hold no per-request state).

### Change tracking
| API | Effect |
|:--|:--|
| query without `AsNoTracking` | entities tracked; changes detected on `SaveChangesAsync` |
| ⭐ `AsNoTracking()` | read-only queries: faster, less memory |
| `Add`, `Remove`, property changes | tracked as Added/Deleted/Modified |
| ⭐ `SaveChangesAsync(ct)` | one transaction with all pending changes |
| ⭐ `ExecuteUpdateAsync` / `ExecuteDeleteAsync` | set-based SQL, no loading, bypasses the tracker |
| `Entry(e).State`, `Entry(e).Property(p).OriginalValue` | inspect/override tracking (concurrency) |
| `ChangeTracker.Clear()` | long-running batch work |

Pattern: load the aggregate tracked, call domain methods, save. For reads, project to DTOs with `AsNoTracking` + `Select`.

### Migrations
| Command | Does |
|:--|:--|
| `dotnet tool install -g dotnet-ef` (or local tool) | CLI |
| ⭐ `dotnet ef migrations add AddOrderNotes -p src/Shop.Infrastructure -s src/Shop.Api` | create migration from model diff |
| ⭐ `dotnet ef migrations script --idempotent -o out/migrate.sql` | SQL to review and run |
| ⭐ `dotnet ef migrations bundle --self-contained -r linux-x64 -o out/efbundle` | executable that applies migrations (CI/CD) |
| `dotnet ef database update` | apply locally |
| `dotnet ef migrations remove` | drop the last, unapplied migration |
| `dotnet ef migrations has-pending-model-changes` | CI check: model and migrations in sync |

Rules:
- ⭐ Review every migration's SQL. Renames generated as drop+add lose data; fix with `migrationBuilder.RenameColumn`.
- Apply migrations in the deployment pipeline (bundle or script) as a separate step, not at app startup in production (04-shipping/04).
- Zero-downtime: **expand → migrate → contract** (add nullable column → deploy code writing both → backfill → make required → remove old) (04-shipping/05).
- Seed reference data with `UseSeeding`/`UseAsyncSeeding` (EF 9+) or migrations; never seed test data in production migrations.

## Example
`src/Shop.Infrastructure/Data/ShopDb.cs`
```csharp
using Microsoft.EntityFrameworkCore;

namespace Shop.Infrastructure.Data;

public sealed class ShopDb(DbContextOptions<ShopDb> options) : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder b) => b.ApplyConfigurationsFromAssembly(typeof(ShopDb).Assembly);

    protected override void ConfigureConventions(ModelConfigurationBuilder c)
    {
        c.Properties<decimal>().HavePrecision(18, 2);
        c.Properties<string>().HaveMaxLength(200);          // explicit overrides per property where needed
    }
}
```
`src/Shop.Infrastructure/Data/OrderConfiguration.cs`
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.ToTable("Orders");
        b.HasKey(o => o.Id);
        b.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(o => o.Currency).HasMaxLength(3).IsFixedLength();
        b.Property(o => o.RowVersion).IsRowVersion();

        b.ComplexProperty(o => o.ShipTo, a => a.ToJson());            // EF 10: value object as a JSON column

        b.HasMany(o => o.Lines).WithOne().HasForeignKey(l => l.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(o => o.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);   // private List<OrderLine> _lines

        b.HasIndex(o => new { o.CustomerId, o.PlacedAt })
            .IsDescending(false, true)
            .IncludeProperties(o => new { o.Status, o.Total, o.Currency });

        b.HasQueryFilter("NotDeleted", o => !o.IsDeleted);            // EF 10 named filter
    }
}
```
Reviewing a generated migration:
```csharp
public partial class RenameNoteToDeliveryNote : Migration
{
    protected override void Up(MigrationBuilder m)
    {
        // generated: DropColumn("Note") + AddColumn("DeliveryNote")  → data loss
        m.RenameColumn(name: "Note", table: "Orders", newName: "DeliveryNote");   // fixed by hand
    }
    protected override void Down(MigrationBuilder m) =>
        m.RenameColumn(name: "DeliveryNote", table: "Orders", newName: "Note");
}
```
`.github/workflows/ci.yml` (excerpt)
```yaml
- run: dotnet tool restore
- run: dotnet ef migrations has-pending-model-changes -p src/Shop.Infrastructure -s src/Shop.Api   # fails if a migration is missing
- run: dotnet ef migrations bundle -p src/Shop.Infrastructure -s src/Shop.Api --self-contained -r linux-x64 -o out/efbundle
```

## Production patterns
- One `IEntityTypeConfiguration<T>` per entity; conventions for defaults (decimal precision, string lengths).
- Tracked queries only where you change data; `AsNoTracking` + projection for reads.
- Migrations reviewed as SQL in PRs; applied by a bundle in the pipeline; `has-pending-model-changes` in CI.
- Expand/contract for every schema change that touches columns in use.

## Mistakes
Wrong: `db.Database.Migrate()` in `Program.cs` for production.
Right: migration bundle step before rolling out the new app version.

Wrong: `EnsureCreated()` anywhere but throwaway prototypes.
Right: migrations from day one (tests use `MigrateAsync` too, 01-foundations/03).

## Check yourself
1. Why is `DbContext` registered as scoped?
2. What does `ExecuteUpdateAsync` skip compared to loading and saving entities?
3. Why apply migrations in the pipeline rather than at startup?

<details><summary>Answers</summary>

1. It tracks entities for one unit of work and isn't thread-safe; a request is the natural unit.
2. Loading entities, change tracking, and `SaveChanges`; it sends one set-based `UPDATE` directly (also bypassing concurrency tokens and domain logic in the entity).
3. Several replicas starting at once would race to migrate, startup becomes slow and fragile, and failures aren't visible as a separate, gated deploy step.
</details>

## Sources
- [EF Core — DbContext lifetime and configuration](https://learn.microsoft.com/ef/core/dbcontext-configuration/)
- [EF Core — Creating and configuring a model](https://learn.microsoft.com/ef/core/modeling/)
- [EF Core — Complex types / JSON (EF 10)](https://learn.microsoft.com/ef/core/what-is-new/ef-core-10.0/whatsnew)
- [EF Core — Migrations overview](https://learn.microsoft.com/ef/core/managing-schemas/migrations/)
- [EF Core — Applying migrations (bundles)](https://learn.microsoft.com/ef/core/managing-schemas/migrations/applying)
- [EF Core — ExecuteUpdate/ExecuteDelete](https://learn.microsoft.com/ef/core/saving/execute-insert-update-delete)
