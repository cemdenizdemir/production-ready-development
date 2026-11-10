---
title: The React Compiler and Vite 8
tech: React Compiler 1.0, Vite 8, TypeScript
version: React Compiler 1.0, Vite 8, @vitejs/plugin-react 6
date: 2026-11-09
covers: [10, 12]
---
# The React Compiler and Vite 8
[← Overview](00-overview.md)

## Why it matters
- Every component is wrapped in `memo` and every function in `useCallback`, "for performance". The code is twice as long and a missing dependency causes a stale-closure bug.
- The Vite dev server calls `https://localhost:7043` directly from the browser; CORS and the self-signed dev certificate break every request.
- `VITE_API_KEY` is used for a secret; it ends up in the JavaScript bundle for everyone to read.

## Concepts

### Memoization and the React Compiler
React re-renders a component when its parent re-renders, even if props didn't change. Usually that's fast. Memoization skips work when inputs are equal:
| Tool | Memoizes |
|:--|:--|
| `memo(Component)` | the component's render when props are equal |
| `useMemo(() => compute(x), [x])` | a computed value |
| `useCallback(fn, deps)` | a function's identity |

The **React Compiler** (1.0, stable) analyzes components at build time and inserts this memoization automatically, at a finer grain than people do by hand. With it:
- don't add `useMemo`/`useCallback`/`memo` by default;
- keep them where identity is part of an API contract (a value passed to a third-party library that compares by reference, an effect dependency you need stable) or for measured hot spots;
- follow the Rules of React (pure render, no mutation); the compiler skips components that break them, and `eslint-plugin-react-hooks` reports why.

Enable: Next.js 16 `reactCompiler: true` in `next.config.ts`; Vite via the compiler's Babel plugin in the React plugin setup (see the React Compiler installation docs for the current Vite 8 wiring).

Measure before optimizing: React DevTools Profiler (why did this render?), the Performance panel (long tasks), and virtualization for very long lists (07-performance).

### Vite 8 project setup
```bash
pnpm create vite@latest web -- --template react-ts
cd web && pnpm install && pnpm dev
```
| Item | Note |
|:--|:--|
| dev server | native ES modules, instant start, Fast Refresh |
| build | Rolldown (Vite 8) bundling, `dist/` output |
| ⭐ `server.proxy` | forward `/api` to ASP.NET Core in dev: same-origin, no CORS |
| env vars | `import.meta.env.VITE_*` are **public** (inlined); `.env`, `.env.development`, `.env.production` |
| aliases | `resolve.alias` + `tsconfig` `paths` (`@/` → `src/`) |
| TypeScript | Vite strips types; run `tsc --noEmit` (or `vue-tsc`/`tsc -b`) for type checking |
| `vite preview` | serve the production build locally |
| `vite.config.ts` | plugins, server, build options |

## Example
`web/vite.config.ts`
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://localhost:7043",       // ASP.NET Core (dotnet watch)
        changeOrigin: true,
        secure: false,                          // accept the dev certificate locally
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
```
`web/package.json` (scripts)
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "lint": "eslint ."
  }
}
```
`web/.env.development`
```bash
VITE_APP_NAME=Roastery (dev)     # public; never put secrets in VITE_*
```

## Production patterns
- Turn on the React Compiler; delete manual memoization you added "just in case" once the compiler is on and tests pass.
- The dev proxy mirrors production's same-origin `/api` path (07-config-environments), so cookies and CSRF behave the same locally.
- `typecheck` in CI separately from `build`; Vite doesn't type-check.
- Only public values in `VITE_*` / `NEXT_PUBLIC_*`.

## Mistakes
Wrong: memoizing everything by hand.
```tsx
const onClick = useCallback(() => setOpen(true), []);
const items = useMemo(() => props.items, [props.items]);
```
Right: plain code with the compiler on; memoize deliberately where measured.

Wrong: calling the API's origin directly from the dev browser.
```ts
fetch("https://localhost:7043/orders")      // CORS + cert errors, different from production
```
Right: `fetch("/api/orders")` through the Vite proxy.

## Check yourself
1. When is manual `useMemo` still justified with the React Compiler on?
2. Why use `server.proxy` instead of enabling CORS on the API for development?
3. Who can read `VITE_API_KEY`?

<details><summary>Answers</summary>

1. When a stable identity is part of a contract (third-party library comparing by reference, effect dependency), or for a measured expensive computation the compiler doesn't cover.
2. It keeps requests same-origin like production: no CORS configuration, cookies work the same, and the dev certificate is handled by the proxy.
3. Anyone who loads the app: `VITE_*` values are inlined into the JavaScript bundle.
</details>

## Sources
- [React Compiler — Introduction](https://react.dev/learn/react-compiler)
- [React Compiler — Installation](https://react.dev/learn/react-compiler/installation)
- [Vite — Server options (proxy)](https://vite.dev/config/server-options#server-proxy)
- [Vite — Env variables and modes](https://vite.dev/guide/env-and-mode)
- [React DevTools Profiler](https://react.dev/learn/react-developer-tools)
