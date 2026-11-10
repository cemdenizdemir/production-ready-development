---
title: "The loading path: TTFB, images, fonts, CDN caching"
tech: Next.js 16, Azure Front Door, HTTP caching
version: Next.js 16.x
date: 2026-11-09
covers: [3, 5, 6, 10]
---
# The loading path: TTFB, images, fonts, CDN caching
[← Overview](00-overview.md)

## Why it matters
- The product page's TTFB is 1.4 s because the Server Component waits for three sequential API calls, one of them an un-indexed SQL query.
- A 2.8 MB PNG hero image is served to phones; LCP is 5 s.
- Custom fonts block text rendering; users see blank space for a second, then the layout jumps when the font arrives.

## Concepts

### LCP breakdown
| Phase | What's in it | Fix |
|:--|:--|:--|
| TTFB | Front Door → Next.js → ASP.NET Core → SQL | cache rendered/static content; parallel API calls; fast queries; same region |
| resource load delay | time before the LCP image starts downloading | image in initial HTML, `preload`/`fetchpriority="high"`, no lazy loading |
| resource load time | download size and bandwidth | modern formats, right size, CDN |
| element render delay | waiting for CSS/fonts/JS before painting | small CSS, `font-display: swap`, avoid client-only rendering of the hero |

### Images
`next/image` handles responsive `srcset`, modern formats (AVIF/WebP), lazy loading, and sizing.
| Prop | Use |
|:--|:--|
| `width`/`height` or `fill` + sized parent | reserve space (no CLS) |
| ⭐ `sizes` | tell the browser the rendered width so it picks the right file |
| ⭐ `priority` (or `preload` in newer versions) | the LCP image: preload, high priority, not lazy |
| `quality` | default 75 |
| `placeholder="blur"` | perceived performance |
| `remotePatterns` in config | allowed external image hosts (product images from Blob Storage) |
| `loader` | use an image CDN instead of the built-in optimizer |

Product images live in Azure Blob Storage (03-backend/12-integrations), served through Front Door; `next/image` optimizes them once and caches.

### Fonts
`next/font` downloads fonts at build time, self-hosts them, subsets them, and generates fallback metrics (`size-adjust`) so swapping causes no layout shift.
```tsx
import { Inter, Fraunces } from "next/font/google";
const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-sans" });
```
| Rule | Why |
|:--|:--|
| ≤ 2 families, variable fonts | fewer files |
| `display: "swap"` | text shows immediately |
| subsets | Turkish needs `latin-ext` |
| self-hosted (next/font) | no third-party connection, cached with the app |

### Caching and CDNs
| Asset | Cache-Control | Where |
|:--|:--|:--|
| `/_next/static/*` (hashed) | `public, max-age=31536000, immutable` | Front Door + browser |
| `next/image` results | long, keyed by URL + width + quality | Next.js + Front Door |
| static/ISR HTML | `s-maxage` + `stale-while-revalidate` (set by Next.js) | Front Door |
| dynamic HTML (account) | `private, no-store` | none |
| API JSON (public catalog) | short `max-age`/`ETag` | Front Door optional |

Enable compression (Brotli) at Front Door, HTTP/2 or HTTP/3 to clients, and keep the origin (Container Apps) in the same region as the API and database.

## Example
`web/src/app/(shop)/coffee/[slug]/page.tsx` (hero)
```tsx
import Image from "next/image";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, stock] = await Promise.all([getProduct(slug), getStock(slug)]);   // parallel, not sequential
  return (
    <article>
      <Image
        src={product.imageUrl}
        alt={product.imageAlt}
        width={1200}
        height={1200}
        sizes="(min-width: 64rem) 40rem, 100vw"
        priority
      />
      <h1>{product.name}</h1>
      <p>{stock.inStock ? "In stock" : "Sold out"}</p>
    </article>
  );
}
```
`web/next.config.ts` (excerpt)
```ts
images: {
  remotePatterns: [{ protocol: "https", hostname: "images.roastery.test", pathname: "/products/**" }],
  formats: ["image/avif", "image/webp"],
},
```

## Production patterns
- Look at the LCP breakdown in the Performance panel before changing anything.
- Parallel API calls in Server Components; cache public data; keep API p95 low (it's part of TTFB).
- One `priority` image per page (the LCP candidate); everything else lazy.
- Long-lived immutable caching for hashed assets at Front Door; never cache personalized HTML.

## Mistakes
Wrong: lazy hero, no sizes.
```tsx
<Image src={hero} alt="" fill />                   // no sizes → largest file; lazy by default
```
Right: `sizes` + `priority` for the LCP image.

Wrong: fonts from a third-party CSS link with `display=block`.
Right: `next/font` with `display: "swap"`.

## Check yourself
1. Name the four phases of LCP.
2. What does the `sizes` attribute change?
3. Why do hashed `/_next/static` files get `immutable`?

<details><summary>Answers</summary>

1. TTFB, resource load delay, resource load time, element render delay.
2. Which `srcset` candidate the browser downloads, based on the expected rendered width.
3. Their URL changes whenever their content changes, so a cached copy can never be stale.
</details>

## Sources
- [web.dev — Optimize LCP](https://web.dev/articles/optimize-lcp)
- [web.dev — Optimize TTFB](https://web.dev/articles/optimize-ttfb)
- [Next.js — Image component](https://nextjs.org/docs/app/api-reference/components/image)
- [Next.js — Font optimization](https://nextjs.org/docs/app/api-reference/components/font)
- [Azure Front Door — Caching](https://learn.microsoft.com/azure/frontdoor/front-door-caching)
