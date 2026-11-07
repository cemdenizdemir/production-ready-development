---
title: CSS cheatsheet
tech: CSS, then Tailwind CSS 4
version: CSS (Baseline 2025), Tailwind CSS 4.3
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# CSS cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Cascade and specificity
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Cascade order | origin/importance → layers → specificity → order | |
| ⭐ `@layer a, b, c;` | declare layer order (last wins) | unlayered beats layered |
| `@import url() layer(x)` | import into a layer | vendor CSS |
| ⭐ Specificity | (IDs, classes/attrs/pseudo-classes, elements) | inline beats selectors |
| ⭐ `:where()` | zero specificity | overridable defaults |
| `:is()` | specificity of most specific argument | |
| `!important` | reverses layer order for important rules | last resort |
| `inherit` / `initial` / `unset` / `revert` / `revert-layer` | reset keywords | |
| `all: unset` | reset every property | |
| Inherited properties | color, font, line-height, visibility, cursor | box props don't inherit |

## Box model and sizing
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `box-sizing: border-box` | width includes padding + border | global reset |
| Margin collapsing | vertical margins merge in flow | not in flex/grid |
| ⭐ Logical properties | `margin-inline`, `padding-block`, `inset-inline-start` | RTL-safe |
| `inline-size` / `block-size` | logical width / height | |
| `min-inline-size: 0` | allow shrinking in flex/grid | truncation fix |
| `aspect-ratio: 16 / 9` | keep proportions | |
| `object-fit: cover` | crop media in a box | |
| `overflow: clip` | clip without a scroll container | doesn't break sticky |
| `overflow-wrap: anywhere` | break long words/URLs | |
| `box-decoration-break` | styles across line breaks | |

## Units and functions
| Unit / function | Use | Note |
|:--|:--|:--|
| ⭐ `rem` | type and spacing | respects user font size |
| `em` | relative to own font size | |
| `ch` | character width | `max-inline-size: 65ch` |
| ⭐ `dvh` / `svh` / `lvh` | mobile viewport heights | instead of `100vh` |
| `vw` / `vi` / `vb` | viewport units | |
| `cqi` / `cqw` | container query units | |
| `fr` | grid free-space share | |
| ⭐ `clamp(min, val, max)` | fluid with limits | fluid type |
| `min()` / `max()` | pick smaller / larger | `minmax(min(18rem, 100%), 1fr)` |
| `calc()` | math | |
| `round()` / `mod()` / `rem()` | stepped values | Baseline 2024 |
| `env(safe-area-inset-bottom)` | notch/home-indicator insets | mobile |

## Flexbox
| Property | What it does | Note |
|:--|:--|:--|
| ⭐ `display: flex` / `inline-flex` | flex container | |
| `flex-direction` | row / column (+ `-reverse`) | |
| ⭐ `justify-content` | main-axis distribution | `space-between`, `center` |
| ⭐ `align-items` | cross-axis alignment | `center`, `baseline` |
| `align-self` | one item's alignment | |
| `flex-wrap` | wrap lines | |
| ⭐ `gap` | spacing between items | |
| ⭐ `flex: 1` | grow from 0 basis | |
| `flex: none` / `flex: auto` | fixed / grow from content | |
| `order` | visual order | keep DOM order meaningful |
| `margin-inline-start: auto` | push to end | |

## Grid
| Property | What it does | Note |
|:--|:--|:--|
| ⭐ `grid-template-columns` | column tracks | `repeat(3, 1fr)` |
| ⭐ `repeat(auto-fit, minmax(16rem, 1fr))` | responsive columns, no media query | `auto-fill` keeps empty tracks |
| ⭐ `minmax(0, 1fr)` | shrinkable column | prevents blowout |
| `grid-template-areas` | named regions | |
| `grid-column: 1 / -1` | span all | |
| `grid-auto-flow: dense` | backfill gaps | visual order changes |
| `grid-auto-rows` | implicit row size | |
| ⭐ `subgrid` | inherit parent tracks | aligned card sections |
| `place-items` / `place-content` | align in both axes | |
| `justify-self` / `align-self` | one item | |
| Masonry (`grid-lanes`) | masonry layouts | emerging; not Baseline |

## Responsive design
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Mobile-first | base = small, `min-width` queries add | |
| ⭐ `@media (width >= 48rem)` | range syntax | Baseline 2023 |
| ⭐ `container-type: inline-size` | make a query container | |
| ⭐ `@container (width > 30rem)` | container size query | |
| `container-name` / `@container card (...)` | named containers | |
| `@container style(--variant: compact)` | style queries | partial support |
| `@media (hover: hover) and (pointer: fine)` | mouse-like input | |
| `@media (prefers-color-scheme: dark)` | OS theme | |
| `@media (prefers-reduced-motion: reduce)` | less motion | |
| `@media (prefers-contrast: more)` | higher contrast | |
| `@media (forced-colors: active)` | Windows high contrast | |
| `@media print` | print styles | |
| Touch target | ≥ 24×24 CSS px (WCAG 2.2 AA), ideally 44 | |

