---
title: Code Quality & Tooling cheatsheet
tech: ESLint, typescript-eslint, Prettier, TypeScript 6 (strict)
version: ESLint 10, typescript-eslint 8.6x, Prettier 3, TypeScript 6.0
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Code Quality & Tooling cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## tsconfig: strict family
| Option | Catches | Note |
|:--|:--|:--|
| ⭐ `strict` | turns on the whole family below | default `true` in TS 6.0 |
| ⭐ `strictNullChecks` | null/undefined misuse | the most valuable flag |
| `noImplicitAny` | silent `any` | |
| `strictFunctionTypes` | unsafe callback parameter types | |
| `strictBindCallApply` | wrong `bind`/`call`/`apply` args | |
| `strictPropertyInitialization` | class fields never set | |
| `useUnknownInCatchVariables` | `catch (e)` is `unknown` | |
| `noImplicitThis` | untyped `this` | |
| `alwaysStrict` | emit `"use strict"` | |
| `strictBuiltinIteratorReturn` | iterator returns typed `undefined` | TS 5.6+ |

## tsconfig: worth adding
| Option | Catches / does | Note |
|:--|:--|:--|
| ⭐ `noUncheckedIndexedAccess` | `arr[i]` may be undefined | |
| `exactOptionalPropertyTypes` | `a?: T` rejects explicit `undefined` | |
| `noImplicitOverride` | missing `override` keyword | |
| `noImplicitReturns` | paths without return | |
| `noFallthroughCasesInSwitch` | missing `break` | |
| `noPropertyAccessFromIndexSignature` | forces `obj['key']` for index signatures | |
| `noUnusedLocals` / `noUnusedParameters` | dead code | or the lint rule |
| ⭐ `verbatimModuleSyntax` | requires `import type` for types | predictable emit |
| ⭐ `erasableSyntaxOnly` | bans `enum`, `namespace`, parameter properties | TS 5.8+; needed for Node type stripping |
| `allowImportingTsExtensions` | `import './a.ts'` | needs `noEmit` or the rewrite option |
| `rewriteRelativeImportExtensions` | emit rewrites `.ts` → `.js` | TS 5.7+ |
| `isolatedModules` | each file compiles alone | implied by `verbatimModuleSyntax` |
| `noUncheckedSideEffectImports` | side-effect imports must resolve | TS 5.6+ |
| `module: nodenext` | Node ESM/CJS resolution | for Node services |
| `module: preserve` + `moduleResolution: bundler` | for code a bundler builds | Vite, Next.js |
| `skipLibCheck` | skip checking `.d.ts` files | faster; standard |
| `types: ["node"]` | which `@types` load globally | |
| `noEmit` | type-check only | Node runs `.ts` directly |
| `incremental` / `tsBuildInfoFile` | faster rebuilds | cache in CI |
| `composite` + project references | split big repos | `tsc -b` |

## Types at boundaries
| Tool | What it does | Example |
|:--|:--|:--|
| ⭐ `unknown` | must narrow before use | `function parse(x: unknown)` |
| `typeof` / `in` / `instanceof` / `Array.isArray` | narrowing checks | `if ('id' in x)` |
| Type predicate | custom narrowing | `x is User` |
| Assertion function | throws or narrows | `asserts x is User` |
| ⭐ Discriminated union | states with a `type`/`status` tag | `{ status: 'paid'; paidAt: Date }` |
| ⭐ `never` exhaustiveness | compile error on new union members | `const _: never = x` |
| ⭐ `satisfies` | check without widening | `config satisfies Config` |
| `as const` | literal, readonly values | lookup tables |
| ⭐ Zod `z.infer` | type from a runtime schema | one source of truth |
| Branded types | `type UserId = string & { __brand: 'UserId' }` | stop mixing IDs |
| `Readonly<T>` / `readonly` arrays | immutability in types | |
| Utility types | `Pick`, `Omit`, `Partial`, `Required`, `Record`, `ReturnType`, `Awaited`, `NoInfer` | |
| Template literal types | `` `order.${'paid' \| 'refunded'}` `` | event names |
| `using` declarations | dispose resources at scope end | TS 5.2+, Node 24+ |

