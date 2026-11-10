---
title: How .NET runs code, the dotnet CLI, and release lines
tech: .NET 10 SDK, CLR, MSBuild
version: .NET 10.0.14, SDK 10.0.402
date: 2026-11-09
covers: [1, 2, 15]
---
# How .NET runs code, the dotnet CLI, and release lines
[← Overview](00-overview.md)

## Why it matters
- A container image is built on `mcr.microsoft.com/dotnet/aspnet:8.0`; .NET 8 goes out of support on 10 November 2026 and stops getting security patches.
- A developer's machine has SDK 10.0.300 and CI uses 10.0.100; a build warning in one breaks `TreatWarningsAsErrors` in the other.
- Someone turns on Native AOT for the API "for performance"; EF Core queries and some reflection-based libraries fail at runtime.

## Concepts

### From C# to running code
| Stage | What happens |
|:--|:--|
| compile | Roslyn turns C# into **IL** (intermediate language) + metadata in a `.dll` (an assembly) |
| load | the **CLR** (Common Language Runtime) loads assemblies, verifies types |
| JIT | methods are compiled to machine code on first call |
| tiered compilation | tier 0: fast, unoptimized code first; hot methods are recompiled at tier 1 with optimizations |
| Dynamic PGO | the runtime profiles real execution and optimizes for it (on by default) |
| ReadyToRun (R2R) | precompiled code in the assembly for faster startup; JIT still available |
| ⭐ Native AOT | publish to a native executable: no JIT, fast startup, small memory; requires trimming-safe code (no runtime code generation, limited reflection) |

For a web API, the default (JIT + tiering + PGO) gives the best steady-state throughput. Native AOT fits small, startup-sensitive services (functions, sidecars) built with `WebApplication.CreateSlimBuilder` and source-generated JSON; EF Core and many libraries aren't fully AOT-compatible yet.

### SDK vs runtime
| Piece | Contains | Where you need it |
|:--|:--|:--|
| SDK | `dotnet` CLI, compilers, MSBuild, templates | dev machines, CI, build stage of Docker images |
| .NET runtime | CLR + base class library | anything running .NET |
| ASP.NET Core runtime | runtime + `Microsoft.AspNetCore.App` shared framework | web apps (the `aspnet` container image) |

`dotnet --info`, `dotnet --list-sdks`, `dotnet --list-runtimes` show what's installed.

### Projects and the `dotnet` CLI
SDK-style project:
```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" />
    <ProjectReference Include="..\Shop.Domain\Shop.Domain.csproj" />
  </ItemGroup>
</Project>
```
(Shared properties like `TargetFramework` and `Nullable` live in `Directory.Build.props`, versions in `Directory.Packages.props`; see 01-foundations/05-code-quality.)

| Command | Does |
|:--|:--|
| `dotnet new list` / `dotnet new webapi -n Shop.Api` | templates |
| `dotnet new sln` / `dotnet sln add` | `.slnx` solution |
| `dotnet package add Polly.Core` (or `dotnet add package`) | add a NuGet package |
| `dotnet reference add ../Shop.Domain` | project reference |
| `dotnet restore` / `build` / `test` / `run` | the inner loop |
| ⭐ `dotnet watch` | rebuild/hot reload on change |
| `dotnet publish -c Release -o out` | deployable output |
| `dotnet tool install -g dotnet-ef` | global tools (`dotnet tool restore` for local tool manifests) |
| `dotnet run app.cs` | file-based app (.NET 10): one C# file, `#:package` directives, no project |
| `dotnet format` | code style (01-foundations/05) |

Project SDKs: `Microsoft.NET.Sdk` (libraries, console), `Microsoft.NET.Sdk.Web` (ASP.NET Core), `Microsoft.NET.Sdk.Worker` (background services).

