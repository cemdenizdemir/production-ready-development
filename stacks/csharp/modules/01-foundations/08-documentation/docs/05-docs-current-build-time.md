---
title: "Keeping docs current: build-time OpenAPI and CI checks"
tech: Microsoft.Extensions.ApiDescription.Server, oasdiff, markdownlint, lychee, GitHub Actions
version: Microsoft.Extensions.ApiDescription.Server 10.0.x
date: 2026-11-09
covers: [11, 13]
---
# Keeping docs current: build-time OpenAPI and CI checks
[← Overview](00-overview.md)

## Why it matters
- A refactor changes `quantity` from `int` to `string` in a DTO. Nobody notices until the frontend breaks in staging, because the contract was never diffed.
- The README's setup commands reference a Compose service that was renamed months ago.
- Half the links in `docs/` point to deleted files; new hires stop trusting any doc.

## Concepts

### Docs as code
| Practice | How |
|:--|:--|
| docs live with the code | same repo, same PR |
| review docs in PRs | PR template: "docs updated?" checkbox; CODEOWNERS for `docs/` |
| generated docs are checked in | OpenAPI document, config reference |
| CI checks | links, Markdown style, generated files up to date, API breaking changes |
| ownership | each doc has an owner; stale docs are deleted, not left |

### Generate the OpenAPI document at build time
Add `Microsoft.Extensions.ApiDescription.Server` to the API project. On build, it starts the app in a special mode, asks for the document, and writes it to disk.

`src/Shop.Api/Shop.Api.csproj`
```xml
<ItemGroup>
  <PackageReference Include="Microsoft.Extensions.ApiDescription.Server" PrivateAssets="all" />
</ItemGroup>
<PropertyGroup>
  <OpenApiDocumentsDirectory>$(MSBuildProjectDirectory)/../../openapi</OpenApiDocumentsDirectory>
  <OpenApiGenerateDocumentsOptions>--file-name shop-api</OpenApiGenerateDocumentsOptions>
</PropertyGroup>
```
`dotnet build` now writes `openapi/shop-api.json`. Commit it.

Startup code that needs real services (database, Key Vault) runs during this build-time step. Guard it:
```csharp
if (Assembly.GetEntryAssembly()?.GetName().Name != "GetDocument.Insider")
{
    builder.Configuration.AddAzureKeyVault(/* ... */);
}
```

### What to check in CI
| Check | Tool | Fails when |
|:--|:--|:--|
| ⭐ document up to date | `dotnet build` + `git diff --exit-code openapi/` | someone changed endpoints but didn't commit the new document |
| ⭐ no unannounced breaking changes | `oasdiff breaking main.json pr.json --fail-on ERR` | removed endpoints/fields, type changes, new required params |
| OpenAPI style | Spectral (also seen) | missing operationIds, descriptions, error responses |
| frontend client regenerated | `pnpm orval` + `git diff --exit-code web/src/api` | TS client is stale |
| Markdown style | `markdownlint-cli2` | broken structure |
| ⭐ links | `lychee` | dead relative or external links |
| README commands | a CI job that runs the quick start (Compose up, migrate, health check) | setup instructions rot |

`oasdiff` reports breaking changes (ERR) and warnings; label PRs with intentional breaks and require an approval from API owners.

## Example
`.github/workflows/docs.yml`
```yaml
name: docs
on: [pull_request, merge_group]
permissions:
  contents: read
jobs:
  contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }
      - uses: actions/setup-dotnet@v5
        with: { global-json-file: global.json }
      - run: dotnet build src/Shop.Api -c Release
      - name: OpenAPI document committed
        run: git diff --exit-code -- openapi/
      - name: Breaking changes vs main
        run: |
          git show origin/main:openapi/shop-api.json > /tmp/main.json
          docker run --rm -v /tmp:/tmp -v "$PWD/openapi:/pr" tufin/oasdiff breaking /tmp/main.json /pr/shop-api.json --fail-on ERR

  markdown:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: DavidAnson/markdownlint-cli2-action@v20
        with: { globs: '**/*.md' }
      - uses: lycheeverse/lychee-action@v2
        with: { args: --offline --no-progress './**/*.md' }   # --offline: relative links only; drop it for external
```

## Production patterns
- The committed OpenAPI file is the source for Orval (02-frontend) and for contract review in PRs.
- Breaking API changes need an explicit label and owner approval; everything else is additive.
- Run link checks offline on every PR (fast) and full external checks nightly (slow, flaky sites).
- Delete docs nobody owns. Wrong docs are worse than none.

## Mistakes
Wrong: generating the document only at runtime and copying it by hand when someone remembers.
Right: build-time generation, committed file, CI diff.

Wrong: build-time generation that connects to Key Vault or the database and fails in CI.
Right: skip external providers when the entry assembly is `GetDocument.Insider`, or make them optional.

## Check yourself
1. What does `git diff --exit-code openapi/` catch after a build?
2. Name two changes `oasdiff breaking` would flag.
3. Why run external link checks nightly instead of on every PR?

<details><summary>Answers</summary>

1. Endpoint changes whose regenerated OpenAPI document wasn't committed.
2. Removing an endpoint or response field, changing a field's type, or adding a new required request parameter.
3. External sites are slow and sometimes down; nightly runs report real rot without blocking unrelated PRs.
</details>

## Sources
- [Generate OpenAPI documents at build time](https://learn.microsoft.com/aspnet/core/fundamentals/openapi/aspnetcore-openapi#generate-openapi-documents-at-build-time)
- [oasdiff](https://github.com/oasdiff/oasdiff)
- [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2)
- [lychee link checker](https://github.com/lycheeverse/lychee)
- [Write the Docs — Docs as code](https://www.writethedocs.org/guide/docs-as-code/)
