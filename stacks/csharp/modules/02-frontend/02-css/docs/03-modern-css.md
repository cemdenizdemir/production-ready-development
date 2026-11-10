---
title: Modern selectors, tokens and color, motion
tech: CSS
version: CSS (Baseline 2025)
date: 2026-11-09
covers: [5, 6, 8]
---
# Modern selectors, tokens and color, motion
[← Overview](00-overview.md)

## Why it matters
- Focus rings are removed with `outline: none` because they "look ugly" on mouse click; keyboard users can't see where they are.
- Brand colors are hardcoded hex values in 140 places; the rebrand takes three weeks and dark mode never ships.
- A parallax hero makes some users physically sick; nobody checked `prefers-reduced-motion`.

## Concepts

### Modern selectors
| Selector | Does | Example |
|:--|:--|:--|
| ⭐ `:has()` | parent/relational selector | `.field:has(input:invalid)` style the whole field |
| `:is()` | match any; takes highest specificity | `:is(h1, h2, h3) { text-wrap: balance; }` |
| `:where()` | match any; zero specificity | base styles that are easy to override |
| ⭐ `:focus-visible` | focus shown for keyboard, not mouse clicks | focus rings |
| `:focus-within` | element contains focus | highlight a form group |
| `:user-invalid` | invalid after user interaction | no red fields on page load |
| `:not()` | negation (selector lists) | `li:not(:last-child)` |
| `:nth-child(2 of .item)` | nth among matches | |
| native nesting | `.card { & h2 { … } &:hover { … } }` | no preprocessor |

### Custom properties and design tokens
```css
:root {
  --color-bg: light-dark(oklch(99% 0.005 80), oklch(18% 0.01 80));
  --color-text: light-dark(oklch(22% 0.02 60), oklch(94% 0.01 80));
  --color-brand: oklch(55% 0.13 45);
  --color-brand-hover: color-mix(in oklch, var(--color-brand), black 15%);
  --radius-md: .75rem;
  --space-3: .75rem;
  color-scheme: light dark;
}
```
| Feature | Why |
|:--|:--|
| custom properties (`--x`) | runtime tokens; inherit; can change per theme or component |
| `@property` | typed, animatable custom properties |
| ⭐ `oklch()` | perceptually uniform: same lightness looks the same across hues; easier palettes and contrast |
| `color-mix()` | hover/active shades from one token |
| ⭐ `light-dark()` + `color-scheme` | light/dark values in one declaration |
| relative colors | `oklch(from var(--brand) calc(l + .1) c h)` |

Tokens have tiers: primitive (`--coffee-600`), semantic (`--color-brand`), component (`--button-bg`). Components use semantic tokens only.

### Motion
| Feature | Use |
|:--|:--|
| `transition: opacity .2s, transform .2s` | state changes; animate `transform`/`opacity` (compositor-friendly) |
| `@keyframes` + `animation` | loops, entrances |
| ⭐ `@media (prefers-reduced-motion: reduce)` | remove or reduce motion |
| `@starting-style` | entry transitions from `display: none` (dialogs, popovers) |
| `transition-behavior: allow-discrete` | transition `display` and `overlay` |
| View Transitions (`document.startViewTransition`, `view-transition-name`) | animated page/state changes |

## Example
`app/components.css`
```css
.field:has(input:user-invalid) .field__label { color: var(--color-danger); }

:where(button, a, input, select, textarea):focus-visible {
  outline: 3px solid var(--color-focus, oklch(60% 0.2 250));
  outline-offset: 2px;
}

.btn {
  background: var(--color-brand);
  color: white;
  border-radius: var(--radius-md);
  transition: background-color .15s ease;
  &:hover { background: var(--color-brand-hover); }
}

dialog {
  opacity: 1; translate: 0 0;
  transition: opacity .2s, translate .2s, display .2s allow-discrete, overlay .2s allow-discrete;
  @starting-style { opacity: 0; translate: 0 1rem; }
}
dialog:not([open]) { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```

## Production patterns
- Never remove focus outlines; style them with `:focus-visible` and check contrast (3:1 against the background).
- All colors through semantic tokens; dark mode is a token swap, not a second stylesheet.
- Animate `transform` and `opacity`; avoid animating `width`, `top`, `box-shadow` on large areas.
- Respect `prefers-reduced-motion` globally, then add essential motion back deliberately.

## Mistakes
Wrong:
```css
*:focus { outline: none; }
```
Right: `:focus-visible` styles with a clear, high-contrast ring.

Wrong: hex colors in components (`color: #7c2d12`).
Right: `color: var(--color-brand)`.

## Check yourself
1. What is the difference between `:focus` and `:focus-visible`?
2. Why is `oklch()` handy for building a palette?
3. What does `@starting-style` solve?

<details><summary>Answers</summary>

1. `:focus` matches any focused element; `:focus-visible` matches when the browser decides a focus indicator should show (typically keyboard), so mouse clicks don't show rings.
2. Its lightness is perceptual, so shades with equal L look equally light across hues, making consistent scales and contrast easier.
3. Transitions for elements entering from `display: none` (or first render), which previously had no "before" state to transition from.
</details>

## Sources
- [MDN — :has()](https://developer.mozilla.org/docs/Web/CSS/:has)
- [MDN — :focus-visible](https://developer.mozilla.org/docs/Web/CSS/:focus-visible)
- [MDN — oklch()](https://developer.mozilla.org/docs/Web/CSS/color_value/oklch)
- [MDN — light-dark()](https://developer.mozilla.org/docs/Web/CSS/color_value/light-dark)
- [MDN — @starting-style](https://developer.mozilla.org/docs/Web/CSS/@starting-style)
- [MDN — View Transition API](https://developer.mozilla.org/docs/Web/API/View_Transition_API)
