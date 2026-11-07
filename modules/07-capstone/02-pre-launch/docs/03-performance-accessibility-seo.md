---
title: Performance, accessibility, and SEO review
tech: Next.js 16, React 19.2, k6, Lighthouse, axe-core, Playwright
version: Next.js 16, React 19.2, k6 1.x, Lighthouse CI, @axe-core/playwright, WCAG 2.2 AA
date: 2026-11-07
covers: [7, 8, 9]
---
# Performance, accessibility, and SEO review
[← Overview](00-overview.md)

## Why it matters
- A campaign email sends 5,000 visitors in ten minutes. If nobody load-tested checkout at that rate, the launch becomes an incident.
- Checkout that can't be completed with a keyboard or screen reader loses customers and, in the EU, can breach the European Accessibility Act.
- Staging pages indexed by Google, or product pages without titles and structured data, hurt discovery for months.

## Performance
| Check | Target | How to verify |
|:--|:--|:--|
| API load test at campaign peak | 100 req/s, p95 < 300 ms browse, < 800 ms checkout start, errors < 1% | k6 run with thresholds ([03-backend/09-scalability lesson 01](../../../03-backend/09-scalability/docs/01-measuring-and-load-testing.md)) |
| Core Web Vitals (lab) | LCP < 2.5 s, INP < 200 ms, CLS < 0.1 | Lighthouse CI budgets on key pages |
| Core Web Vitals (field) | same at p75 of real users | web-vitals reporting after launch |
| Caching | product pages served from CDN; Redis hit ratio > 80% on product reads | CloudFront and Redis metrics |
| Images | modern formats, sized, lazy below the fold, LCP image prioritized | Lighthouse audits |
| JavaScript cost | route bundles within budget; no client-only pages that could be Server Components | bundle analyzer |
| Database | top queries indexed; no N+1 on product listing | `pg_stat_statements`, query count tests |

## Accessibility (WCAG 2.2 AA)
| Check | How to verify |
|:--|:--|
| Automated scan on key pages (home, product, cart, checkout start, account) | `@axe-core/playwright` in CI: zero violations |
| Keyboard: every action reachable, visible focus, no traps | manual pass through the purchase journey |
| Screen reader: product, cart, and form flows announced correctly | VoiceOver/NVDA pass |
| Forms: labels, errors linked and announced, autocomplete | form tests |
| Color contrast and text resizing | axe + manual zoom to 200% |
| Target size and focus not obscured (WCAG 2.2) | manual check on mobile layouts |
| Motion: `prefers-reduced-motion` respected | manual check |
| Accessibility statement published | page URL |

## SEO and metadata
| Check | How to verify |
|:--|:--|
| Unique titles and descriptions per page | `generateMetadata` review; crawl |
| Canonical URLs | page source |
| `sitemap.xml` and `robots.txt` | URLs return correct content |
| Open Graph and Twitter cards | share preview tools |
| Product structured data (JSON-LD `Product`, `Offer`) | Rich Results Test |
| `noindex` outside production | `curl -I https://staging…` shows `X-Robots-Tag: noindex` |
| Clean URLs and 301s for moved pages | crawl report |
| Performance and accessibility (ranking factors) | sections above |

## Example
`load/launch.ts` (k6) — the campaign-peak scenario as a gate.
```ts
export const options = {
  scenarios: {
    browse: { executor: 'constant-arrival-rate', rate: 90, timeUnit: '1s', duration: '15m', preAllocatedVUs: 100, maxVUs: 400, exec: 'browse' },
    checkout: { executor: 'constant-arrival-rate', rate: 10, timeUnit: '1s', duration: '15m', preAllocatedVUs: 30, maxVUs: 100, exec: 'checkout' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:browse}': ['p(95)<300'],
    'http_req_duration{scenario:checkout}': ['p(95)<800'],
  },
};
```
Accessibility gate with Playwright and axe:
```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const path of ['/', '/products/ethiopia-guji', '/cart', '/account/orders']) {
  test(`no WCAG 2.2 AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}
```
`lighthouserc.json` budgets for key pages:
```json
{
  "ci": {
    "collect": { "url": ["https://staging.shop.example.com/", "https://staging.shop.example.com/products/ethiopia-guji"], "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["warn", { "maxNumericValue": 200 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 0.95 }]
      }
    }
  }
}
```

## Mistakes
Wrong: load-testing only the home page. Right: the real mix, including checkout start and authenticated pages.

Wrong: relying on automated accessibility scans alone. They find roughly a third of issues. Right: automated gates plus manual keyboard and screen reader passes.

Wrong: forgetting `noindex` on staging. Right: environment-driven `X-Robots-Tag` and robots rules.

## Check yourself
1. Which performance numbers must pass before launch, and how are they measured?
2. Why aren't axe scans enough for WCAG 2.2 AA?
3. How do you keep staging out of search results?

<details>
<summary>Answers</summary>

1. API thresholds at campaign peak (p95 latency and error rate per scenario) via k6, and Core Web Vitals budgets (LCP, CLS, TBT/INP) via Lighthouse CI on key pages; after launch, field Core Web Vitals at p75.
2. Automated tools catch machine-checkable issues (contrast, missing labels, ARIA misuse) but not whether focus order makes sense, announcements are meaningful, or flows are usable with a keyboard or screen reader; those need manual testing.
3. Send `X-Robots-Tag: noindex` (and a disallowing `robots.txt`) on every non-production environment, driven by the environment config, and protect staging with authentication where possible.
</details>

## Sources
- [web.dev — Core Web Vitals](https://web.dev/articles/vitals)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Deque — axe-core Playwright integration](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Google Search Central — Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product)
