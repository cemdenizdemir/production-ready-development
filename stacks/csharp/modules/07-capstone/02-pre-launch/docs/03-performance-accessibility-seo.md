---
title: Performance, accessibility, and SEO
tech: k6, BenchmarkDotNet, Lighthouse CI, axe-core, Next.js 16 Metadata API, Azure Front Door
version: k6 1.x, Next.js 16, WCAG 2.2
date: 2026-11-10
covers: [7, 8, 9]
---
# Performance, accessibility, and SEO
[← Overview](00-overview.md)

## Why it matters
- A newsletter campaign sends 5× normal traffic in ten minutes. If the load test never went that high, launch day is the load test.
- Slow product pages lose sales, and Core Web Vitals affect search ranking.
- Inaccessible checkouts lock out customers and, in the EU, break the law (European Accessibility Act). Missing metadata means the shop doesn't show up in search or looks broken when shared.

## Performance
| Item | Check | Evidence |
|:--|:--|:--|
| ⭐ campaign-peak load test | k6 open model at 100 req/s (browse 80%, search 15%, checkout 5%) for 20 min against staging with production-sized data; thresholds = SLOs | k6 report |
| stress / breakpoint | ramp until degradation; shedding returns 503s instead of timeouts | k6 report |
| soak | 2 h at normal load; no memory growth, no pool exhaustion | dotnet-counters / App Insights |
| ⭐ capacity | replicas × SQL pool within limits; `maxReplicas` set from the budget | capacity worksheet |
| ⭐ caching verified | Front Door cache hit ratio for static assets and images; HybridCache hit ratio for catalog; correct `Cache-Control` on personal pages (`private, no-store`) | metrics |
| database | top queries in Query Store reviewed; indexes for main access paths; no N+1 | Query Store |
| ⭐ Core Web Vitals budgets | LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on product, category, cart, checkout pages (mobile) | Lighthouse CI + RUM |
| bundle size | JS budget per route; images via `next/image`, WebP/AVIF | CI output |

## Accessibility (WCAG 2.2 AA)
| Item | Check | Evidence |
|:--|:--|:--|
| ⭐ automated gates | axe (Playwright + `@axe-core/playwright`) on key pages in CI; zero serious/critical violations | CI run |
| ⭐ keyboard pass | full purchase with keyboard only: visible focus, logical order, no traps, skip link | test notes |
| ⭐ screen reader pass | NVDA (Windows) and VoiceOver (macOS/iOS) through browse → cart → checkout | test notes |
| forms | labels, errors announced and linked (`aria-describedby`), autocomplete attributes | review |
| colour and zoom | contrast 4.5:1 text; works at 200% zoom and 320 px width; reduced motion respected | review |
| WCAG 2.2 additions | target size (24×24 px), focus not obscured, accessible authentication (no puzzle-only CAPTCHA), redundant entry avoided | review |
| statement | accessibility statement published (EAA) | link |

## SEO and metadata
| Item | Check | Evidence |
|:--|:--|:--|
| ⭐ titles and descriptions | unique per page via `generateMetadata` | page source |
| ⭐ canonical URLs | variant/filter URLs canonicalise to the product/category | page source |
| sitemap and robots | `app/sitemap.ts`, `app/robots.ts`; sitemap submitted | Search Console |
| Open Graph / Twitter cards | product image, title, price | share preview |
| ⭐ structured data | `Product` + `Offer` JSON-LD (price, availability), `BreadcrumbList` | Rich Results Test |
| ⭐ noindex outside production | staging and PR environments send `X-Robots-Tag: noindex` and block in robots | headers |
| status codes | real 404s for missing products, 301 for renamed slugs | tests |
| performance | Web Vitals above (ranking signal) | |

## Example
`perf/k6/campaign-peak.ts` (thresholds = SLOs)
```typescript
export const options = {
  scenarios: {
    campaign: { executor: "constant-arrival-rate", rate: 100, timeUnit: "1s", duration: "20m", preAllocatedVUs: 200, maxVUs: 600 },
  },
  thresholds: {
    http_req_failed: ["rate<0.001"],
    "http_req_duration{name:product}": ["p(95)<300"],
    "http_req_duration{name:checkout}": ["p(95)<800"],
  },
};
```
Product structured data in Next.js 16:
```tsx
// app/products/[slug]/page.tsx (excerpt)
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: product.name,
  image: product.images.map((i) => i.url),
  sku: product.defaultSku,
  offers: {
    "@type": "Offer",
    price: (product.priceMinor / 100).toFixed(2),
    priceCurrency: "EUR",
    availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  },
};
return (
  <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <ProductView product={product} />
  </>
);
```
Accessibility gate (Playwright + axe):
```typescript
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const path of ["/", "/products/ethiopia-guji", "/cart", "/checkout"]) {
  test(`no serious a11y violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
}
```

## Mistakes
Wrong: load testing with 10 virtual users against one product ID.
Right: open-model arrival rate at campaign peak with realistic data and endpoint mix.

Wrong: "axe passes, so we're accessible".
Right: automated gates plus manual keyboard and screen reader passes on the purchase flow.

Wrong: staging indexed by search engines.
Right: `noindex` headers and robots rules outside production.

## Check yourself
1. What makes a load test a good predictor of launch day?
2. Why are manual accessibility passes still needed?
3. Which three metadata items matter most for a product page?

<details><summary>Answers</summary>

1. An open-model arrival rate at (or above) the expected campaign peak, a realistic mix of endpoints and data volumes, a production-like environment, and thresholds equal to the SLOs, with server saturation watched during the run.
2. Automated tools find only part of WCAG issues; focus order, meaningful labels, announcements, keyboard traps, and the overall flow need a human with a keyboard and a screen reader.
3. A unique title and description, a canonical URL, and `Product`/`Offer` structured data (plus Open Graph for sharing).
</details>

## Sources
- [03-backend/09-scalability](../../../03-backend/09-scalability/README.md), [02-frontend/07-performance](../../../02-frontend/07-performance/README.md), [02-frontend/08-accessibility](../../../02-frontend/08-accessibility/README.md)
- [Web Vitals](https://web.dev/articles/vitals)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Next.js — Metadata and SEO](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [Google — Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product)
- [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
