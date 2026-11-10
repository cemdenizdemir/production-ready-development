---
title: Engineering Practice cheatsheet
tech: Git, GitHub, GitHub Copilot
version: Git 2.5x, GitHub (November 2026), GitHub Copilot (agent mode, coding agent, code review)
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Engineering Practice cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Small batches
| Practice | How | Note |
|:--|:--|:--|
| ⭐ vertical slices | thin end-to-end changes | deployable |
| ⭐ small PRs | < 400 lines, one purpose | |
| ⭐ merge daily | short-lived branches | trunk-based |
| ⭐ flags for unfinished work | off in prod | 04-deployments |
| prepare PRs | refactor first, feature second | |
| stacked PRs | dependent small PRs | |
| merge queue | green `main` | GitHub |

## Git and gh commands
| Command | Does | Note |
|:--|:--|:--|
| `git switch -c feat/x` | new branch | |
| `git commit --fixup <sha>` + `git rebase --autosquash` | tidy history | before review |
| ⭐ `git bisect start/good/bad/run` | find bad commit | binary search |
| `git log -S "text"` | find when code changed | pickaxe |
| `git blame -w -C` | who/why, ignoring moves | context, not blame |
| `gh pr create --fill --draft` | open draft PR | |
| `gh pr checkout 123` | run a PR locally | review |
| `gh pr review --approve -b "..."` | review from terminal | |
| `gh pr merge --squash --auto` | merge when green | |

## Tickets
| Part | Content | Note |
|:--|:--|:--|
| ⭐ problem / why | user/business need | not the solution |
| ⭐ acceptance criteria | testable statements | Given/When/Then |
| ⭐ out of scope | explicit exclusions | |
| constraints | links, perf, security | |
| ⭐ definition of done | team-wide | includes production |
| spike | time-boxed investigation | output = knowledge |
| size | 1–3 days | deployable |
| issue forms | `.github/ISSUE_TEMPLATE/*.yml` | |

## Estimation
| Practice | How | Note |
|:--|:--|:--|
| ⭐ ranges | "3–6 days" | |
| ⭐ named unknowns | assumptions listed | |
| milestones | demo every 1–2 weeks | |
| ⭐ scope negotiation | fixed date → flex scope | |
| re-estimate early | bad news early | |
| actuals vs estimates | calibrate | |

## Reviewing
| Priority | Check | Note |
|:--|:--|:--|
| ⭐ 1 | correctness, security (authz, validation, secrets, PII) | |
| ⭐ 2 | production behaviour (failures, migrations, observability) | |
| 3 | design, boundaries | |
| 4 | tests | behaviour, edges |
| 5 | readability | |
| 6 | style | tools handle it |
| ⭐ turnaround | hours, not days | before new work |
| ask to split | huge PRs | |

## Comment labels
| Label | Means | Blocking? |
|:--|:--|:--|
| ⭐ `issue:` | a problem to fix | yes |
| `suggestion:` | proposed improvement | say so |
| `question:` | need understanding | maybe |
| `nitpick:` | tiny, optional | no |
| `praise:` | good work | no |
| `thought:` | idea for later | no |
| GitHub suggestions | one-click change | |

## Authoring PRs
| Practice | How | Note |
|:--|:--|:--|
| ⭐ self-review | read the diff first | |
| ⭐ description | what/why, test, risk, rollout | PR template |
| guide reviewers | comment subtle parts | |
| green checks | before requesting | |
| ⭐ answer every comment | done / reasons | |
| no mid-review force push | reviewers see deltas | squash at merge |

## GitHub collaboration
| Feature | Does | Note |
|:--|:--|:--|
| CODEOWNERS | auto reviewers | per path |
| ⭐ rulesets | required reviews, checks | replaces classic protection |
| draft PRs | early feedback | |
| PR template | `.github/pull_request_template.md` | |
| Projects | planning boards | |
| Copilot code review | first-pass comments | human still reviews |

## Technical debt
| Practice | How | Note |
|:--|:--|:--|
| ⭐ visible | label + cost + fix | |
| ⭐ in the flow | boy-scout rule, 10–20% | |
| hotspots | churn × complexity | |
| characterisation tests | lock behaviour first | before refactor |
| IDE refactorings | rename, extract | safe steps |
| strangler fig | gradual replacement | |
| deliberate debt | ticket + date | |

