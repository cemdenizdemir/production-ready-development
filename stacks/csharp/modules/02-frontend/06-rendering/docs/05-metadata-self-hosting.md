---
title: Metadata, SEO, and self-hosting
tech: Next.js 16, Docker, Azure Container Apps
version: Next.js 16.x, Node.js 24
date: 2026-11-09
covers: [11, 12]
---
# Metadata, SEO, and self-hosting
[← Overview](00-overview.md)

## Why it matters
- Every product page has the same title and no canonical URL; filtered listings compete with each other in search results.
- Two Next.js replicas behind the ingress each keep their own cache; a price update shows on one replica and not the other, depending on which one you hit.
- After a deploy, users on the old page get "Failed to find Server Action" errors because the replicas have different action IDs and encryption keys.

## Concepts

### Metadata API
| Export | Use |
|:--|:--|
| `export const metadata: Metadata` | static metadata for a layout or page |
| `export async function generateMetadata({ params })` | data-driven (product name, price, image) |
| `metadataBase` | absolute URLs for OG images and canonicals |
| `alternates.canonical` | canonical URL |
| `robots` | `noindex` for search pages, carts, non-production |
| `openGraph`, `twitter` | link previews |
| `app/sitemap.ts`, `app/robots.ts` | generated `sitemap.xml` / `robots.txt` |
| `opengraph-image.tsx` | generated OG images per route |
| JSON-LD | `<script type="application/ld+json">` in the page |

`generateMetadata` and the page share fetches through the cache (`'use cache'` or `React.cache`), so the product is fetched once.

### Self-hosting on Azure Container Apps
| Concern | Setting |
|:--|:--|
| ⭐ build output | `output: "standalone"` → `.next/standalone/server.js` with only needed `node_modules` |
| static assets | copy `.next/static` and `public` into the image (or serve from a CDN with `assetPrefix`) |
| listen | `HOSTNAME=0.0.0.0`, `PORT=3000` |
| runtime env | `API_URL`, `REVALIDATE_SECRET` from Container Apps settings / Key Vault references |
| ⭐ multiple replicas | a shared cache handler (e.g. Redis) for `'use cache'`/ISR, or accept per-replica caches with short lifetimes |
| ⭐ Server Actions across replicas | same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` on every replica, and the same build |
| version skew | set `deploymentId` (or `NEXT_DEPLOYMENT_ID`) so clients on old builds reload cleanly |
| health | a cheap `app/healthz/route.ts` for probes |
| image optimization | `next/image` works self-hosted (uses `sharp`); or a CDN/loader |

Image layout (04-shipping/01-containers covers Dockerfiles in depth):
```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable 2>/dev/null || npm i -g pnpm
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ .
RUN pnpm build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

## Example
`web/src/app/(shop)/coffee/[slug]/page.tsx` (metadata)
```tsx
import type { Metadata } from "next";
import { getProduct } from "@/server/catalog";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);                  // cached; shared with the page
  if (!p) return { title: "Not found", robots: { index: false } };
  return {
    title: `${p.name} – Roastery`,
    description: p.summary,
    alternates: { canonical: `/coffee/${slug}` },
    openGraph: { title: p.name, images: [{ url: p.imageUrl, width: 1200, height: 630 }] },
  };
}
```
`web/src/app/robots.ts`
```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.APP_ENV === "production";
  return isProd
    ? { rules: [{ userAgent: "*", allow: "/", disallow: ["/account", "/checkout", "/search"] }], sitemap: "https://roastery.test/sitemap.xml" }
    : { rules: [{ userAgent: "*", disallow: "/" }] };
}
```
`web/src/app/layout.tsx` (excerpt)
```tsx
export const metadata: Metadata = {
  metadataBase: new URL("https://roastery.test"),
  title: { default: "Roastery", template: "%s" },
};
```

## Production patterns
- `generateMetadata` for every content route; canonical URLs on listings with filters.
- `robots` and `noindex` per environment, from runtime config (`APP_ENV`), not `NEXT_PUBLIC_*`.
- Standalone output in a small non-root image; one build promoted through environments.
- For more than one replica: shared encryption key, consistent `deploymentId`, and either a shared cache handler or short cache lifetimes plus tag revalidation sent to every replica.

## Mistakes
Wrong: different builds per environment ("staging build", "prod build").
Right: one image; environment-specific values at runtime.

Wrong: scaling to three replicas without `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
Right: set the same key (from Key Vault) on all replicas.

## Check yourself
1. Why does `generateMetadata` not double the API calls for a product page?
2. What two files must be copied next to `server.js` in a standalone image?
3. What breaks across replicas if each has its own in-memory cache?

<details><summary>Answers</summary>

1. It and the page call the same cached (`'use cache'` / `React.cache`) function, so the fetch happens once.
2. `.next/static` (to `.next/static`) and `public/`.
3. Consistency: a tag revalidated on one replica stays stale on others, so users see different data per request.
</details>

## Sources
- [Next.js — Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [Next.js — generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js — Self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js — output: standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Next.js — Server Actions encryption key](https://nextjs.org/docs/app/guides/data-security#overwriting-encryption-keys-advanced)
