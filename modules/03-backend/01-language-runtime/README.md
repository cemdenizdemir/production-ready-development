---
title: Language & Runtime
module: 03-backend
tech: Node.js 26, TypeScript 6 (strict)
---
# Language & Runtime
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ How Node works: V8, libuv, event loop phases, and the thread pool
- [ ] ⭐ Blocking the event loop: what blocks, how to detect it, and how to fix it
- [ ] ⭐ Async patterns and error handling: promises, unhandled rejections, `AbortSignal`
- [ ] Modules in Node: ESM, CommonJS interop, `require(esm)`, package `exports` and `imports`
- [ ] ⭐ Running TypeScript on Node 26: type stripping, `erasableSyntaxOnly`, and when to compile
- [ ] Streams and backpressure: `pipeline`, Web Streams, large data
- [ ] Built-in modules worth knowing: `fs/promises`, `crypto`, `util`, `AsyncLocalStorage`, `node:test`
- [ ] ⭐ Process lifecycle: signals, graceful shutdown, exit codes, `uncaughtException`
- [ ] Memory: the V8 heap, leaks, heap snapshots, container memory limits
- [ ] Profiling and diagnostics: `--inspect`, CPU profiles, event loop delay, diagnostic reports
- [ ] Node release lines (LTS, Current, EOL) and version management
- [ ] Runtime security: permission model, code-generation limits, keeping Node patched

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Node's architecture, the event loop, and blocking](docs/01-node-architecture-event-loop.md)
- [02 · Async errors and the process lifecycle](docs/02-async-errors-lifecycle.md)
- [03 · Modules, TypeScript on Node, and release lines](docs/03-modules-typescript-versions.md)
- [04 · Streams, built-ins, memory, and runtime security](docs/04-streams-builtins-memory-security.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 03-backend/01-language-runtime mode=tasks` when you are ready to build._
