---
title: Code review as reviewer and author
tech: GitHub pull requests, CODEOWNERS, rulesets, GitHub Copilot code review
version: GitHub (November 2026)
date: 2026-11-09
covers: [2, 3]
---
# Code review as reviewer and author
[← Overview](00-overview.md)

## Why it matters
- PRs waited three days for review, so authors started new work, branches drifted, and merges conflicted. Review latency, not coding, was the team's bottleneck.
- A reviewer left 40 comments about naming and missed that a new endpoint had no authorization check.
- An author pushed a 1,500-line PR with the description "fixes". The reviewer approved after skimming; it caused a production incident.

## Concepts

### As a reviewer
| Priority (highest first) | Look for |
|:--|:--|
| ⭐ 1. correctness and security | does it do what the ticket says? authz on every endpoint, input validation, injection, secrets, PII in logs |
| ⭐ 2. production behaviour | timeouts, retries, idempotency, migrations (locks, expand/contract), observability, failure modes |
| 3. design | right place in the architecture (module boundaries), simple enough, testable |
| 4. tests | meaningful tests for the behaviour and edge cases; not just coverage |
| 5. readability | names, structure, comments where non-obvious |
| 6. style | let analyzers and `dotnet format` handle it; don't spend human attention here |

| Habit | Practice |
|:--|:--|
| ⭐ turnaround | first response within a few working hours; review before starting new work |
| ⭐ label comments | Conventional Comments: `issue:`, `suggestion:`, `question:`, `nitpick (non-blocking):`, `praise:` |
| ⭐ kind and specific | comment on code, not the person; explain why; suggest a concrete alternative (GitHub suggestions) |
| blocking vs non-blocking | make it explicit; approve with nits rather than block on them |
| big PR | ask to split rather than skim |
| run it | check out the branch (`gh pr checkout 123`) for anything risky |
| praise | say what's good; it teaches too |

### As an author
| Habit | Practice |
|:--|:--|
| ⭐ self-review first | read your own diff in the GitHub UI before requesting review; remove debug code and leftovers |
| ⭐ description | what and why, how to test, screenshots for UI, risks, rollout (flag, migration), links to ticket/ADR |
| ⭐ small and focused | one purpose; refactors in their own PR |
| guide the reviewer | comment on your own PR where something is subtle |
| checks green | tests, analyzers, and format pass before asking |
| ⭐ respond to feedback | answer every comment; "done" or explain; disagree with reasons, not ego; move long debates to a call and write down the outcome |
| don't force-push mid-review | push new commits so reviewers see what changed (squash at merge) |

### GitHub mechanics
| Feature | Use |
|:--|:--|
| CODEOWNERS | auto-request owners per path (03-backend/11-architecture) |
| rulesets | require reviews, passing checks, linear history, signed commits |
| draft PRs | early feedback without review requests |
| suggested changes | one-click fixes in comments |
| Copilot code review | a first pass for obvious issues; a human still reviews |
| `gh pr review --approve -b "..."` | review from the terminal |

## Example
`.github/pull_request_template.md`
```markdown
## What and why
<!-- What does this change, and why now? Link the ticket. -->
Closes #

## How to test
<!-- Steps, test data, or the tests that cover it -->

## Risk and rollout
- [ ] Behind a feature flag: `...` (default off) / not needed
- [ ] Migration: none / expand step / contract step (backward compatible with the running version)
- [ ] New config or secrets: none / listed here
- [ ] Observability: logs/metrics/alerts added or not needed

## Screenshots (UI)

## Checklist
- [ ] Self-reviewed the diff
- [ ] Tests added/updated
- [ ] Docs/ADR updated if behaviour or architecture changed
```
Review comments with labels:
```text
issue (blocking): POST /orders/{id}/refund has no ownership check. A customer could refund another customer's
order by changing the ID. Suggest RequireAuthorization("OrderOwner") like the GET endpoint.

suggestion (non-blocking): this retry loop duplicates the resilience handler on PaymentsClient; removing it
avoids retrying POSTs twice. See 03-backend/08-reliability lesson 02.

question: is the 30-day window for refunds a business rule? If so, could it live on Order.CanRefund()?

nitpick (non-blocking): `ordrs` → `orders`.

praise: the migration splits the backfill into a job; nice, that keeps the deploy fast.
```
Responding as an author:
```text
> issue (blocking): no ownership check
Good catch, thank you. Added RequireAuthorization("OrderOwner") and a test for another user's order (403). 3f2c1ab

> suggestion: remove retry loop
Agree; removed in 9d81e0c. The handler already has DisableForUnsafeHttpMethods.
```

## Production patterns
- Reviews start within hours; the team treats review as higher priority than starting new work.
- Reviewers focus on correctness, security, and production behaviour first; tools handle style.
- Comments are labelled, kind, and actionable; blocking issues are explicit.
- Authors self-review, write descriptions with risk and rollout, keep PRs small, and close every comment thread.

## Mistakes
Wrong: "LGTM" on a 2,000-line PR after five minutes.
Right: ask for a split, or review properly with the risky parts checked out and run.

Wrong: "This is wrong."
Right: "issue: this query loads all orders into memory (`ToListAsync` before `Where`); with 2M rows it'll time out. Move the filter before materialising."

## Check yourself
1. What should a reviewer check first?
2. What belongs in a PR description?
3. How should an author handle a comment they disagree with?

<details><summary>Answers</summary>

1. Correctness against the ticket and security (authorization, validation, secrets, data exposure), then production behaviour (failure modes, migrations, observability), before design, tests, and readability.
2. What changed and why (with the ticket link), how to test it, risks and rollout (flags, migrations, config), screenshots for UI, and anything subtle the reviewer should look at.
3. Reply with reasons and evidence, stay open to being wrong, and if it doesn't converge quickly, talk it through and record the outcome in the thread; never silently ignore it.
</details>

## Sources
- [Google — The standard of code review](https://google.github.io/eng-practices/review/reviewer/standard.html)
- [Google — The CL author's guide](https://google.github.io/eng-practices/review/developer/)
- [Conventional Comments](https://conventionalcomments.org/)
- [GitHub — About CODEOWNERS](https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub — Rulesets](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [Copilot code review](https://docs.github.com/copilot/using-github-copilot/code-review/using-copilot-code-review)
