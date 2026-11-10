---
title: SEO, browser support, and offline basics
tech: Next.js 16, Baseline, browserslist, service workers
version: Next.js 16.x, Baseline 2025
date: 2026-11-09
covers: [6, 9, 11]
---
# SEO, browser support, and offline basics
[← Overview](00-overview.md)

## Why it matters
- 40,000 filtered category URLs (`?roast=light&sort=price&page=37`) are indexed; crawl budget is wasted and the real product pages rank lower.
- A new CSS feature is used without checking support; checkout breaks for customers on an older iOS version.
- A "PWA" service worker caches the checkout page; users see a stale cart and a price that no longer exists.

## Concepts

### SEO essentials for a shop
| Item | Next.js |
|:--|:--|
| ⭐ server-rendered content | product names, prices, descriptions in HTML (Server Components) |
| unique titles and descriptions | `generateMetadata` (06-rendering) |
| ⭐ canonical URLs | `alternates.canonical`; filtered/sorted lists canonical to the clean listing |
| `noindex` | search results, cart, account, checkout, non-production |
| sitemaps | `app/sitemap.ts` built from the API's product list (split above 50,000 URLs) |
| robots | `app/robots.ts` |
| structured data | JSON-LD Product, Offer, AggregateRating, BreadcrumbList, Organization |
| hreflang | `alternates.languages` per locale |
| internal links | real `<a href>` links between categories and products |
| status codes | real 404 (`notFound()`), 301/308 for moved products |
| performance | Core Web Vitals (07-performance) |

### Browser support
| Tool | Use |
|:--|:--|
| ⭐ Baseline | "newly available" (all major browsers) / "widely available" (30+ months) |
| browserslist | one query shared by build tools (`"browserslist": ["defaults", "not dead"]` or Baseline queries) |
| `@supports` / feature detection | progressive enhancement for newer CSS/JS |
| polyfills | only when needed, loaded conditionally |
| real devices / BrowserStack | test top devices from analytics |
| Playwright projects | Chromium, Firefox, WebKit in CI |

Policy example: target Baseline widely available; use newly available features with `@supports` fallbacks; analytics decide when to raise the floor.

### Offline and resilience basics
| Feature | Use | Caution |
|:--|:--|:--|
| network status UI | banner when offline (09-ux-states) | `navigator.onLine` isn't proof |
| HTTP caching | static assets cached long (07-performance) | |
| service worker | offline page, caching static assets, push | never cache personalized or transactional responses |
| web app manifest | installable app (name, icons, theme color) | `app/manifest.ts` in Next.js |
| background sync | retry queued requests | limited support |

For a shop, a minimal service worker (offline fallback page + static assets) or none at all is usually right. Serwist is a common library for Next.js service workers (also seen).

## Example
`web/src/app/sitemap.ts`
```ts
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const res = await fetch(`${process.env.API_URL}/catalog/sitemap-entries`, { signal: AbortSignal.timeout(10_000) });
  const products = (await res.json()) as { slug: string; updatedAt: string }[];
  return [
    { url: "https://roastery.test/", changeFrequency: "daily", priority: 1 },
    { url: "https://roastery.test/coffee", changeFrequency: "daily" },
    ...products.map((p) => ({ url: `https://roastery.test/coffee/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
```
`web/src/app/(shop)/coffee/[slug]/ProductJsonLd.tsx`
```tsx
export function ProductJsonLd({ p }: { p: ProductDto }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: [p.imageUrl],
    sku: p.sku,
    offers: { "@type": "Offer", price: (p.priceMinor / 100).toFixed(2), priceCurrency: p.currency,
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
```
`web/src/app/manifest.ts`
```ts
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Roastery", short_name: "Roastery", start_url: "/", display: "standalone",
    background_color: "#faf7f2", theme_color: "#5b3a29", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] };
}
```

## Production patterns
- Product and category pages rendered on the server with canonical URLs and JSON-LD from the same data as the page.
- `noindex` and `robots` per environment; sitemaps generated from the API.
- A written browser support policy based on Baseline and your analytics; Playwright runs WebKit and Firefox too.
- Service workers only for static assets and an offline page; never for cart, checkout, or account data.

## Mistakes
Wrong: indexing every filter combination.
Right: canonical to the clean listing, `noindex` on parameter-heavy variants, links to important filtered pages only.

Wrong: JSON-LD built by string concatenation with user content.
Right: `JSON.stringify` and escape `<` to avoid breaking out of the script tag.

## Check yourself
1. What should the canonical URL of `/coffee?sort=price&page=3` usually be?
2. What is the difference between Baseline "newly" and "widely" available?
3. Which responses must a service worker never cache?

<details><summary>Answers</summary>

1. The clean listing `/coffee` (or page-specific canonicals for paginated series if you index them), not each sort variant.
2. Newly: supported in all major browsers' current versions. Widely: has been for about 30 months, so most users' browsers have it.
3. Personalized or transactional ones: cart, checkout, account, anything with prices or stock that must be current.
</details>

## Sources
- [Google Search Central — SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google — Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Next.js — sitemap.ts](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [web.dev — Baseline](https://web.dev/baseline)
- [MDN — Service Worker API](https://developer.mozilla.org/docs/Web/API/Service_Worker_API)
