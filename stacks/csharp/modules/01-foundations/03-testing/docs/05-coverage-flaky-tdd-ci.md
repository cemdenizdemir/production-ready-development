---
title: Coverage, flaky tests, TDD, legacy code, and CI
tech: xUnit v3, Microsoft.Testing.Extensions.CodeCoverage, ReportGenerator, GitHub Actions
version: xunit.v3 3.2.x, .NET 10 SDK
date: 2026-11-09
covers: [10, 11, 12, 13]
---
# Coverage, flaky tests, TDD, legacy code, and CI
[← Overview](00-overview.md)

## Why it matters
- A team hits 95% line coverage with tests that assert nothing; the coverage gate is green and the bugs are still there.
- One test fails 1 run in 20. People click "re-run" until it passes, and a real regression hides behind the noise for a week.
- A 3,000-line `OrderService` has no tests and nobody dares to touch it.

## Concepts

### Coverage: a flashlight, not a target
| Metric | Tells you | Doesn't tell you |
|:--|:--|:--|
| line coverage | which lines ran | whether anything was checked |
| branch coverage | which `if`/`switch` paths ran | which inputs matter |
| uncovered code | where tests are missing | whether that code matters |

Use it to find untested important code (pricing, auth, money). A sensible gate: no drop on changed code, or a modest threshold on the domain project only. Also seen: mutation testing (Stryker.NET) to check that tests actually fail when code changes.

| Collector | Platform | Command |
|:--|:--|:--|
| `Microsoft.Testing.Extensions.CodeCoverage` | MTP | `dotnet test -- --coverage --coverage-output-format cobertura` |
| `coverlet.collector` | VSTest | `dotnet test --collect:"XPlat Code Coverage"` |
| ReportGenerator | either | `reportgenerator -reports:**/coverage.cobertura.xml -targetdir:coverage -reporttypes:Html;MarkdownSummaryGithub` |

### Flaky tests
| Cause | Fix |
|:--|:--|
| real time (`DateTime.UtcNow`, `Task.Delay`) | `FakeTimeProvider` |
| shared data between parallel tests | unique data per test or one collection |
| test order dependence | each test arranges its own state |
| async not awaited, fire-and-forget work | await it; poll with a deadline for eventual results |
| timeouts too tight on slow CI | deadlines with margin; measure CI timing |
| culture / time zone | set `CultureInfo.InvariantCulture`, use UTC, test with a fixed culture |
| container not ready | rely on Testcontainers wait strategies |

Process: detect (CI history, retries reported), quarantine (`[Trait("Quarantine", "true")]` + filter it out of the required job, with an issue and an owner), fix within days, un-quarantine. Never "retry until green" silently.

### TDD and legacy code
TDD loop: **red** (write a failing test for the next small behavior) → **green** (simplest code to pass) → **refactor** (clean with tests green). Best for domain logic and bug fixes.

Legacy code (no tests):
1. **Characterization tests**: call the code, record what it does today, and assert that, even if it looks wrong. Now you can refactor safely.
2. **Find seams**: constructor parameters, virtual methods, extracted interfaces where you can substitute dependencies.
3. **Sprout and wrap**: new behavior goes in new, tested classes called from the old code.
4. Snapshot-style approval tests (also seen: Verify) are handy for large outputs like JSON or reports.

### Tests in CI
| Practice | How |
|:--|:--|
| fast feedback | unit tests first; integration tests in a parallel job |
| deterministic environment | `global.json` pins the SDK; locked NuGet restore |
| reports | TRX or JUnit results uploaded; failures annotated on the PR |
| coverage summary | ReportGenerator Markdown in the job summary |
| sharding | split test projects across jobs (matrix) when the suite grows |
| Docker in CI | GitHub-hosted Ubuntu runners have Docker, so Testcontainers just works |

## Example
`.github/workflows/test.yml` (excerpt; full pipelines in [04-ci-cd](../../04-ci-cd/README.md))
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-dotnet@v5
        with:
          global-json-file: global.json
      - run: dotnet restore --locked-mode
      - run: dotnet build --no-restore -c Release
      - run: >
          dotnet test --no-build -c Release
          --logger "trx;LogFileName=results.trx"
          --collect:"XPlat Code Coverage"
          --filter "Quarantine!=true"
      - run: dotnet tool run reportgenerator -reports:**/coverage.cobertura.xml -targetdir:coverage -reporttypes:MarkdownSummaryGithub
      - run: cat coverage/SummaryGithub.md >> "$GITHUB_STEP_SUMMARY"
```
This job runs in VSTest mode (`--logger`, `--collect`, and `--filter` are VSTest options). If `global.json` opts into Microsoft.Testing.Platform, pass platform options after `--` instead: `dotnet test -- --report-trx --coverage --coverage-output-format cobertura --filter-not-trait "Quarantine=true"`.
A characterization test:
```csharp
[Fact]
public void Legacy_invoice_total_is_pinned()
{
    var invoice = LegacyInvoiceCalculator.Calculate(customerType: 3, lines: SampleLines());

    invoice.Total.ShouldBe(118.37m);   // today's behavior, recorded; fix the rule in a separate, intentional change
}
```

## Production patterns
- Coverage gate on new code, not a global 100%.
- A flaky test is a bug with an owner and a deadline.
- Write the failing test for every production bug before fixing it.
- Keep integration tests in their own project so they can run in a separate CI job.

## Mistakes
Wrong: tests written to hit lines.
```csharp
[Fact] public void Covers_service() { new OrderService(...).Process(order); }   // no assert
```
Right: every test asserts an outcome.

Wrong: re-running CI until green.
Right: quarantine with an issue, fix the cause, then remove the quarantine trait.

## Check yourself
1. Coverage went from 70% to 85% after a PR. Does that mean the PR is well tested?
2. What is a characterization test for?
3. Why must quarantined tests have an owner and an issue?

<details><summary>Answers</summary>

1. No. It means more lines ran; only the assertions tell you whether behavior is checked.
2. To pin current behavior of untested code so you can refactor it safely.
3. Otherwise quarantine becomes a graveyard, and the bug the flaky test was hinting at never gets fixed.
</details>

## Sources
- [Code coverage for unit testing (.NET)](https://learn.microsoft.com/dotnet/core/testing/unit-testing-code-coverage)
- [Microsoft.Testing.Platform — code coverage extension](https://learn.microsoft.com/dotnet/core/testing/microsoft-testing-platform-extensions-code-coverage)
- [ReportGenerator](https://github.com/danielpalme/ReportGenerator)
- [Martin Fowler — Eradicating non-determinism in tests](https://martinfowler.com/articles/nonDeterminism.html)
- [Michael Feathers — Working Effectively with Legacy Code (summary)](https://understandlegacycode.com/blog/key-points-of-working-effectively-with-legacy-code/)
