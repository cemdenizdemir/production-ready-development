---
title: Config & Environments cheatsheet
tech: Node.js 26 (--env-file), Zod 4, Docker Compose
version: Node.js 26 LTS, Zod 4.4, Docker Compose v2
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Config & Environments cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Principles
| Principle | What it means |
|:--|:--|
| ⭐ Config in the environment | values that vary per deploy live outside code (12-factor III) |
| ⭐ Build once, run anywhere | one image for all environments |
| ⭐ Validate at startup, fail fast | invalid config → exit before taking traffic |
| One config module | only `config.ts` reads `process.env` |
| Dev/prod parity | same versions, image, migrations (12-factor X) |
| Secrets ≠ config | secrets from a secret manager, scoped by IAM |
| Config is code | env config changed by reviewed PRs (IaC) |
| Safe defaults | defaults only for non-secret, harmless settings |

## Environments
| Environment | Purpose | Note |
|:--|:--|:--|
| local | development | Compose for services |
| test | CI checks | Testcontainers, fakes |
| preview | per-PR review apps | seed data, destroyed on close |
| ⭐ staging | prod-like rehearsal | `NODE_ENV=production`, sandbox keys |
| ⭐ production | real users | |
| ⭐ `NODE_ENV` | `production` / `development` / `test` only | library behavior |
| `APP_ENV` | `local` / `staging` / `production`… | where it runs |

## Node.js env loading
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `node --env-file=.env app.ts` | load env file | Node 20.6+ |
| multiple `--env-file` | later overrides earlier | |
| ⭐ `--env-file-if-exists=.env` | optional file | Node 22.9+ |
| `process.loadEnvFile(path)` | load from code | Node 21.7+ |
| `util.parseEnv(text)` | parse dotenv text | |
| `process.env.X` | always `string \| undefined` | parse it |
| Precedence | real env beats file values | |
| No expansion | `${VAR}` stays literal | dotenv-expand if needed |
| `node --watch` | restart on change | dev |
| `node --run dev` | run a package.json script fast | Node 22+ |
| also seen | `dotenv`, `dotenvx` (encrypted env files) | |

## Zod 4 for config
| API | What it does | Example |
|:--|:--|:--|
| ⭐ `z.object({...}).safeParse(process.env)` | parse without throwing | check `.success` |
| ⭐ `z.coerce.number().int()` | string → number | `PORT` |
| ⭐ `z.stringbool()` | `"true"/"1"/"yes"` → boolean | flags |
| `z.coerce.boolean()` | JS truthiness | avoid: `"false"` → true |
| ⭐ `z.url()` / `z.email()` / `z.uuid()` | formats | top-level in v4 |
| `z.enum([...])` | allowed values | `LOG_LEVEL` |
| `.default(v)` | fallback | non-secrets only |
| `.optional()` | may be missing | |
| `.transform(fn).pipe(schema)` | convert then validate | CSV → array of URLs |
| `.min(32, 'message')` | custom messages | secrets length |
| `.refine()` / `.superRefine()` | cross-field rules | "TLS cert needs key" |
| ⭐ `z.prettifyError(err)` | readable error text | startup logs |
| `z.treeifyError(err)` / `z.flattenError(err)` | structured errors | |
| `z.infer<typeof Schema>` | static type | |
| `Object.freeze(config)` | immutable config | |

## Config module pattern
| Piece | What it does | Note |
|:--|:--|:--|
| ⭐ `loadConfig(source)` | parse any object | testable |
| `export const config = loadConfig(process.env)` | parse at import | throws early |
| Grouped shape | `config.db.url`, `config.http.port` | readable |
| `createApp(config)` | inject config | tests pass their own |
| `no-restricted-properties` ESLint rule | ban `process.env` elsewhere | core rule |
| Keys in errors, not values | no secret leaks | |
| Log safe fields at startup | `APP_ENV`, version, flags | redact secrets |

## .env files
| File | Commit? | Contains |
|:--|:--|:--|
| `.env` | ✗ | local values |
| ⭐ `.env.example` | ✓ | every key, placeholders, comments |
| `.env.test` | ✓ if secret-free | test values |
| `.env.local` / `.env.*.local` | ✗ | personal overrides (Next.js, Vite) |
| `.env.production` | ✗ | use platform env instead |
| `.gitignore` | `.env`, `.env.*`, `!.env.example` | see 01-git |
| Quoting | `"value with spaces # not a comment"` | |
| Generating secrets | `openssl rand -base64 48` | |

## Docker Compose (local)
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `compose.yaml` | services definition | `version:` key is obsolete |
| ⭐ Pinned images | `postgres:18-alpine`, `redis:8-alpine` | match production majors |
| ⭐ `healthcheck` | readiness test | `pg_isready`, `redis-cli ping` |
| ⭐ `depends_on: { db: { condition: service_healthy } }` | start order | |
| `ports: ["127.0.0.1:5432:5432"]` | local-only binding | |
| Named volumes | persistent data | `down -v` deletes |
| PG 18 volume path | mount `/var/lib/postgresql` | not `/data` anymore |
| `environment:` / `env_file:` | container env | |
| `${VAR:-default}` | interpolation with default | from shell or project `.env` |
| `${VAR:?error}` | required interpolation | fail if missing |
| `profiles: [observability]` | optional services | `--profile` flag |
| `compose.override.yaml` | auto-merged overrides | personal tweaks |
| `include:` | compose other files | split big setups |
| `develop.watch` | sync/rebuild on change | `docker compose watch` |
| `secrets:` | file-based secrets mounted in `/run/secrets` | |
| `restart: unless-stopped` | restart policy | |
| `name:` | project name | prefixes containers/volumes |

