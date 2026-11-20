---
title: Git & Collaboration
stack: typescript
topic: 01-foundations/01-git
date: 2026-11-18
lessons: [01, 02]
count: 30
---
# Cards · typescript · 01-foundations/01-git

## 01 · Objects, commits, and everyday commands

### typescript-01-git-01-001 ⭐
Q: During an incident you must revert one change, but it sits in a 900-line "fix stuff" commit with three other changes. Which habit would have prevented this?
A: Atomic commits: one logical change per commit that builds and passes tests.
Why: Then `git revert <sha>` removes exactly one change.

### typescript-01-git-01-002 ⭐
Q: Which Git object type holds a file's contents, but not its name or mode?
A: A blob.
Why: The name and mode live in the tree that lists the blob.

### typescript-01-git-01-003 ⭐
Q: Which Git object type holds a directory listing of names, modes, and blob/tree hashes?
A: A tree.

### typescript-01-git-01-004 ⭐
Q: You edit a comment in `src/a.ts` and amend the last commit. Which objects get new hashes?
A: The `a.ts` blob, the `src/` and root trees, and the commit.
Why: Each hash covers the hashes below it. The old commit still exists in the object store and reflog.

### typescript-01-git-01-005 ⭐
Q: A teammate panics after a bad rebase: "my commits were rewritten". What actually happened to the original commits?
A: Nothing. They still exist unchanged and are reachable through the reflog.
Why: A commit's hash covers its tree and parents, so a rebase writes new commits instead of editing old ones.

### typescript-01-git-01-006 ⭐
Q: What is a branch, physically, inside `.git`?
A: A file holding one commit hash, e.g. `refs/heads/main`.

### typescript-01-git-01-007 ⭐
Q: A teammate pushes to main. Before you fetch, what does your `origin/main` point to?
A: Your last-fetched copy of the remote branch, unchanged.
Why: `origin/main` moves only on `fetch` or `pull`.

### typescript-01-git-01-008 ⭐
Q: What does "detached HEAD" mean?
A: HEAD points directly at a commit instead of at a branch.
Why: Commits made there are easy to lose.

### typescript-01-git-01-009
Q: You run `git switch --detach v1.2.0`, commit a fix, then `git switch main`. Where is your fix now?
A: Only reachable through the reflog.
Why: Start hotfixes on a branch: `git switch -c hotfix/1.2.1 v1.2.0`.

### typescript-01-git-01-010 ⭐
Q: How should you commit a refactor that makes room for a new feature?
A: As two commits: the refactor first, then the feature.
Why: Reviewers confirm the refactor changes no behaviour, and you can revert or bisect the feature alone.

### typescript-01-git-01-011 ⭐
Q: In Conventional Commits, which character after the type or scope marks a breaking change?
A: `!`, as in `feat(api)!: drop v1 routes`.
Why: A `BREAKING CHANGE:` footer does the same.

### typescript-01-git-01-012 ⭐
Q: What should a commit message body explain?
A: Why the change was made, and any trade-off.
Why: The diff already shows what changed.

### typescript-01-git-01-013
Q: Which command discards your unstaged edits to `src/a.ts`, the modern way?
A: `git restore src/a.ts`
Why: Avoid `git checkout -- file`: checkout does two jobs, and one typo overwrites a file with no undo.

### typescript-01-git-01-014
Q: You stash, switch to main, and your new file is still sitting in the working tree. Why?
```bash
git stash
git switch main
```
A: Plain `git stash` skips untracked files. Use `git stash push -u -m "wip: …"`.

### typescript-01-git-01-015
Q: Which command stages only some hunks of a file, so you can split a commit by intent?
A: `git add -p`
Why: In the prompt, `s` splits a hunk and `e` edits it by hand.

## 02 · Repo setup and keeping secrets out

### typescript-01-git-02-001 ⭐
Q: A `.env` with cloud keys was pushed to a public repo. You delete it in the next commit. Why is that not enough?
A: The file is still in history, and bots scrape pushed secrets within minutes.

### typescript-01-git-02-002 ⭐
Q: A secret was pushed, even to a private repo for one minute. What is the first thing you do?
A: Revoke or rotate it at the provider.
Why: Once the value is dead, the copy in history is harmless.

### typescript-01-git-02-003 ⭐
Q: Why is rewriting history a poor first response to a leaked secret?
A: It is slow, breaks every clone, and never reaches existing forks and clones.
Why: It also drops signatures. Rotate first; purge history only if you still must.

### typescript-01-git-02-004 ⭐
Q: You add `.env` to `.gitignore` and commit, but Git still tracks it. What command fixes this?
A: `git rm --cached .env`
Why: Ignore rules don't apply to files already tracked. Rotate what was in the file, too.

### typescript-01-git-02-005
Q: What does GitHub push protection do?
A: It blocks pushes that contain known secret formats.
Why: Secret scanning is the other half: it alerts on secrets already in the repo.

### typescript-01-git-02-006
Q: A shell script fails in a Linux container with `/bin/sh^M: bad interpreter`. What is the cause?
A: CRLF line endings, from a commit made on Windows.
Why: Prevent it with `* text=auto eol=lf` in `.gitattributes`.

### typescript-01-git-02-007
Q: Why does a team-wide line-ending rule belong in `.gitattributes`, not in everyone's `core.autocrlf`?
A: Config is per machine and never cloned. `.gitattributes` is committed, so every clone and CI runner applies it.

### typescript-01-git-02-008
Q: You add `.gitattributes` to an existing repo. Which command applies it to files already committed?
A: `git add --renormalize .`
Why: Commit it on its own: `chore: normalize line endings`.

### typescript-01-git-02-009
Q: Where do OS and editor files like `.DS_Store` and `.idea/` belong?
A: In your global ignore file (`core.excludesFile`), not in each project's `.gitignore`.

### typescript-01-git-02-010
Q: Hooks in `.git/hooks/` never reach your teammates. How do you share a pre-commit hook?
A: Commit it in `.githooks/` and run `git config core.hooksPath .githooks`.

### typescript-01-git-02-011 ⭐
Q: A teammate commits with `--no-verify`. What still stops a bad commit from reaching main?
A: CI running the same check as a required status check on the protected branch.
Why: Hooks are fast feedback, not a control.

### typescript-01-git-02-012
Q: You configured Git on Windows, but commits made in WSL2 have the wrong email. Why?
A: Git for Windows and Git in WSL2 have separate global configs.

### typescript-01-git-02-013
Q: Which setting makes the first push of a new branch set its upstream automatically?
A: `push.autoSetupRemote = true`

### typescript-01-git-02-014
Q: Which setting drops `origin/*` refs for branches that were deleted on GitHub?
A: `fetch.prune = true`

### typescript-01-git-02-015
Q: Which commit email keeps your real inbox out of public commits on GitHub?
A: Your GitHub no-reply address, `…@users.noreply.github.com`.
