---
title: Testing cheatsheet
tech: Vitest 4, Supertest, Testcontainers, TypeScript
version: Vitest 4.x, Supertest 7, Testcontainers for Node 11, Node.js 26 LTS
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Testing cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Kinds of tests
| Kind | What it checks | Note |
|:--|:--|:--|
| Static | types, lint rules | TypeScript strict + ESLint: the cheapest tests |
| ⭐ Unit | one function/module, no I/O | ms each; pure logic |
| ⭐ Integration | module + real deps (HTTP, DB) | bulk of backend confidence |
| End-to-end | whole system via UI or public API | few, critical journeys |
| Contract | provider/consumer agree on API shape | also seen: Pact |
| Smoke | "is it up and basically working" | after each deploy |
| Snapshot | output equals stored copy | small, stable outputs only |
| Property-based | random inputs satisfy invariants | also seen: fast-check |
| Mutation | does a code change make a test fail | also seen: Stryker |
| Load / performance | behavior under traffic | k6 (03-backend/09) |
| Visual regression | screenshots unchanged | Vitest 4 browser mode, Playwright |

## Principles
| Principle | What it means | Note |
|:--|:--|:--|
| ⭐ Test behavior, not implementation | assert what callers observe | survives refactors |
| ⭐ Arrange-Act-Assert | setup, one action, checks | blank line between parts |
| One behavior per test | one reason to fail | name = a sentence |
| ⭐ FIRST | fast, isolated, repeatable, self-checking, timely | |
| Testing pyramid | many unit, fewer integration, few E2E | classic shape |
| Testing trophy | most value in integration tests | web apps |
| ⭐ Bug → failing test first | reproduce, then fix | regression guard |
| Red-green-refactor | the TDD loop | small steps |
| Characterization test | pins current behavior of legacy code | before refactoring |
| Seam | place to swap a dependency without editing logic | parameters, constructors |
| DAMP over DRY | descriptive tests beat clever reuse | readable failures |

## Vitest CLI
| Command | What it does |
|:--|:--|
| ⭐ `vitest` | watch mode (local default) |
| ⭐ `vitest run` | single run (CI) |
| `vitest run src/pricing` | only matching files |
| `vitest -t "coupon"` | only tests whose name matches |
| `vitest --project integration` | one project |
| ⭐ `vitest run --coverage` | with coverage |
| `vitest --changed` | tests related to uncommitted changes |
| `vitest related src/a.ts` | tests that import a file |
| `vitest run --shard=1/3` | one shard of the suite |
| `vitest --sequence.shuffle` | random order, finds order dependence |
| `vitest --ui` | browser UI (`@vitest/ui`) |
| `vitest bench` | benchmarks |
| `vitest list` | list tests without running |
| `vitest run --reporter=junit` | CI report format |
| `vitest --inspect-brk --no-file-parallelism` | debug with breakpoints |
| `vitest run -u` | update snapshots |

## Vitest config keys
| Key | What it does | Note |
|:--|:--|:--|
| `include` / `exclude` | test file globs | |
| ⭐ `environment` | `node`, `jsdom`, `happy-dom` | per file: `// @vitest-environment jsdom` |
| ⭐ `projects` | several configs in one run | replaced `workspace` (removed in v4) |
| `globalSetup` | runs once before all tests | start containers |
| `setupFiles` | runs before each test file | matchers, polyfills |
| ⭐ `restoreMocks` | restore spies after each test | also `clearMocks`, `mockReset` |
| `testTimeout` / `hookTimeout` | per-test / hook limit | default 5 s / 10 s |
| `fileParallelism` | run files in parallel | `false` for shared DB |
| `pool` | `forks` (default) or `threads` | forks is more compatible |
| `maxWorkers` | worker count | lower for heavy integration tests |
| `sequence.shuffle` / `sequence.seed` | random order / reproduce it | |
| `retry` | rerun failed tests | hides flakiness; avoid on unit tests |
| `allowOnly` | permit `.only` | false in CI by default |
| `coverage.*` | provider, include, thresholds, reporter | see Coverage |
| `reporters` / `outputFile` | output formats | junit, json, html |
| `typecheck` | run type tests (`*.test-d.ts`) | `expectTypeOf` |
| `browser` | run tests in real browsers | stable in Vitest 4 |

