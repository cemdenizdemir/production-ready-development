---
title: Errors, feedback, and reporting
tech: React 19.2, TanStack Query 5, Sentry
version: React 19.2, TanStack Query v5, Sentry JS SDK 10
date: 2026-11-07
covers: [3, 6, 10]
---
# Errors, feedback, and reporting
[← Overview](00-overview.md)

## Why it matters
- "Something went wrong" for every failure: users can't tell whether to retry, re-login, or fix their input, and they contact support.
- A form error is shown as a toast that disappears after 3 seconds; the user never finds which field was wrong.
- Errors are logged to the console only. The team learns about a broken checkout from Twitter.

## Concepts

### Map errors to user actions
| Error | Tell the user | Offer |
|:--|:--|:--|
| Network / timeout | "You seem to be offline" or "This is taking too long" | retry; keep their input |
| 400 / 422 validation | what's wrong with which field | inline messages at the fields |
| 401 | session expired | log in again, then return here |
| 403 | they don't have access | who to ask; go back |
| 404 | the thing doesn't exist (anymore) | search, go to list |
| 409 conflict | someone else changed it | reload and reapply |
| 429 | too many attempts | wait time (from `Retry-After`) |
| 5xx | our fault, not theirs | retry later; request ID for support |

A good message says **what happened**, **why** (if known), and **what to do next**, in plain language, without blaming the user. Never lose what they typed.

### Where errors surface
| Mechanism | Use for |
|:--|:--|
| Inline (next to the field or section) | validation, section-level load failures |
| Error boundary fallback | a component tree that can't render (render errors, `throwOnError` queries) |
| Page-level error (`error.tsx`, 404 page) | the main content failed |
| Toast | confirmation of a completed action, or a background failure the user didn't trigger directly |
| Banner | app-wide conditions: offline, maintenance, degraded service |

Error boundaries catch render errors, not event handler errors; for those, catch and set state, or let TanStack Query mutations expose `error`.

### Feedback and announcements
| Feedback | Accessible version |
|:--|:--|
| Success toast | `role="status"` (polite); auto-dismiss is fine |
| Error toast | `role="alert"`; don't auto-dismiss; include an action |
| Inline field error | `aria-describedby` + `aria-invalid` ([08-accessibility](../../08-accessibility/README.md)) |
| Section updated | announce via a polite live region |

Toasts: pause timers on hover/focus, keep them dismissible, don't cover primary actions, and never use them as the only place an actionable error appears.

### Reporting with context
Send unexpected errors to Sentry with what you need to reproduce: route, release, user ID (not email), feature, request ID. Don't report expected outcomes (validation failures, 404s for deleted items) as errors: they create noise that hides real problems.

## Example
`QueryErrorBoundary.tsx` — boundary that resets TanStack Query on retry.
```tsx
'use client';
import { Component, type ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';

class Boundary extends Component<{ onReset: () => void; children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  override componentDidCatch(error: Error) { Sentry.captureException(error); }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4">
        <p className="font-medium">This section couldn't load.</p>
        <button className="mt-2 underline" onClick={() => { this.props.onReset(); this.setState({ error: null }); }}>
          Try again
        </button>
      </div>
    );
  }
}

export function QueryErrorBoundary({ children }: { children: ReactNode }) {
  return <QueryErrorResetBoundary>{({ reset }) => <Boundary onReset={reset}>{children}</Boundary>}</QueryErrorResetBoundary>;
}
```
`errors.ts` — one place that turns HTTP errors into user messages.
```ts
export class HttpError extends Error {
  readonly status: number;
  readonly requestId: string | undefined;
  readonly retryAfterSeconds: number | undefined;
  constructor(status: number, message: string, requestId?: string, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function userMessage(error: unknown): string {
  if (!(error instanceof HttpError)) return 'Check your connection and try again.';
  switch (true) {
    case error.status === 401: return 'Your session has expired. Please log in again.';
    case error.status === 403: return "You don't have access to this. Ask an admin of your workspace.";
    case error.status === 404: return 'This item no longer exists.';
    case error.status === 409: return 'Someone else changed this. Reload to see the latest version.';
    case error.status === 429: return `Too many attempts. Try again in ${error.retryAfterSeconds ?? 60} seconds.`;
    case error.status >= 500: return `Something went wrong on our side. Try again in a moment.${error.requestId ? ` (Reference: ${error.requestId})` : ''}`;
    default: return error.message;
  }
}
```
Global handling for background failures, `query-client.ts`:
```ts
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { HttpError, userMessage } from './errors.ts';

const isExpected = (e: unknown) => e instanceof HttpError && e.status < 500;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) toast.error(`Couldn't refresh: ${userMessage(error)}`); // background refetch failed
      if (!isExpected(error)) Sentry.captureException(error, { tags: { queryKey: JSON.stringify(query.queryKey) } });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => { if (!isExpected(error)) Sentry.captureException(error); },
  }),
});
```
`toast` stands for your toast helper; the toast container renders success toasts with `role="status"` and errors with `role="alert"`.

## Production patterns
- **One error-to-message mapper** used everywhere, with copy reviewed like product text.
- **Inline for actionable errors, toasts for confirmations**, banners for app-wide conditions.
- **Error boundaries per section** with retry, plus a page-level fallback.
- **Request IDs shown on 5xx messages** and attached to Sentry events, so support can find the exact log.
- **Report unexpected errors only**, with release, route, and feature tags; alert on new or spiking issues.

## Mistakes
Wrong: one vague message for everything.
```tsx
catch { setError('Something went wrong'); }
```
Right: map by status (and error type) to a message with a next step.

Wrong: validation errors in a toast. Right: inline at the field, focus the first invalid field.

Wrong: clearing the form after a failed submit. Right: keep the input; show the error; let them retry.

Wrong: reporting every 4xx to Sentry. Thousands of "expected" events bury the real bug. Right: report unexpected errors; track expected ones as metrics if needed.

## Check yourself
1. What three things should a good error message tell the user?
2. Which errors belong inline, and which in a toast?
3. Why not send validation errors to Sentry?

<details>
<summary>Answers</summary>

1. What happened, why (if known and useful), and what they can do next.
2. Inline: errors the user must act on in context (field validation, a section that failed to load). Toast: confirmations and background failures not tied to a specific place on screen.
3. They're expected outcomes, not bugs; reporting them creates noise that hides real errors and costs quota. Track their rates as metrics if useful.
</details>

## Sources
- [Nielsen Norman Group — Error-message guidelines](https://www.nngroup.com/articles/error-message-guidelines/)
- [TanStack Query — `QueryErrorResetBoundary`](https://tanstack.com/query/latest/docs/framework/react/reference/QueryErrorResetBoundary)
- [TanStack Query — Global error callbacks (QueryCache)](https://tanstack.com/query/latest/docs/reference/QueryCache)
- [Sentry — Capturing errors (React)](https://docs.sentry.io/platforms/javascript/guides/react/usage/)
- [GOV.UK Design System — Error message](https://design-system.service.gov.uk/components/error-message/)
