---
id: T02
title: Branch cleanup before review
level: core
status: todo
covers: [1, 3, 6, 7, 8]
---
# T02 · Branch cleanup before review
[← Topic](../../README.md) · Lessons: [01](../../docs/01-objects-and-commits.md), [03](../../docs/03-branching-and-integration.md), [04](../../docs/04-rewrite-recover-investigate.md)

## Scenario
Your discount-code branch works, but its history is six commits named "wip", "more", and "oops", with a debug log and an unrelated README fix mixed in. Since you pushed it, a teammate changed tax logic on `main` and pushed a commit to your branch. Make the PR reviewable without losing anyone's work.

## Setup
```bash
bash setup.sh ~/sandbox/git-t02     # run from this folder, inside WSL2
cd ~/sandbox/git-t02/alice
```
`alice/` is your clone. `origin.git` stands in for GitHub. Don't touch `bob/`.

## Requirements
- [ ] Park your uncommitted work (a modified file **and** a new file) in a named stash before you start, and restore it, still uncommitted, at the end.
- [ ] Before rewriting, record the SHA of your branch tip and the output of `git cat-file -p` for it.
- [ ] Before rewriting, fetch and find out what changed on `origin/main` and on `origin/feat/discount-codes`. Integrate anything a teammate pushed to your branch.
- [ ] Rewrite the branch into atomic Conventional Commits, in this order:
  1. a `docs:` commit with only the README typo fix
  2. one `feat(pricing):` commit with the discount feature (no debug log, no typos)
  3. one `test(pricing):` commit with the tests
  4. the teammate's docs commit, with the teammate still the author
- [ ] Split the "wip" commit with `add -p` or `reset` + partial staging; use fixup/squash/drop for the rest. No `reset --soft` to squash everything into one commit.
- [ ] Rebase onto the latest `origin/main` with `zdiff3` and `rerere` on. Resolve the conflict so both changes survive.
- [ ] Every commit on the final branch passes `node --test` (prove it with `--exec`).
- [ ] Show `rerere` working: get back to the pre-rebase state using the reflog or `ORIG_HEAD`, rebase again, and capture Git reusing your resolution.
- [ ] Compare old and new branch with `git range-diff`.
- [ ] Push with `--force-with-lease` and `--force-if-includes`. Never `--force`.
- [ ] Prove your original tip commit still exists after the rewrite, and explain why its SHA differs from the new tip.

## Deliverables (in this folder)
- `REPORT.md`: one short section per requirement: the commands you ran, the key output, and 1–3 sentences on why.
- `patches/`: the final branch as `git format-patch origin/main -o patches/`, run after you push.

## Acceptance criteria
- `patches/` holds exactly 4 patches, in the order above, with Conventional Commit subjects and no `console.log` anywhere.
- The `feat` patch's `src/price.ts` uses `roundCents`, applies the discount, and keeps the 21% rate.
- The teammate's patch has `From: Bob Teammate <bob@example.com>`.
- `REPORT.md` shows `git rebase --exec "node --test" ...` (or `-i --exec`) completing on all 4 commits.
- `REPORT.md` includes `Resolved 'src/price.ts' using previous resolution.`
- `REPORT.md` shows `git cat-file -t <old-tip>` printing `commit` after the rewrite, with an explanation that uses the words tree, parent, and hash.
- `REPORT.md` shows the stash list before, and `git status` at the end with your WIP file changes back and uncommitted.
- `origin/feat/discount-codes` equals your local branch (`git status` says "up to date").

## Constraints
- Git 2.56 in WSL2 with the global config from T01. Node.js 26 to run tests (no `npm install` needed).
- Use only Git commands. No GUI clients, no `git history` (experimental). Don't use `--no-verify`.
- Don't push to `main`. Don't modify `bob/`.
- Don't paste the whole terminal session into REPORT.md. Key output only.

## Covers
- Git's object model: blobs, trees, commits, refs, and HEAD
- Everyday commands done right: `switch`, `restore`, `add -p`, `stash`
- Merge vs rebase vs squash, and when never to rewrite history
- Resolving conflicts: `zdiff3`, `rerere`, and checking the result
- Cleaning a branch before review: interactive rebase, fixup commits, autosquash

## Hints
<details>
<summary>1. Order of operations matters</summary>

If you rewrite first and pick up the teammate's commit later with cherry-pick, `--force-if-includes` will reject your push. Git can't prove you ever had their commit. Bring their commit into your branch by fast-forwarding **before** you rewrite, and it becomes one more line in your rebase todo list.
</details>

<details>
<summary>2. Splitting "wip"</summary>

Mark it `edit`. When the rebase stops, `git reset HEAD~` puts its changes back in the working tree. Commit the README alone first, then the code. `git rebase --continue`.
</details>

<details>
<summary>3. Tests pass before the rebase, fail after</summary>

The conflict resolution can be textually perfect and still wrong for the tests. Something your test assumed changed on `main`. Fix it in the commit that introduced the test, not in a new "fix tests" commit.
</details>

<details>
<summary>4. Getting back to "before the rebase"</summary>

`git reflog` lists every move of `HEAD`. Find the line just before `rebase (start)`. `git reset --hard <that entry>` is safe here because your WIP is in the stash.
</details>

## Stretch
- Redo the whole cleanup with `git commit --fixup=<sha>` commits and a single `git rebase --autosquash` instead of hand-editing the todo list.
- Use `git range-diff` output to write the "what changed since your last review" comment you would post on the PR.

## When done
Write your code in this folder, set `status: done`, and run `/review typescript/01-foundations/01-git T02`.
