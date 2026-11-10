---
title: Code Quality & Tooling cheatsheet
tech: .NET analyzers, .editorconfig, dotnet format, C# 14 (nullable)
version: .NET SDK 10.0.402, C# 14, CSharpier 1.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
---
# Code Quality & Tooling cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Shared build files
| File | What it holds | Note |
|:--|:--|:--|
| ⭐ `Directory.Build.props` | shared MSBuild properties | nearest one only |
| `Directory.Build.targets` | late targets/items | |
| ⭐ `Directory.Packages.props` | central package versions | `dotnet new packagesprops` |
| ⭐ `global.json` | SDK version, test runner | `dotnet new globaljson` |
| ⭐ `.editorconfig` | style + rule severities | `dotnet new editorconfig` |
| `nuget.config` | sources, source mapping | |
| ⭐ `*.slnx` | XML solution | .NET 10 default |
| `dotnet sln migrate` | `.sln` → `.slnx` | |
| `GetPathOfFileAbove` | import parent props | nested folders |

## MSBuild properties
| Property | Value | Effect |
|:--|:--|:--|
| ⭐ `Nullable` | `enable` | nullable reference types |
| ⭐ `TreatWarningsAsErrors` | `true` | warnings fail build |
| `WarningsAsErrors` | `nullable` | only nullable as errors |
| `WarningsNotAsErrors` | `NU1901;…` | keep visible, not fatal |
| `NoWarn` | `$(NoWarn);CS1591` | silence (rarely) |
| ⭐ `AnalysisLevel` | `latest-recommended` | CA rule set + mode |
| `AnalysisMode` | `Recommended` / `All` | how many rules |
| `AnalysisModeSecurity` | `All` | per category |
| ⭐ `EnforceCodeStyleInBuild` | `true` | IDE rules on build |
| `GenerateDocumentationFile` | `true` | needed for IDE0005 on build |
| `ImplicitUsings` | `enable` | global usings |
| `LangVersion` | `14` | C# version (default for net10.0) |
| `ContinuousIntegrationBuild` | `true` in CI | deterministic |
| `RestorePackagesWithLockFile` | `true` | lock files |

## Central Package Management
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `ManagePackageVersionsCentrally` | turn on CPM | |
| ⭐ `<PackageVersion Include Version>` | one version per package | |
| `<PackageReference Include>` (no Version) | use in project | |
| `CentralPackageTransitivePinningEnabled` | pin transitives | patch vulnerable deps |
| `VersionOverride` | per-project exception | tech debt |
| `GlobalPackageReference` | add to every project | analyzers |
| `PrivateAssets="all"` | don't flow to consumers | analyzers, tools |

## Nullable
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ `string` / `string?` | non-null / maybe null | compile-time only |
| CS8602 | possible null dereference | |
| CS8618 | uninitialized non-nullable | ctor or `required` |
| CS8603 / CS8604 | null return / argument | |
| ⭐ `required` | caller must set | C# 11 |
| `init` | set only at creation | |
| `[SetsRequiredMembers]` | ctor sets all required | |
| ⭐ `ArgumentNullException.ThrowIfNull(x)` | guard | |
| `ArgumentException.ThrowIfNullOrEmpty(s)` | string guard | |
| ⭐ `[NotNullWhen(true)]` | Try-pattern out param | |
| `[MemberNotNull(nameof(f))]` | method sets field | |
| `[MaybeNull]` / `[AllowNull]` / `[DisallowNull]` / `[NotNull]` | generic edge cases | |
| `!` | null-forgiving | review flag |
| `#nullable enable` | per file | gradual adoption |
| `RespectNullableAnnotations` | JSON honours `?` | .NET 9+ |

## Boundaries and patterns
| Item | Use | Note |
|:--|:--|:--|
| DTO records | request/response shapes | |
| ⭐ validate at the edge | HTTP, config, queues, files | then trust types |
| `is null` / `is not null` | null checks | not `== null` on overloaded types |
| property pattern | `x is { Length: > 0 }` | |
| ⭐ `switch` expression | exhaustive mapping | CS8509 |
| `is { } value` | non-null capture | |
| list patterns | `[first, .. var rest]` | C# 11 |

