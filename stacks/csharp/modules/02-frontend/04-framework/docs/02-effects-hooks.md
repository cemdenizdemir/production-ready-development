---
title: Effects and the core hooks
tech: React 19.2, TypeScript
version: React 19.2
date: 2026-11-09
covers: [3, 4, 8]
---
# Effects and the core hooks
[← Overview](00-overview.md)

## Why it matters
- A `useEffect` fetches orders with no cleanup; quickly switching customers shows the wrong customer's orders when the slower request finishes last.
- An effect that sets state on every render puts the page in an infinite loop that hammers the API.
- A chat widget re-subscribes on every keystroke because the effect depends on an inline callback.

## Concepts

### When you need an effect
Effects synchronize a component with something **outside React**.
| Need | Use an effect? | Instead |
|:--|:--|:--|
| compute a value from props/state | no | compute during render |
| respond to a user action | no | event handler |
| fetch server data | usually no | TanStack Query (05-state-management) or Server Components |
| reset state when a prop changes | no | `key` |
| subscribe to a browser API, socket, or third-party widget | ✓ | effect with cleanup |
| set the document title from data | no | React 19 `<title>` in JSX (or Next.js metadata) |
| analytics "page viewed" | ✓ | effect |

```tsx
useEffect(() => {
  const controller = new AbortController();
  window.addEventListener("online", onOnline, { signal: controller.signal });
  return () => controller.abort();               // cleanup runs before the next effect and on unmount
}, [onOnline]);
```
In development, Strict Mode mounts, unmounts, and mounts again to prove your cleanup works.

### Core hooks
| Hook | Use | Note |
|:--|:--|:--|
| `useState` | local state | updater form for dependent updates |
| `useReducer` | state with several transitions | like a small state machine; easy to test |
| `useRef` | mutable box that doesn't re-render; DOM refs | not for render data |
| `useContext` | read context (theme, user, locale) | context changes re-render consumers |
| `useId` | unique IDs for `htmlFor`/`aria-*` | SSR-safe |
| `useSyncExternalStore` | subscribe to an external store | browser APIs, stores |
| `useMemo` / `useCallback` | memoization | mostly automatic with the compiler (lesson 05) |
| `useLayoutEffect` | measure DOM before paint | rare |
| `useEffectEvent` (19.2) | an event-like callback used inside an effect | reads latest values without re-running the effect |

Rules of hooks: call them at the top level of components or custom hooks, never in conditions or loops. The ESLint plugin `eslint-plugin-react-hooks` enforces this.

### `useEffectEvent`
```tsx
function OrderUpdates({ orderId, onStatus }: { orderId: string; onStatus: (s: string) => void }) {
  const handleStatus = useEffectEvent((status: string) => onStatus(status));   // always sees latest onStatus

  useEffect(() => {
    const es = new EventSource(`/api/orders/${orderId}/progress`);          // SSE from ASP.NET Core
    es.addEventListener("status", (e) => handleStatus(JSON.parse(e.data).status));
    return () => es.close();
  }, [orderId]);                                                            // re-subscribes only when orderId changes
}
```

### `<Activity>` (19.2)
`<Activity mode={visible ? "visible" : "hidden"}>` hides UI while keeping its state and DOM, deferring its updates. Use it for tabs or panels users switch between, instead of unmounting (losing state) or keeping everything visible (wasting work).

## Example
`web/src/hooks/useOnlineStatus.ts`
```ts
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const c = new AbortController();
  window.addEventListener("online", onChange, { signal: c.signal });
  window.addEventListener("offline", onChange, { signal: c.signal });
  return () => c.abort();
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);   // server snapshot: assume online
}
```
`web/src/checkout/checkoutReducer.ts`
```ts
type State = { step: "cart" | "address" | "payment" | "done"; error?: string };
type Action = { type: "next" } | { type: "back" } | { type: "fail"; error: string };

const order: State["step"][] = ["cart", "address", "payment", "done"];

export function checkoutReducer(state: State, action: Action): State {
  const i = order.indexOf(state.step);
  switch (action.type) {
    case "next": return { step: order[Math.min(i + 1, 3)] };
    case "back": return { step: order[Math.max(i - 1, 0)] };
    case "fail": return { ...state, error: action.error };
  }
}
```

## Production patterns
- Before writing `useEffect`, ask: is this synchronizing with something external? If not, it isn't an effect.
- Every effect that subscribes has a cleanup; every effect that fetches (if you must) aborts the request in cleanup.
- `useReducer` for multi-step flows like checkout; reducers are pure and unit-testable.
- `useEffectEvent` for callbacks used inside effects instead of disabling the dependency lint rule.

## Mistakes
Wrong: syncing state with an effect.
```tsx
useEffect(() => { setFullName(`${first} ${last}`); }, [first, last]);
```
Right: `const fullName = `${first} ${last}`;`

Wrong: fetch without cleanup (race conditions).
Right: TanStack Query, or `AbortController` + ignore stale responses in cleanup.

## Check yourself
1. When does an effect's cleanup run?
2. Why does Strict Mode run effects twice in development?
3. What problem does `useEffectEvent` solve?

<details><summary>Answers</summary>

1. Before the effect runs again (when dependencies changed) and when the component unmounts.
2. To reveal missing cleanup: if mount → unmount → mount breaks something, the effect isn't properly reversible.
3. Reading the latest props/state inside an effect's callbacks without listing them as dependencies (which would re-run the effect).
</details>

## Sources
- [react.dev — You might not need an effect](https://react.dev/learn/you-might-not-need-an-effect)
- [react.dev — Synchronizing with effects](https://react.dev/learn/synchronizing-with-effects)
- [react.dev — useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [react.dev — useEffectEvent](https://react.dev/reference/react/useEffectEvent)
- [react.dev — Activity](https://react.dev/reference/react/Activity)
