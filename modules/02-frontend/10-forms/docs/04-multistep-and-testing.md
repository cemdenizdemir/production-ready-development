---
title: Multi-step forms, drafts, and testing
tech: React Hook Form 7, Zod 4, Vitest 4, Testing Library, MSW
version: React Hook Form 7.6x, Zod 4.4, Vitest 4, @testing-library/user-event 14, MSW 2
date: 2026-11-07
covers: [9, 11]
---
# Multi-step forms, drafts, and testing
[← Overview](00-overview.md)

## Why it matters
- A 4-step onboarding validates everything only at the end; users discover an error on step 1 after filling steps 2–4.
- The browser crashes on step 3 of a long application; all input is gone, and so is the applicant.
- A refactor breaks the "email already registered" mapping; nobody notices because tests only check the happy path.

## Concepts

### Multi-step forms
| Decision | Recommendation |
|:--|:--|
| One form or many? | one `useForm` for the whole flow (shared via `FormProvider`), steps render subsets of fields |
| Validation per step | `trigger(stepFields)` before moving on; full schema on final submit |
| Schemas | one full schema; derive step schemas with `.pick()` or list the field names per step |
| Step in the URL | `?step=2` so back/forward and refresh work |
| Going back | always allowed, never loses data |
| Progress | "Step 2 of 4" with step names; announce step changes and move focus to the step heading |
| Submit | only on the last step; review screen before irreversible submits |

### Drafts
| Option | Use | Watch out |
|:--|:--|:--|
| `localStorage` | short, non-sensitive drafts on one device | never passwords, payment data, IDs |
| Server-side drafts | long or multi-device flows (applications) | needs an API; good for compliance |
| `sessionStorage` | survive reloads, not new tabs | |

Save debounced on change (`watch` subscription), restore with `reset(draft)` on mount, clear on successful submit, and version the draft shape so old drafts don't break new forms.

### Testing forms
Test like a user with Testing Library + `user-event`: find fields by label, type, click submit, assert on visible text, ARIA state, and focus. Mock the API with MSW so the real fetch code runs, including the 422 mapping.

| Test | Assert |
|:--|:--|
| Client validation | message text, `aria-invalid`, focus on first invalid field |
| Successful submit | request body sent, success UI |
| Server validation (422) | error shown at the right field |
| Server failure (500) | form-level error, values kept |
| Pending state | button disabled while submitting |
| Field arrays | add/remove rows, validation per row |

## Example
`OnboardingForm.tsx` — one form, step validation, drafts.
```tsx
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const Onboarding = z.object({
  companyName: z.string().trim().min(1, 'Enter your company name'),
  vatId: z.string().trim().regex(/^[A-Z]{2}[A-Z0-9]{8,12}$/, 'Enter a valid VAT ID').optional().or(z.literal('')),
  teamSize: z.enum(['1-10', '11-50', '51+'], { error: 'Choose a team size' }),
  plan: z.enum(['starter', 'pro'], { error: 'Choose a plan' }),
});
type OnboardingInput = z.input<typeof Onboarding>;

const STEPS = [
  { title: 'Company', fields: ['companyName', 'vatId'] },
  { title: 'Team', fields: ['teamSize'] },
  { title: 'Plan', fields: ['plan'] },
] as const satisfies readonly { title: string; fields: readonly (keyof OnboardingInput)[] }[];

const DRAFT_KEY = 'onboarding-draft:v1'; // version the shape

export function OnboardingForm({ onDone }: { onDone: (d: z.output<typeof Onboarding>) => Promise<void> }) {
  const methods = useForm<OnboardingInput>({ resolver: zodResolver(Onboarding), mode: 'onTouched' });
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {                                     // restore draft once
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) methods.reset(JSON.parse(raw) as OnboardingInput);
  }, [methods]);

  useEffect(() => {                                     // save draft, debounced
    let timer: ReturnType<typeof setTimeout>;
    const sub = methods.watch((values) => {
      clearTimeout(timer);
      timer = setTimeout(() => localStorage.setItem(DRAFT_KEY, JSON.stringify(values)), 500);
    });
    return () => { sub.unsubscribe(); clearTimeout(timer); };
  }, [methods]);

  useEffect(() => { headingRef.current?.focus(); }, [step]); // announce the new step

  async function next() {
    const ok = await methods.trigger([...STEPS[step]!.fields]); // validate this step only
    if (ok) setStep((s) => s + 1);
  }

  const submit = methods.handleSubmit(async (data) => {
    await onDone(data as z.output<typeof Onboarding>);
    localStorage.removeItem(DRAFT_KEY);
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={submit} noValidate>
        <h2 ref={headingRef} tabIndex={-1}>Step {step + 1} of {STEPS.length}: {STEPS[step]!.title}</h2>
        {step === 0 && <CompanyStep />}
        {step === 1 && <TeamStep />}
        {step === 2 && <PlanStep />}
        {step > 0 && <button type="button" onClick={() => setStep((s) => s - 1)}>Back</button>}
        {step < STEPS.length - 1
          ? <button type="button" onClick={next}>Continue</button>
          : <button type="submit" disabled={methods.formState.isSubmitting}>Finish</button>}
      </form>
    </FormProvider>
  );
}
```
Step components read the form with `useFormContext()` and render `Field`s as in lesson 02.

