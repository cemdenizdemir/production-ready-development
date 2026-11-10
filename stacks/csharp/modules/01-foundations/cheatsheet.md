---
title: Foundations cheatsheet
date: 2026-11-09
---
# Foundations cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · Git & Collaboration](01-git/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `git switch -c feat/x` | new short-lived branch |
| `git add -p` + `git diff --staged` | stage by hunk, review before commit |
| `type(scope): subject` | Conventional Commit (`feat`, `fix`, `feat!`) |
| `dotnet new gitignore` | ignores `bin/`, `obj/`, `.vs/`, `*.user` |
| `* text=auto eol=lf` in `.gitattributes` | no CRLF churn |
| `git fetch && git rebase origin/main` | update your own branch |
| `git push --force-with-lease --force-if-includes` | safe push after rewrite |
| `git add --resolved` | stage resolved conflicts, refuse markers (2.56+) |
| EF Core snapshot conflict | take main's, re-add your migration |
| `git commit --fixup=<sha>` + `rebase -i --autosquash` | clean history before review |
| `git revert <sha>` / `git reflog` | undo shared / recover local |
| `git bisect run ./check.sh` | find the breaking commit (exit 125 = skip) |
| Ruleset on main + merge queue | PR, required checks, no force push |
| `dotnet user-secrets` + rotate first | secrets out of Git; leaks rotated before cleanup |
| `-p:Version=1.4.0 -p:SourceRevisionId=<sha>` | version from the tag |

## [02 · HTTP & Networking](02-http-networking/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `TypedResults.Created(uri, x)` / `NoContent()` / `NotFound()` | correct status codes |
| `AddProblemDetails()` + `UseStatusCodePages()` | RFC 9457 errors |
| 401 vs 403 | not logged in vs not allowed |
| `ASPNETCORE_HTTP_PORTS=8080` | container listening port |
| `MaxRequestBodySize` 30 MB / `KeepAliveTimeout` 130 s | Kestrel defaults to know |
| `UseHsts()` outside Development | HSTS |
| `__Host-` + `HttpOnly; Secure; SameSite=Lax` | session cookie |
| `WithOrigins(...)` + `UseCors` before auth | correct CORS |
| `ETag` + `If-None-Match` → 304 | cheap revalidation |
| `private, no-store` | personal responses |
| `UseForwardedHeaders()` first + `KnownIPNetworks` | real client IP and scheme (.NET 10) |
| `AddRequestTimeouts()` + pass `CancellationToken` | handler deadlines |
| Container Apps 240 s cap | long work → 202 + job |
| `curl -w '%{time_starttransfer}'` | where latency goes |
| `TypedResults.ServerSentEvents(...)` | SSE (.NET 10) |

## [03 · Testing](03-testing/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `dotnet new xunit3` | xUnit v3 test project |
| `[Fact]` / `[Theory]` + `TheoryData<…>` | tests and typed cases |
| `x.ShouldBe(y)` / `Should.ThrowAsync<T>(...)` | Shouldly assertions |
| `Substitute.For<T>()` + `.Received(1)` | NSubstitute stub and verify |
| `FakeTimeProvider.Advance(...)` | control time |
| `TestContext.Current.CancellationToken` | run cancellation |
| test data builder | valid defaults, override what matters |
| `WebApplicationFactory<Program>` + `CreateClient()` | app in memory |
| `ConfigureTestServices` / `UseSetting` | replace services / config |
| `new MsSqlBuilder().WithImage("…2025-latest")` | real SQL Server |
| `[assembly: AssemblyFixture(typeof(T))]` | one container per assembly |
| `Database.MigrateAsync()` in fixture | test migrations too |
| unique data per test | parallel-safe |
| `dotnet test --filter "Category!=Integration"` | VSTest filter |
| quarantine trait + issue | handle flaky tests |

## [04 · CI/CD](04-ci-cd/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `on: pull_request, merge_group, push: main` | triggers that matter |
| `permissions: contents: read` | least-privilege token |
| `setup-dotnet` + `global-json-file` + `cache: true` | pinned SDK, NuGet cache |
| `dotnet restore --locked-mode` | exact dependencies |
| `dotnet format --verify-no-changes` | format gate |
| `--no-restore` / `--no-build` | don't repeat work |
| `concurrency` + `cancel-in-progress` (PRs only) | stop stale runs |
| gate job as the required check | stable rulesets |
| reusable workflow / composite action | share jobs / steps |
| `id-token: write` + `azure/login@v2` | OIDC to Azure, no secrets |
| pin actions to full SHA | supply-chain safety |
| untrusted input via `env:` | no script injection |
| image tag `:<sha>`, build once | promote the same artifact |
| `environment: production` | approvals + scoped secrets + OIDC subject |
| service connection ↔ `azure/login` | Azure Pipelines mapping |

