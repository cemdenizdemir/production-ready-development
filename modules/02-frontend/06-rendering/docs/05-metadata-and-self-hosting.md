---
title: Metadata, SEO, and self-hosting
tech: Next.js 16, Docker
version: Next.js 16.x, Node.js 26 LTS, Docker
date: 2026-11-07
covers: [11, 12]
---
# Metadata, SEO, and self-hosting
[← Overview](00-overview.md)

## Why it matters
- Every product page has the title "Acme Shop", so search results and browser tabs are indistinguishable.
- The Docker image is 1.8 GB because it ships the whole `node_modules` and source; deploys and cold starts are slow.
- Three instances behind a load balancer each keep their own cache; an invalidation reaches one of them, and users see different prices depending on which instance answers.

## Concepts

### Metadata API
| API | Use |
|:--|:--|
| `export const metadata: Metadata` | static metadata in a layout or page |
| `generateMetadata({ params })` | dynamic metadata (product name, description) |
| `title: { template: '%s · Acme', default: 'Acme' }` | consistent titles from the root layout |
| `metadataBase` | resolves relative URLs for OG images and canonicals |
| `alternates.canonical` / `alternates.languages` | canonical URL, hreflang |
| `openGraph`, `twitter` | link previews |
| `robots` | indexing rules (e.g. `noindex` on staging) |
| `generateViewport` / `viewport` | theme color, color scheme |
| `opengraph-image.tsx` | generate OG images with `ImageResponse` (`next/og`) |
| `sitemap.ts`, `robots.ts`, `manifest.ts` | generated `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` |
| `icon.tsx` / `favicon.ico` | icons |

Structured data (JSON-LD): render a `<script type="application/ld+json">` in the page, escaping `<` in the JSON.

### Self-hosting in Docker
| Piece | What to know |
|:--|:--|
| `output: 'standalone'` | builds `.next/standalone/server.js` with only the needed `node_modules` |
| Static assets | copy `.next/static` and `public` next to the standalone server (or serve from a CDN with `assetPrefix`) |
| Runtime | `node server.js`, `HOSTNAME=0.0.0.0`, `PORT=3000`, non-root user |
| Image optimization | uses `sharp` in the standalone output; cache optimized images on a volume or CDN |
| Env vars | `NEXT_PUBLIC_*` are inlined at **build** time; server env vars are read at runtime |
| Multiple instances | caches (`'use cache'`, ISR, images) are per instance unless you configure a shared cache handler (e.g. Redis); tag invalidation must reach the shared store |
| Version skew | during rolling deploys, old clients may request new chunks; keep previous static assets available (CDN) for a while |
| Health checks | a route handler (`/api/health`) for the load balancer |

## Example
`app/layout.tsx` (metadata excerpt)
```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://shop.example.com'),
  title: { template: '%s · Acme Shop', default: 'Acme Shop' },
  description: 'Furniture made to last.',
  openGraph: { siteName: 'Acme Shop', type: 'website' },
  robots: process.env.APP_ENV === 'production' ? { index: true } : { index: false, follow: false },
};
```
`app/(shop)/products/[id]/page.tsx` (metadata + JSON-LD)
```tsx
import type { Metadata } from 'next';
import { getProduct } from '@/lib/products';

export async function generateMetadata({ params }: PageProps<'/products/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);              // cached: deduplicated with the page's call
  if (!product) return { title: 'Product not found' };
  return {
    title: product.name,
    description: product.description.slice(0, 155),
    alternates: { canonical: `/products/${id}` },
    openGraph: { title: product.name, images: [`/products/${id}/opengraph-image`] },
  };
}

function ProductJsonLd({ name, priceCents }: { name: string; priceCents: number }) {
  const data = { '@context': 'https://schema.org', '@type': 'Product', name,
    offers: { '@type': 'Offer', price: (priceCents / 100).toFixed(2), priceCurrency: 'EUR' } };
  return (
    <script type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
  );
}
```
`app/sitemap.ts`
```ts
import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/products';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  return [
    { url: 'https://shop.example.com/', changeFrequency: 'daily', priority: 1 },
    ...products.map((p) => ({ url: `https://shop.example.com/products/${p.id}`, changeFrequency: 'weekly' as const })),
  ];
}
```
`Dockerfile` (multi-stage, standalone output)
```dockerfile
# syntax=docker/dockerfile:1
FROM node:26-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@10

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm build

FROM node:26-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```
Build it once per environment only if `NEXT_PUBLIC_*` values differ; better, keep public config identical across environments or serve it at runtime ([07-config-environments](../../../01-foundations/07-config-environments/docs/03-secrets-flags-frontend.md)).

## Production patterns
- **Title template in the root layout**, `generateMetadata` per dynamic page, canonical URLs everywhere.
- **`noindex` on every non-production environment**, driven by `APP_ENV`.
- **Standalone output + multi-stage Docker build**, non-root user, health check route.
- **Static assets on a CDN** with long caching; keep old build assets around during rolling deploys.
- **Shared cache handler (Redis) when running several instances** and relying on tag invalidation; otherwise invalidation is per instance.

## Mistakes
Wrong: one static title for all pages.
```tsx
export const metadata = { title: 'Acme Shop' }; // in every page
```
Right: a template in the root layout and `generateMetadata` per page.

Wrong: unescaped JSON-LD.
```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
// a product name containing </script> breaks out of the tag
```
Right: escape `<` as `<`.

Wrong: copying the whole repo and `node_modules` into the runtime image. Right: `output: 'standalone'` plus the static folders.

Wrong: staging indexed by search engines. Right: `robots: { index: false }` outside production.

## Check yourself
1. What does `metadataBase` fix?
2. Which files must you copy next to the standalone server, and why?
3. Why do multiple Next.js instances need a shared cache handler for tag invalidation to work?

<details>
<summary>Answers</summary>

1. Relative URLs in metadata (OG images, canonicals) are resolved against it, producing absolute URLs that link previews and search engines require.
2. `.next/static` (built JS/CSS chunks) and `public` (static files). The standalone folder contains the server and its dependencies but not these assets.
3. Each instance otherwise keeps its own cache; an invalidation request handled by one instance doesn't clear the others, so users get different data depending on routing.
</details>

## Sources
- [Next.js — Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [Next.js — `generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js — Self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js — `output: 'standalone'`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Next.js — JSON-LD](https://nextjs.org/docs/app/guides/json-ld)
- [Next.js — Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