`SignupForm.test.tsx` — user-level tests with MSW.
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-server.ts';           // setupServer(...handlers), started in setup file
import { SignupForm } from './SignupForm.tsx';

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
  await user.type(screen.getByLabelText('Email'), 'ada@example.com');
  await user.type(screen.getByLabelText('Password'), 'correct horse battery');
  await user.type(screen.getByLabelText('Confirm password'), 'correct horse battery');
  await user.click(screen.getByLabelText(/accept the terms/i));
}

describe('SignupForm', () => {
  it('shows client errors and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    render(<SignupForm onSuccess={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter your name')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('maps a 422 from the API to the email field', async () => {
    server.use(http.post('/api/signup', () =>
      HttpResponse.json({ status: 422, errors: { email: ['Email is already registered'] } }, { status: 422 })));
    const user = userEvent.setup();
    render(<SignupForm onSuccess={vi.fn()} />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Email is already registered')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('calls onSuccess after a successful submit', async () => {
    server.use(http.post('/api/signup', () => HttpResponse.json({ ok: true }, { status: 201 })));
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<SignupForm onSuccess={onSuccess} />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });
});
```

## Production patterns
- **One form instance across steps**, step-level `trigger`, full validation at the end.
- **Steps in the URL and focus on the step heading** for back-button support and screen readers.
- **Drafts for long forms**, versioned, cleared on success, never containing sensitive data.
- **Test the unhappy paths**: client errors, server 422 mapping, 500 handling, pending state.
- **MSW handlers shared between tests and local development** ([13-testing-monitoring](../../13-testing-monitoring/README.md)).

## Mistakes
Wrong: separate `useForm` per step, merged with spread at the end; validation rules across steps get lost.
Right: one form with `FormProvider`; each step renders a subset.

Wrong: saving drafts with passwords or card numbers in `localStorage`. Right: only non-sensitive fields; server-side drafts for anything regulated.

Wrong: tests that call `onSubmit` directly or query by CSS class. Right: label and role queries, `user-event` typing and clicking.

Wrong: `fireEvent.change` for typing; it skips keyboard events and focus behavior. Right: `await user.type(...)`.

## Check yourself
1. How do you validate only the current step's fields?
2. What must a stored draft never contain, and how do you handle shape changes?
3. Why use MSW instead of mocking `fetch` in form tests?

<details>
<summary>Answers</summary>

1. `await trigger(['companyName', 'vatId'])` with the field names of that step; it returns `true` when they're valid.
2. Sensitive data (passwords, payment data, government IDs). Version the storage key (`:v1`), and ignore or migrate drafts with an older version.
3. MSW intercepts at the network level, so your real request code runs (URL, headers, body, error parsing). Mocking `fetch` skips that code and can hide bugs in the 422 mapping.
</details>

## Sources
- [React Hook Form — `trigger`](https://react-hook-form.com/docs/useform/trigger)
- [React Hook Form — `FormProvider` / `useFormContext`](https://react-hook-form.com/docs/useformcontext)
- [Testing Library — user-event](https://testing-library.com/docs/user-event/intro)
- [Testing Library — Queries priority](https://testing-library.com/docs/queries/about#priority)
- [MSW — Getting started](https://mswjs.io/docs/getting-started)
