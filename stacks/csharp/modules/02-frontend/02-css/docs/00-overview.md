---
title: CSS — Overview
tech: CSS, then Tailwind CSS 4
version: CSS (Baseline 2025), Tailwind CSS 4.3
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# CSS — Overview
[← Topic](../README.md)

**TECH:** modern CSS first (cascade layers, Grid, container queries, `oklch()`), then Tailwind CSS 4.3 in the Next.js app
**LEVEL:** intermediate (mid-level, new to C# and .NET; frontend matches the TypeScript stack)

## Why this matters in production
- Tailwind is CSS with shorter names. Without understanding the cascade, layout, and stacking contexts, utility classes just move the confusion into the markup.
- Layout bugs (overflow on small phones, modals behind headers, text that can't zoom) are among the most common front-end defects and accessibility failures.
- CSS is render-blocking: its size and structure affect every page's first paint.

## Mental model
For each element and property, the browser collects every matching declaration and picks a winner: **origin and importance → cascade layer → specificity → order of appearance**. Values that aren't set are inherited (for inheritable properties) or fall back to initial values. Layout then flows from the box model and the layout mode (flow, flex, grid, positioned).

```mermaid
flowchart LR
  D[All matching declarations] --> O[Origin + !important]
  O --> L["@layer order"]
  L --> S[Specificity]
  S --> R[Source order]
  R --> V[Computed value] --> LAY[Layout: flow / flex / grid] --> P[Paint + composite]
```

## Prerequisites
- [01-html](../../01-html/README.md) (semantic elements to style).

## Lesson map
| Lesson | Checklist items |
|:--|:--|
| [01 · The cascade, the box model, and units](01-cascade-box-units.md) | 1, 2 |
| [02 · Flexbox, Grid, responsive design, and stacking](02-layout-responsive.md) | 3, 4, 7 |
| [03 · Modern selectors, tokens and color, motion](03-modern-css.md) | 5, 6, 8 |
| [04 · Tailwind CSS 4, architecture, and performance](04-tailwind-architecture.md) | 9, 10, 11 |
| [Cheatsheet](cheatsheet.md) | all |

## Suggested order
1. 01 → 04. Do 01–03 in plain CSS before Tailwind; you'll read Tailwind classes as CSS from then on.
2. Then [04-framework](../../04-framework/README.md) and [12-cross-cutting](../../12-cross-cutting/README.md) (design tokens, theming).
3. Ready to build: `/learn csharp/02-frontend/02-css mode=tasks`.

## Version notes
- Baseline 2025 includes cascade layers, `:has()`, container size queries, native nesting, `light-dark()`, `color-mix()`, `oklch()`, subgrid, `@starting-style`, and same-document view transitions.
- Tailwind CSS 4 is configured in CSS (`@import "tailwindcss"; @theme { ... }`) instead of `tailwind.config.js`, uses cascade layers, and ships container-query variants (`@container`, `@md:`). Next.js uses `@tailwindcss/postcss`; Vite projects use `@tailwindcss/vite`.

## Sources
- [MDN — CSS](https://developer.mozilla.org/docs/Web/CSS)
- [web.dev — Learn CSS](https://web.dev/learn/css)
- [Tailwind CSS v4 docs](https://tailwindcss.com/docs)
- [Baseline 2025](https://web.dev/baseline)
