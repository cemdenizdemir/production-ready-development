---
title: Frontend Testing & Monitoring cheatsheet
tech: Vitest 4, Testing Library, MSW, Playwright, Sentry
version: Vitest 4.x (browser mode), Testing Library, MSW 2, Playwright 1.5x, Sentry JS SDK 10
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Frontend Testing & Monitoring cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Strategy
| Layer | Tool | Test |
|:--|:--|:--|
| Logic | Vitest | formatters, reducers, schemas |
| ⭐ Components | Vitest + Testing Library + MSW | user-visible behavior, states |
| Browser components | Vitest browser mode | layout, focus, real APIs |
| ⭐ Critical journeys | Playwright | sign up, login, checkout |
| Visual | `toHaveScreenshot` / `toMatchScreenshot` | design system, key pages |
| Accessibility | axe + role queries + aria snapshots | |
| ⭐ Production | Sentry | errors, vitals, replays |

## Testing Library queries
| Query | Use | Note |
|:--|:--|:--|
| ⭐ `getByRole(role, { name })` | first choice | accessible name |
| ⭐ `getByLabelText` | form fields | |
| `getByPlaceholderText` | fallback for inputs | |
| ⭐ `getByText` | visible text | regex allowed |
| `getByDisplayValue` | current input value | |
| `getByAltText` / `getByTitle` | images / titles | |
| `getByTestId` | last resort | `data-testid` |
| ⭐ `findBy…` | async, retries | appears later |
| ⭐ `queryBy…` | `null` if absent | assert absence |
| `…AllBy…` | multiple | lists |
| `within(el)` | scope queries | rows, dialogs |
| `screen` | document-wide queries | |
| `waitFor(fn)` | retry an assertion | |
| `waitForElementToBeRemoved` | wait for disappearance | spinners |
| `screen.debug()` / `logRoles(container)` | inspect DOM / roles | debugging |

## user-event
| API | Does |
|:--|:--|
| ⭐ `userEvent.setup()` | create a user instance |
| ⭐ `await user.click(el)` | click |
| ⭐ `await user.type(el, 'text')` | type (with keyboard events) |
| `await user.clear(el)` | clear input |
| `await user.keyboard('{Enter}')` | key presses |
| `await user.tab()` | move focus |
| `await user.hover(el)` | hover |
| `await user.selectOptions(select, 'value')` | select options |
| `await user.upload(input, file)` | file inputs |
| `await user.paste('text')` | paste |
| `fireEvent` | low-level events; avoid for user flows |

## jest-dom matchers
| Matcher | Checks |
|:--|:--|
| ⭐ `toBeInTheDocument()` | present |
| ⭐ `toBeVisible()` | visible |
| ⭐ `toBeDisabled()` / `toBeEnabled()` | disabled state |
| `toHaveValue(v)` / `toHaveDisplayValue` | input values |
| ⭐ `toHaveTextContent(t)` | text |
| ⭐ `toHaveAccessibleName(n)` / `toHaveAccessibleDescription(d)` | a11y names |
| `toHaveAttribute(name, v)` | attributes (`aria-invalid`) |
| ⭐ `toHaveFocus()` | focused |
| `toBeChecked()` | checkbox/radio |
| `toHaveClass()` | classes (prefer behavior) |
| `toBeRequired()` / `toBeInvalid()` | form state |

## Vitest setup for React
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `environment: 'jsdom'` | simulated DOM | fast |
| `setupFiles` | jest-dom, MSW server | per test file |
| `@testing-library/jest-dom/vitest` | matchers | |
| `cleanup()` in `afterEach` | unmount between tests | auto with globals |
| ⭐ Browser mode `browser.enabled` | real browser | Vitest 4 stable |
| `@vitest/browser-playwright` + `playwright()` | provider | v4 package split |
| `instances: [{ browser: 'chromium' }, …]` | browsers to run | |
| `vitest-browser-react` `render` | render in browser mode | |
| `page` from `vitest/browser` | locators | `page.getByRole` |
| `expect.element(locator)` | retrying assertions | browser mode |
| `toMatchScreenshot()` | visual regression | Vitest 4 |