## Analyzer rules that catch bugs
| Rule | Catches | Fix |
|:--|:--|:--|
| ⭐ CS4014 / VSTHRD110 | un-awaited task | `await` |
| ⭐ VSTHRD100 | `async void` | `async Task` |
| CA1849 / VSTHRD002 | blocking on async | await async API |
| ⭐ CA2016 | dropped `CancellationToken` | pass `ct` |
| CA2012 | `ValueTask` misuse | await once |
| ⭐ CA2000 | not disposed | `using` |
| CA2213 / CA1816 | disposable fields / `Dispose` pattern | |
| ⭐ CA1304 / CA1305 / CA1309 / CA1310 / CA1311 | culture bugs | Ordinal, InvariantCulture |
| CS8509 | non-exhaustive switch expression | add cases |
| IDE0010 / IDE0072 | missing switch cases | populate |
| CA2100 | SQL from strings | parameters |
| CA2300–CA2330 | insecure deserializers | System.Text.Json |
| CA5350 / CA5351 | weak crypto | SHA-256, AES-GCM |
| CA2254 | interpolated log message | templates |
| CA1848 | slow logging calls | `[LoggerMessage]` |
| CA2007 | `ConfigureAwait` | `none` in apps |
| CA1822 | could be static | |

## Code style (IDE) rules
| Rule | What | Note |
|:--|:--|:--|
| ⭐ IDE0005 | unnecessary usings | needs doc file |
| IDE0161 | file-scoped namespaces | |
| IDE0051 / IDE0052 | unused / unread private member | dead code |
| IDE0060 | unused parameter | |
| IDE0090 | `new()` target-typed | |
| IDE0290 | primary constructor | C# 12 |
| IDE0300–IDE0305 | collection expressions | C# 12 |
| IDE0008 / IDE0007 | explicit vs `var` | team choice |
| IDE0055 | formatting | `dotnet format whitespace` |

## .editorconfig syntax
| Line | Effect | Note |
|:--|:--|:--|
| `root = true` | stop searching parents | top file |
| `[*.cs]` | section for C# | globs |
| ⭐ `dotnet_diagnostic.CA2016.severity = error` | one rule | error/warning/suggestion/silent/none |
| `dotnet_analyzer_diagnostic.category-Security.severity = error` | a category | |
| `csharp_style_namespace_declarations = file_scoped:warning` | style + severity | |
| `dotnet_sort_system_directives_first = true` | using order | |
| `[tests/**.cs]` | folder-specific | relax in tests |
| `generated_code = true` | skip analysis | generated files |

## Third-party analyzers
| Package | Adds | Note |
|:--|:--|:--|
| ⭐ Microsoft.VisualStudio.Threading.Analyzers | async correctness | VSTHRD |
| Meziantou.Analyzer | practical correctness/perf | |
| Roslynator.Analyzers | refactorings + style | |
| SonarAnalyzer.CSharp | bugs, smells, hotspots | |
| StyleCop.Analyzers | strict style | heavy |
| xunit.analyzers | test mistakes | with xUnit |
| NSubstitute.Analyzers.CSharp | substitute misuse | |

## dotnet format
| Command | Does | Note |
|:--|:--|:--|
| ⭐ `dotnet format` | whitespace + style + analyzers | |
| `dotnet format whitespace` | layout only | no build, fast |
| `dotnet format style` | IDE rules | |
| `dotnet format analyzers` | CA/3rd-party fixes | |
| ⭐ `--verify-no-changes` | CI check | non-zero exit |
| `--severity warn` | minimum severity | |
| `--diagnostics IDE0005` | only listed rules | codemods |
| `--include` / `--exclude` | paths | hooks |
| `--no-restore` | skip restore | CI |