## ESLint flat config
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `eslint.config.js` | the only config format | ESLint 10 removed eslintrc |
| ⭐ `defineConfig(...)` | typed helper, supports `extends` | from `eslint/config` |
| `globalIgnores([...])` | ignore paths everywhere | `.eslintignore` is gone |
| `files` / `ignores` | scope an object | globs |
| `extends` | include configs inside an object | |
| `languageOptions.globals` | `globals.node`, `globals.browser` | `globals` package |
| `languageOptions.parserOptions` | parser settings | `projectService` |
| `linterOptions.reportUnusedDisableDirectives` | flag stale disables | set `'error'` |
| `rules` | `'off'` / `'warn'` / `'error'` + options | |
| `eslint --inspect-config` | visual config inspector | debug which rules apply |
| `eslint --print-config file.ts` | resolved config for a file | |
| `npx @eslint/migrate-config .eslintrc.json` | convert old configs | |
| `eslint.config.ts` | TypeScript config file | supported natively in recent versions |

## typescript-eslint
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `typescript-eslint` package | parser + plugin + configs | one dependency |
| ⭐ `projectService: true` | finds tsconfig per file | type-aware linting |
| `tsconfigRootDir: import.meta.dirname` | root for tsconfig lookup | |
| `recommended` | syntax-only bug rules | |
| ⭐ `recommendedTypeChecked` | + type-aware rules | adopt first in old code |
| ⭐ `strictTypeChecked` | + stricter rules | new projects |
| `stylisticTypeChecked` | consistent style (not formatting) | |
| `disableTypeChecked` | turn type rules off | JS config files |
| Supported versions | ESLint 9/10; TypeScript < 6.1 | check peer ranges |

## Rules that catch real bugs
| Rule | Catches |
|:--|:--|
| ⭐ `@typescript-eslint/no-floating-promises` | unawaited, unhandled promises |
| ⭐ `@typescript-eslint/no-misused-promises` | promise in `if`, async callback where void expected |
| `@typescript-eslint/await-thenable` | `await` on non-promises |
| ⭐ `@typescript-eslint/switch-exhaustiveness-check` | missing `switch` cases |
| `@typescript-eslint/no-unsafe-assignment` / `-call` / `-member-access` / `-return` / `-argument` | `any` leaking |
| `@typescript-eslint/no-explicit-any` | writing `any` |
| `@typescript-eslint/no-unnecessary-condition` | always-true/false conditions |
| `@typescript-eslint/prefer-nullish-coalescing` | `\|\|` swallowing `0` and `''` |
| `@typescript-eslint/prefer-optional-chain` | long `&&` chains |
| `@typescript-eslint/restrict-template-expressions` | `[object Object]` in strings |
| `@typescript-eslint/only-throw-error` | throwing non-Errors |
| `@typescript-eslint/no-unused-vars` | dead variables/imports |
| `@typescript-eslint/consistent-type-imports` | `import type` |
| `@typescript-eslint/no-non-null-assertion` | `x!` |
| `@typescript-eslint/ban-ts-comment` | `@ts-ignore`, undocumented `@ts-expect-error` |
| `@typescript-eslint/return-await` | correct `return await` in try/catch |
| `@typescript-eslint/require-await` | async functions without await |
| `eqeqeq` | `==` coercion |
| `no-console` | stray logs in server code |
| `no-restricted-imports` | ban imports (e.g. internal paths, old libs) |
| `no-restricted-syntax` | ban patterns via AST selectors |
| `prefer-const` / `no-var` | reassignment hygiene |

## Prettier
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `prettier --write .` | format files | |
| ⭐ `prettier --check .` | fail on unformatted files | CI |
| `--ignore-unknown` | skip files Prettier can't parse | hooks |
| `--cache` | only reformat changed files | |
| `.prettierrc.json` | options | keep it small |
| `.prettierignore` | skip paths | lockfiles, dist |
| `printWidth` | wrap length | default 80 |
| `singleQuote` | quote style | |
| `trailingComma` | default `"all"` | cleaner diffs |
| `semi` | semicolons | default true |
| `// prettier-ignore` | skip next node | aligned tables in code |
| `overrides` | per-glob options | e.g. Markdown |
| ⭐ `eslint-config-prettier/flat` | disable conflicting ESLint rules | put last |
| `eslint-plugin-prettier` | Prettier as a lint rule | avoid: slow, noisy |
| `--experimental-cli` | faster new CLI | Prettier 3.6+ |
| also seen | Biome, dprint, oxlint | faster all-in-one tools |

