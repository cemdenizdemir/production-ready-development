---
title: Form fundamentals, React Hook Form, accessibility, and submission UX
tech: React Hook Form 7, React 19.2
version: React Hook Form 7.6x, React 19.2
date: 2026-11-09
covers: [1, 2, 7, 8]
---
# Form fundamentals, React Hook Form, accessibility, and submission UX
[← Overview](00-overview.md)

## Why it matters
- Every keystroke in a 20-field checkout re-renders the whole form through `useState`; typing lags on phones.
- Errors appear while the user is still typing their email ("invalid email" after one character); they feel scolded and give up.
- The submit button stays enabled while the request is in flight; impatient users click twice.

## Concepts

### Controlled vs uncontrolled
| | Controlled | Uncontrolled |
|:--|:--|:--|
| value lives in | React state (`value` + `onChange`) | the DOM (`defaultValue`, read on submit) |
| re-render on each keystroke | yes | no |
| good for | inputs that drive other UI live | most form fields |
| React Hook Form | `Controller` for controlled third-party inputs | `register` (default) |

React 19's `<form action={fn}>` with `FormData` is great for simple forms (newsletter, search). Use React Hook Form when you need field-level validation, dynamic fields, or complex error mapping.

Native validation (`required`, `type="email"`) works without JavaScript; with RHF, set `noValidate` on the form and let the schema drive messages consistently.

### React Hook Form essentials
```tsx
const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, setError, reset } =
  useForm<AddressForm>({ resolver: zodResolver(addressSchema), mode: "onTouched", defaultValues });
```
| API | Does |
|:--|:--|
| `register("name")` | wires an input (name, ref, onChange, onBlur) |
| `handleSubmit(onValid)` | validates, then calls `onValid(data)` with typed data |
| `formState.errors` | field errors (`errors.postalCode?.message`) |
| `isSubmitting` | true while `onValid` returns a pending promise |
| `isDirty`, `dirtyFields`, `touchedFields` | change tracking |
| `mode` | when to validate: `onSubmit` (default), `onBlur`, `onTouched` (after first blur, then on change), `onChange` |
| `setError(field, { message })` | server errors |
| `reset(values)` | load data or clear after success |
| `watch` / `useWatch` | read values reactively (prefer `useWatch` for isolated re-renders) |
| `setFocus("field")` | move focus |

`mode: "onTouched"` is a good default: no errors until the user leaves a field, then live feedback while fixing it.

### Accessible forms with RHF
- Labels with `htmlFor`, errors linked with `aria-describedby`, `aria-invalid` (08-accessibility `Field` component).
- On submit errors, RHF focuses the first invalid field by default (`shouldFocusError: true`).
- Error messages in plain language, next to the field, not only in a toast.

### Submission UX
| Concern | Practice |
|:--|:--|
| pending | disable the submit button and show "Saving…" (`isSubmitting`) |
| double submit | disabled button + `Idempotency-Key` on creates |
| success | clear message, `reset()` or navigate; announce via `role="status"` |
| failure | keep input, show error near the button and on fields |
| unsaved changes | warn on navigation if `isDirty` (sparingly) |
| autosave forms | debounce, show "Saved" status |

## Example
`web/src/features/account/AddressForm.tsx`
```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field } from "@/components/ui/Field";

const addressSchema = z.object({
  name: z.string().trim().min(1, "Enter the recipient's name").max(100),
  street: z.string().trim().min(1, "Enter the street and number").max(200),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit postal code"),
  city: z.string().trim().min(1, "Enter the city").max(100),
});
type AddressForm = z.infer<typeof addressSchema>;

export function AddressFormView({ onSave }: { onSave: (a: AddressForm) => Promise<void> }) {
  const { register, handleSubmit, formState: { errors, isSubmitting, isSubmitSuccessful } } =
    useForm<AddressForm>({ resolver: zodResolver(addressSchema), mode: "onTouched" });

  return (
    <form noValidate onSubmit={handleSubmit(onSave)} className="grid gap-4">
      <Field label="Full name" error={errors.name?.message} required>
        <input autoComplete="name" {...register("name")} />
      </Field>
      <Field label="Street and number" error={errors.street?.message} required>
        <input autoComplete="street-address" {...register("street")} />
      </Field>
      <Field label="Postal code" hint="5 digits" error={errors.postalCode?.message} required>
        <input inputMode="numeric" autoComplete="postal-code" {...register("postalCode")} />
      </Field>
      <Field label="City" error={errors.city?.message} required>
        <input autoComplete="address-level2" {...register("city")} />
      </Field>
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save address"}</button>
      <p role="status">{isSubmitSuccessful ? "Address saved." : ""}</p>
    </form>
  );
}
```
(Lesson 02 replaces the hand-written schema with the one Orval generates from the API.)

## Production patterns
- Uncontrolled inputs via `register` for performance; `Controller` only for components that need it.
- `mode: "onTouched"`, `noValidate`, messages from the schema, focus on the first error.
- One `Field` component for labels, hints, errors, and ARIA wiring.
- Pending, success, and failure states designed for every form.

## Mistakes
Wrong: `useState` per field and validation on every keystroke from the first character.
Right: `register` + `mode: "onTouched"`.

Wrong: `onSubmit` without awaiting the save, so `isSubmitting` is false immediately.
Right: return the promise from the submit handler (`async (data) => { await save(data) }`).

## Check yourself
1. What does `mode: "onTouched"` do?
2. Why is `isSubmitting` sometimes always false?
3. When is a plain `<form action>` enough instead of React Hook Form?

<details><summary>Answers</summary>

1. Validates a field first when it loses focus, then re-validates on every change after that.
2. The submit handler doesn't return (or await) the async work, so RHF thinks submission finished instantly.
3. For small forms with server-side validation only and no dynamic fields (newsletter, search, simple settings).
</details>

## Sources
- [React Hook Form — useForm](https://react-hook-form.com/docs/useform)
- [React Hook Form — Accessibility](https://react-hook-form.com/advanced-usage#AccessibilityA11y)
- [react.dev — form action](https://react.dev/reference/react-dom/components/form)
- [Baymard Institute — Checkout usability](https://baymard.com/research/checkout-usability)
