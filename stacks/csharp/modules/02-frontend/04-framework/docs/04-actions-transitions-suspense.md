---
title: Actions, transitions, and Suspense
tech: React 19.2, TypeScript
version: React 19.2
date: 2026-11-09
covers: [7, 9]
---
# Actions, transitions, and Suspense
[← Overview](00-overview.md)

## Why it matters
- A "Place order" button can be clicked three times before the first request returns; the API (without idempotency) creates three orders.
- Typing in a product filter freezes the input because every keystroke re-renders 2,000 cards synchronously.
- Each widget on the dashboard shows its own spinner at a different time; the page jumps five times while loading.

## Concepts

### Actions (React 19)
An **Action** is an async function run in a transition. React tracks its pending state, errors, and optimistic updates.
| API | Gives | Use |
|:--|:--|:--|
| `<form action={fn}>` | calls `fn(formData)` on submit, resets the form on success | forms |
| ⭐ `useActionState(fn, initial)` | `[state, dispatch, isPending]` | form result + errors |
| `useFormStatus()` | `{ pending, data }` of the parent form | submit buttons in design-system components |
| ⭐ `useOptimistic(state, update)` | show the expected result immediately, revert on failure | likes, cart quantity |
| `useTransition()` | `[isPending, startTransition]` | non-urgent updates and async actions |
| `use(promise)` / `use(context)` | read a promise (suspends) or context, even conditionally | data passed from Server Components |
| `ref` as a prop | no more `forwardRef` | design-system components |

Server Actions (Next.js) are Actions that run on the Next.js server; in this stack the business logic lives in ASP.NET Core, so most Actions call the API (06-rendering).

### Transitions
Updates inside `startTransition` are **non-urgent**: React can interrupt them to keep input responsive and keeps showing the old UI instead of a fallback.
```tsx
const [isPending, startTransition] = useTransition();
<input value={query} onChange={(e) => { setQuery(e.target.value); startTransition(() => setFilter(e.target.value)); }} />
```
`useDeferredValue(value)` is the same idea from the consumer's side: render with an older value while the new one renders in the background.

### Suspense
`<Suspense fallback={…}>` shows a fallback while something inside is waiting (lazy components, `use(promise)`, suspense-enabled data libraries like `useSuspenseQuery`). Boundaries decide **where** loading states appear.
| Placement | Effect |
|:--|:--|
| one boundary around the page | one spinner, then everything at once |
| boundaries per section | sections appear independently (streaming in Next.js) |
| nested boundaries | progressive reveal: shell first, details later |

`lazy(() => import("./AdminCharts"))` + `<Suspense>` code-splits a component.

## Example
`web/src/checkout/PlaceOrderForm.tsx`
```tsx
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { apiFetch, ApiError } from "../api/fetcher";

type Result = { ok: true; orderId: number } | { ok: false; message: string; fieldErrors?: Record<string, string[]> } | null;

async function placeOrder(_prev: Result, form: FormData): Promise<Result> {
  try {
    const order = await apiFetch<{ id: number }>("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": String(form.get("idempotencyKey")) },
      body: JSON.stringify({ addressId: form.get("addressId"), note: form.get("note") }),
    });
    return { ok: true, orderId: order.id };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.problem.title ?? "Couldn't place the order.", fieldErrors: e.problem.errors };
    throw e;                                            // unexpected → error boundary
  }
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Placing order…" : "Place order"}</button>;
}

export function PlaceOrderForm({ addressId }: { addressId: string }) {
  const [result, action] = useActionState(placeOrder, null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());   // one key per form instance; retries reuse it
  return (
    <form action={action}>
      <input type="hidden" name="addressId" value={addressId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label htmlFor="note">Delivery note</label>
      <textarea id="note" name="note" maxLength={500} />
      {result && !result.ok && <p role="alert">{result.message}</p>}
      {result?.ok && <p role="status">Order #{result.orderId} placed.</p>}
      <SubmitButton />
    </form>
  );
}
```
The disabled button prevents double submits in the UI; the `Idempotency-Key` (stable for the life of the form) makes retries safe on the ASP.NET Core side (03-backend/02-api-design).

## Production patterns
- Forms use Actions for pending/error state; submit buttons read `useFormStatus`.
- Optimistic UI for small, reversible changes (quantity, favorites); not for payments.
- Wrap expensive, non-urgent renders (filtering, tab switches) in transitions.
- Suspense boundaries placed per section to match the page's loading design (09-ux-states).

## Mistakes
Wrong: manual `isLoading` booleans everywhere.
```tsx
const [loading, setLoading] = useState(false);   // + try/finally in every handler
```
Right: `useActionState` / `useTransition` pending state.

Wrong: one Suspense boundary at the root.
Right: boundaries around independently loading sections.

## Check yourself
1. What three things does `useActionState` return?
2. What's the difference between a transition and a normal state update?
3. Where must `useFormStatus` be called from?

<details><summary>Answers</summary>

1. The latest action state, a dispatch function to pass to `<form action>` (or call), and `isPending`.
2. A transition is non-urgent and interruptible; React keeps the current UI responsive and visible while rendering it.
3. From a component rendered inside the `<form>` whose status it reads (e.g. the submit button component).
</details>

## Sources
- [react.dev — useActionState](https://react.dev/reference/react/useActionState)
- [react.dev — useFormStatus](https://react.dev/reference/react-dom/hooks/useFormStatus)
- [react.dev — useOptimistic](https://react.dev/reference/react/useOptimistic)
- [react.dev — useTransition](https://react.dev/reference/react/useTransition)
- [react.dev — Suspense](https://react.dev/reference/react/Suspense)
