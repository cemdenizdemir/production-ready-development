<div align="center">

# Production-Ready Dev

Fundamentals to production, one topic at a time.<br>
<sub><b>Learn</b> → <b>Build</b> → <b>Review</b></sub>

<!-- AUTO:STATS -->
<code>▱▱▱▱▱▱▱▱▱▱</code>&nbsp; <b>0%</b> mastery

<b>0</b>/49 topics &nbsp;·&nbsp; <b>0</b>/4 tasks &nbsp;·&nbsp; <b>0</b> reviewed &nbsp;·&nbsp; <b>—</b> avg score &nbsp;·&nbsp; synced 2026-11-07
<!-- /AUTO:STATS -->

<sub>○ not started &nbsp; ◔ learning &nbsp; ◑ building &nbsp; ◕ reviewing &nbsp; ● done</sub>

</div>

<br>

## Quick start

**You need:** Git · Node 18+ · an AI coding agent that can read and write files (Claude Code, Cursor, Copilot agent mode)

**First time only**

```bash
git clone <your-repo-url> && cd <repo-name>
```

1. Open the folder in your AI agent.
2. Run `/stack` and answer a few questions. This creates `STACK.md`.
3. Every topic already has lessons and a cheatsheet in `docs/`. Start with `modules/01-foundations/01-git`.

**Commands**

| Command | What it does |
|:--|:--|
| `/stack` | Decide the tech stack, or change it: `/stack revisit Database, Auth` |
| `/learn <module>/<topic>` | Writes lessons and a cheatsheet into `docs/`, and tasks into `tasks/` |
| `/learn <topic> mode=tasks` | Writes tasks only, from the lessons already in `docs/` |
| `/learn <target> mode=docs` | Lessons and cheatsheet only. Target: a topic, a module, or `all` |
| `/learn <target> mode=cheatsheet` | Rebuilds the reminder cheatsheets only |
| `/review <module>/<topic> [Txx]` | Reviews a finished task on a copy, and writes `REVIEW.md` |
| `/design "<problem>"` | Interactive system design, DDD, or architecture session; records `DESIGN.md` as a task |
| `/learn <topic> lang=go` | Adds comparison snippets (and tasks) in Go, Java, Python, or Rust for concept topics |

Options: `/learn … level=beginner focus=1,3` · `/review … pending` reviews every finished, unreviewed task.<br>
Paths accept numbers or names: `02-frontend/04-framework`, `frontend/framework`, or `04-framework`.

**Cheatsheets** are tables of what exists, one row per thing, not tutorials: `docs/cheatsheet.md` per topic, `modules/<module>/cheatsheet.md` per module. Open them from the **Cheatsheet** column below.

**The loop**

1. Read the topic's `docs/`, then `/learn 02-frontend/04-framework mode=tasks` to get tasks.
2. Write your code in `tasks/T01-*/` and set `status: done` in its `TASK.md`.
3. `/review 02-frontend/04-framework T01`, then compare your code with `reviews/T01-*/`.
4. If the verdict is *revise*, fix your code and review again.

<details>
<summary><b>Troubleshooting</b></summary>
<br>

| Problem | Fix |
|:--|:--|
| Slash commands don't appear | Tell the agent: `Read .claude/commands/learn.md and follow it. Arguments: 02-frontend/04-framework` |
| Stats look wrong | `node scripts/sync.mjs` |
| No Node installed | Ask the agent to update the AUTO blocks by hand (see [CONVENTIONS](.claude/CONVENTIONS.md)) |
| A topic shows ○ but has lessons | Expected: a topic starts (◔) once it has tasks. Run `/learn <topic> mode=tasks`. |
| Prompt asks about the stack again | The topic's row in `STACK.md` is `undecided`. Answer once and it is saved. |
| Want to change a decided tool | `/stack revisit <layer>` |

</details>

<br>

<!-- AUTO:MODULES -->
<details open>
<summary><b>01 · Foundations</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/8 topics</summary>
<br>

Module cheatsheet: [Foundations](modules/01-foundations/cheatsheet.md)

