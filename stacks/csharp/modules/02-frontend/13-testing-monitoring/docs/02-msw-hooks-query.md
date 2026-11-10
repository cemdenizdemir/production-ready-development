---
title: Mocking the network with MSW; hooks and TanStack Query
tech: MSW 2, Vitest 4, TanStack Query 5, Orval
version: MSW 2.x, TanStack Query v5, Orval 8.x
date: 2026-11-09
covers: [3, 4]
---
# Mocking the network with MSW; hooks and TanStack Query
[← Overview](00-overview.md)

## Why it matters
- Tests mock `fetch` with `vi.fn()` returning `{ json: () => data }`; they pass while the real fetcher sends the wrong URL and never handles 204 responses.
- The frontend team waits two weeks for an API endpoint to exist before building the UI.
- Query tests are flaky because the same `QueryClient` leaks cached data between tests and retries make failures take 7 seconds.

## Concepts

### MSW: mock at the network boundary
Mock Service Worker intercepts real requests (Service Worker in the browser, request interception in Node). Your fetcher, headers, URLs, and error handling run for real; only the server is fake.
| API | Use |
|:--|:--|
| `http.get("*/api/orders/:id", handler)` | route matching with params |
| `HttpResponse.json(body, { status, headers })` | JSON responses (Problem Details too) |
| `HttpResponse.text` / `new HttpResponse(null, { status: 204 })` | other bodies |
| `delay(ms)` | slow responses (loading states) |
| `HttpResponse.error()` | network failure |
| `setupServer(...handlers)` (Node) / `setupWorker` (browser) | test vs dev |
| `server.use(...)` | override per test |
| `onUnhandledRequest: "error"` | fail on unmocked calls |

### Handlers from the contract
Orval can generate MSW handlers and Faker-based data from the OpenAPI document (`mock: true`), so mocks match the C# DTOs. Override them per test for specific data and error cases. Mocks drift if they're hand-written; generated ones fail to compile when the contract changes.

The same handlers can run in development (`setupWorker` in the browser) to build UI before the API endpoint exists, and in Storybook.

### Testing hooks, context, and TanStack Query
| Need | How |
|:--|:--|
| custom hook | `renderHook(() => useX(), { wrapper })` |
| providers (QueryClient, theme, intl) | a `renderWithProviders` helper |
| ⭐ fresh `QueryClient` per test | no cache leaks |
| ⭐ `retry: false` in tests | fast failures |
| `gcTime: Infinity` in tests | avoid "Jest did not exit" style timers (optional) |
| waiting | `await waitFor(() => expect(result.current.isSuccess).toBe(true))` |
| mutations | assert UI after the request and cache invalidation |
| router (Next.js) | mock `next/navigation` hooks, or test via Playwright |

## Example
`web/test/server.ts`
```ts
import { setupServer } from "msw/node";
import { getShopMock } from "@/api/generated/shop.msw";      // Orval-generated handlers

export const server = setupServer(...getShopMock());
```
`web/test/setup.ts`
```ts
import "@testing-library/jest-dom/vitest";
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```
`web/test/render.tsx`
```tsx
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}
```
`web/src/features/orders/OrdersList.test.tsx`
```tsx
import { screen } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/../test/server";
import { renderWithProviders } from "@/../test/render";
import { OrdersList } from "./OrdersList";

test("shows a skeleton, then the orders", async () => {
  server.use(http.get("*/api/orders", async () => {
    await delay(50);
    return HttpResponse.json([{ id: 1042, status: "Shipped", totalMinor: 2700, currency: "EUR" }]);
  }));
  renderWithProviders(<OrdersList />);

  expect(screen.getByText("Loading orders…")).toBeInTheDocument();
  expect(await screen.findByText(/#1042/)).toBeVisible();
});

test("shows the empty state for a new customer", async () => {
  server.use(http.get("*/api/orders", () => HttpResponse.json([])));
  renderWithProviders(<OrdersList />);
  expect(await screen.findByText("You haven't ordered yet.")).toBeVisible();
});

test("shows a retryable error with a reference on 500", async () => {
  server.use(http.get("*/api/orders", () =>
    HttpResponse.json({ title: "Internal Server Error", status: 500, traceId: "00-4f2a9c1e5b6d7e8f-01" },
      { status: 500, headers: { "Content-Type": "application/problem+json" } })));
  renderWithProviders(<OrdersList />);

  expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong on our side");
  expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
});
```

## Production patterns
- MSW with `onUnhandledRequest: "error"` in every test run.
- Generated handlers as the default, per-test overrides for edge cases (empty, 400, 409, 500, slow, offline).
- A fresh `QueryClient` with retries off per test.
- MSW in development for API-first UI work; delete special-case mocks once the real endpoint exists.

## Mistakes
Wrong:
```ts
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
```
Right: MSW handlers; the real fetcher runs.

Wrong: one shared `QueryClient` for the whole suite.
Right: create one per test (`renderWithProviders`).

## Check yourself
1. Why is MSW better than mocking `fetch` directly?
2. What two `QueryClient` options make tests faster and more reliable?
3. How do mocks stay in sync with the C# API?

<details><summary>Answers</summary>

1. Your real request code (URLs, headers, error mapping) runs, and the same handlers work in tests, the browser, and Storybook.
2. A new client per test (no shared cache) and `retry: false` (no slow retries).
3. Orval generates MSW handlers and types from the API's OpenAPI document; regenerating fails the build when the contract changes.
</details>

## Sources
- [MSW — Getting started](https://mswjs.io/docs/getting-started)
- [MSW — Best practices](https://mswjs.io/docs/best-practices/)
- [TanStack Query — Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing)
- [Testing Library — renderHook](https://testing-library.com/docs/react-testing-library/api#renderhook)
- [Orval — MSW mocks](https://orval.dev/docs/guides/msw)
