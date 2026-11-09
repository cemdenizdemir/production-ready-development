---
title: Secrets, supply chain, and response
tech: gitleaks, Dependabot, CodeQL, pnpm, GitHub
version: gitleaks 8.x, pnpm 10, CodeQL (GitHub default setup), Nov 2026
date: 2026-11-07
covers: [10, 11, 12, 13]
---
# Secrets, supply chain, and response
[← Overview](00-overview.md)

## Why it matters
- September 2025: phished maintainer credentials pushed malware into `chalk`, `debug`, and other packages with billions of weekly downloads. Days later the self-spreading "Shai-Hulud" worm stole npm and cloud tokens from developer machines and CI, then republished infected packages.
- An AWS key committed "just for a minute" to a public repo is used by bots within minutes.
- A researcher emails about a vulnerability. Nobody knows who owns it, the email sits for three weeks, and the bug becomes public first.

## Concepts

### Secrets
| Rule | Practice |
|:--|:--|
| Never in code or Git | `.env` ignored, `.env.example` committed ([01-git](../../01-git/README.md)) |
| Store in a secret manager | AWS Secrets Manager or SSM Parameter Store; injected as env vars at runtime |
| Least privilege, short-lived | OIDC in CI, task roles in ECS, per-service credentials |
| Rotate | on schedule and immediately on any suspicion |
| Scan | gitleaks locally and in CI; GitHub secret scanning + push protection |
| Never log | redact `authorization`, `cookie`, `password`, tokens ([03-backend/10-observability](../../../03-backend/10-observability/README.md)) |

Leak response: **revoke and rotate first**, then check access logs for use, then clean history if needed.

### Supply chain
| Risk | Control |
|:--|:--|
| Unpinned versions drift | commit `pnpm-lock.yaml`; `--frozen-lockfile` in CI |
| Install scripts run malware | pnpm 10 blocks dependency lifecycle scripts unless allowlisted (`onlyBuiltDependencies`, `pnpm approve-builds`) |
| Brand-new malicious versions | `minimumReleaseAge` (pnpm 10.16+) and Dependabot `cooldown` delay adoption of fresh releases |
| Known vulnerable versions | Dependabot alerts and security updates; `pnpm audit` |
| Typosquats and abandoned packages | review new dependencies: maintainers, downloads, repo activity, OpenSSF Scorecard |
| Compromised CI actions | SHA pins, least-privilege tokens ([04-ci-cd lesson 03](../../04-ci-cd/docs/03-secure-workflows.md)) |
| Unverifiable builds | provenance attestations, npm trusted publishing |

Fewer dependencies = smaller attack surface. Prefer the platform (`fetch`, `node:crypto`, `node:test` utilities) for small needs.

### Static analysis and secure review
- **CodeQL** (GitHub code scanning) finds data-flow bugs: user input reaching SQL, shell, file paths, or HTML. Default setup needs no workflow; advanced setup allows `security-extended` queries.
- **Secure code review checklist:** authz per object, input validation at edges, parameterized queries, output encoding, secrets handling, error handling that fails closed, logging of security events.
- Findings get triaged like bugs: fix, or dismiss with a reason. No permanent backlog of ignored alerts.

### Logging, least privilege, and vulnerability handling
| Area | Practice |
|:--|:--|
| Security events to log | logins (success/failure), MFA changes, password resets, permission denials, admin actions, key creation |
| Log hygiene | actor, action, target, IP, request ID, time; no secrets or full PII |
| Alerting | spikes in failed logins, 403s, rate-limit hits; new admin users |
| Least privilege | non-root containers, scoped DB users, per-service IAM roles |
| Vulnerability reports | `SECURITY.md`, GitHub private vulnerability reporting, an owner, an SLA |
| Fix process | triage severity (CVSS + exploitability), patch, advisory, rotate exposed secrets, postmortem |

## Example
`.github/workflows/security.yml`
```yaml
name: security
on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 4 * * 1'

permissions:
  contents: read

jobs:
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0              # scan full history
      - name: gitleaks
        run: |
          docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.28.0 \
            git /repo --redact --verbose

  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: ./.github/actions/setup
      - run: pnpm audit --audit-level high --prod
```
Enable CodeQL: **Settings → Code security → Code scanning → CodeQL analysis → Default**. Also enable Dependabot alerts, Dependabot security updates, secret scanning, push protection, and private vulnerability reporting on the same page.

`pnpm-workspace.yaml` (pnpm 10 settings for supply-chain hygiene):
```yaml
onlyBuiltDependencies:   # only these may run install scripts
  - esbuild
minimumReleaseAge: 1440  # minutes: don't install versions published in the last 24 h
```
`.github/dependabot.yml` (excerpt)
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    cooldown:
      default-days: 3        # wait before proposing a brand-new release
    groups:
      production:
        dependency-type: production
```
`SECURITY.md`
```md
# Security policy
Report vulnerabilities privately via GitHub: Security → Report a vulnerability.
We reply within 2 business days and aim to fix critical issues within 7 days.
Please don't open public issues for security problems.
```

## Production patterns
- **Secrets only at runtime** from a secret manager; nothing in images, repos, or CI logs.
- **Push protection + gitleaks** stop most leaks before they land; treat any leak as compromised regardless.
- **Dependabot grouped weekly**, security updates immediately; a short cooldown for non-security bumps.
- **Review every new dependency** in the PR: why, who maintains it, what it can access, and its install scripts.
- **CodeQL default setup on every repo**; triage alerts within a sprint.
- **A named owner for security reports** and a tested path to ship a fix and rotate secrets fast.

## Mistakes
Wrong: a secret "temporarily" in code.
```ts
const stripe = new Stripe('sk_live_...'); // in Git forever, in every clone and fork
```
Right:
```ts
const stripe = new Stripe(env.STRIPE_SECRET_KEY); // validated config (07-config-environments)
```

Wrong: cleaning Git history after a leak and calling it fixed.
Right: revoke and rotate immediately; history cleanup is optional and second.

Wrong: `pnpm install` without a lockfile in CI, or `pnpm add some-package` without looking at it.
Right: lockfile + `--frozen-lockfile`; review new packages and their install scripts.

Wrong: hundreds of dismissed-by-default security alerts.
Right: fix or dismiss each with a recorded reason; keep the queue near zero.

## Check yourself
1. What is the first action when a production secret leaks, and why not history cleanup?
2. How do `onlyBuiltDependencies` and `minimumReleaseAge` reduce supply-chain risk?
3. Name five security events your API should log.

<details>
<summary>Answers</summary>

1. Revoke and rotate the secret. Once pushed, it may already be copied by bots or forks; removing it from history doesn't make it secret again.
2. The first stops install scripts of unlisted dependencies from running (a common malware entry point). The second delays installing newly published versions, so malicious releases are often detected and pulled before you adopt them.
3. Login success and failure, password reset requests, MFA changes, permission denials (403), admin actions such as role changes, API key creation and revocation.
</details>

## Sources
- [OWASP — Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [gitleaks](https://github.com/gitleaks/gitleaks)
- [pnpm — Supply chain security](https://pnpm.io/supply-chain-security)
- [GitHub — Dependabot options reference](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)
- [GitHub — About code scanning with CodeQL](https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql)
- [GitHub — Privately reporting a security vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
- [CISA — Widespread supply chain compromise impacting npm ecosystem (Sept 2025)](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem)