## Test API
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `describe` / `it` / `test` | group / define | |
| ⭐ `test.each(table)` | table-driven tests | `%s`, `%j`, `$name` in titles |
| `test.for(table)` | like `each`, passes the test context | |
| `test.only` / `skip` / `todo` / `fails` | focus / skip / placeholder / expect failure | |
| `test.skipIf(cond)` / `runIf(cond)` | conditional tests | platform-specific |
| `test.concurrent` | run tests in a file concurrently | use the context's `expect` |
| ⭐ `beforeEach` / `afterEach` | per-test hooks | can return cleanup fn |
| `beforeAll` / `afterAll` | per-file hooks | |
| `onTestFinished(fn)` | cleanup registered inside a test | |
| `onTestFailed(fn)` | extra logging on failure | |
| ⭐ `test.extend({...})` | typed fixtures with setup/teardown | lazy, composable |
| `inject('key')` | read values from `globalSetup` `provide` | |
| `expect.assertions(n)` / `hasAssertions()` | require assertions to run | async callbacks |

## Matchers
| Matcher | Checks |
|:--|:--|
| ⭐ `toBe` | `Object.is` (primitives, same reference) |
| ⭐ `toEqual` | deep equality |
| `toStrictEqual` | deep + undefined keys + class |
| ⭐ `toMatchObject` | subset of an object |
| `toContain` / `toContainEqual` | item in array/string / deep item |
| `toHaveLength` / `toHaveProperty('a.b', v)` | length / nested property |
| `toBeNull` / `toBeUndefined` / `toBeDefined` | nullish checks |
| `toBeCloseTo(n, digits)` | floating point |
| `toBeGreaterThan` / `toBeLessThanOrEqual` | numbers |
| `toMatch(/re/)` | string vs regex |
| ⭐ `toThrow(msg \| Class \| /re/)` | sync throw |
| ⭐ `resolves` / `rejects` | await promise outcome |
| ⭐ `toHaveBeenCalledWith(...)` | mock call args |
| `toHaveBeenCalledTimes(n)` | call count |
| `toHaveBeenCalledExactlyOnceWith(...)` | once, with these args (Vitest 3+) |
| `toHaveBeenLastCalledWith` / `NthCalledWith` | specific call |
| `toHaveReturnedWith` | mock return value |
| `expect.any(Date)` / `expect.anything()` | loose matching inside objects |
| `expect.objectContaining` / `arrayContaining` / `stringMatching` | asymmetric matchers |
| `toMatchSnapshot` / `toMatchInlineSnapshot` | snapshot |
| `toMatchFileSnapshot(path)` | snapshot in its own file |
| `toSatisfy(fn)` | custom predicate |
| ⭐ `expect.poll(fn).toBe(x)` | retry until it passes or times out |
| `expect.soft(x)` | keep running after a failed check |
| `expect.extend({...})` | custom matchers |
| `expectTypeOf(x).toEqualTypeOf<T>()` | type-level assertions |

