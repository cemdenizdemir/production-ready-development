---
title: Small batches, tickets, and estimation
tech: Git, GitHub (issues, Projects, pull requests), Microsoft.FeatureManagement
version: GitHub (November 2026)
date: 2026-11-09
covers: [1, 4, 5]
---
# Small batches, tickets, and estimation
[← Overview](00-overview.md)

## Why it matters
- "Add discount codes" lived on a branch for five weeks. The PR had 4,200 changed lines; review took a week, the merge broke checkout, and nobody could tell which part caused it.
- A ticket said "Improve order emails". The developer built HTML templates; the product manager wanted the emails sent faster. Two weeks were spent on the wrong thing.
- "How long will search take?" "Two weeks." It took seven, because nobody said the two weeks assumed the search index already existed.

## Concepts

### Small batches
| Habit | Practice |
|:--|:--|
| ⭐ vertical slices | each change delivers a thin end-to-end piece (endpoint + domain + DB + UI), not "all the backend first" |
| ⭐ small PRs | aim for < 400 changed lines; one purpose per PR |
| ⭐ merge daily | short-lived branches (hours to a couple of days); trunk-based development |
| ⭐ flags for unfinished work | merge code behind a feature flag that's off in production (04-deployments) |
| separate refactors | a "prepare" PR (refactor, no behaviour change) before the feature PR |
| stacked PRs | for larger features: PR 2 based on PR 1, each reviewable alone |
| merge queue | keeps `main` green when many small PRs land |

Discount codes as slices: (1) `DiscountCode` entity + migration, flag off; (2) admin API to create codes; (3) apply a code at checkout (percentage only); (4) UI field behind the flag; (5) fixed-amount codes; (6) usage limits; (7) turn the flag on for staff → 10% → everyone.

### Writing tickets and breaking down work
| Part | Content |
|:--|:--|
| ⭐ problem / why | the user or business problem, not the solution |
| ⭐ acceptance criteria | testable statements (Given/When/Then or bullet checks) |
| ⭐ out of scope | what this ticket explicitly doesn't do |
| notes / constraints | links, designs, performance or security requirements |
| ⭐ definition of done (team-wide) | tests, review, docs, deployed, flag state, monitoring |
| spikes | time-boxed investigation tickets whose output is knowledge (a doc, a prototype), not production code |

Break down until each ticket is **1–3 days** of work and independently deployable.

### Estimation and delivery
| Practice | Why |
|:--|:--|
| ⭐ ranges, not points | "3–6 days" carries uncertainty; a single number hides it |
| ⭐ name the unknowns | "assumes the Stripe sandbox supports X; spike first" |
| milestones | demoable checkpoints every 1–2 weeks expose slips early |
| ⭐ scope negotiation | fixed date → flex scope; "we can ship percentage codes by Friday, fixed-amount next week" |
| re-estimate | update as soon as you learn; early bad news is cheap |
| track actuals | compare estimates to reality to calibrate |
| buffers | integration, review, and deploy time are real work |

## Example
`.github/ISSUE_TEMPLATE/feature.yml`
```yaml
name: Feature
description: A change that delivers value to users
body:
  - type: textarea
    id: problem
    attributes: { label: Problem / why, description: Who is affected and what do they need? }
    validations: { required: true }
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance criteria
      value: |
        - [ ] Given ..., when ..., then ...
    validations: { required: true }
  - type: textarea
    id: out-of-scope
    attributes: { label: Out of scope }
  - type: input
    id: estimate
    attributes: { label: Estimate (range), placeholder: "2–4 days; unknown: ..." }
```
A good ticket:
```markdown
## Problem
Customers with a discount code from our newsletter can't use it at checkout; support applies them by hand (~40/week).

## Acceptance criteria
- [ ] Given a valid percentage code, when the customer applies it at checkout, then the order total is reduced and the code shows on the order.
- [ ] Given an expired or unknown code, when applied, then the customer sees "This code isn't valid" (problem code `discount.invalid`) and the total is unchanged.
- [ ] Applying a code is idempotent; re-applying doesn't double the discount.
- [ ] Behind feature flag `DiscountCodes` (off in production).

## Out of scope
Fixed-amount codes, usage limits, admin UI (separate tickets #412, #413, #414).

## Estimate
2–4 days. Unknown: rounding rules for percentage discounts on multi-currency orders (ask finance; spike #415).
```
Small-batch Git flow with the `gh` CLI:
```bash
git switch -c feat/discount-apply-percentage
# ... small change + tests ...
git commit -m "feat(checkout): apply percentage discount codes behind flag"
gh pr create --fill --draft            # open early for visibility
gh pr ready && gh pr merge --squash --auto
```

## Production patterns
- Work is sliced vertically into tickets of 1–3 days, each deployable behind a flag; PRs are small and merged daily.
- Tickets state the problem, testable acceptance criteria, and what's out of scope; spikes are separate and time-boxed.
- Estimates are ranges with named assumptions, revisited as soon as reality changes; scope bends when dates can't.

## Mistakes
Wrong: one long-lived branch per feature, merged when "done".
Right: small PRs to `main` daily, unfinished work hidden by flags.

Wrong: "Should take a week" with no assumptions.
Right: "4–7 days, assuming the payments refactor (#390) lands first; if not, +3 days."

## Check yourself
1. Why are vertical slices safer than building one layer at a time?
2. What's the purpose of an "out of scope" section?
3. What do you do when a fixed deadline can't fit the estimate?

<details><summary>Answers</summary>

1. Each slice is usable and testable end to end, so integration problems surface immediately, every merge is small and reversible, and you can ship value (or stop) at any point.
2. It prevents misunderstandings and scope creep by stating what won't be built, so reviewers, product, and QA share the same expectations.
3. Negotiate scope: identify the smallest valuable version that fits the date, ship that, and schedule the rest, rather than cutting quality or silently slipping.
</details>

## Sources
- [DORA — Working in small batches](https://dora.dev/capabilities/working-in-small-batches/)
- [Trunk-based development](https://trunkbaseddevelopment.com/)
- [GitHub issue forms](https://docs.github.com/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [GitHub merge queue](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- [Martin Fowler — Feature toggles](https://martinfowler.com/articles/feature-toggles.html)
