---
title: CSS cheatsheet
tech: CSS, then Tailwind CSS 4
version: CSS (Baseline 2025), Tailwind CSS 4.3
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# CSS cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Cascade
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ cascade order | origin/importance → layer → specificity → order | |
| ⭐ `@layer a, b, c;` | declare layer order | later wins |
| unlayered styles | beat layered ones | |
| `@import url(x.css) layer(vendor)` | vendor CSS in a layer | |
| specificity | (ID, class, element) | |
| `:where()` | zero specificity | base styles |
| `:is()` | highest argument's specificity | |
| `inherit` / `initial` / `unset` / `revert` / `revert-layer` | cascade keywords | |
| `!important` | flips origin order | utilities only |

## Box model
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `box-sizing: border-box` | width includes padding + border | global reset |
| margin collapse | vertical block margins merge | not in flex/grid |
| `overflow: auto / hidden / clip` | scroll / clip | `clip` has no scroll container |
| `display: contents` | box disappears, children remain | careful with a11y |
| `aspect-ratio: 16 / 9` | ratio box | media |
| `min-width: 0` | let flex/grid items shrink | long text |

## Logical properties
| Physical | Logical |
|:--|:--|
| `margin-left/right` | ⭐ `margin-inline` |
| `padding-top/bottom` | `padding-block` |
| `width` / `height` | `inline-size` / `block-size` |
| `left` | `inset-inline-start` |
| `top` | `inset-block-start` |
| `text-align: left` | `text-align: start` |

## Units and functions
| Unit | Relative to | Use |
|:--|:--|:--|
| ⭐ `rem` | root font size | type, spacing |
| `em` | element font size | component padding |
| `ch` | "0" width | `max-width: 65ch` |
| ⭐ `dvh` / `svh` / `lvh` | dynamic/small/large viewport | mobile full height |
| `vw` / `vi` | viewport width / inline | |
| `cqi` / `cqb` | container size | |
| `fr` | free grid space | |
| ⭐ `clamp(min, pref, max)` | fluid values | fluid type |
| `min()` / `max()` / `calc()` | math | |

## Flexbox
| Property | Does | Note |
|:--|:--|:--|
| `display: flex` | one-dimensional layout | |
| ⭐ `gap` | spacing | flex and grid |
| `flex-wrap: wrap` | wrap items | |
| `justify-content` | main axis | |
| `align-items` | cross axis | |
| `flex: 1 1 12rem` | grow shrink basis | |
| `order` | visual order | keep DOM order logical |

## Grid
| Property | Does | Note |
|:--|:--|:--|
| ⭐ `repeat(auto-fit, minmax(min(15rem,100%), 1fr))` | responsive columns, no media query | |
| `grid-template-columns` / `rows` | tracks | |
| `grid-template-areas` | named areas | |
| `grid-column: span 2` | spanning | |
| `auto-fill` | keep empty tracks | |
| subgrid | inherit parent tracks | align card internals |
| `place-items` / `place-content` | alignment shorthand | |

## Responsive
| Tool | Responds to | Note |
|:--|:--|:--|
| ⭐ `@media (width >= 48rem)` | viewport | range syntax |
| ⭐ `container-type: inline-size` + `@container (inline-size > 30rem)` | container | components |
| `@container name (…)` | named container | |
| `prefers-color-scheme` | dark/light | |
| ⭐ `prefers-reduced-motion` | motion | |
| `prefers-contrast` | high contrast | |
| `hover` / `pointer` media features | input type | touch vs mouse |
| intrinsic layout | content and space | first choice |

## Positioning and stacking
| Item | Does | Note |
|:--|:--|:--|
| `relative` / `absolute` / `fixed` / `sticky` | positioning | |
| `inset: 0` | all four offsets | |
| ⭐ stacking context | z-index scope | opacity, transform, filter, isolation… |
| ⭐ `isolation: isolate` | contain z-index | components |
| z-index tokens | `--z-header`, `--z-drawer` | |
| ⭐ top layer | `<dialog>`, `popover` | above everything |
| `transform` on ancestor | breaks `fixed` | |

## Selectors
| Selector | Does | Note |
|:--|:--|:--|
| ⭐ `:has()` | relational | parent styling |
| ⭐ `:focus-visible` | keyboard focus | |
| `:focus-within` | contains focus | |
| `:user-invalid` / `:user-valid` | after interaction | forms |
| `:is()` / `:where()` | lists | |
| `:not(a, b)` | negation | |
| `:nth-child(n of .x)` | filtered nth | |
| `[data-state="open"]` | attribute | |
| `::before` / `::after` / `::marker` / `::backdrop` | pseudo-elements | |
| ⭐ nesting `&` | native nesting | |

