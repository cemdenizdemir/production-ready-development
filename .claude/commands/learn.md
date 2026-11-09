# LEARN — research, teach, and set tasks

Arguments: $ARGUMENTS
Format: <target> [stack=<name>] [mode=full|docs|tasks|cheatsheet] [level=beginner|intermediate|advanced] [focus=1,3,5] [tech="override"] [lang=go|java|python|rust]
Target: one topic (`typescript/02-frontend/04-framework`), one module (`typescript/02-frontend`), or `all` (with `stack=`). The stack prefix can be left out when only one stack exists.
Examples:
- `/learn typescript/02-frontend/04-framework level=beginner` — checklist, lessons, cheatsheet, and tasks for one topic
- `/learn python/03-backend/06-caching mode=tasks` — tasks only, built on the lessons already in docs/
- `/learn all stack=go mode=docs` — lessons and cheatsheets for every topic of one stack, no tasks
- `/learn typescript/04-shipping mode=cheatsheet` — rebuild the reminder cheatsheets of one module
- `/learn typescript/06-design/03-design-patterns lang=go` — concept topic with Go comparison snippets (and Go tasks, if tasks are written)
- `/learn typescript/07-capstone/01-design-build mode=tasks` — capstone milestones as tasks
If "$ARGUMENTS" above is unreplaced or empty, use the text I typed after the command. If still empty, ask me for the topic.

## Role
You are a staff software engineer and technical educator. You teach production practice, not toy demos. Be precise, current, and brief.

## Modes
| Mode | Sections | Writes | Use it when |
|:--|:--|:--|:--|
| `full` (default) | 1–7 | checklist (if empty), lessons, cheatsheet, tasks | starting a topic from zero |
| `docs` | 1–5, 7 | checklist (if empty), lessons, cheatsheet | reading ahead; tasks come later |
| `tasks` | 1–2, 6–7 | tasks only | lessons exist and you are ready to build |
| `cheatsheet` | 1–3, 5, 7 | topic and module cheatsheets only | refreshing reminders after a stack or version change |

## Topic kinds
Decide the kind from the module before writing anything.
| Kind | Where | Lessons | Cheatsheet | Tasks |
|:--|:--|:--|:--|:--|
| Tool | 01–04 | examples in TECH | commands, APIs, config, limits | build features with TECH |
| Practice | 05-practice | habits, templates, examples from real work | practices and templates | exercises on real work (PRs, tickets, docs) |
| Concept | 06-design | idea → example in the stack's language → where it lives in our stack → trade-offs | principles, patterns, styles with "use when / avoid when / smell" columns | katas: refactor starter code, implement a pattern, write a design doc |
| Capstone | 07-capstone | project spec: domain, architecture, system design, milestones, checklists | quick reference: where each idea lives in the project, checklists | milestones (T01 = M1 …) with exit criteria |

`lang=` (concept topics, and tool topics whose TECH includes the language):
- Main examples stay in the stack's language; add one short comparison snippet per lesson in that language, labeled with its version.
- With tasks, write them for that language: its toolchain, test runner, and linter go into the TASK constraints.
- The language must be in STACK.md under Language or Comparison languages. If not, treat it as a STACK.md question (section 2).
- Without `lang=`, lessons and tasks use the stack's language only.

## 1. Resolve the target
1. Read .claude/CONVENTIONS.md and follow it exactly.
2. Resolve the stack as CONVENTIONS.md → Commands says. From here on, STACK.md, CHEATSHEET.md, and modules/ mean the files under stacks/<stack>/.
   Match the target to stacks/<stack>/modules/<module>/<topic>. Accept numbers, slugs, or both, with or without the "modules/" prefix (e.g. `02-frontend/04-framework`, `frontend/framework`, `04-framework`). A module (`02-frontend`, `frontend`) or `all` expands to every topic folder of that stack, in folder order.
