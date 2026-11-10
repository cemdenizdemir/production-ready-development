---
title: Debugging, AI assistants, ownership, and growth
tech: Git, GitHub
version: Git 2.5x (git bisect run), GitHub, AI coding assistants
date: 2026-11-07
covers: [9, 10, 11, 12]
---
# Debugging, AI assistants, ownership, and growth
[← Overview](00-overview.md)

## Why it matters
- An engineer changes things at random for two days to fix a flaky bug. A ten-minute `git bisect` would have found the commit that introduced it.
- AI-generated code passes review because it "looks right". It contains a SQL query built with string concatenation and an outdated API call.
- A feature is "done" when the PR merges. Nobody watches the dashboards after the deploy; customers report the errors three days later.

## Concepts

### Debugging methodically
| Step | Practice |
|:--|:--|
| Reproduce | smallest reliable reproduction; a failing test if possible |
| Observe | logs, traces, actual values; don't assume |
| Hypothesize | one testable explanation at a time |
| Narrow | binary search: inputs, code paths, commits (`git bisect`) |
| Change one thing | then observe again |
| Fix the cause | and add a test that fails without the fix |
| Write it down | a debugging log in the issue; the next person will thank you |
| Ask for help | after a time box (e.g. an hour stuck), with what you've tried |

### AI coding assistants
| Practice | Why |
|:--|:--|
| You own every line | review generated code as strictly as a colleague's, or stricter |
| Verify APIs and versions | assistants can produce plausible but outdated or invented APIs |
| Tests first or alongside | a failing test defines what "correct" means |
| Security review | injection, authorization, secrets, unsafe defaults |
| No secrets or personal data in prompts | follow the company's data policy and approved tools |
| Licensing | follow the policy on generated code and attribution |
| Small, scoped requests | easier to review than large generated changes |
| Good uses | explaining code, first drafts of tests, boilerplate, refactors with tests, exploring options |
| Mark it in PRs if your team asks | reviewers know where to look harder |

### Ownership
| Practice | Means |
|:--|:--|
| You build it, you run it | the team that writes a service is on call for it |
| Done = in production and working | deployed, monitored, verified with real traffic |
| Watch your deploys | dashboards and errors for 15–30 minutes after |
| Production readiness per change | logs, metrics, alerts, runbook, flag, rollback plan |
| Follow up | close the loop on incidents, debt, and questions you raised |
| Leave things better | docs, tests, a small cleanup in code you touched |

### Growing from mid-level to senior
| Dimension | Mid-level | Senior |
|:--|:--|:--|
| Scope | well-defined tasks and features | ambiguous problems, multi-week projects |
| Technical | solid implementation | design, trade-offs, reliability, security across systems |
| Impact | own work | team output: reviews, unblocking, standards |
| Communication | status of own work | aligns people, writes design docs, explains trade-offs |
| Mentoring | helps when asked | actively grows others |
| Operations | follows runbooks | improves systems so incidents don't recur |

Ways to grow: ask for (and give) specific feedback, take on the ambiguous ticket nobody wants, write the design doc, lead an incident review, mentor someone, keep a brag document of impact for reviews.

## Example
Finding the commit that broke something with `git bisect run`:
```bash
git bisect start
git bisect bad HEAD                 # current version is broken
git bisect good v1.42.0             # this release was fine
git bisect run pnpm vitest run src/orders/pricing.test.ts   # exit 0 = good, non-zero = bad
# Git checks out the middle commit, runs the test, and repeats until it prints the first bad commit
git bisect reset
```
A debugging log in the issue:
```markdown
**Symptom:** 2% of checkouts fail with "amount mismatch" since Tuesday.
- Hypothesis 1: rounding in discount calculation → reproduced with a 3-item cart and a 15% code ✓
- Observed: total 59.995 rounded to 60.00 in the UI but 59.99 in the API
- Cause: the frontend rounds per line, the API rounds the total (commit 8c1e2f, found with git bisect)
- Fix: shared `priceOrder()` in the domain module used by both; property-based test for random carts and codes
```
A production readiness checklist for your change (in the PR description):
```markdown
- [ ] Logs for the important events (no personal data)
- [ ] Metrics/dashboard panel for the new flow; alert if it matters to users
- [ ] Behind a flag, default off; rollout plan
- [ ] Migration expand-only; rollback = previous image
- [ ] Runbook updated if on-call might need it
- [ ] I'll watch dashboards and Sentry for 30 minutes after deploy
```
Reviewing AI-generated code: what to check first.
```text
1. Does it do what the ticket asks? Run the tests, read the logic, not just the shape.
2. Do the APIs, options, and versions exist in our versions? Check the docs.
3. Input validation, authorization, parameterized queries, no secrets, safe defaults.
4. Errors, timeouts, retries, and edge cases (empty, huge, concurrent).
5. Fits our architecture and conventions; no unnecessary dependencies.
```

## Production patterns
- **Reproduce, hypothesize, narrow, verify**, with `git bisect` for regressions and a test for every fix.
- **AI-assisted code reviewed like any other code**, with tests, verified APIs, and a security pass.
- **Ownership through production**: watch your deploys, add observability, keep runbooks current.
- **A production readiness checklist** in every significant PR.
- **Deliberate growth**: feedback, ambiguous problems, design docs, mentoring, recorded impact.

## Mistakes
Wrong: changing several things at once while debugging. Even if it works, you don't know why. Right: one change per experiment, observe the result.

Wrong: merging generated code you don't fully understand. Right: understand it, test it, or don't merge it.

Wrong: "merged" as the finish line. Right: deployed, observed, and verified with real traffic.

Wrong: waiting for a promotion to start working at the next level. Right: take on senior-level scope (design, mentoring, reliability) and make the impact visible.

## Check yourself
1. How does `git bisect run` find the commit that introduced a bug?
2. Name four things to check in AI-generated code before merging.
3. What does "done" mean for a change in a team that owns production?

<details>
<summary>Answers</summary>

1. You mark a known bad and a known good commit; Git checks out the commit halfway between, runs your script (exit 0 = good, non-zero = bad), and repeats the binary search on the remaining half until it identifies the first bad commit, in about log2(n) steps.
2. That it actually solves the ticket (tests pass, logic is right); that the APIs and options exist in your versions; security (validation, authorization, parameterized queries, no secrets); and error handling, timeouts, and edge cases, plus fit with your architecture and dependencies.
3. The change is deployed to production, working with real traffic, observable (logs, metrics, alerts where needed), safe to roll back, and someone has watched it after the deploy, not just merged it.
</details>

## Sources
- [Git — git-bisect](https://git-scm.com/docs/git-bisect)
- [Julia Evans — Debugging manifesto](https://jvns.ca/blog/2022/12/08/a-debugging-manifesto/)
- [OWASP — Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Werner Vogels — "You build it, you run it" (ACM Queue interview)](https://queue.acm.org/detail.cfm?id=1142065)
- [StaffEng — Guides](https://staffeng.com/guides/)
