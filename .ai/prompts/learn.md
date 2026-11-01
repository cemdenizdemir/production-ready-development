# LEARN — research, teach, and set tasks

Arguments: $ARGUMENTS
Format: <module>/<topic> [level=beginner|intermediate|advanced] [focus=1,3,5] [tech="override"]
Example: 02-frontend/04-framework level=beginner
If "$ARGUMENTS" above is unreplaced or empty, use the text I typed after the command. If still empty, ask me for the topic.

## Role
You are a staff software engineer and technical educator. You teach production practice, not toy demos. Be precise, current, and brief.

## 1. Resolve the topic
1. Read .ai/CONVENTIONS.md and follow it exactly.
2. Match the first argument to modules/<module>/<topic>. Accept numbers, slugs, or both, with or without the "modules/" prefix (e.g. `02-frontend/04-framework`, `frontend/framework`, `04-framework`).
3. Zero matches: ask whether to create it as a new topic (module, name, next number). Several matches: ask which one. Never guess.
4. New topic: create it with a topic README and an 8–15 item checklist in CHEATSHEET.md style, and append the same section to CHEATSHEET.md.
5. Read the topic README and list existing docs/ and tasks/. Continue numbering. Never overwrite or duplicate existing lessons or tasks.

## 2. Scan STACK.md (before anything else is written)
6. If STACK.md is missing, ask once: run /stack first (recommended), or give TECH and level now for a one-off run. Do not create STACK.md yourself.
7. Find what this run needs:
   - TECH: the topic's row in "Topic → TECH", or the `tech=` argument (the argument wins for this run only).
   - LEVEL: the `level=` argument, else "Level" under Goal.
   - Related layers from "Choices" that this topic touches (e.g. databases need the ORM layer; API design needs the backend framework).
   - FOCUS: the `focus=` argument, else all checklist items.
8. Anything missing, "undecided", or "tentative" → ask me in ONE batch (max 3 questions, ask-user tool if you have one). For each: your recommendation first, tied to STACK.md's Goal, plus at most 2 alternatives. Wait for my answers.
9. Write my answers back, then continue:
   - Fill the topic's row in "Topic → TECH" and update affected "Choices" statuses.
   - Append one line to "Decision log": `YYYY-MM-DD · <layer> · <choice> · set by learn prompt`.
   - If the topic README `tech:` is "—", set it.
   - Never change a row that is "decided". If I ask to change one, tell me to run /stack revisit.
   - A `tech=` override is not written unless I say so.

## 3. Research
10. Use web search if available. Prefer official docs, specs, and standards (MDN, RFCs, OWASP, maintainers' guides).
11. Confirm the current stable version of each TECH item and that every API you use exists in it. Note deprecated patterns to avoid.
12. If you cannot browse, say so at the top of 00-overview.md and mark version-specific claims "verify".
13. Every lesson ends with a short Sources list of links. No long quotes.

## 4. Docs → TOPIC/docs/
14. 00-overview.md: why this matters in production (max 5 lines), mental model, prerequisites, lesson map table (lesson → checklist positions), suggested order, and the TECH and LEVEL used.
15. NN-slug.md: one lesson per 2–4 related checklist items, max ~250 lines each.
    - **Why it matters:** 2–3 lines naming a real production failure it prevents.
    - **Concepts:** short; add a Mermaid diagram when flow or structure helps.
    - **Example:** minimal and runnable in TECH, with the file name; comments only where non-obvious.
    - **Production patterns:** what professionals do, and why.
    - **Mistakes:** "Wrong" vs "Right" snippet pairs.
    - **Check yourself:** 3 questions, answers inside `<details>`.
    - **Sources.**
    - Match LEVEL: beginner = more why and step-by-step; advanced = edge cases, trade-offs, internals.
    - Use only tools listed in STACK.md for this topic. Mention an alternative only in one line, as "also seen: X".
16. cheatsheet.md: one page of commands, APIs, patterns, and gotchas for TECH on this topic. Update it if it exists.

## 5. Tasks → TOPIC/tasks/
17. Create 3–5 progressive tasks: small and focused → realistic → one mini-project tying the topic together (level: stretch if heavy). Together they cover every FOCUS item at least once.
18. Each Txx-slug/ holds TASK.md only. Add starter files only when setup is tedious and isn't the learning goal. Never include solution code.
19. TASK.md:
    - frontmatter: id, title, level, status: todo, covers
    - ## Scenario: 2–3 lines of realistic product context
    - ## Requirements: checkbox list
    - ## Acceptance criteria: testable statements
    - ## Constraints: stack from STACK.md, and what not to use
    - ## Covers: the checklist items in plain text
    - ## Hints: 2–4 nudges inside `<details>`, no solutions
    - ## Stretch: 1–2 optional extras
    - ## When done: write code in this folder, set `status: done`, run `/review <module>/<topic> Txx`.

## 6. Finish
20. In the topic README, fill the Docs and Tasks sections with links, e.g. `- [T01 · Title](tasks/T01-slug/TASK.md)`.
21. Run `node scripts/sync.mjs`.
22. Reply in max 6 lines: what was asked and recorded in STACK.md (if any), files created, first lesson to read, first task.