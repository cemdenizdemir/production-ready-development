---
title: Monitoring with Sentry
tech: Sentry, Next.js 16, React 19.2
version: Sentry JS SDK 10 (@sentry/nextjs, @sentry/react), Next.js 16
date: 2026-11-07
covers: [9, 10, 11]
---
# Monitoring with Sentry
[← Overview](00-overview.md)

## Why it matters
- A release breaks checkout on Safari only. Without monitoring, you learn about it from support tickets two days later.
- Errors arrive as `TypeError: e is undefined at main.4f3a.js:1:28734`: useless without source maps.
- Session Replay records customers typing card numbers and addresses because masking was turned off "to see more".

## Concepts

### What frontend monitoring covers
| Signal | Answers | Sentry feature |
|:--|:--|:--|
| Errors | what broke, where, for whom, since which release | issues, stack traces, breadcrumbs |
| Performance | how fast pages load and respond (LCP, INP, CLS), slow requests | tracing, web vitals |
| Sessions | crash-free rate per release | release health |
| Replays | what the user did before the error | Session Replay (masked) |
| Logs | structured app logs tied to traces | Sentry Logs |
| Feedback | what users say went wrong | User Feedback widget |

### Making errors useful
| Practice | Why |
|:--|:--|
| **Release** set on every event (git SHA) | "since which deploy?", suspect commits, regressions |
| **Source maps uploaded** at build, not served publicly | readable stack traces |
| **Environment** (`production`, `staging`, `preview`) | separate noise from real problems |
| User ID (not email), tags (feature, plan), context | filter and prioritize |
| Distributed tracing to the API (`tracePropagationTargets`) | frontend error ↔ backend trace |
| Filter noise: browser extensions, `ResizeObserver loop` warnings, bots, expected 4xx | signal over noise |

### Privacy
| Setting | Default in SDK 10 | Keep |
|:--|:--|:--|
| `sendDefaultPii` | false (no IPs, cookies, user data) | false unless you have a legal basis |
| Replay `maskAllText`, `blockAllMedia` | on | on; unmask only specific safe elements |
| `beforeSend` / `beforeSendTransaction` | — | scrub tokens, emails, query strings |
| Data scrubbing (server-side) | on | on |

### Alerting and triage
| Alert type | Example |
|:--|:--|
| New issue in production | first occurrence of an error |
| Regression | a resolved issue comes back in a new release |
| Frequency / users affected | > 100 users in 1 hour |
| Metric alert | error rate > 2%, crash-free sessions < 99.5%, INP p75 > 200 ms |

Triage loop: alert → assign (ownership rules or CODEOWNERS integration) → reproduce (replay, trace, breadcrumbs) → fix with a regression test → "resolve in next release" so regressions reopen automatically. Route alerts to the owning team's channel; page only for user-impacting production problems ([04-shipping/06-incident-response](../../../04-shipping/06-incident-response/README.md)).

## Example
Next.js 16 setup (the wizard `npx @sentry/wizard@latest -i nextjs` creates these files).

`instrumentation-client.ts` — browser SDK.
```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV,
  tracesSampleRate: 0.1,                         // 10% of page loads/navigations traced
  tracePropagationTargets: [/^\/api\//],         // send trace headers to our same-origin API
  replaysSessionSampleRate: 0,                   // no random session recordings
  replaysOnErrorSampleRate: 1.0,                 // record sessions that hit an error
  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
  sendDefaultPii: false,
  ignoreErrors: ['ResizeObserver loop completed with undelivered notifications'],
  beforeSend(event) {
    if (event.request?.url) event.request.url = event.request.url.split('?')[0]; // drop query strings
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```
`instrumentation.ts` — server and edge runtimes, plus request errors.
```ts
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config');
}

export const onRequestError = Sentry.captureRequestError; // errors in Server Components, actions, route handlers
```
`next.config.ts` — upload source maps during the build, then delete them from the output.
```ts
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = { output: 'standalone' };

export default withSentryConfig(nextConfig, {
  org: 'acme',
  project: 'web',
  authToken: process.env.SENTRY_AUTH_TOKEN,      // CI secret, never committed
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  tunnelRoute: '/monitoring',                    // route events through your domain (ad blockers)
  silent: !process.env.CI,
});
```
`app/global-error.tsx`
```tsx
'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="en">
      <body>
        <h1>Something went wrong</h1>
        <p>We've been notified. Please reload the page.</p>
      </body>
    </html>
  );
}
```
Vite + React app equivalent:
```ts
import * as Sentry from '@sentry/react';
import { createRoot } from 'react-dom/client';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_RELEASE,         // set to the git SHA at build; match the uploaded source maps
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

createRoot(document.getElementById('root')!, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
}).render(<App />);
// source maps: @sentry/vite-plugin in vite.config.ts with build.sourcemap: 'hidden'
```
Context for triage:
```ts
Sentry.setUser({ id: user.id });                       // no email or name
Sentry.setTag('plan', user.plan);
Sentry.captureException(err, { tags: { feature: 'checkout' }, extra: { cartItems: cart.items.length } });
```

## Production patterns
- **Release = git SHA**, source maps uploaded in CI and deleted from public output.
- **Environments separated**, preview/staging alerts muted or routed elsewhere.
- **Privacy by default**: no PII, masked replays, scrubbing in `beforeSend`.
- **Sample traces** (5–20%) and replays only on error, to control cost.
- **Alerts per team with ownership rules**; "resolve in next release" to catch regressions.
- **Every fixed production bug gets a regression test** (component or E2E).

## Mistakes
Wrong: public source maps, or none at all. Right: hidden source maps uploaded to Sentry, deleted from the deployed assets.

Wrong: `tracesSampleRate: 1.0` in production for a busy site. Right: a lower rate (and dynamic sampling) to balance insight and cost.

Wrong: replays without masking.
```ts
Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false });
```
Right: defaults on; unmask only specific, safe elements.

Wrong: alerting on every error event. Right: new issues, regressions, and user-impact thresholds; triage noise out with filters.

## Check yourself
1. Why must the SDK's `release` match the uploaded source maps?
2. What does `onRequestError` capture in Next.js?
3. Which replay settings protect user privacy?

<details>
<summary>Answers</summary>

1. Sentry looks up source maps by release (and file); if they don't match, stack traces stay minified, and release-based features (regressions, suspect commits) break.
2. Errors thrown during server rendering, in Server Components, Server Actions, route handlers, and proxy, reported with request context.
3. `maskAllText: true` and `blockAllMedia: true` (the defaults), plus `sendDefaultPii: false` and scrubbing in `beforeSend`; record sessions only on error.
</details>

## Sources
- [Sentry — Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry — React SDK](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry — Source maps](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [Sentry — Session Replay privacy](https://docs.sentry.io/platforms/javascript/session-replay/privacy/)
- [Sentry — Releases and health](https://docs.sentry.io/product/releases/)
- [Sentry — Alerts](https://docs.sentry.io/product/alerts/)
