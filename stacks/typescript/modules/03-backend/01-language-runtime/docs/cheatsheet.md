---
title: Language & Runtime cheatsheet
tech: Node.js 26, TypeScript 6 (strict)
version: Node.js 26 LTS (Lithium), V8 14.6, TypeScript 6.0
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Language & Runtime cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Architecture
| Part | What it is | Note |
|:--|:--|:--|
| ⭐ V8 | JS engine: JIT, heap, GC | 14.6 in Node 26 |
| ⭐ libuv | event loop, async I/O, thread pool | |
| ⭐ Thread pool | fs, `dns.lookup`, pbkdf2/scrypt, zlib | 4 threads default |
| `UV_THREADPOOL_SIZE` | thread pool size | env var, max 1024 |
| ⭐ Main thread | runs all your JS | keep callbacks short |
| Undici | HTTP client behind `fetch` | v8 in Node 26 |
| N-API | native addon interface | |

## Event loop
| Phase / queue | Runs |
|:--|:--|
| timers | `setTimeout`, `setInterval` callbacks |
| pending callbacks | some deferred I/O callbacks |
| ⭐ poll | I/O callbacks (sockets, files) |
| check | `setImmediate` |
| close | `'close'` events |
| ⭐ `process.nextTick` queue | after each callback, before promises |
| ⭐ Microtasks | promise callbacks, after nextTick |
| `queueMicrotask(fn)` | schedule a microtask |
| `setImmediate` vs `setTimeout(0)` | check phase vs timers phase |

## Blocking and fixes
| Blocker | Fix |
|:--|:--|
| ⭐ `*Sync` APIs in handlers | async APIs |
| ⭐ Huge `JSON.parse`/`stringify` | stream, paginate, body limits |
| CPU-heavy work | worker threads / job queue |
| ⭐ ReDoS regexes | safe patterns, input length limits |
| Big loops | chunk with `setImmediate` |
| Thread pool saturation | larger pool, fewer heavy fs/crypto calls |

## Diagnostics
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ `monitorEventLoopDelay()` | loop lag histogram | alert on p99 |
| ⭐ `--inspect` / `--inspect-brk` | debugger, profiler | bind to localhost |
| `--cpu-prof` / `--heap-prof` | profiles on exit | open in DevTools |
| ⭐ `--heapsnapshot-signal=SIGUSR2` | snapshot on demand | |
| `--heapsnapshot-near-heap-limit=N` | snapshot before OOM | |
| `process.report.writeReport()` | diagnostic report | |
| `--trace-warnings` / `--trace-uncaught` / `--trace-sync-io` | extra traces | |
| `diagnostics_channel` | internal event hooks | OTel uses it |
| `performance.mark/measure` / `PerformanceObserver` | timings | |
| `--trace-gc` | GC activity | |
| clinic.js | Doctor/Flame/Bubbleprof | also seen |

## Async and errors
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Always await/return promises | no unhandled rejections | lint `no-floating-promises` |
| ⭐ `--unhandled-rejections=throw` | default: crash | keep it |
| ⭐ Operational vs programmer errors | handle vs crash | |
| ⭐ `AbortSignal.timeout(ms)` / `AbortSignal.any()` | deadlines, combined signals | |
| `timers/promises` `setTimeout(ms, v, { signal })` | cancellable sleep | |
| `events.once(emitter, name, { signal })` | await an event | |
| `events.on(emitter, name)` | async iterator of events | |
| `'error'` listener | required on long-lived emitters | otherwise throws |
| `Promise.withResolvers()` | external resolve | |
| `util.promisify` | callback → promise | |
| `util.aborted(signal, resource)` | await abort | |

## Process lifecycle
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `SIGTERM` | graceful stop request | deploys, scale-in |
| `SIGINT` | Ctrl+C | |
| `SIGKILL` | forced, unhandleable | after stop timeout |
| ⭐ `server.close()` | stop new connections | waits for in-flight |
| `server.closeIdleConnections()` / `closeAllConnections()` | drop keep-alive sockets | |
| ⭐ Shutdown deadline | < platform stop timeout | ECS default 30 s |
| `process.exitCode = 1` | exit code without cutting writes | prefer over `exit()` |
| `uncaughtException` / `unhandledRejection` | last-chance hooks | log, shut down, exit 1 |
| Exit 137 / 143 | SIGKILL (often OOM) / SIGTERM | 128 + signal |
| ⭐ `node` as PID 1 | receives signals | not `pnpm start` |
| `docker run --init` / tini | signal forwarding, zombie reaping | |
| `.unref()` on timers | don't keep process alive | |

## Modules
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `"type": "module"` | `.js` = ESM | |
| `.mjs` / `.cjs` | force ESM / CJS | |
| ⭐ Explicit extensions | `./db.ts` | ESM requirement |
| `import.meta.dirname` / `filename` | path helpers | Node 20.11+ |
| `require(esm)` | CJS can load sync ESM | Node 20.19+/22.12+ |
| ⭐ `exports` field | public entry points | conditions: types/import/require/default |
| ⭐ `imports` field | `#src/*` runtime aliases | replaces tsconfig paths |
| `createRequire(import.meta.url)` | `require` inside ESM | |
| JSON imports | `with { type: 'json' }` | |
| `process.getBuiltinModule('fs')` | load built-ins dynamically | |

