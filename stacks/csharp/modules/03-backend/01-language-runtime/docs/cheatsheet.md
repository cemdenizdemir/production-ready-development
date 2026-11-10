---
title: Language & Runtime cheatsheet
tech: C# 14, .NET 10 LTS
version: .NET 10.0.14 (SDK 10.0.402), C# 14
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
---
# Language & Runtime cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Runtime
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ IL | compiled C# in assemblies | `.dll` |
| ⭐ CLR | runtime: JIT, GC, types, threads | |
| JIT + tiered compilation | tier 0 fast, tier 1 optimized | default |
| Dynamic PGO | profile-guided optimization | on by default |
| ReadyToRun | precompiled code, faster startup | `PublishReadyToRun` |
| ⭐ Native AOT | native exe, no JIT | `PublishAot`; trimming limits |
| `CreateSlimBuilder` | minimal host for AOT | |
| BCL | base class library | |
| shared framework | `Microsoft.AspNetCore.App` | aspnet image |

## dotnet CLI
| Command | Does | Note |
|:--|:--|:--|
| `dotnet --info` / `--list-sdks` / `--list-runtimes` | what's installed | |
| ⭐ `dotnet new webapi -n X` | new project | `classlib`, `worker`, `xunit3` |
| `dotnet new sln` / `dotnet sln add` | solution (.slnx) | |
| ⭐ `dotnet package add X` | NuGet package | .NET 10 noun-first; `add package` too |
| `dotnet reference add ../Y` | project reference | |
| ⭐ `dotnet build` / `test` / `run` | inner loop | |
| ⭐ `dotnet watch` | hot reload | |
| `dotnet publish -c Release -o out` | deployable | |
| `dotnet tool install -g dotnet-ef` | global tool | `dotnet tool restore` for local |
| `dotnet run app.cs` | file-based app | .NET 10, `#:package` |
| `dotnet new globaljson` | pin SDK | |

## Release lines
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ LTS | 3 years | .NET 10 → Nov 2028 |
| STS | 2 years | .NET 11 (Nov 2026) |
| .NET 8 / 9 | end of support 2026-11-10 | upgrade |
| patches | monthly | rebuild images |
| `TargetFramework` | `net10.0` | TFM |
| `rollForward` | `latestFeature`, `latestPatch`, `disable`… | `global.json` |
| breaking changes docs | per release | read before upgrading |

## Types
| Type | Kind | Note |
|:--|:--|:--|
| `int` / `long` | 32/64-bit integers | `checked` for overflow |
| `double` | binary float | not money |
| ⭐ `decimal` | exact base-10 | money |
| `bool`, `char` | | |
| ⭐ `DateTimeOffset` | instant with offset | |
| ⭐ `DateOnly` / `TimeOnly` | date / time of day | |
| `Guid`, `Guid.CreateVersion7()` | IDs | v7 time-ordered (.NET 9+), not in SQL Server sort order |
| `string` | immutable reference | value equality |
| `T?` (value type) | `Nullable<T>` | `HasValue` |
| `T?` (reference type) | nullable annotation | compile-time |
| boxing | value → object | allocation |

## Classes, structs, records
| Kind | Use | Equality |
|:--|:--|:--|
| ⭐ `sealed class` | entities, services | reference |
| ⭐ `record` | DTOs, messages, value objects | value |
| `readonly record struct` | small values | value, no alloc |
| `struct` | tiny values | copy semantics |
| `with` | non-destructive copy | records/structs |
| `ref struct` | stack-only (`Span<T>`) | no heap |
| `static class` | helpers, extensions | |

## Generics and functions
| Item | Example | Note |
|:--|:--|:--|
| constraints | `where T : class, new(), IEntity, notnull` | |
| generic math | `where T : INumber<T>` | .NET 7+ |
| variance | `IEnumerable<out T>`, `Action<in T>` | |
| `Func<T, TResult>` / `Action<T>` / `Predicate<T>` | delegates | |
| lambdas | `x => x.Total > 100` | closures |
| events | `event EventHandler<T>` | unsubscribe |
| static abstract interface members | factories, math | |
| default interface members | bodies in interfaces | rare |

