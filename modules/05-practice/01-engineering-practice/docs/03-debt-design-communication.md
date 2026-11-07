---
title: Technical debt, design docs, and communication
tech: Git, GitHub
version: GitHub issues and labels, GitHub Discussions, markdown design docs and ADRs in the repository
date: 2026-11-07
covers: [6, 7, 8]
---
# Technical debt, design docs, and communication
[← Overview](00-overview.md)

## Why it matters
- "We'll clean it up later" for two years. Now every change to orders takes a week, and nobody can say why or how much it costs.
- An engineer spends three weeks building a new search service. In the first review, a senior engineer points out that Postgres full-text search would have been enough.
- A blocker is found on Monday and mentioned in the Friday standup. The launch slips by a week that a Monday message would have saved.

## Concepts

### Technical debt
| Kind | Example | Handling |
|:--|:--|:--|
| Deliberate, prudent | "ship with a simple implementation, revisit at 10× traffic" | record it with a trigger |
| Accidental | design that no longer fits after the product changed | refactor when it slows work |
| Reckless | no tests, copy-paste, ignored warnings | prevent with review and CI |
| Bit rot | outdated dependencies, deprecated APIs | regular upgrades (Dependabot) |

| Practice | Why |
|:--|:--|
| Make it visible | `tech-debt` issues with the cost ("adds ~2 days to every checkout change") |
| Tie it to work | pay down debt in the area you're changing (boy scout rule) |
| Budget | a steady share of each cycle (often 10–20%) instead of rare "cleanup sprints" |
| Refactor safely | tests first, small steps, behavior-preserving PRs separate from feature PRs |
| Delete code | unused features and flags are debt too |
| Explain in business terms | speed, risk, incidents, not "the code is ugly" |

### Design docs and RFCs
| Write one when | Skip it when |
|:--|:--|
| several weeks of work | a few days of work with an obvious approach |
| new service, datastore, or vendor | a local change inside one module |
| changes that affect other teams or APIs | reversible experiments behind a flag |
| security, privacy, or data-loss risk | — |

| Section | Content |
|:--|:--|
| Context and problem | why now, who's affected |
| Goals and non-goals | what success looks like; what's explicitly out |
| Proposal | the design, with a diagram |
| Alternatives considered | including "do nothing", with reasons |
| Risks and open questions | what could go wrong, what you don't know |
| Rollout and operations | migration, flags, monitoring, rollback |
| Decision | summarized as an ADR once agreed |

Share early as a draft (one or two pages beats a perfect ten), ask specific reviewers for specific feedback, and time-box the discussion.

### Communication
| Practice | Detail |
|:--|:--|
| Bottom line up front | first sentence says what you need or what happened |
| Escalate early | blockers and risks the day you find them, with options |
| Async by default | written updates people can read later; meetings for decisions and conflict |
| Ask good questions | context, what you tried, what you expected, the exact error |
| Weekly update | progress, plans, risks, help needed |
| Decisions in writing | in the PR, issue, or ADR, not only in a call |
| Public channels over DMs | others learn and can help |

## Example
A debt issue that gets prioritized:
```markdown
### Tech debt: order status logic duplicated in 4 places
**Cost today:** every status change needs edits in routes, worker, admin, and reports (~2 extra days per change;
3 bugs in the last quarter came from the copies disagreeing).
**Proposal:** move transitions into `orders.domain.ts` (`transition(order, event)`) with unit tests, then replace the copies one PR at a time.
**Size:** ~4 days over 5 PRs, no behavior change.
**Trigger to do it now:** the Q1 returns feature adds two new statuses.
```
`docs/design/2026-11-saved-addresses-validation.md` — a short design doc.
```markdown
# Address validation for saved addresses

Status: draft · Author: Sam · Reviewers: Dana (payments), Lee (frontend) · Decision by: 2026-11-14

## Problem
5% of orders bounce back from the carrier because of invalid addresses (support cost ~€3k/month).

## Goals / non-goals
- Goal: reject clearly invalid addresses at entry; suggest corrections for EU addresses.
- Non-goal: verifying that a person lives at the address.

## Proposal
Validate in the `addresses` module through a `AddressValidator` port; first adapter: the carrier's validation API,
called with a 1 s timeout and a breaker; on failure, accept the address and flag it for review.

## Alternatives
1. Do nothing: keeps the €3k/month cost.
2. Client-side only: easy to bypass, no carrier data.
3. Commercial global service: better coverage, €0.02/lookup; revisit when non-EU volume grows.

## Risks / open questions
- Carrier API rate limit (50 req/s): enough for current peak (8 req/s)?
- Privacy: addresses sent to a processor → DPA needed (legal confirmed it exists).

## Rollout
Flag `addressValidation`, 10% → 100% over a week; dashboard: validation failures, carrier latency, bounce rate.
```
A weekly update:
```text
Saved addresses — week 46
Done: API + list UI live behind the flag (internal users).
Next: edit/delete; checkout integration starts Wednesday.
Risk: carrier validation API is slower than documented (p95 900 ms). Mitigation: 1 s timeout + accept-and-flag. Decision needed from Dana by Thursday.
Help: anyone who has worked with the carrier's sandbox before?
```

## Production patterns
- **Debt tracked as issues with costs and triggers**, paid down continuously in the areas being changed.
- **Short design docs for big or risky work**, shared early, with alternatives and a rollout plan; decisions end up as ADRs.
- **Escalation on the day a risk appears**, with options and a recommendation.
- **Written, async updates** with bottom line up front; decisions recorded where the work lives.
- **Refactors in separate, behavior-preserving PRs** with tests first.

## Mistakes
Wrong: a "cleanup sprint" once a year. Debt grows faster than it's paid. Right: a steady share of every cycle, tied to current work.

Wrong: "the code is bad" as the argument for refactoring. It doesn't compete with features. Right: the cost in time, bugs, or incidents.

Wrong: a 15-page design doc shared when the implementation is done. Right: two pages, early, with alternatives and open questions.

Wrong: waiting until a standup or a status meeting to mention a blocker. Right: post it immediately, with what you've tried and what you need.

## Check yourself
1. How do you make technical debt something a product manager will prioritize?
2. When is a design doc worth writing, and what must it contain?
3. What makes a written update easy for a busy reader?

<details>
<summary>Answers</summary>

1. Describe it in business terms: what it costs now (extra days per change, bugs, incidents), what triggers the need to fix it, the size of the fix, and ideally tie it to upcoming work that will be faster or safer because of it.
2. For work that takes weeks, adds a new system or vendor, affects other teams, or carries security or data risk. It needs the problem, goals and non-goals, the proposal, alternatives (including doing nothing), risks and open questions, and the rollout and operations plan.
3. The bottom line first, short sections (done, next, risks, help needed), concrete numbers and dates, explicit decisions or asks with a deadline, and links instead of long explanations.
</details>

## Sources
- [Martin Fowler — Technical debt quadrant](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html)
- [Martin Fowler — Refactoring](https://refactoring.com/)
- [Design Docs at Google (industrial empathy)](https://www.industrialempathy.com/posts/design-docs-at-google/)
- [Michael Nygard — Documenting architecture decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [GitLab Handbook — Communication](https://handbook.gitlab.com/handbook/communication/)
