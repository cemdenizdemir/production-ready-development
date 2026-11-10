---
title: Errors, feedback, and reporting
tech: React 19.2, TanStack Query 5, Sentry (@sentry/nextjs)
version: React 19.2, TanStack Query v5, Sentry JS SDK 10
date: 2026-11-09
covers: [3, 6, 10]
---
# Errors, feedback, and reporting
[← Overview](00-overview.md)

## Why it matters
- "Error 500" appears in a red box with no explanation; the customer refreshes, loses their basket, and leaves.
- A toast saying "Saved!" disappears after 2 s; screen reader users never hear it and keyboard users can't reach its "Undo" button.
- Support gets "checkout broke at 14:02" and has to search all logs; the error the user saw had no reference to the API trace.

## Concepts

### Error handling layers
| Layer | Catches | UI |
|:--|:--|:--|
| field validation | bad input (client + `ValidationProblemDetails` from the API) | inline under the field (10-forms) |
| mutation errors | 409, 412, 429, 5xx on actions | inline message near the action, keep user input |
| query errors | failed loads | section error state with retry |
| error boundary | render errors, `throwOnError` queries | section fallback with retry/reset |
| Next.js `error.tsx` / `global-error.tsx` | route/root errors | page-level fallback |
| `not-found.tsx` | 404s | helpful 404 |

### Writing error messages
| Part | Example |
|:--|:--|
| what happened (plain words) | "We couldn't place your order." |
| why, if known | "One item is no longer in stock." |
| what to do | "Remove it or choose another size." |
| reference for support | "Reference: 4f2a9c1e" (from Problem Details `traceId`) |

Map API errors in one place:
| API response | User message |
|:--|:--|
| 400/422 with `errors` | field messages |
| 401 | redirect to sign in, keep return URL |
| 403 | "You don't have access to this." |
| 404 | "This order doesn't exist or isn't yours." |
| 409 `order.already_shipped` | "This order has shipped and can't be cancelled." |
| 412 | "This was changed by someone else. Reload to see the latest." |
| 429 | "Too many attempts. Try again in a minute." |
| 5xx / network | "Something went wrong on our side. Try again." + reference |

Retries: offer a button; automatic retries for queries (not 4xx) are handled by TanStack Query.

### Feedback patterns
| Pattern | Use | Accessibility |
|:--|:--|:--|
| inline message | result of a specific action or field | `role="status"` or `aria-describedby` |
| toast | brief confirmation not tied to a place ("Added to cart") | announced via live region; ≥ 5 s or until dismissed if it has actions; reachable by keyboard |
| banner | page-wide state (offline, maintenance) | `role="status"` or `alert` for critical |
| dialog | must-decide situations | focus managed |
| button state | pending/disabled/done | `aria-disabled`, text change |

### Reporting UI errors
Sentry captures unhandled errors, error-boundary errors, rejected promises, and (optionally) performance traces and replays. Add context that helps debugging without leaking personal data:
| Context | How |
|:--|:--|
| release | `SENTRY_RELEASE` = image tag/commit SHA |
| environment | staging/production |
| user | hashed ID, never email |
| tags | route, feature, `traceId` from the API's Problem Details |
| breadcrumbs | navigation, fetches (automatic) |
| distributed tracing | `sentry-trace`/`traceparent` propagated to ASP.NET Core so frontend errors link to backend traces |

## Example
`web/src/components/ui/ErrorState.tsx`
```tsx
"use client";
import { ApiError } from "@/api/fetcher";

export function messageFor(error: unknown): { text: string; reference?: string } {
  if (error instanceof ApiError) {
    const ref = (error.problem as { traceId?: string }).traceId?.split("-")[1]?.slice(0, 8);
    switch (true) {
      case error.status === 404: return { text: "We couldn't find that. It may have been removed." };
      case error.status === 429: return { text: "Too many attempts. Try again in a minute." };
      case error.status >= 500: return { text: "Something went wrong on our side. Try again.", reference: ref };
      default: return { text: error.problem.detail ?? error.problem.title ?? "That didn't work.", reference: ref };
    }
  }
  return { text: "Couldn't reach the shop. Check your connection and try again." };
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { text, reference } = messageFor(error);
  return (
    <div role="alert" className="grid gap-2 rounded-card border p-4">
      <p>{text}</p>
      {reference && <p className="text-sm">Reference: <code>{reference}</code></p>}
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}
```
`web/instrumentation-client.ts` (Sentry, excerpt)
```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,          // DSN is public by design
  environment: process.env.NEXT_PUBLIC_APP_ENV,
  tracesSampleRate: 0.1,
  tracePropagationTargets: [/^\/api\//],            // send trace headers to our API only
  sendDefaultPii: false,
});
```

## Production patterns
- One `messageFor(error)` mapping from Problem Details to human messages; components don't parse errors.
- Show a short reference derived from the API's `traceId`; support pastes it into Application Insights / Sentry.
- Toasts are for confirmations, not errors that need action; errors stay visible until resolved.
- Sentry with release, environment, hashed user, route tags, and trace propagation to the API.

## Mistakes
Wrong: showing raw errors.
```tsx
<p>{String(error)}</p>        // "TypeError: Failed to fetch" or a stack trace
```
Right: mapped, human messages with a next step.

Wrong: clearing the form after a failed submit.
Right: keep the user's input; show the error next to the action.

## Check yourself
1. What four parts make a good error message?
2. Why include a reference from the API's `traceId`?
3. Which data should never be sent to Sentry?

<details><summary>Answers</summary>

1. What happened, why (if known), what to do next, and a reference for support.
2. It links what the user saw to the exact backend trace and logs, so support and engineers find the cause quickly.
3. Personal data such as emails, addresses, payment details, passwords, and tokens (use hashed IDs and scrubbing).
</details>

## Sources
- [NN/g — Error message guidelines](https://www.nngroup.com/articles/error-message-guidelines/)
- [Next.js — Error handling](https://nextjs.org/docs/app/getting-started/error-handling)
- [Sentry — Next.js setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry — Distributed tracing](https://docs.sentry.io/concepts/key-terms/tracing/distributed-tracing/)
- [GOV.UK — Notification banner](https://design-system.service.gov.uk/components/notification-banner/)