3. Zero matches: ask whether to create it as a new topic (module, name, next number). Several matches: ask which one. Never guess.
4. New topic, or a topic whose README checklist is empty (modes full and docs): write an 8–15 item checklist in CHEATSHEET.md style into the topic README, ⭐ on must-know production items, and append the same section to CHEATSHEET.md.
5. Read the topic README and list existing docs/ and tasks/. Continue numbering. Never overwrite or duplicate existing lessons or tasks.
   - Another stack may already teach the same topic. You may read its lessons for structure and coverage, but research and write this stack's content fresh, in this stack's TECH. Never edit the other stack.
   - mode=tasks and docs/ has no lessons: stop and suggest `mode=full` or `mode=docs` first.
6. Several topics: ask every STACK.md question for all of them up front, in one batch, then run sections 2–6 once per topic in folder order, then section 7 once.

## 2. Scan STACK.md (before anything else is written)
7. If the stack has no STACK.md, ask once: run `/stack new <name>` first (recommended), or give TECH and level now for a one-off run. Do not create STACK.md or a stack folder yourself.
8. Find what this run needs:
   - TECH: the topic's row in "Topic → TECH", or the `tech=` argument (the argument wins for this run only).
   - LEVEL: the `level=` argument, else "Level" under Goal.
   - Related layers from "Choices" that this topic touches (e.g. databases need the ORM layer; API design needs the backend framework).
   - FOCUS: the `focus=` argument, else all checklist items.
9. Anything missing, "undecided", or "tentative" → ask me in ONE batch (max 3 questions, ask-user tool if you have one). For each: your recommendation first, tied to STACK.md's Goal, plus at most 2 alternatives. Wait for my answers. If I already answered in this run or the row is used as-is by existing docs, don't ask again.
10. Write my answers back, then continue:
   - Fill the topic's row in "Topic → TECH" and update affected "Choices" statuses.
   - Append one line to "Decision log": `YYYY-MM-DD · <layer> · <choice> · set by learn prompt`.
   - If the topic README `tech:` is "—", set it.
   - Never change a row that is "decided". If I ask to change one, tell me to run /stack revisit.
   - A `tech=` override is not written unless I say so.

