---
title: Git & Collaboration cheatsheet
tech: Git, GitHub
version: Git 2.56, GitHub.com (Nov 2026), .NET 10 SDK
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
---
# Git & Collaboration cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Objects and refs
| Item | What it is | Example / note |
|:--|:--|:--|
| blob | file contents | named by SHA of contents |
| tree | directory listing | names → blobs/trees |
| ⭐ commit | snapshot + parents + metadata | `git cat-file -p HEAD` |
| annotated tag | named, signed pointer to a commit | `git tag -s v1.4.0` |
| ⭐ `HEAD` | current branch (or commit) | detached when pointing at a commit |
| `refs/remotes/origin/*` | last known remote state | updated by `fetch` |
| `git rev-parse <ref>` | resolve a name to a SHA | `git rev-parse main` |
| `HEAD~2` / `HEAD^2` | 2nd ancestor / 2nd parent of a merge | |
| `A..B` | commits in B not in A | `git log origin/main..HEAD` |

## Everyday commands
| Command | What it does | Note |
|:--|:--|:--|
| ⭐ `git switch -c feat/x` | create and switch branch | replaces `checkout -b` |
| `git switch -` | previous branch | |
| ⭐ `git restore file` | discard working-tree edits | |
| `git restore --staged file` | unstage | |
| ⭐ `git add -p` | stage hunk by hunk | review as you stage |
| ⭐ `git diff --staged` | what will be committed | |
| `git stash push -u -m msg` | park work incl. untracked files | |
| `git stash list` / `pop` / `apply` | manage stashes | |
| `git commit --amend --no-edit` | add to last commit | only if unpushed |
| `git log --oneline --graph --all` | history graph | |
| `git show <sha>` | one commit's diff | |
| `git clean -fdx -n` | preview removing untracked files | drop `-n` to do it |

## Commit messages (Conventional Commits)
| Type | Means | Version bump |
|:--|:--|:--|
| ⭐ `feat` | new behavior | minor |
| ⭐ `fix` | bug fix | patch |
| `refactor` / `perf` | internal change | none |
| `test` / `docs` / `build` / `ci` / `chore` | non-product | none |
| `feat!` / `BREAKING CHANGE:` | breaking | major |
| scope | area in parentheses | `feat(orders): …` |
| subject | imperative, ≤ 72 chars | "add", not "added" |

## Global config worth setting
| Key | Value | Why |
|:--|:--|:--|
| `init.defaultBranch` | `main` | |
| `pull.rebase` | `true` | no merge bubbles on pull |
| `push.autoSetupRemote` | `true` | first push sets upstream |
| ⭐ `merge.conflictStyle` | `zdiff3` | shows the base in conflicts |
| `rerere.enabled` | `true` | reuse conflict resolutions |
| `rebase.updateRefs` | `true` | stacked branches follow |
| `rebase.autoSquash` | `true` | apply fixups automatically |
| `fetch.prune` | `true` | drop deleted remote branches |
| `core.autocrlf` | `input` (WSL/Linux) | repo `.gitattributes` wins anyway |
| `core.hooksPath` | `.githooks` | versioned hooks |

## .NET repo files
| File | Purpose | Create with |
|:--|:--|:--|
| ⭐ `.gitignore` | ignore `bin/`, `obj/`, `.vs/`, `*.user`, `TestResults/` | `dotnet new gitignore` |
| ⭐ `.gitattributes` | line endings, `diff=csharp` | by hand |
| `.editorconfig` | code style + analyzer severities | `dotnet new editorconfig` |
| `global.json` | pin SDK version | `dotnet new globaljson` |
| `Directory.Build.props` | shared MSBuild settings | by hand |
| `Directory.Packages.props` | central package versions | `dotnet new packagesprops` |
| `Shop.slnx` | XML solution file | `dotnet new sln` (.NET 10 default) |
| `.git-blame-ignore-revs` | commits blame should skip | list of SHAs |
| `.github/CODEOWNERS` | required reviewers by path | |
| `.github/pull_request_template.md` | PR checklist | |

## .gitattributes
| Line | Effect |
|:--|:--|
| ⭐ `* text=auto eol=lf` | normalize text, LF in working tree |
| `*.cs text diff=csharp` | method names in diff hunks |
| `*.ps1 text eol=crlf` | Windows scripts stay CRLF |
| `*.png binary` | no diff, no EOL conversion |
| `git add --renormalize .` | apply new rules to tracked files |

## Branching and integration
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Trunk-based | short branches, main releasable | flags for unfinished work |
| GitFlow | develop + release branches | for multi-version products |
| ⭐ Squash and merge | one commit per PR | easy revert |
| Rebase and merge | linear, keeps commits | needs atomic commits |
| Merge commit | keeps branch shape | |
| ⭐ `git rebase origin/main` | replay your branch on main | own branches only |
| ⭐ `git push --force-with-lease --force-if-includes` | safe force push | never plain `--force` |
| `git merge --no-ff` | always create merge commit | |
| `git branch --delete-merged` | delete merged local branches | Git 2.56+ |

## Conflicts
| Command | What it does | Note |
|:--|:--|:--|
| `git status` | list unmerged paths | |
| `git checkout --ours file` / `--theirs` | take one side | meaning flips during rebase |
| ⭐ `git add --resolved` | stage resolved files, refuse markers | Git 2.56+ |
| `git rebase --continue` / `--abort` | continue or bail | |
| `git merge --abort` | undo merge attempt | |
| `git rerere diff` | show recorded resolution | |
| `git mergetool` | external merge tool | VS Code works |
| EF Core snapshot conflict | take main's, re-add your migration | `dotnet ef migrations remove` / `add` |
| `packages.lock.json` conflict | take one, regenerate | `dotnet restore --force-evaluate` |