## [05 · Code Quality & Tooling](05-code-quality/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `Directory.Build.props` | shared settings for all projects |
| `Directory.Packages.props` + `ManagePackageVersionsCentrally` | one version per package |
| `.slnx` | XML solution (.NET 10 default) |
| `<Nullable>enable</Nullable>` + `TreatWarningsAsErrors` | null safety enforced |
| `required` / `init` / `[NotNullWhen(true)]` | help the null analysis |
| `RespectNullableAnnotations` | JSON matches the types |
| `AnalysisLevel=latest-recommended` + `EnforceCodeStyleInBuild` | analyzers on build |
| CS4014 / VSTHRD100 / CA2016 / CA2000 | un-awaited, async void, dropped token, undisposed |
| `StringComparison.OrdinalIgnoreCase` | no culture bugs |
| `dotnet_diagnostic.X.severity = error` | tune rules in `.editorconfig` |
| `dotnet format` / `whitespace` / `--verify-no-changes` | format and check |
| CSharpier `format` / `check` | opinionated layout (pick one owner) |
| `dotnet package list --vulnerable --include-transitive` | vulnerable deps |
| `[SuppressMessage(..., Justification = "")]` | scoped, justified suppression |
| `internal sealed` by default | small APIs, visible dead code |

## [06 · Security Fundamentals](06-security/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| STRIDE per trust boundary | threat model |
| OWASP Top 10:2025 A01 / A03 / A05 | access control, supply chain, injection |
| `SetFallbackPolicy(RequireAuthenticatedUser)` | deny by default |
| `FromSql($"…{x}")`, never `FromSqlRaw($"…")` | safe raw SQL |
| owner in the query, 404 for others | no IDOR |
| request DTOs | no over-posting |
| System.Text.Json + `[JsonDerivedType]` | safe deserialization |
| SSRF: allowlist + IP check in `ConnectCallback` | block metadata endpoint |
| `Path.GetFileName` + root prefix check | no path traversal |
| antiforgery for cookie-auth unsafe methods | CSRF |
| `AddSecurityHeaderPolicies()` + `AddDefaultApiSecurityHeaders()` | API headers |
| `AddRateLimiter` + `RequireRateLimiting("login")` | brute-force limits (per instance) |
| Key Vault + managed identity | secrets without secret zero |
| lock files + NuGet Audit + source mapping + Dependabot | supply chain |
| CodeQL `csharp` + `javascript-typescript` | static analysis |

## [07 · Config & Environments](07-config-environments/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `ASPNETCORE_ENVIRONMENT` (default Production) | environment name |
| json → env json → user secrets → env vars → CLI | provider order, later wins |
| `Section__Key` | env var hierarchy |
| `launchSettings.json` | `dotnet run` only |
| `AddOptions<T>().BindConfiguration(...)` | typed options |
| `.ValidateDataAnnotations().ValidateOnStart()` | fail the rollout on bad config |
| `IOptions` / `IOptionsSnapshot` / `IOptionsMonitor` | singleton / per request / live |
| `dotnet user-secrets set K V` | local secrets |
| `AddAzureKeyVault(uri, new DefaultAzureCredential())` | cloud secrets |
| `Payments--ApiKey` | Key Vault name for `Payments:ApiKey` |
| `AddAzureAppConfiguration(...)` + refresh | shared settings and flags |
| `IFeatureManager.IsEnabledAsync("X")` | feature flags |
| `depends_on: condition: service_healthy` | Compose startup order |
| `NEXT_PUBLIC_*` is build time | use runtime `proxy.ts` for per-env URLs |
| expand → migrate → contract | safe key renames |

## [08 · Documentation](08-documentation/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| tutorial / how-to / reference / explanation | Diátaxis kinds |
| README quick start | running in 15 minutes |
| Mermaid in Markdown | diagrams reviewed in PRs |
| ADR: Context, Decision, Consequences | decision record |
| runbook: impact, checks, mitigation, escalation | alert → action |
| Keep a Changelog sections | Added … Security |
| `AddOpenApi()` + `MapOpenApi()` | OpenAPI 3.1 document |
| `TypedResults` + `.WithName(...)` | schemas and operationIds |
| document / operation transformers | security schemes, global responses |
| `MapScalarApiReference()` | interactive docs (dev only) |
| Problem Details `type` + `code` | documented error contract |
| `Deprecation` + `Sunset` headers | announced removals |
| `GenerateDocumentationFile` | XML comments into OpenAPI |
| `Microsoft.Extensions.ApiDescription.Server` | document at build time |
| `oasdiff breaking --fail-on ERR` | block unannounced breaking changes |