## TypeScript on Node 26
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Type stripping | runs `.ts` by erasing types | no flags |
| ⭐ Erasable syntax only | no enum, namespace, parameter properties | `erasableSyntaxOnly` |
| ⭐ `import type` | type-only imports | `verbatimModuleSyntax` |
| No tsconfig at runtime | Node ignores it | `paths` won't work |
| ⭐ `tsc --noEmit` | type-check in CI | |
| `--experimental-transform-types` | enums etc. | avoid |
| `rewriteRelativeImportExtensions` | emit `.js` imports when compiling | libraries |
| `allowImportingTsExtensions` | allow `.ts` in imports | with noEmit |
| `.ts` in node_modules | not stripped | publish JS |
| tsx | dev runner with full TS | also seen |

## Release lines (Nov 2026)
| Version | Status |
|:--|:--|
| ⭐ Node 26 "Lithium" | Active LTS → April 2029 |
| Node 24 "Krypton" | Maintenance LTS |
| Node 22 "Jod" | Maintenance LTS |
| Node 20 | End of life (April 2026) |
| Node 27+ | one major per year |
| Even majors | become LTS in October |
| ⭐ Pin versions | `.nvmrc`, `engines`, Docker tag |
| Version managers | fnm, nvm, mise |
| Corepack | not bundled since Node 25 |

## Streams
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `pipeline(...streams)` | connect with backpressure + cleanup | `node:stream/promises` |
| `finished(stream)` | await end/error | |
| `for await (const chunk of readable)` | consume with backpressure | |
| `Readable.from(iterable)` | stream from data | |
| `Transform` | modify chunks | `objectMode` |
| ⭐ Backpressure | `write()` false → wait `'drain'` | |
| `Readable.fromWeb` / `toWeb` | Web Streams interop | `fetch` bodies |
| `highWaterMark` | buffer size | |
| `pg-query-stream` / cursors | stream DB rows | |
| `zlib.createGzip()` / `createBrotliCompress()` | compression streams | |

## Built-ins
| Module | Highlights |
|:--|:--|
| `node:fs/promises` | `readFile`, `writeFile`, `open`, `mkdir`, `rm`, `watch` |
| ⭐ `node:crypto` | `randomUUID`, `randomBytes`, `createHash`, `createHmac`, `timingSafeEqual`, `scrypt`, `subtle` |
| `node:path` / `node:url` | `join`, `resolve`, `fileURLToPath` |
| `node:util` | `parseArgs`, `styleText`, `inspect`, `types`, `parseEnv`, `debuglog` |
| ⭐ `node:async_hooks` | `AsyncLocalStorage` |
| `node:worker_threads` | `Worker`, `parentPort`, `MessageChannel` |
| `node:child_process` | `execFile`, `spawn` |
| `node:events` | `EventEmitter`, `once`, `on` |
| `node:os` | `availableParallelism()`, `cpus()`, `totalmem()` |
| `node:test` / `node:assert` | built-in runner |
| `node:sqlite` | `DatabaseSync` |
| `node:zlib` | gzip, brotli |
| Globals | `fetch`, `WebSocket`, `URLPattern`, `Temporal`, `structuredClone`, `navigator` |

## Memory
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `--max-old-space-size=MB` | heap limit | ~75% of container memory |
| `process.memoryUsage()` | rss, heapUsed, external | |
| `v8.getHeapStatistics()` | heap details | |
| `v8.writeHeapSnapshot()` | snapshot file | |
| ⭐ Comparison view | diff snapshots | find growth |
| Common leaks | unbounded maps, listeners, timers, closures | |
| `WeakMap` / `WeakRef` | weak references | metadata |
| Exit 137 | OOM kill | raise limit or fix leak |

## Runtime security
| Flag / practice | Effect | Note |
|:--|:--|:--|
| ⭐ `--permission` | deny fs/child/worker/addons by default | Permission model |
| `--allow-fs-read` / `--allow-fs-write` | allowed paths | |
| `--allow-child-process` / `--allow-worker` / `--allow-addons` | opt-ins | |
| `--disallow-code-generation-from-strings` | no eval/new Function | |
| `--disable-proto=throw` | block `__proto__` | |
| ⭐ Patch promptly | security releases | subscribe |
| Non-root, read-only FS | container hardening | |
| `--inspect` never public | remote code execution risk | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Sync crypto/fs in handlers | loop blocked | async APIs |
| Unawaited promise | crash on rejection | await / `.catch` |
| Swallowing uncaught exceptions | corrupted state | crash + restart |
| `pnpm start` as PID 1 | no SIGTERM | `node` directly |
| `process.exit()` mid-request | dropped work | graceful shutdown |
| Extensionless ESM imports | `ERR_MODULE_NOT_FOUND` | `.ts` extensions |
| tsconfig `paths` at runtime | unresolved | `imports` field |
| `enum` with type stripping | startup error | `as const` objects |
| Buffering big data | OOM | streams |
| `.pipe()` without errors | leaks | `pipeline` |
| No heap limit in containers | OOM kills | explicit limit |
| Missing `'error'` listeners | crash on blips | always listen |
| EOL Node | unpatched CVEs | LTS only |

## Sources
| Source | Link |
|:--|:--|
| Node.js API docs | https://nodejs.org/api/ |
| Event loop guide | https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick |
| Don't block the event loop | https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop |
| TypeScript in Node | https://nodejs.org/api/typescript.html |
| Packages (exports/imports) | https://nodejs.org/api/packages.html |
| Permissions | https://nodejs.org/api/permissions.html |
| Diagnostics | https://nodejs.org/en/learn/diagnostics/user-journey |
| Release schedule | https://github.com/nodejs/release |
