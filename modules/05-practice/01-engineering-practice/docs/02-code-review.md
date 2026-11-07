---
title: "Code review: reviewing and being reviewed"
tech: Git, GitHub
version: GitHub pull requests (templates, suggestions, review states), gh CLI, Conventional Comments
date: 2026-11-07
covers: [2, 3]
---
# Code review: reviewing and being reviewed
[← Overview](00-overview.md)

## Why it matters
- PRs wait three days for review. Authors start new work, context-switch back for fixes, and everything takes twice as long.
- Reviews are 40 comments about formatting and naming. The missing authorization check on a new endpoint goes unnoticed.
- A blunt "this is wrong" on a junior engineer's PR leads to defensive arguments, and they stop asking for feedback.

## Concepts

### What reviews are for
| Goal | Example |
|:--|:--|
| Correctness | logic, edge cases, error handling, concurrency |
| Security | authorization, input validation, secrets, injection |
| Design | fits the architecture, right module, maintainable |
| Operability | logging, metrics, migrations, flags, rollbacks |
| Tests | the important behavior is tested |
| Knowledge sharing | more than one person understands the code |
| Not for | formatting and style a linter or formatter can enforce |

### As a reviewer
| Practice | Detail |
|:--|:--|
| Respond within one working day | the first response matters most, even if it's "I'll review this afternoon" |
| Read the description first | understand the intent before the diff |
| Big picture before details | design and correctness before naming |
| Run it when it matters | check out the branch (`gh pr checkout 123`) for UI or tricky behavior |
| Label comments | blocking or not (Conventional Comments) |
| Explain why | link docs, give an example, suggest a fix (GitHub suggestions) |
| Praise good work | specific and genuine |
| Approve with nits | don't block on matters of taste |
| Large PR | ask to split it rather than skim it |

### As an author
| Practice | Detail |
|:--|:--|
| Self-review first | read your own diff on GitHub before requesting review |
| Small, focused PRs | one purpose per PR |
| A description that answers questions | what, why, how to test, risks, screenshots |
| Point to the tricky parts | comments on your own PR where you want eyes |
| Respond to every comment | fix, explain, or agree to follow up in an issue |
| Separate disagreements from ego | if it's taste, accept; if it matters, discuss in a call and write the outcome down |
| Keep CI green before asking | reviewers shouldn't review broken code |

### Conventional Comments
| Label | Meaning |
|:--|:--|
| `issue (blocking):` | must be fixed before merge |
| `suggestion:` | a concrete improvement, author decides |
| `question:` | I don't understand, please explain |
| `nitpick (non-blocking):` | tiny, taste-level |
| `thought:` | idea for later, not for this PR |
| `praise:` | something done well |
| `todo:` | small required follow-up |

## Example
`.github/pull_request_template.md`
```markdown
## What and why
<!-- What changes, and what problem it solves. Link the issue. -->
Closes #

## How to test
<!-- Steps for the reviewer; commands, URLs, test data -->

## Risk and rollout
- [ ] Behind a flag / safe to deploy dark
- [ ] Migration is expand-only (or N/A)
- [ ] Logs/metrics/alerts updated (or N/A)

## Screenshots
<!-- UI changes: before / after -->
```
Review comments that help:
```text
issue (blocking): this endpoint returns any address by ID. A customer can read others' addresses (IDOR).
Scope the query by account: `addressesRepo.getForAccount(req.user.accountId, id)`, and add a test for the 404 case.

suggestion: the retry loop here duplicates fetchJson's retries (08-reliability lesson 01). Calling it with
`attempts: 1` avoids 3 × 3 attempts during an outage.

question: why is the limit 10 addresses? If it's a product decision, could we link it in the code comment?

nitpick (non-blocking): `addr` → `address` would read a little better.

praise: the authorization tests cover every route, including the 404 for other accounts. Very easy to trust this change.
```
Reviewing from the terminal:
```bash
gh pr list --search "review-requested:@me"     # what's waiting for me
gh pr checkout 123                             # run it locally
gh pr diff 123
gh pr review 123 --comment --body "Looks good overall; one blocking question on authorization (see inline)."
gh pr review 123 --approve
```

## Production patterns
- **Reviews within a working day**, with small PRs that make that possible.
- **Correctness, security, design, operability, tests** first; style left to tools.
- **Labeled comments** so authors know what blocks and what doesn't.
- **Authors self-review and describe** what, why, how to test, and risks.
- **Disagreements resolved quickly** (a call, a decision written in the PR, an ADR when it's architectural).

## Mistakes
Wrong: reviewing formatting by hand. It wastes everyone's time and hides important comments. Right: formatters and linters in CI; humans review substance.

Wrong: "LGTM" on a 2,000-line PR after five minutes. Right: ask for a split, or schedule a walkthrough.

Wrong: unlabeled comments. The author can't tell a blocker from an idea and either over-fixes or ignores something important. Right: Conventional Comments.

Wrong: authors arguing every nitpick, or silently ignoring comments. Right: accept taste-level suggestions, discuss what matters, reply to everything.

## Check yourself
1. What should a reviewer look at first, and what should tools handle?
2. How should an author prepare a PR before requesting review?
3. What does labeling a comment as `nitpick (non-blocking)` achieve?

<details>
<summary>Answers</summary>

1. The intent (description), then correctness, security (authorization, validation), design fit, operability (migrations, flags, logs), and tests. Formatting, import order, and style rules belong to formatters and linters in CI.
2. Keep it small and focused, make CI pass, review their own diff, write a description with what, why, how to test, and risks, and leave comments pointing reviewers at the tricky parts.
3. It tells the author the comment is optional and taste-level, so it doesn't block the merge or start an argument, while still sharing the idea.
</details>

## Sources
- [Google — The standard of code review](https://google.github.io/eng-practices/review/reviewer/standard.html)
- [Google — Speed of code reviews](https://google.github.io/eng-practices/review/reviewer/speed.html)
- [Google — The CL author's guide](https://google.github.io/eng-practices/review/developer/)
- [Conventional Comments](https://conventionalcomments.org/)
- [GitHub — Reviewing proposed changes in a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request)
