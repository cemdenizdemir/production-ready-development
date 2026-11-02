<div align="center">

# Production-Ready Dev

Fundamentals to production, one topic at a time.<br>
<sub><b>Learn</b> → <b>Build</b> → <b>Review</b></sub>

<!-- AUTO:STATS -->
<code>▱▱▱▱▱▱▱▱▱▱</code>&nbsp; <b>0%</b> mastery

<b>0</b>/41 topics &nbsp;·&nbsp; <b>0</b>/4 tasks &nbsp;·&nbsp; <b>0</b> reviewed &nbsp;·&nbsp; <b>—</b> avg score &nbsp;·&nbsp; synced 2026-11-02
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
3. Run `/learn 01-foundations/01-git` to start your first topic.

**Commands**

| Command | What it does |
|:--|:--|
| `/stack` | Decide the tech stack, or change it: `/stack revisit Database, Auth` |
| `/learn <module>/<topic>` | Writes lessons into `docs/` and tasks into `tasks/` |
| `/review <module>/<topic> [Txx]` | Reviews a finished task on a copy, and writes `REVIEW.md` |

Options: `/learn … level=beginner focus=1,3` · `/review … pending` reviews every finished, unreviewed task.<br>
Paths accept numbers or names: `02-frontend/04-framework`, `frontend/framework`, or `04-framework`.

**The loop**

1. `/learn 02-frontend/04-framework`, then read `docs/`.
2. Write your code in `tasks/T01-*/` and set `status: done` in its `TASK.md`.
3. `/review 02-frontend/04-framework T01`, then compare your code with `reviews/T01-*/`.
4. If the verdict is *revise*, fix your code and review again.

<details>
<summary><b>Troubleshooting</b></summary>
<br>

| Problem | Fix |
|:--|:--|
| Slash commands don't appear | Tell the agent: `Read .ai/prompts/learn.md and follow it. Arguments: 02-frontend/04-framework` |
| Stats look wrong | `node scripts/sync.mjs` |
| No Node installed | Ask the agent to update the AUTO blocks by hand (see [CONVENTIONS](.ai/CONVENTIONS.md)) |
| Prompt asks about the stack again | The topic's row in `STACK.md` is `undecided`. Answer once and it is saved. |
| Want to change a decided tool | `/stack revisit <layer>` |

</details>

<br>

<!-- AUTO:MODULES -->
<details open>
<summary><b>01 · Foundations</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/8 topics</summary>
<br>

| | Topic | Tech | Tasks | Score |
|:-:|:--|:--|:-:|:-:|
| ◔ | [Git & Collaboration](modules/01-foundations/01-git) | Git, GitHub | 0/4 | — |
| ○ | [HTTP & Networking](modules/01-foundations/02-http-networking) | HTTP, Node.js 26, Express 5, curl, Chrome DevTools | — | — |
| ○ | [Testing](modules/01-foundations/03-testing) | Vitest 4, Supertest, TypeScript | — | — |
| ○ | [CI/CD](modules/01-foundations/04-ci-cd) | GitHub Actions, pnpm, Docker | — | — |
| ○ | [Code Quality & Tooling](modules/01-foundations/05-code-quality) | ESLint, typescript-eslint, Prettier, TypeScript 6 (strict) | — | — |
| ○ | [Security Fundamentals](modules/01-foundations/06-security) | Node.js 26, Express 5, Helmet, express-rate-limit, Dependabot, CodeQL, gitleaks | — | — |
| ○ | [Config & Environments](modules/01-foundations/07-config-environments) | Node.js 26 (--env-file), Zod 4, Docker Compose | — | — |
| ○ | [Documentation](modules/01-foundations/08-documentation) | Markdown, OpenAPI 3.1 (from Zod), Scalar | — | — |

</details>

<details>
<summary><b>02 · Frontend</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/13 topics</summary>
<br>

| | Topic | Tech | Tasks | Score |
|:-:|:--|:--|:-:|:-:|
| ○ | [HTML](modules/02-frontend/01-html) | HTML | — | — |
| ○ | [CSS](modules/02-frontend/02-css) | CSS, then Tailwind CSS 4 | — | — |
| ○ | [JavaScript](modules/02-frontend/03-javascript) | JavaScript, TypeScript | — | — |
| ○ | [Framework (React / Vue / Angular / Svelte)](modules/02-frontend/04-framework) | React 19.2, TypeScript, Vite 8 | — | — |
| ○ | [State Management](modules/02-frontend/05-state-management) | React 19.2, TanStack Query 5 | — | — |
| ○ | [Rendering Strategies](modules/02-frontend/06-rendering) | Next.js 16, React 19.2 | — | — |
| ○ | [Performance](modules/02-frontend/07-performance) | React 19.2, Next.js 16, Vite 8, Lighthouse | — | — |
| ○ | [Accessibility](modules/02-frontend/08-accessibility) | HTML, React 19.2, axe-core, Playwright | — | — |
| ○ | [UX States & Error Handling](modules/02-frontend/09-ux-states) | React 19.2, TanStack Query 5, Tailwind CSS 4 | — | — |
| ○ | [Forms & Validation](modules/02-frontend/10-forms) | React Hook Form 7, Zod 4, React 19.2 | — | — |
| ○ | [Frontend Security](modules/02-frontend/11-security) | React 19.2, Next.js 16, CSP | — | — |
| ○ | [Cross-Cutting Frontend](modules/02-frontend/12-cross-cutting) | React 19.2, TypeScript, Tailwind CSS 4 | — | — |
| ○ | [Frontend Testing & Monitoring](modules/02-frontend/13-testing-monitoring) | Vitest 4, Testing Library, MSW, Playwright, Sentry | — | — |

