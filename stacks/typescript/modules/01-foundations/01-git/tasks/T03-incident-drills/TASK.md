---
id: T03
title: Incident drills
level: core
status: todo
covers: [1, 6, 9, 10, 13]
---
# T03 · Incident drills
[← Topic](../../README.md) · Lessons: [01](../../docs/01-objects-and-commits.md), [02](../../docs/02-repo-setup-and-secrets.md), [04](../../docs/04-rewrite-recover-investigate.md)

## Scenario
It's your on-call week on the `shop-utils` team. Four tickets came in: a teammate "lost" a day of work, production checkout is broken after the 1.4.0 deploy, QA reports a slug regression nobody can place, and a payments branch has a hard-coded API key. `origin` rejects force pushes and branch deletes, like a protected repo on GitHub.

## Setup
```bash
bash setup.sh ~/sandbox/git-t03     # run from this folder, inside WSL2
cd ~/sandbox/git-t03/app
```

## Requirements

### Drill A · Lost work
- [ ] `feat/report` was reset and lost 3 commits. Restore it to all three.
- [ ] `spike/cache` was deleted with 2 commits. Recreate it.
- [ ] A stash called "wip: rate limiter idea" was dropped. Recover it and commit its changes (including its new file) on a branch `wip/rate-limit`.
- [ ] In REPORT.md, explain with the object model why none of this was really deleted, and when it would have been.

### Drill B · Bad deploy
- [ ] `node --test` fails on `main` since 1.4.0. Find the commit that broke checkout without bisect (the failing test names are enough).
- [ ] Undo it on `main` without rewriting history. Message: `revert: <original subject>` with a body that says why.
- [ ] Push it. `main` passes `node --test`.

### Drill C · Regression hunt
- [ ] QA: "`slugify('Hello,  World!')` returns `hello---world-`. It returned `hello-world` in v1.0.0." Write `regression.test.ts` that reproduces it.
- [ ] Write `bisect-check.sh` and find the first bad commit with `git bisect run` between `v1.0.0` and `main`.
- [ ] Confirm the culprit with `git log -L` or `git blame`, and name which PR-sized change caused it.
- [ ] Fix forward on `fix/slug-separators`: one commit with the fix and the regression test added to `test/`. Push the branch.

### Drill D · Secret in unpushed commits
- [ ] `feat/payments` (4 commits, never pushed) hard-codes `API_KEY` in one commit. Rewrite the branch so **no commit** contains the key, and the code reads `process.env.PAYMENTS_API_KEY`.
- [ ] Add `.env.example`: `PAYMENTS_API_KEY=` in the commit that starts reading it, `PAYMENTS_BASE_URL=` in the commit that starts reading that.
- [ ] Keep all 4 commits (same subjects, same order); every commit passes `node --test`. Then push the branch.
- [ ] In REPORT.md: the steps you would take if this branch **had** been pushed to GitHub, in order.

## Deliverables (in this folder)
- `REPORT.md`: one section per drill: symptom, commands, key output, root cause, prevention (max ~40 lines per drill).
- `regression.test.ts` and `bisect-check.sh`: the ones you used.
- `bisect.log`: output of `git bisect log`.
- `patches/`: `git format-patch` output for the revert commit, the fix commit, and the 4 `feat/payments` commits.

## Acceptance criteria
- `git log --oneline feat/report` shows the 3 `feat(report)` commits on top of `main`'s 1.4.0 commit; `spike/cache` shows both `spike:` commits.
- `wip/rate-limit` contains `src/rate-limit.ts` and the TODO line in `src/checkout.ts`.
- `origin/main` gains exactly one new commit, a revert, and `node --test` passes on it. No push was rejected and retried with tricks.
- `bisect.log` contains at least one `skip` and ends at the real culprit. `bisect-check.sh` returns 125 for commits it can't test.
- The fix patch includes the regression test, and the test fails without the fix.
- `git log -p --all -S 'demo_live_'` prints nothing (run before you push `feat/payments`, include the output).
- REPORT.md's leaked-secret steps put revoking/rotating the key first.

## Constraints
- Git 2.56 in WSL2, Node.js 26. Use Git commands only, no GUI.
- Never force-push `main`, never delete remote branches, never edit `origin.git` config.
- No `git history` (experimental) and no `git filter-repo`: the key was never pushed, so `rebase -i` is the right-sized tool.
- Keep `regression.test.ts` and `bisect-check.sh` outside the repo while bisecting.

## Covers
- Git's object model: blobs, trees, commits, refs, and HEAD
- Merge vs rebase vs squash, and when never to rewrite history
- Undo and recovery: `reset`, `revert`, `reflog`
- Investigating history: `log -S`, `blame`, `bisect`
- Keeping secrets out of Git, and responding when one leaks

## Hints
<details>
<summary>1. A deleted branch has no reflog of its own</summary>

Its reflog is deleted with it. But `HEAD` was on that branch when its commits were made, so `git reflog` (HEAD's reflog) still lists them.
</details>

<details>
<summary>2. Dropped stashes</summary>

A stash is a commit with two or three parents. Once dropped, nothing points at it. `git fsck` can list unreachable commits; `git log -1 <sha>` shows which one is yours. `git stash apply <sha>` works on any stash commit.
</details>

<details>
<summary>3. If bisect blames a commit that never touched slug code</summary>

Check out that commit and run your test by hand. Is it really failing the assertion, or is something failing before the test even runs? Your script should tell those two cases apart.
</details>

<details>
<summary>4. Removing the key from one commit</summary>

`edit` the commit that added it. Change the file and the env example, `git add`, `git commit --amend`, `git rebase --continue`. Later commits may conflict on nearby lines; resolve them so they keep using the env var.
</details>

## Stretch
- Write a `git bisect run` one-liner that also finds the Drill B commit, and explain why bisect would be overkill for it.
- Find the Drill C culprit a second way, with `git log -S` or `git log -G` and no bisect. Compare the effort and say when each approach wins.

## When done
Write your code in this folder, set `status: done`, and run `/review typescript/01-foundations/01-git T03`.
