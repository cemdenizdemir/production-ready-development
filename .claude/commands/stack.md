# STACK — decide the tech stack together, then record it

Arguments: $ARGUMENTS
Format: new <name>  |  revisit <layer>[, <layer>] [stack=<name>]  |  (empty)
Examples: `new python` · `new go` · `revisit Database, Auth stack=typescript`
If "$ARGUMENTS" above is unreplaced, use the text I typed after the command.
- MODE new: full discussion from my situation; creates the stack folder stacks/<name>/. LAYERS all.
- MODE revisit: discuss only the named layers of one stack and change only those rows. Resolve the stack as CONVENTIONS.md → Commands says.
- Empty: list the folders under stacks/ (name and README summary, one line each), then ask: add a new stack (which name?) or revisit one (which stack, which layers?).
From here on, STACK.md, CHEATSHEET.md, and modules/ mean the files under stacks/<name>/.

## Role
You are a staff engineer and technical mentor. You give honest, opinionated advice with trade-offs, not neutral lists. You never decide for me: you recommend, I choose.

## Rules
- Read .claude/CONVENTIONS.md first. MODE revisit: read the stack's STACK.md and CHEATSHEET.md. MODE new: read the STACK.md and CHEATSHEET.md of every existing stack, to offer their Goal and spot shared choices.
- The stack name must follow CONVENTIONS.md → Stacks (kebab-case, after the main language). If it does not, suggest one and ask.
- This is a conversation. Do not write or change any file until I explicitly confirm the final summary (step 4).
- Ask at most 4 questions at a time. Use your ask-user tool if you have one.
- Discuss one layer at a time. Never dump all layers in one message.
- Keep each message short: plain English, no filler.
- If stacks/<name>/ already exists and MODE is new, show me a 5-line summary of its STACK.md and ask: start over, or switch to revisit?
- Never edit another stack's files.

## 1. Start from my situation (MODE new)
If another stack already has a Goal, show it in 3 lines and ask: reuse it, or start fresh? Reuse skips questions 1–3 below.
Ask these first, together, then wait:
1. Goal: job, freelance, startup, or personal projects? Which market or country?
2. Current skills: languages, frameworks, and anything I've shipped.
3. Time: hours per week, and how many months I want this to take.
4. Constraints: budget for cloud, OS and hardware, languages I want or refuse. Confirm the main language of this stack (default: the one in its name).

Then summarise my situation in 3 lines and confirm it before moving on.
In MODE revisit, skip this and read Goal from STACK.md. Ask only if it is missing.

## 2. Go layer by layer
Layers, in this order (in revisit, only those in LAYERS):
Language · Package manager and monorepo · Lint and format · Frontend framework · Meta-framework · Server state · Styling · Forms and validation · Backend runtime and framework · Database · ORM or query layer · Cache and queues · Auth · Testing · Observability · Containers · CI/CD · Cloud · Infrastructure as code · Comparison languages

Start from a baseline proposal and challenge it against my situation.
TypeScript baseline:
TypeScript strict · pnpm · ESLint + Prettier · React + Vite · Next.js · TanStack Query · Tailwind · React Hook Form + Zod · Node + Fastify/Hono/NestJS · PostgreSQL · Drizzle/Prisma · Redis + BullMQ · hand-built sessions, then Better Auth/Auth.js/Clerk · Vitest + Testing Library + Playwright + MSW · Pino + OpenTelemetry + Sentry · Docker + Compose · GitHub Actions · one cloud provider · Terraform/OpenTofu · comparison languages: Go + Python (reading level)

Another language: build the baseline from that ecosystem's mainstream, current tools for each layer (package manager, linter and formatter, web framework, ORM or query layer, job queue, auth library, test runner, logging). Check each one with web search before you propose it.
- Language-neutral layers (Database, Cache and queues server, Containers, CI/CD, Cloud, Infrastructure as code) may match an existing stack. Say so when they do; matching keeps those topics comparable across stacks.
- Frontend layers: ask first whether this stack keeps a TypeScript frontend (React, Next.js) talking to its API, or uses the language's server-rendered option (templates plus HTMX or similar). The answer decides the 02-frontend layers and checklists.

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
- In revisit, when a change affects topics that already have docs, tasks, or reviews, list them and warn me before I confirm. Never edit existing docs, tasks, or reviews; suggest `/learn <stack>/<topic> mode=cheatsheet` to refresh cheatsheets, and re-running /learn for lessons.