## Selectors
| Selector | Matches | Note |
|:--|:--|:--|
| ⭐ `:has(x)` | contains x | "parent selector" |
| ⭐ `:focus-visible` | keyboard-style focus | focus rings |
| `:focus-within` | contains focus | |
| `:user-invalid` / `:user-valid` | after interaction | |
| `:not(a, b)` | none of | |
| `:nth-child(2n of .x)` | filtered nth | |
| `:first-child` / `:last-child` / `:only-child` | position | |
| `:empty` | no children | |
| `:checked` / `:disabled` / `:required` / `:placeholder-shown` | form states | |
| `:target` | URL fragment target | |
| `:popover-open` / `:modal` / `[open]` | open states | |
| `::before` / `::after` | generated content | |
| `::marker` / `::placeholder` / `::selection` / `::backdrop` | element parts | |
| `[attr^="x"]` / `[attr$="x"]` / `[attr*="x"]` | attribute matching | |
| `A > B` / `A + B` / `A ~ B` | child / next / later sibling | |
| ⭐ `&` nesting | native nesting | Baseline 2023 |

## Custom properties and tokens
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `--name: value` | define (inherits) | |
| ⭐ `var(--name, fallback)` | read | |
| `@property --x { syntax; inherits; initial-value }` | typed, animatable | Baseline 2024 |
| Design token | named decision: `--color-text` | components use tokens |
| Theming | redefine tokens per theme | |
| `:root` | global token scope | |

## Color
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `oklch(L C H / a)` | perceptual color | even palettes |
| ⭐ `color-mix(in oklch, a 80%, b)` | mix colors | tints, alpha |
| Relative color `oklch(from x calc(l - .1) c h)` | derive variants | Baseline 2024 |
| ⭐ `color-scheme: light dark` | theme-aware native UI | |
| ⭐ `light-dark(a, b)` | value per scheme | Baseline 2024 |
| `currentColor` | the text color | icons, borders |
| `accent-color` | native control color | checkboxes, radios |
| Contrast | 4.5:1 text, 3:1 large text/UI | WCAG AA |

## Positioning and stacking
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `position: relative / absolute / fixed / sticky` | positioning schemes | |
| `inset: 0` | top/right/bottom/left shorthand | |
| ⭐ Stacking context | z-index scope | from transform, opacity, isolation… |
| ⭐ `isolation: isolate` | new stacking context, no side effects | components |
| Top layer | dialog/popover above everything | no z-index needed |
| Anchor positioning `anchor-name` / `position-anchor` | tooltips tied to elements | newer; check support |
| `position-try-fallbacks` | flip when out of space | with anchor positioning |
| z-index scale tokens | `--z-dropdown`, `--z-toast` | |

## Motion
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `transition` | animate state changes | property duration easing |
| `@keyframes` + `animation` | keyframe animation | |
| ⭐ Animate `transform` / `opacity` | compositor-only | smooth |
| `translate` / `rotate` / `scale` properties | individual transforms | |
| `linear()` easing | custom easing curves | springs |
| ⭐ `prefers-reduced-motion` | reduce motion | |
| ⭐ `@starting-style` | entry animation start state | Baseline 2024 |
| `transition-behavior: allow-discrete` | animate `display`, `overlay` | |
| ⭐ `document.startViewTransition()` | same-document view transitions | Baseline 2025 |
| `view-transition-name` | pair elements across states | unique per page |
| `@view-transition { navigation: auto }` | cross-document transitions | Chromium, Safari |
| Scroll-driven animations `animation-timeline: scroll()` | scroll-linked | not Baseline |
| `interpolate-size: allow-keywords` | animate to `height: auto` | Chromium |
| `will-change` | hint for upcoming animation | use sparingly |

## Typography
| Property | What it does | Note |
|:--|:--|:--|
| `font: 1rem/1.5 system-ui` | shorthand | |
| `text-wrap: balance` | balanced headings | Baseline 2024 |
| `text-wrap: pretty` | avoid orphans in paragraphs | partial |
| `hyphens: auto` | hyphenation | needs `lang` |
| `font-variant-numeric: tabular-nums` | aligned digits | tables, prices |
| `text-overflow: ellipsis` | truncate | + `overflow: hidden; white-space: nowrap` |
| `line-clamp` / `-webkit-line-clamp` | multi-line truncation | |
| `font-display: swap` | font loading behavior | in `@font-face` |
| `text-underline-offset` | link underline spacing | |