| | Topic | Tech | Cheatsheet | Tasks | Score |
|:-:|:--|:--|:-:|:-:|:-:|
| ◔ | [Git & Collaboration](modules/01-foundations/01-git) | Git, GitHub | [sheet](modules/01-foundations/01-git/docs/cheatsheet.md) | 0/4 | — |
| ○ | [HTTP & Networking](modules/01-foundations/02-http-networking) | HTTP, Node.js 26, Express 5, curl, Chrome DevTools | [sheet](modules/01-foundations/02-http-networking/docs/cheatsheet.md) | — | — |
| ○ | [Testing](modules/01-foundations/03-testing) | Vitest 4, Supertest, TypeScript | [sheet](modules/01-foundations/03-testing/docs/cheatsheet.md) | — | — |
| ○ | [CI/CD](modules/01-foundations/04-ci-cd) | GitHub Actions, pnpm, Docker | [sheet](modules/01-foundations/04-ci-cd/docs/cheatsheet.md) | — | — |
| ○ | [Code Quality & Tooling](modules/01-foundations/05-code-quality) | ESLint, typescript-eslint, Prettier, TypeScript 6 (strict) | [sheet](modules/01-foundations/05-code-quality/docs/cheatsheet.md) | — | — |
| ○ | [Security Fundamentals](modules/01-foundations/06-security) | Node.js 26, Express 5, Helmet, express-rate-limit, Dependabot, CodeQL, gitleaks | [sheet](modules/01-foundations/06-security/docs/cheatsheet.md) | — | — |
| ○ | [Config & Environments](modules/01-foundations/07-config-environments) | Node.js 26 (--env-file), Zod 4, Docker Compose | [sheet](modules/01-foundations/07-config-environments/docs/cheatsheet.md) | — | — |
| ○ | [Documentation](modules/01-foundations/08-documentation) | Markdown, OpenAPI 3.1 (from Zod), Scalar | [sheet](modules/01-foundations/08-documentation/docs/cheatsheet.md) | — | — |

</details>

<details>
<summary><b>02 · Frontend</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/13 topics</summary>
<br>

Module cheatsheet: [Frontend](modules/02-frontend/cheatsheet.md)

| | Topic | Tech | Cheatsheet | Tasks | Score |
|:-:|:--|:--|:-:|:-:|:-:|
| ○ | [HTML](modules/02-frontend/01-html) | HTML | [sheet](modules/02-frontend/01-html/docs/cheatsheet.md) | — | — |
| ○ | [CSS](modules/02-frontend/02-css) | CSS, then Tailwind CSS 4 | [sheet](modules/02-frontend/02-css/docs/cheatsheet.md) | — | — |
| ○ | [JavaScript](modules/02-frontend/03-javascript) | JavaScript, TypeScript | [sheet](modules/02-frontend/03-javascript/docs/cheatsheet.md) | — | — |
| ○ | [Framework (React / Vue / Angular / Svelte)](modules/02-frontend/04-framework) | React 19.2, TypeScript, Vite 8 | [sheet](modules/02-frontend/04-framework/docs/cheatsheet.md) | — | — |
| ○ | [State Management](modules/02-frontend/05-state-management) | React 19.2, TanStack Query 5 | [sheet](modules/02-frontend/05-state-management/docs/cheatsheet.md) | — | — |
| ○ | [Rendering Strategies](modules/02-frontend/06-rendering) | Next.js 16, React 19.2 | [sheet](modules/02-frontend/06-rendering/docs/cheatsheet.md) | — | — |
| ○ | [Performance](modules/02-frontend/07-performance) | React 19.2, Next.js 16, Vite 8, Lighthouse | [sheet](modules/02-frontend/07-performance/docs/cheatsheet.md) | — | — |
| ○ | [Accessibility](modules/02-frontend/08-accessibility) | HTML, React 19.2, axe-core, Playwright | [sheet](modules/02-frontend/08-accessibility/docs/cheatsheet.md) | — | — |
| ○ | [UX States & Error Handling](modules/02-frontend/09-ux-states) | React 19.2, TanStack Query 5, Tailwind CSS 4 | [sheet](modules/02-frontend/09-ux-states/docs/cheatsheet.md) | — | — |
| ○ | [Forms & Validation](modules/02-frontend/10-forms) | React Hook Form 7, Zod 4, React 19.2 | [sheet](modules/02-frontend/10-forms/docs/cheatsheet.md) | — | — |
| ○ | [Frontend Security](modules/02-frontend/11-security) | React 19.2, Next.js 16, CSP | [sheet](modules/02-frontend/11-security/docs/cheatsheet.md) | — | — |
| ○ | [Cross-Cutting Frontend](modules/02-frontend/12-cross-cutting) | React 19.2, TypeScript, Tailwind CSS 4 | [sheet](modules/02-frontend/12-cross-cutting/docs/cheatsheet.md) | — | — |
| ○ | [Frontend Testing & Monitoring](modules/02-frontend/13-testing-monitoring) | Vitest 4, Testing Library, MSW, Playwright, Sentry | [sheet](modules/02-frontend/13-testing-monitoring/docs/cheatsheet.md) | — | — |