### Release lines and upgrades
| Release | Support | Examples |
|:--|:--|:--|
| ⭐ LTS (even versions) | 3 years | .NET 8 (ends 2026-11-10), .NET 10 (ends 2028-11) |
| STS (odd versions) | 2 years (extended from 18 months) | .NET 9 (ends 2026-11-10), .NET 11 (Nov 2026 → ~Nov 2028) |
| patches | monthly ("Patch Tuesday") | 10.0.13 → 10.0.14 |

`global.json` pins the SDK:
```json
{ "sdk": { "version": "10.0.402", "rollForward": "latestFeature" } }
```
| `rollForward` | Allows |
|:--|:--|
| `patch` / `latestPatch` | same feature band (10.0.4xx) |
| `feature` / `latestFeature` | newer feature bands of 10.0 |
| `minor`, `major`, `latestMajor` | more permissive |
| `disable` | exact version |

Upgrading a target framework: change `<TargetFramework>net10.0</TargetFramework>`, update packages (EF Core, ASP.NET Core packages match the runtime major), read the "breaking changes in .NET 10" pages, run tests, update container base images. Also seen: .NET Upgrade Assistant, GitHub Copilot app modernization.

## Example
`terminal`
```bash
dotnet --list-sdks
dotnet new globaljson --sdk-version 10.0.402 --roll-forward latestFeature
dotnet new webapi -n Shop.Api -o src/Shop.Api
dotnet new classlib -n Shop.Domain -o src/Shop.Domain
dotnet new sln -n Shop && dotnet sln add src/Shop.Api src/Shop.Domain
dotnet reference add src/Shop.Domain --project src/Shop.Api
dotnet watch --project src/Shop.Api
```
`scripts/check-prices.cs` (file-based app, .NET 10)
```csharp
#:package Spectre.Console@0.*

using Spectre.Console;

var prices = new Dictionary<string, decimal> { ["COF-1"] = 13.50m, ["COF-2"] = 9.90m };
foreach (var (sku, price) in prices)
    AnsiConsole.MarkupLine($"[green]{sku}[/] {price:C}");
```
```bash
dotnet run scripts/check-prices.cs
```

## Production patterns
- Pin the SDK with `global.json`; build images and CI from the same SDK feature band.
- Stay on LTS for services; schedule the major upgrade (.NET 10 → 12) well before end of support.
- Rebuild container images at least monthly so they pick up runtime patches.
- Use JIT for APIs by default; consider Native AOT only for small, AOT-compatible services.

## Mistakes
Wrong: targeting an out-of-support runtime.
```xml
<TargetFramework>net8.0</TargetFramework>   <!-- unsupported after 2026-11-10 -->
```
Right: `net10.0` and a plan for the next LTS.

Wrong: `dotnet run` in production containers.
Right: `dotnet publish` in a build stage, run `dotnet Shop.Api.dll` (or the apphost) on the runtime image.

## Check yourself
1. What is IL, and when does it become machine code?
2. What's the difference between the SDK and the ASP.NET Core runtime?
3. Which `rollForward` value lets a newer 10.0 feature band SDK be used?

<details><summary>Answers</summary>

1. The intermediate language Roslyn compiles C# to; the JIT compiles each method to machine code at runtime (or ahead of time with R2R/Native AOT).
2. The SDK builds apps (CLI, compilers, MSBuild); the ASP.NET Core runtime runs them (CLR, BCL, and the ASP.NET Core shared framework).
3. `latestFeature` (or `feature`).
</details>

## Sources
- [.NET glossary and architecture](https://learn.microsoft.com/dotnet/standard/glossary)
- [Managed execution process](https://learn.microsoft.com/dotnet/standard/managed-execution-process)
- [Native AOT deployment](https://learn.microsoft.com/dotnet/core/deploying/native-aot/)
- [dotnet CLI overview](https://learn.microsoft.com/dotnet/core/tools/)
- [File-based apps (.NET 10)](https://learn.microsoft.com/dotnet/core/sdk/file-based-apps)
- [.NET support policy](https://dotnet.microsoft.com/platform/support/policy/dotnet-core)
