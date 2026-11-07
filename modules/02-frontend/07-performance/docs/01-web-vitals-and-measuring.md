---
title: Core Web Vitals and how to measure them
tech: Lighthouse, Chrome DevTools, web-vitals, Next.js 16
version: web-vitals 5, Lighthouse CI, Chrome DevTools (Nov 2026)
date: 2026-11-07
covers: [1, 2, 11]
---
# Core Web Vitals and how to measure them
[← Overview](00-overview.md)

## Why it matters
- Lighthouse scores 98 on a developer's MacBook, while real users on mid-range phones have a 4.8 s LCP. Search Console flags the site as "poor".
- A "harmless" date library upgrade adds 70 KB to every page; nobody notices for three months because nothing measures it.
- The team optimizes Time to Interactive, a metric no user feels, while INP is failing on the checkout page.

## Concepts

### The Core Web Vitals
| Metric | Measures | Good | Poor | Typical causes |
|:--|:--|:--|:--|:--|
| **LCP** Largest Contentful Paint | when the main content appears | ≤ 2.5 s | > 4 s | slow TTFB, late-discovered hero image, render-blocking CSS/JS, client-side rendering |
| **INP** Interaction to Next Paint | worst-ish latency from input to next frame, whole visit | ≤ 200 ms | > 500 ms | long tasks, heavy handlers, big re-renders, third-party scripts |
| **CLS** Cumulative Layout Shift | unexpected movement of content | ≤ 0.1 | > 0.25 | images without dimensions, injected banners, font swaps |

Supporting metrics: **TTFB** (≤ 0.8 s), **FCP** (≤ 1.8 s), Total Blocking Time (lab proxy for INP). Scores are judged at the **75th percentile** of visits, split by mobile and desktop.

### Lab vs field
| | Lab (synthetic) | Field (real users, RUM) |
|:--|:--|:--|
| Tools | Lighthouse, DevTools Performance, WebPageTest | `web-vitals` library, CrUX, PageSpeed Insights field section, Search Console, Sentry |
| Strength | reproducible, detailed traces, debugging | the truth: real devices, networks, interactions |
| Weakness | one device and network; no real interactions (INP) | aggregated, slower feedback |

Use field data to decide **what** to fix, lab tools to find **why**.

### Tools
| Tool | Use |
|:--|:--|
| DevTools Performance panel | live LCP/INP/CLS while you click around; traces with insights (LCP breakdown, long tasks, layout shifts) |
| CPU and network throttling | simulate a mid-range phone (4× CPU slowdown, "Fast 4G") |
| Lighthouse (DevTools, CLI, PageSpeed Insights) | lab audit with prioritized suggestions |
| CrUX / PageSpeed Insights / Search Console | 28-day field data from Chrome users |
| `web-vitals` | collect field metrics from your own users, with attribution |
| Lighthouse CI | run audits in CI and fail on regressions |

### Budgets
A **performance budget** is a limit you enforce: "LCP under 2.5 s in Lighthouse on the product page", "JS per route under 170 KB gzipped", "no new third-party script without review". Enforce in CI so regressions fail the PR instead of reaching users.

## Example
`app/_components/WebVitals.tsx` (Next.js 16) — send field metrics with attribution.
```tsx
'use client';
import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    const body = JSON.stringify({
      name: metric.name,           // LCP, INP, CLS, FCP, TTFB
      value: metric.value,
      rating: metric.rating,       // good | needs-improvement | poor
      id: metric.id,
      page: window.location.pathname,
    });
    navigator.sendBeacon?.('/api/vitals', body) || fetch('/api/vitals', { method: 'POST', body, keepalive: true });
  });
  return null;
}
```
In a Vite app, use the library directly; the attribution build tells you *what* was slow:
```ts
import { onCLS, onINP, onLCP } from 'web-vitals/attribution';

onLCP(({ value, attribution }) => report('LCP', value, { element: attribution.target, ttfb: attribution.timeToFirstByte }));
onINP(({ value, attribution }) => report('INP', value, { target: attribution.interactionTarget, inputDelay: attribution.inputDelay }));
onCLS(({ value, attribution }) => report('CLS', value, { source: attribution.largestShiftTarget }));
```
`lighthouserc.json` — Lighthouse CI budgets.
```json
{
  "ci": {
    "collect": {
      "startServerCommand": "pnpm start",
      "url": ["http://localhost:3000/", "http://localhost:3000/products/oak-desk-140"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["warn", { "maxNumericValue": 200 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```
Run with `pnpm dlx @lhci/cli autorun` in CI after the build.

## Production patterns
- **Collect RUM from day one** (web-vitals or Sentry) and watch the 75th percentile per route and device type.
- **Debug with throttling**: 4× CPU slowdown and a mobile network profile in DevTools.
- **Fix the biggest field problem first**, verified with a lab trace, then confirm in field data after release.
- **Budgets in CI** for key routes: Lighthouse CI assertions and a JS size limit.
- **Report performance next to errors** (Sentry) so regressions link to releases ([13-testing-monitoring](../../13-testing-monitoring/README.md)).

## Mistakes
Wrong: optimizing for a Lighthouse score on a fast laptop. Right: field data first, throttled lab runs to debug.

Wrong: averaging metrics. Averages hide the slow tail. Right: 75th percentile (and look at the 95th for INP problems).

Wrong: measuring only the home page. Right: the routes that matter for the business (product, checkout, dashboard).

Wrong: Lighthouse runs on every PR against a cold dev server. Right: production build (`next build && next start`), several runs, median result.

## Check yourself
1. Why can't Lighthouse measure INP?
2. What do "good" thresholds apply to: the average or something else?
3. Name one lab tool and one field tool, and what each is best at.

<details>
<summary>Answers</summary>

1. INP needs real user interactions across a visit; a page load in the lab has none. Lighthouse reports Total Blocking Time as a proxy.
2. The 75th percentile of page visits (separately for mobile and desktop).
3. Lab: DevTools Performance panel or Lighthouse, best for reproducible traces and finding causes. Field: web-vitals RUM, CrUX, or PageSpeed Insights field data, best for knowing what real users experience.
</details>

## Sources
- [web.dev — Web Vitals](https://web.dev/articles/vitals)
- [web.dev — Defining Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds)
- [web.dev — Lab and field data](https://web.dev/articles/lab-and-field-data-differences)
- [Next.js — `useReportWebVitals`](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