</details>

<details>
<summary><b>03 · Backend</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/12 topics</summary>
<br>

Module cheatsheet: [Backend](modules/03-backend/cheatsheet.md)

| | Topic | Tech | Cheatsheet | Tasks | Score |
|:-:|:--|:--|:-:|:-:|:-:|
| ○ | [Language & Runtime](modules/03-backend/01-language-runtime) | Node.js 26, TypeScript 6 (strict) | [sheet](modules/03-backend/01-language-runtime/docs/cheatsheet.md) | — | — |
| ○ | [API Design](modules/03-backend/02-api-design) | Express 5, Zod 4, OpenAPI 3.1 | [sheet](modules/03-backend/02-api-design/docs/cheatsheet.md) | — | — |
| ○ | [Databases](modules/03-backend/03-databases) | PostgreSQL 18, pg, Drizzle ORM, MongoDB 8, Mongoose | [sheet](modules/03-backend/03-databases/docs/cheatsheet.md) | — | — |
| ○ | [Authentication & Authorization](modules/03-backend/04-auth) | Express 5, Redis 8, argon2, Better Auth | [sheet](modules/03-backend/04-auth/docs/cheatsheet.md) | — | — |
| ○ | [Validation & Abuse Protection](modules/03-backend/05-validation-abuse) | Zod 4, express-rate-limit, Redis 8 | [sheet](modules/03-backend/05-validation-abuse/docs/cheatsheet.md) | — | — |
| ○ | [Caching](modules/03-backend/06-caching) | Redis 8 | [sheet](modules/03-backend/06-caching/docs/cheatsheet.md) | — | — |
| ○ | [Background Jobs & Messaging](modules/03-backend/07-background-jobs) | BullMQ, Redis 8 | [sheet](modules/03-backend/07-background-jobs/docs/cheatsheet.md) | — | — |
| ○ | [Reliability & Resilience](modules/03-backend/08-reliability) | Node.js 26, Express 5, BullMQ | [sheet](modules/03-backend/08-reliability/docs/cheatsheet.md) | — | — |
| ○ | [Scalability & Performance](modules/03-backend/09-scalability) | Node.js 26, PostgreSQL 18, Redis 8, k6 | [sheet](modules/03-backend/09-scalability/docs/cheatsheet.md) | — | — |
| ○ | [Observability](modules/03-backend/10-observability) | Pino, OpenTelemetry, Grafana LGTM, Sentry | [sheet](modules/03-backend/10-observability/docs/cheatsheet.md) | — | — |
| ○ | [Architecture](modules/03-backend/11-architecture) | Node.js 26, Express 5, TypeScript | [sheet](modules/03-backend/11-architecture/docs/cheatsheet.md) | — | — |
| ○ | [Common Integrations](modules/03-backend/12-integrations) | Stripe, AWS SES, AWS S3, BullMQ | [sheet](modules/03-backend/12-integrations/docs/cheatsheet.md) | — | — |

</details>

<details>
<summary><b>04 · Shipping</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/6 topics</summary>
<br>

Module cheatsheet: [Shipping](modules/04-shipping/cheatsheet.md)

| | Topic | Tech | Cheatsheet | Tasks | Score |
|:-:|:--|:--|:-:|:-:|:-:|
| ○ | [Containers](modules/04-shipping/01-containers) | Docker, Docker Compose | [sheet](modules/04-shipping/01-containers/docs/cheatsheet.md) | — | — |
| ○ | [Cloud](modules/04-shipping/02-cloud) | AWS (ECS Fargate, RDS, ElastiCache, S3), MongoDB Atlas | [sheet](modules/04-shipping/02-cloud/docs/cheatsheet.md) | — | — |
| ○ | [Infrastructure as Code](modules/04-shipping/03-iac) | Terraform | [sheet](modules/04-shipping/03-iac/docs/cheatsheet.md) | — | — |
| ○ | [Deployments](modules/04-shipping/04-deployments) | GitHub Actions, Docker, AWS ECS | [sheet](modules/04-shipping/04-deployments/docs/cheatsheet.md) | — | — |
| ○ | [Data Safety](modules/04-shipping/05-data-safety) | PostgreSQL 18, AWS RDS backups, Drizzle Kit migrations, MongoDB Atlas backups | [sheet](modules/04-shipping/05-data-safety/docs/cheatsheet.md) | — | — |
| ○ | [Incident Response](modules/04-shipping/06-incident-response) | Sentry, Grafana, OpenTelemetry | [sheet](modules/04-shipping/06-incident-response/docs/cheatsheet.md) | — | — |