## Compose commands
| Command | What it does |
|:--|:--|
| ⭐ `docker compose up -d --wait` | start and wait for healthy |
| `docker compose ps` | status and health |
| `docker compose logs -f <svc>` | follow logs |
| `docker compose exec postgres psql -U app shop` | shell into a service |
| `docker compose down` / `down -v` | stop / stop and wipe volumes |
| `docker compose pull` | update images |
| `docker compose config` | print the merged, interpolated config |
| `docker compose --profile observability up -d` | include a profile |
| `docker compose watch` | dev file sync |
| `docker compose run --rm app pnpm db:migrate` | one-off command |

## Secrets
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ AWS Secrets Manager | secrets with rotation | per-secret cost |
| SSM Parameter Store `SecureString` | cheaper secret/config store | no built-in rotation |
| ⭐ ECS `secrets:` in task definition | injects secrets as env vars | fetched at task start |
| IAM scoping | only the service role can read | |
| Dual-secret rotation | sign with new, verify new + old | `SESSION_SECRETS=new,old` |
| Gradual restart | pick up rotated DB creds | rolling deploy |
| Short cache fetch | read secrets at runtime with TTL | AWS SDK |
| CloudTrail | audit secret reads/changes | |
| Never in images or Git | `COPY .env` is a leak | |

## Frontend config
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Browser = public | everything in the bundle is readable | |
| ⭐ Vite `import.meta.env.VITE_*` | inlined at build | type in `vite-env.d.ts` |
| Vite modes | `.env.[mode]`, `vite build --mode staging` | |
| `loadEnv(mode, cwd)` | read env in `vite.config.ts` | |
| ⭐ Next.js `NEXT_PUBLIC_*` | inlined into client code at build | write the full name literally |
| Next.js server env | `process.env.X` in Server Components / route handlers | runtime |
| `import 'server-only'` | build error if imported by client code | protect secrets |
| Runtime config endpoint | `/config.json` fetched at boot | build once |
| Publishable keys | Stripe `pk_...`, analytics IDs | OK in the browser |

## Feature flags
| Item | What it is | Note |
|:--|:--|:--|
| ⭐ Release flag | hide unfinished work, ramp up | remove after 100% |
| ⭐ Kill switch | turn off a risky dependency fast | permanent |
| Experiment flag | A/B test | analytics needed |
| Permission flag | per-account access | |
| ⭐ Safe default | used when the flag source fails | old behavior |
| Percentage rollout | hash(user ID) < N% | sticky per user |
| Targeting | by account, region, plan | |
| OpenFeature | vendor-neutral flag SDK standard | |
| Flag services | LaunchDarkly, Unleash, Flagsmith, GrowthBook | also seen |
| Flag debt | owner + removal date per flag | |

## Safe config changes
| Practice | Why |
|:--|:--|
| ⭐ Add with default → set → remove default | no broken instances mid-rollout |
| Read old + new key, warn on old | rename without outages |
| Staging first | catch typos before production |
| Reviewed in Git (Terraform, workflows) | audit trail |
| Config change = deploy event | visible in dashboards and incident timelines |
| Validate in CI | schema keys vs `.env.example` keys |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `"false"` is truthy | flags on when "off" | `z.stringbool()` |
| `Number("")` is `0` | empty var becomes 0 | schema with `.min()` |
| `NODE_ENV=staging` | dev behavior in staging | `NODE_ENV=production` + `APP_ENV` |
| Build-time API URLs | rebuild per environment | runtime config |
| Secret in `NEXT_PUBLIC_*` / `VITE_*` | shipped to browsers | server-only env |
| `process.env[name]` in Next client code | not inlined, undefined | literal `process.env.NEXT_PUBLIC_X` |
| Logging the config object | secrets in logs | log safe fields |
| Compose reads project `.env` for interpolation | surprise values | `docker compose config` to check |
| `depends_on` without health | app starts too early | `service_healthy` |
| Unpinned images | surprise major upgrades | pin tags or digests |
| Old PG data path with PG 18 image | container fails to start | mount `/var/lib/postgresql` |

## Sources
| Source | Link |
|:--|:--|
| Twelve-Factor App | https://12factor.net/ |
| Node.js environment variables | https://nodejs.org/api/environment_variables.html |
| Node.js CLI `--env-file` | https://nodejs.org/api/cli.html#--env-filefile |
| Zod 4 | https://zod.dev/v4 |
| Docker Compose file reference | https://docs.docker.com/reference/compose-file/ |
| Next.js environment variables | https://nextjs.org/docs/app/guides/environment-variables |
| Vite env and modes | https://vite.dev/guide/env-and-mode |
| OpenFeature | https://openfeature.dev/ |
