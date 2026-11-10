---
title: Core Web Vitals, measuring, and budgets
tech: Lighthouse, Chrome DevTools, web-vitals, Lighthouse CI
version: web-vitals 5, Lighthouse 12, Lighthouse CI 0.15
date: 2026-11-09
covers: [1, 2, 11]
---
# Core Web Vitals, measuring, and budgets
[← Overview](00-overview.md)

## Why it matters
- Lighthouse scores 98 on a developer's laptop; real users on mid-range Android phones over 4G have a p75 LCP of 4.1 s. Only field data shows it.
- A team "optimizes" by guessing and ships a refactor that doesn't touch the slow phase.
- A dependency upgrade adds 120 KB of JavaScript; nobody notices for three months because nothing measured it.

## Concepts

### Core Web Vitals
| Metric | Measures | Good (p75) | Poor |
|:--|:--|:--|:--|
| ⭐ LCP — Largest Contentful Paint | when the main content (hero image, heading) is visible | ≤ 2.5 s | > 4 s |
| ⭐ INP — Interaction to Next Paint | worst-ish latency from input to next frame, across the visit | ≤ 200 ms | > 500 ms |
| ⭐ CLS — Cumulative Layout Shift | unexpected movement of visible content | ≤ 0.1 | > 0.25 |
| TTFB (diagnostic) | time to first byte | ≤ 0.8 s | > 1.8 s |
| FCP (diagnostic) | first content painted | ≤ 1.8 s | > 3 s |

Assessed at the **75th percentile** of real page loads, per page group, mobile and desktop separately.

### Lab vs field
| | Lab | Field (RUM) |
|:--|:--|:--|
| tools | Lighthouse, DevTools Performance panel, WebPageTest | `web-vitals` in your app, CrUX, Search Console |
| strength | reproducible, detailed traces | real devices, networks, user behavior |
| weakness | one device/network profile; INP needs interactions | aggregated, harder to debug |
| use for | diagnosing and regression tests | knowing whether users are OK |

### Measuring tools
| Tool | Gives |
|:--|:--|
| Lighthouse (DevTools, CLI, PageSpeed Insights) | lab metrics + opportunities |
| DevTools Performance panel | flame chart, long tasks, LCP element, layout shifts, live metrics with throttling |
| ⭐ `web-vitals` (attribution build) | field LCP/INP/CLS with the element/event responsible |
| CrUX (Chrome UX Report) / PageSpeed Insights field data | Chrome users' p75 per URL/origin |
| Search Console Core Web Vitals report | groups of URLs failing |
| Sentry / Application Insights browser SDK | RUM alongside errors and traces |

### Budgets and regression tracking
| Budget | Example |
|:--|:--|
| metric budgets | LCP ≤ 2.5 s, CLS ≤ 0.05, TBT ≤ 200 ms on key pages (lab) |
| size budgets | first-load JS ≤ 170 KB gzip per route; hero image ≤ 150 KB |
| request budgets | ≤ 2 third-party origins on product pages |

Lighthouse CI runs Lighthouse several times against a preview deployment and fails the PR when assertions break.

## Example
`web/src/app/web-vitals.tsx`
```tsx
"use client";
import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    const body = JSON.stringify({
      name: metric.name, value: metric.value, rating: metric.rating,
      id: metric.id, navigationType: metric.navigationType, page: location.pathname,
    });
    navigator.sendBeacon?.("/api/rum", body) || fetch("/api/rum", { method: "POST", body, keepalive: true });
  });
  return null;
}
```
The ASP.NET Core API receives `/rum` and records the values as metrics (OpenTelemetry histogram per metric and route, 03-backend/10-observability), so frontend and backend dashboards live together. Alternatively, the Sentry SDK collects web vitals automatically (13-testing-monitoring).

`web/lighthouserc.json`
```json
{
  "ci": {
    "collect": { "url": ["https://preview.roastery.test/", "https://preview.roastery.test/coffee/ethiopia-guji"], "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.05 }],
        "total-blocking-time": ["warn", { "maxNumericValue": 200 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 250000 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

## Production patterns
- RUM on every page from day one; dashboards by route and device class at p75.
- Fix in the order of impact: the failing metric on the highest-traffic page group first.
- Lab tests with mobile throttling for diagnosis; budgets in CI for regressions.
- Tie releases to vitals (deploy markers) to catch regressions per release.

## Mistakes
Wrong: optimizing for the Lighthouse score on a fast laptop.
Right: look at field p75 (CrUX/RUM), then use the lab to find why.

Wrong: averages.
Right: percentiles (p75 for vitals, p95/p99 for API latency).

## Check yourself
1. Which percentile do Core Web Vitals use?
2. Why can't Lighthouse measure INP well?
3. What does the `web-vitals` attribution build add?

<details><summary>Answers</summary>

1. The 75th percentile of page loads.
2. INP needs real user interactions over a visit; a lab run has none or scripted ones (Lighthouse reports TBT as a proxy).
3. Details of what caused the value: the LCP element and its phases, the interaction target and phases for INP, the shifted elements for CLS.
</details>

## Sources
- [web.dev — Web Vitals](https://web.dev/articles/vitals)
- [web.dev — Lab and field data](https://web.dev/articles/lab-and-field-data-differences)
- [web-vitals](https://github.com/GoogleChrome/web-vitals)
- [Next.js — useReportWebVitals](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
