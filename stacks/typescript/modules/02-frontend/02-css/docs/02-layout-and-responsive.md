---
title: Flexbox, Grid, and responsive design
tech: CSS
version: CSS (Baseline 2025)
date: 2026-11-07
covers: [3, 4]
---
# Flexbox, Grid, and responsive design
[← Overview](00-overview.md)

## Why it matters
- A product name with no spaces overflows its flex card and pushes the price off-screen on small phones.
- The same card component needs a vertical layout in the sidebar and horizontal in the main column. Media queries can't tell where it's placed; container queries can.
- Twelve breakpoints, one per device someone tested on. Every new phone width breaks something.

## Concepts

### Flexbox vs Grid
| | Flexbox | Grid |
|:--|:--|:--|
| Dimensions | one (row or column) | two (rows and columns) |
| Sizing starts from | the content | the layout you define |
| Good for | toolbars, nav bars, button groups, centering, media objects | page layouts, card grids, forms with aligned labels |
| Spacing | `gap` | `gap` |

Rule of thumb: content decides the size → flex; layout decides the size → grid.

### Flexbox essentials
| Property | Effect |
|:--|:--|
| `display: flex` | children become flex items |
| `flex-direction` | `row` (default) or `column` |
| `justify-content` | main-axis distribution: `space-between`, `center` |
| `align-items` | cross-axis alignment: `center`, `stretch`, `baseline` |
| `flex-wrap: wrap` | allow multiple lines |
| `flex: 1` | grow to fill, starting from 0 basis |
| `flex: none` | keep content size |
| `margin-inline-start: auto` | push an item to the end |
| `min-inline-size: 0` | let an item shrink below its content (needed for text truncation) |

### Grid essentials
| Property | Effect |
|:--|:--|
| `grid-template-columns: repeat(3, 1fr)` | three equal columns |
| `repeat(auto-fit, minmax(16rem, 1fr))` | as many columns as fit, each at least 16rem: responsive with no media query |
| `minmax(0, 1fr)` | column that can shrink (prevents blowout from long content) |
| `grid-template-areas` | name regions: `"header header" "nav main"` |
| `grid-column: 1 / -1` | span all columns |
| `subgrid` | child grid reuses the parent's tracks (aligned card sections) |
| `place-items: center` | center in both axes |

### Responsive design
| Tool | Responds to | Use |
|:--|:--|:--|
| Fluid layouts (`fr`, `%`, `minmax`, `flex-wrap`) | available space | first choice; fewer breakpoints |
| Media queries `@media (width >= 48rem)` | viewport | page-level layout changes |
| Container queries `@container (width > 30rem)` | the component's container | reusable components |
| `clamp()` | viewport/container size | fluid type and spacing |
| `@media (hover: hover) and (pointer: fine)` | input type | hover-only affordances |
| `prefers-reduced-motion`, `prefers-color-scheme`, `prefers-contrast` | user settings | accessibility, theming |

Mobile-first: base styles for small screens, `min-width` queries add complexity for larger ones. Choose breakpoints where *your content* breaks, not per device. Touch targets need at least 24×24 CSS px (WCAG 2.2 AA), ideally 44×44.

## Example
`product-card.css` — one component, adapts to its container.
```css
.card-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
  gap: 1rem;
}

.card-slot { container-type: inline-size; } /* the card responds to this box's width */

.card {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}

.card__title {
  min-inline-size: 0;                 /* allow truncation inside grid/flex */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.card__actions .price { margin-inline-start: auto; }

@container (width > 32rem) {
  .card {
    grid-template-columns: 10rem minmax(0, 1fr);
    align-items: start;
  }
}

.page {
  display: grid;
  grid-template-areas: "header" "main" "aside";
  min-block-size: 100dvh;
}
@media (width >= 64rem) {
  .page {
    grid-template-columns: minmax(0, 1fr) 20rem;
    grid-template-areas: "header header" "main aside";
  }
}
```
```html
<div class="card-list">
  <div class="card-slot">
    <article class="card">
      <img src="/img/desk.jpg" alt="" width="320" height="200">
      <h3 class="card__title">Oak desk 140 cm with cable tray and drawer</h3>
      <div class="card__actions"><button>Add to cart</button><span class="price">€349</span></div>
    </article>
  </div>
</div>
```
Debug with DevTools grid and flex overlays (badges next to elements in the Elements panel), and the device toolbar for widths between your breakpoints.

## Production patterns
- **Intrinsic layouts first** (`auto-fit` + `minmax`, `flex-wrap`); add breakpoints only where content breaks.
- **Container queries for components, media queries for page layout.** Components then work in any slot.
- **`min()` inside `minmax()`** (`minmax(min(18rem, 100%), 1fr)`) so the grid never overflows narrow screens.
- **Test at awkward widths** (320px, between breakpoints, 200% zoom), not only device presets.
- **Use `gap`**, not margins on children, for spacing inside flex and grid.

## Mistakes
Wrong: long content blows out a column.
```css
grid-template-columns: 1fr 20rem; /* 1fr has an automatic minimum = longest word or URL */
```
Right: `minmax(0, 1fr) 20rem`.

Wrong: truncation that never truncates in a flex row.
```css
.title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } /* item won't shrink */
```
Right: add `min-inline-size: 0` (or `min-width: 0`) to the flex item.

Wrong: device breakpoints everywhere (`375px`, `390px`, `414px`, `768px`, `820px`...).
Right: a few content-driven breakpoints, fluid values between them, container queries for components.

Wrong: hover-only menus. Touch screens have no hover. Right: click/tap to open, hover as an enhancement under `(hover: hover)`.

## Check yourself
1. When would you pick Grid over Flexbox for a row of cards?
2. What does `repeat(auto-fit, minmax(16rem, 1fr))` do as the container grows?
3. Why are container queries better than media queries for a reusable card?

<details>
<summary>Answers</summary>

1. When the cards must align in columns across rows (equal widths, consistent tracks) or you want columns to appear based on space; Flexbox is better when each item's width should follow its content.
2. It fits as many columns of at least 16rem as possible, and stretches them to share leftover space; new columns appear automatically as space grows.
3. The card's layout depends on the space it's given, not the viewport. In a narrow sidebar on a wide screen, a media query would pick the wrong layout; a container query reacts to the actual slot.
</details>

## Sources
- [MDN — Flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox)
- [MDN — Grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)
- [MDN — Container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
- [web.dev — Learn CSS: Grid](https://web.dev/learn/css/grid)
- [W3C — WCAG 2.2 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
