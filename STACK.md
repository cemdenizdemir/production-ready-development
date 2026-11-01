# Stack
Decided stack for this repo. The learn and review prompts read this file.
Updated: 2026-11-01

## Goal
- Target: learn the most; keep job, freelance, startup, and personal options open; no single market
- Level: mid-level (has shipped production code)
- Time per week: ~10 h for 6–9 months (~300 h total)
- Constraints: flexible cloud budget; Windows 11 with WSL2; Node.js + Express + TypeScript fixed

## Choices
| Layer | Choice | Why | Status |
|:--|:--|:--|:--|
| Language | TypeScript 6.0.x (strict), Node.js 26 LTS | one language both sides; TS 7 later | decided |
| Package manager and monorepo | pnpm, workspaces only when needed | fast, strict deps, no Turborepo needed | decided |
| Lint and format | ESLint + typescript-eslint + Prettier | industry default, type-aware rules | decided |
| Frontend framework | React 19.2 + Vite 8 | biggest job market, fast tooling | decided |
| Meta-framework | Next.js 16 (App Router), frontend only | most hired; teaches every rendering mode | decided |
| Server state | TanStack Query v5 | standard client cache, client components only | decided |
| Styling | Tailwind CSS v4, after plain CSS | fast and common; learn CSS first | decided |
| Forms and validation | React Hook Form 7 + Zod 4 | one schema validates front and back | decided |
| Backend runtime and framework | Node.js 26 + Express 5 | your pick; thin, teaches fundamentals | decided |
| Database | PostgreSQL 18 (primary) + MongoDB 8 (secondary) | relational core plus MERN document skills | decided |
| ORM or query layer | pg then Drizzle ORM; Mongoose | SQL-first learning; Mongo job standard | decided |
| Cache and queues | Redis 8 + BullMQ | caching, sessions, rate limits, jobs | decided |
| Auth | hand-built sessions, then Better Auth | learn internals, then ship self-hosted | decided |
| Testing | Vitest 4, Supertest, Testcontainers, Testing Library, MSW, Playwright | real dependencies at every test level | decided |
| Observability | Pino + OpenTelemetry + Grafana LGTM + Sentry | vendor-neutral standard, free locally | decided |
| Containers | Docker + Compose (Docker Desktop, WSL2) | universal; runs whole stack locally | decided |
| CI/CD | GitHub Actions | repo already on GitHub, most common | decided |
| Cloud | AWS (ECS Fargate, RDS, ElastiCache, S3) + MongoDB Atlas | most cloud job ads | decided |
| Infrastructure as code | Terraform, S3 backend | most job ads; OpenTofu-compatible | decided |
| Security tooling | Helmet, express-rate-limit, Dependabot, CodeQL, gitleaks | closes 06-security tooling gaps | tentative |
| API docs | OpenAPI 3.1 generated from Zod, Scalar UI | docs from the same schemas | tentative |
| Load testing | k6 | scriptable in JS, fits Grafana | tentative |
| Integrations | Stripe (test mode), AWS SES | payments and email, both job staples | tentative |

Status is one of: decided, tentative, undecided.

## Topic → TECH
Exact string the learn prompt uses as TECH for each topic.
| Topic | TECH |
|:--|:--|
| modules/01-foundations/01-git | Git, GitHub |
| modules/01-foundations/02-http-networking | HTTP, Node.js 26, Express 5, curl, Chrome DevTools |
| modules/01-foundations/03-testing | Vitest 4, Supertest, TypeScript |
| modules/01-foundations/04-ci-cd | GitHub Actions, pnpm, Docker |
| modules/01-foundations/05-code-quality | ESLint, typescript-eslint, Prettier, TypeScript 6 (strict) |
| modules/01-foundations/06-security | Node.js 26, Express 5, Helmet, express-rate-limit, Dependabot, CodeQL, gitleaks |
| modules/01-foundations/07-config-environments | Node.js 26 (--env-file), Zod 4, Docker Compose |
| modules/01-foundations/08-documentation | Markdown, OpenAPI 3.1 (from Zod), Scalar |
| modules/02-frontend/01-html | HTML |
| modules/02-frontend/02-css | CSS, then Tailwind CSS 4 |
| modules/02-frontend/03-javascript | JavaScript, TypeScript |
| modules/02-frontend/04-framework | React 19.2, TypeScript, Vite 8 |
| modules/02-frontend/05-state-management | React 19.2, TanStack Query 5 |
| modules/02-frontend/06-rendering | Next.js 16, React 19.2 |
| modules/02-frontend/07-performance | React 19.2, Next.js 16, Vite 8, Lighthouse |
| modules/02-frontend/08-accessibility | HTML, React 19.2, axe-core, Playwright |
| modules/02-frontend/09-ux-states | React 19.2, TanStack Query 5, Tailwind CSS 4 |
| modules/02-frontend/10-forms | React Hook Form 7, Zod 4, React 19.2 |
| modules/02-frontend/11-security | React 19.2, Next.js 16, CSP |
| modules/02-frontend/12-cross-cutting | React 19.2, TypeScript, Tailwind CSS 4 |
| modules/02-frontend/13-testing-monitoring | Vitest 4, Testing Library, MSW, Playwright, Sentry |
| modules/03-backend/01-language-runtime | Node.js 26, TypeScript 6 (strict) |
| modules/03-backend/02-api-design | Express 5, Zod 4, OpenAPI 3.1 |
| modules/03-backend/03-databases | PostgreSQL 18, pg, Drizzle ORM, MongoDB 8, Mongoose |
| modules/03-backend/04-auth | Express 5, Redis 8, argon2, Better Auth |
| modules/03-backend/05-validation-abuse | Zod 4, express-rate-limit, Redis 8 |
| modules/03-backend/06-caching | Redis 8 |
| modules/03-backend/07-background-jobs | BullMQ, Redis 8 |
| modules/03-backend/08-reliability | Node.js 26, Express 5, BullMQ |
| modules/03-backend/09-scalability | Node.js 26, PostgreSQL 18, Redis 8, k6 |
| modules/03-backend/10-observability | Pino, OpenTelemetry, Grafana LGTM, Sentry |
| modules/03-backend/11-architecture | Node.js 26, Express 5, TypeScript |
| modules/03-backend/12-integrations | Stripe, AWS SES, AWS S3, BullMQ |
| modules/04-shipping/01-containers | Docker, Docker Compose |
| modules/04-shipping/02-cloud | AWS (ECS Fargate, RDS, ElastiCache, S3), MongoDB Atlas |
| modules/04-shipping/03-iac | Terraform |
| modules/04-shipping/04-deployments | GitHub Actions, Docker, AWS ECS |
| modules/04-shipping/05-data-safety | PostgreSQL 18, AWS RDS backups, Drizzle Kit migrations, MongoDB Atlas backups |
| modules/04-shipping/06-incident-response | Sentry, Grafana, OpenTelemetry |
| modules/05-practice/01-engineering-practice | Git, GitHub |
| modules/06-capstone/01-pre-launch | Next.js 16, Express 5, PostgreSQL 18, Redis 8, AWS, Terraform |

