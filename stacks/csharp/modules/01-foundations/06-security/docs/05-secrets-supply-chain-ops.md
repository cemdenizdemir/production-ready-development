---
title: Secrets, supply chain, CodeQL, and security operations
tech: Azure Key Vault, gitleaks, NuGet Audit, package source mapping, Dependabot, CodeQL, pnpm audit
version: .NET SDK 10.0.402, github/codeql-action v4
date: 2026-11-09
covers: [10, 11, 12, 13]
---
# Secrets, supply chain, CodeQL, and security operations
[← Overview](00-overview.md)

## Why it matters
- A connection string with the `sa` password lives in `appsettings.json` for three years. Everyone who ever cloned the repo has it.
- A typosquatted NuGet package (`Microsoft.Extensions.Loging`) is added by an autocomplete slip and runs code at build time.
- A vulnerability report arrives by email to a random developer, sits for six weeks, and is then published by the reporter.
- After an incident, nobody can say which account accessed the data because authorization failures were never logged.

## Concepts

### Secrets: storage and rotation
| Environment | Where | How the app reads it |
|:--|:--|:--|
| local | `dotnet user-secrets` | configuration provider (Development only) |
| CI | OIDC to Azure; GitHub secrets only if unavoidable | environment variables |
| Azure | ⭐ Key Vault | `builder.Configuration.AddAzureKeyVault(uri, new DefaultAzureCredential())` with managed identity |
| better still | no secret at all | managed identity to Azure SQL, Storage, Service Bus |

Rotation without downtime: Key Vault keeps versions; the configuration provider can reload (`ReloadInterval`); keep two valid credentials during the switch (e.g. primary/secondary keys). Scan with gitleaks in hooks and CI; enable GitHub push protection.

### Supply chain for NuGet and npm
| Control | Setting |
|:--|:--|
| ⭐ lock files + locked restore | `RestorePackagesWithLockFile`, `dotnet restore --locked-mode` |
| ⭐ NuGet Audit | on by default; .NET 10 audits transitive packages (`NuGetAuditMode=all`); `NuGetAuditLevel` sets minimum severity |
| fail on vulnerabilities | keep NU1903/NU1904 as errors in CI (`TreatWarningsAsErrors`), or `<WarningsAsErrors>NU1903;NU1904</WarningsAsErrors>` |
| ⭐ package source mapping | `nuget.config` maps package ID patterns to sources; blocks dependency confusion |
| central versions | `Directory.Packages.props`, transitive pinning to patch |
| signed packages | `dotnet nuget verify`, `signatureValidationMode=require` in `nuget.config` for strict setups |
| ⭐ Dependabot | `package-ecosystem: nuget` (understands CPM), `npm` for `web/`, `github-actions` |
| pnpm | `pnpm audit`, `--frozen-lockfile`, `onlyBuiltDependencies` allowlist |
| new dependency review | maintainer activity, licence (commercial switches!), downloads, transitive size |
| GitHub dependency review action | blocks PRs adding vulnerable or disallowed-licence packages |

`nuget.config`
```xml
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="internal" value="https://pkgs.dev.azure.com/org/_packaging/shop/nuget/v3/index.json" />
  </packageSources>
  <packageSourceMapping>
    <packageSource key="nuget.org"><package pattern="*" /></packageSource>
    <packageSource key="internal"><package pattern="Shop.*" /></packageSource>
  </packageSourceMapping>
</configuration>
```

### Static analysis with CodeQL
CodeQL builds a database of your code and runs security queries (injection, path traversal, weak crypto, SSRF…). Two ways to run it:
- **Default setup**: repository Settings → Code security → CodeQL → Default. Zero YAML.
- **Advanced setup**: a workflow with `github/codeql-action/init` + `analyze`, languages `csharp` and `javascript-typescript`; C# can use `build-mode: none`.

Alerts show in the Security tab and on PRs. Treat high/critical as blocking; triage the rest. Security-focused code review still matters: CodeQL can't know your authorization rules.

