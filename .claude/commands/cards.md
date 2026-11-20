# CARDS — write review cards for a topic

Arguments: $ARGUMENTS
Format: <topic> [stack=<name>] [lessons=01,03] [sheet=star|all|none]
Examples:
- `/cards typescript/01-foundations/01-git` — cards for every lesson not yet in the deck, plus ⭐ cheatsheet rows
- `/cards csharp/03-backend/06-caching lessons=02` — one lesson only
- `/cards csharp/03-backend/06-caching sheet=none` — lessons only, no cheatsheet cards
If "$ARGUMENTS" above is unreplaced or empty, use the text I typed after the command. If still empty, ask me for the topic.

## Role
You write spaced-repetition cards. I review them in an AI chat project whose instructions are `study/PROJECT-PROMPT.md`. That file is the source of truth for the **Deck format** and the **Card rules**. Follow both exactly.

## 1. Resolve
1. Read .claude/CONVENTIONS.md and resolve the stack and topic as it says.
2. Read `study/PROJECT-PROMPT.md`: Deck format and Card rules.
3. Read the topic README (checklist, ⭐ items) and the lessons in `docs/`. No lessons: stop and suggest `/learn <stack>/<module>/<topic> mode=docs`.
4. Read `TOPIC/cards.md` if it exists. Lessons that already have a `## NN ·` section are skipped unless `lessons=` names them. Never change, reorder or renumber existing cards. Append only, continuing each section's numbering.

## 2. Write cards
5. Per lesson, use its sections like this:
   - Why it matters → scenario cards: "this happened; what is it, or what prevents it?"
   - Concepts tables → one card per row that matters, ⭐ rows first. Never one card for a whole table.
   - Example → only the non-obvious lines: what a line does, or why it comes in that order.
   - Production patterns → what teams do, and why.
   - Mistakes → show the wrong code, ask what breaks and what the fix is.
   - When not to (concept topics) → the over-engineering sign, or the cheaper option.
   - Check yourself → always, split into one-idea cards.
   - Skip Sources, file paths, install steps, anything I would look up instead of remember.
6. Cheatsheet (`sheet=star`, the default): one card per ⭐ row not already covered by a lesson card, in a `## cs · Cheatsheet` section. `sheet=all` adds the most useful other rows (20–30 cards in total). `sheet=none` skips it.
7. Capstone topics: cards for decisions and checklists only, not for project specifics.
8. Anything in a lesson that looks wrong or outdated: make no card for it, and list it in the reply.

## 3. File → TOPIC/cards.md
9. Frontmatter: title (the topic title), stack, topic (`<module>/<topic>`), date, lessons (inline array, e.g. `[01, 02, cs]`), count.
10. Then the Deck format: `# Cards · <stack> · <module>/<topic>`, one `## NN · <lesson title>` section per lesson in lesson order, the cheatsheet section last, cards as `### <id>` blocks with a blank line between cards.
11. In the topic README's Docs section, add `- [Cards](cards.md)` after the Cheatsheet link if it is missing.

## 4. Reply
Max 5 lines: cards per lesson and ⭐ count, the file path, anything flagged in step 8, and a reminder to paste or re-upload `cards.md` in the study project.
