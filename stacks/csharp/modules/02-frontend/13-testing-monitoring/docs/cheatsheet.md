---
title: Frontend Testing & Monitoring cheatsheet
tech: Vitest 4, Testing Library, MSW, Playwright, Sentry
version: Vitest 4.x (browser mode), Testing Library, MSW 2, Playwright 1.5x, Sentry JS SDK 10
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Frontend Testing & Monitoring cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Strategy
| Level | Tool | Note |
|:--|:--|:--|
| unit | Vitest | pure functions |
| ⭐ component | Testing Library + MSW | bulk of suite |
| page integration | providers + routes | |
| ⭐ E2E | Playwright → real API | few journeys |
| visual | `toHaveScreenshot` | targeted |
| a11y | axe + role queries | always |
| business rules | API tests | not frontend |

## Testing Library
| Item | Use | Note |
|:--|:--|:--|
| ⭐ `getByRole(role, { name })` | first choice | |
| `getByLabelText` | form fields | |
| `getByText` | text | |
| `getByTestId` | last resort | |
| `queryBy*` | absence | |
| ⭐ `findBy*` | async | |
| ⭐ `userEvent.setup()` | realistic input | |
| `within(el)` | scope queries | |
| `waitFor` | async assertions | |
| jest-dom `toBeVisible` / `toBeDisabled` / `toHaveAccessibleName` | matchers | |
| `renderHook` | hooks | wrapper for providers |

## Vitest 4
| Item | Does | Note |
|:--|:--|:--|
| `vitest` / `vitest run` | watch / once | |
| `environment: "jsdom"` | fake DOM | fast |
| ⭐ browser mode | real browser via Playwright | `@vitest/browser-playwright` |
| `test.projects` | jsdom + browser in one config | |
| `vi.fn` / `vi.spyOn` / `vi.useFakeTimers` | doubles, time | |
| `setupFiles` | MSW, jest-dom | |
| `--coverage` | V8 coverage | |
| `expect.element` | browser-mode retrying assertions | |
| `vitest-browser-react` | render in browser mode | |

## MSW
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `http.get/post(path, handler)` | route | params `:id` |
| ⭐ `HttpResponse.json(body, init)` | response | problem+json too |
| `delay(ms)` | slow | loading states |
| `HttpResponse.error()` | network error | |
| `setupServer` / `setupWorker` | Node / browser | |
| ⭐ `server.use(...)` | per-test override | |
| `resetHandlers` | after each | |
| ⭐ `onUnhandledRequest: "error"` | catch gaps | |
| Orval `mock: true` | generated handlers | from OpenAPI |

## TanStack Query in tests
| Item | Does | Note |
|:--|:--|:--|
| ⭐ new `QueryClient` per test | isolation | |
| ⭐ `retry: false` | fast failures | |
| `renderWithProviders` | helper | |
| `waitFor(() => isSuccess)` | hooks | |
| assert UI after mutation | invalidation works | |

## Playwright
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `getByRole` / `getByLabel` | locators | |
| ⭐ `await expect(loc).toBeVisible()` | web-first, retries | |
| `test.extend` | fixtures | |
| ⭐ setup project + `storageState` | log in once | |
| `request` fixture | seed via API | Testing env |
| `webServer` | start app | |
| projects | browsers, devices | |
| `page.route` | stub third parties | |
| `page.waitForResponse` | wait on API | |
| `trace: "on-first-retry"` | debug | `show-trace` |
| `reducedMotion: "reduce"` | stable animations | |
| `codegen` | record locators | |
| UI mode `--ui` | local debugging | |

## Visual and tree snapshots
| Item | Catches | Note |
|:--|:--|:--|
| `toHaveScreenshot()` | pixel diffs | same container baselines |
| `mask: [locators]` | hide dynamic parts | |
| `maxDiffPixelRatio` | threshold | |
| ⭐ `toMatchAriaSnapshot()` | a11y tree changes | |
| `--update-snapshots` | refresh baselines | review diffs |

## Flakiness
| Cause | Fix | Note |
|:--|:--|:--|
| ⭐ fixed sleeps | web-first assertions | |
| shared data | unique seed per test | |
| order dependence | independent tests | |
| animations | reduced motion | |
| third parties | `page.route` | |
| retries | 1–2 + traces | then fix |
| quarantine | issue + owner | |

## E2E in CI
| Item | Does | Note |
|:--|:--|:--|
| ⭐ Compose up SQL Server + API | real backend | `--wait` |
| `next build && next start` | production build | |
| `playwright install --with-deps` | browsers | cache |
| ⭐ `--shard=i/n` | parallel jobs | |
| `blob` reporter + `merge-reports` | one report | |
| upload report/traces | debugging | on failure |
| smoke on PRs, full nightly | cost/speed | |
| Testing-only seed endpoints | `IsEnvironment("Testing")` | 404 in prod |

## Sentry setup
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `@sentry/nextjs` | SDK | v10 |
| `instrumentation-client.ts` | browser init | |
| `instrumentation.ts` | server init | |
| `withSentryConfig` | build integration | |
| ⭐ source maps upload | readable stacks | delete after upload |
| ⭐ `release` = commit SHA | per-deploy tracking | same as image |
| `environment` | staging/prod | |
| `tunnelRoute` | bypass blockers | CSP `connect-src 'self'` |
| `ignoreErrors` / `beforeSend` | noise, scrubbing | |
| `sendDefaultPii: false` | privacy | |

## Performance and replay
| Item | Does | Note |
|:--|:--|:--|
| `tracesSampleRate` | perf sampling | ~0.1 |
| ⭐ `tracePropagationTargets` | trace to API | first-party only |
| W3C `traceparent` | join App Insights | |
| ⭐ Session Replay | record around errors | mask everything |
| `replaysOnErrorSampleRate: 1.0` | all error sessions | |
| `replaysSessionSampleRate` | random sessions | low |
| web vitals | per route | 07-performance |
| user feedback | report widget | |

## Alerting and triage
| Alert | Condition | Note |
|:--|:--|:--|
| ⭐ new issue | first seen in prod | |
| ⭐ regression | reappears in release | |
| spike | rate threshold | |
| release health | crash-free sessions | |
| performance | LCP/INP over budget | |
| critical flow tag | `feature:checkout` | |
| routing | owners / code owners | |
| triage | reproduce → test → fix → resolve in next release | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| mocking `fetch` | skips real code | MSW |
| shared QueryClient | leaks | per test |
| CSS-selector locators | brittle | roles |
| `waitForTimeout` | slow + flaky | web-first |
| UI login every test | slow | storageState |
| public source maps | code exposure | delete after upload |
| unmasked replay | PII capture | mask all |
| propagate traces everywhere | header leaks | first-party only |
| test endpoints in prod | security hole | env-gated + smoke check |

## Sources
| Source | Link |
|:--|:--|
| Testing Library | https://testing-library.com/docs/ |
| Vitest browser mode | https://vitest.dev/guide/browser/ |
| MSW | https://mswjs.io/docs/ |
| TanStack testing | https://tanstack.com/query/latest/docs/framework/react/guides/testing |
| Playwright best practices | https://playwright.dev/docs/best-practices |
| Playwright auth | https://playwright.dev/docs/auth |
| Sentry Next.js | https://docs.sentry.io/platforms/javascript/guides/nextjs/ |
| Sentry replay privacy | https://docs.sentry.io/platforms/javascript/session-replay/privacy/ |