## Learn order
1. 01-foundations, starting with 06-security; do 02-http-networking first if cookies or CORS feel shaky.
2. 04-shipping/01-containers, because Docker runs Postgres, Mongo, and Redis for everything after.
3. 03-backend/01–05, the Express core: runtime, API design, databases, auth, validation.
4. 02-frontend/01–05 and 10: quick refresher, then React, state, and forms against your own API.
5. 03-backend/06–12: caching, jobs, reliability, scalability, observability, architecture, integrations.
6. 02-frontend/06–09 and 11–13: Next.js rendering, performance, accessibility, security, testing.
7. 04-shipping/02–06: AWS, Terraform, deployments, data safety, incident response.
8. 05-practice runs alongside every module; 06-capstone comes last.

## Decision log
- 2026-11-01 · Language · TypeScript 6.0.x (strict), Node.js 26 LTS · fixed by me; pin TS 6 until typescript-eslint supports TS 7
- 2026-11-01 · Package manager and monorepo · pnpm, workspaces when needed · strict deps; Corepack not bundled since Node 25
- 2026-11-01 · Lint and format · ESLint + typescript-eslint + Prettier · industry default, mature type-aware rules
- 2026-11-01 · Frontend framework · React 19.2 + Vite 8 · largest job market; Vite 8 uses Rolldown
- 2026-11-01 · Meta-framework · Next.js 16, frontend only · most hired; Express keeps API and auth; self-host in Docker
- 2026-11-01 · Server state · TanStack Query v5 · standard; use only in client components
- 2026-11-01 · Styling · Tailwind CSS v4 after plain CSS · common and fast; CSS fundamentals first
- 2026-11-01 · Forms and validation · React Hook Form 7 + Zod 4 · one Zod schema shared by form and Express
- 2026-11-01 · Backend runtime and framework · Node.js 26 + Express 5 · fixed by me; native type stripping, erasableSyntaxOnly
- 2026-11-01 · Database · PostgreSQL 18 + MongoDB 8 · Postgres primary; Mongo for MERN skills; move to PG 19 after 19.1
- 2026-11-01 · ORM or query layer · pg then Drizzle ORM; Mongoose · SQL-first; Prisma 7 lacks MongoDB support
- 2026-11-01 · Cache and queues · Redis 8 + BullMQ · caching, sessions, rate limits, jobs; Valkey is the fallback
- 2026-11-01 · Auth · hand-built sessions, then Better Auth · learn internals first; self-hosted, MIT; Auth.js is security-fix only
- 2026-11-01 · Testing · Vitest 4, Supertest, Testcontainers, Testing Library, MSW, Playwright · real dependencies, not mocks
- 2026-11-01 · Observability · Pino + OpenTelemetry + Grafana LGTM + Sentry · vendor-neutral; Sentry shares the OTel setup
- 2026-11-01 · Containers · Docker + Compose on WSL2 · universal; keep code in the WSL2 filesystem
- 2026-11-01 · CI/CD · GitHub Actions · repo on GitHub; pin actions to SHA, use OIDC
- 2026-11-01 · Cloud · AWS + MongoDB Atlas · most job ads; App Runner closed to new customers, use ECS
- 2026-11-01 · Infrastructure as code · Terraform, S3 backend · most job ads; avoid Terraform-only features to keep OpenTofu exit
- 2026-11-01 · Security tooling · Helmet, express-rate-limit, Dependabot, CodeQL, gitleaks · tentative; fills 06-security gap
- 2026-11-01 · API docs · OpenAPI 3.1 from Zod, Scalar · tentative; fills 08-documentation gap
- 2026-11-01 · Load testing · k6 · tentative; fills 09-scalability gap
- 2026-11-01 · Integrations · Stripe (test mode), AWS SES · tentative; fills 12-integrations gap
