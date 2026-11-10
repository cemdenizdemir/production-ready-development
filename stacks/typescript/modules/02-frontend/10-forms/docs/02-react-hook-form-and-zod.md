---
title: React Hook Form with a shared Zod schema
tech: React Hook Form 7, Zod 4, React 19.2, Express 5
version: React Hook Form 7.6x, @hookform/resolvers 5, Zod 4.4
date: 2026-11-07
covers: [2, 3, 6]
---
# React Hook Form with a shared Zod schema
[← Overview](00-overview.md)

## Why it matters
- The frontend says passwords need 8 characters, the API requires 12. Users pass the form, then get a vague 400 from the server.
- The API answers "email already registered", but the UI shows a generic toast. The user doesn't know which field is wrong.
- Validation logic is copied into three places; a rule change updates two of them.

## Concepts

### React Hook Form essentials
| API | What it does |
|:--|:--|
| `useForm({ resolver, defaultValues, mode })` | creates the form; `mode` decides when validation runs |
| `register('email')` | connects an input (uncontrolled): `name`, `ref`, `onChange`, `onBlur` |
| `handleSubmit(onValid, onInvalid?)` | validates, then calls your submit with typed data |
| `formState` | `errors`, `isSubmitting`, `isDirty`, `isValid`, `isSubmitSuccessful`, `touchedFields` |
| `setError(name, { type, message })` | add errors (server results); `root.*` for form-level errors |
| `reset(values?)` | reset values and state (after success, or to load data) |
| `watch` / `useWatch` | subscribe to values (`useWatch` re-renders only its component) |
| `trigger(names?)` | validate on demand (multi-step forms) |
| `setFocus(name)` | focus a field |

| `mode` | Validates |
|:--|:--|
| `onSubmit` (default) | on submit, then on change for invalid fields |
| `onTouched` | after a field is blurred once, then on change (good default for UX) |
| `onBlur` | on blur |
| `onChange` | on every change (more re-renders) |
| `all` | blur and change |

### One schema, shared
Put schemas in a workspace package used by both apps:
```text
packages/schemas/src/signup.ts   → export const SignupSchema = z.object({...})
apps/web                         → zodResolver(SignupSchema)
apps/api                         → SignupSchema.safeParse(req.body)
```
`z.input<typeof S>` is what the form holds (strings from inputs); `z.output<typeof S>` is what you get after parsing (coerced, transformed). `@hookform/resolvers` v5 infers both.

### Server errors → fields
Agree on an error contract. For example, a 422 response with Problem Details plus field errors:
```json
{ "title": "Validation failed", "status": 422, "errors": { "email": ["Email is already registered"] } }
```
On the client, call `setError` for each field; anything not tied to a field goes to `root.serverError`.

## Example
`packages/schemas/src/signup.ts`
```ts
import { z } from 'zod';

export const SignupSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name').max(100),
    email: z.email('Enter a valid email address').transform((e) => e.toLowerCase()),
    password: z.string().min(12, 'Use at least 12 characters').max(128),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: 'You must accept the terms' }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type SignupInput = z.input<typeof SignupSchema>;
export type SignupData = z.output<typeof SignupSchema>;
```
`apps/api/src/routes/signup.ts` — the same schema guards the API.
```ts
import { z } from 'zod';
import { SignupSchema } from '@acme/schemas';

app.post('/signup', async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      title: 'Validation failed',
      status: 422,
      errors: z.flattenError(parsed.error).fieldErrors, // { email: ['…'], password: ['…'] }
    });
  }
  if (await users.existsByEmail(parsed.data.email)) {
    return res.status(422).json({ title: 'Validation failed', status: 422, errors: { email: ['Email is already registered'] } });
  }
  // ...create the user (03-backend/04-auth)...
  res.status(201).json({ ok: true });
});
```
`apps/web/src/features/auth/SignupForm.tsx`
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SignupSchema, type SignupData, type SignupInput } from '@acme/schemas';

type ApiErrors = { errors?: Partial<Record<keyof SignupInput, string[]>> };

