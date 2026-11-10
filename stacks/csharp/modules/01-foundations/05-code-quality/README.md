---
title: Code Quality & Tooling
module: 01-foundations
tech: .NET analyzers, .editorconfig, dotnet format, C# 14 (nullable)
---
# Code Quality & Tooling
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Why tooling: consistent code, fewer bugs, faster reviews
- [ ] ⭐ Nullable reference types and warnings as errors: what they catch, and the compiler settings worth adding
- [ ] Type-safe boundaries: nullable annotations, `required` members, pattern matching, validation at the edges
- [ ] ⭐ Roslyn analyzers: `AnalysisLevel`, `AnalysisMode`, severities in `.editorconfig`, third-party analyzers
- [ ] ⭐ Rules that prevent real bugs: un-awaited tasks, `async void`, undisposed resources, exhaustive switches, culture-sensitive strings
- [ ] ⭐ `dotnet format` and `.editorconfig` code style, kept separate from analyzers; CSharpier as the opinionated option
- [ ] Editor setup: VS Code with C# Dev Kit or Visual Studio 2026, format on save, analyzers in the editor
- [ ] Fast pre-commit checks with plain Git hooks
- [ ] ⭐ Quality gates in CI: build with warnings as errors, analyzers, and `dotnet format --verify-no-changes`
- [ ] Code review standards: naming, small functions, comments that explain why
- [ ] Dead code and dependency hygiene: unused code, unused public members, and unused packages
- [ ] Managing tech debt: suppressions with reasons, baselines, gradual strictness, codemods
- [ ] Shared build settings: `Directory.Build.props`, Central Package Management with `Directory.Packages.props`, `.slnx`
- [ ] One repo, two toolchains: .NET and pnpm checks in the same CI gate

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Why tooling, and shared build settings](docs/01-why-tooling-build-settings.md)
- [02 · Nullable reference types and type-safe boundaries](docs/02-nullable-boundaries.md)
- [03 · Roslyn analyzers and the rules that catch real bugs](docs/03-analyzers-real-bugs.md)
- [04 · Formatting, editor setup, hooks, and CI gates](docs/04-format-editor-hooks-ci.md)
- [05 · Code review, dead code, and tech debt](docs/05-review-deadcode-debt.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/01-foundations/05-code-quality mode=tasks` when you are ready to build._
