---
title: Git & GitHub cheatsheet
tech: Git, GitHub
version: Git 2.56, GitHub.com (Nov 2026), gh CLI
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
---
# Git & GitHub cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Daily loop
| Step | Command | Note |
|:--|:--|:--|
| ⭐ Start from fresh main | `git switch main && git pull --ff-only` | `--ff-only` refuses surprise merges |
| ⭐ New branch | `git switch -c feat/thing` | short-lived: hours to 2 days |
| ⭐ Stage hunks | `git add -p` | review every hunk before it goes in |
| ⭐ Commit with diff in editor | `git commit -v` | message: `type(scope): subject` |
| ⭐ Catch up with main | `git fetch origin && git rebase origin/main` | daily, on your own branch only |
| Push (first time too) | `git push` | needs `push.autoSetupRemote = true` |
| Open draft PR | `gh pr create --draft --fill` | `--fill` uses commit messages |
| Watch CI | `gh pr checks --watch` | exits non-zero if a check fails |
| Mark ready | `gh pr ready` | requests reviews from CODEOWNERS |
| Merge when green | `gh pr merge --auto --squash --delete-branch` | needs auto-merge enabled on repo |

## Object model
| Thing | What it is | Look at it |
|:--|:--|:--|
| ⭐ blob | file content, named by hash | `git cat-file -p <sha>` |
| ⭐ tree | directory listing: names → blobs/trees | `git cat-file -p HEAD^{tree}` |
| ⭐ commit | tree + parents + author + message | `git cat-file -p HEAD` |
| annotated tag | object with tagger, message, signature | `git cat-file -p v1.2.0` |
| ⭐ ref | file pointing at a commit (`refs/heads/main`) | `git show-ref` |
| ⭐ HEAD | the current branch (or commit when detached) | `git symbolic-ref HEAD` |
| detached HEAD | HEAD points at a commit, not a branch | `git switch -c <name>` to keep work |
| index | staging area: the next commit's tree | `git ls-files -s` |
| reflog | local log of where refs pointed | `git reflog` |
| packfiles | compressed objects; `gc` builds them | `git count-objects -vH` |
| Hash a file | object name without storing | `git hash-object <file>` |
| Object type | blob/tree/commit/tag | `git cat-file -t <sha>` |

## Look around
| Command | Shows |
|:--|:--|
| ⭐ `git status -sb` | branch, ahead/behind, changes |
| ⭐ `git diff` / `git diff --staged` | unstaged / staged changes |
| `git diff main...HEAD` | what your branch changed since it forked |
| `git diff --stat` / `--name-only` | summary of changed files |
| `git diff --word-diff` | word-level changes (prose, config) |
| ⭐ `git log --oneline --graph --decorate --all` | history shape |
| `git log HEAD..@{u}` | commits on the remote you don't have |
| `git log @{u}..HEAD` | commits you haven't pushed |
| `git log --author=<name> --since=2.weeks` | filter by author and date |
| `git log --first-parent main` | main's history, one entry per merge/PR |
| `git log -p -- <path>` | patches touching a path |
| `git show --stat <sha>` | one commit, files changed |
| `git show <sha>:<path>` | a file at a commit |
| `git shortlog -sn` | commit counts per author |
| `git branch -vv` | branches with upstream and ahead/behind |
| `git branch --merged main` | branches safe to delete |
| `git config --show-origin --get <key>` | where a setting comes from |
| `git ls-files --eol` | line endings in index vs working tree |

## Change and stage
| Goal | Command |
|:--|:--|
| ⭐ Switch / create branch | `git switch <b>` / `git switch -c <b>` |
| Switch to previous branch | `git switch -` |
| ⭐ Discard file edits | `git restore <file>` |
| ⭐ Unstage | `git restore --staged <file>` |
| File from another commit | `git restore --source=<sha> <file>` |
| Stage hunks / split a hunk | `git add -p` then `s` (split), `e` (edit) |
| Stage everything incl. deletions | `git add -A` |
| ⭐ Park work incl. new files | `git stash push -u -m "msg"` |
| List / apply / drop stash | `git stash list` · `git stash pop` · `git stash drop` |
| Stash only some files | `git stash push -- <path>` |
| Stop tracking, keep file | `git rm --cached <file>` |
| Rename with history | `git mv old new` |
| Remove untracked files (preview) | `git clean -nd` then `git clean -fd` |
| Second working tree | `git worktree add ../hotfix main` |
| Partial clone for big repos | `git clone --filter=blob:none <url>` |
| Only some folders | `git sparse-checkout set <dir>` |