## Tokens and color
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `--token: value` / `var(--token, fallback)` | custom properties | inherit |
| `@property --x { syntax; inherits; initial-value }` | typed property | animatable |
| ⭐ `oklch(L C H)` | perceptual color | |
| ⭐ `color-mix(in oklch, a, b 20%)` | mix colors | hover shades |
| ⭐ `light-dark(a, b)` + `color-scheme` | theme values | |
| relative color `oklch(from x l c h)` | derive colors | |
| token tiers | primitive → semantic → component | |
| `currentColor` | text color | icons |

## Motion
| Item | Does | Note |
|:--|:--|:--|
| `transition` | animate state changes | |
| `@keyframes` + `animation` | sequences | |
| ⭐ animate `transform`/`opacity` | compositor-friendly | |
| ⭐ `@starting-style` | entry transitions | dialogs, popovers |
| `transition-behavior: allow-discrete` | transition `display` | |
| `view-transition-name` | shared element transitions | |
| `document.startViewTransition()` | same-document transitions | |
| `scroll-behavior: smooth` | smooth scroll | off for reduced motion |

## Tailwind CSS 4
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `@import "tailwindcss"` | entry | v4 |
| ⭐ `@theme { --color-x: … }` | tokens → utilities | also CSS vars |
| `@utility name { … }` | custom utility | |
| `@custom-variant` / `@variant` | variants | dark mode class |
| `@source "../packages"` | extra scan paths | |
| `@config` | load legacy JS config | migration only |
| `@tailwindcss/postcss` | Next.js integration | |
| `@tailwindcss/vite` | Vite integration | |
| ⭐ `hover:` `focus-visible:` `disabled:` `aria-*:` `data-*:` | state variants | |
| ⭐ `md:` | min-width breakpoint | mobile-first |
| ⭐ `@container` + `@md:` | container queries | built in |
| `dark:` | dark variant | |
| `group-*` / `peer-*` | parent/sibling state | |
| `w-[37rem]` / `bg-(--x)` | arbitrary values / var shorthand | sparingly |
| `p-0!` | important | |
| `starting:` | `@starting-style` | |
| `not-*` / `in-*` / `has-*` | logical variants | |

## Composition and architecture
| Item | Does | Note |
|:--|:--|:--|
| ⭐ React component per pattern | the abstraction | not `@apply` |
| `cva` | variant classes | also seen |
| `tailwind-merge` | resolve conflicting classes | |
| `clsx` | conditional classes | |
| `prettier-plugin-tailwindcss` | sort classes | |
| CSS Modules | rare custom CSS | scoped |
| semantic token names | `brand`, `surface`, `danger` | |
| vendor CSS in low layer | predictable overrides | |

## Performance
| Item | Does | Note |
|:--|:--|:--|
| render-blocking CSS | delays first paint | keep small |
| ⭐ `content-visibility: auto` | skip off-screen rendering | + `contain-intrinsic-size` |
| `contain: layout paint` | limit work | |
| `will-change` | promote layer | only during animation |
| ⭐ `transform`/`opacity` animations | no layout | |
| layout thrashing | read/write loops | batch reads |
| per-route CSS | Next.js splits | watch sizes |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `outline: none` | invisible focus | `:focus-visible` ring |
| `100vh` on mobile | URL bar overlap | `dvh` / `svh` |
| `z-index: 99999` | still wrong context | fix stacking context |
| fixed widths | overflow on phones | `minmax(min(…,100%),1fr)` |
| v3 `tailwind.config.js` in v4 | ignored | `@theme` |
| `@apply` everywhere | hidden duplication | components |
| px font sizes | ignores user setting | `rem` |
| `display: contents` on buttons/lists | semantics lost in some cases | test a11y tree |

## Sources
| Source | Link |
|:--|:--|
| MDN CSS | https://developer.mozilla.org/docs/Web/CSS |
| web.dev Learn CSS | https://web.dev/learn/css |
| Cascade layers | https://developer.mozilla.org/docs/Learn_web_development/Core/Styling_basics/Cascade_layers |
| Container queries | https://developer.mozilla.org/docs/Web/CSS/CSS_containment/Container_queries |
| Stacking context | https://developer.mozilla.org/docs/Web/CSS/CSS_positioned_layout/Stacking_context |
| Tailwind CSS docs | https://tailwindcss.com/docs |
| Tailwind v4 upgrade | https://tailwindcss.com/docs/upgrade-guide |
| Baseline | https://web.dev/baseline |
