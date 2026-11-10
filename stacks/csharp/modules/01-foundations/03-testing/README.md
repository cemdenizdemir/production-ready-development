---
title: Testing
module: 01-foundations
tech: xUnit v3, WebApplicationFactory, Testcontainers, Shouldly, NSubstitute
---
# Testing
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Why we test, and the shape of a suite: unit, integration, end-to-end
- [ ] ⭐ Good tests: Arrange-Act-Assert, one behavior per test, clear names
- [ ] xUnit v3 basics: `[Fact]`, `[Theory]` with `InlineData` and `MemberData`, Shouldly assertions, `dotnet test`
- [ ] ⭐ Test doubles: stubs, spies, mocks, fakes, and when not to mock
- [ ] Doubles in .NET: NSubstitute, `TimeProvider` with `FakeTimeProvider`, seams for randomness and I/O
- [ ] ⭐ Testing async code, errors, and edge cases
- [ ] ⭐ HTTP integration tests with `WebApplicationFactory` against the ASP.NET Core app
- [ ] ⭐ Real databases in tests with Testcontainers (SQL Server); isolation and cleanup
- [ ] Fixtures, factories, and test data builders
- [ ] Coverage: what it measures, thresholds, and why 100% is not the goal
- [ ] Flaky tests: causes, quarantine, and fixes
- [ ] Test-driven development and testing legacy code (characterization tests)
- [ ] Tests in CI: fast feedback, sharding, and reports
- [ ] Shared setup in xUnit: class and collection fixtures, `IAsyncLifetime`, parallelism
- [ ] Running tests: Microsoft.Testing.Platform vs VSTest, filters, and `dotnet watch test`

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Why we test, good tests, and xUnit v3 basics](docs/01-why-good-tests-xunit.md)
- [02 · Test doubles with NSubstitute and TimeProvider](docs/02-test-doubles.md)
- [03 · Async code, errors, edge cases, and test data](docs/03-async-errors-data.md)
- [04 · Integration tests: WebApplicationFactory and Testcontainers](docs/04-integration-tests.md)
- [05 · Coverage, flaky tests, TDD, legacy code, and CI](docs/05-coverage-flaky-tdd-ci.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/01-foundations/03-testing mode=tasks` when you are ready to build._
