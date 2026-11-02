---
title: Git & GitHub cheatsheet
tech: Git, GitHub
version: Git 2.56, GitHub.com (Nov 2026), gh CLI
date: 2026-11-01
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
---
# Git & GitHub cheatsheet
[← Overview](00-overview.md)

## Daily loop
```bash
git switch main && git pull --ff-only
git switch -c feat/thing
git add -p && git commit -v            # type(scope): subject
git fetch origin && git rebase origin/main
git push                               # upstream set by push.autoSetupRemote
gh pr create --draft --fill
gh pr checks --watch && gh pr ready
gh pr merge --auto --squash --delete-branch
```

## Look around
| Command | Shows |
|:--|:--|
| `git status -sb` | branch, ahead/behind, changes |
| `git diff` / `git diff --staged` | unstaged / staged changes |
| `git log --oneline --graph --decorate --all` | history shape |
| `git log HEAD..@{u}` | commits on the remote you don't have |
| `git log @{u}..HEAD` | commits you haven't pushed |
| `git cat-file -p HEAD` | raw commit: tree, parents, author, message |
| `git show --stat <sha>` | one commit, files changed |
| `git config --show-origin --get <key>` | where a setting comes from |

## Change and stage
| Goal | Command |
|:--|:--|
| Switch / create branch | `git switch <b>` / `git switch -c <b>` |
| Discard file edits | `git restore <file>` |
| Unstage | `git restore --staged <file>` |
| File from another commit | `git restore --source=<sha> <file>` |
| Stage hunks | `git add -p` |
| Park work incl. new files | `git stash push -u -m "msg"` |
| Stop tracking, keep file | `git rm --cached <file>` |

## Rewrite (your own unpushed or PR branch only)
| Goal | Command |
|:--|:--|
| Fix last commit | `git commit --amend` |
| Fix an older commit | `git commit --fixup=<sha>` then `git rebase --autosquash origin/main` |
| Reword an older commit | `git commit --fixup=reword:<sha>` then autosquash |
| Reorder/squash/split/drop | `git rebase -i origin/main` |
| Test every commit | `git rebase -i --exec "node --test" origin/main` |
| Compare before/after rebase | `git range-diff @{u}...HEAD` |
| Push rewritten branch | `git push --force-with-lease --force-if-includes` |

## Undo and recover
| Goal | Command |
|:--|:--|
| Undo commit, keep staged | `git reset --soft HEAD~1` |
| Undo commit, keep files | `git reset HEAD~1` |
| Undo pushed commit (shared) | `git revert <sha>` |
| Undo pushed merge | `git revert -m 1 <sha>` |
| Undo last rebase/reset | `git reset --hard ORIG_HEAD` |
| Find lost commits | `git reflog`, `git reflog show <branch>` |
| Restore a lost branch | `git branch <name> <sha>` |
| Find dropped stashes | `git fsck --unreachable \| grep commit` |
| Abort in-progress op | `git rebase --abort` / `git merge --abort` / `git cherry-pick --abort` |

## Conflicts
- `merge.conflictStyle = zdiff3` shows `||||||| base`. Compare base with each side.
- During a rebase: `--ours` = upstream, `--theirs` = **your** commit.
- `git diff --check` finds leftover markers. Re-run tests before `--continue`.
- `rerere.enabled = true`; `git rerere forget <path>` drops a bad recorded resolution.

## Investigate
| Goal | Command |
|:--|:--|
| Who added a string | `git log -S 'text' --oneline` |
| Diffs matching regex | `git log -G 'regex' --oneline` |
| One function's history | `git log -L :fnName:path/file.ts` |
| Line authorship | `git blame -w -C -C -C -L 10,30 <file>` |
| Skip format commits in blame | `.git-blame-ignore-revs` + `blame.ignoreRevsFile` |
| Find the breaking commit | `git bisect start <bad> <good>` · `git bisect run ./check.sh` · `git bisect reset` |
| Bisect exit codes | `0` good · `1–127` bad · `125` skip · other = abort |

## Tags and releases
```bash
git tag -s v1.2.0 -m "v1.2.0"         # signed, annotated
git push origin v1.2.0
gh release create v1.2.0 --verify-tag --generate-notes --draft
gh release edit v1.2.0 --draft=false
git cherry-pick -x <sha>              # hotfix onto release branch
git describe --tags                   # v1.2.0-14-g3f2a1c9
```
SemVer: `fix` → PATCH · `feat` → MINOR · `!` / `BREAKING CHANGE:` → MAJOR. Never move a pushed tag.

## Signing (SSH)
```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgSign true
git config --global tag.gpgSign true
git config --global gpg.ssh.allowedSignersFile ~/.config/git/allowed_signers
gh ssh-key add ~/.ssh/id_ed25519.pub --type signing
git log --show-signature -1
```

## Repo files
| File | Purpose |
|:--|:--|
| `.gitignore` | `node_modules/`, `dist/`, `.env*`, `!.env.example` |
| `.gitattributes` | `* text=auto eol=lf`, binaries marked `binary` |
| `.githooks/` + `core.hooksPath` | shared hooks (fast feedback, not enforcement) |
| `.github/CODEOWNERS` | required reviewers by path; last match wins |
| `.github/pull_request_template.md` | what/why, how to test, risk/rollback |
| `.github/release.yml` | release note categories by label |
| `.git-blame-ignore-revs` | formatting commits hidden from blame |

## GitHub protection
- Ruleset on `~DEFAULT_BRANCH`: restrict deletions, block force pushes, require PR, require `check`, linear history, signed commits.
- Ruleset on `v*` tags: restrict updates and deletions. Turn on immutable releases.
- Settings: squash only (title + description), auto-merge, delete head branches.
- Merge queue: org-owned public repos (or Enterprise Cloud); CI needs `merge_group`.
- `gh ruleset list` · `gh ruleset view <id>` · `gh ruleset check main`

## Gotchas
- `git stash` skips untracked files. Use `-u`.
- `.gitignore` doesn't untrack files already committed.
- `reset --hard` loses uncommitted work for good (staged files survive as dangling blobs).
- Reflog is local and expires (90 days; 30 for unreachable commits).
- Rebase merge on GitHub drops signatures. Use squash with "require signed commits".
- Leaked secret: **rotate first**, clean history second (if ever).
- In Actions, never put `${{ github.event.* }}` straight into `run:`. Pass it via `env:`.
- WSL2 and Git for Windows have separate configs and SSH keys.
- `git history …` is experimental in 2.56; `rebase -i` is the stable tool.
