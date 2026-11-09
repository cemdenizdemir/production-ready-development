---
title: Foundations cheatsheet
date: 2026-11-07
---
# Foundations cheatsheet
[← Module](README.md) · The most-used rows from each topic cheatsheet. Follow a heading for the full sheet.

## [01 · Git & Collaboration](01-git/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `git switch -c feat/x` | new short-lived branch |
| `git add -p` | stage hunk by hunk |
| `type(scope): subject` | Conventional Commit message (`feat`, `fix`, `feat!`) |
| `git fetch && git rebase origin/main` | update your own branch |
| `git push --force-with-lease --force-if-includes` | safe push after rewriting your branch |
| `git commit --fixup=<sha>` + `git rebase --autosquash` | fix an older commit before review |
| `git revert <sha>` | undo a commit on a shared branch |
| `git reflog` | find "lost" commits |
| `git bisect run ./check.sh` | find the commit that broke something |
| `git log -S 'text'` | find when a string was added or removed |
| `merge.conflictStyle = zdiff3` | conflicts show the common base |
| Ruleset on main | PR + required checks + no force push |
| CODEOWNERS | required reviewers by path |
| Leaked secret | rotate first, clean history second |
| `git tag -s v1.2.0` + `gh release create --generate-notes` | signed release |

## [02 · HTTP & Networking](02-http-networking/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Safe / idempotent methods | GET safe; PUT, DELETE idempotent; POST neither |
| 201 + `Location` / 204 / 409 / 422 / 429 + `Retry-After` | status codes people get wrong |
| 401 vs 403 | not logged in vs not allowed |
| `keepAliveTimeout` > LB idle timeout | avoids random 502s |
| `AbortSignal.timeout(ms)` | deadline on every outgoing `fetch` |
| `__Host-sid; HttpOnly; Secure; SameSite=Lax` | session cookie flags |
| `Strict-Transport-Security` | HTTPS only |
| Preflight (`OPTIONS`) | JSON bodies, auth headers, PUT/PATCH/DELETE |
| Allowlist origins + `Vary: Origin` | correct CORS |
| `app.set('trust proxy', 1)` | real client IP behind one load balancer |
| `immutable` assets, `no-cache` HTML, `no-store` secrets | caching recipes |
| `ETag` + `If-None-Match` → 304 | revalidation |
| `curl -w '%{time_total}'` / Copy as cURL | measure and reproduce |
| SSE (`EventSource`) | simple server → client push |

## [03 · Testing](03-testing/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Unit / integration / E2E | most backend confidence from integration tests |
| Arrange-Act-Assert | one behavior per test |
| `vitest` / `vitest run` | watch locally / single run in CI |
| `test.each([...])` | table-driven tests |
| `await expect(p).rejects.toThrow()` | async errors (always await) |
| `vi.fn()` / `vi.spyOn()` / `vi.mock()` | doubles; mock what you don't own |
| `vi.useFakeTimers()` + `advanceTimersByTimeAsync()` | control time |
| `test.extend({...})` | typed fixtures |
| `request(app).post('/x').send(b).expect(201)` | Supertest integration test |
| `new PostgreSqlContainer('postgres:18-alpine')` | real DB in tests |
| `TRUNCATE ... RESTART IDENTITY` | clean state per test |
| `coverage.thresholds` | floor, not target |
| `expect.poll()` | wait for conditions, never sleep |
| `--shard=1/3` | split suites in CI |

## [04 · CI/CD](04-ci-cd/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `on: pull_request / push / merge_group` | triggers |
| `needs`, `strategy.matrix`, `timeout-minutes` | job control |
| `concurrency` + `cancel-in-progress` (PRs only) | stop outdated runs |
| `pnpm install --frozen-lockfile` + `cache: pnpm` | reproducible, fast installs |
| `permissions: {}` + per-job grants | least privilege |
| SHA-pinned actions + Dependabot | supply-chain safety |
| `env:` for `github.event.*` | no script injection |
| OIDC `id-token: write` + `role-to-assume` | no stored cloud keys |
| `docker/build-push-action` + `cache-from: type=gha` | cached image builds |
| Tag images by SHA, deploy by digest | exact rollbacks |
| Reusable workflow / composite action | share jobs / share steps |
| `ci-ok` aggregator as the only required check | stable branch protection |
| `environment: production` + reviewers | gated deploys |