## Mocks and spies
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `vi.fn(impl?)` | mock function | records calls |
| `.mockReturnValue(v)` / `Once` | stub return | |
| ⭐ `.mockResolvedValue(v)` / `.mockRejectedValue(e)` | async stub | |
| `.mockImplementation(fn)` | custom behavior | |
| `.mock.calls` / `.mock.results` | raw call data | |
| ⭐ `vi.spyOn(obj, 'm')` | spy on existing method | `.mockRestore()` |
| `vi.spyOn(obj, 'p', 'get')` | spy on getter | |
| ⭐ `vi.mock('./m.ts', factory)` | replace a module | hoisted above imports |
| `vi.doMock` | non-hoisted mock | affects later dynamic imports |
| `vi.hoisted(() => ...)` | values for hoisted factories | |
| `vi.importActual('./m.ts')` | real module inside a mock | partial mocks |
| `vi.mocked(fn)` | typed mock access | |
| `__mocks__/` folder | automatic module mocks | |
| `vi.stubEnv` / `vi.unstubAllEnvs` | env vars | |
| `vi.stubGlobal` / `vi.unstubAllGlobals` | globals like `fetch` | prefer MSW for HTTP |
| `vi.clearAllMocks` / `resetAllMocks` / `restoreAllMocks` | clear calls / reset impl / restore originals | |

## Time and randomness
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `vi.useFakeTimers()` | fake timers and `Date` | `vi.useRealTimers()` after |
| ⭐ `vi.setSystemTime(date)` | freeze "now" | |
| `vi.advanceTimersByTime(ms)` | move time | sync |
| ⭐ `vi.advanceTimersByTimeAsync(ms)` | move time, flush promises | async code |
| `vi.runAllTimers()` / `runOnlyPendingTimers()` | run timers | beware intervals |
| `vi.advanceTimersToNextTimer()` | step one timer | |
| `vi.getTimerCount()` | pending timers | leak checks |
| `toFake: [...]` option | choose what to fake | e.g. keep `queueMicrotask` real |
| Injected clock | `{ now(): Date }` parameter | simplest seam |
| `TZ=UTC` | fixed time zone for the run | CI and local alike |
| Seeded random | log the seed, replay it | property tests |

## Test doubles
| Double | What it is | Example |
|:--|:--|:--|
| Dummy | placeholder, unused | unused logger |
| ⭐ Stub | canned answers | `getRate: () => 1.1` |
| ⭐ Spy | records calls | `vi.spyOn(console, 'warn')` |
| ⭐ Mock | stub + call expectations | email sent once |
| ⭐ Fake | working light implementation | in-memory repo, fake clock |
| MSW handler | fake HTTP server at the network layer | `http.get(url, () => HttpResponse.json(...))` |

## Supertest
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `request(app)` | test an Express app in-process | no `listen()` needed |
| `.get/.post/.put/.patch/.delete(path)` | method + path | |
| ⭐ `.send(body)` | JSON body | sets Content-Type |
| `.set('Authorization', 'Bearer x')` | header | |
| `.query({ page: 2 })` | query string | |
| `.attach('file', path)` / `.field()` | multipart upload | |
| ⭐ `.expect(201)` | assert status | also `.expect('Content-Type', /json/)` |
| `res.body` / `res.headers` / `res.text` | read response | |
| ⭐ `request.agent(app)` | keeps cookies between requests | login flows |
| `.redirects(n)` | follow redirects | |
| `.timeout(ms)` | request timeout | |

## Testcontainers
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `new PostgreSqlContainer('postgres:18-alpine').start()` | throwaway Postgres | `@testcontainers/postgresql` |
| ⭐ `.getConnectionUri()` | connection string | pass via `provide` |
| `RedisContainer` / `MongoDBContainer` | other modules | `@testcontainers/redis`, `/mongodb` |
| `new GenericContainer(image)` | any image | `.withExposedPorts()`, `.withEnvironment()` |
| `.withWaitStrategy(Wait.forLogMessage(...))` | wait until ready | also `forHealthCheck()` |
| `.withReuse()` + `TESTCONTAINERS_REUSE_ENABLE=true` | keep container between runs | local speed |
| `.withCopyFilesToContainer()` | seed files | init SQL |
| `DockerComposeEnvironment` | start a compose file | multi-service tests |
| `.stop()` | stop and remove | Ryuk also cleans up |
| `container.exec([...])` | run a command inside | e.g. `psql` |

