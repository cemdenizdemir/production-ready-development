---
title: Documentation cheatsheet
tech: Markdown, Microsoft.AspNetCore.OpenApi (OpenAPI 3.1), Scalar, XML doc comments
version: Microsoft.AspNetCore.OpenApi 10.0.x, Scalar.AspNetCore 2.x, Microsoft.Extensions.ApiDescription.Server 10.0.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Documentation cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Kinds of docs (Diátaxis)
| Kind | For | Example |
|:--|:--|:--|
| ⭐ Tutorial | learning by doing | quick start |
| ⭐ How-to | a specific task | add a migration, rotate a key |
| ⭐ Reference | lookup | OpenAPI, config table, cheatsheet |
| ⭐ Explanation | understanding why | ADRs, architecture |
| one kind per page | findability | |

## Repo docs
| File | Purpose | Note |
|:--|:--|:--|
| ⭐ `README.md` | run in 15 minutes | commands, prerequisites |
| `CONTRIBUTING.md` | branching, commits, PR rules | |
| `SECURITY.md` | vulnerability reporting | |
| ⭐ `docs/adr/NNNN-title.md` | decisions | numbered, immutable |
| ⭐ `docs/runbooks/*.md` | alert → actions | linked from alerts |
| `docs/configuration.md` | every config key | default, secret?, source |
| `docs/architecture.md` | system overview | Mermaid |
| ⭐ `CHANGELOG.md` | changes per version | Keep a Changelog |
| `openapi/shop-api.json` | API contract | generated, committed |

## README sections
| Section | Contains |
|:--|:--|
| one-liner | what it is |
| ⭐ quick start | prerequisites with versions, copy-paste commands, expected result |
| tests | how to run them |
| layout | key folders |
| configuration | link to config reference |
| contributing | link |

## Markdown on GitHub
| Feature | Syntax | Note |
|:--|:--|:--|
| relative link | `[x](docs/a.md)` | ⭐ works on branches/forks |
| anchor | `[x](#quick-start)` | |
| alert | `> [!NOTE]` / `TIP` / `IMPORTANT` / `WARNING` / `CAUTION` | |
| collapsible | `<details><summary>` | |
| task list | `- [ ] item` | |
| code fence | ` ```csharp ` | language for highlighting |
| ⭐ Mermaid | ` ```mermaid ` | flowchart, sequenceDiagram, erDiagram, stateDiagram-v2, gitGraph |
| footnote | `[^1]` | |
| table alignment | `:--` / `:-:` / `--:` | |

## ADRs
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ Context / Decision / Consequences | core sections | Nygard |
| Status | Proposed, Accepted, Deprecated, Superseded | |
| alternatives considered | options and why not | |
| supersede, don't edit | new ADR replaces old | |
| ADR 0001 | "we use ADRs" | |
| MADR | richer template | also seen |
| adr-tools / Log4brains | tooling | also seen |

## Runbooks
| Section | Contains |
|:--|:--|
| alert + severity | name, threshold, SEV level |
| impact | what users see |
| quick checks | dashboards, last deploy, queries |
| ⭐ mitigation | rollback, pause jobs, scale, failover commands |
| escalation | who, when |
| afterwards | evidence to capture, postmortem link |
| `runbook_url` on alerts | one click from the page |

## Changelog and releases
| Item | Use | Note |
|:--|:--|:--|
| ⭐ Added / Changed / Deprecated / Removed / Fixed / Security | Keep a Changelog sections | |
| `[Unreleased]` | pending changes | |
| `gh release create vX --generate-notes` | GitHub release | edit the output |
| deploy markers | annotations in monitoring | |
| release-please / GitVersion | automation | also seen |

## OpenAPI setup
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `builder.Services.AddOpenApi()` | register generator | OpenAPI 3.1 default (.NET 10) |
| ⭐ `app.MapOpenApi()` | `/openapi/v1.json` | Development or protected |
| `MapOpenApi("/openapi/{documentName}.yaml")` | YAML | .NET 10 |
| `AddOpenApi("admin", o => o.ShouldInclude = …)` | multiple documents | |
| `.WithGroupName("admin")` | assign endpoint to document | |
| `OpenApiVersion = OpenApiSpecVersion.OpenApi3_0` | downgrade | older tools |
| `using Microsoft.OpenApi;` | Microsoft.OpenApi 2.x types | .NET 10 change |

