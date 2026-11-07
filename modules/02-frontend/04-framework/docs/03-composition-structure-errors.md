---
title: Composition, structure, and error boundaries
tech: React 19.2, TypeScript
version: React 19.2
date: 2026-11-07
covers: [6, 11, 13]
---
# Composition, structure, and error boundaries
[← Overview](00-overview.md)

## Why it matters
- A `user` prop is passed through seven components that don't use it, just to reach an avatar. Every refactor touches all seven files.
- A `<Card>` grows 23 boolean props (`showHeader`, `compact`, `withFooter`...). Nobody knows which combinations work.
- One widget throws while rendering, and the whole page goes blank because no error boundary contained it.

## Concepts

### Composition tools
| Tool | Use | Example |
|:--|:--|:--|
| `children` | let callers fill the content | `<Card><OrderSummary /></Card>` |
| Slot props | several named holes | `<Layout sidebar={<Nav />} header={<Header />}>` |
| Compound components | parts that share implicit state via context | `<Tabs><Tabs.List /><Tabs.Panel /></Tabs>` |
| Custom hooks | share stateful logic, not UI | `useDebouncedValue`, `useOnlineStatus` |
| Context | values many components need (theme, user, locale) | `<UserContext value={user}>` (React 19) |

Fix prop drilling in this order: **compose** (pass the rendered element down), then **context** for truly global values, then a store if needed ([05-state-management](../../05-state-management/README.md)). Keep frequently changing values out of big contexts; every consumer re-renders on change.

### Error boundaries
- Catch errors thrown **while rendering** (and in lifecycle methods) in their child tree, and show a fallback instead of unmounting the whole app.
- They do **not** catch errors in event handlers, async code (`setTimeout`, promises), or the boundary itself. Handle those with try/catch and state.
- Still class components in React 19 (or the `react-error-boundary` package, also seen).
- Root callbacks report errors: `createRoot(el, { onCaughtError, onUncaughtError, onRecoverableError })`.
- Place boundaries around routes and independent widgets, so one failure stays local.

### Project structure
| Folder | Contains |
|:--|:--|
| `src/app/` | app shell, routing, providers |
| `src/features/<feature>/` | components, hooks, API calls, types, tests for one feature |
| `src/components/ui/` | shared presentational components (Button, Dialog) |
| `src/lib/` | framework-free helpers (formatting, HTTP client) |
| Colocation | `OrderList.tsx`, `OrderList.test.tsx`, `useOrders.ts` side by side |

Import features through a small public surface; avoid giant barrel files (`index.ts` re-exporting everything): they slow tooling and cause circular imports. Use a path alias (`@/`) instead of `../../../`.

## Example
`Tabs.tsx` — a compound component with React 19's context provider syntax.
```tsx
import { createContext, use, useId, useState, type ReactNode } from 'react';

type TabsCtx = { active: string; setActive: (id: string) => void; baseId: string };
const TabsContext = createContext<TabsCtx | null>(null);

function useTabs() {
  const ctx = use(TabsContext);
  if (!ctx) throw new Error('Tabs parts must be used inside <Tabs>');
  return ctx;
}

export function Tabs({ defaultTab, children }: { defaultTab: string; children: ReactNode }) {
  const [active, setActive] = useState(defaultTab);
  const baseId = useId();
  return <TabsContext value={{ active, setActive, baseId }}>{children}</TabsContext>;
}

Tabs.List = function TabList({ children }: { children: ReactNode }) {
  return <div role="tablist">{children}</div>;
};

Tabs.Tab = function Tab({ id, children }: { id: string; children: ReactNode }) {
  const { active, setActive, baseId } = useTabs();
  return (
    <button role="tab" id={`${baseId}-tab-${id}`} aria-selected={active === id}
            aria-controls={`${baseId}-panel-${id}`} onClick={() => setActive(id)}>
      {children}
    </button>
  );
};

Tabs.Panel = function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const { active, baseId } = useTabs();
  return (
    <div role="tabpanel" id={`${baseId}-panel-${id}`} aria-labelledby={`${baseId}-tab-${id}`} hidden={active !== id}>
      {children}
    </div>
  );
};
```
A full accessible tabs widget also needs arrow-key navigation ([08-accessibility](../../08-accessibility/README.md)).

`ErrorBoundary.tsx` and reporting at the root:
```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { fallback: ReactNode; children: ReactNode };

export class ErrorBoundary extends Component<Props, { hasError: boolean }> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { componentStack: info.componentStack }); // Sentry in 13-testing-monitoring
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
```
```tsx
// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';

createRoot(document.getElementById('root')!, {
  onUncaughtError: (error, info) => reportError(error, info),
  onCaughtError: (error, info) => reportError(error, info),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// in a page:
// <ErrorBoundary fallback={<p>Recommendations are unavailable right now.</p>}><Recommendations /></ErrorBoundary>
```

## Production patterns
- **Composition before configuration**: `children` and slots instead of boolean props for every variation.
- **Feature folders with colocated tests**; shared UI in one place with a stable API.
- **Error boundaries at route level and around risky widgets** (third-party embeds, charts), with a helpful fallback and a retry.
- **Report every caught render error** with the component stack and the release version.
- **Context for slow-changing global values only**; split contexts by concern.

## Mistakes
Wrong: boolean-prop explosion.
```tsx
<Card showHeader compact withFooter footerAlign="right" hideBorder />
```
Right:
```tsx
<Card>
  <Card.Header>Orders</Card.Header>
  <OrderTable />
  <Card.Footer align="right"><Button>Export</Button></Card.Footer>
</Card>
```

Wrong: expecting an error boundary to catch event handler errors.
```tsx
<button onClick={() => { throw new Error('x'); }}>Pay</button> // not caught by boundaries
```
Right: try/catch in the handler; set error state; show a message.

Wrong: one giant context holding everything, updated on each keystroke. Every consumer re-renders.
Right: separate contexts, and local or server state for fast-changing data.

## Check yourself
1. What's the first fix for prop drilling, before reaching for context?
2. Which errors does an error boundary not catch?
3. Why can barrel files hurt a large project?

<details>
<summary>Answers</summary>

1. Composition: pass the already-rendered child down (`children` or a slot prop), so intermediate components don't need to know about the data.
2. Errors in event handlers, asynchronous code (timers, promises), server-side rendering, and errors thrown in the boundary itself.
3. Importing one thing loads the whole barrel, slowing dev servers, tests, and type checking, and they make circular dependencies easy to create.
</details>

## Sources
- [react.dev — Passing data deeply with context](https://react.dev/learn/passing-data-deeply-with-context)
- [react.dev — Reusing logic with custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [react.dev — Error boundaries (`Component`)](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [react.dev — `createRoot` options](https://react.dev/reference/react-dom/client/createRoot)
- [react.dev — React 19: `<Context>` as a provider](https://react.dev/blog/2024/12/05/react-19#context-as-a-provider)
