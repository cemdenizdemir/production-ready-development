---
title: Pull requests, protected main, signing, and releases
tech: Git, GitHub, gh CLI, .NET 10 SDK
version: Git 2.56, GitHub.com (Nov 2026)
date: 2026-11-09
covers: [11, 12, 14, 15]
---
# Pull requests, protected main, signing, and releases
[← Overview](00-overview.md)

## Why it matters
- A 1,800-line PR waits four days for review; when it merges, three other PRs conflict.
- `main` has no protection; a hotfix pushed directly at 2 a.m. skips the tests and breaks login.
- A NuGet package and a container image are both called "1.4.0" but were built from different commits; nobody can say what is running in production.

## Concepts

### Pull requests that get merged
| Practice | Why |
|:--|:--|
| ≤ ~400 changed lines | review quality drops fast above that |
| one purpose per PR | easy to review, revert, and describe |
| description: what, why, how tested, risk, screenshots | reviewer gets context without asking |
| draft PRs for early feedback | cheap course correction |
| self-review the diff first | catches half of the comments before anyone else sees them |
| link the issue (`Closes #142`) | traceability |

`.github/pull_request_template.md`
```markdown
## What and why
## How it was tested
- [ ] `dotnet test` passes locally
- [ ] Migration reviewed (`dotnet ef migrations script`)
## Risk and rollback
```

### CODEOWNERS
`.github/CODEOWNERS`
```text
*                         @org/backend
/src/Shop.Api/Auth/       @org/security
/src/**/Migrations/       @org/data
/infra/                   @org/platform
/.github/workflows/       @org/platform
```
With "require review from code owners" in the ruleset, PRs touching those paths need that team's approval.

### Protecting main with rulesets
Repository → Settings → Rules → Rulesets, target `main`:
| Rule | Setting |
|:--|:--|
| ⭐ Require a pull request | 1+ approvals, dismiss stale approvals, code owner review |
| ⭐ Require status checks | `build-test`, `format`, `codeql`; require branch to be up to date (or use merge queue) |
| Block force pushes | on |
| Restrict deletions | on |
| Require linear history | on if you squash or rebase |
| Require signed commits | optional; on for regulated repos |
| Merge queue | tests the combined result of queued PRs before merging |

Rulesets can be layered (org-wide + repo), have bypass lists (e.g. a release bot), and can run in "evaluate" mode first.

```bash
gh api repos/:owner/:repo/rulesets --jq '.[].name'
```

### Signed commits and tags
SSH signing reuses the key you already push with.
```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
git config --global tag.gpgSign true
```
Add the same public key on GitHub as a **Signing key**. Commits then show "Verified". Squash merges done in the GitHub UI are signed by GitHub.

### Tags, SemVer, and releases
SemVer: `MAJOR.MINOR.PATCH`. Breaking → major, feature → minor, fix → patch.

```bash
git tag -s v1.4.0 -m "v1.4.0"
git push origin v1.4.0
gh release create v1.4.0 --generate-notes
```

Versions in .NET come from MSBuild properties. Pass the tag in CI instead of editing `.csproj` files:
```bash
dotnet publish src/Shop.Api -c Release -p:Version=1.4.0 -p:SourceRevisionId=$(git rev-parse HEAD)
```
`SourceRevisionId` ends up in `AssemblyInformationalVersion` (`1.4.0+<sha>`), so the running app can report exactly which commit it is. Also seen: MinVer or Nerdbank.GitVersioning, which compute the version from tags automatically.

## Example
A release from a tag, with the version visible at runtime.

`src/Shop.Api/Program.cs`
```csharp
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var version = typeof(Program).Assembly
    .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "dev";

app.MapGet("/version", () => new { version });

app.Run();
```
`terminal`
```bash
git switch main && git pull
git tag -s v1.4.0 -m "v1.4.0"
git push origin v1.4.0
dotnet run --project src/Shop.Api -p:Version=1.4.0 -p:SourceRevisionId=$(git rev-parse --short HEAD)
curl -s localhost:5000/version     # {"version":"1.4.0+a1b2c3d"}
```

## Production patterns
- Protect `main` on day one; add more required checks as CI grows.
- One artifact per commit: the same commit builds the image, the NuGet package, and the release notes.
- Expose the build version (`/version` or a response header) so incidents can be tied to commits.
- Use `--generate-notes` or Conventional-Commit-based tools for release notes; edit, don't write from scratch.

## Mistakes
Wrong: editing `<Version>` in `.csproj` by hand for every release.
```xml
<Version>1.4.0</Version>
```
Right: derive it from the tag in CI (`-p:Version=${GITHUB_REF_NAME#v}`).

Wrong: moving a published tag.
```bash
git tag -f v1.4.0 && git push -f origin v1.4.0
```
Right: tags are immutable once pushed; publish `v1.4.1`.

## Check yourself
1. Which ruleset option makes sure the combined result of several PRs is tested before it lands?
2. What does "Verified" on a GitHub commit prove?
3. Where does `-p:SourceRevisionId` show up in a .NET assembly?

<details><summary>Answers</summary>

1. Merge queue.
2. That the commit was signed with a key registered to that GitHub account (not that the code is safe).
3. Appended to `AssemblyInformationalVersion` as `+<sha>`.
</details>

## Sources
- [GitHub — About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [GitHub — About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub — Merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- [GitHub — SSH commit signing](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)
- [Semantic Versioning 2.0.0](https://semver.org/)
- [MSBuild — Version properties](https://learn.microsoft.com/dotnet/core/project-sdk/msbuild-props#generateassemblyinfo)