## [05 · Code Quality & Tooling](05-code-quality/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| `strict` + `noUncheckedIndexedAccess` | strong null and index safety |
| `verbatimModuleSyntax` + `erasableSyntaxOnly` | works with Node type stripping |
| `unknown` + Zod at boundaries | validate once at the edge |
| Discriminated unions + `never` | exhaustive state handling |
| `satisfies` | check without widening |
| `eslint.config.js` + `defineConfig` | flat config (ESLint 10) |
| `strictTypeChecked` + `projectService: true` | type-aware lint |
| `no-floating-promises`, `no-misused-promises` | async bug rules |
| `switch-exhaustiveness-check` | missing switch cases |
| `prettier --check .` + `eslint-config-prettier` | formatting separate from lint |
| `--max-warnings 0` | zero-warning gate |
| `@ts-expect-error -- reason` | suppressions that expire |
| `eslint --suppress-rule` | baseline for gradual adoption |

## [06 · Security Fundamentals](06-security/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| STRIDE per trust boundary | quick threat model |
| OWASP Top 10:2025 | A01 access control, A03 supply chain, A05 injection |
| `query('... $1', [v])` | parameterized SQL |
| Scope queries by owner/tenant | stops IDOR |
| Strict schemas | stops mass assignment |
| `execFile(cmd, [args])` | no shell injection |
| `helmet()` | security headers |
| Origin / `Sec-Fetch-Site` check | CSRF defense for cookie auth |
| `textContent`, DOMPurify, CSP | XSS defenses |
| `rateLimit({ store: RedisStore })` | shared rate limits |
| Block private IPs after DNS | SSRF defense |
| `resolve(base, x).startsWith(base + sep)` | path traversal guard |
| `gitleaks git`, push protection | secret scanning |
| `onlyBuiltDependencies`, `minimumReleaseAge` | pnpm supply-chain controls |
| CodeQL default setup, Dependabot alerts | automated scanning |

## [07 · Config & Environments](07-config-environments/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Config in env, build once | 12-factor |
| `NODE_ENV=production` + `APP_ENV=staging` | library mode vs deploy name |
| `node --env-file-if-exists=.env` | native env loading |
| Real env beats file values | precedence |
| `z.coerce.number()`, `z.stringbool()`, `z.url()` | parse env strings |
| `z.prettifyError()` + exit | fail fast with readable errors |
| `loadConfig(source)` + frozen object | one typed config module |
| `.env` ignored, `.env.example` committed | env file rules |
| `depends_on: condition: service_healthy` | Compose start order |
| `ports: "127.0.0.1:5432:5432"` | local-only binding |
| ECS `secrets:` from Secrets Manager | runtime secret injection |
| `NEXT_PUBLIC_` / `VITE_` = public | never secrets |
| Kill switch with safe default | runtime flags |

## [08 · Documentation](08-documentation/docs/cheatsheet.md)
| Item | What it does |
|:--|:--|
| Tutorial / how-to / reference / explanation | Diátaxis |
| README quick start | exact commands to a running app |
| `> [!NOTE]`, Mermaid, `<details>` | GitHub Markdown features |
| `docs/adr/0007-title.md` | decision records; supersede, never edit |
| Runbook: alert → confirm → mitigate → verify | on-call docs |
| Keep a Changelog sections | Added, Changed, Deprecated, Removed, Fixed, Security |
| `createDocument()` + `.meta({ id })` | OpenAPI 3.1 from Zod |
| Document every error response | Problem Details schema |
| `apiReference({ url: '/openapi.json' })` | Scalar UI |
| Regenerate spec + `git diff --exit-code` | docs drift check in CI |
| TSDoc `@param`, `@throws`, `@deprecated` | public API docs |
| Comment why, not what | useful comments |
