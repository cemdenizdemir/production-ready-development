---
title: Tailwind CSS 4, architecture, and performance
tech: Tailwind CSS 4, CSS, Vite 8, React 19.2
version: Tailwind CSS 4.3, Vite 8
date: 2026-11-07
covers: [9, 10, 11]
---
# Tailwind CSS 4, architecture, and performance
[← Overview](00-overview.md)

## Why it matters
- Every component picks its own blue (`#2563eb`, `#2463ea`, `blue-600`). A rebrand takes a month of search-and-replace.
- A 600 KB stylesheet, mostly unused, blocks the first paint on every page.
- Global class names collide: `.title` from the blog breaks `.title` in checkout after a refactor merges their CSS.

## Concepts

### Tailwind 4 in one table
| Concept | What it is |
|:--|:--|
| Utility-first | small single-purpose classes composed in markup: `flex gap-4 p-6` |
| CSS-first config | `@import "tailwindcss";` + `@theme { ... }` in your CSS; no `tailwind.config.js` needed |
| Theme variables | `@theme` tokens (`--color-brand-500`, `--font-display`, `--breakpoint-xl`) generate utilities and become CSS variables |
| Automatic content detection | scans your project for class names; `@source` adds or excludes paths |
| Variants | `hover:`, `focus-visible:`, `md:`, `dark:`, `disabled:`, `aria-expanded:`, `data-[state=open]:`, `group-hover:`, `peer-invalid:`, `has-checked:`, `motion-reduce:` |
| Container queries | `@container` on a parent, `@md:` variants on children |
| Arbitrary values | `w-[22rem]`, `grid-cols-[10rem_1fr]`, CSS variables: `bg-(--brand)` |
| `@utility` | define your own utility classes |
| `@custom-variant` | define variants, e.g. class-based dark mode |
| `@apply` | reuse utilities inside CSS; use sparingly |

### When to extract
Repeating the same class list is fine within one component. When the same UI appears in several places, extract a **React component** (with variants), not a CSS class full of `@apply`. The component is the abstraction; utilities are its implementation.

### CSS architecture at scale
| Technique | Solves |
|:--|:--|
| Cascade layers | specificity conflicts between reset, vendor, components, utilities |
| Design tokens | consistent values; theming |
| Component-scoped styles: Tailwind in components, CSS Modules (`*.module.css`), `@scope` | name collisions |
| Low specificity, no IDs, no deep nesting | predictable overrides |
| Naming (BEM) for plain CSS | readable, flat selectors |
| Lint (Stylelint) | consistency (also seen) |

### CSS performance
| Concern | Practice |
|:--|:--|
| CSS blocks rendering | keep it small; Tailwind outputs only used classes; frameworks inline critical CSS |
| `@import` inside CSS files | sequential downloads; bundle instead |
| Long pages | `content-visibility: auto` + `contain-intrinsic-size` skips rendering offscreen sections |
| Animations | `transform`/`opacity` only; `will-change` sparingly |
| Layout thrashing | avoid reading layout (offsetHeight) and writing styles in loops (JS) |
| Fonts | `font-display: swap`, subset, preload (see [07-performance](../../07-performance/README.md)) |

## Example
Setup in a Vite 8 + React project:
```bash
pnpm add tailwindcss @tailwindcss/vite
```
```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({ plugins: [react(), tailwindcss()] });
```
`src/index.css`
```css
@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme {
  --color-brand-500: oklch(55% 0.18 255);
  --color-brand-600: oklch(49% 0.18 255);
  --font-sans: "Inter Variable", system-ui, sans-serif;
  --radius-card: 0.75rem;
}

@utility focus-ring {
  outline: 2px solid var(--color-brand-500);
  outline-offset: 2px;
}
```
`src/components/Button.tsx` — the component is the abstraction.
```tsx
import type { ComponentProps } from 'react';

const variants = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600',
  secondary: 'bg-white text-gray-900 ring-1 ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
} as const;

type ButtonProps = ComponentProps<'button'> & { variant?: keyof typeof variants };

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
        focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
```
A responsive card with container queries:
```tsx
<div className="@container">
  <article className="grid gap-3 rounded-card p-4 @md:grid-cols-[10rem_minmax(0,1fr)]">
    <img src={img} alt="" width={320} height={200} className="rounded-lg" />
    <h3 className="truncate font-semibold">{name}</h3>
  </article>
</div>
```
also seen: `prettier-plugin-tailwindcss` (sorts classes), `clsx` (conditional classes), `tailwind-merge` (resolves conflicting classes), `cva`/`tailwind-variants` (variant APIs).

Upgrading a v3 project: `npx @tailwindcss/upgrade` rewrites config and renamed utilities (`shadow-sm` → `shadow-xs`, `outline-none` → `outline-hidden`, `bg-gradient-to-r` → `bg-linear-to-r`).

## Production patterns
- **Tokens in `@theme`, used everywhere**; no raw hex colors or arbitrary values for things that repeat.
- **Components own their classes**; pages compose components. Avoid `@apply`-based "utility soups" in CSS.
- **Keep variants explicit** (a typed map), so designers and code share the same names.
- **Check the built CSS size** in CI or bundle reports; it should stay small (tens of KB gzipped).
- **Plain CSS is still fine** for complex selectors and animations; put it in the right layer.

## Mistakes
Wrong: dynamic class names Tailwind can't see.
```tsx
<div className={`text-${color}-600`} /> {/* never generated: not a complete class name */}
```
Right: map to complete names: `const textColor = { red: 'text-red-600', green: 'text-green-600' }[color]`.

Wrong: recreating components with `@apply`.
```css
.btn { @apply inline-flex items-center rounded-lg px-4 py-2 bg-blue-600 text-white; }
```
Right: a `<Button>` component with variants.

Wrong: arbitrary values everywhere (`mt-[13px]`, `text-[#3b82f6]`). Right: theme tokens; arbitrary values only for true one-offs.

Wrong: v3 habits in v4: a `tailwind.config.js` `content` array that no longer drives scanning, or `@tailwind base;` directives.
Right: `@import "tailwindcss";`, `@theme`, `@source` when needed.

## Check yourself
1. Why can't Tailwind generate `text-${color}-600`?
2. When should you extract a component instead of repeating classes?
3. What does `@theme` give you beyond a list of utilities?

<details>
<summary>Answers</summary>

1. Tailwind scans source files for complete class names as plain text; it doesn't run your code, so a string assembled at runtime never appears in the source.
2. When the same UI element (button, badge, card) appears in several places or needs variants; the component keeps markup, behavior, accessibility, and classes together.
3. Each theme variable also becomes a CSS custom property on `:root`, usable in plain CSS, inline styles, and JS, which keeps tokens consistent outside utilities.
</details>

## Sources
- [Tailwind CSS — Installation with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Tailwind CSS — Theme variables](https://tailwindcss.com/docs/theme)
- [Tailwind CSS — Upgrade guide (v3 → v4)](https://tailwindcss.com/docs/upgrade-guide)
- [Tailwind CSS — Detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [MDN — `@scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope)
- [web.dev — content-visibility](https://web.dev/articles/content-visibility)
