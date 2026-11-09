---
title: MSW, hooks, and TanStack Query in tests
tech: MSW 2, Vitest 4, Testing Library, TanStack Query 5
version: MSW 2.x, Vitest 4.x, TanStack Query v5
date: 2026-11-07
covers: [3, 4]
---
# MSW, hooks, and TanStack Query in tests
[← Overview](00-overview.md)

## Why it matters
- Tests mock `fetch` with a fake that returns data in a different shape than the API. Tests pass; the app crashes on real responses.
- The QueryClient is shared between tests; cached data from one test leaks into the next, and tests pass or fail depending on order.
- A query hook retries failed requests three times with backoff; the error-state test takes 7 seconds and times out in CI.

## Concepts

### MSW: mock at the network boundary
MSW intercepts requests at the network level (Service Worker in browsers, request interception in Node) and answers them with your handlers. Your real fetch code, URLs, headers, and parsing run unchanged.

| Piece | Use |
|:--|:--|
| `http.get/post/put/patch/delete(path, resolver)` | define a handler; paths support params (`/api/orders/:id`) |
| `HttpResponse.json(body, { status })` | JSON responses |
| `HttpResponse.error()` | simulate a network failure |
| `delay(ms)` | slow responses (loading states) |
| `setupServer(...handlers)` | Node (Vitest, jsdom) |
| `setupWorker(...handlers)` | browser (local development, Vitest browser mode, Storybook) |
| `server.use(...)` | override handlers for one test |
| `onUnhandledRequest: 'error'` | fail tests that hit an unmocked endpoint |

**One set of handlers** in `src/mocks/handlers.ts` serves unit tests, browser tests, and local development (frontend work without a running backend). Keep handler responses typed against your API types or Zod schemas so they don't drift.

### Testing hooks and context
- Test custom hooks through a component that uses them when possible (more realistic).
- For reusable hooks, `renderHook(() => useThing(), { wrapper })` with the providers the hook needs.
- Provide context with a `wrapper` component or a custom `renderWithProviders` helper.

### Testing TanStack Query
| Practice | Why |
|:--|:--|
| New `QueryClient` per test | no cache leaks between tests |
| `retry: false` in tests | error states appear immediately |
| MSW for responses | real query functions run |
| `findBy`/`waitFor` for results | queries resolve asynchronously |
| Assert UI, not the cache | behavior over implementation |

## Example
`src/mocks/handlers.ts` — shared handlers.
```ts
import { delay, http, HttpResponse } from 'msw';
import type { Order } from '@/features/orders/orders-queries';

export const orders: Order[] = [
  { id: 'o1', status: 'paid', totalCents: 2599, customerId: 'c1' },
  { id: 'o2', status: 'shipped', totalCents: 8900, customerId: 'c2' },
];

export const handlers = [
  http.get('/api/orders', async ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    await delay(50);
    const items = status && status !== 'all' ? orders.filter((o) => o.status === status) : orders;
    return HttpResponse.json({ items });
  }),
  http.get('/api/orders/:id', ({ params }) => {
    const order = orders.find((o) => o.id === params.id);
    return order ? HttpResponse.json(order) : HttpResponse.json({ title: 'Not found' }, { status: 404 });
  }),
];
```
`src/test/msw-server.ts` and setup:
```ts
import { setupServer } from 'msw/node';
import { handlers } from '@/mocks/handlers';

export const server = setupServer(...handlers);
```
```ts
// src/test/setup.ts (add to the jsdom setup from lesson 01)
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw-server.ts';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());      // drop per-test overrides
afterAll(() => server.close());
```
`src/test/render.tsx` — providers for every test, fresh each time.
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: createWrapper(), ...options }); // a fresh QueryClient per call
}
```
`OrdersSection.test.tsx`
```tsx
import { expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render';
import { OrdersSection } from './OrdersSection.tsx';

it('shows orders from the API', async () => {
  renderWithProviders(<OrdersSection filters={{ status: 'all', sort: 'newest' }} />);
  expect(await screen.findByText('o1')).toBeInTheDocument();
});

it('shows the empty state for a filter with no results', async () => {
  server.use(http.get('/api/orders', () => HttpResponse.json({ items: [] })));
  renderWithProviders(<OrdersSection filters={{ status: 'paid', sort: 'newest' }} />);
  expect(await screen.findByText('No orders match these filters')).toBeInTheDocument();
});

it('shows an error with a retry button when the API fails', async () => {
  server.use(http.get('/api/orders', () => HttpResponse.json({ title: 'Boom' }, { status: 500 })));
  renderWithProviders(<OrdersSection filters={{ status: 'all', sort: 'newest' }} />);
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
```
Testing a hook directly:
```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { createWrapper } from '@/test/render';
import { orderQuery } from './orders-queries.ts';

it('loads one order', async () => {
  const { result } = renderHook(() => useQuery(orderQuery('o1')), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.totalCents).toBe(2599);
});
```
Use MSW in development too: `npx msw init public/`, then start `setupWorker(...handlers)` behind a flag in `main.tsx` when `import.meta.env.VITE_API_MOCKING === 'enabled'`.

## Production patterns
- **MSW over `vi.mock('fetch')`**: real request code runs; one handler set serves tests and local dev.
- **`onUnhandledRequest: 'error'`** so new endpoints can't silently hit the network.
- **Fresh QueryClient per test with retries off**; never share clients between tests.
- **Typed handler data** (API types or schemas) so mocks stay in sync with the real API.
- **Test hooks through components** unless the hook is a reusable library piece.

## Mistakes
Wrong: stubbing `fetch` globally with a shape you invent.
```ts
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => ({ data: [] }) })); // no status, no headers, wrong shape
```
Right: MSW handlers returning `HttpResponse.json` with the real contract.

Wrong: a module-level QueryClient in the test file. Right: create one per test (`renderWithProviders`).

Wrong: leaving default retries on; error tests wait through exponential backoff. Right: `retry: false` in test clients.

Wrong: forgetting `server.resetHandlers()`; one test's 500 override breaks the next test. Right: reset after each test.

## Check yourself
1. Why does MSW give more confidence than mocking `fetch`?
2. What two QueryClient settings make tests fast and isolated?
3. How do you test the error state for one test without affecting others?

<details>
<summary>Answers</summary>

1. The app's real request code runs (URL building, headers, status handling, JSON parsing); only the server is replaced, and the same handlers can be used in development.
2. A new client per test (no shared cache) and `retry: false` (failures surface immediately); `gcTime: Infinity` also avoids timers after tests.
3. `server.use(http.get(..., () => HttpResponse.json(..., { status: 500 })))` inside that test, with `server.resetHandlers()` in `afterEach`.
</details>

## Sources
- [MSW — Getting started](https://mswjs.io/docs/getting-started)
- [MSW — Network behavior overrides](https://mswjs.io/docs/best-practices/network-behavior-overrides)
- [TanStack Query — Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing)
- [Testing Library — `renderHook`](https://testing-library.com/docs/react-testing-library/api#renderhook)
- [TkDodo — Testing React Query](https://tkdodo.eu/blog/testing-react-query)