## CSharpier
| Command | Does | Note |
|:--|:--|:--|
| `dotnet tool install csharpier` | local tool | |
| `dotnet csharpier format .` | reformat | 1.0 CLI |
| `dotnet csharpier check .` | CI check | |
| `.csharpierrc` | few options (print width) | |
| one layout owner | CSharpier or dotnet format style | not both |

## Editors
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ C# Dev Kit (VS Code) | solution explorer, tests, debugging | VS Community licence terms |
| C# extension | Roslyn language server | open source |
| Visual Studio 2026 | full IDE, profiler | Community free for individuals |
| `editor.formatOnSave` | format on save | VS Code |
| `.vscode/extensions.json` | recommended extensions | commit it |
| Code Cleanup on save | VS formatting profile | |
| Rider | JetBrains IDE | also seen |

## Hooks and gates
| Item | What it does | Note |
|:--|:--|:--|
| `core.hooksPath .githooks` | versioned hooks | per clone |
| pre-commit: format staged `.cs` | seconds | `--include $files` |
| pre-commit: `gitleaks git --staged` | secrets | |
| Husky.Net | hook installer | also seen |
| ⭐ CI: `dotnet format --verify-no-changes` | format gate | |
| ⭐ CI: build with warnings as errors | analyzer gate | |
| CI: `pnpm lint` / `format:check` / `typecheck` | frontend gate | |
| gate job | one required check | 04-ci-cd |

## Review, dead code, dependencies
| Item | Use | Note |
|:--|:--|:--|
| ⭐ naming | PascalCase / camelCase / `_field` / `Async` / `I` | |
| bool flag params | split methods or enum | |
| comments | why, not what | |
| ⭐ `internal sealed` by default | small API, visible dead code | |
| `dotnet package list --outdated` | outdated | .NET 10 noun-first |
| ⭐ `dotnet package list --vulnerable --include-transitive` | vulnerabilities | |
| `dotnet nuget why <proj> <pkg>` | dependency chain | |
| `dotnet package add` / `remove` | manage packages | |
| licence check | commercial packages | MediatR, AutoMapper, MassTransit, FluentAssertions |

## Tech debt tools
| Tool | Scope | Note |
|:--|:--|:--|
| `#pragma warning disable X // reason` | lines | restore after |
| ⭐ `[SuppressMessage(..., Justification = "")]` | member | |
| `GlobalSuppressions.cs` | project, targeted | review it |
| folder `.editorconfig` severity | area | issue + date |
| `<Nullable>warnings</Nullable>` | nullable migration step | |
| baseline | allow existing, fail new | burn down |
| Fix all in solution | IDE code fix | |
| .NET Upgrade Assistant | framework upgrades | also: Copilot app modernization |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `= null!` on optional data | hides real nulls | `string?` |
| Nested Directory.Build.props | parent settings lost | import parent |
| Versions in each csproj | drift | CPM |
| IDE0005 not on build | missing doc file | `GenerateDocumentationFile` |
| `ToUpper()` comparisons | Turkish-i | `OrdinalIgnoreCase` |
| `_ = SomethingAsync()` in requests | silent failures | await or queue |
| Two formatters | diff ping-pong | one layout owner |
| `<NoWarn>` lists | hides bugs | fix or scoped suppression |
| Slow hooks | skipped | CI does heavy checks |

## Sources
| Source | Link |
|:--|:--|
| Code analysis | https://learn.microsoft.com/dotnet/fundamentals/code-analysis/overview |
| CA rules | https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/ |
| Code-style rules | https://learn.microsoft.com/dotnet/fundamentals/code-analysis/style-rules/ |
| Nullable reference types | https://learn.microsoft.com/dotnet/csharp/nullable-references |
| dotnet format | https://learn.microsoft.com/dotnet/core/tools/dotnet-format |
| Central Package Management | https://learn.microsoft.com/nuget/consume-packages/central-package-management |
| Directory.Build.props | https://learn.microsoft.com/visualstudio/msbuild/customize-by-directory |
| VS Threading analyzers | https://github.com/microsoft/vs-threading/blob/main/doc/analyzers/index.md |
| CSharpier | https://csharpier.com/ |