</details>

<details>
<summary><b>03 · Backend</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/12 topics</summary>
<br>

| | Topic | Tech | Tasks | Score |
|:-:|:--|:--|:-:|:-:|
| ○ | [Language & Runtime](modules/03-backend/01-language-runtime) | Node.js 26, TypeScript 6 (strict) | — | — |
| ○ | [API Design](modules/03-backend/02-api-design) | Express 5, Zod 4, OpenAPI 3.1 | — | — |
| ○ | [Databases](modules/03-backend/03-databases) | PostgreSQL 18, pg, Drizzle ORM, MongoDB 8, Mongoose | — | — |
| ○ | [Authentication & Authorization](modules/03-backend/04-auth) | Express 5, Redis 8, argon2, Better Auth | — | — |
| ○ | [Validation & Abuse Protection](modules/03-backend/05-validation-abuse) | Zod 4, express-rate-limit, Redis 8 | — | — |
| ○ | [Caching](modules/03-backend/06-caching) | Redis 8 | — | — |
| ○ | [Background Jobs & Messaging](modules/03-backend/07-background-jobs) | BullMQ, Redis 8 | — | — |
| ○ | [Reliability & Resilience](modules/03-backend/08-reliability) | Node.js 26, Express 5, BullMQ | — | — |
| ○ | [Scalability & Performance](modules/03-backend/09-scalability) | Node.js 26, PostgreSQL 18, Redis 8, k6 | — | — |
| ○ | [Observability](modules/03-backend/10-observability) | Pino, OpenTelemetry, Grafana LGTM, Sentry | — | — |
| ○ | [Architecture](modules/03-backend/11-architecture) | Node.js 26, Express 5, TypeScript | — | — |
| ○ | [Common Integrations](modules/03-backend/12-integrations) | Stripe, AWS SES, AWS S3, BullMQ | — | — |

</details>

<details>
<summary><b>04 · Shipping</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/6 topics</summary>
<br>

| | Topic | Tech | Tasks | Score |
|:-:|:--|:--|:-:|:-:|
| ○ | [Containers](modules/04-shipping/01-containers) | Docker, Docker Compose | — | — |
| ○ | [Cloud](modules/04-shipping/02-cloud) | AWS (ECS Fargate, RDS, ElastiCache, S3), MongoDB Atlas | — | — |
| ○ | [Infrastructure as Code](modules/04-shipping/03-iac) | Terraform | — | — |
| ○ | [Deployments](modules/04-shipping/04-deployments) | GitHub Actions, Docker, AWS ECS | — | — |
| ○ | [Data Safety](modules/04-shipping/05-data-safety) | PostgreSQL 18, AWS RDS backups, Drizzle Kit migrations, MongoDB Atlas backups | — | — |
| ○ | [Incident Response](modules/04-shipping/06-incident-response) | Sentry, Grafana, OpenTelemetry | — | — |

</details>

<details>
<summary><b>05 · Practice</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/1 topics</summary>
<br>

| | Topic | Tech | Tasks | Score |
|:-:|:--|:--|:-:|:-:|
| ○ | [Engineering Practice](modules/05-practice/01-engineering-practice) | Git, GitHub | — | — |

</details>

<details>
<summary><b>06 · Capstone</b>&nbsp; <code>▱▱▱▱▱▱▱▱▱▱</code> 0% · 0/1 topics</summary>
<br>

| | Topic | Tech | Tasks | Score |
|:-:|:--|:--|:-:|:-:|
| ○ | [Pre-Launch Checklist](modules/06-capstone/01-pre-launch) | Next.js 16, Express 5, PostgreSQL 18, Redis 8, AWS, Terraform | — | — |

</details>
<!-- /AUTO:MODULES -->

<br>

<sub>Stats update automatically via <code>node scripts/sync.mjs</code> · <a href="STACK.md">STACK</a> · <a href="CHEATSHEET.md">CHEATSHEET</a> · <a href=".ai/CONVENTIONS.md">CONVENTIONS</a></sub>