## Design docs
| Section | Content | Note |
|:--|:--|:--|
| ⭐ context, problem | why now | |
| ⭐ goals / non-goals | success | |
| ⭐ proposal | design, rollout | diagrams |
| ⭐ alternatives | why not | |
| risks, open questions | decisions needed | |
| operations | monitoring, security, cost | |
| when | > 2 weeks, irreversible, cross-team | |
| ADR | record the decision | short |

## Communication
| Habit | How | Note |
|:--|:--|:--|
| ⭐ BLUF | conclusion first | |
| ⭐ escalate early | risk + options + ask + deadline | |
| ⭐ async updates | done, next, blocked | written |
| ⭐ good questions | goal, tried, happened, expected, repro | |
| written decisions | summary after calls | owners |
| right channel | incident / doc / thread | |

## Debugging
| Step | How | Note |
|:--|:--|:--|
| ⭐ reproduce | failing test or script | |
| ⭐ observe | errors, logs, traces | trace ID |
| ⭐ one hypothesis | falsifiable | |
| ⭐ narrow | bisect, halve code/data | |
| one change | then observe | |
| fix + regression test | keep the test | |
| conditional breakpoints, tracepoints | debugger | VS / VS Code |
| `dotnet test --filter "FullyQualifiedName~X"` | focused runs | |
| `dotnet-dump` / `dotnet-trace` | running processes | |

## AI coding assistants
| Rule | How | Note |
|:--|:--|:--|
| ⭐ you own it | review every line | |
| ⭐ verify | run, test, edge cases | |
| ⭐ security | injection, authz, secrets, PII | |
| ⭐ APIs exist | check versions | hallucinations |
| ⭐ data policy | approved tools, no secrets/customer data | |
| public code filter | licence safety | code referencing |
| custom instructions | `.github/copilot-instructions.md` | stack rules |
| path instructions | `.github/instructions/*.instructions.md` | `applyTo` |
| agent mode / coding agent | multi-file / issue → PR | same review |
| MCP servers | tools for agents | least privilege |

## Ownership
| Practice | How | Note |
|:--|:--|:--|
| ⭐ done = in production | deployed, flag set, watched | |
| ⭐ watch deploys | 15–30 min dashboards | |
| ⭐ readiness checklist | observability, failure, security, data, capacity, rollout | |
| follow through | close the loop | |
| on-call empathy | alerts, runbooks, fallbacks | |

## Growing to senior
| Dimension | Senior looks like | Note |
|:--|:--|:--|
| ⭐ scope | owns ambiguous problems | |
| ⭐ impact | team outcomes | evidence |
| judgment | trade-offs, simplicity | |
| ⭐ influence | reviews, docs, standards | |
| ⭐ mentoring | multiplies others | |
| brag document | impact log with links | reviews |
| specific feedback | ask precise questions | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| long-lived branches | big risky merges | daily merges + flags |
| solution-only tickets | wrong thing built | problem + criteria |
| single-number estimates | hidden uncertainty | ranges + unknowns |
| slow reviews | queueing | review first |
| style-only reviews | real bugs missed | priorities |
| "fixes" descriptions | rubber-stamp approvals | full description |
| "refactoring sprint" asks | never approved | cost + plan |
| late escalation | surprises | early, with options |
| shotgun debugging | new bugs | one change at a time |
| unreviewed AI code | security holes | review + tests |
| Done at merge | features never on | production DoD |

## Sources
| Source | Link |
|:--|:--|
| Google code review guide | https://google.github.io/eng-practices/review/ |
| Conventional Comments | https://conventionalcomments.org/ |
| DORA small batches | https://dora.dev/capabilities/working-in-small-batches/ |
| git bisect | https://git-scm.com/docs/git-bisect |
| Copilot custom instructions | https://docs.github.com/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot |
| Copilot coding agent | https://docs.github.com/copilot/using-github-copilot/coding-agent/about-assigning-tasks-to-copilot |
| Design docs at Google | https://www.industrialempathy.com/posts/design-docs-at-google/ |
| StaffEng guides | https://staffeng.com/guides/ |
| Brag documents | https://jvns.ca/blog/brag-documents/ |
