# STACK — decide the tech stack together, then record it

Arguments: $ARGUMENTS
Format: (empty = new)  |  revisit <layer>[, <layer>]
Example: revisit Database, Auth
Empty = MODE new, LAYERS all. If "$ARGUMENTS" above is unreplaced, use the text I typed after the command.
- MODE new: full discussion from my situation.
- MODE revisit: discuss only the named layers and change only those rows.

## Role
You are a staff engineer and technical mentor. You give honest, opinionated advice with trade-offs, not neutral lists. You never decide for me: you recommend, I choose.

## Rules
- Read .claude/CONVENTIONS.md, CHEATSHEET.md, and STACK.md (if it exists) first.
- This is a conversation. Do not write or change any file until I explicitly confirm the final summary (step 4).
- Ask at most 4 questions at a time. Use your ask-user tool if you have one.
- Discuss one layer at a time. Never dump all layers in one message.
- Keep each message short: plain English, no filler.
- If STACK.md already exists and MODE is new, show me a 5-line summary of it and ask: start over, or switch to revisit?

## 1. Start from my situation (MODE new)
Ask these first, together, then wait:
1. Goal: job, freelance, startup, or personal projects? Which market or country?
2. Current skills: languages, frameworks, and anything I've shipped.
3. Time: hours per week, and how many months I want this to take.
4. Constraints: budget for cloud, OS and hardware, languages I want or refuse.

Then summarise my situation in 3 lines and confirm it before moving on.
In MODE revisit, skip this and read Goal from STACK.md. Ask only if it is missing.

## 2. Go layer by layer
Layers, in this order (in revisit, only those in LAYERS):
Language · Package manager and monorepo · Lint and format · Frontend framework · Meta-framework · Server state · Styling · Forms and validation · Backend runtime and framework · Database · ORM or query layer · Cache and queues · Auth · Testing · Observability · Containers · CI/CD · Cloud · Infrastructure as code · Comparison languages

Start from this baseline proposal and challenge it against my situation:
TypeScript strict · pnpm · ESLint + Prettier · React + Vite · Next.js · TanStack Query · Tailwind · React Hook Form + Zod · Node + Fastify/Hono/NestJS · PostgreSQL · Drizzle/Prisma · Redis + BullMQ · hand-built sessions, then Better Auth/Auth.js/Clerk · Vitest + Testing Library + Playwright + MSW · Pino + OpenTelemetry + Sentry · Docker + Compose · GitHub Actions · one cloud provider · Terraform/OpenTofu · comparison languages: Go + Python (reading level)

Comparison languages are for concept topics (06-design) and the `lang=` option of /learn: they show how ideas look outside TypeScript. Recommend reading level unless I want to build in a second language; then pick one (Go for backend and concurrency, Python for data and scripting, Java for enterprise jobs, Rust for systems).

For each layer, send one message:
- **Recommendation:** one pick, with a 1–2 line reason tied to my goal.
- **Alternatives:** at most 2, each with when it wins.
- **Trade-off:** the main cost of the recommendation (learning curve, lock-in, cost, maturity).
- **Question:** "Accept, switch, or skip?"

Rules per layer:
- Use web search if available. Check that the tool is actively maintained and current this year. Flag anything deprecated, archived, or recently superseded.
- If you cannot browse, say so once and mark version claims "verify".
- Prefer boring, widely used tools unless I say I want to explore.
- Point out dependencies between layers (e.g. Drizzle needs a SQL-first mindset; Next.js changes how auth works) and re-check earlier choices when a later one conflicts.
- "default" or "accept" means take your recommendation. "skip" means mark undecided. If I'm unsure, offer a tentative pick I can revisit.
- Never push me toward a vendor for its own sake. Say when a managed service replaces learning value.
- In revisit, when a change affects topics that already have docs, tasks, or reviews, list them and warn me before I confirm. Never edit existing docs, tasks, or reviews; suggest `/learn <topic> mode=cheatsheet` to refresh cheatsheets, and re-running /learn for lessons.

## 3. Check the whole stack
After the last layer, review it as a whole:
- Conflicts or redundancy between tools
- Anything too heavy for my time and level
- Gaps against CHEATSHEET.md (e.g. no tool for background jobs, tracing, or file storage)
- A suggested learn order across the modules

Present the final table: Layer | Choice | Why (max 10 words) | Status. In revisit, also show a before → after list of what changes. Then ask: "Write this to STACK.md?"

## 4. Write STACK.md (only after I confirm)
Create or update STACK.md at the repo root with this format:

```md
# Stack
Decided stack for this repo. The learn and review prompts read this file.
Updated: YYYY-MM-DD

## Goal
- Target:
- Level:
- Time per week:
- Constraints:

## Choices
| Layer | Choice | Why | Status |
|:--|:--|:--|:--|
| Language | TypeScript (strict) | one language both sides | decided |
Status is one of: decided, tentative, undecided.

## Topic → TECH
Exact string the learn prompt uses as TECH for each topic.
| Topic | TECH |
|:--|:--|
| modules/01-foundations/01-git | Git, GitHub |
| modules/02-frontend/04-framework | React, TypeScript, Vite |
(one row for every topic folder; use "undecided" if the stack doesn't cover it yet)

## Learn order
1. (module or topic order, one line each, with a reason)

## Decision log
- YYYY-MM-DD · Database · Prisma → Drizzle · wanted SQL-first control
```

Rules for writing:
- Cover every topic folder under modules/ in the Topic → TECH table, using the actual folders on disk.
- Keep existing decision-log lines; append new ones. Never delete history.
- Log every layer that was decided or changed, with a short reason.
- When revisiting, change only the layers discussed, plus the Topic → TECH rows they affect.
- Update each affected topic's `tech:` frontmatter in modules/**/README.md only if it still says "—" or "undecided"; otherwise leave it.
- Update the "Updated:" date.

## 5. Finish
- Add a link to STACK.md in the README footer if it isn't there yet. Do not touch the AUTO blocks.
- Check that .claude/commands/learn.md, review.md, and stack.md exist. If one is missing, tell me; do not recreate it.
- Run `node scripts/sync.mjs`.
- If this is a git repo, commit: `docs: record stack decisions`.
- Reply in max 5 lines: layers decided, tentative, and undecided, topics affected by changes (revisit only), and the first topic I should learn: `/learn <path>`.