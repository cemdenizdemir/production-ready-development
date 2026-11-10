---
title: The cascade, the box model, and units
tech: CSS
version: CSS (Baseline 2025)
date: 2026-11-09
covers: [1, 2]
---
# The cascade, the box model, and units
[← Overview](00-overview.md)

## Why it matters
- A third-party widget's `#app .card p { color: gray }` overrides your component styles; the fix becomes `!important`, then another `!important`.
- A card with `width: 100%` and `padding: 1rem` overflows its column on every page, because `box-sizing` is `content-box`.
- Font sizes in `px` ignore the user's browser text-size setting; low-vision users can't read the shop.

## Concepts

### The cascade
| Step | Rule |
|:--|:--|
| 1. origin and importance | user-agent < author; `!important` flips the order |
| 2. ⭐ cascade layers | `@layer reset, base, components, utilities;` later layers win; unlayered styles beat all layers |
| 3. specificity | (IDs, classes/attributes/pseudo-classes, elements) compared left to right |
| 4. order | last declaration wins |

| Selector | Specificity |
|:--|:--|
| `p` | 0,0,1 |
| `.card p` | 0,1,1 |
| `#app .card p` | 1,1,1 |
| `:where(.card) p` | 0,0,1 (`:where` adds zero) |
| `:is(.card, #x) p` | 1,0,1 (`:is` takes its most specific argument) |
| inline `style` | beats all selectors |

Layers let you decide priority by intent instead of selector weight:
```css
@layer reset, base, components, utilities;
@layer components { .btn { padding: .5rem 1rem; } }
@layer utilities  { .p-0 { padding: 0; } }      /* wins over .btn regardless of specificity */
```
Third-party CSS can be imported into a low layer: `@import url("vendor.css") layer(vendor);`.

Inheritance: text properties (`color`, `font-*`, `line-height`) inherit; box properties (`margin`, `border`, `width`) don't. `inherit`, `initial`, `unset`, `revert`, `revert-layer` control it explicitly.

### The box model
```css
*, *::before, *::after { box-sizing: border-box; }   /* width includes padding and border */
```
| Part | Note |
|:--|:--|
| content → padding → border → margin | `border-box` makes `width` = content + padding + border |
| margin collapse | vertical margins between blocks collapse (not in flex/grid) |
| `overflow` | `hidden` clips (and creates a formatting context), `auto` scrolls when needed, `clip` clips without scroll container |
| `display` | `block`, `inline`, `inline-block`, `flex`, `grid`, `contents`, `none` |

### Logical properties
Write `margin-inline`, `padding-block`, `inset-inline-start`, `border-start-start-radius` instead of left/right/top/bottom. Layouts then work in right-to-left languages (12-cross-cutting) without overrides.

### Units
| Unit | Relative to | Use for |
|:--|:--|:--|
| ⭐ `rem` | root font size (user setting) | font sizes, spacing |
| `em` | current element font size | padding that scales with text |
| `px` | CSS pixel | borders, hairlines |
| `%` | containing block | widths |
| `ch` | width of "0" | readable line length: `max-width: 65ch` |
| `vw` / `vh` | viewport | full-bleed sections |
| ⭐ `dvh` / `svh` / `lvh` | dynamic / small / large viewport | mobile full-height without the URL-bar bug |
| `cqi` / `cqb` | container size | container-query layouts |
| `fr` | free space in grid | grid tracks |

Functions: `clamp(min, preferred, max)`, `min()`, `max()`, `calc()`. Fluid type: `font-size: clamp(1rem, 0.9rem + 0.5vw, 1.25rem);` (always mix a `rem` part so zoom still works).

## Example
`app/globals.css` (plain CSS base before Tailwind)
```css
@layer reset, base, components, utilities;

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  img, svg, video { display: block; max-inline-size: 100%; block-size: auto; }
}

@layer base {
  :root { font-size: 100%; line-height: 1.5; }
  body { font-family: system-ui, sans-serif; color: #1c1917; }
  h1 { font-size: clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem); line-height: 1.15; }
  p { max-inline-size: 65ch; }
}

@layer components {
  .card { padding: 1rem; border: 1px solid #e7e5e4; border-radius: .75rem; }
  .hero { min-block-size: 80dvh; padding-inline: clamp(1rem, 5vw, 4rem); }
}
```

## Production patterns
- Global `border-box`, `rem` for type and spacing, logical properties by default.
- Order layers explicitly at the top of the main stylesheet; put vendor CSS in a low layer.
- Prefer low specificity (single classes, `:where()` in base styles) so overrides stay easy.
- `!important` only inside utilities that must always win (Tailwind's `!` modifier) — not as a fix for specificity fights.

## Mistakes
Wrong: fighting specificity.
```css
#root .page .card .title { color: red !important; }
```
Right: put styles in the right layer with a simple selector.

Wrong: `height: 100vh` on mobile.
Right: `min-block-size: 100dvh` (or `svh` when the URL bar must never cover content).

## Check yourself
1. An unlayered rule and a rule in `@layer utilities` conflict. Which wins?
2. What does `:where()` do to specificity?
3. Why use `rem` instead of `px` for font sizes?

<details><summary>Answers</summary>

1. The unlayered rule; normal (non-important) unlayered styles beat all layered styles.
2. It contributes zero specificity, whatever is inside it.
3. `rem` follows the user's browser font-size setting; `px` ignores it.
</details>

## Sources
- [MDN — Cascade layers](https://developer.mozilla.org/docs/Learn_web_development/Core/Styling_basics/Cascade_layers)
- [MDN — Specificity](https://developer.mozilla.org/docs/Web/CSS/Specificity)
- [MDN — Logical properties](https://developer.mozilla.org/docs/Web/CSS/CSS_logical_properties_and_values)
- [web.dev — Learn CSS: Box model](https://web.dev/learn/css/box-model)
- [web.dev — Large, small, and dynamic viewport units](https://web.dev/blog/viewport-units)
