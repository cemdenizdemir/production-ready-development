<div align="center">

# Production-Ready Dev

Fundamentals to production, one topic at a time.<br>
<sub><b>Learn</b> → <b>Build</b> → <b>Review</b></sub>

<!-- AUTO:STATS -->
<code>▱▱▱▱▱▱▱▱▱▱</code>&nbsp; <b>0%</b> mastery

<b>0</b>/41 topics &nbsp;·&nbsp; <b>0</b>/0 tasks &nbsp;·&nbsp; <b>0</b> reviewed &nbsp;·&nbsp; <b>—</b> avg score &nbsp;·&nbsp; synced —
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
| ○ | [Git & Collaboration](modules/01-foundations/01-git) | — | — | — |

</details>
<!-- /AUTO:MODULES -->

<br>

<sub>Stats update automatically via <code>node scripts/sync.mjs</code> · <a href="STACK.md">STACK</a> · <a href="CHEATSHEET.md">CHEATSHEET</a> · <a href=".ai/CONVENTIONS.md">CONVENTIONS</a></sub>