---
title: Tailwind CSS 4, architecture, and performance
tech: Tailwind CSS 4, CSS
version: Tailwind CSS 4.3, @tailwindcss/postcss 4.3
date: 2026-11-09
covers: [9, 10, 11]
---
# Tailwind CSS 4, architecture, and performance
[← Overview](00-overview.md)

## Why it matters
- Every component copies 30 utility classes for "primary button"; a brand change means editing 80 files.
- A team migrates to Tailwind 4 but keeps a 400-line `tailwind.config.js` of colors that no longer applies; half the classes silently stop working.
- The CSS bundle is 600 KB because three UI libraries each ship their own stylesheet; first paint waits for all of it.

## Concepts

### Tailwind 4 in one page
Utilities are single-purpose classes generated from your design tokens. v4 is configured **in CSS**.
```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(55% 0.13 45);
  --color-brand-600: oklch(48% 0.13 45);
  --font-display: "Fraunces", serif;
  --radius-card: 0.75rem;
  --breakpoint-xs: 30rem;
}

@custom-variant dark (&:where(.dark, .dark *));

@utility container-prose { max-inline-size: 65ch; margin-inline: auto; }
```
| Feature | Example | Note |
|:--|:--|:--|
| ⭐ `@theme` tokens | `--color-brand-500` → `bg-brand-500`, `text-brand-500` | tokens are also CSS variables at runtime |
| variants | `hover:`, `focus-visible:`, `disabled:`, `aria-invalid:`, `data-[state=open]:`, `group-hover:`, `peer-checked:` | |
| responsive | `md:grid-cols-3` (min-width breakpoints) | mobile-first |
| ⭐ container queries | `@container` on parent, `@md:flex-row` on child | built in |
| dark mode | `dark:bg-stone-900` | via `prefers-color-scheme` or a custom variant |
| arbitrary values | `w-[37rem]`, `bg-(--my-var)` | escape hatch, use sparingly |
| `@utility` | your own utility | |
| `@variant` / `@custom-variant` | your own variant | |
| `starting:` | `@starting-style` variant | |
| `@source` | extra files to scan | monorepos |
| `!` suffix | `p-0!` | important |
| layers | `theme`, `base`, `components`, `utilities` | uses native `@layer` |

Next.js setup: `pnpm add tailwindcss @tailwindcss/postcss`, a `postcss.config.mjs` with `"@tailwindcss/postcss": {}`, and `@import "tailwindcss"` in `globals.css`.

### When to extract components
| Repetition | Extract to |
|:--|:--|
| same classes in one file | a variable or loop |
| a UI pattern used across the app | ⭐ a React component (`<Button variant="primary">`) |
| truly global styles (prose, forms base) | `@layer base` / `@utility` |
| class composition with variants | `cva` + `tailwind-merge` (also seen: `clsx`) |

Avoid `@apply` for component styles; a React component already is the abstraction.

### CSS architecture at scale
| Concern | Practice |
|:--|:--|
| ordering | native `@layer` (Tailwind uses it); vendor CSS in a low layer |
| scoping | component = React component + its utilities; CSS Modules for rare custom CSS |
| naming | tokens by meaning (`brand`, `danger`, `surface`) not by color (`orange`) |
| specificity | single-class selectors; no IDs in CSS |
| design system | tokens in `@theme`, primitives (Button, Input, Card) in one package/folder |
| dead CSS | Tailwind only generates what's used; delete unused custom CSS with the component |

### CSS performance
| Issue | Fix |
|:--|:--|
| render-blocking CSS | keep critical CSS small; Next.js inlines/splits per route |
| huge bundles from UI kits | import per component; one design system |
| expensive animations | animate `transform`/`opacity` only |
| long pages with many sections | `content-visibility: auto` + `contain-intrinsic-size` |
| layout thrashing | avoid JS that reads layout then writes styles in loops |
| web fonts | `next/font`, `font-display: swap`, subsets (07-performance) |
| large `box-shadow`/`filter` | use sparingly on scrolling content |

## Example
`components/ui/button.tsx`
```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-card font-medium transition-colors " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand-500 text-white hover:bg-brand-600",
        ghost: "bg-transparent hover:bg-stone-100 dark:hover:bg-stone-800",
      },
      size: { sm: "h-8 px-3 text-sm", md: "h-10 px-4" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = React.ComponentProps<"button"> & VariantProps<typeof button>;

export function Button({ className, variant, size, ...props }: Props) {
  return <button className={twMerge(button({ variant, size }), className)} {...props} />;
}
```
`app/coffee/page.tsx` (excerpt)
```tsx
<ul className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(15rem,100%),1fr))]">
  {products.map((p) => (
    <li key={p.id} className="@container">
      <article className="grid gap-3 @md:grid-cols-[10rem_1fr]">…</article>
    </li>
  ))}
</ul>
```

## Production patterns
- Tokens in `@theme`, semantic names; components consume tokens through utilities.
- One `Button`, `Input`, `Card`… component per pattern; variants with `cva`, conflicts resolved with `tailwind-merge`.
- Prettier plugin `prettier-plugin-tailwindcss` sorts classes so diffs stay readable.
- Watch CSS size per route in the build output; investigate jumps.

## Mistakes
Wrong: v3 config in a v4 project.
```js
// tailwind.config.js with theme.extend.colors — ignored unless loaded with @config
```
Right: tokens in `@theme` in CSS.

Wrong: `@apply` everywhere to recreate BEM classes.
Right: React components with variants.

## Check yourself
1. Where do brand colors live in Tailwind 4?
2. What is `tailwind-merge` for?
3. Name two CSS performance fixes for a long product listing page.

<details><summary>Answers</summary>

1. In CSS, inside `@theme` (they also become CSS custom properties).
2. Resolving conflicting utility classes when composing (`px-4` from the base and `px-2` from a prop → keeps `px-2`).
3. `content-visibility: auto` with `contain-intrinsic-size` on off-screen sections; animating only `transform`/`opacity`; smaller CSS bundles.
</details>

## Sources
- [Tailwind CSS — Theme variables](https://tailwindcss.com/docs/theme)
- [Tailwind CSS — Upgrade guide (v4)](https://tailwindcss.com/docs/upgrade-guide)
- [Tailwind CSS — Install with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [class-variance-authority](https://cva.style/docs) · [tailwind-merge](https://github.com/dcastil/tailwind-merge)
- [web.dev — content-visibility](https://web.dev/articles/content-visibility)
