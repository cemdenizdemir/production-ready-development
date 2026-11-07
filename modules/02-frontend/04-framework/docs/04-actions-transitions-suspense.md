---
title: Actions, transitions, and Suspense
tech: React 19.2, TypeScript
version: React 19.2
date: 2026-11-07
covers: [7, 9]
---
# Actions, transitions, and Suspense
[← Overview](00-overview.md)

## Why it matters
- Every form re-implements `isSubmitting`, error state, and double-submit protection by hand, slightly differently each time.
- Typing in a search box freezes because each keystroke re-renders a 5,000-row table at full priority.
- A rarely used chart library ships in the main bundle; the dashboard's first load waits for 300 KB nobody needs yet.

## Concepts

### Actions (React 19)
An **Action** is an async function run inside a transition. React tracks its pending state, errors, and optimistic updates.

| API | What it gives you |
|:--|:--|
| `<form action={fn}>` | calls `fn(formData)` on submit; resets uncontrolled fields after success |
| `useActionState(action, initial)` | `[state, formAction, isPending]`; the action receives `(prevState, formData)` |
| `useFormStatus()` | `{ pending, data }` of the parent form, from any child (submit buttons) |
| `useOptimistic(value, update)` | show an optimistic value while an action runs; reverts automatically |
| `startTransition(async () => …)` | run any async update as an Action |

Other React 19 changes worth knowing: `ref` is a normal prop (no `forwardRef`), `<Context value>` replaces `<Context.Provider>`, ref callbacks can return a cleanup function, `<title>`/`<meta>`/`<link>` in components are hoisted into `<head>`, and `use(promise)` reads a promise during render with Suspense.

### Transitions
| API | Use |
|:--|:--|
| `useTransition()` | `[isPending, startTransition]`: mark an update as non-urgent; urgent updates (typing) interrupt it |
| `useDeferredValue(value, initial?)` | render with the old value first, then the new one in the background |

Transitions keep the UI responsive; they don't make rendering faster. Typing updates the input immediately; the expensive list follows.

### Suspense and lazy loading
- `<Suspense fallback={<Spinner />}>` shows the fallback while anything inside **suspends**: a `lazy()` component loading, `use(promise)` waiting, or a Suspense-enabled data hook (`useSuspenseQuery`).
- `lazy(() => import('./Chart.tsx'))` splits code into a separate chunk loaded on first render.
- Nest boundaries to reveal UI progressively; inside transitions React keeps showing the old UI instead of flashing a fallback.

## Example
`AddressForm.tsx` — an Action posting to the Express API.
```tsx
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

type State = { ok: boolean; error?: string };

async function saveAddress(_prev: State, formData: FormData): Promise<State> {
  const res = await fetch('/api/me/address', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(formData)),
  });
  if (!res.ok) return { ok: false, error: 'Could not save the address. Try again.' };
  return { ok: true };
}

function SubmitButton() {
  const { pending } = useFormStatus(); // reads the enclosing <form>
  return <button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save address'}</button>;
}

export function AddressForm() {
  const [state, formAction] = useActionState(saveAddress, { ok: false });
  return (
    <form action={formAction}>
      <label>Street <input name="street" autoComplete="street-address" required /></label>
      <label>Postal code <input name="postalCode" autoComplete="postal-code" required /></label>
      <SubmitButton />
      <p role="status">{state.error ?? (state.ok ? 'Saved.' : '')}</p>
    </form>
  );
}
```
Optimistic likes:
```tsx
import { useOptimistic, startTransition } from 'react';

export function LikeButton({ likes, onLike }: { likes: number; onLike: () => Promise<void> }) {
  const [optimisticLikes, addLike] = useOptimistic(likes, (current, delta: number) => current + delta);
  return (
    <button onClick={() => startTransition(async () => { addLike(1); await onLike(); })}>
      Like ({optimisticLikes})
    </button>
  );
}
```
Responsive search and lazy loading:
```tsx
import { lazy, Suspense, useDeferredValue, useState } from 'react';

const SalesChart = lazy(() => import('./SalesChart.tsx'));

export function Dashboard({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);           // input stays instant
  const stale = query !== deferredQuery;

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter rows" />
      <div style={{ opacity: stale ? 0.6 : 1 }}>
        <BigTable rows={rows} query={deferredQuery} />      {/* re-renders in the background */}
      </div>
      <Suspense fallback={<p>Loading chart…</p>}>
        <SalesChart />                                      {/* separate chunk, loaded on demand */}
      </Suspense>
    </>
  );
}
```

## Production patterns
- **Forms as Actions**: pending, errors, and resets handled by React; validation with Zod and React Hook Form for complex forms ([10-forms](../../10-forms/README.md)).
- **Optimistic UI for low-risk, high-frequency actions** (likes, toggles, reordering); never for payments.
- **`useDeferredValue` or transitions for expensive re-renders** triggered by typing; virtualize very long lists ([07-performance](../../07-performance/README.md)).
- **Lazy-load heavy, non-critical UI** (charts, editors, maps) behind Suspense boundaries placed where a fallback makes sense.
- **Server data with Suspense** through TanStack Query's `useSuspenseQuery`, not hand-rolled promise caches.

## Mistakes
Wrong: hand-rolled pending state everywhere.
```tsx
const [saving, setSaving] = useState(false);
async function onSubmit(e: React.FormEvent) { e.preventDefault(); setSaving(true); /* ... */ setSaving(false); }
```
Right: `useActionState` + `useFormStatus` (or React Hook Form's `formState.isSubmitting`).

Wrong: creating the promise during render for `use()`.
```tsx
const user = use(fetch('/api/me').then((r) => r.json())); // new promise each render: suspends forever
```
Right: get the promise from a cache or data library, or from a Server Component.

Wrong: `forwardRef` in new React 19 code. Right: accept `ref` as a regular prop.

Wrong: one Suspense boundary around the whole app; any lazy chunk blanks the page. Right: boundaries near the content that loads.

## Check yourself
1. What does `useFormStatus` give you, and where must it be called?
2. How does `useDeferredValue` keep typing responsive?
3. Why does `use(fetch(...))` inside a component cause problems?

<details>
<summary>Answers</summary>

1. The pending state (and submitted data) of the closest parent `<form>`; it must be called in a component rendered inside that form, not in the component that renders the form.
2. React first renders with the old value (cheap), commits the input update immediately, then renders the expensive part with the new value in the background, abandoning it if the user types again.
3. Each render creates a new promise; React suspends, re-renders, and gets yet another new promise, so it never resolves. Promises for `use()` must be stable (cached or passed from a server component).
</details>

## Sources
- [react.dev — React 19 release](https://react.dev/blog/2024/12/05/react-19)
- [react.dev — `useActionState`](https://react.dev/reference/react/useActionState)
- [react.dev — `useOptimistic`](https://react.dev/reference/react/useOptimistic)
- [react.dev — `useTransition`](https://react.dev/reference/react/useTransition)
- [react.dev — `<Suspense>`](https://react.dev/reference/react/Suspense) and [`lazy`](https://react.dev/reference/react/lazy)
