---
title: Media, loading, and metadata
tech: HTML
version: HTML Living Standard (Nov 2026)
date: 2026-11-07
covers: [5, 7, 8]
---
# Media, loading, and metadata
[← Overview](00-overview.md)

## Why it matters
- Images without `width` and `height` push content down as they load. Users tap the wrong button, and CLS fails.
- The hero image has `loading="lazy"`. It's the largest element on the page, so LCP gets slower by hundreds of milliseconds.
- A product link shared in chat shows no image or title because Open Graph tags are missing, and click-through drops.

## Concepts

### Images
| Attribute / element | Use |
|:--|:--|
| `alt` | describes the image's purpose; `alt=""` for decorative images |
| `width` + `height` | intrinsic size, so the browser reserves space (with CSS `height: auto`) |
| `srcset` + `sizes` | let the browser pick the right resolution for the layout width |
| `<picture>` + `<source type>` | modern formats (AVIF, WebP) with a fallback |
| `loading="lazy"` | defer offscreen images; **never** on the LCP image |
| `fetchpriority="high"` | boost the LCP image |
| `decoding="async"` | decode off the main thread |

Writing alt text: what would you say if you described the image to someone on the phone, in this context? Don't start with "image of".

### Video and audio
`<video controls preload="metadata" poster="...">` with `<track kind="captions" srclang="en" label="English">`. Captions are required for accessibility; autoplay only when muted, and respect reduced motion.

### Scripts and loading order
| Tag | Downloads | Runs |
|:--|:--|:--|
| `<script src>` in `<head>` | blocks parsing | immediately (render-blocking) |
| `<script defer>` | in parallel | after parsing, in order |
| `<script async>` | in parallel | as soon as loaded, any order |
| `<script type="module">` | in parallel | deferred by default |
| `<link rel="stylesheet">` | render-blocking | before first paint |

### Resource hints
| Hint | Use |
|:--|:--|
| `<link rel="preconnect" href>` | warm up DNS/TCP/TLS to a critical third-party origin |
| `<link rel="dns-prefetch">` | cheaper DNS-only hint |
| `<link rel="preload" as="font" crossorigin>` | fetch a critical resource early |
| `<link rel="modulepreload">` | preload ES modules and their parsing |
| `<link rel="prefetch">` | likely next-page resources, low priority |
| `fetchpriority="high" / "low"` | adjust priority on images, scripts, links |
| Speculation Rules (`<script type="speculationrules">`) | prerender likely next pages (Chromium) |

### Metadata for sharing and search
| Tag | Purpose |
|:--|:--|
| `<title>`, `<meta name="description">` | search results |
| `<link rel="canonical" href>` | the preferred URL for duplicate content |
| `<meta name="robots" content="noindex">` | keep pages out of search |
| Open Graph: `og:title`, `og:description`, `og:image`, `og:url`, `og:type` | link previews (Slack, LinkedIn, iMessage) |
| `twitter:card` | X/Twitter preview style |
| `<link rel="alternate" hreflang>` | language versions |
| JSON-LD `<script type="application/ld+json">` | structured data (Product, Organization, BreadcrumbList) for rich results |
| `<link rel="manifest">`, `theme-color` | installable apps, browser UI color |

## Example
`product.html` (head and hero)
```html
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Oak Desk 140 cm · Acme Shop</title>
  <meta name="description" content="Solid oak desk, 140 × 70 cm. Free delivery in 3–5 days.">
  <link rel="canonical" href="https://shop.example.com/products/oak-desk-140">

  <meta property="og:type" content="product">
  <meta property="og:title" content="Oak Desk 140 cm">
  <meta property="og:description" content="Solid oak desk, 140 × 70 cm.">
  <meta property="og:image" content="https://shop.example.com/og/oak-desk-140.jpg">
  <meta property="og:url" content="https://shop.example.com/products/oak-desk-140">

  <link rel="preconnect" href="https://cdn.example.com">
  <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/app.3f2a1c.css">
  <script type="module" src="/assets/app.9b81de.js"></script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Oak Desk 140 cm",
    "image": "https://shop.example.com/og/oak-desk-140.jpg",
    "offers": { "@type": "Offer", "price": "349.00", "priceCurrency": "EUR", "availability": "https://schema.org/InStock" }
  }
  </script>
</head>
<body>
  <picture>
    <source type="image/avif" srcset="/img/desk-800.avif 800w, /img/desk-1600.avif 1600w" sizes="(min-width: 60rem) 50vw, 100vw">
    <source type="image/webp" srcset="/img/desk-800.webp 800w, /img/desk-1600.webp 1600w" sizes="(min-width: 60rem) 50vw, 100vw">
    <img src="/img/desk-800.jpg" alt="Oak desk with a laptop and a lamp in a bright room"
         width="1600" height="1000" fetchpriority="high" decoding="async">
  </picture>

  <img src="/img/review-avatar.jpg" alt="" width="48" height="48" loading="lazy"> <!-- decorative -->
</body>
```
Check: DevTools → Network shows priorities; Lighthouse flags lazy LCP images and missing dimensions; the Rich Results Test validates JSON-LD; opengraph.xyz previews link cards.

## Production patterns
- **Let the framework handle images and fonts** (`next/image`, `next/font`) but know what they generate: `srcset`, sizes, lazy loading, preload ([07-performance](../../07-performance/README.md)).
- **One LCP candidate per page gets `fetchpriority="high"`**; everything below the fold is lazy.
- **Scripts as `type="module"` or `defer`**; nothing render-blocking except critical CSS.
- **Open Graph images 1200×630**, generated per page for products and articles.
- **Canonical URLs everywhere**, so tracking parameters and duplicates don't split search ranking.

## Mistakes
Wrong: a lazy hero.
```html
<img src="hero.jpg" alt="..." loading="lazy">
```
Right: `fetchpriority="high"` and no `loading="lazy"` for the LCP image.

Wrong: missing dimensions.
```html
<img src="product.jpg" alt="Desk">
```
Right: `width` and `height` attributes (and CSS `max-width: 100%; height: auto`).

Wrong: alt text that repeats nearby text or says "image". Right: describe purpose in context, or `alt=""` if decorative.

Wrong: a blocking script in `<head>`.
```html
<script src="/analytics.js"></script>
```
Right: `defer`/`async`, or load third parties after the page is interactive.

## Check yourself
1. Why do `width` and `height` attributes still matter with responsive CSS?
2. What is the difference between `defer` and `async`?
3. Which tags control what a shared link looks like in Slack?

<details>
<summary>Answers</summary>

1. The browser uses them to compute the aspect ratio and reserve space before the image downloads (with `height: auto`), which prevents layout shift.
2. Both download in parallel. `defer` runs after parsing, in document order; `async` runs as soon as it arrives, in any order (good for independent scripts like analytics).
3. Open Graph meta tags: `og:title`, `og:description`, `og:image`, `og:url` (plus `twitter:card` for X).
</details>

## Sources
- [MDN — Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Responsive_images)
- [web.dev — Optimize Largest Contentful Paint](https://web.dev/articles/optimize-lcp)
- [W3C WAI — Images tutorial (alt decision tree)](https://www.w3.org/WAI/tutorials/images/decision-tree/)
- [MDN — `<script>` loading](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script)
- [The Open Graph protocol](https://ogp.me/)
- [Google — Structured data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
