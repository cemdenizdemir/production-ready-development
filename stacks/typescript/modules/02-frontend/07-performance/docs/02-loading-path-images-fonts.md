---
title: "The loading path: TTFB, priorities, images, fonts, caching"
tech: Next.js 16, Vite 8, HTML
version: Next.js 16.x, Vite 8
date: 2026-11-07
covers: [3, 5, 6, 10]
---
# The loading path: TTFB, priorities, images, fonts, caching
[← Overview](00-overview.md)

## Why it matters
- The hero image is set as a CSS background, so the browser discovers it only after the CSS downloads and parses. LCP is late by a full second.
- A web font loads late and swaps in with different metrics; every heading reflows and CLS fails.
- HTML is served with `Cache-Control: no-store` from a single region; users on another continent pay 600 ms of TTFB before anything starts.

## Concepts

### LCP has four parts
| Part | What it is | Fix |
|:--|:--|:--|
| TTFB | server + network until the first HTML byte | CDN, caching (static shell), fewer redirects, faster backend |
| Resource load delay | time until the browser *starts* loading the LCP resource | make it discoverable in HTML; `fetchpriority="high"`; preload |
| Resource load duration | download time | modern formats, right size, CDN, compression |
| Element render delay | loaded but not painted yet | less render-blocking CSS/JS, avoid client-only rendering of the hero |

The DevTools Performance panel shows this breakdown in its LCP insight.

### Priorities and hints
| Tool | Use |
|:--|:--|
| Hero `<img>` in the HTML (not CSS background, not JS-inserted) | discovered by the preload scanner immediately |
| `fetchpriority="high"` on the LCP image | download it before other images |
| `loading="lazy"` on below-the-fold images | save bandwidth for what matters |
| `<link rel="preconnect">` | third-party origins needed early (image CDN) |
| `<link rel="preload">` | late-discovered critical resources (fonts, CSS background heroes) |
| `defer` / `type="module"` scripts | don't block parsing |
| 103 Early Hints | send preload headers before the HTML is ready (CDN support) |
| Speculation Rules (prerender) | instant next-page navigations (Chromium) |

### Images
| Practice | Why |
|:--|:--|
| AVIF/WebP | 30–50% smaller than JPEG |
| `srcset` + `sizes` | phones don't download desktop-sized images |
| `width` + `height` (or `aspect-ratio`) | no layout shift |
| `next/image` | generates sizes and formats, lazy loads by default, reserves space |
| Compress and cap dimensions at upload | no 6000 px originals in the page |

### Fonts
| Practice | Why |
|:--|:--|
| `next/font` | self-hosts fonts at build time, preloads them, and generates a fallback with matching metrics (`size-adjust`) to avoid shifts |
| `font-display: swap` (or `optional`) | text visible immediately |
| Variable fonts, few weights, subsets (`latin`) | fewer, smaller files |
| System font stack | zero font loading at all |

### Caching and CDNs
| Asset | Cache-Control | Note |
|:--|:--|:--|
| Hashed JS/CSS/images (`/_next/static`, Vite `assets/`) | `public, max-age=31536000, immutable` | new deploy = new file names |
| HTML / RSC payloads | short `s-maxage` + `stale-while-revalidate`, or `no-cache` | Next.js sets these per route |
| Optimized images | long cache at CDN | `next/image` cache |
| API responses | per endpoint ([02-http-networking](../../../01-foundations/02-http-networking/docs/05-caching-and-compression.md)) | |

Keep pages eligible for the **back/forward cache** (bfcache): no `unload` handlers; back navigations become instant.

## Example
Next.js 16 hero image and fonts:
```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' }); // self-hosted, preloaded

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```
```tsx
// app/(shop)/page.tsx
import Image from 'next/image';
import hero from './hero.jpg'; // static import: width/height known at build time

export default function Home() {
  return (
    <>
      <Image
        src={hero}
        alt="Oak desk in a bright home office"
        fetchPriority="high"           // the LCP element: high priority, not lazy
        sizes="100vw"
        placeholder="blur"
      />
      <ProductGrid />                  {/* its images are lazy by default */}
    </>
  );
}
```
`next.config.ts` (images excerpt)
```ts
images: {
  formats: ['image/avif', 'image/webp'],
  remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com' }],
  qualities: [60, 75],                 // allowlist in Next.js 16
},
```
Vite/plain HTML equivalent for the hero:
```html
<link rel="preconnect" href="https://cdn.example.com">
<img src="https://cdn.example.com/hero-1200.avif"
     srcset="https://cdn.example.com/hero-800.avif 800w, https://cdn.example.com/hero-1600.avif 1600w"
     sizes="100vw" width="1600" height="900" alt="Oak desk in a bright home office" fetchpriority="high">
```

## Production patterns
- **Identify the LCP element per key route** (DevTools shows it) and make sure it's in the initial HTML with high priority.
- **Static shell from the CDN** (Cache Components) for fast TTFB; personalized parts stream in ([06-rendering](../../06-rendering/README.md)).
- **One image pipeline**: upload limits, automatic resizing, modern formats, CDN delivery.
- **`next/font` or a system stack**; never load fonts from a third-party CSS at runtime without preconnect.
- **Immutable caching for hashed assets**, short or revalidated caching for HTML.

## Mistakes
Wrong: a lazy hero.
```tsx
<Image src={hero} alt="…" loading="lazy" />
```
Right: `fetchPriority="high"` (Next.js 16 deprecated `priority` in favor of `preload`; prefer the fetch priority hint).

Wrong: hero as a CSS background in a stylesheet. The browser finds it late. Right: an `<img>` in the HTML, or preload it.

Wrong: Google Fonts `<link>` to their CSS at runtime, with four weights and no preconnect. Right: `next/font` (self-hosted, subset, metric-matched fallback).

Wrong: `Cache-Control: no-store` on hashed assets "to be safe". Right: `immutable` for a year; the hash changes when content does.

## Check yourself
1. What are the four parts of LCP, and which one does `fetchpriority="high"` target?
2. Why does `next/font` reduce CLS?
3. Why can hashed assets be cached for a year?

<details>
<summary>Answers</summary>

1. TTFB, resource load delay, resource load duration, element render delay. `fetchpriority` mainly cuts load delay (and duration under contention) by making the image download first.
2. It generates a fallback font adjusted (`size-adjust`, ascent/descent overrides) to match the web font's metrics, so swapping fonts barely moves text; and it preloads the font.
3. Their file names contain a content hash; any change produces a new URL, so an old cached file is never wrong for the new HTML.
</details>

## Sources
- [web.dev — Optimize LCP](https://web.dev/articles/optimize-lcp)
- [web.dev — Fetch Priority API](https://web.dev/articles/fetch-priority)
- [Next.js — Image component](https://nextjs.org/docs/app/api-reference/components/image)
- [Next.js — Font optimization](https://nextjs.org/docs/app/getting-started/fonts)
- [web.dev — Back/forward cache](https://web.dev/articles/bfcache)
