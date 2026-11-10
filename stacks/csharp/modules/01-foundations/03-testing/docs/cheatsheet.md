---
title: Testing cheatsheet
tech: xUnit v3, WebApplicationFactory, Testcontainers, Shouldly, NSubstitute
version: xunit.v3 3.2.x, Microsoft.AspNetCore.Mvc.Testing 10.0.x, Testcontainers.MsSql 4.14, Shouldly 4.x, NSubstitute 5.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
---
# Testing cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Suite shape
| Level | Scope | Tool |
|:--|:--|:--|
| ⭐ Unit | pure logic, no I/O | xUnit + Shouldly |
| ⭐ Integration | HTTP → app → real SQL Server | WebApplicationFactory + Testcontainers |
| E2E | browser → frontend → API | Playwright (02-frontend/13) |
| Contract | API shape vs client | OpenAPI diff in CI |
| Load | throughput, latency | k6 (03-backend/09) |

## Project setup
| Command / package | What it does | Note |
|:--|:--|:--|
| `dotnet new install xunit.v3.templates` | install v3 templates | once |
| ⭐ `dotnet new xunit3 -n X.Tests` | new v3 test project | executable project |
| `xunit.v3` | framework package | 3.2.x |
| `xunit.runner.visualstudio` | VSTest adapter | IDE + `dotnet test` (VSTest) |
| `Shouldly` | assertions | free, MIT/BSD |
| `NSubstitute` + `NSubstitute.Analyzers.CSharp` | substitutes + analyzer | |
| `Microsoft.Extensions.TimeProvider.Testing` | `FakeTimeProvider` | |
| ⭐ `Microsoft.AspNetCore.Mvc.Testing` | `WebApplicationFactory<T>` | |
| ⭐ `Testcontainers.MsSql` | SQL Server container | needs Docker |
| `Microsoft.Testing.Extensions.CodeCoverage` | coverage on MTP | |
| `coverlet.collector` | coverage on VSTest | |
| `dotnet-reportgenerator-globaltool` | HTML/Markdown reports | local tool |

## xUnit v3 attributes and APIs
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `[Fact]` | parameterless test | |
| ⭐ `[Theory]` | parameterized test | |
| `[InlineData(1, "a")]` | inline row | constants only (no `decimal`) |
| ⭐ `[MemberData(nameof(Cases))]` | rows from a member | |
| `TheoryData<T1, T2>` | typed rows | |
| `[ClassData(typeof(T))]` | rows from a class | |
| `[Trait("Category", "Slow")]` | tag | filter on it |
| `[Fact(Skip = "why")]` | static skip | |
| `Assert.Skip` / `SkipWhen` / `SkipUnless` | dynamic skip | v3 |
| `[Fact(Explicit = true)]` | only when explicitly run | v3 |
| `[Fact(Timeout = 5000)]` | per-test timeout (ms) | async tests |
| ⭐ `TestContext.Current.CancellationToken` | run cancellation | v3; analyzer xUnit1051 |
| `ITestOutputHelper` | test output | constructor or `TestContext.Current.TestOutputHelper` |
| `Assert.Multiple(...)` | several asserts, all reported | built-in alternative |

## Fixtures and lifetimes
| Mechanism | Scope | Note |
|:--|:--|:--|
| constructor + `IDisposable` | per test | new instance per test |
| ⭐ `IAsyncLifetime` | async setup/teardown | `ValueTask` in v3 |
| `IClassFixture<T>` | per class | constructor-injected |
| `ICollectionFixture<T>` + `[CollectionDefinition]` | per collection | serial within collection |
| `[Collection("db")]` | put class in collection | |
| ⭐ `[assembly: AssemblyFixture(typeof(T))]` | per test assembly | v3 |
| `xunit.runner.json` | runner settings | `parallelizeTestCollections`, `maxParallelThreads` |
| `parallelAlgorithm` | conservative / aggressive | v3 |

