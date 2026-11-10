---
title: Formatting, editor setup, hooks, and CI gates
tech: dotnet format, .editorconfig, CSharpier, VS Code C# Dev Kit, Visual Studio 2026
version: .NET SDK 10.0.402, CSharpier 1.x
date: 2026-11-09
covers: [6, 7, 8, 9]
---
# Formatting, editor setup, hooks, and CI gates
[← Overview](00-overview.md)

## Why it matters
- Half of a PR's diff is whitespace because two editors format differently. The real change is hidden.
- The pre-commit hook runs the full test suite; it takes 3 minutes, so everyone uses `--no-verify`.
- CI runs `dotnet build` but warnings aren't errors; the warning count grows from 0 to 1,400 in a year.

## Concepts

### `dotnet format` and `.editorconfig`
`dotnet format` applies the style rules in `.editorconfig` and the code fixes of analyzers.
| Command | Does |
|:--|:--|
| `dotnet format` | whitespace + style + analyzers (fixable ones) |
| `dotnet format whitespace` | indentation, spacing, newlines only (fast, no build) |
| `dotnet format style` | IDE code-style rules |
| `dotnet format analyzers` | third-party/CA rule fixes |
| `--verify-no-changes` | exit non-zero if anything would change (CI) |
| `--severity warn` | minimum severity to fix |
| `--diagnostics IDE0005 IDE0161` | only these rules |
| `--include src/Shop.Api/` | only these paths |

Formatting (layout) and analysis (correctness) are separate concerns. Keep formatting rules boring and automatic; review never discusses them.

`.editorconfig` (excerpt)
```ini
root = true

[*]
indent_style = space
end_of_line = lf
insert_final_newline = true
charset = utf-8

[*.cs]
indent_size = 4
csharp_style_namespace_declarations = file_scoped:warning
csharp_style_var_for_built_in_types = true:suggestion
dotnet_sort_system_directives_first = true
csharp_new_line_before_open_brace = all
dotnet_diagnostic.IDE0005.severity = warning      # unused usings
dotnet_diagnostic.IDE0161.severity = warning      # file-scoped namespaces

[*.{json,yml,yaml,ts,tsx}]
indent_size = 2
```
`dotnet new editorconfig` generates a full file with the defaults spelled out.

### CSharpier: the opinionated option
CSharpier is a Prettier-like formatter for C#: almost no options, it reprints the file. Teams that want zero debate use it instead of most `dotnet format` style options.
```bash
dotnet tool install csharpier
dotnet csharpier format .
dotnet csharpier check .      # CI
```
Pick one owner for layout: CSharpier, or `dotnet format` style rules. Running both with conflicting settings produces ping-pong diffs.

### Editor setup
| Editor | Setup |
|:--|:--|
| VS Code | C# Dev Kit (includes the C# extension), format on save (`"editor.formatOnSave": true`), `"[csharp]": { "editor.defaultFormatter": "ms-dotnettools.csharp" }` (or the CSharpier extension) |
| Visual Studio 2026 | built-in; Code Cleanup profile on save; analyzers show in the Error List |
| Rider | also seen; reads `.editorconfig` |

All three read `.editorconfig`, so the repo decides the rules. C# Dev Kit is free for individuals, open source, and small teams (Visual Studio Community license terms).

### Pre-commit hooks: fast and optional
A hook should take seconds and only check staged files:
`.githooks/pre-commit`
```bash
#!/usr/bin/env sh
set -e
files=$(git diff --cached --name-only --diff-filter=ACM -- '*.cs' | tr '\n' ' ')
[ -z "$files" ] || dotnet format whitespace --verify-no-changes --include $files
gitleaks git --staged --no-banner
```
`git config core.hooksPath .githooks` once per clone. Also seen: Husky.Net to install hooks via a dotnet tool. Hooks are a convenience; CI is the gate.

### Quality gates in CI
| Gate | Command |
|:--|:--|
| ⭐ format | `dotnet format --verify-no-changes --no-restore` (or `dotnet csharpier check .`) |
| ⭐ build, zero warnings | `dotnet build --no-restore -c Release` with `TreatWarningsAsErrors` |
| analyzers | part of the build when `AnalysisLevel` + `EnforceCodeStyleInBuild` are set |
| frontend | `pnpm lint && pnpm format:check && pnpm typecheck` |
| tests | `dotnet test --no-build`, `pnpm test` |

## Example
`.github/workflows/ci.yml` (quality job)
```yaml
quality:
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - uses: actions/checkout@v5
    - uses: actions/setup-dotnet@v5
      with:
        global-json-file: global.json
        cache: true
        cache-dependency-path: '**/packages.lock.json'
    - run: dotnet restore --locked-mode
    - run: dotnet format --verify-no-changes --no-restore
    - run: dotnet build --no-restore -c Release     # warnings are errors
```
`.vscode/settings.json` (committed)
```json
{
  "editor.formatOnSave": true,
  "[csharp]": { "editor.defaultFormatter": "ms-dotnettools.csharp" },
  "dotnet.defaultSolution": "Shop.slnx"
}
```

## Production patterns
- Commit `.editorconfig` and `.vscode/settings.json` (and `extensions.json` recommendations) so every clone behaves the same.
- One big "format the whole repo" commit, listed in `.git-blame-ignore-revs`, then enforce in CI.
- Hooks run in under ~5 seconds; anything slower belongs in CI.
- The CI quality job runs first and fails fast; tests wait for it or run in parallel.

## Mistakes
Wrong: the hook runs everything.
```bash
dotnet build && dotnet test     # minutes → people skip hooks
```
Right: format check on staged files + secret scan; CI runs the rest.

Wrong: two formatters with different rules.
Right: CSharpier **or** `dotnet format` style rules own layout; `dotnet format analyzers` can still apply analyzer fixes.

## Check yourself
1. Which `dotnet format` subcommand runs without building the project?
2. Why should formatting be enforced in CI rather than only in hooks?
3. What does `--verify-no-changes` do?

<details><summary>Answers</summary>

1. `dotnet format whitespace`.
2. Hooks are local and can be skipped or not installed; CI runs for every PR.
3. Exits with a non-zero code if formatting would change any file, without writing changes.
</details>

## Sources
- [dotnet format](https://learn.microsoft.com/dotnet/core/tools/dotnet-format)
- [Code-style rule options](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/code-style-rule-options)
- [CSharpier — Getting started](https://csharpier.com/docs/Installation)
- [C# Dev Kit for VS Code](https://code.visualstudio.com/docs/csharp/get-started)
- [githooks](https://git-scm.com/docs/githooks)
