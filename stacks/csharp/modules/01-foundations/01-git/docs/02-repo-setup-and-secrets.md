---
title: Repo setup for .NET and keeping secrets out
tech: Git, GitHub, .NET 10 SDK, gitleaks
version: Git 2.56, .NET SDK 10.0.4xx
date: 2026-11-09
covers: [4, 13]
---
# Repo setup for .NET and keeping secrets out
[← Overview](00-overview.md)

## Why it matters
- A repo with committed `bin/` and `obj/` folders has 300 MB of build output and a merge conflict in every PR.
- One Windows developer with `core.autocrlf=false` rewrites every line ending in a file; the PR diff shows 2,000 changed lines for a one-line fix.
- A Stripe key in `appsettings.Development.json` is pushed to a public repo. Bots use it within minutes; deleting the commit later does not help.

## Concepts

### Global config (once per machine)
```bash
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global push.autoSetupRemote true
git config --global merge.conflictStyle zdiff3
git config --global rerere.enabled true
git config --global rebase.updateRefs true
git config --global fetch.prune true
git config --global core.autocrlf input     # WSL2/Linux/macOS; on Windows-only setups see below
```
Check where a setting comes from: `git config --show-origin --get core.autocrlf`.

### Line endings: decide in the repo, not on each laptop
`.gitattributes` wins over everyone's `core.autocrlf`.

`.gitattributes`
```gitattributes
* text=auto eol=lf
*.cs     text diff=csharp
*.csproj text
*.slnx   text
*.props  text
*.sh     text eol=lf
*.ps1    text eol=crlf
*.png    binary
*.pfx    binary
```
After adding it to an existing repo: `git add --renormalize . && git commit -m "chore: normalize line endings"`.

### What a .NET `.gitignore` needs
`dotnet new gitignore` writes the maintained Visual Studio template. The lines that matter most:
| Pattern | Why |
|:--|:--|
| `bin/`, `obj/` | build output and restore artifacts |
| `.vs/`, `*.user`, `*.suo` | per-developer IDE state |
| `TestResults/`, `coverage*` | test output |
| `*.pfx`, `*.key` (unless intentionally public) | certificates and keys |
| `appsettings.*.local.json` | if your team uses local override files |
| `.env`, `.env.*` + `!.env.example` | Compose and frontend env files |

`git check-ignore -v path/to/file` explains which rule ignores a file.

### Hooks
Client-side hooks live in `.git/hooks/` (not versioned). Share them with a versioned folder:
```bash
git config core.hooksPath .githooks
```
`.githooks/pre-commit`
```bash
#!/usr/bin/env sh
set -e
dotnet format --verify-no-changes --no-restore
gitleaks git --staged --no-banner
```
Hooks are a convenience; CI is the real gate (see 05-code-quality and 04-ci-cd).

### Where .NET secrets go instead
| Secret for | Put it in | Never in |
|:--|:--|:--|
| local dev connection strings, API keys | `dotnet user-secrets` (stored in your user profile, outside the repo) | `appsettings.Development.json` |
| Docker Compose services | `.env` (ignored), with `.env.example` committed | `compose.yaml` |
| CI | GitHub Actions secrets, or OIDC to Azure | workflow files |
| production | Azure Key Vault via managed identity | images, env files in the repo |

```bash
cd src/Shop.Api
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:Shop" "Server=localhost,1433;Database=shop;User Id=sa;Password=...;TrustServerCertificate=true"
```

### Scanning
| Layer | Tool |
|:--|:--|
| before commit | `gitleaks git --staged` in a hook |
| on push | GitHub secret scanning + push protection (on by default for public repos) |
| in CI | `gitleaks git` over the PR range |
| history audit | `gitleaks git --log-opts="--all"` |

### When a secret leaks
1. **Rotate first.** Revoke the key at the provider (Stripe, Azure, SQL login). Assume it is already used.
2. Check provider logs for use of the leaked credential.
3. Then clean history if needed: `git filter-repo --replace-text replacements.txt`, force-push, ask everyone to re-clone, and ask GitHub support to purge cached views for public repos.
4. Write down how it happened and add the guard (hook, push protection, ignore rule).

## Example
Bootstrapping a .NET repo.

`terminal`
```bash
mkdir shop && cd shop && git init
dotnet new gitignore
dotnet new editorconfig
dotnet new sln --format slnx -n Shop
dotnet new webapi -n Shop.Api -o src/Shop.Api
dotnet sln add src/Shop.Api
printf '* text=auto eol=lf\n*.cs text diff=csharp\n' > .gitattributes
git add .
git status --short          # no bin/ or obj/ here
git commit -m "chore: bootstrap Shop solution"
```

## Production patterns
- Commit `.gitattributes`, `.gitignore`, `.editorconfig`, `global.json`, and `Directory.Build.props` in the first commit; they shape every later diff.
- Enable push protection for secret scanning in the repo's security settings.
- Keep `appsettings.json` free of secrets; it only holds safe defaults and placeholders.
- Use `diff=csharp` so `git diff` shows method names in hunk headers.

## Mistakes
Wrong: removing the file and hoping.
```bash
git rm appsettings.Development.json && git commit -m "remove secrets"   # still in history
```
Right: rotate the key, then rewrite history if the repo is shared or public.

Wrong: ignoring a file that is already tracked.
```bash
echo "bin/" >> .gitignore    # bin/ is still tracked
```
Right:
```bash
git rm -r --cached bin obj && git commit -m "chore: stop tracking build output"
```

## Check yourself
1. A teammate on Windows still gets CRLF churn after you committed `.gitattributes`. What command fixes files already in the repo?
2. Why are `dotnet user-secrets` safer than a git-ignored `appsettings.Local.json`?
3. A key leaked 10 minutes ago in a public repo. What is step one?

<details><summary>Answers</summary>

1. `git add --renormalize .` then commit.
2. They live outside the repository directory, so no ignore rule can be wrong and no `git add -f` can include them.
3. Revoke and rotate the key at the provider. Cleaning history comes later.
</details>

## Sources
- [gitattributes](https://git-scm.com/docs/gitattributes) · [githooks](https://git-scm.com/docs/githooks)
- [Safe storage of app secrets in development (user-secrets)](https://learn.microsoft.com/aspnet/core/security/app-secrets)
- [GitHub — Push protection](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection)
- [gitleaks](https://github.com/gitleaks/gitleaks) · [git-filter-repo](https://github.com/newren/git-filter-repo)
- [dotnet/sdk gitignore template](https://github.com/github/gitignore/blob/main/VisualStudio.gitignore)
