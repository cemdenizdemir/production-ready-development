---
title: Accessibility cheatsheet
tech: HTML, React 19.2, axe-core, Playwright
version: WCAG 2.2 AA, WAI-ARIA 1.2 + APG, axe-core 4.x, Playwright 1.5x, React 19.2
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Accessibility cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Standards and law
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ WCAG 2.2 AA | target conformance level | POUR principles |
| A / AA / AAA | levels | AA is the legal norm |
| EAA | EU accessibility act | e-commerce since 2025-06-28 |
| EN 301 549 | EU standard | maps to WCAG 2.1 AA |
| ADA / Section 508 | US | lawsuits, procurement |
| WAI-ARIA 1.2 | ARIA spec | |
| APG | widget patterns | keyboard models |

## Accessibility tree
| Part | Source | Note |
|:--|:--|:--|
| ⭐ role | element or `role` | |
| ⭐ name | label, content, `alt`, `aria-label(ledby)` | include visible text |
| description | `aria-describedby` | hints, errors |
| states | `disabled`, `checked`, `aria-expanded`, `aria-current` | |
| DevTools Accessibility pane | computed values | |

## Images and media
| Kind | Rule | Note |
|:--|:--|:--|
| ⭐ informative | descriptive `alt` | from product data |
| functional | describe action/destination | logo link |
| ⭐ decorative | `alt=""` / `aria-hidden` | |
| complex | short alt + long description | charts |
| ⭐ icon-only button | `aria-label` | contextual ("Remove X") |
| icons next to text | `aria-hidden="true"` | |
| video | captions | |
| audio | transcript | |
| autoplay | none with sound | pause controls |

## Keyboard
| Key | Does | Note |
|:--|:--|:--|
| Tab / Shift+Tab | next / previous focusable | |
| Enter | activate link/button | |
| Space | activate button, toggle checkbox | |
| Escape | close overlay | |
| Arrow keys | move within composite widgets | tabs, menus, radios |
| Home / End | first / last item | |
| ⭐ `tabindex="0"` / `"-1"` | focusable / script-focusable | never positive |
| ⭐ skip link | first focusable | `#main` |
| `scroll-padding-block-start` | keep focus visible under sticky header | WCAG 2.4.11 |

## Focus management
| Situation | Focus goes to | Note |
|:--|:--|:--|
| route change (complex flows) | `<h1 tabIndex={-1}>` | |
| ⭐ dialog open | first control | `showModal()` |
| ⭐ dialog close | opener | |
| item deleted | next item / heading | |
| form submit with errors | summary or first invalid | |
| async content loads | don't steal; announce | live region |

## Forms
| Requirement | How | Note |
|:--|:--|:--|
| ⭐ visible label | `<label htmlFor>` | |
| groups | `<fieldset><legend>` | radios |
| ⭐ error text | next to field + `aria-describedby` | |
| ⭐ `aria-invalid="true"` | invalid state | |
| error summary | links to fields | long forms |
| required | text + `required` | |
| not color alone | icon + text | |
| autocomplete | tokens | |
| redundant entry | reuse earlier data | WCAG 2.2 |
| accessible auth | paste allowed, no puzzles | WCAG 2.2 |

## ARIA
| Item | Use | Note |
|:--|:--|:--|
| ⭐ first rule | native HTML first | |
| `aria-label` / `aria-labelledby` | names | |
| `aria-describedby` | descriptions | |
| `aria-expanded` + `aria-controls` | disclosure | |
| `aria-current="page"` | current nav item | |
| `aria-hidden="true"` | hide from AT | never on focusables |
| ⭐ `role="status"` / `aria-live="polite"` | announcements | exists before message |
| `role="alert"` | urgent errors | assertive |
| `aria-busy` | updating region | |
| `aria-activedescendant` | combobox active option | |

## Components (APG)
| Component | Native option | Note |
|:--|:--|:--|
| disclosure | `<details>` | |
| ⭐ modal | `<dialog>.showModal()` | |
| menu | `popover` / library | arrows, Escape |
| tabs | — | roving tabindex |
| combobox | `<datalist>` / library | complex |
| carousel | avoid | pause, no auto-advance |
| headless libraries | React Aria, Radix, Ariakit | APG-compliant |

## Visual
| Rule | Value | Note |
|:--|:--|:--|
| ⭐ text contrast | 4.5:1 (large 3:1) | AA |
| non-text contrast | 3:1 | borders, icons, focus |
| ⭐ resize | 200% | |
| ⭐ reflow | 320 CSS px, no horizontal scroll | 400% zoom |
| text spacing | survive increased spacing | |
| target size | ≥ 24×24 px | WCAG 2.2 |
| flashing | ≤ 3 per second | |
| reduced motion | respect preference | |
| color alone | never the only signal | |

## Automated testing
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ `@axe-core/playwright` | page scans in E2E | |
| `.withTags([...wcag22aa])` | rule sets | |
| `.exclude(selector)` | skip third parties | track them |
| fail on serious/critical | CI gate | |
| `eslint-plugin-jsx-a11y` | lint JSX | |
| ⭐ `getByRole(role, { name })` | tests as AT sees | Testing Library / Playwright |
| Lighthouse a11y | audit | |
| ~30–40% coverage | automated limit | manual needed |

## Manual testing
| Pass | How | Note |
|:--|:--|:--|
| ⭐ keyboard only | main flows | |
| NVDA (Windows) | `H` headings, `D` landmarks, `F` fields, `Insert+F7` list | Firefox/Chrome |
| VoiceOver (macOS/iOS) | `VO` keys, rotor | Safari |
| TalkBack (Android) | swipe navigation | |
| zoom 200%/400% | reflow | |
| Windows high contrast | forced colors | `forced-colors` media |
| voice control | "click …" | label in name |

## Process
| Practice | Where | Note |
|:--|:--|:--|
| ⭐ Definition of Done | tickets | axe + keyboard |
| PR checklist | reviews | |
| design annotations | headings, focus, order | |
| contrast-checked tokens | design system | |
| alt/captions in content workflow | admin | API fields |
| accessibility statement | public page | EAA |
| periodic audit | top journeys | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `<div onClick>` | no keyboard/role | `<button>` |
| `role="button"` only | no behavior | native button |
| "Remove" × 10 | ambiguous names | contextual names |
| live region added with message | not announced | pre-render region |
| `role="alert"` for success | interrupts | `role="status"` |
| positive tabindex | broken order | DOM order |
| focus lost after delete/close | users lost | manage focus |
| axe-only testing | misses most issues | manual passes |
| light grey text | unreadable | 4.5:1 |

## Sources
| Source | Link |
|:--|:--|
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ |
| Understanding WCAG 2.2 | https://www.w3.org/WAI/WCAG22/Understanding/ |
| APG patterns | https://www.w3.org/WAI/ARIA/apg/patterns/ |
| Using ARIA | https://www.w3.org/TR/using-aria/ |
| WAI tutorials | https://www.w3.org/WAI/tutorials/ |
| axe-core | https://github.com/dequelabs/axe-core |
| Playwright a11y testing | https://playwright.dev/docs/accessibility-testing |
| NVDA guide | https://www.nvaccess.org/files/nvda/documentation/userGuide.html |
