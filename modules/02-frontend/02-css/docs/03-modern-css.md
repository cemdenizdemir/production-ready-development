---
title: Modern selectors, tokens, color, and motion
tech: CSS
version: CSS (Baseline 2025)
date: 2026-11-07
covers: [5, 6, 8]
---
# Modern selectors, tokens, color, and motion
[← Overview](00-overview.md)

## Why it matters
- Focus outlines removed with `outline: none` "because they look ugly". Keyboard users can't see where they are.
- Dark mode built by duplicating every color rule. Half the screens get forgotten and show black text on dark gray.
- A parallax intro animation triggers dizziness and nausea for users with vestibular disorders, who asked their OS for reduced motion.

## Concepts

### Selectors worth knowing
| Selector | Matches | Example |
|:--|:--|:--|
| `:has()` | elements containing something | `.field:has(:user-invalid)`, `.card:has(img)` |
| `:is(a, b)` | any of a list, with specificity of the most specific | `:is(h1, h2, h3) { line-height: 1.2 }` |
| `:where(a, b)` | same, with zero specificity | easy-to-override base styles |
| `:not(a, b)` | none of a list | `li:not(:last-child)` |
| `:focus-visible` | focus the browser decides to show (keyboard) | focus rings without mouse-click rings |
| `:focus-within` | an element containing focus | highlight a whole form group |
| `:user-invalid` | invalid after user interaction | error styles that don't scream on load |
| `:nth-child(2 of .item)` | nth among matching siblings | zebra rows for filtered lists |
| `::marker`, `::placeholder`, `::selection` | parts of elements | |
| `&` nesting | native nesting | `.card { &:hover { … } .title { … } }` |

### Custom properties and design tokens
- `--name: value` defines a property that inherits; `var(--name, fallback)` reads it.
- **Tokens** are named decisions: `--color-surface`, `--color-text`, `--space-4`, `--radius-md`. Components use tokens, never raw values.
- Theming = redefining tokens under a selector or media query; components don't change.
- `@property` registers a typed custom property, so it can animate and has a real initial value.

### Color in modern CSS
| Feature | Use |
|:--|:--|
| `oklch(L C H)` | perceptually even lightness; predictable palettes |
| `color-mix(in oklch, var(--brand) 80%, white)` | tints and shades from one token |
| Relative colors `oklch(from var(--brand) calc(l - 0.1) c h)` | derive hover/active states |
| `color-scheme: light dark` | native controls and scrollbars follow the theme |
| `light-dark(#111, #eee)` | pick per active color scheme |
| Contrast | text 4.5:1, large text and UI parts 3:1 (WCAG AA) |

### Motion
| Tool | Use |
|:--|:--|
| `transition` | animate between states (hover, open) |
| `@keyframes` + `animation` | multi-step or looping animations |
| Animate `transform` and `opacity` | composited: smooth, no layout work |
| `@media (prefers-reduced-motion: reduce)` | remove or reduce non-essential motion |
| `@starting-style` + `transition-behavior: allow-discrete` | animate elements entering from `display: none` (dialogs, popovers) |
| View Transitions (`document.startViewTransition()`, `view-transition-name`) | animated state/page changes; same-document is Baseline 2025 |
| `@view-transition { navigation: auto; }` | cross-document transitions (multi-page apps; Chromium and Safari) |

## Example
`tokens.css` and a component using them.
```css
@layer base {
  :root {
    color-scheme: light dark;
    --brand: oklch(55% 0.18 255);
    --color-bg: light-dark(oklch(99% 0 0), oklch(18% 0.01 255));
    --color-text: light-dark(oklch(22% 0.02 255), oklch(93% 0.01 255));
    --color-muted: light-dark(oklch(45% 0.02 255), oklch(72% 0.02 255));
    --color-danger: light-dark(oklch(50% 0.2 25), oklch(70% 0.17 25));
    --radius-md: 0.5rem;
    --focus-ring: 0 0 0 3px color-mix(in oklch, var(--brand) 60%, transparent);
  }
  [data-theme="dark"] { color-scheme: dark; }   /* manual override; light-dark() follows it */
  [data-theme="light"] { color-scheme: light; }

  body { background: var(--color-bg); color: var(--color-text); }

  :focus-visible { outline: none; box-shadow: var(--focus-ring); } /* replaced, not removed */
}

@layer components {
  .button {
    background: var(--brand);
    color: white;
    border-radius: var(--radius-md);
    transition: background-color 150ms ease, transform 150ms ease;

    &:hover { background: oklch(from var(--brand) calc(l - 0.07) c h); }
    &:active { transform: translateY(1px); }
  }

  .field:has(input:user-invalid) {
    & label { color: var(--color-danger); }
    & input { border-color: var(--color-danger); }
  }

  dialog {
    opacity: 0;
    transform: translateY(1rem);
    transition: opacity 200ms, transform 200ms, overlay 200ms allow-discrete, display 200ms allow-discrete;

    &[open] { opacity: 1; transform: none; }
    @starting-style { &[open] { opacity: 0; transform: translateY(1rem); } }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
}
```
Same-document view transition for a list re-order:
```js
function sortList(next) {
  if (!document.startViewTransition) return render(next); // progressive enhancement
  document.startViewTransition(() => render(next));
}
```

## Production patterns
- **Tokens for every color, space, radius, and shadow**, defined once; dark mode is a token swap.
- **`:focus-visible` with a strong custom ring**; never remove focus styles without replacing them.
- **`:has()` for state-driven styling** (invalid fields, cards with images) instead of extra JS classes.
- **Animate only transform and opacity**, keep UI transitions under ~250 ms, and honor reduced motion.
- **Feature-detect newer CSS** with `@supports (anchor-name: --a)` and keep a decent fallback.

## Mistakes
Wrong: removing focus outlines.
```css
*:focus { outline: none; }
```
Right: `:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }`

Wrong: dark mode by duplicating rules.
```css
.dark .card { background: #222; } .dark .card .title { color: #eee; } /* ...300 more */
```
Right: redefine tokens; components keep using `var(--color-*)`.

Wrong: animating layout properties.
```css
.drawer { transition: left 300ms; } /* layout on every frame: janky */
```
Right: `transform: translateX(...)`.

Wrong: hex colors scattered in components. Right: tokens, with contrast checked once per token pair.

## Check yourself
1. What is the difference between `:is()` and `:where()`?
2. Why is `oklch()` better than HSL for generating a palette?
3. How do you animate a `<dialog>` that appears from `display: none`?

<details>
<summary>Answers</summary>

1. Both match any selector in the list. `:is()` takes the specificity of its most specific argument; `:where()` always has zero specificity, so it's ideal for defaults.
2. OKLCH lightness is perceptually uniform: equal L steps look equally lighter across hues. HSL's 50% lightness yellow looks far brighter than 50% blue, so HSL palettes have uneven contrast.
3. Transition `opacity`/`transform` plus `display` and `overlay` with `allow-discrete`, and define the starting values inside `@starting-style` for the `[open]` state.
</details>

## Sources
- [MDN — `:has()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)
- [MDN — Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [MDN — `light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark)
- [MDN — `@starting-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style)
- [MDN — View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [web.dev — prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)
