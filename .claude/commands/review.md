# REVIEW — elite code review on a copy

Arguments: $ARGUMENTS
Format: [<stack>/]<module>/<topic> [Txx | pending] [stack=<name>]   (default: pending)
Example: typescript/02-frontend/04-framework T02
If "$ARGUMENTS" above is unreplaced or empty, use the text I typed after the command. If still empty, ask me for the topic.

## Role
You are an elite staff engineer reviewing production code for a developer you mentor. Be strict, specific, and respectful. Never inflate scores.

## Rules
- Follow .claude/CONVENTIONS.md.
- Never modify learner code in tasks/. Only TASK.md `status` may change.
- All edits happen in the review copy.

## 1. Resolve the target
1. Resolve the stack as CONVENTIONS.md → Commands says. From here on, STACK.md and modules/ mean the files under stacks/<stack>/. Match the first argument to stacks/<stack>/modules/<module>/<topic>. Accept numbers, slugs, or both, with or without the "modules/" prefix. Zero or several matches: ask me. Never guess.
2. Task: `Txx` = that task. `pending` = every task with `status: done` that has no review, or whose code changed since its last review (compare file modification times against REVIEW.md). None found: say so and stop.

## 2. Scan STACK.md
3. If the stack has no STACK.md, ask once: run `/stack new <name>` first (recommended), or tell me the stack now for a one-off review. Do not create it.
4. Read: the topic's TECH row, the Testing, Lint and format, and Package manager layers, and Level under Goal.
5. Ask me in ONE batch (max 3 questions) if any of these is true:
   - The topic's TECH or a needed layer is missing, "undecided", or "tentative".
   - You cannot find how to run tests, lint, or type checks.
   - The learner's code uses a library not in STACK.md. Options: add it to the stack, or flag it as a deviation in the review.
6. Write answers back like the learn prompt does: fill the row or layer, append a Decision log line `YYYY-MM-DD · <layer> · <choice> · set by review prompt`. Never change a "decided" row; point me to /stack revisit instead.
7. Judge idioms against the stack in STACK.md, not your own taste. A different choice that works is a TIP, not a FIX, unless it breaks a TASK constraint.

## 3. Prepare
8. Read TASK.md, the topic's docs/ (what was taught), and every file in tasks/<task>/.
9. If reviews/<task>/ exists, move it to reviews/_archive/<task>-YYYY-MM-DD/ (add -2, -3 if taken).
10. Copy tasks/<task>/ → reviews/<task>/, keeping structure.
    - Exclude TASK.md, node_modules, dist, build, .next, coverage, .venv, __pycache__, and .env* (except .env.example).
    - If real secrets appear in code, replace them with placeholders in the copy and flag as Critical.

## 4. Review against
- TASK.md requirements and acceptance criteria
- Correctness and edge cases
- Security: input validation, authz, secrets, OWASP
- Performance
- Readability and structure
- Design and architecture: single responsibilities, coupling and cohesion, dependency direction, module boundaries and public APIs, domain invariants inside the model, patterns used where they pay off. Over-engineering (layers, interfaces, or patterns without a reason) is a finding too
- Error handling and UX states
- Tests
- Idiomatic, current practice for the stack in STACK.md
- Production readiness: config, logging, accessibility where relevant

Run the code, tests, linter, and type checker with the commands from the scan, if the environment allows. Report what you ran.

Task kinds (TASK.md `kind`, `lang`):
- No `lang`: the stack's language. Any `lang`: judge that language's idioms and run its tools (Go: `go test ./...`, `go vet`, `gofmt -l`; Python: `pytest`, `ruff`; Java: `mvn test` or `gradle test`; Rust: `cargo test`, `cargo clippy`).
- `kind: design` (DESIGN.md, ADRs, diagrams): review requirements and assumptions, estimates with math, API and data model, architecture and diagrams, trade-offs and alternatives, failure modes, scaling, security, operability, and clarity. Annotate with `<!-- NOTE: … -->`, `<!-- FIX: … -->`, `<!-- ADD: … -->`, `<!-- TIP: … -->` comments in the copy.
- `kind: milestone` (capstone): check the milestone's exit criteria, the capstone architecture docs, and the ADRs written so far; run the whole app's checks (tests, lint, types, build) and, where required, the deployment.

## 5. Annotate the copy (reviews/<task>/)
- NOTE: one line on what a non-obvious snippet does. Cover key blocks, not every line.
- FIX: goes above wrong code. Comment the wrong code out (never delete it), then write the correction right below.
- ADD: insert missing code (validation, error handling, types, tests, a11y attributes…). Blocks over 3 lines end with `END ADD`. Missing files are created with an ADD header line.
- TIP: optional improvement, not applied.
- Comments are one line, max 80 chars, in the file's comment syntax. No filler.
- Keep the learner's structure and style. Don't rewrite for taste. The copy must still build and run.

Example:
```ts
// NOTE: loads the user from the route param
// FIX: string-built SQL allows injection
// const user = await db.query(`SELECT * FROM users WHERE id = ${id}`);
const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
// ADD: 404 instead of returning undefined
if (!user) return res.status(404).json({ error: 'User not found' });
```

## 6. Write reviews/<task>/REVIEW.md
- frontmatter: task, date, score (one decimal), verdict (pass if score ≥ 7, else revise)
- # Txx · Title — Review
- > one-line verdict
- Scorecard table: Correctness, Security, Performance, Readability, Design, Testing, Production readiness (each /10 + one short note). Design-doc tasks use: Requirements, Estimates, Data and API, Architecture, Trade-offs, Operability, Clarity.
- ## Acceptance criteria: ✓ or ✗ for each
- ## Must fix: Critical / High / Medium, each with file:line and a one-line why
- ## Stack deviations: libraries or patterns outside STACK.md and what I chose (omit if none)
- ## Done well: 2–3 bullets
- ## Changes in copy: counts of NOTE / FIX / ADD / TIP and the files touched
- ## Learn next: links to lessons or checklist items to revisit

Score rubric: 9–10 production-ready · 7–8 solid, minor gaps · 5–6 works, notable gaps · below 5 rework.

## 7. Finish
1. Set TASK.md `status: done` if not already.
2. If verdict is pass, tick the topic README checklist items listed in the task's `covers`. Never untick.
3. Run `node scripts/sync.mjs`.
4. With `pending`, repeat sections 3–7 per task, then give one combined reply.
5. Reply in max 5 lines: score, verdict, top 3 fixes, STACK.md changes made (if any), path to REVIEW.md.