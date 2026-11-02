---
id: T04
title: Team repo on GitHub
level: core
status: todo
covers: [5, 11, 12, 14, 15]
---
# T04 · Team repo on GitHub
[← Topic](../../README.md) · Lessons: [03](../../docs/03-branching-and-integration.md), [05](../../docs/05-pull-requests-and-protection.md), [06](../../docs/06-signing-and-releases.md)

## Scenario
You're publishing `shop-utils` (the T03 code) as a small open-source package. Two contributors join next month. From day one: nothing reaches `main` without a PR and green CI, history is linear and signed, and every release is a protected tag with generated notes.

## Requirements

### Repository
- [ ] A new **public** repo on your GitHub account (rulesets are free for public repos). Seed it with one signed commit holding the files of your T03 `main` after Drill B (the slug bug is still in it). Fresh history: no T03 commits, no secrets, no `.env`.
- [ ] Settings: squash merge only, default squash message "Pull request title and description", allow auto-merge, always suggest updating PR branches, delete head branches automatically.
- [ ] `.github/CODEOWNERS` (you own everything; `.github/` explicitly owned by you too).
- [ ] `.github/pull_request_template.md` with what/why, how to test, risk and rollback.
- [ ] Labels: `breaking-change`, `enhancement`, `bug`, `ignore-for-release`; `.github/release.yml` groups release notes by them.

### CI
- [ ] `.github/workflows/ci.yml` with one job `check` that runs on `pull_request`, `merge_group`, and pushes to `main`.
- [ ] It runs `node --test` on Node.js 26.
- [ ] On pull requests it also fails if the PR **title** is not a Conventional Commit (the title becomes the squash commit).
- [ ] Least-privilege `permissions`, actions pinned to full commit SHAs, a job timeout.

### Protection
- [ ] Ruleset `main` on the default branch: restrict deletions, block force pushes, require linear history, require signed commits, require a PR (0 approvals if solo, dismiss stale approvals, require conversation resolution, squash only), require status check `check` from GitHub Actions with "up to date" on. Empty bypass list.
- [ ] Ruleset `release-tags` on `refs/tags/v*`: restrict updates and deletions.
- [ ] Immutable releases turned on.

### Flow
- [ ] Ship at least 3 PRs with `gh`, each from a short-lived branch:
  1. a `fix:` PR fixing the T03 slug bug (with its regression test)
  2. a `feat:` PR (your choice, small)
  3. a PR whose first push **fails** CI or has a bad title, shown blocked, then fixed and merged
- [ ] Try a direct `git push origin main` and a `--force` push; capture both rejections.
- [ ] Release `v1.1.0` from `main`: signed annotated tag, `gh release create --verify-tag --generate-notes`, notes grouped by your labels.

## Deliverables (in this folder)
- `.github/` copies: `CODEOWNERS`, `pull_request_template.md`, `release.yml`, `workflows/ci.yml`.
- `rulesets/main.json` and `rulesets/release-tags.json`: exported from GitHub (UI export or `gh api`).
- `REPORT.md`: repo URL; links to the 3 PRs and the release; output of `gh ruleset check main`; the two rejected pushes; `git log --show-signature -3` on `main`; 3–5 lines on what you would change for a 10-person team.

## Acceptance criteria
- Every commit on `main` after the seed commit came from a squash-merged PR and shows **Verified** on GitHub.
- `git log --oneline main` is linear (no merge commits) and every subject is a Conventional Commit.
- PR 3's checks page shows a failed `check` run before the passing one.
- The direct push is rejected by the ruleset, and the force push is rejected too.
- `ci.yml` never puts `${{ github.event.* }}` directly inside a `run:` script.
- The `v1.1.0` release notes list PRs under at least two of your categories, and the tag is signed (`git tag -v v1.1.0` succeeds locally).
- Exported rulesets match the requirements above (check `enforcement`, `bypass_actors`, and each rule).

## Constraints
- Stack: Git 2.56, GitHub, `gh` CLI, GitHub Actions (STACK.md CI/CD layer), Node.js 26.
- No third-party actions beyond `actions/checkout` and `actions/setup-node`. No release bots (release-please, semantic-release).
- No admin bypass. If you get stuck behind your own ruleset, fix the PR, not the ruleset.
- The `.github/` folder here is a copy for review. Workflows only run from the root of the GitHub repo.

## Covers
- Trunk-based development with short-lived branches
- Pull requests that get merged: small, described, reviewable; CODEOWNERS
- Protecting main: rulesets, required reviews and checks, merge queue
- Signed commits and tags (SSH signing, verified badge)
- Tags, SemVer, and GitHub Releases

## Hints
<details>
<summary>1. The required check never shows up</summary>

GitHub suggests check names that ran recently. Run the workflow on a PR once before you add the rule, so you can pick `check` from the list and see its exact name. The name must match what the PR's checks list shows.
</details>

<details>
<summary>2. Commits show "Unverified" after merge</summary>

Look at which merge method you used. GitHub signs squash and merge commits it creates; rebase merges are not signed.
</details>

<details>
<summary>3. Checking the PR title safely</summary>

Get the title into the script through `env:`, then test it with `grep -E` or a `case` pattern. Only `pull_request` events have a title; skip the step for `push` and `merge_group`.
</details>

<details>
<summary>4. Exporting a ruleset</summary>

`gh ruleset list` gives IDs. `gh api repos/{owner}/{repo}/rulesets/<id>` returns the JSON. The ruleset page on GitHub also has an export option.
</details>

## Stretch
- Create a free GitHub organization, move the repo there, and turn on a merge queue. Show two PRs merged as one queue group, with CI running on `merge_group`.
- Hotfix: cut `release-1.1` from `v1.1.0`, land a `fix:` on `main` via PR, `git cherry-pick -x` it to `release-1.1`, and release `v1.1.1` from that branch.

## When done
Write your code in this folder, set `status: done`, and run `/review 01-foundations/01-git T04`.
