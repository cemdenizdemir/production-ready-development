---
title: Injection, safe deserialization, SSRF, paths, and uploads
tech: EF Core 10, Dapper, System.Text.Json, ASP.NET Core 10
version: .NET 10, EF Core 10
date: 2026-11-09
covers: [3, 9, 14]
---
# Injection, safe deserialization, SSRF, paths, and uploads
[← Overview](00-overview.md)

## Why it matters
- A search endpoint builds `FromSqlRaw("... WHERE Name LIKE '%" + q + "%'")`. `q = "'; DROP TABLE Orders;--"` ends the day.
- A "fetch product image from URL" feature lets users request `http://169.254.169.254/metadata/identity/oauth2/token`, and the server returns its own managed identity token.
- A download endpoint serves `Path.Combine(root, name)`; `name = "../../appsettings.Production.json"` works.
- A message consumer uses a serializer with type-name handling; a crafted payload instantiates a gadget type and runs code.

## Concepts

### SQL injection in EF Core and Dapper
| API | Safe? | Why |
|:--|:--|:--|
| LINQ (`Where(o => o.Sku == sku)`) | ✓ | parameterized |
| `FromSql($"... {sku}")` / `SqlQuery<T>($"...")` / `ExecuteSql($"...")` | ✓ | interpolation becomes `DbParameter`s |
| `FromSqlRaw("... {0}", sku)` | ✓ | positional parameters |
| `FromSqlRaw("... '" + sku + "'")` | ✗ | string concatenation |
| `FromSqlRaw($"... {sku}")` | ✗ | interpolation is just a string here |
| Dapper `QueryAsync<T>("... WHERE Sku = @sku", new { sku })` | ✓ | parameters |
| dynamic `ORDER BY {column}` | ✗ unless allowlisted | identifiers can't be parameters |

Identifiers (column names, sort direction) must come from an allowlist:
```csharp
var orderBy = sort switch { "price" => "Price", "name" => "Name", _ => "CreatedAt" };
```
Analyzer CA2100 and CodeQL flag SQL built from strings.

### Command and other injections
| Sink | Safe pattern |
|:--|:--|
| `Process.Start("sh", "-c convert " + file)` | `new ProcessStartInfo("convert") { ArgumentList = { inputPath, outputPath } }`, no shell |
| LDAP filters | encode with `LdapFilterEncode` equivalents; prefer directory SDK queries |
| XPath | parameterized `XsltArgumentList` / avoid building from input |
| log injection | structured logging (`{Sku}` placeholders) escapes values per sink |
| HTTP header injection | ASP.NET Core rejects CR/LF in header values |

### Safe deserialization
| Serializer | Risk | Rule |
|:--|:--|:--|
| `BinaryFormatter`, `SoapFormatter`, `NetDataContractSerializer` | remote code execution | removed/obsolete; never use |
| Newtonsoft.Json `TypeNameHandling` ≠ `None` | gadget chains | keep `None`; if needed, a strict `SerializationBinder` |
| ⭐ System.Text.Json | no type info from payload by default | polymorphism only via allowlisted `[JsonDerivedType]` |
| `XmlSerializer` / `XmlReader` | XXE (entities), billion laughs | `DtdProcessing.Prohibit` (default for `XmlReader.Create` in .NET) |
| `DataContractSerializer` with known types | moderate | keep known types fixed |

Limit size and depth too: Kestrel body size, `JsonSerializerOptions.MaxDepth` (default 64), collection sizes in validation.

```csharp
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(CardPayment), "card")]
[JsonDerivedType(typeof(BankPayment), "bank")]
public abstract record Payment(decimal Amount);
```
Unknown discriminators fail deserialization instead of loading an arbitrary type.

