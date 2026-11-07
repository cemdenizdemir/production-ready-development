---
title: Cascade, box model, units, and stacking
tech: CSS
version: CSS (Baseline 2025)
date: 2026-11-07
covers: [1, 2, 7]
---
# Cascade, box model, units, and stacking
[← Overview](00-overview.md)

## Why it matters
- A third-party widget's `#app .btn` selector beats your component styles. The team answers with `!important`, then more `!important`, and nobody can change a button safely.
- A modal's `z-index: 9999` still renders behind the header, because the modal sits inside a parent with `transform` that created its own stacking context.
- Text sized in `px` ignores the user's browser font setting; people with low vision can't read the app without zooming the whole page.

## Concepts

### The cascade, in order
1. **Origin and importance:** user-agent, user, author styles; `!important` flips the order.
2. **Cascade layers:** later-declared layers win; **unlayered styles beat all layers**.
3. **Specificity:** (IDs, classes/attributes/pseudo-classes, elements/pseudo-elements).
4. **Order of appearance:** the last rule wins.

| Selector | Specificity |
|:--|:--|
| `button` | (0,0,1) |
| `.btn`, `[type=submit]`, `:hover` | (0,1,0) |
| `#checkout` | (1,0,0) |
| `:where(.btn)` | (0,0,0): never wins by specificity |
| `:is(#a, .b)` | takes its most specific argument (1,0,0) |
| inline `style=""` | beats any selector (except `!important`) |

`@layer reset, base, components, utilities;` declares the order once. Third-party CSS can go in a low layer, so your components always win without specificity games.

**Inheritance:** text properties (`color`, `font-*`, `line-height`) inherit; box properties (`margin`, `border`, `width`) don't. Keywords: `inherit`, `initial`, `unset`, `revert`, `revert-layer`.

### Box model
Content → padding → border → margin. `box-sizing: border-box` makes `width` include padding and border; set it globally. Vertical margins collapse in normal flow (not inside flex or grid). Use **logical properties** (`margin-inline`, `padding-block`, `inset-inline-start`, `inline-size`) so layouts flip correctly for right-to-left languages.

### Units
| Unit | Use |
|:--|:--|
| `rem` | font sizes and spacing (respects user font size) |
| `em` | sizes relative to the component's own font (icon next to text) |
| `%` | relative to the containing block |
| `ch` | line length: `max-inline-size: 65ch` |
| `dvh` / `svh` / `lvh` | mobile viewport height with/without browser toolbars (instead of `100vh`) |
| `vw` / `cqi` | viewport width / container inline size |
| `fr` | share of free space in grid |
| `px` | borders, hairlines, shadows |
| `clamp(min, preferred, max)` | fluid values with limits |

### Positioning and stacking
| `position` | Positioned relative to | Note |
|:--|:--|:--|
| `static` | normal flow | default; ignores `top`/`z-index` |
| `relative` | its own normal position | creates a containing block for absolute children |
| `absolute` | nearest positioned ancestor | out of flow |
| `fixed` | viewport (unless an ancestor has `transform`) | out of flow |
| `sticky` | scroll container, after a threshold | breaks if an ancestor has `overflow: hidden` |

`z-index` only compares elements inside the **same stacking context**. New contexts come from `position` + `z-index`, `opacity < 1`, `transform`, `filter`, `isolation: isolate`, `will-change`, and flex/grid children with `z-index`. The **top layer** (`<dialog>` with `showModal()`, popovers) sits above everything, no `z-index` needed.

## Example
`styles/base.css`
```css
@layer reset, vendor, base, components, utilities;

@import url("vendor/datepicker.css") layer(vendor); /* can never out-specify your components */

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  img, svg, video { display: block; max-inline-size: 100%; block-size: auto; }
}

@layer base {
  :root {
    --space-2: 0.5rem;
    --space-4: 1rem;
    --z-dropdown: 100;
    --z-toast: 1000;
  }
  html { font-size: 100%; }            /* keep the user's setting (usually 16px) */
  body { font: 1rem/1.5 system-ui, sans-serif; }
  h1 { font-size: clamp(1.75rem, 1.2rem + 2vw, 2.5rem); line-height: 1.2; }
  .prose { max-inline-size: 65ch; }
}

@layer components {
  .card {
    isolation: isolate;                 /* children's z-index stays inside the card */
    padding: var(--space-4);
    border: 1px solid #ddd;
    border-radius: 0.5rem;
  }
  .card__badge { position: absolute; inset-block-start: var(--space-2); inset-inline-end: var(--space-2); z-index: 1; }
  .card { position: relative; }
}

@layer utilities {
  .visually-hidden {
    position: absolute; inline-size: 1px; block-size: 1px;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap;
  }
}
```
Debug: DevTools → Elements → Computed shows the winning declaration; the Styles pane shows the layer and crossed-out losers. The Layers panel (Chrome) visualizes stacking.

## Production patterns
- **Declare layers once at the top** of the main stylesheet; import third-party CSS into a low layer.
- **Low, flat specificity:** classes only, no IDs in selectors, `:where()` for base styles that should be easy to override.
- **`rem` for type and spacing, `px` for borders.** Never set `html { font-size: 62.5% }` to do math; it breaks user preferences in places.
- **A small z-index scale as tokens** (`--z-dropdown`, `--z-toast`) plus `isolation: isolate` on components; use `<dialog>`/popover for overlays.
- **`100dvh` for full-height mobile layouts**, not `100vh`.

## Mistakes
Wrong: winning with force.
```css
.btn-primary { background: blue !important; }
```
Right: put competing styles in layers or lower their specificity with `:where()`.

Wrong: escalating `z-index`.
```css
.modal { z-index: 999999; } /* still behind: its parent has transform */
```
Right: render modals in the top layer (`dialog.showModal()`), or fix the stacking context.

Wrong: `height: 100vh` on mobile, which hides content behind browser toolbars.
Right: `min-block-size: 100dvh`.

Wrong: physical properties in an app that will be translated to Arabic.
```css
.icon { margin-left: 8px; }
```
Right: `margin-inline-start: 0.5rem;`

## Check yourself
1. An unlayered rule and a rule in `@layer components` both set `color`. The layered one has higher specificity. Which wins?
2. Why might `position: sticky` do nothing?
3. Why does `z-index: 9999` sometimes fail to bring an element to the front?

<details>
<summary>Answers</summary>

1. The unlayered rule. Layer order is checked before specificity, and unlayered styles beat layered ones (for normal, non-important declarations).
2. An ancestor between it and the scroll container has `overflow: hidden/auto`, it has no `top`/`bottom` threshold, or its parent is no taller than the element itself.
3. It's inside a stacking context (created by `transform`, `opacity`, `isolation`, etc.) whose whole context is ordered below another element; `z-index` only competes within the same context.
</details>

## Sources
- [MDN — Cascade, specificity, and inheritance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Handling_conflicts)
- [MDN — `@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [MDN — Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context)
- [MDN — Logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values)
- [web.dev — Large, small, and dynamic viewport units](https://web.dev/blog/viewport-units)
