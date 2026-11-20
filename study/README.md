# Study

Spaced repetition in any AI chat app (Claude, ChatGPT, Gemini). The repo writes the cards, a chat project quizzes you, and a log file you keep here carries the schedule between chats.

| File | What it is |
|:--|:--|
| [PROJECT-PROMPT.md](PROJECT-PROMPT.md) | The tutor's instructions. Copy all of it into the project. |
| [progress.md](progress.md) | Your log. Paste it in to start a review, then paste the results back. |
| `stacks/<stack>/modules/<module>/<topic>/cards.md` | One deck per topic, written by `/cards`. |

## Set up once
1. Create a project: Claude → Projects, ChatGPT → Projects, or Gemini → Gems.
2. Paste all of `PROJECT-PROMPT.md` into the project's instructions.
3. Upload the `cards.md` decks you want to review to the project's files (Gemini: Knowledge).

## Each session (about 10 minutes)
1. Start a **new chat** in the project.
2. Send `review`, then paste all of `progress.md`.
3. Answer in a few words. Type `show` to reveal a card, or `stop` to end early.
4. At the end, copy the log block to the bottom of `progress.md`.

## Commands
| Command | What it does |
|:--|:--|
| `review [decks] [n=15] [new=5]` | Due cards first, then a few new ones |
| `quiz [decks] [n=5]` | Interview-style questions, graded; ends with new cards for what you missed |
| `cards` + a pasted lesson | Writes a deck in the chat, if you are away from the repo |
| `stats` | Cards per box, what is due this week |
| `compact` | Shortens the log; replace the lines below `---` in `progress.md` with it |

Name decks by topic: `review git`, `quiz caching`.

## Adding cards
1. After reading a lesson, run `/cards <stack>/<module>/<topic>` in Claude Code. It appends only the lessons that are new.
2. Upload the updated `cards.md` to the project again, replacing the old one.
3. Cards from a `quiz`: paste them into the matching section of the topic's `cards.md`, then upload it again.

## Tips
- Make cards only for lessons you have read. 238 lessons × 12 cards is too much for a few minutes every few days.
- One chat per session. Long chats drift from the rules.
- If the tutor can't find a card, paste that deck into your message. ChatGPT and large projects search files instead of reading all of them.
- Do a `quiz` once a week on topics you learned at least a week ago.