## MSW 2
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `http.get('/api/x/:id', resolver)` | request handler | also post/put/patch/delete |
| ⭐ `HttpResponse.json(body, { status })` | JSON response | |
| `HttpResponse.text` / `.xml` / `new HttpResponse(body)` | other bodies | |
| `HttpResponse.error()` | network error | |
| `delay(ms)` / `delay('infinite')` | latency | loading states |
| `({ request, params, cookies })` | resolver arguments | |
| ⭐ `setupServer(...handlers)` | Node | `msw/node` |
| `setupWorker(...handlers)` | browser | `msw/browser`, `npx msw init public/` |
| ⭐ `server.listen({ onUnhandledRequest: 'error' })` | strict mode | |
| ⭐ `server.use(...)` / `server.resetHandlers()` | per-test overrides / reset | |
| `passthrough()` | let a request through | |
| `graphql.query/mutation` | GraphQL handlers | |
| `ws.link(url)` | WebSocket mocking | MSW 2.6+ |

## Testing TanStack Query and hooks
| Practice | Note |
|:--|:--|
| ⭐ New QueryClient per test | no cache leaks |
| ⭐ `retry: false` | fast error tests |
| `gcTime: Infinity` | no stray timers |
| ⭐ `renderWithProviders` / `createWrapper()` | providers helper |
| `renderHook(fn, { wrapper })` | test hooks directly |
| `await waitFor(() => expect(result.current.isSuccess).toBe(true))` | async hooks |
| Assert UI, not cache | behavior first |

## Playwright locators and assertions
| API | What it does |
|:--|:--|
| ⭐ `page.getByRole(role, { name })` | role locator |
| ⭐ `page.getByLabel` / `getByText` / `getByTestId` | other locators |
| `locator.filter({ hasText })` / `.nth(i)` / `.first()` | narrow |
| ⭐ `await expect(loc).toBeVisible()` | web-first, auto-wait |
| `toHaveText` / `toContainText` / `toHaveValue` | content |
| `toHaveURL` / `toHaveTitle` | navigation |
| `toHaveCount` | lists |
| ⭐ `toHaveScreenshot()` | visual comparison |
| ⭐ `toMatchAriaSnapshot()` | accessibility tree |
| `expect.soft` | continue after failure |
| `expect.poll(fn)` | retry custom checks |
| `test.step('name', fn)` | report structure |

## Playwright features
| Feature | What it does | Note |
|:--|:--|:--|
| ⭐ `storageState` + setup project | reuse login | gitignore the file |
| ⭐ `page.route(url, handler)` | mock/modify network | third parties |
| `request` fixture | API calls for test data | |
| `page.clock` | control time | |
| `test.extend({...})` | custom fixtures | |
| ⭐ `webServer` | start app before tests | prod build |
| `projects` + `devices[...]` | browsers and devices | WebKit for iOS |
| ⭐ `trace: 'on-first-retry'` | record traces | `npx playwright show-trace` |
| `--ui` / `--debug` / `--headed` | interactive modes | |
| `npx playwright codegen` | record locators | |
| ⭐ `--shard=1/4` + `merge-reports` | parallel CI | |
| `--last-failed` / `--grep` | subsets | |
| `contextOptions.reducedMotion` | disable animations | |
| `forbidOnly` | block `.only` in CI | |

## Flaky E2E fixes
| Cause | Fix |
|:--|:--|
| ⭐ Fixed sleeps | web-first assertions |
| Ambiguous locators | role + name, scoping |
| ⭐ Shared data | per-test data via API |
| Animations | reduced motion |
| Third parties | `page.route` |
| Time | `page.clock` |
| Order dependence | `fullyParallel` |
| Diagnosis | trace viewer |