## 3. Research
11. Use web search if available. Prefer official docs, specs, and standards (MDN, RFCs, OWASP, maintainers' guides).
12. Confirm the current stable version of each TECH item and that every API you use exists in it. Note deprecated patterns to avoid.
13. If you cannot browse, say so at the top of 00-overview.md and mark version-specific claims "verify".
14. Every lesson ends with a short Sources list of links. No long quotes.

## 4. Lessons → TOPIC/docs/ (modes full, docs)
15. 00-overview.md: why this matters in production (max 5 lines), mental model, prerequisites, lesson map table (lesson → checklist positions, plus the cheatsheet), suggested order, version notes, and the TECH and LEVEL used.
16. NN-slug.md: one lesson per 2–4 related checklist items, max ~250 lines each.
    - **Why it matters:** 2–3 lines naming a real production failure it prevents.
    - **Concepts:** short; add a Mermaid diagram when flow or structure helps.
    - **Example:** minimal and runnable in TECH, with the file name; comments only where non-obvious.
    - **Production patterns:** what professionals do, and why.
    - **Mistakes:** "Wrong" vs "Right" snippet pairs.
    - **Check yourself:** 3 questions, answers inside `<details>`.
    - **Sources.**
    - Match LEVEL: beginner = more why and step-by-step; advanced = edge cases, trade-offs, internals.
    - Use only tools listed in STACK.md for this topic. Mention an alternative only in one line, as "also seen: X".
    - Concept topics add two parts after Concepts: **In our stack** (links to the topics and files where the idea is used in this repo's stack) and **When not to** (over-engineering signs, cheaper alternatives). Examples are small programs in the stack's language, not framework demos.
    - Capstone topics replace lessons with project documents (domain, architecture, system design, milestones, checklists). Each document still has Why it matters, a Mermaid diagram where useful, Mistakes, Check yourself, and Sources, and links every decision to the topic that teaches it.

## 5. Cheatsheet → TOPIC/docs/cheatsheet.md (modes full, docs, cheatsheet)
17. A reminder sheet, not a tutorial. It answers "what exists, and what is it called?" so I recognize the right tool, then look up the details.
    - Tables only: no paragraphs, no step-by-step, no code blocks. Code goes in `inline code` inside cells; escape pipes as `\|`.
    - 10–16 sections by theme: commands and flags, APIs and functions, config keys, headers and options, patterns, tools, numbers and limits, and so on.
    - Columns `Item | What it does | Example / note`. Rename them to fit a section; at most 4 columns.
    - One row per thing, one short line per cell (about 120 characters per row).
    - Aim for 100+ rows. Breadth beats depth: include related things worth knowing exist, even when no lesson covers them.
    - ⭐ marks must-know rows. Tag recent features with the version that added them (`Node 22+`, `PG 18`). Mark deprecated items `avoid` and name the replacement.
    - Cover every checklist item at least once. Prefer the TECH and stack choices; other tools get "also seen" rows.
    - The last two sections are `Gotchas` and `Sources` (doc → link).
    - Frontmatter like a lesson; `covers` lists every checklist position.
    - If the file exists, update it in place: keep correct rows, add missing ones, fix outdated ones.
18. Module cheatsheet → modules/<module>/cheatsheet.md: one table per topic with its 10–15 most-used rows; each heading links to the full topic cheatsheet. Rebuild it whenever a topic cheatsheet in that module changes.

## 6. Tasks → TOPIC/tasks/ (modes full, tasks)
19. Create 3–5 progressive tasks: small and focused → realistic → one mini-project tying the topic together (level: stretch if heavy). Together they cover every FOCUS item at least once.
20. Each Txx-slug/ holds TASK.md only. Add starter files only when setup is tedious and isn't the learning goal, or when the task is to refactor existing code (concept katas). Never include solution code.
    - Concept topics mix task types: refactoring katas (starter code with smells), pattern or algorithm implementations with tests, and design-doc tasks whose deliverable is `DESIGN.md` (sections from the topic's lessons). System design and DDD exercises can also start with /design.
    - Capstone tasks are milestones: T01 = M1 … Tn = Mn, in order. Each lists exit criteria from the capstone docs and the topics it applies; the final milestone of 02-pre-launch is the full pre-launch checklist.
21. TASK.md:
    - frontmatter: id, title, level, status: todo, covers; add `kind: design` or `kind: milestone` when the task isn't plain code, and `lang: go` (etc.) for tasks not in the stack's language
    - ## Scenario: 2–3 lines of realistic product context
    - ## Requirements: checkbox list
    - ## Acceptance criteria: testable statements
    - ## Constraints: stack from STACK.md, and what not to use
    - ## Covers: the checklist items in plain text
    - ## Hints: 2–4 nudges inside `<details>`, no solutions
    - ## Stretch: 1–2 optional extras
    - ## When done: write code in this folder, set `status: done`, run `/review <stack>/<module>/<topic> Txx`.
    - Link the lessons each task relies on, under the title.

## 7. Finish
22. In the topic README, fill the Docs and Tasks sections with links, e.g. `- [T01 · Title](tasks/T01-slug/TASK.md)`. With no tasks yet, the Tasks section reads `_None yet. Run /learn <stack>/<module>/<topic> mode=tasks when you are ready to build._`
23. Make sure the module README links its cheatsheet.
24. Run `node scripts/sync.mjs` (it updates every stack's dashboard and the root README).
25. Reply in max 6 lines: what was asked and recorded in STACK.md (if any), files created, first lesson to read, first task (or the `mode=tasks` command). For several topics, one line per module with counts.
