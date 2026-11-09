---
title: Modules, DOM, browser APIs, and memory
tech: JavaScript, TypeScript
version: ECMAScript 2025, Baseline 2025
date: 2026-11-07
covers: [5, 8, 9, 12]
---
# Modules, DOM, browser APIs, and memory
[← Overview](00-overview.md)

## Why it matters
- A 400 KB charting library is imported at the top of the app shell. Every page pays for it, even the login page.
- A single-page app adds a `scroll` listener on every route visit and never removes it. After an hour, scrolling stutters and memory has tripled.
- A search URL is built with string concatenation. A query containing `&` breaks the filter, and `#` cuts the URL off.

## Concepts

### ES modules
| Feature | Use |
|:--|:--|
| `export const x` / `import { x } from './a.ts'` | named exports (prefer them: greppable, refactor-friendly) |
| `export default` | one main export; avoid in shared code |
| Live bindings | importers see updated values of exported `let` |
| `import()` | load on demand; bundlers split it into a separate chunk |
| Top-level `await` | await at module scope; blocks modules that import it |
| `import.meta.url` / `import.meta.env` | module URL / Vite env variables |
| Import attributes | `import data from './x.json' with { type: 'json' }` |
| Side-effect import | `import './polyfill.ts'` (runs, imports nothing) |
| Tree shaking | bundlers drop unused exports; needs static `import` and side-effect-free modules |

Circular imports can give you `undefined` at load time; keep dependencies pointing one way.

### DOM and events
| API | Use |
|:--|:--|
| `querySelector` / `closest` / `matches` | find elements |
| `textContent` | set text safely (never `innerHTML` with data) |
| `classList`, `dataset`, `toggleAttribute` | state on elements |
| `addEventListener(type, fn, options)` | `{ once, passive, capture, signal }` |
| Event delegation | one listener on a container + `event.target.closest('[data-action]')` |
| `preventDefault()` vs `stopPropagation()` | cancel default action vs stop bubbling (rarely needed) |
| `new CustomEvent('cart:updated', { detail })` | events between parts of the page |
| `AbortController` + `signal` option | remove many listeners at once |

### Browser APIs you'll use
| API | Use | Watch out |
|:--|:--|:--|
| `fetch` | HTTP | doesn't throw on 4xx/5xx |
| `URL`, `URLSearchParams`, `URL.parse()` | build and parse URLs safely | encodes `&`, `#`, spaces |
| `localStorage` / `sessionStorage` | small, non-sensitive preferences | sync, strings only, ~5 MB, readable by any XSS |
| IndexedDB | larger structured offline data | async; use a wrapper |
| `IntersectionObserver` | lazy loading, infinite scroll, "seen" tracking | disconnect when done |
| `ResizeObserver` | react to element size | |
| `MutationObserver` | react to DOM changes | expensive if broad |
| `requestAnimationFrame` | visual updates before paint | |
| `navigator.clipboard`, `navigator.sendBeacon` | copy text; send analytics on page hide | |
| `BroadcastChannel` | messages between tabs | logout in all tabs |
| `crypto.randomUUID()` | unique IDs | |
| Web Workers | heavy computation off the main thread | messages are copied |

### Memory and performance
| Leak / cost | Cause | Fix |
|:--|:--|:--|
| Listeners never removed | SPA routes add listeners on each visit | `signal` + abort on cleanup |
| Timers never cleared | `setInterval` on a removed widget | `clearInterval` in cleanup |
| Observers never disconnected | `IntersectionObserver` per item | `disconnect()` |
| Detached DOM nodes | removed nodes still referenced in JS | drop references; WeakMap for metadata |
| Unbounded caches | `Map` that only grows | LRU limit, `WeakMap`, TTL |
| Too-frequent handlers | `input`, `scroll`, `resize` | debounce (wait for pause) or throttle (max rate) |

## Example
`orders-page.ts` — delegation, safe URLs, lazy module, and one cleanup for everything.
```ts
export function mountOrdersPage(root: HTMLElement) {
  const controller = new AbortController();
  const { signal } = controller;

  root.addEventListener('click', async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'export') {
      const { exportCsv } = await import('./export-csv.ts'); // loaded only when needed
      exportCsv(root.dataset.accountId!);
    }
  }, { signal });

  const search = root.querySelector<HTMLInputElement>('#search')!;
  search.addEventListener('input', debounce(() => {
    const url = new URL('/api/orders', location.origin);
    url.searchParams.set('q', search.value);          // "a&b #1" encoded correctly
    url.searchParams.set('limit', '20');
    void loadOrders(url, signal);
  }, 250), { signal });

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) void loadMore(signal);
  });
  observer.observe(root.querySelector('#sentinel')!);
  signal.addEventListener('abort', () => observer.disconnect());

  return () => controller.abort(); // unmount: listeners, observer, and in-flight fetches all stop
}

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
```
Find leaks: DevTools → Memory → heap snapshot before and after visiting a route a few times; search for "Detached" nodes and growing listener counts (Performance monitor panel).

## Production patterns
- **Named exports, one direction of dependencies**, `import()` for heavy, rarely used features (exporters, editors, charts).
- **Delegate events on containers** for lists; fewer listeners, works for items added later.
- **One `AbortController` per mounted unit** for listeners, observers, and fetches; abort it on unmount. React effects do the same with cleanup functions.
- **Build URLs with `URL`/`URLSearchParams`**, never string concatenation.
- **No secrets or tokens in `localStorage`**; it's readable by any injected script ([11-security](../../11-security/README.md)).

## Mistakes
Wrong: string-built URLs.
```ts
fetch('/api/orders?q=' + query + '&page=' + page); // "&" and "#" in query break it
```
Right: `URLSearchParams` (or `encodeURIComponent` for single values).

Wrong: `innerHTML` with data.
```ts
list.innerHTML = `<li>${order.note}</li>`; // XSS if note contains HTML
```
Right: create elements and set `textContent`.

Wrong: listeners added on every render or route visit without removal.
Right: `{ signal }` and abort on cleanup; or delegation on a stable root.

Wrong: a heavy library in a static top-level import used only behind a button. Right: `await import()` at the point of use.

## Check yourself
1. Why does tree shaking need static `import` statements?
2. What is event delegation, and when is it worth it?
3. Debounce or throttle: (a) search-as-you-type, (b) updating a scroll progress bar?

<details>
<summary>Answers</summary>

1. Bundlers analyze imports at build time without running code. Static imports show exactly which exports are used; dynamic patterns (`require(variable)`, objects of exports) hide that, so everything is kept.
2. One listener on a common ancestor handles events from many children by checking `event.target`. Worth it for long or dynamic lists: fewer listeners, and new items work automatically.
3. (a) Debounce: wait until typing pauses, then request once. (b) Throttle (or `requestAnimationFrame`): update at a steady maximum rate while scrolling.
</details>

## Sources
- [MDN — JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [MDN — `addEventListener` options](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
- [MDN — URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
- [MDN — Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [Chrome DevTools — Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems)