## Shouldly
| Assertion | Checks | Note |
|:--|:--|:--|
| ⭐ `x.ShouldBe(y)` | equality | tolerance overloads for doubles/dates |
| `x.ShouldNotBe(y)` | inequality | |
| ⭐ `x.ShouldNotBeNull()` | not null | returns non-null value |
| `x.ShouldBeNull()` | null | |
| `x.ShouldBeEquivalentTo(y)` | deep equality | |
| `list.ShouldContain(pred)` | any match | |
| `list.ShouldBeEmpty()` / `ShouldHaveSingleItem()` | count checks | |
| `list.ShouldAllBe(pred)` | all match | |
| `s.ShouldStartWith("x")` / `ShouldContain` | strings | case options |
| `x.ShouldBeOfType<T>()` | exact type | returns `T` |
| `n.ShouldBeInRange(a, b)` / `ShouldBeGreaterThan` | ranges | |
| ⭐ `Should.Throw<T>(() => …)` | sync exception | returns the exception |
| ⭐ `await Should.ThrowAsync<T>(() => …)` | async exception | |
| `Should.NotThrow(() => …)` | no exception | |
| `x.ShouldSatisfyAllConditions(...)` | grouped checks | |

## NSubstitute
| Want | Code | Note |
|:--|:--|:--|
| ⭐ create | `Substitute.For<IGateway>()` | interfaces / virtual members |
| ⭐ return | `sub.Get(1).Returns(x)` | |
| sequence | `.Returns(a, b, c)` | successive calls |
| computed | `.Returns(ci => ci.Arg<int>() * 2)` | |
| any args | `.ReturnsForAnyArgs(x)` | |
| ⭐ arg matchers | `Arg.Any<T>()`, `Arg.Is<T>(p)` | |
| capture | `Arg.Do<T>(v => captured = v)` | |
| throw | `.Throws(ex)` / `.ThrowsAsync(ex)` | `NSubstitute.ExceptionExtensions` |
| ⭐ verify | `await sub.Received(1).Charge(...)` | |
| verify none | `sub.DidNotReceive().X()` / `DidNotReceiveWithAnyArgs()` | |
| clear | `sub.ClearReceivedCalls()` | |
| partial | `Substitute.ForPartsOf<T>()` | use sparingly |

## Doubles and seams
| Item | Use | Note |
|:--|:--|:--|
| Dummy / stub / spy / mock / fake | kinds of doubles | |
| ⭐ `TimeProvider.System` | production clock | inject, don't call `DateTime.UtcNow` |
| ⭐ `FakeTimeProvider` | controllable clock | `Advance`, `SetUtcNow` |
| `NullLogger<T>.Instance` | silent logger | |
| `FakeLogger` | captured logs | `Microsoft.Extensions.Diagnostics.Testing` |
| fake `HttpMessageHandler` | canned HTTP responses | for typed clients |
| in-memory fake | e.g. email outbox | behavior-rich doubles |
| Don't mock | `DbContext`, domain objects, types you don't own | |

## Async, errors, data
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ `async Task` tests | always await | no `async void` |
| `.Result` / `.Wait()` | avoid | deadlocks, `AggregateException` |
| cancellation test | cancelled token → `OperationCanceledException` | `CancelAsync()` |
| ⭐ assert error codes | not full messages | stable |
| edge cases | 0, negative, max, empty, null, Unicode, DST | |
| ⭐ test data builder | valid defaults, override what matters | |
| object mother | named scenarios | `TestOrders.Shipped()` |
| `record with { … }` | quick variants | |
| `Guid.CreateVersion7()` | unique, ordered IDs | .NET 9+ |

## WebApplicationFactory
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `WebApplicationFactory<Program>` | app in memory | TestServer |
| `public partial class Program` | visible entry point | generated in .NET 10 |
| ⭐ `CreateClient()` | `HttpClient` to the app | handles cookies |
| `CreateClient(new() { AllowAutoRedirect = false })` | see redirects | |
| `WithWebHostBuilder(b => …)` | customized variant | |
| `UseEnvironment("Testing")` | environment | |
| ⭐ `UseSetting(key, value)` | config override | connection strings |
| ⭐ `ConfigureTestServices(s => …)` | replace services | runs after app's |
| `Factory.Services.CreateScope()` | resolve `DbContext` | arrange/assert |
| `PostAsJsonAsync` / `GetFromJsonAsync<T>` | JSON helpers | `System.Net.Http.Json` |
| test auth handler | fake authenticated user | `AddAuthentication("Test")` |