## Rewriting your own branch
| Command | What it does | Note |
|:--|:--|:--|
| ⭐ `git commit --fixup=<sha>` | mark a fix for an older commit | |
| ⭐ `git rebase -i --autosquash origin/main` | fold fixups, reorder, reword | |
| `git rebase --onto new old branch` | move a branch's base | |
| `git history reword <sha>` | reword one commit | experimental, 2.54+ |
| `git history fixup` / `split` / `drop` | targeted edits | experimental, 2.55–2.56 |
| `git branch backup/x` | backup before rewriting | |

## Undo and recovery
| Command | Effect | Note |
|:--|:--|:--|
| ⭐ `git revert <sha>` | new commit undoing a commit | safe on shared branches |
| `git reset --soft HEAD~1` | uncommit, keep staged | |
| `git reset HEAD~1` | uncommit, keep unstaged | |
| `git reset --hard <ref>` | move branch, wipe changes | local only |
| ⭐ `git reflog` | history of HEAD moves | ~90 days |
| `git reset --hard HEAD@{1}` | go back one reflog step | |
| `git fsck --lost-found` | find dangling commits | lost stashes |
| `git revert -m 1 <merge-sha>` | revert a merge commit | |

## Investigating history
| Command | Answers | Note |
|:--|:--|:--|
| ⭐ `git log -S 'text'` | when a string was added/removed | "pickaxe" |
| `git log -G 'regex'` | when matching lines changed | |
| `git log -L :Method:file.cs` | history of one function | uses `diff=csharp` |
| ⭐ `git blame -w -C file` | who changed each line | ignore whitespace, follow moves |
| `--ignore-revs-file .git-blame-ignore-revs` | skip formatting commits | |
| ⭐ `git bisect start/bad/good` | binary search for a bad commit | |
| `git bisect run ./check.sh` | automate bisect | exit 125 = skip |
| `git log --author=… --since=…` | filter history | |

## Pull requests and review
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Small PR (≤ ~400 lines) | reviewable | split by layer or slice |
| Draft PR | early feedback | |
| PR template | consistent descriptions | `.github/pull_request_template.md` |
| `Closes #142` | auto-close issue | |
| ⭐ CODEOWNERS | path → required reviewers | `/src/**/Migrations/ @org/data` |
| `gh pr create --fill` | open PR from CLI | |
| `gh pr checkout 123` | review locally | |
| `gh pr merge --squash --auto` | merge when checks pass | |

## Protecting main
| Rule | Why | Note |
|:--|:--|:--|
| ⭐ Require PR + approvals | no direct pushes | dismiss stale approvals |
| ⭐ Required status checks | build/test must pass | `dotnet test`, format, CodeQL |
| Code owner review | domain experts approve | |
| Block force push / deletion | protect history | |
| Linear history | clean `main` | with squash/rebase |
| ⭐ Merge queue | test combined PRs | avoids "green PR, red main" |
| Bypass list | release bots, admins | keep tiny |
| Evaluate mode | try a ruleset without enforcing | |

## Signing, tags, and releases
| Item | What it does | Note |
|:--|:--|:--|
| `gpg.format ssh` | sign with SSH key | |
| `commit.gpgsign true` | sign every commit | |
| ⭐ `git tag -s v1.4.0` | signed annotated tag | tags are immutable |
| `git push origin v1.4.0` | publish tag | |
| ⭐ `gh release create v1.4.0 --generate-notes` | GitHub release | |
| SemVer | MAJOR.MINOR.PATCH | `-rc.1` prereleases |
| ⭐ `-p:Version=1.4.0` | set .NET version at build | from the tag in CI |
| `-p:SourceRevisionId=<sha>` | sha in informational version | `1.4.0+a1b2c3d` |
| MinVer / Nerdbank.GitVersioning | version from tags | also seen |

## Secrets
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `dotnet user-secrets set K V` | local secrets outside the repo | per project |
| `.env` + `.env.example` | Compose / frontend values | ignore `.env` |
| ⭐ `gitleaks git --staged` | scan staged changes | pre-commit |
| GitHub push protection | blocks pushes with known secret patterns | enable it |
| ⭐ Rotate first | revoke at the provider | then clean history |
| `git filter-repo --replace-text` | scrub history | everyone re-clones |
| `git check-ignore -v file` | which rule ignores a file | |
| `git rm --cached` | stop tracking but keep the file | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Committed `bin/` / `obj/` | huge repo, conflicts | ignore + `git rm -r --cached` |
| CRLF churn | whole-file diffs | `.gitattributes` + renormalize |
| `--ours`/`--theirs` in rebase | sides are swapped | read the markers |
| Hand-merged EF snapshot | broken migrations | regenerate |
| `git push --force` | overwrites others' work | `--force-with-lease --force-if-includes` |
| Deleting a leaked secret commit | still in clones/forks | rotate the key |
| Secrets in `appsettings.Development.json` | committed by accident | user-secrets |
| Moving tags | consumers see two meanings | new version |

## Sources
| Source | Link |
|:--|:--|
| Git docs | https://git-scm.com/docs |
| Pro Git | https://git-scm.com/book/en/v2 |
| Git 2.56 highlights | https://github.blog/open-source/git/highlights-from-git-2-56/ |
| Conventional Commits | https://www.conventionalcommits.org/en/v1.0.0/ |
| GitHub rulesets | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets |
| GitHub CODEOWNERS | https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners |
| ASP.NET Core app secrets | https://learn.microsoft.com/aspnet/core/security/app-secrets |
| gitleaks | https://github.com/gitleaks/gitleaks |
| SemVer | https://semver.org/ |
