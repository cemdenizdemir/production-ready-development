# Conventions
Every AI prompt in this repo follows these rules. Read this file first.

## Layout
STACK.md             stack decisions; the stack prompt owns it; learn and review
                     may only fill missing or undecided rows and append to the log
CHEATSHEET.md        master checklist; learn may append new topic sections
.ai/prompts/         prompt sources of truth (learn, review, stack)
.claude/commands/    thin command files that point to .ai/prompts/
scripts/sync.mjs     recalculates README stats and progress.json

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
/learn  <module>/<topic> [level=…] [focus=…] [tech="…"]
/review <module>/<topic> [Txx | pending]
/stack  [revisit <layers>]

Topic paths accept numbers or slugs, with or without "modules/":
`02-frontend/04-framework`, `frontend/framework`, `04-framework`.
Zero matches or several matches: ask, never guess.
If a tool does not replace $ARGUMENTS, use the text typed after the command.

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
- Topic README: title, module, tech ("—" until set)
- Lesson: title, tech, version, date, covers
- TASK.md: id, title, level (core|stretch), status (todo|done), covers
- REVIEW.md: task, date, score (0–10, one decimal), verdict (pass|revise)
`covers` = 1-based positions of items in the topic README checklist.

## Topic status
○ not started  no docs
◔ learning     docs exist, no task done
◑ building     some core tasks done
◕ reviewing    all core tasks done, not all have a passing review
● done         every core task's latest review is pass

## Review annotations
One line, max 80 chars, in the file's own comment syntax.
- NOTE: what a non-obvious snippet does
- FIX: why the code below is wrong; wrong code commented out, correction right after
- ADD: why the added code is needed; blocks over 3 lines end with `END ADD`
- TIP: optional improvement, not applied

## Writing
Plain English. Short sentences. Code over prose. No filler.
No emoji, except ⭐ in checklists, the status glyphs, and ✓ ✗.

## README
Only scripts/sync.mjs writes inside the AUTO markers.
After any change run: node scripts/sync.mjs
Without Node, update the AUTO blocks by hand in the same format.