---
title: Code Quality & Tooling
module: 01-foundations
tech: ESLint, typescript-eslint, Prettier, TypeScript 6 (strict)
---
# Code Quality & Tooling
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Why tooling: consistent code, fewer bugs, faster reviews
- [ ] ⭐ TypeScript strict mode: what each strict flag catches, and the extra flags worth adding
- [ ] Type-safe boundaries: `unknown`, narrowing, `satisfies`, runtime validation at the edges
- [ ] ⭐ ESLint flat config with typescript-eslint type-aware rules
- [ ] ⭐ Rules that prevent real bugs: floating promises, misused promises, exhaustive switches, unsafe `any`
- [ ] ⭐ Prettier for formatting, kept separate from linting
- [ ] Editor setup: format on save, ESLint in the editor, `.editorconfig`
- [ ] Fast pre-commit checks with plain Git hooks
- [ ] ⭐ Quality gates in CI: typecheck, lint, and format check with zero warnings
- [ ] Code review standards: naming, small functions, comments that explain why
- [ ] Dead code and dependency hygiene: unused code, exports, and packages
- [ ] Managing tech debt: suppressions with reasons, baselines, gradual strictness, codemods

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Strict TypeScript and safe boundaries](docs/01-strict-typescript.md)
- [02 · ESLint with type-aware rules](docs/02-eslint-type-aware.md)
- [03 · Prettier, the editor, and pre-commit checks](docs/03-prettier-editor-hooks.md)
- [04 · Quality gates, reviews, and tech debt](docs/04-quality-gates-and-debt.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 01-foundations/05-code-quality mode=tasks` when you are ready to build._