## Testcontainers
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `new MsSqlBuilder().WithImage(...)` | SQL Server container | `2025-latest` |
| `.Build()` / `StartAsync()` / `DisposeAsync()` | lifecycle | |
| ⭐ `GetConnectionString()` | connect | |
| `RedisBuilder` | Redis container | `Testcontainers.Redis` |
| `AzuriteBuilder` | Blob/Queue emulator | `Testcontainers.Azurite` |
| `ServiceBusBuilder` | Service Bus emulator | `Testcontainers.ServiceBus` |
| wait strategies | ready checks | built into modules |
| `TESTCONTAINERS_RYUK_DISABLED` | disable reaper | only where required |
| ⭐ one container per assembly | speed | assembly fixture |

## Data isolation
| Strategy | Note |
|:--|:--|
| ⭐ unique data per test | parallel-safe |
| rollback transaction | same connection needed |
| reset tables between tests | serial collection |
| database per class | strongest, slower |
| ⭐ `Database.MigrateAsync()` in fixture | tests migrations too |
| EF Core in-memory provider | avoid for integration tests |

## Running tests
| Command | What it does | Note |
|:--|:--|:--|
| ⭐ `dotnet test` | build + run | solution or project |
| `dotnet test --no-build -c Release` | CI after build | |
| ⭐ `--filter "FullyQualifiedName~Order"` | VSTest filter | |
| `--filter "Category=Slow"` / `"Quarantine!=true"` | trait filter | VSTest |
| `-- --filter-class` / `--filter-method` / `--filter-trait` | xUnit v3 on MTP | after `--` |
| `--filter-not-trait "Quarantine=true"` | exclude trait | MTP |
| `dotnet watch test` | rerun on save | |
| `dotnet run --project X.Tests` | run v3 test exe | |
| `global.json` `"test": { "runner": "Microsoft.Testing.Platform" }` | MTP mode | .NET 10 SDK |
| `--logger "trx"` / `-- --report-trx` | results file | VSTest / MTP |
| `--blame-hang-timeout 5m` | dump on hangs | VSTest |

## Coverage and quality
| Item | What it does | Note |
|:--|:--|:--|
| line / branch coverage | what ran | not what was checked |
| `--collect:"XPlat Code Coverage"` | coverlet (VSTest) | |
| `-- --coverage --coverage-output-format cobertura` | MTP coverage | |
| ⭐ ReportGenerator | HTML / Markdown summary | `$GITHUB_STEP_SUMMARY` |
| gate on changed code | sensible threshold | not global 100% |
| Stryker.NET | mutation testing | also seen |
| Verify | snapshot / approval tests | also seen |

## Flaky tests and legacy code
| Item | Fix / meaning | Note |
|:--|:--|:--|
| real time | `FakeTimeProvider` | |
| shared data | unique data / collections | |
| order dependence | self-contained arrange | |
| culture | `InvariantCulture`, UTC | |
| ⭐ quarantine | trait + issue + owner | not silent retries |
| ⭐ characterization test | pin current behavior | before refactoring |
| seam | place to substitute behavior | constructor, interface |
| sprout / wrap | new tested code beside old | |
| ⭐ TDD | red → green → refactor | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `async void` test | errors lost | `async Task` |
| Missing `await` | asserts before work | await everything |
| `decimal` in `[InlineData]` | not allowed in attributes | `TheoryData<decimal, …>` |
| EF in-memory provider | false confidence | Testcontainers SQL Server |
| Container per class | slow, memory | assembly fixture |
| Parallel tests deleting shared rows | random failures | unique data |
| Mocking `DbContext` | tests nothing real | real DB |
| `--logger` with MTP | ignored or error | `-- --report-trx` |
| Request timeouts while debugging | don't fire | test without debugger |
| FluentAssertions 8+ in a company | licence needed | Shouldly |

## Sources
| Source | Link |
|:--|:--|
| xUnit.net v3 | https://xunit.net/docs/getting-started/v3/whats-new |
| ASP.NET Core integration tests | https://learn.microsoft.com/aspnet/core/test/integration-tests |
| Testcontainers for .NET | https://dotnet.testcontainers.org/ |
| Microsoft.Testing.Platform | https://learn.microsoft.com/dotnet/core/testing/microsoft-testing-platform-intro |
| Unit testing best practices | https://learn.microsoft.com/dotnet/core/testing/unit-testing-best-practices |
| Shouldly | https://docs.shouldly.org/ |
| NSubstitute | https://nsubstitute.github.io/ |
| TimeProvider | https://learn.microsoft.com/dotnet/api/system.timeprovider |
| ReportGenerator | https://github.com/danielpalme/ReportGenerator |
