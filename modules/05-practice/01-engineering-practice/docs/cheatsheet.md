---
title: Engineering Practice cheatsheet
tech: Git, GitHub
version: Git 2.5x, GitHub (issue forms, PR templates, reviews, rulesets, merge queue), gh CLI
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Engineering Practice cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Small batches
| Practice | Detail |
|:--|:--|
| ⭐ Vertical slices | data + API + UI + tests for a thin piece |
| ⭐ PRs under ~400 lines | reviewable |
| Merge daily | short-lived branches |
| ⭐ Flags for unfinished work | merge early, release later |
| Refactors in separate PRs | clear behavior changes |
| Stacked PRs | Graphite, git-town (also seen) |

## Tickets
| Part | Content |
|:--|:--|
| ⭐ Problem | who, what, why |
| ⭐ Acceptance criteria | given / when / then, testable |
| Out of scope | explicit |
| Definition of done | tests, docs, monitoring, deployed, flag state |
| Size | days, not weeks |
| Spike | time-boxed investigation with a written result |
| Issue forms | `.github/ISSUE_TEMPLATE/*.yml` |

## Estimates
| Practice | Detail |
|:--|:--|
| ⭐ Ranges + confidence | "3–5 days, 80%" |
| Slices, not projects | better accuracy |
| ⭐ Name unknowns | spikes, risks |
| Re-estimate early | as soon as you learn |
| ⭐ Scope vs date | negotiate one when the other is fixed |
| Milestones | demo every 1–2 weeks |

## Reviewing
| Practice | Detail |
|:--|:--|
| ⭐ Respond within one working day | first response matters most |
| Description first | understand intent |
| ⭐ Order | correctness → security → design → operability → tests → naming |
| Run it | `gh pr checkout <n>` |
| ⭐ Label comments | Conventional Comments |
| Explain why | links, examples, suggestions |
| Praise | specific |
| Too big | ask to split |
| Style | tools, not humans |

## Being reviewed
| Practice | Detail |
|:--|:--|
| ⭐ Self-review | read your diff on GitHub first |
| ⭐ Description | what, why, how to test, risks, screenshots |
| Green CI before asking | |
| Comment on tricky parts | guide reviewers |
| ⭐ Reply to every comment | fix, explain, or follow-up issue |
| Taste → accept; substance → discuss | write the outcome down |

## Conventional Comments
| Label | Meaning |
|:--|:--|
| ⭐ `issue (blocking):` | must fix |
| `suggestion:` | author decides |
| `question:` | explain please |
| ⭐ `nitpick (non-blocking):` | tiny, optional |
| `thought:` | for later |
| `praise:` | well done |
| `todo:` | small required follow-up |

## gh CLI for reviews
| Command | Use |
|:--|:--|
| `gh pr list --search "review-requested:@me"` | my queue |
| `gh pr checkout <n>` | run locally |
| `gh pr diff <n>` | diff in terminal |
| `gh pr review <n> --comment --body "…"` | comment |
| `gh pr review <n> --approve` / `--request-changes` | decision |
| `gh pr create --fill` | open a PR from commits |

## Technical debt
| Practice | Detail |
|:--|:--|
| ⭐ Visible | `tech-debt` issues with cost and trigger |
| ⭐ Business terms | days per change, bugs, incidents |
| Boy scout rule | improve what you touch |
| Budget | steady 10–20% per cycle |
| Safe refactoring | tests first, small steps, separate PRs |
| Delete | unused code and flags |

## Design docs
| Section | Content |
|:--|:--|
| Context, problem | why now |
| ⭐ Goals / non-goals | success and boundaries |
| Proposal | design + diagram |
| ⭐ Alternatives | incl. do nothing |
| Risks, open questions | unknowns |
| Rollout, operations | flags, monitoring, rollback |
| Decision | ADR |
| ⭐ When | weeks of work, new systems, cross-team, risky |

## Communication
| Practice | Detail |
|:--|:--|
| ⭐ Bottom line up front | first sentence = the point |
| ⭐ Escalate early | same day, with options |
| Async by default | meetings for decisions and conflict |
| Good questions | context, tried, expected, actual, error |
| Weekly update | done, next, risks, help |
| Decisions in writing | PR, issue, ADR |
| Public channels | over DMs |

## Debugging
| Step | Detail |
|:--|:--|
| ⭐ Reproduce | smallest case, failing test |
| Observe | real values, logs, traces |
| Hypothesize | one at a time |
| ⭐ Narrow | binary search; `git bisect run <cmd>` |
| One change at a time | |
| ⭐ Fix + test | test fails without the fix |
| Write it down | debugging log in the issue |
| Time box | ask for help with what you tried |

## AI coding assistants
| Practice | Detail |
|:--|:--|
| ⭐ You own every line | review strictly |
| ⭐ Verify APIs and versions | plausible ≠ real |
| Tests first or alongside | define correct |
| ⭐ Security pass | injection, authorization, secrets, defaults |
| No secrets/personal data in prompts | company policy, approved tools |
| Licensing policy | follow it |
| Small requests | reviewable output |

## Ownership
| Practice | Detail |
|:--|:--|
| ⭐ Done = working in production | deployed, observed, verified |
| ⭐ Watch your deploys | 15–30 min of dashboards and errors |
| Readiness checklist | logs, metrics, alerts, flag, rollback, runbook |
| You build it, you run it | team on call for its services |
| Follow up | close loops |

## Mid-level → senior
| Dimension | Senior looks like |
|:--|:--|
| Scope | ambiguous, multi-week problems |
| Technical | design, trade-offs, reliability, security |
| Impact | team output, reviews, unblocking |
| Communication | design docs, alignment |
| Mentoring | actively grows others |
| Operations | prevents recurrence |
| Habits | feedback, brag document, take the hard ticket |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Giant PRs | slow, shallow reviews | small slices |
| Horizontal slicing | nothing usable until the end | vertical slices |
| Solution-only tickets | wrong thing built | problem + criteria |
| Single-number estimates | broken promises | ranges + confidence |
| Unlabeled review comments | over-fixing or ignored blockers | Conventional Comments |
| Humans reviewing style | wasted attention | formatters, linters |
| Cleanup sprints | debt outruns them | continuous budget |
| Late design docs | wasted implementation | short docs early |
| Blockers held until standup | lost days | escalate immediately |
| Random debugging | no learning | hypothesis + one change |
| Unreviewed AI code | subtle bugs, insecure code | review + tests |
| "Merged" = done | users find the bugs | watch production |

## Sources
| Source | Link |
|:--|:--|
| Google code review guide | https://google.github.io/eng-practices/review/ |
| Conventional Comments | https://conventionalcomments.org/ |
| Working in small batches (DORA) | https://dora.dev/capabilities/working-in-small-batches/ |
| Technical debt quadrant | https://martinfowler.com/bliki/TechnicalDebtQuadrant.html |
| Design docs at Google | https://www.industrialempathy.com/posts/design-docs-at-google/ |
| git bisect | https://git-scm.com/docs/git-bisect |
| StaffEng guides | https://staffeng.com/guides/ |