## Endpoint metadata
| Item | Becomes | Note |
|:--|:--|:--|
| ⭐ `TypedResults` / `Results<A, B>` | response schemas | |
| ⭐ `.WithName("GetOrder")` | operationId | client method names |
| `.WithSummary` / `.WithDescription` | summary / description | |
| `.WithTags("Orders")` | grouping | |
| `.Produces<T>(201)` | response | |
| `.ProducesProblem(404)` | Problem Details response | |
| `.ProducesValidationProblem()` | 400 validation response | |
| `.Accepts<T>("application/json")` | request body | |
| `.ExcludeFromDescription()` | hide endpoint | |
| `[Description("…")]` | parameter/property description | |
| `[EndpointSummary]` / `[EndpointDescription]` | attributes form | |
| DataAnnotations | schema constraints | `[MaxLength]`, `[Range]` |
| `ObsoleteAttribute` metadata | `deprecated: true` | |
| `WithOpenApi()` | avoid | obsolete in .NET 10 |

## Transformers
| Transformer | Use | Example |
|:--|:--|:--|
| ⭐ `AddDocumentTransformer` | whole document | security schemes, info, servers |
| `AddOperationTransformer` | each operation | `429` response, deprecation |
| `AddSchemaTransformer` | each schema | examples, formats |
| `IOpenApiDocumentTransformer` | class form | DI-enabled |
| `doc.Components ??= new()` | null collections | Microsoft.OpenApi 2.x |
| `OpenApiSecurityScheme { Type = Http, Scheme = "bearer" }` | JWT scheme | |

## Scalar
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `Scalar.AspNetCore` | package | 2.x |
| ⭐ `app.MapScalarApiReference()` | UI at `/scalar` | |
| `o.WithTitle("Shop API")` | options | |
| dev-only mapping | no public internal docs | |
| Swagger UI / ReDoc | alternatives | also seen |

## API behavior to document
| Behavior | How | Note |
|:--|:--|:--|
| ⭐ errors | Problem Details + `type`/`code` list | clients switch on `code` |
| ⭐ auth | security schemes, policies | |
| pagination | cursor, limit, max size, `next` | |
| ⭐ idempotency | `Idempotency-Key`, retention, replay | |
| rate limits | 429 + `Retry-After` | |
| concurrency | `ETag`, `If-Match`, 412 | |
| ⭐ deprecation | `deprecated`, `Deprecation` + `Sunset` headers, changelog | RFC 9745, RFC 8594 |
| versioning | scheme + lifetime | |

## XML doc comments
| Tag | Use | Note |
|:--|:--|:--|
| ⭐ `<summary>` | what it is | one sentence |
| `<remarks>` | why, constraints | |
| `<param>` / `<returns>` | non-obvious args/results | records: `<param>` on type |
| `<exception cref>` | what to handle | |
| `<response code="404">` | OpenAPI response text | handler methods |
| `<see cref>` / `<inheritdoc/>` | references, reuse | |
| `<c>` / `<code>` / `<example>` | code | |
| ⭐ `GenerateDocumentationFile` | emit XML; feeds OpenAPI | .NET 10 |
| `CS1591` | missing comment warning | suppress outside libraries |

## Build-time OpenAPI and CI
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `Microsoft.Extensions.ApiDescription.Server` | write document on build | |
| `OpenApiDocumentsDirectory` | output folder | |
| `OpenApiGenerateDocumentsOptions` | `--file-name x` | |
| `GetDocument.Insider` | entry assembly during generation | skip external providers |
| ⭐ `git diff --exit-code openapi/` | document committed | |
| ⭐ `oasdiff breaking a.json b.json --fail-on ERR` | breaking changes | |
| Spectral | OpenAPI lint | also seen |
| Orval regen + diff | TS client fresh | 02-frontend |
| `markdownlint-cli2` | Markdown style | |
| ⭐ `lychee` | link checker | `--offline` on PRs |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `Results.Ok(x)` | untyped schema | `TypedResults` |
| renaming `WithName` | breaks generated client | treat as breaking |
| inline lambdas + XML comments | comments not picked up | named methods |
| public Scalar in prod | leaks internal API | dev-only / auth |
| build-time doc needs Key Vault | CI build fails | guard `GetDocument.Insider` |
| editing accepted ADRs | history lost | supersede |
| runbook without commands | slow incidents | copy-paste steps |
| absolute repo links | break on branches | relative links |

## Sources
| Source | Link |
|:--|:--|
| ASP.NET Core OpenAPI | https://learn.microsoft.com/aspnet/core/fundamentals/openapi/overview |
| OpenAPI metadata | https://learn.microsoft.com/aspnet/core/fundamentals/openapi/include-metadata |
| Transformers | https://learn.microsoft.com/aspnet/core/fundamentals/openapi/customize-openapi |
| Scalar ASP.NET Core | https://scalar.com/products/api-references/integrations/aspnetcore/integration |
| Diátaxis | https://diataxis.fr/ |
| ADRs | https://adr.github.io/ |
| Keep a Changelog | https://keepachangelog.com/en/1.1.0/ |
| oasdiff | https://github.com/oasdiff/oasdiff |
| lychee | https://github.com/lycheeverse/lychee |
