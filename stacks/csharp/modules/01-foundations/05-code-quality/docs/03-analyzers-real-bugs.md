---
title: Roslyn analyzers and the rules that catch real bugs
tech: .NET analyzers (Microsoft.CodeAnalysis.NetAnalyzers), .editorconfig, C# 14
version: .NET SDK 10.0.402 (AnalysisLevel 10)
date: 2026-11-09
covers: [4, 5]
---
# Roslyn analyzers and the rules that catch real bugs
[← Overview](00-overview.md)

## Why it matters
- `_ = SendEmailAsync(order);` in a controller: the request finishes, the scope is disposed, and the email fails silently 2% of the time.
- `async void OnOrderPlaced(...)` throws; the exception crashes the whole process.
- `code.ToUpper() == "İSTANBUL"` passes on a developer's machine and fails for users with a Turkish culture.
- A `SqlConnection` created in a helper is never disposed; the pool runs dry at peak load.

## Concepts

### Analyzers in the SDK
The .NET SDK ships the Roslyn .NET analyzers (CA rules) and code-style analyzers (IDE rules). You choose how many are on and how loud they are.

| Property | Values | Effect |
|:--|:--|:--|
| `AnalysisLevel` | `latest`, `10.0`, `latest-minimum`, `latest-recommended`, `latest-all` | rule set version + mode in one |
| `AnalysisMode` | `Default`, `Minimum`, `Recommended`, `All`, `None` | how many CA rules are enabled as warnings |
| `AnalysisMode<Category>` | e.g. `AnalysisModeSecurity=All` | per category: Design, Globalization, Performance, Reliability, Security, Usage… |
| `EnforceCodeStyleInBuild` | `true` | IDE rules (style) run on build, not just in the editor |
| `CodeAnalysisTreatWarningsAsErrors` | `true`/`false` | CA warnings as errors (with `TreatWarningsAsErrors`) |

`latest-recommended` is a good default for new apps; add `All` for the Security and Reliability categories.

### Severities in `.editorconfig`
```ini
[*.cs]
dotnet_diagnostic.CA2007.severity = none          # ConfigureAwait: not needed in ASP.NET Core apps
dotnet_diagnostic.CA1848.severity = suggestion    # LoggerMessage delegates: nice, not blocking
dotnet_diagnostic.CA2016.severity = error         # forward CancellationToken
dotnet_diagnostic.IDE0010.severity = warning      # add missing switch cases
dotnet_analyzer_diagnostic.category-Security.severity = error
```
Severity levels: `error`, `warning`, `suggestion`, `silent`, `none`. Folder-level `.editorconfig` files can relax rules for tests or generated code.

### Rules that prevent real bugs
| Bug | Rule(s) | Fix |
|:--|:--|:--|
| un-awaited task in async method | CS4014, VSTHRD110 | `await` it, or hand it to a background queue |
| `async void` | VSTHRD100 (Threading analyzers) | `async Task`; only event handlers may be `async void` |
| sync over async | CA1849, VSTHRD002 | call the async version (`await ...Async()`) |
| dropped `CancellationToken` | CA2016 | pass `ct` to every call that accepts one |
| misused `ValueTask` | CA2012 | await it once, don't store it |
| not disposing | CA2000, CA1816, CA2213 | `using` declarations; dispose fields |
| culture-sensitive strings | CA1304, CA1305, CA1309, CA1310, CA1311 | `StringComparison.Ordinal(IgnoreCase)`, `CultureInfo.InvariantCulture`, `ToUpperInvariant()` |
| non-exhaustive `switch` expression | CS8509 (on by default) | add cases; avoid `_` when you want new enum values to fail the build |
| missing `switch` statement cases | IDE0010 / IDE0072 | populate cases |
| SQL injection via string concat | CA2100 | parameters (`FromSql($"...")` interpolation is parameterized) |
| insecure deserialization | CA2300–CA2330 (`BinaryFormatter` & co.) | `System.Text.Json` |
| weak crypto | CA5350, CA5351 | SHA-256+, AES-GCM, `RandomNumberGenerator` |
| logging string interpolation | CA2254 | message templates: `"Order {OrderId}"` |

