---
title: Debugging methodically and AI coding assistants
tech: git bisect, Visual Studio / VS Code debuggers, dotnet test, GitHub Copilot
version: Git 2.5x, .NET 10, GitHub Copilot (November 2026)
date: 2026-11-09
covers: [9, 10]
---
# Debugging methodically and AI coding assistants
[← Overview](00-overview.md)

## Why it matters
- A developer changed five things at once to fix a flaky checkout test. It passed, so they merged; two of the five changes had introduced a new bug.
- Prices showed one cent off for some orders. Two days of guessing; `git bisect` found the guilty commit in 12 minutes.
- An AI assistant generated a "working" export endpoint. It built SQL with string concatenation and returned every customer's email. The developer accepted it because the tests passed.

## Concepts

### Debugging methodically
| Step | Practice |
|:--|:--|
| ⭐ reproduce | get a reliable repro; ideally a failing test (xUnit) or a script; note exact inputs, environment, version |
| ⭐ observe | read the actual error, logs, and traces (trace ID from problem details) before forming theories |
| ⭐ hypothesise | one specific, falsifiable hypothesis at a time |
| ⭐ narrow | binary search: in time (`git bisect`), in code (comment out halves), in data (smaller inputs) |
| change one thing | test the hypothesis; revert if wrong |
| ⭐ fix + test | the failing test now passes; add regression tests for neighbours |
| explain | write down the cause in the PR; check for the same bug elsewhere |

| .NET tool | Use |
|:--|:--|
| debugger (VS / VS Code C# Dev Kit) | breakpoints, conditional breakpoints, tracepoints (log without stopping), watch, call stack |
| `dotnet test --filter "FullyQualifiedName~Discount"` | run just the relevant tests |
| `git bisect run dotnet test --filter ...` | find the commit that broke it automatically |
| `dotnet-dump`, `dotnet-trace`, `dotnet-counters` | hangs, CPU, memory in running processes |
| logs and traces | Aspire dashboard locally, Application Insights in prod |
| rubber duck | explain the problem out loud or in writing; often reveals the gap |

### Working with AI coding assistants responsibly
| Rule | Practice |
|:--|:--|
| ⭐ you own the code | review AI output like a colleague's PR, line by line; you're accountable for what you merge |
| ⭐ verify | run it, test it, check edge cases; ask for tests and read them critically (do they test behaviour?) |
| ⭐ security | watch for injection, missing authorization, secrets in code, weak crypto, PII in logs, unsafe deserialisation |
| ⭐ correctness of APIs | check that suggested APIs exist in your versions (.NET 10, EF Core 10); assistants invent methods |
| ⭐ data policy | follow the company's policy: approved tools and plans (Copilot Business/Enterprise don't train on your code), content exclusions for sensitive files, no secrets or customer data in prompts |
| licences | enable the public code filter or code referencing; check matches |
| give context | custom instructions for the repo (conventions, stack versions, forbidden libraries) |
| small steps | ask for small, reviewable changes; agent mode and coding agent output gets the same PR review |
| learning | ask "why", read docs; don't outsource understanding |

| Copilot feature | Use |
|:--|:--|
| inline completions | boilerplate, tests, small functions |
| chat / agent mode (VS Code, Visual Studio) | multi-file changes in your workspace, with your review of each step |
| coding agent | assign an issue; it opens a PR from its own branch; review like any PR |
| code review | first-pass review comments on PRs |
| custom instructions | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` (`applyTo` globs), prompt files |
| MCP servers | give agents tools (GitHub, docs, databases): least privilege |

## Example
Finding the commit that broke rounding:
```bash
git bisect start
git bisect bad HEAD
git bisect good v1.7.0
git bisect run dotnet test tests/Shop.Ordering.Tests --filter "FullyQualifiedName~MoneyRoundingTests"
# → "a91c3e2 is the first bad commit"
git bisect reset
```
Turning the bug into a failing test first:
```csharp
public sealed class MoneyRoundingTests
{
    [Fact]
    public void Ten_percent_off_three_lines_rounds_per_line_half_to_even()
    {
        var order = OrderBuilder.With(lines: [1999, 1999, 1999]).Build();   // €19.99 × 3
        var discounted = order.ApplyDiscount(Percent.Of(10));

        discounted.Total.Minor.ShouldBe(5397);                              // 1799 + 1799 + 1799
    }
}
```
`.github/copilot-instructions.md`
```markdown
# Copilot instructions for the shop
- Stack: .NET 10, C# 14, ASP.NET Core Minimal APIs, EF Core 10 (SQL Server), xUnit v3 + Shouldly + NSubstitute, Next.js 16.
- Money is `Money` (long minor units + currency). Never use double/float for money.
- Every endpoint needs explicit authorization (`RequireAuthorization(...)` or `AllowAnonymous()` with a comment).
- Use EF Core LINQ or parameterised Dapper; never build SQL with string concatenation.
- Don't add MediatR, AutoMapper, or FluentAssertions (commercial licences); use plain handlers, Mapperly or manual mapping, Shouldly.
- Log with `[LoggerMessage]`; never log emails, tokens, or card data.
- Tests: arrange/act/assert, one behaviour per test, names like `Rejects_expired_discount_code`.
```
Reviewing AI output: a quick checklist to paste into the PR
```text
[ ] I read every line and can explain it
[ ] APIs exist in our versions (checked docs/IntelliSense)
[ ] Authorization, validation, and error handling are correct
[ ] No secrets, PII logging, string-built SQL, or new unapproved packages
[ ] Tests cover behaviour and edge cases; I ran them
```

## Production patterns
- Bugs get a failing test first, a narrowing method (bisect, halving), one change at a time, and a written cause in the PR.
- AI assistants are used within the company's approved tools and data policy, with repository instructions that encode stack and security rules.
- AI-written code goes through the same review, tests, and security checks as human code; the author can explain all of it.

## Mistakes
Wrong: changing several things until the bug disappears.
Right: reproduce, form one hypothesis, change one thing, observe, and keep the failing test.

Wrong: pasting a production connection string or customer records into a chat to "help debug".
Right: synthetic examples and redacted logs; secrets never leave the vault.

## Check yourself
1. How does `git bisect run` find the bad commit?
2. Why write a failing test before fixing a bug?
3. Name four things to check in AI-generated code.

<details><summary>Answers</summary>

1. It binary-searches the commits between a known good and a known bad commit, running your command at each step: exit code 0 marks good, non-zero bad, until one commit is left.
2. It proves you've reproduced the bug, proves the fix works, and stays as a regression test so the bug can't come back silently.
3. Any four of: APIs exist in your versions; authorization and validation; injection and other security issues; secrets or PII handling; correctness on edge cases; licence/public-code matches; tests that test real behaviour; unapproved dependencies.
</details>

## Sources
- [git bisect](https://git-scm.com/docs/git-bisect)
- [Debug .NET apps in VS Code](https://code.visualstudio.com/docs/csharp/debugging)
- [GitHub Copilot — custom instructions](https://docs.github.com/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot)
- [GitHub Copilot coding agent](https://docs.github.com/copilot/using-github-copilot/coding-agent/about-assigning-tasks-to-copilot)
- [GitHub Copilot Trust Center](https://copilot.github.trust.page/)
- [OWASP Top 10:2025](https://owasp.org/Top10/)
