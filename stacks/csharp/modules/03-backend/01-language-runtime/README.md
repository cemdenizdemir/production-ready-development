---
title: Language & Runtime
module: 03-backend
tech: C# 14, .NET 10 LTS
---
# Language & Runtime
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ How .NET runs code: SDK vs runtime, IL, the CLR, JIT and tiered compilation, Native AOT
- [ ] ⭐ Projects and the `dotnet` CLI: SDK-style `.csproj`, `.slnx`, NuGet packages, `new`, `build`, `run`, `watch`
- [ ] ⭐ The C# type system: value vs reference types, structs, classes, records, boxing, equality
- [ ] ⭐ Nullable reference types: annotations, flow analysis, `required` members, and when `!` is a lie
- [ ] Generics, interfaces, delegates, lambdas, and events
- [ ] ⭐ Collections and LINQ: `List<T>`, `Dictionary<TKey, TValue>`, `IEnumerable<T>` vs `IQueryable<T>`, deferred execution
- [ ] Modern C#: pattern matching, switch expressions, primary constructors, collection expressions, C# 14 extension members
- [ ] ⭐ Async and `Task`: the thread pool, `ValueTask`, `CancellationToken`, and why never `async void`
- [ ] ⭐ Thread-pool starvation: sync over async, `.Result` and `.Wait()`, how to detect and fix it
- [ ] Exceptions and resource lifetimes: `throw` vs `throw ex`, exception filters, `IDisposable`, `IAsyncDisposable`, `using`
- [ ] Memory: the garbage collector, generations, large objects, server GC, container limits, `Span<T>` basics
- [ ] ⭐ The generic host: `Program.cs`, `IHostedService`, graceful shutdown on SIGTERM, exit codes
- [ ] ⭐ Debugging: breakpoints, conditional breakpoints, watches, the call stack, Hot Reload
- [ ] Diagnostics: `dotnet-counters`, `dotnet-trace`, `dotnet-dump`, profiling in Visual Studio
- [ ] .NET release lines (LTS, STS, EOL), `global.json`, and upgrading target frameworks
- [ ] Runtime security: keeping .NET patched, trimming and reflection, `unsafe` code

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · How .NET runs code, the dotnet CLI, and release lines](docs/01-runtime-cli-releases.md)
- [02 · The C# type system: values, references, records, nullability, generics](docs/02-type-system.md)
- [03 · Collections, LINQ, and modern C#](docs/03-collections-linq-modern.md)
- [04 · Async, Task, cancellation, and thread-pool starvation](docs/04-async-threadpool.md)
- [05 · Exceptions, resource lifetimes, and memory](docs/05-exceptions-resources-memory.md)
- [06 · The generic host, debugging, diagnostics, and runtime security](docs/06-host-debug-diagnostics.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/03-backend/01-language-runtime mode=tasks` when you are ready to build._