## Collections
| Type | Use | Note |
|:--|:--|:--|
| ⭐ `List<T>` | ordered list | |
| ⭐ `Dictionary<K,V>` | lookup | `TryGetValue` |
| `HashSet<T>` | membership | |
| `Queue` / `Stack` / `PriorityQueue` | FIFO/LIFO/priority | |
| `ImmutableArray<T>` | never changes | |
| `FrozenDictionary` / `FrozenSet` | read-optimized | .NET 8+ |
| `ConcurrentDictionary` | thread-safe | |
| ⭐ `IReadOnlyList<T>` | return type | |
| `Channel<T>` | async producer/consumer | 03-backend/07 |

## LINQ
| Operator | Does | Note |
|:--|:--|:--|
| `Where` / `Select` / `SelectMany` | filter/project/flatten | |
| `OrderBy` / `ThenBy` | sort | |
| `GroupBy` / `CountBy` / `AggregateBy` | group | .NET 9 |
| `Join` / `LeftJoin` / `RightJoin` | joins | .NET 10 |
| `Any` / `All` / `Contains` | tests | |
| `First` / `Single` (+`OrDefault`) | pick | Single throws on 2+ |
| `Sum` / `Count` / `MinBy` / `MaxBy` | aggregate | |
| `DistinctBy` / `Chunk` / `Zip` / `Index` | misc | |
| ⭐ deferred execution | runs on enumeration | CA1851 |
| ⭐ `IQueryable` vs `IEnumerable` | SQL vs memory | EF Core |

## Modern C#
| Feature | Example | Version |
|:--|:--|:--|
| ⭐ switch expression | `x switch { A => 1, _ => 0 }` | 8 |
| ⭐ patterns | `is { Status: "Paid" }`, `is > 0 and < 10`, `[a, .. rest]` | 8–11 |
| `required` / `init` | required props | 11 / 9 |
| raw strings | `"""…"""` | 11 |
| ⭐ primary constructors | `class S(ShopDb db)` | 12 |
| ⭐ collection expressions | `[1, 2, .. more]` | 12 |
| `params` collections | `params ReadOnlySpan<T>` | 13 |
| `Lock` type | `private readonly Lock _gate = new();` | 13 |
| ⭐ extension members | `extension(Order o) { … }` | 14 |
| `field` keyword | `set => field = value.Trim()` | 14 |
| null-conditional assignment | `a?.B = c` | 14 |
| `nameof(List<>)` | unbound generics | 14 |

## Async
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `async Task` / `Task<T>` | async methods | |
| `ValueTask<T>` | often-synchronous results | await once |
| `IAsyncEnumerable<T>` + `await foreach` | async streams | |
| ⭐ `Task.WhenAll` | parallel awaits | |
| `Task.WhenAny` / `Task.WhenEach` | first / as completed | .NET 9 |
| `Parallel.ForEachAsync` | bounded parallelism | |
| `SemaphoreSlim.WaitAsync` | throttle | |
| `TaskCompletionSource` | manual task | `RunContinuationsAsynchronously` |
| `ConfigureAwait(false)` | libraries | not needed in ASP.NET Core apps |
| `async void` | event handlers only | |

## Cancellation
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `CancellationToken` param | endpoint gets `RequestAborted` | pass everywhere |
| `CancellationTokenSource.CreateLinkedTokenSource(ct)` | combine | |
| `cts.CancelAfter(ts)` | deadline | |
| `ct.ThrowIfCancellationRequested()` | check in loops | |
| `OperationCanceledException` | thrown on cancel | not an error log |

## Thread pool
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ starvation | blocked threads, growing queue | high latency, low CPU |
| `.Result` / `.Wait()` / `GetAwaiter().GetResult()` | sync over async | avoid |
| sync I/O, `Thread.Sleep` | blocking | async versions |
| injection rate | ~1–2 threads/s above min | slow |
| `ThreadPool.SetMinThreads` | band-aid | fix the cause |
| CA1849 / VSTHRD002 | analyzers | |

## Exceptions
| Item | Use | Note |
|:--|:--|:--|
| ⭐ `throw;` | rethrow, keep stack | not `throw ex;` |
| inner exception | `new X("…", ex)` | context |
| filters | `catch (E e) when (cond)` | |
| `ArgumentNullException.ThrowIfNull` | guards | |
| `ArgumentOutOfRangeException.ThrowIfNegativeOrZero` | guards | |
| `InvalidOperationException` | wrong state | |
| domain exceptions | business rules | → 409/422 |
| `Try*` patterns | expected failures | no exceptions |