## Isolation and data
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Factory | builds valid objects with overrides | `buildUser({ role: 'admin' })` |
| Builder | fluent factory | `aUser().admin().build()` |
| Unique values | random suffix on emails/IDs | avoids unique-constraint clashes |
| ⭐ `TRUNCATE ... RESTART IDENTITY CASCADE` | wipe tables between tests | sequential files |
| Transaction rollback per test | undo all writes | app must use the same connection |
| DB per worker | `test_${VITEST_POOL_ID}` | parallel integration files |
| Template database | `CREATE DATABASE x TEMPLATE base` | fast fresh DB |
| Seed via API | create data through public endpoints | realistic, slower |

## Coverage
| Item | What it does | Note |
|:--|:--|:--|
| `@vitest/coverage-v8` | V8 coverage provider (default) | AST-aware remapping in v4 |
| `@vitest/coverage-istanbul` | instrumenting provider | also seen |
| ⭐ `coverage.include` | files to measure | list them explicitly in v4 |
| ⭐ `coverage.thresholds` | fail below a floor | `{ lines: 80, branches: 75 }` |
| `thresholds.autoUpdate` | ratchet thresholds up | |
| `coverage.reporter` | `text`, `html`, `lcov`, `json-summary` | |
| ⭐ Branch coverage | both sides of each decision | most useful metric |
| `/* v8 ignore next */` | exclude a line | use rarely, explain why |

## Flaky tests
| Cause | Fix |
|:--|:--|
| ⭐ Real clock / time zone | inject clock, fake timers, `TZ=UTC` |
| ⭐ Order dependence | isolate state, shuffle to detect |
| Shared database rows | unique data, cleanup per test |
| ⭐ Fixed sleeps | `expect.poll`, `vi.waitFor` |
| Un-awaited promises | `await`; lint `@typescript-eslint/no-floating-promises` |
| Real network | MSW / stubs |
| Unseeded randomness | seed and log it |
| CI resource limits | fewer workers, longer timeouts for integration only |
| Policy | quarantine with owner + issue, fix root cause, restore |

## CI
| Practice | Note |
|:--|:--|
| ⭐ `vitest run` on every PR | `CI=true` disables watch and `.only` |
| Fast checks first | typecheck → lint → unit → integration → E2E |
| `--shard=i/n` matrix | split long suites |
| JUnit reporter | PR annotations, test summaries |
| `actions/setup-node` with `cache: pnpm` | fast installs |
| `timeout-minutes` | stop hung jobs |
| Docker on Ubuntu runners | Testcontainers works out of the box |
| Upload coverage HTML as artifact | browse uncovered lines |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `expect(p).rejects` without `await` | test passes regardless | `await expect(...)` |
| `toBe` on objects | reference comparison | `toEqual` / `toMatchObject` |
| `vi.mock` specifier mismatch | real module runs | match the exact import |
| Mocks not restored | leak into other tests | `restoreMocks: true` |
| Fake timers left on | later tests hang | `useRealTimers` in `afterEach` |
| App started in tests | port clashes, hanging process | export `createApp()` |
| SQLite stand-in for Postgres | dialect differences | Testcontainers |
| Shared DB with parallel files | rows deleted mid-test | `fileParallelism: false` or DB per worker |
| Coverage as target | junk tests | floor + review risky branches |
| Snapshots of huge objects | nobody reviews diffs | small snapshots, explicit asserts |
| `.only` committed | CI runs one test | `allowOnly: false` in CI |

## Sources
| Source | Link |
|:--|:--|
| Vitest guide | https://vitest.dev/guide/ |
| Vitest API | https://vitest.dev/api/ |
| Vitest config | https://vitest.dev/config/ |
| Supertest | https://github.com/forwardemail/supertest |
| Testcontainers for Node.js | https://node.testcontainers.org/ |
| Practical Test Pyramid | https://martinfowler.com/articles/practical-test-pyramid.html |
| Mocks Aren't Stubs | https://martinfowler.com/articles/mocksArentStubs.html |
