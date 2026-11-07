---
title: Small batches, tickets, and estimates
tech: Git, GitHub
version: GitHub issues (issue forms), GitHub Projects, pull requests, feature flags
date: 2026-11-07
covers: [1, 4, 5]
---
# Small batches, tickets, and estimates
[← Overview](00-overview.md)

## Why it matters
- A "two-day" feature becomes a 3,000-line PR after three weeks. Review takes another week, finds a design problem, and half of it is rewritten.
- A ticket says "Improve checkout". Two engineers build different things; neither is what the product manager meant.
- The team commits to a date with a single number. It slips twice, and trust in engineering estimates is gone.

## Concepts

### Small batches
| Practice | Why |
|:--|:--|
| Vertical slices | each change delivers a thin piece end to end (API + UI + test), usable or at least deployable |
| PRs under ~400 changed lines | review quality drops sharply on bigger diffs |
| Merge at least daily | short-lived branches, fewer conflicts ([trunk-based development](../../../01-foundations/01-git/docs/03-branching-and-integration.md)) |
| Flags for unfinished work | merge early, release later ([04-shipping/04-deployments lesson 04](../../../04-shipping/04-deployments/docs/04-flags-frontend-releases.md)) |
| Refactor in separate PRs | reviewers see behavior changes clearly |
| Stacked changes | a chain of small dependent PRs instead of one big one (also seen: Graphite, git-town) |

Ways to slice a feature "Customers can save addresses":
| Slice | Ships |
|:--|:--|
| 1 | table + repository + migration (no UI) |
| 2 | API: create and list, behind a flag |
| 3 | UI: list and add form |
| 4 | edit and delete |
| 5 | use saved address at checkout; remove the flag |

### Tickets that work
| Part | Content |
|:--|:--|
| Problem / user story | who needs what, and why |
| Acceptance criteria | testable statements: "given … when … then …" |
| Out of scope | what this ticket won't do |
| Notes | links, designs, constraints, risks |
| Definition of done | tests, docs, monitoring, deployed, flag state |
| Size | small enough to finish in a few days; otherwise split |
| Spikes | time-boxed investigation tickets with a written result |

### Estimates
| Practice | Why |
|:--|:--|
| Ranges, not points | "3–5 days, 80% confident" communicates uncertainty |
| Estimate slices, not projects | small things are estimated much better |
| Name the unknowns | each unknown becomes a spike or a risk |
| Track actuals | compare to improve future estimates |
| Re-estimate when you learn | and say so early |
| Scope is a lever | fixed date → negotiate scope; fixed scope → negotiate date |
| Milestones | demoable checkpoints every week or two |

## Example
`.github/ISSUE_TEMPLATE/feature.yml` — an issue form that asks for the right things.
```yaml
name: Feature
description: A change users will notice
labels: [feature]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: Who needs this, and why? What happens today?
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance criteria
      description: Testable statements (Given … When … Then …)
      value: |
        - [ ] Given …, when …, then …
    validations:
      required: true
  - type: textarea
    id: scope
    attributes:
      label: Out of scope
  - type: textarea
    id: notes
    attributes:
      label: Notes, designs, risks
```
A well-sliced ticket:
```markdown
### Save addresses: API (slice 2 of 5)
**Problem:** returning customers retype their address on every order (support: 40 requests/month).

**Acceptance criteria**
- [ ] Given a signed-in customer, when they POST a valid address to /v1/me/addresses, then it's stored and returned with 201
- [ ] Given more than 10 addresses, when they add another, then the API returns 409 `address.limit_reached`
- [ ] Given another customer's address ID, when they request it, then the API returns 404
- [ ] Behind flag `savedAddresses` (default off)

**Out of scope:** UI, editing, using the address at checkout (slices 3–5)
**Definition of done:** tests (incl. authorization), OpenAPI updated, deployed to production with the flag off
**Estimate:** 1–2 days
```
An estimate message that sets expectations:
```text
Saved addresses: 6–9 working days across 5 PRs, about 80% confident.
Biggest unknown: address validation for non-EU countries. I'll do a half-day spike tomorrow and update the range.
First demo (API + list UI) by Thursday.
```

## Production patterns
- **Vertical slices in small PRs**, merged daily, unfinished work behind flags.
- **Tickets with acceptance criteria and out-of-scope lists**, small enough to finish in days.
- **Spikes for unknowns**, with written results.
- **Range estimates with confidence**, updated as soon as something is learned.
- **Weekly demoable milestones** so problems show up early.

## Mistakes
Wrong: one PR per feature, merged when "done". Huge diffs, late feedback, painful merges. Right: a sequence of small, reviewable PRs.

Wrong: horizontal slicing (all DB work, then all API, then all UI). Nothing is usable until the end, and integration problems appear last. Right: thin vertical slices.

Wrong: tickets that describe a solution but no problem or acceptance criteria. Right: problem, testable criteria, out of scope.

Wrong: a single-number estimate treated as a promise. Right: a range with confidence and named unknowns, re-estimated openly.

## Check yourself
1. What makes a slice "vertical", and why is it better than a horizontal one?
2. What are acceptance criteria, and what makes them good?
3. How do you communicate an estimate with uncertainty?

<details>
<summary>Answers</summary>

1. It cuts through all layers (data, API, UI, tests) for a small piece of behavior, so it can be deployed, demoed, and tested on its own. Horizontal slices deliver nothing usable until all layers are done and hide integration problems until the end.
2. Testable statements of what must be true when the ticket is done, written from the user's or caller's perspective ("given … when … then …"). Good ones are specific, include edge cases and authorization, and say nothing about implementation details.
3. Give a range with a confidence level, name the biggest unknowns and how you'll reduce them (a spike), offer a milestone, and update the estimate as soon as you learn something.
</details>

## Sources
- [DORA — Working in small batches](https://dora.dev/capabilities/working-in-small-batches/)
- [Martin Fowler — Branching patterns](https://martinfowler.com/articles/branching-patterns.html)
- [GitHub — Syntax for issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [Atlassian — Agile estimation](https://www.atlassian.com/agile/project-management/estimation)
- [SmartBear — Best practices for code review (size and speed)](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/)