## Resources and memory
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `using` / `await using` | dispose at scope end | |
| `IDisposable` / `IAsyncDisposable` | cleanup contracts | |
| DI owns injected disposables | don't dispose them | |
| gen0 / gen1 / gen2 / LOH | GC generations | LOH ≥ 85 KB |
| server GC + DATAS | default for ASP.NET Core | container-friendly |
| GC heap hard limit | ~75% of container memory | configurable |
| ⭐ `Span<T>` / `ReadOnlySpan<T>` | slices without copies | not across `await` |
| `Memory<T>` | async-safe slices | |
| `ArrayPool<T>.Shared` | reuse buffers | return in `finally` |
| `StringBuilder` | build strings in loops | |
| leak sources | statics, events, unbounded caches | |

## Generic host
| Item | Does | Note |
|:--|:--|:--|
| `WebApplication.CreateBuilder` | host + Kestrel | |
| ⭐ `BackgroundService.ExecuteAsync(stoppingToken)` | background loops | honor token |
| `PeriodicTimer` | async timer | |
| `IServiceScopeFactory.CreateAsyncScope()` | scoped services in workers | |
| `IHostApplicationLifetime` | lifecycle tokens | |
| ⭐ `HostOptions.ShutdownTimeout` | stop budget (30 s) | < platform grace |
| `BackgroundServiceExceptionBehavior` | `StopHost` default | |
| SIGTERM | graceful shutdown | containers |

## Debugging
| Item | Where | Note |
|:--|:--|:--|
| F5 / breakpoints / conditional / hit count | VS Code, VS | |
| logpoints / tracepoints | log without stopping | |
| exception breakpoints | break on thrown | |
| ⭐ Hot Reload | `dotnet watch`, VS | |
| Tasks / Parallel Stacks | async chains | VS |
| attach to process/container | remote debugging | |
| Source Link | step into packages | |

## Diagnostics
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ `dotnet-counters monitor -n App` | live metrics | thread pool, GC, requests |
| `dotnet-trace collect --profile cpu-sampling` | CPU traces | speedscope/PerfView/VS |
| ⭐ `dotnet-dump collect` / `analyze` | process dump | `clrthreads`, `clrstack -all`, `dumpheap -stat`, `gcroot` |
| `dotnet-gcdump` | heap snapshot | leaks |
| `dotnet-monitor` | sidecar collection | containers |
| VS Performance Profiler | CPU/memory/async | |
| App Insights Profiler / Snapshot Debugger | production | Azure |

## Runtime security
| Item | Practice | Note |
|:--|:--|:--|
| ⭐ monthly patches | rebuild images | `10.0` tags |
| supported versions | LTS | |
| NuGet Audit | package vulns | |
| non-root images | default since .NET 8 | `app` user |
| `RandomNumberGenerator` | secure random | |
| `CryptographicOperations.FixedTimeEquals` | constant-time compare | |
| `AllowUnsafeBlocks` | `unsafe` code | avoid |
| no type loading from input | reflection risks | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `.Result` in request path | starvation | `await` |
| `double` money | rounding | `decimal` |
| mutable structs | lost updates | readonly records |
| `AsEnumerable()` early | loads everything | stay `IQueryable` |
| multiple enumeration | repeated queries | materialize once |
| `throw ex;` | lost stack | `throw;` |
| `new HttpClient()` per call | sockets | `IHttpClientFactory` |
| scoped service in BackgroundService ctor | captive dependency | scope per iteration |
| ignoring `stoppingToken` | killed mid-work | honor it |
| one DbContext, parallel queries | exceptions | one query at a time |

## Sources
| Source | Link |
|:--|:--|
| .NET docs | https://learn.microsoft.com/dotnet/ |
| C# 14 | https://learn.microsoft.com/dotnet/csharp/whats-new/csharp-14 |
| .NET 10 | https://learn.microsoft.com/dotnet/core/whats-new/dotnet-10/overview |
| Support policy | https://dotnet.microsoft.com/platform/support/policy/dotnet-core |
| Async programming | https://learn.microsoft.com/dotnet/csharp/asynchronous-programming/ |
| Thread-pool starvation | https://learn.microsoft.com/dotnet/core/diagnostics/debug-threadpool-starvation |
| GC fundamentals | https://learn.microsoft.com/dotnet/standard/garbage-collection/fundamentals |
| Generic host | https://learn.microsoft.com/dotnet/core/extensions/generic-host |
| Diagnostic tools | https://learn.microsoft.com/dotnet/core/diagnostics/tools-overview |
