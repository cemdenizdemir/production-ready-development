---
title: Media, loading order, and metadata
tech: HTML
version: HTML Living Standard (Nov 2026), Baseline 2025
date: 2026-11-09
covers: [5, 7, 8]
---
# Media, loading order, and metadata
[← Overview](00-overview.md)

## Why it matters
- Product images have no `width`/`height`; the page jumps as they load (bad CLS) and users tap the wrong button.
- The hero image is `loading="lazy"`; the largest contentful paint is delayed by a second on every product page.
- A shared product link on social media shows the site logo and "Roastery" instead of the coffee and its price, because Open Graph tags are missing.

## Concepts

### Images
| Attribute / element | Why |
|:--|:--|
| ⭐ `alt` | describes the image's purpose; `alt=""` for decorative images |
| ⭐ `width` + `height` | browser reserves space (aspect ratio) → no layout shift |
| `srcset` + `sizes` | browser picks the right resolution for the layout and screen |
| `<picture>` + `<source type="image/avif">` | modern formats with fallback; art direction |
| `loading="lazy"` | below-the-fold images; never the LCP image |
| `fetchpriority="high"` | the LCP image (hero) |
| `decoding="async"` | decode off the main thread |
| `<figure>` + `<figcaption>` | images with captions |

```html
<img src="/img/guji-800.avif"
     srcset="/img/guji-400.avif 400w, /img/guji-800.avif 800w, /img/guji-1600.avif 1600w"
     sizes="(min-width: 64rem) 40rem, 100vw"
     width="800" height="800" alt="Bag of Ethiopia Guji coffee beans"
     fetchpriority="high">
```
In Next.js, `next/image` generates `srcset`, sizes, and formats; you still provide `alt`, dimensions (or `fill`), and `priority`/`preload` for the LCP image (07-performance).

Video and audio: `<video controls preload="metadata" poster="…">` with `<track kind="captions">`; never autoplay with sound.

### Loading order and resource hints
| Item | Effect |
|:--|:--|
| `<script src defer>` | download in parallel, run after parsing, in order |
| `<script src async>` | run as soon as downloaded, any order (analytics) |
| `<script type="module">` | deferred by default |
| CSS in `<head>` | render-blocking by design; keep it small |
| `<link rel="preload" as="font" crossorigin>` | fetch a critical resource early |
| `<link rel="preconnect" href="https://api.shop.test">` | DNS + TCP + TLS ahead of time |
| `<link rel="dns-prefetch">` | DNS only |
| `<link rel="modulepreload">` | preload JS modules |
| `fetchpriority="high/low"` | adjust priority of images, scripts, fetches |

Next.js handles most of this (script ordering, font preloading via `next/font`). Know the primitives to read waterfalls in DevTools.

### Metadata for search and sharing
| Tag | Purpose |
|:--|:--|
| `<title>`, `<meta name="description">` | search results |
| `<link rel="canonical" href>` | the one URL for duplicate content (filters, tracking params) |
| `<meta name="robots" content="noindex">` | keep staging, search pages, carts out of indexes |
| Open Graph: `og:title`, `og:description`, `og:image`, `og:url`, `og:type` | link previews |
| `twitter:card` | X/Twitter preview style |
| JSON-LD `<script type="application/ld+json">` | structured data (Product, Offer, BreadcrumbList) → rich results |
| `hreflang` links | language/region alternates |

```html
<link rel="canonical" href="https://roastery.test/coffee/ethiopia-guji">
<meta property="og:title" content="Ethiopia Guji, 250 g">
<meta property="og:image" content="https://roastery.test/og/guji.png">
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "Product", "name": "Ethiopia Guji, 250 g",
  "offers": { "@type": "Offer", "price": "13.50", "priceCurrency": "EUR", "availability": "https://schema.org/InStock" } }
</script>
```
Product data (price, stock) comes from the ASP.NET Core API; render it server-side so crawlers see it.

## Example
`app/coffee/[slug]/page.html` (head of the rendered page)
```html
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ethiopia Guji, 250 g – Roastery</title>
  <meta name="description" content="Washed Ethiopian coffee with peach and jasmine notes.">
  <link rel="canonical" href="https://roastery.test/coffee/ethiopia-guji">
  <link rel="preconnect" href="https://images.roastery.test">
  <link rel="preload" as="image" href="/img/guji-800.avif" fetchpriority="high">
  <link rel="stylesheet" href="/_next/static/css/app.css">
  <script src="/_next/static/chunks/main.js" defer></script>
</head>
```

## Production patterns
- Every content image: meaningful `alt`, intrinsic dimensions, responsive `srcset`; the LCP image gets high priority, everything below the fold is lazy.
- `noindex` on non-production environments, set by environment config (and protected by auth anyway).
- JSON-LD generated from the same DTO the page renders, so prices can't disagree.
- Third-party scripts `async` or deferred, loaded after the main content (07-performance).

## Mistakes
Wrong: lazy-loading the hero.
```html
<img src="hero.avif" loading="lazy" alt="">
```
Right:
```html
<img src="hero.avif" fetchpriority="high" width="1600" height="900" alt="Fresh roasted beans on a tray">
```

Wrong: `alt="image"` or file names as alt text.
Right: describe the purpose; empty `alt=""` if it's decorative.

## Check yourself
1. Why do `width` and `height` attributes prevent layout shift even for responsive images?
2. What is the difference between `defer` and `async`?
3. Which tag tells search engines which URL is the original for a filtered product list?

<details><summary>Answers</summary>

1. The browser computes the aspect ratio from them and reserves space before the image loads, even when CSS scales it.
2. `defer` runs after parsing, in document order; `async` runs whenever it finishes downloading, in any order.
3. `<link rel="canonical" href="...">`.
</details>

## Sources
- [MDN — Responsive images](https://developer.mozilla.org/docs/Web/HTML/Guides/Responsive_images)
- [web.dev — Optimize LCP](https://web.dev/articles/optimize-lcp)
- [MDN — `<link rel>` values](https://developer.mozilla.org/docs/Web/HTML/Attributes/rel)
- [Open Graph protocol](https://ogp.me/)
- [Google — Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product)