## Commit messages (Conventional Commits)
| Type | Use for | SemVer effect |
|:--|:--|:--|
| ⭐ `feat` | new user-facing behavior | MINOR |
| ⭐ `fix` | bug fix | PATCH |
| `docs` | documentation only | none |
| `refactor` | code change, same behavior | none |
| `perf` | faster, same behavior | PATCH |
| `test` | tests only | none |
| `build` / `ci` | build system / CI config | none |
| `chore` | maintenance, deps | none |
| `revert` | undo an earlier commit | depends |
| ⭐ `feat!:` or `BREAKING CHANGE:` footer | incompatible change | MAJOR |
| Scope | `feat(api): …` area of the code | optional |
| Subject rules | imperative, ≤ 72 chars, no full stop | "add", not "added" |
| Body | why, not how; wrap at 72 | optional |
| Footers | `Refs: #123`, `Co-authored-by:` | trailers |

## Setup and config
| Key or file | Purpose |
|:--|:--|
| ⭐ `user.name`, `user.email` | identity; use GitHub no-reply email |
| ⭐ `init.defaultBranch = main` | new repos start on main |
| `pull.rebase = true` | pull rebases instead of merging |
| `push.autoSetupRemote = true` | first push sets upstream |
| `push.useForceIfIncludes = true` | safer force-with-lease |
| `fetch.prune = true` | delete stale remote branches on fetch |
| ⭐ `merge.conflictStyle = zdiff3` | show base in conflicts |
| `rerere.enabled = true` | reuse recorded conflict resolutions |
| `rebase.autoSquash = true` | apply `fixup!` commits automatically |
| `rebase.updateRefs = true` | move stacked branches during rebase |
| `diff.algorithm = histogram` | more readable diffs |
| `core.excludesFile` | global ignore file (OS, editor junk) |
| `core.hooksPath = .githooks` | shared, versioned hooks |
| `core.autocrlf` | leave unset on WSL2; use `.gitattributes` |
| `[includeIf "gitdir:~/work/"]` | per-folder identity and signing key |
| `git config --global --edit` | open global config in editor |
| `git maintenance start` | background gc, prefetch, commit-graph |

## Repo files
| File | Purpose |
|:--|:--|
| ⭐ `.gitignore` | `node_modules/`, `dist/`, `.env*`, `!.env.example` |
| `.git/info/exclude` | personal ignores, not committed |
| ⭐ `.gitattributes` | `* text=auto eol=lf`, binaries marked `binary` |
| `.githooks/` + `core.hooksPath` | shared hooks (fast feedback, not enforcement) |
| ⭐ `.github/CODEOWNERS` | required reviewers by path; last match wins |
| `.github/pull_request_template.md` | what/why, how to test, risk/rollback |
| `.github/ISSUE_TEMPLATE/*.yml` | issue forms |
| `.github/release.yml` | release note categories by label |
| `.github/dependabot.yml` | dependency update PRs |
| `.git-blame-ignore-revs` | formatting commits hidden from blame |
| `.mailmap` | merge author identities in log/shortlog |
| `git check-ignore -v <path>` | which rule ignores a file |
| `git check-attr -a <path>` | which attributes apply |
| `git add --renormalize .` | re-apply `.gitattributes` to tracked files |

## Hooks
| Hook | Runs | Typical use |
|:--|:--|:--|
| `pre-commit` | before commit is created | block secrets, big files, run fast lint |
| ⭐ `commit-msg` | after message is written | enforce Conventional Commits |
| `prepare-commit-msg` | before editor opens | add ticket id from branch name |
| `pre-push` | before push | run fast tests |
| `post-checkout` / `post-merge` | after switch / pull | reinstall deps if lockfile changed |
| Skip hooks once | `git commit --no-verify` | why hooks are not enforcement; CI is |

## Branching and integrating
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Trunk-based development | main always releasable; short branches | integrate daily |
| Feature flags | merge unfinished work turned off | replaces long branches |
| ⭐ Merge commit | keeps topology; `M` has 2 parents | revert with `-m 1` |
| ⭐ Rebase | replays commits as new ones | linear; rewrite = new hashes |
| ⭐ Squash merge | whole PR becomes one commit | default for small PRs |
| Fast-forward | move ref forward, no new commit | `git merge --ff-only` |
| ⭐ Golden rule | never rewrite shared history | revert on main instead |
| `git cherry-pick -x <sha>` | copy a commit, record origin | hotfix onto release branch |
| `git merge-base A B` | common ancestor | what rebase replays from |
| `git rebase --onto new old` | move a branch to a new base | split stacked branches |
| GitFlow | long-lived develop + release branches | also seen; versioned apps |

