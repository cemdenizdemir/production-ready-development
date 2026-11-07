---
title: End-to-end tests with Playwright
tech: Playwright, GitHub Actions
version: Playwright 1.5x, GitHub Actions (Nov 2026)
date: 2026-11-07
covers: [6, 7, 8, 12]
---
# End-to-end tests with Playwright
[← Overview](00-overview.md)

## Why it matters
- Component tests pass, but the login cookie isn't set in production because of a domain mismatch. Only a real browser against a real server catches it.
- E2E tests use `waitForTimeout(3000)`; they're slow and still fail when CI is under load. Developers start ignoring red builds.
- A CSS change shifts the checkout button off-screen on mobile; no functional test notices.

## Concepts

### What to cover with E2E
A few **critical journeys**, end to end: sign up, log in, search → product → add to cart → checkout, password reset, the core action of your product. Everything else belongs in faster tests.

### Locators and auto-waiting
| Locator | Use |
|:--|:--|
| `page.getByRole('button', { name: 'Pay' })` | first choice |
| `page.getByLabel('Email')` | form fields |
| `page.getByText('Order confirmed')` | visible text |
| `page.getByTestId('cart-count')` | last resort, stable test IDs |
| `.filter({ hasText })`, chaining `row.getByRole(...)` | narrow inside lists |

Web-first assertions **wait and retry** until they pass or time out: `await expect(locator).toBeVisible()`, `toHaveText`, `toHaveURL`, `toHaveCount`. Never use fixed sleeps.

### Test isolation and authentication
- Each test gets a fresh browser context (cookies, storage).
- Log in once in a **setup project**, save `storageState` to a file, and reuse it in other projects, so tests don't repeat the login UI.
- Create test data through the API (fast, isolated), not by clicking through admin screens.
- Mock third parties (payments, maps, analytics) with `page.route()`; test the real third party in a separate, small contract or smoke test.

### Visual regression and aria snapshots
| Tool | Catches | Notes |
|:--|:--|:--|
| `expect(page).toHaveScreenshot()` | visual changes | run in one consistent environment (Docker), mask dynamic areas |
| `expect(locator).toMatchAriaSnapshot()` | structure, names, roles of the accessibility tree | stable across styling changes |

### Flaky E2E tests
| Cause | Fix |
|:--|:--|
| Fixed waits | web-first assertions, `expect.poll` |
| Ambiguous locators | role + name, scoped locators |
| Shared test data | unique data per test via API |
| Animations | `reducedMotion: 'reduce'`, disable animations in test builds |
| Third-party services | `page.route` mocks |
| Time-dependent UI | `page.clock` |
| Order dependence | `fullyParallel: true` exposes it early |

Diagnose with the **trace viewer**: `trace: 'on-first-retry'` records DOM snapshots, network, console, and actions for failed tests.

### CI
| Practice | Why |
|:--|:--|
| Run against a production build (`next build && next start`) or a preview deployment | realistic behavior |
| Install only needed browsers (`npx playwright install --with-deps chromium`) or use the Playwright Docker image | speed, consistency |
| Shard (`--shard=1/4`) and merge reports | wall-clock time |
| Upload the HTML report and traces as artifacts on failure | debuggable failures |
| `retries: 2` in CI with traces | survive rare infra hiccups while keeping evidence |
| `forbidOnly: !!process.env.CI` | no committed `.only` |

## Example
`playwright.config.ts`
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' }, dependencies: ['setup'] },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'], storageState: 'e2e/.auth/user.json' }, dependencies: ['setup'] },
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```
`e2e/auth.setup.ts`
```ts
import { test as setup, expect } from '@playwright/test';

setup('log in once', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.context().storageState({ path: 'e2e/.auth/user.json' }); // gitignored
});
```
`e2e/checkout.spec.ts`
```ts
import { test, expect } from '@playwright/test';

test('customer can buy a product', async ({ page, request }) => {
  const product = await (await request.post('/api/test/products', { data: { name: `Desk ${Date.now()}`, priceCents: 34900 } })).json(); // test data via API

  await page.route('https://js.stripe.com/**', (route) => route.fulfill({ status: 200, body: '' })); // third party mocked

  await page.goto(`/products/${product.id}`);
  await page.getByRole('button', { name: /Add to cart/ }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');

  await page.getByRole('link', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
});

test('header structure stays accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toMatchAriaSnapshot(`
    - banner:
      - link "Acme Shop home"
      - navigation "Main"
  `);
});
```
`.github/workflows/e2e.yml` (job excerpt, 4 shards)
```yaml
e2e:
  runs-on: ubuntu-latest
  timeout-minutes: 20
  strategy:
    fail-fast: false
    matrix:
      shard: [1, 2, 3, 4]
  steps:
    - uses: actions/checkout@v5
    - uses: ./.github/actions/setup
    - run: pnpm exec playwright install --with-deps chromium webkit
    - run: pnpm exec playwright test --shard=${{ matrix.shard }}/4
      env:
        E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}
        E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report-${{ matrix.shard }}
        path: playwright-report/
        retention-days: 7
```
The `/api/test/*` seeding endpoints must exist only in test environments, never in production.

## Production patterns
- **Few, critical journeys in E2E**; everything else in component and API tests.
- **Role-based locators and web-first assertions**; zero `waitForTimeout`.
- **Login once via a setup project and `storageState`**; seed data through the API.
- **Mock third parties** in E2E; separate smoke tests verify real integrations in staging.
- **Traces on retry, artifacts on failure, sharding in CI**; quarantine and fix flaky tests within days.

## Mistakes
Wrong: sleeping.
```ts
await page.waitForTimeout(3000);
await page.click('.submit');
```
Right: `await page.getByRole('button', { name: 'Submit' }).click(); await expect(page.getByText('Saved')).toBeVisible();`

Wrong: logging in through the UI in every test. Right: a setup project with `storageState`.

Wrong: tests depending on data created by earlier tests. Right: each test creates its own data.

Wrong: screenshots taken on developers' laptops compared with CI's. Fonts and rendering differ. Right: generate and compare baselines in the same Docker image.

## Check yourself
1. What makes Playwright assertions "web-first"?
2. How do you avoid logging in through the UI in every test?
3. Which artifact helps most when a test fails only in CI?

<details>
<summary>Answers</summary>

1. They automatically wait and retry until the condition holds or a timeout expires, so tests don't need fixed sleeps and tolerate normal async delays.
2. Log in once in a setup project, save the browser state with `storageState`, and configure other projects to load it.
3. The Playwright trace (with DOM snapshots, network log, console, and each action), recorded via `trace: 'on-first-retry'` and uploaded as an artifact.
</details>

## Sources
- [Playwright — Best practices](https://playwright.dev/docs/best-practices)
- [Playwright — Authentication](https://playwright.dev/docs/auth)
- [Playwright — Visual comparisons](https://playwright.dev/docs/test-snapshots)
- [Playwright — Aria snapshots](https://playwright.dev/docs/aria-snapshots)
- [Playwright — Trace viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright — Continuous integration and sharding](https://playwright.dev/docs/ci)