## Sentry setup
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `npx @sentry/wizard@latest -i nextjs` | scaffold Next.js setup | |
| `instrumentation-client.ts` | browser init | Next.js |
| `sentry.server.config.ts` / `sentry.edge.config.ts` | server/edge init | |
| ⭐ `onRequestError = Sentry.captureRequestError` | server errors | `instrumentation.ts` |
| ⭐ `withSentryConfig(nextConfig, {...})` | source map upload, tunnel | |
| `tunnelRoute` | send events via your domain | ad blockers |
| `@sentry/react` + `reactErrorHandler()` | React root error callbacks | Vite apps |
| `Sentry.ErrorBoundary` | boundary with reporting | |
| `@sentry/vite-plugin` | upload source maps | Vite |
| ⭐ `release` | version per event | git SHA |
| `environment` | prod/staging/preview | |
| ⭐ `tracesSampleRate` | trace sampling | 0.05–0.2 |
| `tracePropagationTargets` | where to send trace headers | your API |
| ⭐ `replayIntegration({ maskAllText, blockAllMedia })` | privacy-safe replays | defaults on |
| `replaysOnErrorSampleRate: 1.0` | replays only on errors | |
| `feedbackIntegration()` | user feedback widget | |
| `enableLogs` + `Sentry.logger` | structured logs | |

## Sentry API
| API | What it does |
|:--|:--|
| ⭐ `Sentry.captureException(err, { tags, extra })` | report an error |
| `Sentry.captureMessage(msg, level)` | report a message |
| ⭐ `Sentry.setUser({ id })` | user context (no PII) |
| `Sentry.setTag` / `setContext` | filterable data |
| `Sentry.addBreadcrumb` | trail |
| `Sentry.startSpan({ name }, fn)` | custom performance spans |
| `beforeSend(event)` | scrub/drop events |
| `ignoreErrors` / `denyUrls` | filter noise |
| `sendDefaultPii` | IPs/cookies (default false) |

## Alerts and triage
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ New issue alert | first occurrence | production only |
| ⭐ Regression alert | resolved issue returns | |
| Frequency / users affected | volume thresholds | |
| ⭐ Metric alerts | error rate, crash-free sessions, INP/LCP p75 | |
| Ownership rules / CODEOWNERS | route to teams | |
| Resolve in next release | auto-reopen on regression | |
| Suspect commits | via GitHub integration | |
| Inbound filters | extensions, bots, old browsers | |
| Spike protection | quota safety | |

## CI for frontend tests
| Practice | Note |
|:--|:--|
| ⭐ Vitest on every PR | fast |
| ⭐ Playwright against prod build/preview | realistic |
| `playwright install --with-deps chromium` | only needed browsers |
| Playwright Docker image | consistent screenshots |
| ⭐ Shard + merge reports | speed |
| ⭐ Upload report + traces on failure | debugging |
| `retries: 2` in CI only | with traces |
| Test-only seeding endpoints | never in production |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| CSS/test-id queries | miss a11y bugs | role queries |
| `getBy` for async UI | false failures | `findBy` |
| `fireEvent` typing | unrealistic | `user-event` |
| Stubbed `fetch` | contract drift | MSW |
| Shared QueryClient | test pollution | per test |
| Default retries in tests | slow errors | `retry: false` |
| Fixed sleeps in E2E | flaky + slow | web-first assertions |
| UI login per test | slow | `storageState` |
| Screenshot baselines from laptops | false diffs | Docker baselines |
| No source maps | unreadable errors | upload, hide |
| Unmasked replays | privacy breach | masking defaults |
| Alerts on every event | fatigue | new/regression/impact |

## Sources
| Source | Link |
|:--|:--|
| Testing Library | https://testing-library.com/docs/ |
| Vitest browser mode | https://vitest.dev/guide/browser/ |
| MSW | https://mswjs.io/docs |
| TanStack Query testing | https://tanstack.com/query/latest/docs/framework/react/guides/testing |
| Playwright docs | https://playwright.dev/docs/intro |
| Playwright best practices | https://playwright.dev/docs/best-practices |
| Sentry Next.js | https://docs.sentry.io/platforms/javascript/guides/nextjs/ |
| Sentry React | https://docs.sentry.io/platforms/javascript/guides/react/ |
