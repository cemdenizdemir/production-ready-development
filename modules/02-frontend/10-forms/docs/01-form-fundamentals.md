---
title: Form fundamentals, accessibility, and submission UX
tech: React 19.2, HTML
version: React 19.2
date: 2026-11-07
covers: [1, 7, 8]
---
# Form fundamentals, accessibility, and submission UX
[← Overview](00-overview.md)

## Why it matters
- Every keystroke in a 40-field controlled form re-renders the whole form; typing lags on mid-range phones.
- A failed submit clears the form. The user retypes a long address, fails again, and leaves.
- The submit button stays active during a slow request; a double-click creates two orders.

## Concepts

### Controlled vs uncontrolled inputs
| | Controlled | Uncontrolled |
|:--|:--|:--|
| Value lives in | React state (`value` + `onChange`) | the DOM (`defaultValue`) |
| Read value | from state, any time | on submit (`FormData`, refs) |
| Re-renders | on every keystroke | none while typing |
| Use for | values that drive other UI live (character counters, dependent fields) | most fields; React Hook Form and Actions use this |

### Native validation, then enhancement
HTML attributes (`required`, `type="email"`, `minlength`, `pattern`) describe constraints and give free basic validation. When you show custom error messages with JavaScript, add `noValidate` to the form to suppress native bubbles but keep the attributes: they still inform assistive technology and autofill.

### Simple forms with React 19 Actions
`<form action={fn}>` with `useActionState` handles pending state, results, and resetting uncontrolled fields after success. Good for small forms (newsletter, rename, comment). For complex validation, dynamic fields, or multi-step flows, use React Hook Form (lesson 02).

### Accessible forms checklist
| Requirement | How |
|:--|:--|
| Visible label per field | `<label htmlFor>` |
| Hints | `aria-describedby` |
| Error text per field | linked with `aria-describedby`, plus `aria-invalid="true"` |
| Error summary for long forms | list of links to invalid fields at the top |
| Focus the first error on submit | React Hook Form: `shouldFocusError` (default on) |
| Group related controls | `<fieldset>` + `<legend>` |
| Autofill | `autocomplete` tokens, correct `type` |
| Don't validate while typing the first time | validate on blur or submit, then re-validate on change |

### Submission UX
| Moment | Do |
|:--|:--|
| Submitting | disable the submit button, show "Saving…", keep fields readable |
| Duplicate protection | ignore repeat submits; send an `Idempotency-Key` for important actions |
| Failure | keep every value; show errors inline; focus the first problem |
| Success | confirm clearly (message or navigation); reset only if the user will enter new data |
| Slow (> few seconds) | keep the user informed; don't let them think it froze |
| Leaving with unsaved changes | warn (`beforeunload`) for long forms |

## Example
`NewsletterForm.tsx` — a small form with React 19 Actions.
```tsx
import { useActionState } from 'react';

type State = { status: 'idle' | 'success' | 'error'; message?: string };

async function subscribe(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get('email') ?? '');
  const res = await fetch('/api/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (res.status === 422) return { status: 'error', message: 'Enter a valid email address.' };
  if (!res.ok) return { status: 'error', message: 'Could not subscribe right now. Try again.' };
  return { status: 'success', message: 'Check your inbox to confirm.' };
}

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribe, { status: 'idle' });
  const invalid = state.status === 'error';
  return (
    <form action={action} noValidate>
      <label htmlFor="nl-email">Email</label>
      <input
        id="nl-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? 'nl-error' : undefined}
      />
      <button type="submit" disabled={pending}>{pending ? 'Subscribing…' : 'Subscribe'}</button>
      <p id="nl-error" role={invalid ? 'alert' : 'status'}>{state.message}</p>
    </form>
  );
}
```
Warn before leaving a dirty long form:
```tsx
import { useEffect } from 'react';

export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault(); // browser shows its own prompt
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}
```

## Production patterns
- **Uncontrolled by default** (React Hook Form or Actions); controlled only where the UI needs the live value.
- **Validate on blur or submit first, then on change** after the first error, so users aren't scolded mid-typing.
- **Every submit has three outcomes designed**: pending, failure with preserved input, success with clear confirmation.
- **Idempotency keys on create/payment endpoints**, generated once per form session.
- **Same error copy style everywhere**: specific, actionable, no blame.

## Mistakes
Wrong: controlled inputs for everything in a large form.
```tsx
const [form, setForm] = useState({ /* 40 fields */ });
<input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
```
Right: uncontrolled fields managed by React Hook Form.

Wrong: resetting the form on failure.
```ts
catch { form.reset(); setError('Failed'); }
```
Right: keep values, show inline errors, focus the first one.

Wrong: removing `required` because native bubbles look ugly. Right: keep the attribute, add `noValidate`, render your own messages.

Wrong: placeholder text as the label. Right: a visible `<label>`; placeholders only for examples ("e.g. 10115").

## Check yourself
1. When is a controlled input the right choice?
2. Why keep validation attributes when you use `noValidate`?
3. What should happen to the user's input after a failed submit?

<details>
<summary>Answers</summary>

1. When other UI depends on the value while typing: live character counts, instant previews, fields that enable or change other fields.
2. They still describe constraints to assistive technology (`required` → announced as required) and help autofill and mobile keyboards; `noValidate` only turns off the browser's error bubbles.
3. It stays exactly as entered; errors appear next to the relevant fields, and focus moves to the first problem.
</details>

## Sources
- [react.dev — Controlled and uncontrolled components](https://react.dev/learn/sharing-state-between-components#controlled-and-uncontrolled-components)
- [react.dev — `useActionState`](https://react.dev/reference/react/useActionState)
- [W3C WAI — Forms tutorial](https://www.w3.org/WAI/tutorials/forms/)
- [web.dev — Sign-up form best practices](https://web.dev/articles/sign-up-form-best-practices)
- [MDN — `beforeunload`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