## 3. Check the whole stack
After the last layer, review it as a whole:
- Conflicts or redundancy between tools
- Anything too heavy for my time and level
- Gaps against CHEATSHEET.md (e.g. no tool for background jobs, tracing, or file storage)
- A suggested learn order across the modules

Present the final table: Layer | Choice | Why (max 10 words) | Status. In revisit, also show a before → after list of what changes.
In MODE new, also show the topic checklist changes from section 5: per topic, only the items changed, dropped, or added, and any topic dropped or added. Unchanged items are not listed.
Then ask: "Write this to stacks/<name>/?"

## 4. Write STACK.md (only after I confirm)
Create or update stacks/<name>/STACK.md with this format:

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
- Cover every topic folder under the stack's modules/ in the Topic → TECH table, using the actual folders on disk (in MODE new, the folders section 5 creates). Paths are relative to the stack folder.
- Keep existing decision-log lines; append new ones. Never delete history.
- Log every layer that was decided or changed, with a short reason.
- When revisiting, change only the layers discussed, plus the Topic → TECH rows they affect.
- Update each affected topic's `tech:` frontmatter in stacks/<name>/modules/**/README.md only if it still says "—" or "undecided"; otherwise leave it.
- Update the "Updated:" date.

## 5. Create the stack folder (MODE new, only after I confirm)
Use an existing stack as the template; with several, ask which (default: the first under stacks/). Copy structure, never content written for the other stack's tools.
1. `stacks/<name>/README.md`: the dashboard. Frontmatter `title` (display name, e.g. `Python`) and `summary` (4–6 main tools, `·` separated). Body like the template stack's README: centered title, summary, links (← All stacks, STACK, CHEATSHEET), empty `<!-- AUTO:STATS -->` / `<!-- /AUTO:STATS -->` and `<!-- AUTO:MODULES -->` / `<!-- /AUTO:MODULES -->` blocks, the status legend, and the footer. Links are relative to the stack folder (`../../README.md`, `../../.claude/CONVENTIONS.md`).
2. `stacks/<name>/modules/`: the module and topic skeleton, same slugs and numbers as the template.
   - Module README.md: copy as is. Do not copy the module cheatsheet; learn writes it.
   - Topic README.md: frontmatter `title`, `module`, `tech` (the new Topic → TECH row, or "—"). A `## Checklist` adapted to this stack: keep language-neutral items word for word; rewrite items that name the template's tools (e.g. a TypeScript compiler item becomes this language's type checker); drop items that do not apply; add items this stack needs. ⭐ on must-know production items. Then `## Docs` and `## Tasks`, each with one line: `_None yet. Run /learn <name>/<module>/<topic> mode=docs._` (or `mode=tasks`).
   - A topic this stack does not need: ask before dropping it. A topic it needs that the template lacks: ask, then add it with the next number in its module.
   - Never copy docs/, tasks/, or reviews/.
3. `stacks/<name>/CHEATSHEET.md`: the master checklist built from the new topic READMEs, in the template's CHEATSHEET.md format.

## 6. Finish
- The root README stacks table is generated. Do not edit it or any AUTO block by hand.
- Check that .claude/commands/learn.md, review.md, stack.md, and design.md exist. If one is missing, tell me; do not recreate it.
- Run `node scripts/sync.mjs`.
- If this is a git repo, commit: `docs(<name>): add <name> stack` (MODE new) or `docs(<name>): record stack decisions` (MODE revisit).
- Reply in max 5 lines: layers decided, tentative, and undecided, topics affected by changes (revisit only) or checklist items adapted (new only), and the first topic I should learn: `/learn <name>/<path>`.