## Editor
| File / setting | What it does |
|:--|:--|
| ⭐ `.editorconfig` | indent, EOL, charset, final newline |
| ⭐ `editor.formatOnSave` | Prettier on save |
| `editor.defaultFormatter` | `esbenp.prettier-vscode` |
| ⭐ `editor.codeActionsOnSave` | `source.fixAll.eslint` |
| `typescript.tsdk` | use the workspace TypeScript |
| `.vscode/extensions.json` | recommended extensions |
| "TypeScript: Restart TS Server" | fix stale editor errors |
| "ESLint: Show Output Channel" | debug ESLint in the editor |

## Git hooks
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `core.hooksPath .githooks` | versioned hooks | plain Git, no package |
| `pre-commit` | format + lint staged files | < 5 s |
| `commit-msg` | Conventional Commits | see 01-git |
| `pre-push` | quick tests | optional |
| `git diff --cached --name-only --diff-filter=ACMR -z` | staged files, NUL-separated | safe with spaces |
| `--no-verify` | skip hooks | why CI is the real gate |
| also seen | lint-staged, lefthook, husky | not in STACK.md |

## CI quality gate
| Check | Command |
|:--|:--|
| ⭐ Types | `tsc` (with `noEmit`) |
| ⭐ Lint | `eslint . --cache --max-warnings 0` |
| ⭐ Format | `prettier --check .` |
| Stale disables | `reportUnusedDisableDirectives: 'error'` |
| Dedupe lockfile | `pnpm dedupe --check` |
| Order | fastest first, or parallel jobs |

## Tech debt tools
| Tool | What it does | Note |
|:--|:--|:--|
| ⭐ `-- reason` in disable comments | documents why | `// eslint-disable-next-line x -- reason` |
| ⭐ `@ts-expect-error` | suppress, but fail once fixed | better than `@ts-ignore` |
| `eslint --suppress-all` | baseline all current violations | ESLint 9.24+ |
| `eslint --suppress-rule <rule>` | baseline one rule | |
| `eslint --prune-suppressions` | drop fixed entries | |
| `eslint-suppressions.json` | the baseline file | commit it |
| Per-folder overrides | stricter rules for new code | `files: ['src/new/**']` |
| Codemods | scripted refactors | jscodeshift, ts-morph |
| knip | unused files, exports, deps | also seen |
| `pnpm why` / `pnpm outdated` | dependency insight | |

## Review checklist
| Look at | Question |
|:--|:--|
| ⭐ Behavior | does it do what the PR says, including edge cases? |
| ⭐ Tests | is new behavior tested? bug fix has a regression test? |
| Naming | do names say what things are? |
| Size | functions with one job? early returns? |
| Errors | handled at the right level, not swallowed? |
| Boundaries | input validated once at the edge? |
| Comments | explain why, link context? |
| Scope | one concern per PR? refactor separate? |
| Security | secrets, injection, authz checked? |
| Ops | logs, metrics, config, migrations safe? |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Warnings allowed in CI | they pile up, hide bugs | `--max-warnings 0` |
| Old `.eslintrc.*` in ESLint 10 | silently ignored | flat config |
| Type-aware rules on JS config files | parser errors | `disableTypeChecked` |
| `enum` with Node type stripping | file fails to load | literal unions, `erasableSyntaxOnly` |
| `as` casts at boundaries | unchecked claims | schemas |
| `x!` everywhere | runtime crashes | narrow or handle |
| Prettier version drift | reformat wars | pin in devDependencies |
| Formatting mixed with features | unreadable diffs | separate commits |
| Slow hooks | `--no-verify` habit | staged files only |
| `@ts-ignore` | hides future errors too | `@ts-expect-error` + reason |
| TS 7 with typescript-eslint | unsupported peer range | stay on TS 6.0 for now |

## Sources
| Source | Link |
|:--|:--|
| TSConfig reference | https://www.typescriptlang.org/tsconfig/ |
| typescript-eslint | https://typescript-eslint.io/ |
| typescript-eslint rules | https://typescript-eslint.io/rules/ |
| ESLint configuration | https://eslint.org/docs/latest/use/configure/ |
| ESLint bulk suppressions | https://eslint.org/docs/latest/use/suppressions |
| Prettier options | https://prettier.io/docs/options |
| Node.js TypeScript support | https://nodejs.org/api/typescript.html |
