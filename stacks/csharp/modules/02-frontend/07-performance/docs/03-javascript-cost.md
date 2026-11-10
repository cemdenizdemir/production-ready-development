---
title: JavaScript cost and third-party scripts
tech: Next.js 16, Vite 8, React 19.2
version: Next.js 16.x, @next/bundle-analyzer, Vite 8
date: 2026-11-09
covers: [4, 12]
---
# JavaScript cost and third-party scripts
[← Overview](00-overview.md)

## Why it matters
- A date library with every locale (300 KB) is imported to format one date; `Intl.DateTimeFormat` would have done it for free.
- Product pages ship 900 KB of JavaScript because `'use client'` sits on a layout; low-end phones take 4 s to become interactive.
- A marketing tag manager loads 14 third-party scripts on checkout; one of them blocks the main thread for 600 ms on every click.

## Concepts

### Where JavaScript costs time
Download (network) → parse/compile → execute → hydrate. On a mid-range phone, 1 MB of JavaScript can take seconds of CPU even when cached. Bytes of JS are much more expensive than bytes of images.

### Reducing JavaScript
| Technique | How |
|:--|:--|
| ⭐ Server Components | render non-interactive UI on the server; zero client JS (06-rendering) |
| ⭐ small client islands | `'use client'` on leaves only |
| code splitting | automatic per route in Next.js; `next/dynamic` / `import()` for heavy, rarely used components |
| tree shaking | ESM imports of what you use: `import { formatDistance } from "date-fns"` not the whole lib |
| platform APIs | `Intl`, `URL`, `<dialog>`, `structuredClone` instead of libraries |
| lighter dependencies | check size before adding (bundlephobia, pkg-size); one library per job |
| remove dead code | unused components, exports, feature-flagged-off code after rollout |
| don't ship server-only code | `server-only`; keep secrets and big server libs out |

### Analyzing bundles
| Tool | Shows |
|:--|:--|
| `next build` output | first-load JS per route |
| `@next/bundle-analyzer` (`ANALYZE=true pnpm build`) | treemap of chunks (webpack builds; Turbopack builds have their own analyzer in newer 16.x releases—check docs) |
| Vite: `rollup-plugin-visualizer` / `vite build --report` equivalents | treemap |
| DevTools Coverage tab | unused bytes on a page |
| Lighthouse "Reduce unused JavaScript" | per-script savings |

### Third-party scripts
| Practice | How |
|:--|:--|
| inventory and owner per script | why it's there, who decides |
| ⭐ `next/script` strategies | `afterInteractive` (default), `lazyOnload` for non-essential, `beforeInteractive` only for must-run-first |
| load after consent | analytics/marketing only after the user agrees (12-cross-cutting) |
| facades | show a static preview (video, chat widget) and load the real thing on click |
| self-host when possible | fewer connections, CSP-friendly |
| measure | Performance panel "Third parties" grouping, Lighthouse third-party summary |
| contain | CSP allowlists (11-security), no third parties on checkout pages |

## Example
`web/src/features/admin/ReportsPage.tsx`
```tsx
import dynamic from "next/dynamic";

const SalesChart = dynamic(() => import("./SalesChart"), {
  loading: () => <p>Loading chart…</p>,
  ssr: false,                    // chart lib needs window; only the admin downloads it
});

export function ReportsPage() {
  return <section><h1>Sales</h1><SalesChart /></section>;
}
```
`web/src/app/layout.tsx` (third party after consent)
```tsx
import Script from "next/script";
import { hasAnalyticsConsent } from "@/lib/consent";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const consent = await hasAnalyticsConsent();     // reads a consent cookie inside a Suspense-isolated component in real code
  return (
    <html lang="en">
      <body>
        {children}
        {consent && <Script src="https://analytics.example/script.js" strategy="lazyOnload" />}
      </body>
    </html>
  );
}
```
`web/next.config.ts` (analyzer)
```ts
import bundleAnalyzer from "@next/bundle-analyzer";
const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });
export default withAnalyzer({ output: "standalone", cacheComponents: true });
```

## Production patterns
- A first-load JS budget per route in CI (Lighthouse CI or a size check on `next build` output).
- Review every new dependency for size and necessity in the PR; prefer the platform.
- Heavy admin-only or below-the-fold features are dynamically imported.
- Third-party scripts have owners, load after consent, and stay off checkout.

## Mistakes
Wrong: importing a whole library for one function.
```ts
import _ from "lodash";
_.debounce(fn, 300);
```
Right: a 10-line debounce, or `import debounce from "lodash-es/debounce"`.

Wrong: `strategy="beforeInteractive"` for analytics.
Right: `lazyOnload` (or `afterInteractive`) after consent.

## Check yourself
1. Why are kilobytes of JavaScript more expensive than kilobytes of images?
2. What does `ssr: false` in `next/dynamic` do?
3. Name two ways to reduce third-party script impact.

<details><summary>Answers</summary>

1. JavaScript must also be parsed, compiled, and executed on the main thread; images are decoded off-thread and don't block interaction.
2. The component isn't rendered on the server; its code loads only in the browser when it's rendered.
3. Load them later (`lazyOnload`, after consent), use facades, self-host, or remove them from critical pages.
</details>

## Sources
- [web.dev — The cost of JavaScript](https://web.dev/articles/optimize-javascript-execution)
- [Next.js — Lazy loading](https://nextjs.org/docs/app/guides/lazy-loading)
- [Next.js — Script component](https://nextjs.org/docs/app/api-reference/components/script)
- [@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [web.dev — Efficiently load third-party JavaScript](https://web.dev/articles/efficiently-load-third-party-javascript)