### SSRF (server-side request forgery)
When the server fetches a URL from user input:
1. Parse with `Uri.TryCreate(..., UriKind.Absolute)`, allow only `https`.
2. Allowlist hosts if at all possible.
3. Otherwise resolve DNS and reject private, loopback, link-local, and metadata ranges (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fc00::/7`).
4. Check the IP **at connect time** (`SocketsHttpHandler.ConnectCallback`) to defeat DNS rebinding.
5. Disable redirects or re-check each hop; set short timeouts and a max response size.

### Path traversal and uploads
| Risk | Control |
|:--|:--|
| `../` in names | `Path.GetFileName(name)` or IDs instead of names; check `Path.GetFullPath(combined).StartsWith(root + Path.DirectorySeparatorChar)` |
| executable uploads served back | store outside web root (Blob Storage), serve with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` |
| huge files | request size limits per endpoint, streaming, quotas |
| fake extensions | check magic bytes, not just extension or `Content-Type` |
| malware | scan (Defender for Storage) before making files available |
| overwrites | random server-side names (`Guid.CreateVersion7()`) |

## Example
`src/Shop.Api/Endpoints/Files.cs`
```csharp
public static class FileEndpoints
{
    private static readonly string Root = Path.GetFullPath("/data/exports");

    public static IResult Download(string name)
    {
        var safeName = Path.GetFileName(name);                  // drops any directory part
        var full = Path.GetFullPath(Path.Combine(Root, safeName));
        if (!full.StartsWith(Root + Path.DirectorySeparatorChar, StringComparison.Ordinal) || !File.Exists(full))
            return TypedResults.NotFound();
        return TypedResults.PhysicalFile(full, "text/csv", fileDownloadName: safeName);
    }
}
```
`src/Shop.Api/Data/OrderSearch.cs`
```csharp
public static Task<List<Order>> Search(ShopDb db, string q, string sort, CancellationToken ct)
{
    var column = sort switch { "price" => "Price", "sku" => "Sku", _ => "CreatedAt" };   // allowlist
    var pattern = $"%{q}%";
    return db.Orders
        .FromSql($"SELECT * FROM Orders WHERE Sku LIKE {pattern}")                    // parameterized
        .OrderBy(o => EF.Property<object>(o, column))
        .Take(50)
        .ToListAsync(ct);
}
```
SSRF guard on an outgoing client:
```csharp
builder.Services.AddHttpClient("image-fetch").ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
{
    AllowAutoRedirect = false,
    ConnectTimeout = TimeSpan.FromSeconds(5),
    ConnectCallback = async (ctx, ct) =>
    {
        var addresses = await Dns.GetHostAddressesAsync(ctx.DnsEndPoint.Host, ct);
        var ip = addresses.First();
        if (IPAddress.IsLoopback(ip) || IsPrivateOrLinkLocal(ip))
            throw new HttpRequestException("Blocked destination.");
        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        await socket.ConnectAsync(new IPEndPoint(ip, ctx.DnsEndPoint.Port), ct);
        return new NetworkStream(socket, ownsSocket: true);
    },
});
```
`IsPrivateOrLinkLocal` checks the ranges listed above (e.g. with `IPNetwork.Parse("10.0.0.0/8").Contains(ip)`).

## Production patterns
- Raw SQL only through `FromSql`/`SqlQuery`/`ExecuteSql` interpolation or Dapper parameters; ban `FromSqlRaw` with concatenation in review.
- System.Text.Json everywhere; polymorphism only with explicit derived-type allowlists.
- Features that fetch URLs get a dedicated `HttpClient` with SSRF checks, no redirects, small timeouts.
- Uploads go to Blob Storage with random names, never to the app's file system or web root.

## Mistakes
Wrong:
```csharp
db.Orders.FromSqlRaw($"SELECT * FROM Orders WHERE Sku = '{sku}'");
```
Right:
```csharp
db.Orders.FromSql($"SELECT * FROM Orders WHERE Sku = {sku}");
```

Wrong: checking the URL's host string against a blocklist (`!url.Host.Contains("169.254")`).
Right: resolve and check the IP at connect time, and prefer an allowlist.

## Check yourself
1. Why is `FromSql($"...")` safe but `FromSqlRaw($"...")` not?
2. What makes System.Text.Json safer than serializers with type-name handling?
3. Why check the IP in `ConnectCallback` instead of before sending the request?

<details><summary>Answers</summary>

1. `FromSql` takes a `FormattableString` and turns each hole into a parameter; `FromSqlRaw` receives an already-built string.
2. It never picks a .NET type from the payload unless you allowlist derived types with discriminators.
3. DNS can change between your check and the connection (DNS rebinding); checking at connect time validates the address actually used.
</details>

## Sources
- [EF Core — SQL queries](https://learn.microsoft.com/ef/core/querying/sql-queries)
- [OWASP — SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [BinaryFormatter removed from .NET 9](https://learn.microsoft.com/dotnet/standard/serialization/binaryformatter-migration-guide/)
- [System.Text.Json polymorphism](https://learn.microsoft.com/dotnet/standard/serialization/system-text-json/polymorphism)
- [OWASP — SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Upload files in ASP.NET Core](https://learn.microsoft.com/aspnet/core/mvc/models/file-uploads)
