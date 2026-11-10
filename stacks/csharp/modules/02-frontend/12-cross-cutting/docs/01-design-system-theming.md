---
title: Responsive layouts, design tokens, components, theming
tech: Tailwind CSS 4, React 19.2, Next.js 16
version: Tailwind CSS 4.3, React 19.2
date: 2026-11-09
covers: [1, 2, 3, 10]
---
# Responsive layouts, design tokens, components, theming
[← Overview](00-overview.md)

## Why it matters
- Five slightly different blue buttons exist because each feature team picked a color; a rebrand needs a code search for hex values.
- Dark mode flashes white on every page load ("flash of incorrect theme") because the theme is applied after hydration.
- Tap targets on mobile are 20 px; users hit "Remove" instead of "+1".

## Concepts

### Responsive across devices
| Concern | Practice |
|:--|:--|
| mobile-first | base styles for small screens; `md:`/`lg:` add layout |
| intrinsic layouts | grid `auto-fit`/`minmax`, flex-wrap (02-css) |
| ⭐ container queries | components adapt to their container (`@container`, `@md:`) |
| touch targets | ≥ 44×44 px recommended (WCAG 2.2 minimum 24×24) |
| input methods | `hover:` only as enhancement; `pointer: coarse` media for touch tweaks |
| viewport units | `dvh` for full-height panels |
| test matrix | 320 px, 375 px, tablet, desktop, 200% zoom |

### Design tokens and a small component library
| Tier | Example | Used by |
|:--|:--|:--|
| primitive | `--color-coffee-600: oklch(48% 0.11 50)` | only the token file |
| semantic | `--color-brand`, `--color-surface`, `--color-danger`, `--radius-card` | components |
| component | `--button-bg` (rare) | one component |

Components (`components/ui`): `Button`, `IconButton`, `Input`, `Field`, `Select`, `Dialog`, `Card`, `Badge`, `Toast`, `Skeleton`. Variants with `cva`, composition with `children`/slots (04-framework), accessible by default (08-accessibility). Document them in Storybook (also seen) or a simple `/dev/components` page.

### Theming and dark mode without a flash
- Tokens defined with `light-dark()` or two sets of variables under `:root` and `.dark`.
- `color-scheme: light dark` so native controls match.
- Theme choice order: user setting (cookie) → system preference (`prefers-color-scheme`).
- Apply the class **before paint**: a tiny inline script in `<head>` reads the cookie/`localStorage` and sets `class="dark"` on `<html>`, or rely purely on `prefers-color-scheme` CSS (no script, no flash). Add `suppressHydrationWarning` on `<html>` because its class differs from the server render.

### Icons, images, and fonts as a system
| Asset | System |
|:--|:--|
| icons | one icon set (e.g. Lucide) imported per icon (tree-shaken), sized with `size-*`, colored with `currentColor`, `aria-hidden` unless meaningful |
| images | `next/image` everywhere, a few standard aspect ratios, alt text from data |
| fonts | `next/font` with 1–2 families exposed as CSS variables (`--font-sans`, `--font-display`) mapped in `@theme` |
| illustrations | SVG with `currentColor` for theming |

## Example
`web/src/app/globals.css`
```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-coffee-50: oklch(97% 0.01 70);
  --color-coffee-600: oklch(48% 0.11 50);
  --color-coffee-900: oklch(25% 0.05 45);
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --radius-card: 0.75rem;
}

:root {
  color-scheme: light dark;
  --color-surface: var(--color-coffee-50);
  --color-text: var(--color-coffee-900);
  --color-brand: var(--color-coffee-600);
}
.dark {
  --color-surface: oklch(18% 0.02 50);
  --color-text: oklch(94% 0.01 70);
  --color-brand: oklch(70% 0.12 55);
}

@theme inline {
  --color-surface: var(--color-surface);
  --color-text: var(--color-text);
  --color-brand: var(--color-brand);
}
```
`web/src/app/layout.tsx`
```tsx
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

const themeScript = `try{const t=localStorage.getItem("theme");const d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch{}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="bg-surface text-text font-sans">{children}</body>
    </html>
  );
}
```
The inline script is static, written by you (not user input), and needs a CSP nonce or hash (11-security lesson 02).

## Production patterns
- Components use semantic tokens only; primitives live in one file.
- Theme applied before paint; tested in both themes for contrast (08-accessibility).
- Container queries for reusable components; a device/zoom test matrix in QA.
- One icon set, one image component, one font setup.

## Mistakes
Wrong: `className="bg-[#7c4a2d]"` in feature code.
Right: `bg-brand` from a semantic token.

Wrong: toggling dark mode in `useEffect` after hydration.
Right: pre-paint script or pure CSS `prefers-color-scheme`.

## Check yourself
1. What is the difference between primitive and semantic tokens?
2. Why does the theme script need to run in `<head>`?
3. Why add `suppressHydrationWarning` to `<html>`?

<details><summary>Answers</summary>

1. Primitives name raw values (coffee-600); semantic tokens name purposes (brand, surface, danger) and map to primitives per theme.
2. So the class is set before the first paint; otherwise users see the wrong theme flash.
3. The script changes `<html>`'s class before React hydrates, so the server-rendered attribute differs from the DOM.
</details>

## Sources
- [Tailwind CSS — Theme variables](https://tailwindcss.com/docs/theme)
- [Tailwind CSS — Dark mode](https://tailwindcss.com/docs/dark-mode)
- [MDN — prefers-color-scheme](https://developer.mozilla.org/docs/Web/CSS/@media/prefers-color-scheme)
- [W3C — Design Tokens Community Group](https://www.w3.org/community/design-tokens/)
- [WCAG 2.2 — Target size (minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
