---
title: JavaScript cost and third-party scripts
tech: Next.js 16, Vite 8, React 19.2
version: Next.js 16.x, Vite 8 (Rolldown), React 19.2
date: 2026-11-07
covers: [4, 12]
---
# JavaScript cost and third-party scripts
[← Overview](00-overview.md)

## Why it matters
- One `import { format } from 'date-fns'` is fine; `import * as _ from 'lodash'` in a shared component adds 70 KB to every route.
- A chat widget, a tag manager, two analytics tools, and an A/B testing script together block the main thread for 1.2 s on mobile. INP fails, and none of it is your code.
- The whole app hydrates on load, including a footer and a static FAQ that never change.

## Concepts

### Why JavaScript is expensive
Bytes of JavaScript cost more than bytes of images: they must be downloaded, **parsed, compiled, and executed** on the main thread, and then components **hydrate**. On a mid-range phone this is several times slower than on a laptop.

| Lever | What it does |
|:--|:--|
| Server Components | UI that needs no interactivity ships no JS ([06-rendering](../../06-rendering/README.md)) |
| Route-based splitting | each route loads its own chunk (automatic in Next.js; `lazy()` routes in Vite apps) |
| Interaction-based splitting | `import()` / `next/dynamic` when the user opens the editor, chart, or modal |
| Tree shaking | bundlers drop unused exports from ESM packages |
| Smaller dependencies | replace heavy libraries; use the platform (`Intl`, `fetch`, `URL`, `structuredClone`) |
| Modern targets | don't transpile or polyfill for browsers you don't support |

### Finding the weight
| Tool | Shows |
|:--|:--|
| Build output (`next build`, `vite build`) | per-route / per-chunk sizes |
| Bundle analyzer (Next.js analyzer, Vite visualizer plugins) | which modules make up each chunk |
| DevTools Coverage tab | how much downloaded JS actually runs |
| DevTools Performance panel | parse/compile/evaluate time and long tasks |
| Package size sites (bundlephobia, pkg-size) | cost of a dependency before adding it |

### Third-party scripts
| Strategy | Use |
|:--|:--|
| Audit and remove | every script has an owner and a reason |
| Load later | `next/script` `strategy="lazyOnload"` or after interaction |
| Facades | show a static placeholder (video thumbnail, chat button); load the real widget on click |
| Self-host or proxy | avoid extra connections; control caching |
| Consent first | analytics and marketing scripts load only after consent ([12-cross-cutting](../../12-cross-cutting/README.md)) |
| `@next/third-parties` | optimized loaders for Google Tag Manager, YouTube, Maps |

| `next/script` strategy | Loads |
|:--|:--|
| `beforeInteractive` | before hydration (rarely justified: consent managers, bot detection) |
| `afterInteractive` (default) | after hydration starts |
| `lazyOnload` | during idle time after load |
| `worker` (experimental) | in a web worker via Partytown |

## Example
Interaction-based splitting in Next.js and Vite:
```tsx
'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  loading: () => <p>Loading editor…</p>,          // 200 KB chunk, only when needed
});

export function CommentBox() {
  const [editing, setEditing] = useState(false);
  return editing ? <RichTextEditor /> : <button onClick={() => setEditing(true)}>Write a comment</button>;
}
```
Import only what you use:
```ts
// Heavy: pulls the whole library into the chunk (CommonJS, not tree-shakable)
import _ from 'lodash';
const total = _.sumBy(items, 'priceCents');

// Light: one function, or the platform
import sumBy from 'lodash-es/sumBy';
const total2 = items.reduce((sum, i) => sum + i.priceCents, 0);
```
A facade for a chat widget:
```tsx
'use client';
import Script from 'next/script';
import { useState } from 'react';

export function SupportChat() {
  const [load, setLoad] = useState(false);
  return load ? (
    <Script src="https://widget.example-chat.com/loader.js" strategy="afterInteractive" />
  ) : (
    <button className="fixed bottom-4 right-4 rounded-full px-4 py-2" onClick={() => setLoad(true)}>
      Chat with us
    </button>  // no third-party JS until someone actually wants to chat
  );
}
```
Analytics after idle:
```tsx
<Script src="https://analytics.example.com/script.js" strategy="lazyOnload" data-site="shop" />
```

## Production patterns
- **Server Components for static UI**; client components only for interactivity, kept small.
- **A JS budget per route** (for example 150–200 KB gzipped on mobile-critical pages), checked in CI.
- **Review new dependencies** for size and tree-shakability in the PR; prefer ESM packages.
- **A third-party script register**: owner, purpose, loading strategy, consent category, measured cost.
- **Facades for heavy embeds** (video, maps, chat).

## Mistakes
Wrong: a heavy library imported in a shared layout component.
```tsx
import { Chart } from 'heavy-chart-lib'; // now part of every page
```
Right: import it only in the route that uses it, via `next/dynamic` or `lazy()`.

Wrong: barrel imports from your own `components/index.ts` re-exporting 200 components. Some bundlers can't drop the rest reliably.
Right: import from the component's file, or configure `optimizePackageImports` for libraries with big barrels.

Wrong: every marketing tag loaded with `beforeInteractive`. Right: `lazyOnload` or consent-gated loading; `beforeInteractive` only when truly required.

Wrong: polyfilling for IE-era browsers in 2026. Right: target Baseline browsers; Vite's default build target already does.

## Check yourself
1. Why is 200 KB of JavaScript more expensive than a 200 KB image?
2. What's a facade, and when would you use one?
3. How do Server Components reduce JavaScript cost?

<details>
<summary>Answers</summary>

1. The image is decoded off the main thread; JavaScript must be parsed, compiled, and executed on the main thread (plus hydration), which blocks interaction, especially on slow phones.
2. A lightweight placeholder that looks like the real widget (a video thumbnail with a play button, a chat button) and loads the heavy third-party code only when the user interacts; for embeds most users never use.
3. Their component code never ships to the browser; only their rendered output (HTML/RSC payload) does, so non-interactive parts of the page add no JS or hydration work.
</details>

## Sources
- [web.dev — Reduce JavaScript payloads with code splitting](https://web.dev/articles/reduce-javascript-payloads-with-code-splitting)
- [web.dev — Efficiently load third-party JavaScript](https://web.dev/articles/efficiently-load-third-party-javascript)
- [Next.js — Lazy loading](https://nextjs.org/docs/app/guides/lazy-loading)
- [Next.js — Scripts](https://nextjs.org/docs/app/guides/scripts)
- [Next.js — Third-party libraries](https://nextjs.org/docs/app/guides/third-party-libraries)
- [Chrome DevTools — Coverage](https://developer.chrome.com/docs/devtools/coverage)