### Security logging and operations
| Log (structured, with trace id) | Never log |
|:--|:--|
| sign-in success/failure, lockouts, MFA changes | passwords, tokens, cookies, `Authorization` headers |
| authorization failures (403/404 on owned resources) | full card numbers, secrets, connection strings |
| validation anomalies, rate-limit rejections | full request bodies with personal data |
| admin actions, permission changes, exports | |

Alert on spikes (failed logins, 403s, 429s). Least privilege everywhere: managed identities with narrow roles, an app SQL user that can't `DROP`, separate migration identity.

Handling a vulnerability report:
1. `SECURITY.md` in the repo with a private contact; enable GitHub private vulnerability reporting.
2. Acknowledge within days; reproduce; assess severity (CVSS).
3. Fix privately (GitHub security advisory + temporary private fork), release, then disclose and credit the reporter.

## Example
`.github/dependabot.yml`
```yaml
version: 2
updates:
  - package-ecosystem: nuget
    directory: /
    schedule: { interval: weekly }
    groups:
      microsoft: { patterns: ["Microsoft.*", "System.*"] }
  - package-ecosystem: npm
    directory: /web
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```
`.github/workflows/codeql.yml`
```yaml
name: codeql
on:
  pull_request:
  push: { branches: [main] }
  schedule: [{ cron: '0 4 * * 1' }]
permissions:
  contents: read
  security-events: write
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - { language: csharp, build-mode: none }
          - { language: javascript-typescript, build-mode: none }
    steps:
      - uses: actions/checkout@v5
      - uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
          build-mode: ${{ matrix.build-mode }}
          queries: security-extended
      - uses: github/codeql-action/analyze@v4
```
Key Vault in `Program.cs`:
```csharp
if (!builder.Environment.IsDevelopment())
{
    builder.Configuration.AddAzureKeyVault(
        new Uri(builder.Configuration["KeyVault:Uri"]!),
        new DefaultAzureCredential(),
        new AzureKeyVaultConfigurationOptions { ReloadInterval = TimeSpan.FromMinutes(5) });
}
```

## Production patterns
- Prefer identity over secrets: managed identity to Azure services means nothing to leak or rotate.
- Lock files, source mapping, and NuGet Audit as errors in CI; Dependabot weekly with grouped updates.
- CodeQL on every PR plus a weekly scheduled scan (new queries find old bugs).
- A `SECURITY.md` and private vulnerability reporting from the first public release.

## Mistakes
Wrong: suppressing audit warnings to get a green build.
```xml
<NoWarn>$(NoWarn);NU1903</NoWarn>
```
Right: upgrade the package (or pin the transitive dependency centrally); if no fix exists, document the risk with an issue and a review date.

Wrong: logging the whole request on auth failures.
```csharp
log.LogWarning("Login failed {Request}", JsonSerializer.Serialize(request));   // includes the password
```
Right:
```csharp
log.LogWarning("Login failed for {UserName} from {Ip}", request.UserName, ip);
```

## Check yourself
1. What attack does package source mapping block?
2. Why is a managed identity better than a Key Vault secret for Azure SQL?
3. Which two languages should CodeQL scan in this repo?

<details><summary>Answers</summary>

1. Dependency confusion: a public package with your internal package's name being pulled from the wrong source.
2. There is no secret to store, leak, or rotate; Azure issues short-lived tokens for the identity.
3. `csharp` (API) and `javascript-typescript` (Next.js frontend).
</details>

## Sources
- [Azure Key Vault configuration provider](https://learn.microsoft.com/aspnet/core/security/key-vault-configuration)
- [Auditing package dependencies](https://learn.microsoft.com/nuget/concepts/auditing-packages)
- [Package Source Mapping](https://learn.microsoft.com/nuget/consume-packages/package-source-mapping)
- [Dependabot options](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)
- [CodeQL for C# (build-mode none)](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/codeql-code-scanning-for-compiled-languages)
- [GitHub — Privately reporting a security vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
