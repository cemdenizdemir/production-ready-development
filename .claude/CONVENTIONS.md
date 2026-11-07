# Conventions
Every AI prompt in this repo follows these rules. Read this file first.

## Layout
STACK.md                stack decisions; the stack prompt owns it; learn and review
                        may only fill missing or undecided rows and append to the log
CHEATSHEET.md           master checklist; learn may append new topic sections
.claude/commands/       the prompts and sources of truth: learn, review, stack, design
.claude/CONVENTIONS.md  this file
scripts/sync.mjs        recalculates README stats and progress.json

modules/NN-module/
  README.md           title + one line, links the module cheatsheet
  cheatsheet.md       one table per topic: the most-used rows of each topic cheatsheet
modules/NN-module/NN-topic/
  README.md           checklist + tech
  docs/               00-overview.md, NN-slug.md, cheatsheet.md
  tasks/Txx-slug/     TASK.md + learner's code
  reviews/Txx-slug/   REVIEW.md + annotated copy of the code
  reviews/_archive/   older reviews

- Names: kebab-case, two-digit numbers (01-, T01-).
- Checklist items: never reorder or delete; append only.
- tasks/: never edit learner code; only TASK.md `status` may change.
- Never copy or commit real secrets; .env.example only.

## Commands
/learn  <topic | module | all> [mode=full|docs|tasks|cheatsheet] [level=…] [focus=…] [tech="…"] [lang=…]
/review <module>/<topic> [Txx | pending]
/stack  [revisit <layers>]
/design <problem> [area=system|ddd|architecture] [mode=interview|doc] [time=…]

Topic paths accept numbers or slugs, with or without "modules/":
`02-frontend/04-framework`, `frontend/framework`, `04-framework`.
Zero matches or several matches: ask, never guess.
If a tool does not replace $ARGUMENTS, use the text typed after the command.

Learn modes:
- full (default): checklist if empty, lessons, cheatsheet, tasks
- docs: checklist if empty, lessons, cheatsheet (no tasks)
- tasks: tasks only, built on existing lessons
- cheatsheet: topic and module cheatsheets only
- lang=go|java|python|rust: comparison snippets (and tasks) in a language from
  STACK.md Language or Comparison languages

Topic kinds (learn decides by module):
- Tool (01–04): examples and tasks in the topic's TECH
- Practice (05): habits, templates, exercises on real work
- Concept (06-design): ideas with TypeScript examples, "In our stack" links,
  "When not to"; katas and design-doc tasks
- Capstone (07): project documents instead of lessons; tasks are milestones

## STACK.md rules
- Statuses: decided | tentative | undecided.
- Only the stack prompt may change a "decided" row. Learn and review point to
  `/stack revisit` instead.
- Learn and review may fill a missing, undecided, or tentative row, only after
  asking me, and must log it.
- Decision log line: `YYYY-MM-DD · <layer> · <choice> · <reason or "set by <prompt>">`
- Never delete log lines. Append only.
- A one-off `tech=` argument is not written to STACK.md unless I say so.
- Review judges code against STACK.md. A working alternative is a TIP, not a FIX,
  unless it breaks a TASK constraint.

## Frontmatter
Simple YAML: `key: value`, arrays inline `[1, 3]`. Dates YYYY-MM-DD.
- Module README: title
- Module cheatsheet: title, date
- Topic README: title, module, tech ("—" until set)
- Lesson and topic cheatsheet: title, tech, version, date, covers
- TASK.md: id, title, level (core|stretch), status (todo|done), covers; optional
  kind (code|design|milestone, default code) and lang (default typescript)
- REVIEW.md: task, date, score (0–10, one decimal), verdict (pass|revise)
`covers` = 1-based positions of items in the topic README checklist.

## Topic status
○ not started  no tasks yet (lessons may already exist)
◔ learning     tasks exist, none done
◑ building     some core tasks done
◕ reviewing    all core tasks done, not all have a passing review
● done         every core task's latest review is pass

## Cheatsheets
Reminders, not tutorials. Lessons teach; cheatsheets help me remember what
exists and what it is called.
- Tables only. One row per thing, one short line per cell.
- ⭐ = must know. Recent features carry their version; deprecated ones say "avoid".
- Last sections: Gotchas, then Sources.

## Review annotations
One line, max 80 chars, in the file's own comment syntax.
- NOTE: what a non-obvious snippet does
- FIX: why the code below is wrong; wrong code commented out, correction right after
- ADD: why the added code is needed; blocks over 3 lines end with `END ADD`
- TIP: optional improvement, not applied

## Writing
Plain English. Short sentences. Code over prose. No filler.
No emoji, except ⭐ in checklists and cheatsheets, the status glyphs, and ✓ ✗.

## README
Only scripts/sync.mjs writes inside the AUTO markers.
After any change run: node scripts/sync.mjs
Without Node, update the AUTO blocks by hand in the same format.