</details>

<details>
<summary><b>05 · Practice</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/1 topics</summary>
<br>

Module cheatsheet: [Practice](modules/05-practice/cheatsheet.md)

| | Topic | Tech | Cheatsheet | Tasks | Score |
|:-:|:--|:--|:-:|:-:|:-:|
| ○ | [Engineering Practice](modules/05-practice/01-engineering-practice) | Git, GitHub | [sheet](modules/05-practice/01-engineering-practice/docs/cheatsheet.md) | — | — |

</details>

<details>
<summary><b>06 · Software Design & Architecture</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/7 topics</summary>
<br>

Module cheatsheet: [Software Design & Architecture](modules/06-design/cheatsheet.md)

| | Topic | Tech | Cheatsheet | Tasks | Score |
|:-:|:--|:--|:-:|:-:|:-:|
| ○ | [Paradigms & OOP](modules/06-design/01-paradigms-oop) | TypeScript 6 (strict) | [sheet](modules/06-design/01-paradigms-oop/docs/cheatsheet.md) | — | — |
| ○ | [Design Principles & SOLID](modules/06-design/02-principles) | TypeScript 6 (strict) | [sheet](modules/06-design/02-principles/docs/cheatsheet.md) | — | — |
| ○ | [Design Patterns](modules/06-design/03-design-patterns) | TypeScript 6 (strict), Node.js 26 | [sheet](modules/06-design/03-design-patterns/docs/cheatsheet.md) | — | — |
| ○ | [Architecture Styles](modules/06-design/04-architecture-styles) | TypeScript, Express 5, Next.js 16, React 19.2 | [sheet](modules/06-design/04-architecture-styles/docs/cheatsheet.md) | — | — |
| ○ | [Domain-Driven Design](modules/06-design/05-domain-driven-design) | TypeScript, Node.js 26, Drizzle ORM, PostgreSQL 18 | [sheet](modules/06-design/05-domain-driven-design/docs/cheatsheet.md) | — | — |
| ○ | [System Design](modules/06-design/06-system-design) | PostgreSQL 18, Redis 8, BullMQ, AWS | [sheet](modules/06-design/06-system-design/docs/cheatsheet.md) | — | — |
| ○ | [Distributed Systems](modules/06-design/07-distributed-systems) | PostgreSQL 18, Redis 8, BullMQ | [sheet](modules/06-design/07-distributed-systems/docs/cheatsheet.md) | — | — |

</details>

<details>
<summary><b>07 · Capstone</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/2 topics</summary>
<br>

Module cheatsheet: [Capstone](modules/07-capstone/cheatsheet.md)

| | Topic | Tech | Cheatsheet | Tasks | Score |
|:-:|:--|:--|:-:|:-:|:-:|
| ○ | [Design & Build](modules/07-capstone/01-design-build) | Next.js 16, Express 5, TypeScript, PostgreSQL 18, Drizzle ORM, Redis 8, BullMQ | [sheet](modules/07-capstone/01-design-build/docs/cheatsheet.md) | — | — |
| ○ | [Pre-Launch Checklist](modules/07-capstone/02-pre-launch) | Next.js 16, Express 5, PostgreSQL 18, Redis 8, AWS, Terraform | [sheet](modules/07-capstone/02-pre-launch/docs/cheatsheet.md) | — | — |

</details>
<!-- /AUTO:MODULES -->

<br>

<sub>Stats update automatically via <code>node scripts/sync.mjs</code> · <a href="STACK.md">STACK</a> · <a href="CHEATSHEET.md">CHEATSHEET</a> · <a href=".claude/CONVENTIONS.md">CONVENTIONS</a></sub>