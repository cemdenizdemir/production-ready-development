---
title: Sentry monitoring, performance, replays, and alerting
tech: Sentry (@sentry/nextjs), Application Insights (API side), W3C trace context
version: Sentry JS SDK 10
date: 2026-11-09
covers: [9, 10, 11]
---
# Sentry monitoring, performance, replays, and alerting
[← Overview](00-overview.md)

## Why it matters
- Production errors show minified stack traces (`a.b is not a function at 3f9a.js:1:20412`); nobody can tell which component failed.
- A release breaks the payment button on Safari only; it takes three days and angry emails to notice because nothing alerts on frontend errors.
- A Session Replay records customers typing their card numbers because masking was turned off "to see more".

## Concepts

### Sentry for Next.js
`@sentry/nextjs` instruments the browser, the Next.js server, and edge/proxy code:
| File | Runs |
|:--|:--|
| `instrumentation-client.ts` | browser SDK init |
| `instrumentation.ts` (+ `sentry.server.config.ts`) | Node server init (Server Components, route handlers, Server Actions) |
| `next.config.ts` with `withSentryConfig` | source map upload, release naming, tunnel route |

### Source maps and releases
| Item | Why |
|:--|:--|
| ⭐ source maps uploaded at build (auth token in CI secret) | readable stack traces |
| don't serve source maps publicly | `hideSourceMaps`/delete after upload |
| ⭐ `release` = commit SHA / image tag | errors tied to deploys; "regressed in release X" |
| `environment` | separate staging/production |
| deploy markers | release health, crash-free sessions |

### Context without personal data
- Tags: route, feature flag variants, locale, `traceId` from API errors.
- User: hashed ID only; `sendDefaultPii: false`.
- `beforeSend` to scrub; server-side data scrubbing rules in Sentry.
- Breadcrumbs: navigation, clicks, fetch calls (URLs without query strings with personal data).

### Performance and session monitoring
| Feature | Use | Caution |
|:--|:--|:--|
| tracing (`tracesSampleRate`) | page loads, navigations, fetches; Web Vitals | sample (e.g. 0.1) |
| distributed tracing | browser → Next.js → ASP.NET Core | propagate W3C `traceparent` to `/api/*` so Application Insights continues the trace |
| ⭐ Session Replay | DOM recording around errors | mask all text and inputs by default; `replaysOnErrorSampleRate: 1.0`, low session rate |
| profiling | CPU profiles in the browser | opt-in |
| user feedback widget | "what happened?" on errors | |

The API's own errors and traces live in Application Insights (03-backend/10-observability). Joining them by trace ID gives one story for a failed checkout across both stacks.

### Alerting and triage
| Alert | Condition |
|:--|:--|
| ⭐ new issue in production | first occurrence of a new error type |
| regression | resolved issue reappears in a new release |
| spike | error rate > N/min or > X% of sessions |
| release health | crash-free sessions drop below target |
| performance | p75 LCP/INP above budget on key routes |
| critical flows | errors tagged `feature:checkout` |

Triage workflow: route alerts by ownership (code owners / tags) → assign → reproduce with replay + trace → fix with a regression test → resolve "in next release". Ignore with rules (browser extensions, bots) instead of muting everything.

## Example
`web/instrumentation-client.ts`
```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV,
  release: process.env.NEXT_PUBLIC_RELEASE,                  // set at build from the commit SHA
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  tracePropagationTargets: [/^\/api\//],                     // our API only, never third parties
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })],
  ignoreErrors: [/ResizeObserver loop/, /extension:\/\//],
  beforeSend(event) {
    if (event.request?.url) event.request.url = event.request.url.split("?")[0];   // drop query strings
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```
`web/next.config.ts`
```ts
import { withSentryConfig } from "@sentry/nextjs";

export default withSentryConfig(
  { output: "standalone", cacheComponents: true, reactCompiler: true },
  { org: "roastery", project: "web", authToken: process.env.SENTRY_AUTH_TOKEN, sourcemaps: { deleteSourcemapsAfterUpload: true },
    tunnelRoute: "/monitoring" },                             // avoids ad blockers; add to CSP connect-src 'self'
);
```
Tag API errors with their trace ID (09-ux-states):
```ts
Sentry.withScope((scope) => {
  scope.setTag("api.traceId", (error.problem as { traceId?: string }).traceId ?? "none");
  Sentry.captureException(error);
});
```

## Production patterns
- Source maps uploaded in CI, never served; release = commit SHA, the same SHA as the container image.
- Replay with everything masked by default; unmask only specific, non-sensitive elements.
- Alerts for new issues, regressions, and spikes on critical flows, routed to owners, each with a runbook link.
- Trace propagation only to your own API, so frontend and App Insights traces join without leaking headers to third parties.

## Mistakes
Wrong: `replayIntegration({ maskAllText: false, maskAllInputs: false })`.
Right: mask by default; never record payment fields.

Wrong: `tracePropagationTargets: [/.*/]`.
Right: only first-party API URLs.

## Check yourself
1. Why must the Sentry `release` match the deployed commit?
2. What does `tracePropagationTargets` control?
3. Name three useful frontend alert conditions.

<details><summary>Answers</summary>

1. To map errors to the right source maps and to know which deploy introduced or fixed an issue.
2. Which outgoing requests get trace headers, so the backend can continue the trace (and third parties don't receive them).
3. New issue in production, regression after a release, error spikes on checkout, crash-free sessions below target, LCP/INP over budget.
</details>

## Sources
- [Sentry — Next.js manual setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [Sentry — Source maps](https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/)
- [Sentry — Session Replay privacy](https://docs.sentry.io/platforms/javascript/session-replay/privacy/)
- [Sentry — Distributed tracing](https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/distributed-tracing/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