## Tailwind CSS 4
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `@import "tailwindcss";` | load Tailwind | replaces `@tailwind` directives |
| ⭐ `@theme { --color-brand-500: … }` | tokens → utilities + CSS vars | |
| `@source "../packages/ui"` | add scan paths | `@source not` excludes |
| `@utility name { … }` | custom utility | works with variants |
| `@custom-variant dark (…)` | custom variant | class-based dark mode |
| `@variant dark { … }` | apply a variant in CSS | |
| `@apply` | utilities inside CSS | sparingly |
| `@tailwindcss/vite` / `@tailwindcss/postcss` | build integrations | Vite / Next.js |
| `@tailwindcss/webpack` | webpack plugin | 4.2+ |
| ⭐ `npx @tailwindcss/upgrade` | v3 → v4 codemod | |
| Browser targets | Safari 16.4+, Chrome 111+, Firefox 128+ | |

## Tailwind variants and syntax
| Syntax | What it does | Example |
|:--|:--|:--|
| ⭐ `hover:` `focus-visible:` `active:` `disabled:` | state variants | `hover:bg-brand-600` |
| ⭐ `sm:` `md:` `lg:` `xl:` `2xl:` | min-width breakpoints | mobile-first |
| `max-md:` | below a breakpoint | |
| ⭐ `@container` + `@md:` | container queries | `@md:grid-cols-2` |
| ⭐ `dark:` | dark mode | |
| `motion-reduce:` / `motion-safe:` | reduced motion | |
| `group` + `group-hover:` / `peer` + `peer-invalid:` | parent/sibling state | |
| `has-checked:` / `has-[img]:` | `:has()` variants | |
| `aria-expanded:` / `data-[state=open]:` | ARIA / data attributes | |
| `open:` | details/dialog/popover open | |
| `starting:` | `@starting-style` | entry animations |
| `not-*` / `in-*` / `nth-*` | negation, ancestor, nth | v4 |
| `user-invalid:` / `pointer-coarse:` / `noscript:` | v4.1 variants | |
| `print:` / `forced-colors:` / `supports-[…]:` | media and support | |
| ⭐ `w-[22rem]` / `bg-(--brand)` | arbitrary value / CSS variable | v4 uses `()` for vars |
| `bg-red-500!` | important modifier | suffix in v4 |
| `size-10` | width + height | |
| `bg-linear-to-r` / `bg-radial` / `bg-conic` | gradients | renamed in v4 |
| `text-shadow-*` / `mask-*` | text shadows, masks | v4.1 |
| `pbs-*` / `mbs-*` / `inline-s-*` | logical property utilities | v4.2 |
| `scrollbar-*` / `zoom-*` | scrollbar and zoom utilities | v4.3 |

## Architecture
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Layers | reset → vendor → base → components → utilities | |
| ⭐ Tokens | shared values | single source |
| ⭐ Components own classes | React component, not `@apply` soup | |
| CSS Modules `*.module.css` | locally scoped class names | Vite, Next.js |
| `@scope (.card) to (.content)` | proximity scoping | newer |
| BEM | `.block__element--modifier` | plain CSS naming |
| Stylelint | CSS linting | also seen |
| `prettier-plugin-tailwindcss` | class sorting | also seen |
| `clsx` / `tailwind-merge` / `cva` | conditional, merged, variant classes | also seen |

## Performance
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ CSS is render-blocking | small CSS = faster paint | |
| Critical CSS inline | above-the-fold styles in HTML | frameworks do it |
| Avoid `@import` chains | sequential downloads | bundle |
| ⭐ `content-visibility: auto` | skip offscreen rendering | + `contain-intrinsic-size` |
| `contain: layout paint` | isolate rendering work | |
| ⭐ Compositor-only animation | transform, opacity | |
| Avoid layout thrash | batch DOM reads and writes | JS |
| Unused CSS | Coverage tab in DevTools | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `outline: none` | invisible focus | `:focus-visible` ring |
| `100vh` on mobile | hidden behind toolbars | `100dvh` |
| `1fr` blowout | long words overflow | `minmax(0, 1fr)` |
| Flex text won't truncate | min-width auto | `min-inline-size: 0` |
| Sticky not sticking | overflow on ancestor | `overflow: clip` or restructure |
| z-index arms race | stacking contexts | isolation, top layer |
| `!important` chains | unmaintainable | layers |
| Dynamic Tailwind class names | not generated | full class names in a map |
| Hover-only interactions | no hover on touch | tap + `(hover: hover)` |
| `html { font-size: 62.5% }` | breaks some user settings | `rem` as-is |
| Physical margins in i18n apps | wrong in RTL | logical properties |
| Animating `height`/`left` | jank | transform/opacity |

## Sources
| Source | Link |
|:--|:--|
| MDN CSS reference | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference |
| web.dev Learn CSS | https://web.dev/learn/css |
| web.dev Baseline | https://web.dev/baseline |
| CSS-Tricks Flexbox guide | https://css-tricks.com/snippets/css/a-guide-to-flexbox/ |
| CSS-Tricks Grid guide | https://css-tricks.com/snippets/css/complete-guide-grid/ |
| Tailwind CSS docs | https://tailwindcss.com/docs |
| Tailwind upgrade guide | https://tailwindcss.com/docs/upgrade-guide |
