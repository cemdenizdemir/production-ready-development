---
title: Prettier, the editor, and pre-commit checks
tech: Prettier, ESLint, Git hooks, VS Code
version: Prettier 3, ESLint 10, Git 2.56
date: 2026-11-07
covers: [6, 7, 8]
---
# Prettier, the editor, and pre-commit checks
[← Overview](00-overview.md)

## Why it matters
- Half the comments on a PR are about quotes and line breaks. Real problems get less attention.
- Two editors with different settings reformat each other's files. Every PR has 400 lines of noise and blame becomes useless.
- A pre-commit hook runs the full test suite and takes two minutes. Everyone commits with `--no-verify`, and the hook protects nothing.

## Concepts

### Formatting vs linting
| | Prettier | ESLint |
|:--|:--|:--|
| Job | how code looks | whether code is risky or breaks conventions |
| Changes behavior? | never | `--fix` can |
| Configurable? | very little, on purpose | per rule |
| Runs | on save, pre-commit, CI `--check` | editor, pre-commit, CI |

Keep them separate: Prettier formats, ESLint lints, and `eslint-config-prettier` keeps ESLint out of formatting. Running Prettier *inside* ESLint (`eslint-plugin-prettier`) is slower and noisier; also seen in older setups.

### Prettier essentials
| Item | Use |
|:--|:--|
| `.prettierrc.json` | the few options you change (`singleQuote`, `printWidth`) |
| `.prettierignore` | skip generated files (`dist`, lockfiles, coverage) |
| `prettier --write .` | format everything |
| `prettier --check .` | CI: fail if anything is unformatted |
| `// prettier-ignore` | keep one hand-aligned block as written |
| Formats | TS, JS, JSON, CSS, Markdown, YAML, HTML |

### Editor setup
| File | Purpose |
|:--|:--|
| `.editorconfig` | indent, line endings, final newline for every editor |
| `.vscode/settings.json` | format on save with Prettier, ESLint fixes on save |
| `.vscode/extensions.json` | recommends the ESLint and Prettier extensions to teammates |
| `.gitattributes` | LF line endings in the repository (01-git) |

### Pre-commit checks that people keep
- **Fast:** under ~5 seconds. Only staged files, only quick checks (format, lint).
- **Not enforcement:** anyone can skip with `--no-verify`. CI is the gate; hooks just shorten the feedback loop.
- **No extra tools needed:** a POSIX `sh` hook in `.githooks/` with `core.hooksPath` (as in [01-git T01](../../01-git/tasks/T01-repo-bootstrap/TASK.md)). also seen: lint-staged, lefthook, husky.

## Example
`.prettierrc.json`
```json
{
  "singleQuote": true,
  "printWidth": 100
}
```
`.prettierignore`
```text
dist
coverage
pnpm-lock.yaml
reviews
```
`.editorconfig`
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```
`.vscode/settings.json`
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "eslint.useFlatConfig": true,
  "typescript.tsdk": "node_modules/typescript/lib"
}
```
`package.json` scripts
```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint . --cache --max-warnings 0",
    "typecheck": "tsc"
  }
}
```
`.githooks/pre-commit` — checks only staged files; enable with `git config core.hooksPath .githooks`.
```sh
#!/bin/sh
# Fast feedback only. CI runs the full gate.
set -eu

staged=$(git diff --cached --name-only --diff-filter=ACMR -z -- '*.ts' '*.tsx' '*.js' '*.mjs' '*.json' '*.md' '*.css' | tr '\0' '\n')
[ -z "$staged" ] && exit 0

printf '%s\n' "$staged" | tr '\n' '\0' | xargs -0 pnpm exec prettier --check --ignore-unknown \
  || { echo "Unformatted files. Run: pnpm format"; exit 1; }

code=$(printf '%s\n' "$staged" | grep -E '\.(ts|tsx|js|mjs)$' || true)
if [ -n "$code" ]; then
  printf '%s\n' "$code" | tr '\n' '\0' | xargs -0 pnpm exec eslint --cache --max-warnings 0
fi
```
The hook checks working-tree versions of staged files. If you staged only part of a file, CI still checks the real commit.

First-time format of an existing repo: run `pnpm format` in one commit, add its SHA to `.git-blame-ignore-revs`, and set `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

## Production patterns
- **Adopt Prettier defaults** and change only what the team truly cares about. Every option is a future debate.
- **Format the whole repo once, in a dedicated commit**, then ignore that commit in blame.
- **Commit editor settings** (`.editorconfig`, `.vscode/`) so new teammates get the setup for free.
- **Hooks do format + lint on staged files; tests run in CI.** Keep the hook under 5 seconds.
- **Pin tool versions** in `devDependencies`, so a new Prettier release can't reformat files on one laptop only.

## Mistakes
Wrong: formatting changes mixed into a feature PR.
```text
42 files changed: 3 with logic, 39 reformatted
```
Right: one formatting-only commit (or PR) first, then the feature.

Wrong: Prettier through ESLint.
```js
import prettierPlugin from 'eslint-plugin-prettier'; // every formatting diff is a lint error
```
Right: Prettier separately, `eslint-config-prettier` to disable conflicting rules.

Wrong: a slow hook.
```sh
pnpm test && pnpm build # 2 minutes per commit → --no-verify becomes the habit
```
Right: staged files only, format and lint only.

Wrong: no `.prettierignore`, so Prettier rewrites the lockfile or generated files and creates noisy diffs.
Right: ignore generated and vendored files.

## Check yourself
1. Why should Prettier and ESLint stay separate tools?
2. What makes a pre-commit hook worth keeping, and why isn't it enforcement?
3. How do you reformat an old codebase without ruining `git blame`?

<details>
<summary>Answers</summary>

1. They solve different problems. Formatting is mechanical and fast; lint rules need judgment and configuration. Combining them makes linting slower and floods results with formatting noise.
2. It must be fast and focused (staged files, format and lint). It isn't enforcement because it runs on the developer's machine and can be skipped; only CI checks every change.
3. Format everything in a single commit, then list that commit's SHA in `.git-blame-ignore-revs` and set `blame.ignoreRevsFile` (GitHub's blame view honors the file automatically).
</details>

## Sources
- [Prettier — Options](https://prettier.io/docs/options)
- [Prettier — Integrating with linters](https://prettier.io/docs/integrating-with-linters)
- [EditorConfig](https://editorconfig.org/)
- [VS Code — ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Git — githooks](https://git-scm.com/docs/githooks)
