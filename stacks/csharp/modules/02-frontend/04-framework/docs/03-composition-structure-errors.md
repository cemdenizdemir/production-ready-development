---
title: Composition, project structure, and error boundaries
tech: React 19.2, TypeScript
version: React 19.2
date: 2026-11-09
covers: [6, 11, 13]
---
# Composition, project structure, and error boundaries
[← Overview](00-overview.md)

## Why it matters
- A `<Modal>` grows 23 boolean props (`showFooter`, `hideClose`, `danger`…) and every new screen adds another.
- `user` is passed through seven layers of components that don't use it; renaming a field touches 30 files.
- One component throws on an unexpected `null` from the API and the whole page goes white.

## Concepts

### Composition patterns
| Pattern | Use | Example |
|:--|:--|:--|
| ⭐ `children` | let the parent decide the content | `<Card><OrderSummary /></Card>` |
| slots (named props of type `ReactNode`) | several content areas | `<Dialog title={…} footer={…}>` |
| compound components | a family sharing implicit state | `<Tabs><Tabs.List/><Tabs.Panel/></Tabs>` |
| ⭐ custom hooks | reuse stateful logic, not markup | `useDebouncedValue`, `useCart` |
| context | values many descendants need (theme, current user, locale) | avoid for fast-changing data |
| render props | caller controls rendering of each item | virtualized lists |

Prefer composition to configuration: fewer booleans, more `children`.

### Avoiding prop drilling
1. Compose: pass components down instead of data (`<Layout header={<UserMenu user={user} />}>`).
2. Context for truly global values.
3. Server state from the query cache by key, not through props (05-state-management).
4. URL for shared filters.

### Project structure
Group by **feature**, colocate what changes together.
```text
web/src/
  app/                  # Next.js routes (06-rendering) or Vite entry
  features/
    cart/   Cart.tsx  useCart.ts  cart.test.tsx  cart.ts
    orders/ OrderList.tsx  OrderDetails.tsx  orders.queries.ts
  components/ui/        # design-system primitives: Button, Dialog, Input
  api/                  # Orval-generated client + fetcher (don't edit generated files)
  lib/                  # money, dates, utilities
```
Rules: features may import from `components/ui`, `api`, `lib`, not from each other's internals; export a small public surface per feature (`features/cart/index.ts`). Same idea as feature modules in the ASP.NET Core API (03-backend/11-architecture).

### Error boundaries
An error boundary catches errors thrown while **rendering** its children and shows a fallback. It doesn't catch errors in event handlers or async code (handle those with `try/catch` and UI state).
```tsx
import { ErrorBoundary } from "react-error-boundary";

<ErrorBoundary fallbackRender={({ resetErrorBoundary }) => (
  <div role="alert"><p>Couldn't show your orders.</p><button onClick={resetErrorBoundary}>Try again</button></div>
)}>
  <OrderList />
</ErrorBoundary>
```
| Item | Note |
|:--|:--|
| class component with `getDerivedStateFromError` / `componentDidCatch` | the built-in way |
| `react-error-boundary` | common helper with reset support |
| placement | around independent page sections, not one per app |
| root callbacks (React 19) | `createRoot(el, { onUncaughtError, onCaughtError, onRecoverableError })` → report to Sentry |
| Next.js | `error.tsx` per route segment (06-rendering) |
| TanStack Query | `throwOnError` + `QueryErrorResetBoundary` |

## Example
`web/src/components/ui/Dialog.tsx` (slots + native `<dialog>`)
```tsx
import { useEffect, useRef, type ReactNode } from "react";

type Props = { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode };

export function Dialog({ open, onClose, title, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dialog-title" className="rounded-card p-6">
      <h2 id="dialog-title">{title}</h2>
      <div>{children}</div>
      {footer && <footer className="mt-4 flex justify-end gap-2">{footer}</footer>}
    </dialog>
  );
}
```
`web/src/main.tsx`
```tsx
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";

createRoot(document.getElementById("root")!, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
}).render(<App />);
```

## Production patterns
- A small design system (`components/ui`) of composable primitives; feature components compose them.
- Feature folders with colocated tests and queries; enforce boundaries with ESLint import rules (`no-restricted-imports`).
- Error boundaries per independent region (product list, recommendations, reviews) so one failure doesn't blank the page.
- Report caught and uncaught render errors with context (route, user id hash, release) to Sentry (13-testing-monitoring).

## Mistakes
Wrong: configuration explosion.
```tsx
<Modal showHeader hideClose dangerFooter confirmText="Delete" cancelText="Keep" icon="warn" />
```
Right: slots and children: `<Dialog title="Delete address?" footer={<><Button>Keep</Button><Button variant="danger">Delete</Button></>}>…</Dialog>`.

Wrong: expecting an error boundary to catch a failed `fetch` in a click handler.
Right: `try/catch` in the handler and render an error state.

## Check yourself
1. Name three ways to avoid prop drilling.
2. Which errors does an error boundary not catch?
3. Why are custom hooks better than copying `useState` + `useEffect` blocks?

<details><summary>Answers</summary>

1. Composition (pass elements), context, reading server state from the query cache, URL state.
2. Errors in event handlers, async code (promises, timers), server-side rendering of the boundary itself, and errors in the boundary.
3. They share stateful logic in one tested place with a clear API; each component still gets its own state.
</details>

## Sources
- [react.dev — Passing props / children](https://react.dev/learn/passing-props-to-a-component)
- [react.dev — Reusing logic with custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [react.dev — Error boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [react.dev — createRoot options](https://react.dev/reference/react-dom/client/createRoot)
- [react-error-boundary](https://github.com/bvaughn/react-error-boundary)