## Conflicts
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `zdiff3` markers | `<<<<<<<` ours, `\|\|\|\|\|\|\|` base, `=======`, `>>>>>>>` theirs | compare base with each side |
| ⭐ Rebase sides flip | `--ours` = upstream, `--theirs` = your commit | merge: ours = current branch |
| `git restore --ours/--theirs <f>` | take one side for a file | rarely right for whole files |
| `git diff --check` | finds leftover markers and whitespace | run before `--continue` |
| `git rerere status` / `diff` | recorded resolutions | `git rerere forget <path>` drops one |
| `git mergetool` | open configured merge tool | VS Code works well |
| `git log --merge -p` | commits touching the conflicted files | context for a conflict |
| `git rebase --continue` / `--skip` / `--abort` | continue, drop commit, or bail out | same for merge, cherry-pick |

## Rewrite (your own unpushed or PR branch only)
| Goal | Command |
|:--|:--|
| ⭐ Fix last commit | `git commit --amend` |
| Amend without editing message | `git commit --amend --no-edit` |
| ⭐ Fix an older commit | `git commit --fixup=<sha>` then `git rebase --autosquash origin/main` |
| Reword an older commit | `git commit --fixup=reword:<sha>` then autosquash |
| ⭐ Reorder/squash/split/drop | `git rebase -i origin/main` |
| Test every commit | `git rebase -i --exec "node --test" origin/main` |
| Compare before/after rebase | `git range-diff @{u}...HEAD` |
| ⭐ Push rewritten branch | `git push --force-with-lease --force-if-includes` |
| Change author of last commit | `git commit --amend --reset-author` |
| Purge a file from all history | `git filter-repo --path <file> --invert-paths` |
| `git history` (fixup/reword/split) | experimental in 2.54–2.56; use `rebase -i` |

## Undo and recover
| Goal | Command |
|:--|:--|
| ⭐ Undo commit, keep staged | `git reset --soft HEAD~1` |
| ⭐ Undo commit, keep files | `git reset HEAD~1` |
| Undo commit and changes | `git reset --hard HEAD~1` (uncommitted work is lost) |
| ⭐ Undo pushed commit (shared) | `git revert <sha>` |
| Undo pushed merge | `git revert -m 1 <sha>` |
| Undo last rebase/reset/merge | `git reset --hard ORIG_HEAD` |
| ⭐ Find lost commits | `git reflog`, `git reflog show <branch>` |
| Restore a lost branch | `git branch <name> <sha>` |
| Find dropped stashes | `git fsck --unreachable \| grep commit` |
| Abort in-progress op | `git rebase --abort` / `git merge --abort` / `git cherry-pick --abort` |
| Recover deleted file | `git restore --source=<sha>~1 <file>` |
| Undo `git add` of everything | `git restore --staged .` |

## Investigate
| Goal | Command |
|:--|:--|
| ⭐ Who added a string | `git log -S 'text' --oneline` |
| Diffs matching regex | `git log -G 'regex' --oneline` |
| One function's history | `git log -L :fnName:path/file.ts` |
| Follow a renamed file | `git log --follow -- <file>` |
| ⭐ Line authorship | `git blame -w -C -C -C -L 10,30 <file>` |
| Skip format commits in blame | `.git-blame-ignore-revs` + `blame.ignoreRevsFile` |
| ⭐ Find the breaking commit | `git bisect start <bad> <good>` · `git bisect run ./check.sh` · `git bisect reset` |
| Bisect exit codes | `0` good · `1–127` bad · `125` skip · other = abort |
| Which tag contains a commit | `git tag --contains <sha>` |
| Nearest tag | `git describe --tags` → `v1.2.0-14-g3f2a1c9` |
| Search tracked files | `git grep -n 'text' <rev>` |

## Pull requests and reviews
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Small PRs | under ~400 changed lines | review quality drops after that |
| ⭐ PR description | what, why, how to test, risk, rollback | template enforces it |
| Draft PR | visible early, not ready for review | `gh pr create --draft` |
| ⭐ CODEOWNERS | auto-request owners; "require code owner review" | `* @org/team`, last match wins |
| Suggested changes | reviewer proposes exact code | author clicks commit |
| Stacked PRs | chain of small dependent PRs | `rebase.updateRefs` helps |
| `gh pr checkout <n>` | check out someone's PR locally | test it for real |
| `gh pr diff` / `gh pr view --web` | read PR in terminal / browser | |
| `gh pr review --approve` | approve from terminal | `--request-changes -b "…"` |
| Closing keywords | `Fixes #12` in description | closes issue on merge |

