---
title: SEO, browser support, and offline basics
tech: Next.js 16, React 19.2, Vite 8
version: Next.js 16.x, Vite 8, browserslist (Baseline queries)
date: 2026-11-07
covers: [6, 9, 11]
---
# SEO, browser support, and offline basics
[← Overview](00-overview.md)

## Why it matters
- Product pages render their content client-side after an API call; search engines index thin pages and traffic drops after a redesign.
- `robots.txt` on production accidentally contains `Disallow: /` copied from staging. Organic traffic disappears over two weeks.
- A modern CSS feature breaks checkout on a two-year-old iPhone, which is 18% of your mobile customers.

## Concepts

### SEO essentials for web apps
| Area | Practice |
|:--|:--|
| Crawlable content | server-render important content (Server Components / SSR); real `<a href>` links |
| Titles and descriptions | unique per page (`generateMetadata`) |
| Canonical URLs | one URL per piece of content; strip tracking params |
| `hreflang` | link language versions |
| Sitemap | `sitemap.xml` (index files for > 50,000 URLs), submitted in Search Console |
| robots.txt | block only what must not be crawled; never block CSS/JS; `noindex` meta for pages that must not appear |
| Status codes | real 404s (not "soft 404" pages with 200), 301 for moved URLs |
| Structured data | JSON-LD: Product, Offer, BreadcrumbList, Organization, Article |
| Performance | Core Web Vitals are a ranking signal ([07-performance](../../07-performance/README.md)) |
| Social previews | Open Graph images per page |
| Monitoring | Search Console coverage, CWV report, crawl errors |

Logged-in app screens don't need SEO; mark them `noindex` and keep marketing/product pages crawlable.

### Browser support
| Tool | Use |
|:--|:--|
| Baseline | "widely available" (30+ months in all major browsers) is a safe default target |
| browserslist | one config for build tools: `"browserslist": ["baseline widely available"]` (or your own query) |
| Vite build target | defaults to Baseline widely available |
| Feature detection | `@supports (anchor-name: --a)` in CSS; `'showModal' in HTMLDialogElement.prototype` in JS |
| Progressive enhancement | core flow works everywhere; newer features enhance |
| Polyfills | only for features you use and targets need; load conditionally |
| Real devices | iOS Safari (all iOS browsers use WebKit), Android Chrome, low-end devices |
| Playwright projects | `chromium`, `firefox`, `webkit` in E2E runs |

Use analytics to choose targets: support what your users actually run.

### Offline and installable apps (basics)
| Piece | What it does |
|:--|:--|
| Web app manifest (`app/manifest.ts`) | name, icons, colors, `display: standalone`: makes the app installable |
| Service worker | a script between your app and the network: caching, offline fallback, push |
| Caching strategies | cache-first (static assets), network-first (HTML, API), stale-while-revalidate (non-critical data) |
| Offline fallback page | shown when navigation fails without network |
| Update flow | new service worker waits; prompt the user to reload |
| Kill switch | a way to unregister a broken service worker |
| Network status in UI | TanStack Query paused states, offline banner ([09-ux-states](../../09-ux-states/README.md)) |

Most apps need only: a manifest, a good offline message, and query-level caching. Full offline-first sync is a large project (also seen: Workbox, Serwist).

## Example
`app/robots.ts` and `app/sitemap.ts` (Next.js 16)
```ts
// app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.APP_ENV === 'production';
  return isProd
    ? { rules: [{ userAgent: '*', allow: '/', disallow: ['/account', '/api/'] }], sitemap: 'https://shop.example.com/sitemap.xml' }
    : { rules: [{ userAgent: '*', disallow: '/' }] };   // staging and previews stay out of search
}
```
```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/products';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  return products.map((p) => ({
    url: `https://shop.example.com/products/${p.id}`,
    lastModified: p.updatedAt,
    alternates: { languages: { de: `https://shop.example.com/de/products/${p.id}` } },
  }));
}
```
Breadcrumb structured data:
```tsx
const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Desks', item: 'https://shop.example.com/desks' },
    { '@type': 'ListItem', position: 2, name: 'Oak Desk 140 cm' },
  ],
};
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, '\\u003c') }} />
```
`package.json` browser targets and a CSS fallback:
```json
{ "browserslist": ["baseline widely available"] }
```
```css
.tooltip { position: absolute; top: 100%; left: 0; }            /* works everywhere */
@supports (anchor-name: --a) {
  .trigger { anchor-name: --trigger; }
  .tooltip { position-anchor: --trigger; top: anchor(bottom); left: anchor(left); position-try-fallbacks: flip-block; }
}
```
`app/manifest.ts`
```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Acme Shop', short_name: 'Acme', start_url: '/', display: 'standalone',
    background_color: '#ffffff', theme_color: '#1d4ed8',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
  };
}
```

## Production patterns
- **Environment-aware robots and `noindex`**, verified on every deploy (a CI check that production robots.txt allows crawling).
- **Server-rendered, canonical, linked content** for every page that should rank; structured data on products and articles.
- **Explicit browser targets** from analytics, wired into browserslist/Vite, with `@supports` fallbacks for newer CSS.
- **WebKit in the E2E matrix**: iOS users are on Safari's engine regardless of browser.
- **PWA features only with a maintenance plan**: service workers cache code; a bad one can pin users to a broken version.

## Mistakes
Wrong: copying staging `robots.txt` to production.
```text
User-agent: *
Disallow: /
```
Right: generate robots per environment (`app/robots.ts`).

Wrong: navigation with `onClick` + `router.push` on non-links. Crawlers and middle-click don't follow it. Right: `<Link href>` (a real `<a>`).

Wrong: a "Not found" page that returns 200. Right: `notFound()` so the response is a real 404.

Wrong: shipping a service worker without an update and kill-switch strategy. Right: versioned caches, an update prompt, and a way to unregister.

## Check yourself
1. What's the difference between `Disallow` in robots.txt and a `noindex` meta tag?
2. Why test on WebKit even if most users use Chrome on iOS?
3. Which caching strategy suits HTML pages in a service worker, and why?

<details>
<summary>Answers</summary>

1. `Disallow` stops crawling, but a disallowed URL can still be indexed from links (without content). `noindex` lets crawlers fetch the page and tells them not to index it; for it to work, the page must not be disallowed.
2. All browsers on iOS use Apple's WebKit engine, so "Chrome on iOS" behaves like Safari.
3. Network-first (with the cache as offline fallback): users get fresh HTML that references current assets; serving cached HTML first can pin them to old code.
</details>

## Sources
- [Google Search Central — SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google — Robots meta tag and robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Next.js — Metadata files (robots, sitemap, manifest)](https://nextjs.org/docs/app/api-reference/file-conventions/metadata)
- [web.dev — Baseline](https://web.dev/baseline)
- [browserslist — Baseline queries](https://github.com/browserslist/browserslist#queries)
- [web.dev — Service workers and caching strategies](https://web.dev/learn/pwa/caching)