### Third-party analyzers worth knowing
| Package | Adds |
|:--|:--|
| `Microsoft.VisualStudio.Threading.Analyzers` | ⭐ async correctness (VSTHRD rules) |
| `Meziantou.Analyzer` | many practical correctness and performance rules |
| `Roslynator.Analyzers` | 500+ refactorings and style rules |
| `SonarAnalyzer.CSharp` | bugs, code smells, security hotspots |
| `StyleCop.Analyzers` | strict style; heavy, many teams skip it |
| `xunit.analyzers` | test mistakes (comes with xUnit) |

Add them in `Directory.Build.props` with `PrivateAssets="all"` so they don't flow to consumers:
```xml
<ItemGroup>
  <PackageReference Include="Microsoft.VisualStudio.Threading.Analyzers" PrivateAssets="all" />
  <PackageReference Include="Meziantou.Analyzer" PrivateAssets="all" />
</ItemGroup>
```

## Example
Before (four bugs that the compiler alone won't stop):
```csharp
public class OrderNotifier(IEmailSender email, ILogger<OrderNotifier> log)
{
    public async void OnPlaced(Order order)                                    // VSTHRD100
    {
        email.SendAsync(order.CustomerEmail, $"Order {order.Id}");               // CS4014 / VSTHRD110
        if (order.Country.ToUpper() == "TR") log.LogInformation($"TR order {order.Id}"); // CA1304, CA2254
        var conn = new SqlConnection(_cs); conn.Open();                           // CA2000
    }
}
```
After:
```csharp
public sealed class OrderNotifier(IEmailSender email, ILogger<OrderNotifier> log)
{
    public async Task OnPlacedAsync(Order order, CancellationToken ct)
    {
        await email.SendAsync(order.CustomerEmail, $"Order {order.Id}", ct);
        if (string.Equals(order.Country, "TR", StringComparison.OrdinalIgnoreCase))
            log.LogInformation("Turkish order {OrderId}", order.Id);
    }
}
```
`terminal`
```bash
dotnet build -warnaserror        # analyzers report CA/IDE/VSTHRD diagnostics as errors
```

## Production patterns
- Start every new solution with `AnalysisLevel=latest-recommended`, `EnforceCodeStyleInBuild`, warnings as errors, and the Threading analyzers.
- Turn off rules that don't fit (with a comment in `.editorconfig`) instead of ignoring warnings.
- Make Security and Reliability categories errors; keep Performance suggestions for hot paths only.
- In tests, relax rules like CA1707 (underscores in names) in `tests/.editorconfig`.

## Mistakes
Wrong: fire-and-forget inside a request.
```csharp
_ = email.SendAsync(to, body);   // request scope ends; failures vanish
```
Right: `await` it, or enqueue a job (03-backend/07-background-jobs) and handle failures there.

Wrong: blanket suppression.
```xml
<NoWarn>$(NoWarn);CA2000;CA2016;CS4014</NoWarn>
```
Right: fix them; suppress individual cases with a justification (lesson 05).

## Check yourself
1. What does `EnforceCodeStyleInBuild` change?
2. Which rule catches a dropped `CancellationToken`?
3. Why prefer `StringComparison.OrdinalIgnoreCase` for comparing country codes?

<details><summary>Answers</summary>

1. IDE (code-style) rules run during `dotnet build`, so they can fail CI, not only show in the editor.
2. CA2016.
3. Codes are identifiers, not human text; ordinal comparison is culture-independent (no Turkish-i problem) and faster.
</details>

## Sources
- [Code analysis overview](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/overview)
- [AnalysisLevel and AnalysisMode](https://learn.microsoft.com/dotnet/core/project-sdk/msbuild-props#analysislevel)
- [Configuration files for code analysis rules](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/configuration-files)
- [Code quality rules (CA)](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/)
- [Microsoft.VisualStudio.Threading.Analyzers](https://github.com/microsoft/vs-threading/blob/main/doc/analyzers/index.md)
- [Meziantou.Analyzer](https://github.com/meziantou/Meziantou.Analyzer)
