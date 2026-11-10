---
title: Flexbox, Grid, responsive design, and stacking
tech: CSS
version: CSS (Baseline 2025)
date: 2026-11-09
covers: [3, 4, 7]
---
# Flexbox, Grid, responsive design, and stacking
[← Overview](00-overview.md)

## Why it matters
- The product grid uses fixed widths and three media queries; on a 375 px phone the last card overflows and adds horizontal scroll to the whole page.
- A "product card" looks right in the main grid but breaks in the narrow sidebar, because it responds to the viewport, not to its container.
- The cart drawer has `z-index: 9999` and still appears behind the sticky header, because they sit in different stacking contexts.

## Concepts

### Flexbox or Grid
| Use | When |
|:--|:--|
| Flexbox | one dimension: a row of buttons, nav items, label + input, content-sized items that wrap |
| Grid | two dimensions or a defined track structure: page layout, card grids, forms with aligned columns |

Flexbox essentials: `display: flex; gap; flex-wrap: wrap; justify-content; align-items; flex: 1 1 12rem;` and `min-width: 0` on flex children that contain long text.

Grid essentials:
```css
.products {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));   /* responsive with no media query */
  gap: 1.5rem;
}
.layout { display: grid; grid-template-areas: "header" "main" "footer"; }
@media (width >= 64rem) {
  .layout { grid-template-columns: 16rem 1fr; grid-template-areas: "header header" "nav main" "footer footer"; }
}
```
| Feature | Note |
|:--|:--|
| `fr` | share free space |
| `minmax(a, b)` | track size limits |
| `auto-fit` vs `auto-fill` | fit collapses empty tracks; fill keeps them |
| `min(16rem, 100%)` | prevents overflow on tiny screens |
| `grid-template-areas` | readable layouts |
| subgrid (`grid-template-rows: subgrid`) | align card internals across cards |
| `gap` | spacing in flex and grid |

### Responsive design
| Tool | Responds to | Use |
|:--|:--|:--|
| intrinsic layouts (`auto-fit`, `flex-wrap`, `clamp`) | content and space | first choice |
| ⭐ media queries `@media (width >= 48rem)` | viewport | page-level layout |
| ⭐ container queries `@container (inline-size > 30rem)` | the component's container | reusable components |
| `prefers-*` media features | user settings | reduced motion, color scheme, contrast |
| fluid type with `clamp()` | viewport/container | smooth scaling |

Mobile-first: base styles for small screens, `min-width` (or `width >=`) queries add complexity for larger ones.

```css
.card-wrap { container-type: inline-size; }
@container (inline-size > 30rem) {
  .card { display: grid; grid-template-columns: 10rem 1fr; }
}
```

### Positioning and stacking contexts
| `position` | Behavior |
|:--|:--|
| `static` | normal flow |
| `relative` | offset from itself; anchor for absolute children |
| `absolute` | relative to nearest positioned ancestor |
| `fixed` | relative to viewport (unless an ancestor has `transform`/`filter`) |
| `sticky` | sticks within its scroll container |

`z-index` only compares elements **in the same stacking context**. New contexts are created by: positioned elements with `z-index`, `opacity < 1`, `transform`, `filter`, `isolation: isolate`, `will-change`, `contain: paint`, and more. A child can never escape its parent's context.

Fixes: a small z-index scale as tokens (`--z-header: 10; --z-drawer: 20; --z-toast: 30`), `isolation: isolate` on components, and the **top layer** (`<dialog>.showModal()`, `popover`) for overlays: it sits above everything without z-index.

## Example
`components/product-card.css`
```css
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.product-card-container { container-type: inline-size; }

.product-card {
  display: grid;
  gap: .75rem;
  isolation: isolate;                 /* its own stacking context for badges */
}

.product-card__badge { position: absolute; inset-block-start: .5rem; inset-inline-start: .5rem; z-index: 1; }

@container (inline-size > 28rem) {
  .product-card { grid-template-columns: 12rem 1fr; align-items: start; }
}

.site-header { position: sticky; inset-block-start: 0; z-index: var(--z-header, 10); }
```

## Production patterns
- Intrinsic layouts first, container queries for components, media queries for page structure.
- Test at 320 px width and at 200%/400% zoom; horizontal scroll means a bug (WCAG reflow).
- A z-index token scale; overlays use `<dialog>`/`popover` (top layer) instead of high z-index values.
- `min-width: 0` on flex/grid items that hold long text or code to prevent overflow.

## Mistakes
Wrong: magic numbers.
```css
.drawer { z-index: 99999; }
```
Right: find the stacking context; use tokens or the top layer.

Wrong: fixed-width cards.
```css
.card { width: 320px; }
```
Right: `grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr))`.

## Check yourself
1. When does a component need a container query rather than a media query?
2. Why can't a child with `z-index: 9999` appear above an element outside its parent's stacking context?
3. What does `minmax(min(15rem, 100%), 1fr)` protect against?

<details><summary>Answers</summary>

1. When it's used in places of different widths (main grid, sidebar, modal) and must adapt to its own space, not the screen.
2. z-index is compared only within a stacking context; the whole parent context is painted as one layer relative to its siblings.
3. Overflow on containers narrower than 15rem: the track can shrink to 100% of the container.
</details>

## Sources
- [MDN — CSS grid layout](https://developer.mozilla.org/docs/Web/CSS/CSS_grid_layout)
- [MDN — Flexbox](https://developer.mozilla.org/docs/Learn_web_development/Core/CSS_layout/Flexbox)
- [MDN — Container queries](https://developer.mozilla.org/docs/Web/CSS/CSS_containment/Container_queries)
- [MDN — Stacking context](https://developer.mozilla.org/docs/Web/CSS/CSS_positioned_layout/Stacking_context)
- [web.dev — Learn CSS: Grid](https://web.dev/learn/css/grid)
