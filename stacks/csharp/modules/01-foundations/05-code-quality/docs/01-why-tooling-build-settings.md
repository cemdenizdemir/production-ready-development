---
title: Why tooling, and shared build settings
tech: MSBuild, NuGet Central Package Management, .slnx, .NET 10 SDK
version: .NET SDK 10.0.402
date: 2026-11-09
covers: [1, 13, 14]
---
# Why tooling, and shared build settings
[← Overview](00-overview.md)

## Why it matters
- One project has `<Nullable>enable</Nullable>`, four don't. A null bug crosses a project boundary that nobody thought was unsafe.
- `Microsoft.EntityFrameworkCore` is 10.0.2 in the API and 10.0.0 in the worker. A fix in 10.0.2 is "deployed" but the worker still crashes.
- The web app's lint passes in CI, but the .NET build is never gated; the repo has two quality levels.

## Concepts

### Why tooling
| Without | With |
|:--|:--|
| style debated in every PR | `.editorconfig` + `dotnet format` decide |
| null crashes found in production | nullable warnings at compile time |
| bugs found by reviewers (if they notice) | analyzers flag them in the editor |
| each project configured differently | one `Directory.Build.props` |
| "works on my machine" | same SDK (`global.json`) and same rules in CI |

Tooling is cheap reviewers that never get tired. Humans then review design and behavior.

### Shared build files
MSBuild picks up these files automatically from the project's folder and every parent folder:
| File | Imported | Holds |
|:--|:--|:--|
| `Directory.Build.props` | early (before the project body) | properties: framework, nullable, analyzers, warnings |
| `Directory.Build.targets` | late (after the project body) | targets and items that depend on project values |
| `Directory.Packages.props` | by NuGet | central package versions |
| `global.json` | by the `dotnet` host | SDK version, test runner |
| `.editorconfig` | by compiler/IDE | style and analyzer severities |
| `nuget.config` | by NuGet | package sources, source mapping |

Only the nearest `Directory.Build.props` is imported. A nested one must import its parent explicitly:
```xml
<Import Project="$([MSBuild]::GetPathOfFileAbove('Directory.Build.props', '$(MSBuildThisFileDirectory)../'))" />
```

### Central Package Management (CPM)
`Directory.Packages.props`
```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
    <CentralPackageTransitivePinningEnabled>true</CentralPackageTransitivePinningEnabled>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.2" />
    <PackageVersion Include="FluentValidation" Version="12.1.0" />
    <PackageVersion Include="Shouldly" Version="4.3.0" />
    <PackageVersion Include="xunit.v3" Version="3.2.2" />
  </ItemGroup>
</Project>
```
Projects reference packages without versions:
```xml
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" />
```
- `CentralPackageTransitivePinningEnabled` lets a `PackageVersion` also pin a transitive dependency (e.g. to force a patched version).
- `VersionOverride="…"` on a reference is the escape hatch; treat it as tech debt.
- Version numbers above are examples; check current versions with `dotnet package list --outdated`.

### The solution file: `.slnx`
```xml
<Solution>
  <Folder Name="/src/">
    <Project Path="src/Shop.Api/Shop.Api.csproj" />
    <Project Path="src/Shop.Domain/Shop.Domain.csproj" />
  </Folder>
  <Folder Name="/tests/">
    <Project Path="tests/Shop.Domain.Tests/Shop.Domain.Tests.csproj" />
  </Folder>
</Solution>
```
XML, readable, few merge conflicts. .NET 10 creates it by default; `dotnet sln migrate` converts `.sln`.

### One repo, two toolchains
```text
shop/
  global.json  Directory.Build.props  Directory.Packages.props  .editorconfig  Shop.slnx
  src/  tests/                      # .NET: dotnet build / format / test
  web/  package.json  pnpm-lock.yaml  eslint.config.mjs  .prettierrc   # Next.js: pnpm lint / format / test
```
- The frontend keeps the TypeScript stack's ESLint + typescript-eslint + Prettier setup unchanged.
- CI has one job per toolchain and one gate job requiring both (04-ci-cd lesson 03).
- `.editorconfig` can hold settings for both (`[*.cs]` and `[*.{ts,tsx}]` sections); Prettier reads `indent_style`/`indent_size`.

## Example
`Directory.Build.props`
```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>14</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <NoWarn>$(NoWarn);CS1591</NoWarn>              <!-- don't require XML docs on every public member -->
    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  </PropertyGroup>
</Project>
```
`terminal`
```bash
dotnet new globaljson --sdk-version 10.0.402 --roll-forward latestFeature
dotnet new packagesprops
dotnet new sln -n Shop                # .slnx in .NET 10
dotnet sln add src/**/*.csproj tests/**/*.csproj
dotnet build                          # every project now shares the same rules
```

## Production patterns
- Put every shared setting in `Directory.Build.props`; a `.csproj` should mostly list references.
- Turn on CPM from the first project; migrating 30 projects later is a chore.
- Keep test-only settings in `tests/Directory.Build.props` (importing the parent), e.g. `<IsPackable>false</IsPackable>`.
- `GenerateDocumentationFile` is needed for `IDE0005` (unused usings) to run on build; suppress `CS1591` unless you want docs on everything.

## Mistakes
Wrong: versions in every project.
```xml
<PackageReference Include="Serilog" Version="4.2.0" />   <!-- and 4.0.1 in another project -->
```
Right: one `PackageVersion` in `Directory.Packages.props`, references without `Version`.

Wrong: a nested `Directory.Build.props` that silently drops the root settings.
Right: import the parent file first.

## Check yourself
1. What is the difference between `Directory.Build.props` and `Directory.Build.targets`?
2. What does `CentralPackageTransitivePinningEnabled` allow?
3. A folder has its own `Directory.Build.props`. Does MSBuild also import the one in the repo root?

<details><summary>Answers</summary>

1. `.props` is imported before the project's content (set defaults); `.targets` after it (use or override final values, add targets).
2. Pinning transitive dependencies to the central version, for example to force a patched package.
3. No, only the nearest one, unless it imports the parent explicitly.
</details>

## Sources
- [Customize your build (Directory.Build.props)](https://learn.microsoft.com/visualstudio/msbuild/customize-by-directory)
- [Central Package Management](https://learn.microsoft.com/nuget/consume-packages/central-package-management)
- [dotnet sln (.slnx)](https://learn.microsoft.com/dotnet/core/tools/dotnet-sln)
- [global.json overview](https://learn.microsoft.com/dotnet/core/tools/global-json)
