---
title: Modules, the DOM, browser APIs, and memory
tech: JavaScript, TypeScript
version: ECMAScript 2025, Baseline 2025
date: 2026-11-09
covers: [5, 8, 9, 12]
---
# Modules, the DOM, browser APIs, and memory
[← Overview](00-overview.md)

## Why it matters
- A chart library (300 KB) is imported at the top of the product page but only used in an admin dialog. Every customer downloads it.
- A `resize` listener added on every mount is never removed; after navigating around for ten minutes the tab uses 1.2 GB.
- The search box calls the API on every keystroke; the ASP.NET Core rate limiter starts returning 429s.

## Concepts

### ES modules
| Feature | Example |
|:--|:--|
| named exports | `export function addLine() {}` / `import { addLine } from "./cart"` |
| default export | `export default Page` (Next.js pages/layouts require it) |
| ⭐ dynamic import | `const { Chart } = await import("./chart")` → separate chunk |
| top-level await | allowed in modules; blocks importers until done |
| import attributes | `import data from "./x.json" with { type: "json" }` |
| `import.meta.url` | module URL |
| `import type { X }` | type-only import, erased (TypeScript) |

In Next.js, `next/dynamic` wraps dynamic import for components (07-performance).

### The DOM and events
React handles most DOM work, but you still meet raw events in hooks and third-party integrations.
| Technique | Example |
|:--|:--|
| event delegation | one listener on a list: `list.addEventListener("click", e => e.target.closest("[data-sku]"))` |
| listener options | `{ passive: true }` for scroll/touch, `{ once: true }`, `{ capture: true }` |
| ⭐ cleanup with `signal` | `addEventListener("resize", fn, { signal: controller.signal })` then `controller.abort()` |
| custom events | `new CustomEvent("cart:changed", { detail: cart })` |
| `preventDefault` / `stopPropagation` | default actions / bubbling |

### Browser APIs you'll use
| API | Use |
|:--|:--|
| ⭐ `fetch` | HTTP (with `signal`, `credentials`) |
| ⭐ `URL`, `URLSearchParams` | build and parse URLs safely: `new URL("/products", base)`, `params.set("q", q)` |
| `localStorage` / `sessionStorage` | small, non-sensitive preferences; synchronous; never tokens |
| IndexedDB | larger offline data |
| `IntersectionObserver` | lazy loading, infinite scroll, analytics impressions |
| `ResizeObserver` | element size changes |
| `MutationObserver` | DOM changes (third-party widgets) |
| `BroadcastChannel` | sync tabs (logout everywhere) |
| `navigator.clipboard`, `navigator.share` | copy, share sheet |
| `crypto.randomUUID()` | idempotency keys for POSTs to the API |

### Memory and performance basics
| Leak / cost | Fix |
|:--|:--|
| listeners never removed | `AbortController` signal, effect cleanup |
| timers never cleared | `clearInterval` in cleanup |
| caches that only grow | size limits (`Map` + eviction), TanStack Query `gcTime` |
| detached DOM nodes held in variables | drop references |
| work on every keystroke | ⭐ debounce (wait for pause) |
| work on every scroll/resize | ⭐ throttle (at most every N ms) or `requestAnimationFrame` |
| heavy computation | Web Worker; memoize |

Find leaks with DevTools → Memory → heap snapshots (compare before/after), and the Performance panel for long tasks.

## Example
`web/src/hooks/use-debounced-search.ts`
```ts
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);                 // cleanup: no stray timers
  }, [value, delayMs]);
  return debounced;
}
```
`web/src/lib/viewport.ts`
```ts
export function watchViewport(onChange: (w: number) => void): () => void {
  const controller = new AbortController();
  const handler = () => onChange(window.innerWidth);
  window.addEventListener("resize", handler, { passive: true, signal: controller.signal });
  return () => controller.abort();                 // removes every listener registered with this signal
}

export function productSearchUrl(q: string, page: number): string {
  const url = new URL("/api/products", window.location.origin);
  url.searchParams.set("q", q);                    // encoded correctly, no manual escaping
  url.searchParams.set("page", String(page));
  return url.toString();
}
```

## Production patterns
- Code-split heavy, rarely used features with dynamic imports.
- Every subscription (listener, observer, timer, socket) has a cleanup path; in React, return it from the effect.
- Debounce search inputs (~300 ms) before they hit the API; the backend rate limiter is a safety net, not the plan.
- `crypto.randomUUID()` per form submission as the `Idempotency-Key` for POSTs.

## Mistakes
Wrong: building URLs by concatenation.
```ts
fetch("/api/products?q=" + q + "&page=" + page);     // breaks on "&" or spaces
```
Right: `URLSearchParams` / `URL`.

Wrong: tokens in `localStorage`.
Right: `HttpOnly` cookies set by the API (02-frontend/11-security).

## Check yourself
1. What does a dynamic `import()` change in the build output?
2. How do you remove several listeners at once without keeping references to each handler?
3. When would you throttle instead of debounce?

<details><summary>Answers</summary>

1. The imported module goes into a separate chunk, loaded only when `import()` runs.
2. Register them all with the same `AbortSignal` and call `abort()` on its controller.
3. For continuous events where you want periodic updates during the activity (scroll position, resize), not just after it stops.
</details>

## Sources
- [MDN — JavaScript modules](https://developer.mozilla.org/docs/Web/JavaScript/Guide/Modules)
- [MDN — addEventListener options](https://developer.mozilla.org/docs/Web/API/EventTarget/addEventListener)
- [MDN — URLSearchParams](https://developer.mozilla.org/docs/Web/API/URLSearchParams)
- [MDN — Intersection Observer API](https://developer.mozilla.org/docs/Web/API/Intersection_Observer_API)
- [Chrome — Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems)
