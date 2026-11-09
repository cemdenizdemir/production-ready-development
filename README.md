<div align="center">

# Production-Ready Dev

Fundamentals to production, one topic at a time, in any stack.<br>
<sub><b>Learn</b> → <b>Build</b> → <b>Review</b></sub>

</div>

<br>

## Stacks

Each stack is a full track in its own folder under `stacks/`: its own stack decisions, lessons, tasks, reviews, and progress. The commands are shared.

<!-- AUTO:STACKS -->
| Stack | Tools | Mastery | Topics | Tasks | Score | Files |
|:--|:--|:--|:-:|:-:|:-:|:--|
| [TypeScript](stacks/typescript/README.md) | Node.js 26 · Express 5 · React 19.2 · Next.js 16 · PostgreSQL 18 | <code>▱▱▱▱▱▱▱▱▱▱</code> 0% | 0/49 | 0/4 | — | [STACK](stacks/typescript/STACK.md) · [CHEATSHEET](stacks/typescript/CHEATSHEET.md) |
<!-- /AUTO:STACKS -->

New stack: `/stack new <name>`, for example `/stack new python` or `/stack new go`.

## Quick start

**You need:** Git · Node 18+ (for the sync script) · an AI coding agent that can read and write files (Claude Code, Cursor, Copilot agent mode)

**First time only**

```bash
git clone <your-repo-url> && cd <repo-name>
```

1. Open the folder in your AI agent.
2. Pick a stack from the table above, or run `/stack new <name>` to add one. This creates `stacks/<name>/` with its `STACK.md` and topic checklists.
3. Open the stack's dashboard and follow its learn order.

## Commands

| Command | What it does |
|:--|:--|
| `/stack new <name>` | Decide a new stack and create `stacks/<name>/` |
| `/stack revisit <layers> stack=<name>` | Change layers of an existing stack: `/stack revisit Database, Auth stack=typescript` |
| `/learn <stack>/<module>/<topic>` | Writes lessons and a cheatsheet into `docs/`, and tasks into `tasks/` |
| `/learn <topic> mode=tasks` | Writes tasks only, from the lessons already in `docs/` |
| `/learn <target> mode=docs` | Lessons and cheatsheet only. Target: a topic, a module, or `all` |
| `/learn <target> mode=cheatsheet` | Rebuilds the reminder cheatsheets only |
| `/review <stack>/<module>/<topic> [Txx]` | Reviews a finished task on a copy, and writes `REVIEW.md` |
| `/design "<problem>" stack=<name>` | Interactive system design, DDD, or architecture session; records `DESIGN.md` as a task |
| `/learn <topic> lang=go` | Adds comparison snippets (and tasks) in another language for concept topics |

**Picking the stack:** start a topic path with the stack (`typescript/02-frontend/04-framework`) or add `stack=<name>`. With only one stack, it is used by default. With several and none given, the command asks.<br>
**Paths** accept numbers or names: `typescript/02-frontend/04-framework`, `typescript/frontend/framework`, or `04-framework`.<br>
**Options:** `/learn … level=beginner focus=1,3` · `/review … pending` reviews every finished, unreviewed task.

**Cheatsheets** are tables of what exists, one row per thing, not tutorials: `docs/cheatsheet.md` per topic, `modules/<module>/cheatsheet.md` per module, `CHEATSHEET.md` per stack. Open them from the **Cheatsheet** column on a stack's dashboard.

## The loop

1. Read the topic's `docs/`, then `/learn typescript/02-frontend/04-framework mode=tasks` to get tasks.
2. Write your code in `tasks/T01-*/` and set `status: done` in its `TASK.md`.
3. `/review typescript/02-frontend/04-framework T01`, then compare your code with `reviews/T01-*/`.
4. If the verdict is *revise*, fix your code and review again.

## Layout

```text
README.md                 this file; the stacks table is generated
.claude/commands/         learn, review, stack, design (shared by every stack)
.claude/CONVENTIONS.md    rules every prompt follows
scripts/sync.mjs          rebuilds progress and dashboards for every stack
stacks/<stack>/
  README.md               the stack's dashboard
  STACK.md                the stack's tool decisions
  CHEATSHEET.md           master checklist for the stack
  progress.json           generated
  modules/NN-module/NN-topic/{README.md, docs/, tasks/, reviews/}
```

<details>
<summary><b>Troubleshooting</b></summary>
<br>

| Problem | Fix |
|:--|:--|
| Slash commands don't appear | Tell the agent: `Read .claude/commands/learn.md and follow it. Arguments: typescript/02-frontend/04-framework` |
| Stats look wrong | `node scripts/sync.mjs` |
| No Node installed | Ask the agent to update the AUTO blocks by hand (see [CONVENTIONS](.claude/CONVENTIONS.md)) |
| A command asks which stack | Several stacks have that topic. Prefix the path (`typescript/…`) or add `stack=<name>`. |
| A topic shows ○ but has lessons | Expected: a topic starts (◔) once it has tasks. Run `/learn <topic> mode=tasks`. |
| Prompt asks about the stack again | The topic's row in that stack's `STACK.md` is `undecided`. Answer once and it is saved. |
| Want to change a decided tool | `/stack revisit <layer> stack=<name>` |

</details>

<br>

<sub>Stats update automatically via <code>node scripts/sync.mjs</code> · <a href=".claude/CONVENTIONS.md">CONVENTIONS</a></sub>
