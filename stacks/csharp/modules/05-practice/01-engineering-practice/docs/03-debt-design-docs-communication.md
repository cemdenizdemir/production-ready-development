---
title: Technical debt, design docs, and communication
tech: GitHub issues and labels, Markdown design docs and ADRs, .NET analyzers
version: GitHub (November 2026), .NET 10
date: 2026-11-09
covers: [6, 7, 8]
---
# Technical debt, design docs, and communication
[← Overview](00-overview.md)

## Why it matters
- The team asked for a "refactoring sprint" three quarters in a row and never got one, because nobody could say what the debt cost. Meanwhile every change to checkout took twice as long as it should.
- A developer spent three weeks building a reporting service; at the demo, the architect pointed out that Azure SQL read replicas already solved the problem. A two-page design doc would have surfaced that on day two.
- A blocker was mentioned in a stand-up as "a small issue with the payment sandbox". Ten days later it was the reason a launch slipped, and leadership heard about it last.

## Concepts

### Technical debt
| Practice | How |
|:--|:--|
| ⭐ make it visible | a `tech-debt` label; each item says the **cost** (slower changes, incidents, risk) and the **fix** |
| ⭐ pay down in the flow of work | the boy-scout rule; include small cleanups in feature PRs where you're already working; 10–20% of capacity |
| prioritise by pain | code that changes often and hurts often first (hotspots: churn × complexity) |
| safe refactoring | tests first (characterisation tests), IDE refactorings (rename, extract), small steps, behaviour unchanged |
| strangler fig | replace big parts gradually (03-backend/11-architecture) |
| debt you choose | deliberate shortcuts get a ticket and a date when taken |
| analyzers | `.NET` analyzers and `dotnet format` stop new debt of the boring kind |

Debt item examples: "OrderService is 2,800 lines; every checkout change touches it (12 PRs last quarter, 3 incidents). Fix: split into PlaceOrder/CancelOrder/RefundOrder slices, 5 PRs."

### Design docs and RFCs
| When to write one | When not to |
|:--|:--|
| ⭐ work > ~2 weeks, or several teams/modules | small, well-understood changes |
| new infrastructure, data model, or external dependency | a bug fix |
| hard to reverse (migrations, public APIs, vendors) | a decision already covered by an ADR |
| several plausible approaches | |

| Section | Content |
|:--|:--|
| ⭐ context and problem | why now, who's affected, constraints |
| ⭐ goals and non-goals | what success means; what's explicitly not attempted |
| ⭐ proposal | the design: diagrams, data, APIs, rollout, migration |
| ⭐ alternatives considered | and why not |
| risks and open questions | what could go wrong; what you need decided |
| operations | monitoring, alerts, cost, security, privacy |
| plan | milestones and slices |

Share early (a rough draft after a day beats a polished doc after two weeks); ask named reviewers for specific feedback; record the final decision as an **ADR** (03-backend/11-architecture lesson 06).

### Communication
| Habit | Practice |
|:--|:--|
| ⭐ bottom line up front (BLUF) | first sentence = the conclusion or the ask |
| ⭐ escalate early | say "at risk" as soon as you think so, with options; bad news doesn't improve with age |
| ⭐ async updates | short written status: done, next, blocked, risks; in the ticket or channel |
| ⭐ good questions | what you're trying to do, what you tried, what happened, what you expected, minimal repro |
| right channel | incident → incident channel; decision → doc/ADR; quick question → chat thread |
| write it down | decisions from calls get a short written summary with owners |

## Example
`docs/design/2026-11-discount-codes.md` (skeleton)
```markdown
# Design: discount codes
Author: Ana · Reviewers: Mehmet (payments), Lea (frontend) · Status: in review · Decision by: 2026-11-14

## Context and problem
Support applies ~40 newsletter codes per week by hand. Marketing wants self-service codes for the Q1 campaign.

## Goals / non-goals
Goals: percentage and fixed codes at checkout; usage limits; audit of who used which code.
Non-goals: automatic promotions, stacking multiple codes, partner-specific pricing.

## Proposal
- Catalog module owns `DiscountCode` (value object rules); Ordering applies it during PlaceOrder through `IDiscounts`.
- Rounding: banker's rounding per line, in minor units; finance confirmed (link).
- Usage limits enforced with a unique (CodeId, OrderId) row + conditional update on `RemainingUses`.
- Rollout: flag `DiscountCodes`; staff → 10% → all.

## Alternatives
1. Stripe Coupons: ties discounts to the payment provider; our totals must exist before payment. Rejected.
2. A separate promotions service: too early (03-backend/11-architecture lesson 06).

## Risks / open questions
- Abuse: brute-forcing codes → rate limit `/checkout/discount` (5/min per user).
- Q: do refunds restore a code's usage? (product to decide)

## Operations
Metric `shop.discounts.applied` by code type; alert on > 5% failed applications.
```
An escalation message (BLUF):
```text
Discount codes launch (Dec 1) is at risk.
Cause: the Stripe sandbox rejects our zero-amount orders (100% codes); support ticket opened, no ETA.
Options: (a) launch without 100% codes (marketing OK?), (b) slip 1 week, (c) bypass Stripe for zero-amount orders (2 days work, needs payments review).
I recommend (a). Need a decision by Thursday.
```
A good question in the team channel:
```text
How should I test Hangfire recurring jobs that use Europe/Istanbul time?
Trying to: assert the nightly reconciliation runs at 04:00 local.
Tried: FakeTimeProvider + calling the job directly (works), but RecurringJob.AddOrUpdate isn't covered.
Expected: a way to check the registered cron + timezone in a test.
Repro: tests/Shop.Api.Tests/RecurringJobsTests.cs on branch feat/recon-tests
```

## Production patterns
- Debt is tracked with its cost and fix, chosen by pain, and paid in the flow of work with a steady capacity share.
- Design docs for big or irreversible work, shared as early drafts with named reviewers and a decision date; outcomes become ADRs.
- Communication is written, BLUF, early about risks, and specific in questions; decisions from calls are summarised in writing.

## Mistakes
Wrong: "We need a refactoring sprint."
Right: "OrderService slows every checkout change by ~2 days and caused 3 incidents; 5 PRs over two sprints fix it. Can we take 20% capacity?"

Wrong: a polished 15-page design doc presented as final.
Right: a short draft shared early, alternatives listed, specific questions for reviewers.

## Check yourself
1. How do you make technical debt something the business can prioritise?
2. What are the must-have sections of a design doc?
3. What does a good escalation message contain?

<details><summary>Answers</summary>

1. Describe its cost in business terms (slower delivery, incidents, risk) with evidence, propose a concrete fix with effort, and pay it down incrementally within normal work.
2. Context and problem, goals and non-goals, the proposal, alternatives considered, risks and open questions, and operational aspects (monitoring, security, cost), plus a rollout plan.
3. The bottom line first (what's at risk and when), the cause, options with trade-offs, your recommendation, and the decision you need and by when.
</details>

## Sources
- [Martin Fowler — Technical debt quadrant](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html)
- [Google — Design docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/)
- [Michael Nygard — Documenting architecture decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [Refactoring (Martin Fowler)](https://refactoring.com/)
- [How to ask good questions (Julia Evans)](https://jvns.ca/blog/good-questions/)
