---
title: React Compiler and the Vite 8 setup
tech: React 19.2, React Compiler 1.0, Vite 8, TypeScript
version: React Compiler 1.0, Vite 8, @vitejs/plugin-react 6, @rolldown/plugin-babel
date: 2026-11-07
covers: [10, 12]
---
# React Compiler and the Vite 8 setup
[← Overview](00-overview.md)

## Why it matters
- Every component is wrapped in `memo`, every function in `useCallback`. Code is twice as long, and one missing dependency causes a stale-closure bug nobody can find.
- The Vite dev server calls the API on another port, and the team "fixes" CORS by allowing every origin in production too.
- Type errors only show up in CI because Vite strips types without checking them.

## Concepts

### Memoization and the compiler
React re-renders a component's children when it renders. Usually that's cheap. Manual memoization skips work when inputs are unchanged:

| API | Memoizes |
|:--|:--|
| `memo(Component)` | a component's render when props are equal |
| `useMemo(fn, deps)` | a computed value |
| `useCallback(fn, deps)` | a function identity |

**React Compiler 1.0** analyzes components and hooks at build time and inserts this memoization automatically, at a finer grain than people do by hand. Requirements: code follows the **Rules of React** (pure render, no mutation of props/state, hooks rules). Code it can't prove safe is left unoptimized, not broken.

With the compiler on:
- Don't add new `memo`/`useMemo`/`useCallback` by default.
- Keep manual memoization where an external API depends on stable identities, or for values used as effect dependencies in code the compiler skipped.
- Opt a file or function out with the `"use no memo"` directive while you debug.
- Measure before optimizing: React DevTools Profiler, and the React performance tracks in Chrome DevTools (React 19.2).

### Vite 8
| Piece | What it does |
|:--|:--|
| Dev server | serves source as native ESM, transforms with Oxc, hot module replacement |
| Build | bundles with Rolldown into `dist/` with content-hashed file names |
| `vite preview` | serves the production build locally |
| `@vitejs/plugin-react` v6 | JSX, Fast Refresh; no Babel inside anymore |
| `server.proxy` | forward `/api` to the Express server: same origin in dev, no CORS |
| `resolve.alias` | `@/` imports |
| `import.meta.env.VITE_*` | build-time env values (public!) |
| `build.sourcemap: 'hidden'` | source maps for Sentry without exposing them |
| Type checking | not done by Vite: run `tsc -b` in a script and in CI |

## Example
```bash
pnpm create vite@latest web -- --template react-ts
cd web
pnpm add -D babel-plugin-react-compiler @rolldown/plugin-babel eslint-plugin-react-hooks
```
`vite.config.ts`
```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset] }), // React Compiler via Babel (plugin-react v6 has no Babel)
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true }, // same-origin calls in dev
    },
  },
  build: {
    sourcemap: 'hidden',
  },
});
```
Check the `@vitejs/plugin-react` README for the current compiler wiring; plugin order and options have changed between minor versions.

`tsconfig.app.json` (excerpt) — keep the alias in sync for the type checker:
```json
{
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "module": "preserve",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "paths": { "@/*": ["./src/*"] },
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```
`package.json` scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "lint": "eslint . --max-warnings 0"
  }
}
```
`eslint.config.js` (excerpt)
```js
import reactHooks from 'eslint-plugin-react-hooks';
// ...inside defineConfig(...):
reactHooks.configs.flat.recommended, // hooks rules + compiler-related rules (v7)
```
Typed env values in `src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN: string;
}
```

## Production patterns
- **Turn the compiler on early** and follow the Rules of React; the lint rules flag code it can't optimize.
- **Profile, then optimize.** Most slowness is too much work per render (huge lists, heavy computations) or too much JavaScript, not missing `memo`.
- **Same-origin API in every environment**: Vite proxy in dev, CDN/reverse proxy routing in production ([02-http-networking](../../../01-foundations/02-http-networking/docs/04-cors-and-proxies.md)).
- **`tsc -b` in the build script and CI**, so type errors fail fast.
- **Hidden source maps uploaded to Sentry**, not served publicly ([13-testing-monitoring](../../13-testing-monitoring/README.md)).

## Mistakes
Wrong: memoizing everything by hand with the compiler enabled.
```tsx
const onClick = useCallback(() => select(id), [id]);
const label = useMemo(() => `Item ${id}`, [id]);
export default memo(Row);
```
Right: plain code; the compiler memoizes. Keep manual memoization only where measured or required by an external API.

Wrong: mutating during render, which the compiler can't optimize and React forbids.
```tsx
props.items.sort(byName); // mutates a prop
```
Right: `const sorted = props.items.toSorted(byName);`

Wrong: secrets in `VITE_*` variables. They are inlined into the bundle.
Right: only public values; secrets stay on the server.

Wrong: relying on Vite for type safety; the dev server runs code with type errors. Right: `tsc -b` in scripts and CI, plus editor checks.

## Check yourself
1. What does the React Compiler need from your code to optimize it?
2. When is manual `useMemo` still justified with the compiler on?
3. Why use `server.proxy` instead of enabling CORS on the API for local development?

<details>
<summary>Answers</summary>

1. Code that follows the Rules of React: pure rendering, no mutation of props, state, or values used in render, and hooks called unconditionally at the top level.
2. When a measured expensive computation sits in code the compiler skipped, or a third-party API requires a stable identity (and the compiler can't prove stability), or for effect dependencies in non-compiled code.
3. The browser then sees the API on the same origin as the app, matching production's same-origin setup; you don't need permissive CORS settings that might leak into production.
</details>

## Sources
- [react.dev — React Compiler](https://react.dev/learn/react-compiler)
- [react.dev — Rules of React](https://react.dev/reference/rules)
- [Vite — Getting started](https://vite.dev/guide/)
- [Vite — Server options (`server.proxy`)](https://vite.dev/config/server-options#server-proxy)
- [@vitejs/plugin-react README](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react)
- [React Compiler 1.0 + Vite 8 setup notes](https://recca0120.github.io/en/2026/04/14/react-compiler-vite-v6/)
