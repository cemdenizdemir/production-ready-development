---
title: Responsive UI, design system, theming, and assets
tech: React 19.2, TypeScript, Tailwind CSS 4, Next.js 16
version: Tailwind CSS 4.3, React 19.2, Next.js 16
date: 2026-11-07
covers: [1, 2, 3, 10]
---
# Responsive UI, design system, theming, and assets
[← Overview](00-overview.md)

## Why it matters
- Five button styles exist because each feature team styled its own. Focus rings, disabled states, and loading spinners differ everywhere, and some are inaccessible.
- Dark mode loads light first, then flips to dark after hydration: a white flash on every page load at night.
- Icons are PNGs in three sizes; they blur on high-density screens and ignore the current text color in dark mode.

## Concepts

### Design tokens: primitive → semantic
| Layer | Example | Used by |
|:--|:--|:--|
| Primitive (palette) | `--color-blue-600`, `--space-4` | semantic tokens only |
| Semantic | `--color-surface`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-danger` | components |
| Component (optional) | `--button-radius` | one component |

Themes (light, dark, high contrast, brands) swap **semantic** tokens; components never change. In Tailwind 4, tokens defined in `@theme` become utilities (`bg-surface`, `text-muted`) and CSS variables.

### A small component library
| Principle | Practice |
|:--|:--|
| Few, solid primitives | Button, Link, Field (label/hint/error), Input, Select, Checkbox, Dialog, Toast, Card, Badge, Skeleton |
| Typed variants | `variant: 'primary' \| 'secondary' \| 'danger'`, `size: 'sm' \| 'md'` maps, not free-form classes |
| Composition | `children`, slots, compound components over boolean props |
| Accessibility built in | names required, focus styles, keyboard behavior, `aria-*` wiring |
| States built in | hover, focus-visible, disabled, loading, invalid |
| Documented | usage examples per component (also seen: Storybook) |
| Headless behavior | complex widgets from a tested library (also seen: React Aria, Radix) |

### Responsive across devices
| Concern | Practice |
|:--|:--|
| Layout | mobile-first, intrinsic grids, container queries for components ([02-css](../../02-css/docs/02-layout-and-responsive.md)) |
| Touch | targets ≥ 24 px (44 px preferred), no hover-only actions, `pointer: coarse` tweaks |
| Safe areas | `env(safe-area-inset-bottom)` for notches and home indicators |
| Viewport height | `dvh` instead of `vh` |
| Tables on mobile | stack rows as cards, or a horizontally scrollable, focusable region with a caption |
| Testing | real phones (iOS Safari especially), 320 px width, 200% zoom |

### Theming without a flash
| Approach | Flash? | Notes |
|:--|:--|:--|
| CSS only: `color-scheme: light dark` + `light-dark()` / `prefers-color-scheme` | no | follows the OS; no user override |
| User override stored in a cookie, read on the server | no | makes the page request-specific (dynamic) |
| User override in `localStorage` + tiny inline script in `<head>` | no | runs before paint; needs a CSP nonce/hash |
| Theme applied in `useEffect` after hydration | **yes** | avoid |

### Icons, images, fonts as a system
| Asset | System |
|:--|:--|
| Icons | inline SVG components, `fill="currentColor"`, size via classes, `aria-hidden` by default; one icon set |
| Images | `next/image` with sizes defined per layout slot; an image pipeline for uploads |
| Fonts | `next/font` exposed as a CSS variable mapped to Tailwind's `--font-sans` |
| Illustrations | SVG with theme-aware colors (`currentColor`, CSS variables) |

## Example
`app/globals.css` — semantic tokens with light and dark values.
```css
@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme {
  --color-surface: var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-text: var(--text);
  --color-muted: var(--text-muted);
  --color-accent: var(--accent);
  --color-danger: var(--danger);
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --radius-control: 0.5rem;
}

:root {
  color-scheme: light;
  --surface: oklch(99% 0 0);  --surface-raised: oklch(100% 0 0);
  --text: oklch(22% 0.02 255); --text-muted: oklch(45% 0.02 255);
  --accent: oklch(52% 0.18 255); --danger: oklch(52% 0.2 25);
}
[data-theme="dark"] {
  color-scheme: dark;
  --surface: oklch(18% 0.01 255); --surface-raised: oklch(23% 0.01 255);
  --text: oklch(93% 0.01 255);    --text-muted: oklch(72% 0.02 255);
  --accent: oklch(72% 0.14 255);  --danger: oklch(72% 0.16 25);
}
```
`app/layout.tsx` — set the theme before first paint.
```tsx
import { headers } from 'next/headers';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const themeScript = `(() => {
  try {
    const saved = localStorage.getItem('theme');
    const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch {}
})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined; // CSP nonce from proxy.ts (11-security)
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning> {/* data-theme differs from server HTML */}
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-surface font-sans text-text">{children}</body>
    </html>
  );
}
```
Reading request headers makes the layout request-specific; if you want fully static pages, use the CSS-only approach (no user override) or a CSP hash for this fixed script.

`components/ui/Icon.tsx` — one icon system.
```tsx
import type { SVGProps } from 'react';

const paths = {
  check: 'M5 13l4 4L19 7',
  close: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
} as const;

type IconProps = SVGProps<SVGSVGElement> & { name: keyof typeof paths; label?: string };

export function Icon({ name, label, className = 'size-5', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
         className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
```

## Production patterns
- **Semantic tokens only in components**; palettes stay behind them. New themes are token files.
- **A small, owned component library** with variants, states, and accessibility built in; product code composes it.
- **Theme before paint** (CSS-only or an inline head script); never apply the theme in an effect.
- **One icon system**, inline SVG with `currentColor`, decorative by default, named when standalone.
- **Test responsive behavior on real devices**, not only the DevTools device toolbar.

## Mistakes
Wrong: raw palette colors in components.
```tsx
<p className="text-gray-500 dark:text-gray-400">…</p> {/* repeated everywhere, inconsistent */}
```
Right: `<p className="text-muted">…</p>` with the token defined once per theme.

Wrong: applying the stored theme in `useEffect`; the page flashes light first. Right: inline head script or CSS-only theming.

Wrong: icons as PNG/JPEG, or icon fonts (inaccessible, blurry, no `currentColor` control). Right: inline SVG components.

Wrong: one-off buttons per feature. Right: the shared `Button` with variants; extend it when a real new variant appears.

## Check yourself
1. Why should components use semantic tokens instead of palette colors?
2. Which theming approaches avoid a flash of the wrong theme?
3. When should an icon have an accessible name?

<details>
<summary>Answers</summary>

1. Themes then only redefine semantic tokens; components don't change, and every surface/text pairing keeps its tested contrast.
2. CSS-only theming via `color-scheme`/`light-dark()`/`prefers-color-scheme`, a server-rendered theme from a cookie, or an inline script in `<head>` that sets the theme before first paint.
3. When it's the only content of a control (icon-only button) or conveys information on its own; decorative icons next to text get `aria-hidden`.
</details>

## Sources
- [Tailwind CSS — Dark mode](https://tailwindcss.com/docs/dark-mode)
- [Tailwind CSS — Theme variables](https://tailwindcss.com/docs/theme)
- [W3C Design Tokens Community Group](https://www.designtokens.org/)
- [MDN — `color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
- [Next.js — Fonts](https://nextjs.org/docs/app/getting-started/fonts)