export function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    register, handleSubmit, setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput, unknown, SignupData>({
    resolver: zodResolver(SignupSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(data: SignupData) {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.status === 422) {
      const body = (await res.json()) as ApiErrors;
      for (const [field, messages] of Object.entries(body.errors ?? {})) {
        setError(field as keyof SignupInput, { type: 'server', message: messages?.[0] }, { shouldFocus: true });
      }
      return;
    }
    if (!res.ok) return setError('root.serverError', { message: 'Sign-up failed. Please try again.' });
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="Name" error={errors.name?.message}>
        {(a11y) => <input {...register('name')} {...a11y} autoComplete="name" />}
      </Field>
      <Field label="Email" error={errors.email?.message}>
        {(a11y) => <input {...register('email')} {...a11y} type="email" autoComplete="email" />}
      </Field>
      <Field label="Password" error={errors.password?.message} hint="At least 12 characters.">
        {(a11y) => <input {...register('password')} {...a11y} type="password" autoComplete="new-password" />}
      </Field>
      <Field label="Confirm password" error={errors.confirmPassword?.message}>
        {(a11y) => <input {...register('confirmPassword')} {...a11y} type="password" autoComplete="new-password" />}
      </Field>
      <label><input type="checkbox" {...register('acceptTerms')} /> I accept the terms</label>
      {errors.acceptTerms && <p role="alert">{errors.acceptTerms.message}</p>}
      {errors.root?.serverError && <p role="alert">{errors.root.serverError.message}</p>}
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</button>
    </form>
  );
}
```
`Field.tsx` — label, hint, error, and ARIA wiring in one place.
```tsx
import { useId, type ReactNode } from 'react';

type A11y = { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string };

export function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: (a11y: A11y) => ReactNode;
}) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {hint && <p id={`${id}-hint`}>{hint}</p>}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error && <p id={`${id}-error`}>{error}</p>}
    </div>
  );
}
```

## Production patterns
- **Schemas in a shared package**; the API always re-validates (client validation is UX, not security).
- **A documented 422 contract** with field errors; one helper maps it to `setError` for every form.
- **`mode: 'onTouched'`** for friendly validation timing.
- **A `Field` component** that wires label, hint, error, and ARIA consistently.
- **Lowercase/trim in the schema** (`transform`) so client and server normalize identically.

## Mistakes
Wrong: separate rules on each side.
```ts
// web: password min 8   // api: password min 12
```
Right: one `SignupSchema` imported by both.

Wrong: server errors as a toast only. Right: `setError` on the field, focus it.

Wrong: `watch()` at the top of a big form to show one value; the whole form re-renders on every keystroke.
Right: `useWatch({ control, name: 'plan' })` inside the small component that needs it.

Wrong: trusting client validation and skipping `safeParse` in Express. Anyone can call the API directly. Right: validate on the server, always.

## Check yourself
1. What's the difference between `z.input` and `z.output` for a form schema?
2. How do you show "email already registered" next to the email field?
3. Why does `mode: 'onTouched'` feel better than `onChange`?

<details>
<summary>Answers</summary>

1. Input is the shape before parsing (what fields hold, usually strings); output is after parsing (coerced numbers, transformed values like lowercased emails). The form holds input; `handleSubmit` gives output.
2. The API returns a 422 with `errors.email`, and the client calls `setError('email', { type: 'server', message }, { shouldFocus: true })`.
3. It doesn't show errors while the user is still typing a field for the first time; it validates after they leave the field, then live-updates as they correct it.
</details>

## Sources
- [React Hook Form — `useForm`](https://react-hook-form.com/docs/useform)
- [React Hook Form — `setError`](https://react-hook-form.com/docs/useform/seterror)
- [@hookform/resolvers — Zod](https://github.com/react-hook-form/resolvers#zod)
- [Zod — Formatting errors](https://zod.dev/error-formatting)
- [RFC 9457 — Problem Details](https://www.rfc-editor.org/rfc/rfc9457)
