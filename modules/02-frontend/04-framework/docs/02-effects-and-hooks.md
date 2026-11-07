---
title: Effects, hooks, and React 19.2 additions
tech: React 19.2, TypeScript
version: React 19.2, eslint-plugin-react-hooks 7
date: 2026-11-07
covers: [3, 4, 8]
---
# Effects, hooks, and React 19.2 additions
[← Overview](00-overview.md)

## Why it matters
- A `useEffect` fetches on every change of `query`, with no cancellation. Slow responses arrive out of order and the UI shows results for an old search.
- An effect copies props into state "to keep them in sync", causing an extra render and a flash of stale data on every change.
- A chat room effect reconnects every time the theme changes, because the theme is read inside the effect for one log line.

## Concepts

### What effects are for
Effects **synchronize a component with an external system** after React commits: browser APIs, subscriptions, sockets, timers, non-React widgets.

| You want to… | Use |
|:--|:--|
| Compute a value from props/state | calculate during render |
| Respond to a click or submit | the event handler |
| Reset state when a prop changes | a `key` on the component |
| Fetch server data | TanStack Query (05-state-management) or Server Components (06-rendering) |
| Subscribe to an external store | `useSyncExternalStore` |
| Connect to a socket, start a timer, measure the DOM | `useEffect` / `useLayoutEffect` |

### The effect lifecycle
- The effect runs after commit; its **cleanup** runs before the next run and on unmount.
- The dependency array lists every reactive value the effect reads; the lint rule (`react-hooks/exhaustive-deps`) enforces it. Don't silence it: restructure instead.
- In development, StrictMode mounts, unmounts, and remounts each component once to prove cleanup works.

### `useEffectEvent` (React 19.2)
Wraps logic that must read the **latest** props/state but should **not** re-trigger the effect. Call it only from inside effects.

### Core hooks
| Hook | Use |
|:--|:--|
| `useState` | simple local state |
| `useReducer` | related state with named transitions (wizards, state machines) |
| `useRef` | mutable value that doesn't render (timers, previous values) or a DOM node |
| `useContext` / `use(Context)` | read context (19: `use` works conditionally) |
| `useId` | stable unique IDs for `htmlFor`/`aria-*`, SSR-safe |
| `useMemo` / `useCallback` | memoize values/functions (mostly automatic with the compiler) |
| `useLayoutEffect` | measure layout before paint (rare) |
| `useSyncExternalStore` | subscribe to non-React stores (browser APIs, stores) |
| `useImperativeHandle` | expose a custom ref API (rare) |
| `useEffectEvent` | latest values inside effects without dependencies (19.2) |

**Rules of hooks:** call hooks at the top level of components or custom hooks, never in conditions, loops, or nested functions.

### `<Activity>` (React 19.2)
`<Activity mode="hidden">` hides a subtree but **keeps its state**; its effects are cleaned up while hidden and recreated when visible again. Useful for tabs, back navigation, and pre-rendering likely next screens.

## Example
`ChatRoom.tsx` — subscription with cleanup, latest values without reconnecting.
```tsx
import { useEffect, useEffectEvent, useState } from 'react';
import { createConnection } from './chat-client.ts';

export function ChatRoom({ roomId, theme }: { roomId: string; theme: 'light' | 'dark' }) {
  const [messages, setMessages] = useState<string[]>([]);

  const onConnected = useEffectEvent(() => {
    analytics.track('chat_connected', { roomId, theme }); // reads the latest theme, isn't a dependency
  });

  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on('connected', onConnected);
    connection.on('message', (m: string) => setMessages((prev) => [...prev, m]));
    connection.connect();
    return () => connection.disconnect(); // runs before reconnecting to a new room, and on unmount
  }, [roomId]); // theme changes no longer reconnect

  return <ul>{messages.map((m, i) => <li key={i}>{m}</li>)}</ul>; // append-only log: index is stable
}
```
`useOnlineStatus.ts` — an external store, the right way.
```ts
import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
```
`CheckoutWizard.tsx` — `useReducer` for named transitions.
```tsx
import { useReducer } from 'react';

type State = { step: 'address' | 'payment' | 'review'; address?: string };
type Action = { type: 'addressSaved'; address: string } | { type: 'paymentSaved' } | { type: 'back' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addressSaved': return { step: 'payment', address: action.address };
    case 'paymentSaved': return { ...state, step: 'review' };
    case 'back': return { ...state, step: state.step === 'review' ? 'payment' : 'address' };
  }
}

export function CheckoutWizard() {
  const [state, dispatch] = useReducer(reducer, { step: 'address' });
  // render the step; buttons dispatch actions instead of setting several booleans
  return <p>Step: {state.step}</p>;
}
```
Tabs that keep their state with `<Activity>`:
```tsx
import { Activity } from 'react';

<Activity mode={tab === 'details' ? 'visible' : 'hidden'}><Details /></Activity>
<Activity mode={tab === 'reviews' ? 'visible' : 'hidden'}><Reviews /></Activity>
```

## Production patterns
- **Default to no effect.** Ask "what external system am I syncing with?"; if none, you don't need one.
- **Fetching belongs in a data library** with caching, deduplication, retries, and cancellation, not in hand-written effects.
- **Every subscription has a cleanup.** StrictMode double-mounting in development is your test.
- **Custom hooks** (`useOnlineStatus`, `useDebouncedValue`) wrap effects behind clear names and reuse them.
- **Lint with `eslint-plugin-react-hooks` 7** (`configs.flat.recommended`): it enforces hook rules and React Compiler-related rules.

## Mistakes
Wrong: syncing props into state.
```tsx
const [fullName, setFullName] = useState('');
useEffect(() => setFullName(`${first} ${last}`), [first, last]); // extra render, stale first frame
```
Right: `` const fullName = `${first} ${last}`; ``

Wrong: a fetch effect without cancellation.
```tsx
useEffect(() => {
  fetch(`/api/search?q=${query}`).then((r) => r.json()).then(setResults); // out-of-order responses
}, [query]);
```
Right: TanStack Query, or abort in cleanup (`const c = new AbortController(); ...; return () => c.abort();`).

Wrong: hiding a dependency to stop re-runs.
```tsx
useEffect(() => { connect(roomId, theme); }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps
```
Right: move non-reactive logic into `useEffectEvent`, or restructure.

Wrong: logic in an effect that belongs in an event handler ("when `submitted` becomes true, POST"). Right: POST inside the submit handler.

## Check yourself
1. Name three things people do with `useEffect` that don't need it.
2. When does an effect's cleanup run?
3. What problem does `useEffectEvent` solve?

<details>
<summary>Answers</summary>

1. Deriving values from props/state, handling user events (submit, click), resetting state when a prop changes (use `key`), and fetching data that a data library should own.
2. Before the effect re-runs (because a dependency changed) and when the component unmounts; in development StrictMode also runs an extra mount-cleanup-mount cycle.
3. Reading the latest props or state inside an effect without listing them as dependencies, so the effect doesn't re-run (reconnect, resubscribe) when those values change.
</details>

## Sources
- [react.dev — You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [react.dev — Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [react.dev — `useEffectEvent`](https://react.dev/reference/react/useEffectEvent)
- [react.dev — `<Activity>`](https://react.dev/reference/react/Activity)
- [react.dev — `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