## GitHub protection
| Setting | What it does | Note |
|:--|:--|:--|
| ⭐ Ruleset on `~DEFAULT_BRANCH` | rules for main by name pattern | replaces classic branch protection |
| ⭐ Require pull request | no direct pushes | 1+ approvals, dismiss stale |
| ⭐ Require status checks | named CI jobs must pass | e.g. `check` |
| ⭐ Block force pushes / restrict deletions | protect history | |
| Require linear history | no merge commits on main | pairs with squash merge |
| Require signed commits | verified badge required | squash keeps signatures; rebase merge drops them |
| Merge queue | tests PRs combined before merging | CI needs `merge_group` trigger |
| Ruleset on `v*` tags | restrict tag updates and deletions | plus immutable releases |
| Squash only + auto-merge + delete head branches | repo settings | |
| Bypass list | who may skip rules | keep tiny; audit it |
| `gh ruleset list` · `view <id>` · `check main` | inspect rules from CLI | |

## Secrets
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Rotate first | revoke and replace the leaked secret | history cleanup is second |
| ⭐ Push protection | GitHub blocks pushes containing known secrets | on by default for public repos |
| Secret scanning alerts | finds secrets already in history | Settings → Security |
| `.env.example` | documents variables, no values | real `.env` ignored |
| gitleaks | local/CI secret scanner | pre-commit or CI step |
| `git filter-repo` | rewrite history to remove a file | then force-push, everyone re-clones |
| GitHub Actions secrets | encrypted, masked in logs | prefer OIDC over long-lived keys |

## Signing (SSH)
| Step | Command |
|:--|:--|
| ⭐ Use SSH format | `git config --global gpg.format ssh` |
| ⭐ Signing key | `git config --global user.signingkey ~/.ssh/id_ed25519.pub` |
| ⭐ Sign all commits | `git config --global commit.gpgSign true` |
| Sign all tags | `git config --global tag.gpgSign true` |
| Local verification file | `git config --global gpg.ssh.allowedSignersFile ~/.config/git/allowed_signers` |
| Upload as signing key | `gh ssh-key add ~/.ssh/id_ed25519.pub --type signing` |
| Check a signature | `git log --show-signature -1` · `git verify-commit HEAD` · `git verify-tag v1.2.0` |
| Vigilant mode (profile setting) | GitHub marks your unsigned commits "Unverified" |

## Tags and releases
| Goal | Command or rule |
|:--|:--|
| ⭐ Signed annotated tag | `git tag -s v1.2.0 -m "v1.2.0"` |
| Push one tag | `git push origin v1.2.0` |
| ⭐ Draft release with notes | `gh release create v1.2.0 --verify-tag --generate-notes --draft` |
| Publish draft | `gh release edit v1.2.0 --draft=false` |
| List tags by version | `git tag --sort=-v:refname` |
| Delete local / remote tag | `git tag -d v1` · `git push origin :refs/tags/v1` (never for published) |
| ⭐ SemVer | MAJOR.MINOR.PATCH: breaking.feature.fix |
| Pre-release | `v2.0.0-rc.1` sorts before `v2.0.0` |
| ⭐ Never move a pushed tag | make a new version instead |
| Immutable releases | GitHub setting; assets and tag locked after publish |

## Numbers worth remembering
| Number | Meaning |
|:--|:--|
| 72 | max subject line length |
| 90 / 30 days | reflog expiry for reachable / unreachable entries |
| ~400 lines | PR size where review quality falls |
| 100 MB | GitHub hard file size limit (warn at 50 MB) |
| 2 days | max healthy branch age in trunk-based dev |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `git stash` skips untracked files | new files left behind | `git stash -u` |
| `.gitignore` doesn't untrack committed files | file keeps showing up | `git rm --cached <file>` |
| `reset --hard` loses uncommitted work | not in reflog | stash or commit first |
| Reflog is local and expires | can't recover on another machine | push branches you care about |
| Rebase merge drops signatures on GitHub | fails "require signed commits" | squash merge |
| Leaked secret cleaned from history only | already copied by bots | rotate first |
| `${{ github.event.* }}` inside `run:` | script injection in Actions | pass via `env:` |
| WSL2 vs Git for Windows | separate configs and SSH keys | pick one per repo |
| `git pull` with diverged branches | unexpected merge commits | `pull.rebase = true` or `--ff-only` |
| CRLF in shell scripts | `bad interpreter` errors in containers | `.gitattributes` `eol=lf` |
| `git checkout` does two jobs | easy to lose files | `switch` + `restore` |

## Sources
| Source | Link |
|:--|:--|
| Git reference | https://git-scm.com/docs |
| Pro Git book | https://git-scm.com/book/en/v2 |
| Conventional Commits | https://www.conventionalcommits.org/en/v1.0.0/ |
| Semantic Versioning | https://semver.org/ |
| GitHub rulesets | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets |
| GitHub CLI manual | https://cli.github.com/manual/ |
| Secret scanning | https://docs.github.com/en/code-security/secret-scanning |
