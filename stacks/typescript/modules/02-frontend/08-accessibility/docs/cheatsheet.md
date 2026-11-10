---
title: Accessibility cheatsheet
tech: HTML, React 19.2, axe-core, Playwright
version: WCAG 2.2 AA, WAI-ARIA 1.2 + APG, axe-core 4.x, Playwright 1.5x, React 19.2
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Accessibility cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Standards and law
| Item | What it is | Note |
|:--|:--|:--|
| ⭐ WCAG 2.2 AA | the target standard | W3C Recommendation 2023 |
| POUR | Perceivable, Operable, Understandable, Robust | principles |
| Levels A / AA / AAA | conformance levels | AA is the norm |
| ⭐ European Accessibility Act | EU law for products/services | since 28 June 2025 |
| EN 301 549 | EU harmonized standard | maps to WCAG AA |
| ADA (US) | civil-rights law; lawsuits | WCAG used as benchmark |
| Section 508 | US federal procurement | |
| WCAG 3.0 | future standard | draft |
| VPAT / ACR | conformance report | B2B sales |
| Accessibility statement | public conformance + contact | EU public sector, EAA |

## WCAG 2.2 criteria to remember (AA)
| Criterion | Requirement |
|:--|:--|
| ⭐ 1.1.1 Non-text Content (A) | text alternatives |
| 1.2.2 Captions (A) | prerecorded video captions |
| 1.3.1 Info and Relationships (A) | structure in markup (headings, labels, tables) |
| ⭐ 1.4.3 Contrast (AA) | 4.5:1 text, 3:1 large text |
| 1.4.4 Resize Text (AA) | 200% without loss |
| 1.4.10 Reflow (AA) | usable at 320 CSS px wide |
| ⭐ 1.4.11 Non-text Contrast (AA) | 3:1 for UI parts, icons, focus |
| 1.4.12 Text Spacing (AA) | survives increased spacing |
| ⭐ 2.1.1 Keyboard (A) | all functionality by keyboard |
| 2.1.2 No Keyboard Trap (A) | can always tab away |
| 2.4.1 Bypass Blocks (A) | skip links / landmarks |
| 2.4.3 Focus Order (A) | logical order |
| ⭐ 2.4.7 Focus Visible (AA) | visible focus indicator |
| 2.4.11 Focus Not Obscured (AA) | focused item not hidden | 
| 2.5.3 Label in Name (A) | accessible name contains visible label |
| 2.5.7 Dragging Movements (AA) | single-pointer alternative to drag |
| ⭐ 2.5.8 Target Size (AA) | ≥ 24×24 CSS px or spacing |
| 3.3.1 Error Identification (A) | errors described in text |
| ⭐ 3.3.2 Labels or Instructions (A) | labels for inputs |
| 3.3.7 Redundant Entry (A) | don't ask for the same info twice |
| 3.3.8 Accessible Authentication (AA) | no cognitive tests; allow paste/password managers |
| ⭐ 4.1.2 Name, Role, Value (A) | custom controls expose role, name, state |
| 4.1.3 Status Messages (AA) | status announced without focus change |

## Accessible names
| Source | Priority | Example |
|:--|:--|:--|
| `aria-labelledby` | 1 (highest) | `aria-labelledby="dlg-title"` |
| `aria-label` | 2 | `aria-label="Close"` |
| Native label | 3 | `<label for>`, `alt`, `<caption>`, `<legend>` |
| Text content | 3 | `<button>Save</button>` |
| `title` / `placeholder` | last resort | unreliable |
| ⭐ Visually hidden text | `.sr-only` span | translated by browsers |
| ⭐ `aria-hidden="true"` on icons | hide decoration | icons beside text |

## Semantic elements and roles
| Element | Implicit role |
|:--|:--|
| `<button>` | button |
| `<a href>` | link |
| `<nav>` / `<main>` / `<header>` / `<footer>` / `<aside>` | navigation / main / banner / contentinfo / complementary |
| `<h1>`–`<h6>` | heading (level) |
| `<ul>` / `<ol>` / `<li>` | list / listitem |
| `<input type="checkbox">` | checkbox |
| `<select>` | combobox / listbox |
| `<dialog>` | dialog |
| `<table>` / `<th>` | table / columnheader, rowheader |
| `<img alt="">` | presentation (ignored) |
| `<section aria-label>` | region |
| `<search>` | search |

## ARIA essentials
| Attribute / role | Use | Note |
|:--|:--|:--|
| ⭐ First rule of ARIA | native HTML first | |
| ⭐ `aria-expanded` | open state on triggers | disclosures, menus |
| `aria-controls` | what the trigger controls | |
| ⭐ `aria-describedby` | hints, errors | |
| ⭐ `aria-invalid` | invalid field | |
| `aria-required` | required (native `required` preferred) | |
| ⭐ `aria-current="page"` | current nav item | |
| `aria-pressed` | toggle button | |
| `aria-selected` | selected tab/option | |
| `aria-checked` | custom checkbox/switch | |
| `aria-disabled` | disabled but focusable | discoverable disabled buttons |
| ⭐ `role="status"` / `aria-live="polite"` | polite announcements | region must pre-exist |
| `role="alert"` | urgent announcements | errors only |
| `aria-busy` | region updating | |
| `aria-modal="true"` | custom modal | native dialog handles it |
| `aria-activedescendant` | highlighted option in combobox | focus stays on input |
| `role="presentation"` / `"none"` | remove semantics | never on focusables |
| `aria-roledescription` | custom role name | use rarely |

## Keyboard
| Key | Expected |
|:--|:--|
| ⭐ Tab / Shift+Tab | next / previous focusable |
| ⭐ Enter | activate link/button, submit |
| ⭐ Space | activate button, toggle checkbox |
| ⭐ Escape | close dialog/menu/popover |
| Arrows | move within widgets (tabs, menus, radios, listbox) |
| Home / End | first / last item in widgets |
| ⭐ `tabindex="0"` | add to tab order |
| ⭐ `tabindex="-1"` | focusable by script only |
| Positive tabindex | never |
| Roving tabindex | one item in tab order per widget |
| ⭐ Skip link | "Skip to main content" first |
| `scroll-padding-top` | focused items not under sticky header |

## Focus management
| Situation | Do |
|:--|:--|
| ⭐ Route change (SPA) | focus `<h1 tabIndex={-1}>` or announce |
| ⭐ Open modal | focus inside; background inert |
| ⭐ Close modal | return focus to opener |
| Delete item | focus next item/list heading |
| Form errors | focus first invalid field or summary |
| ⭐ `inert` | remove background from focus + a11y tree |
| `dialog.showModal()` | built-in focus trap + Escape |
| `:focus-visible` | keyboard focus styling |

## Forms
| Need | Implementation |
|:--|:--|
| ⭐ Label | `<label for>` visible |
| ⭐ Error | text + `aria-describedby` + `aria-invalid` |
| Hint | `aria-describedby` |
| ⭐ Groups | `<fieldset>` + `<legend>` |
| Required | `required` + visible indicator |
| Autocomplete | `autocomplete` tokens |
| Error summary | list of links to fields, focused on submit |
| Don't use color alone | "Error:" text or icon |
| Authentication | allow paste, password managers, passkeys |

## Components (APG patterns)
| Widget | Key behavior | Native alternative |
|:--|:--|:--|
| Disclosure | button `aria-expanded`, Enter/Space | `<details>` |
| ⭐ Modal dialog | trap focus, Escape, return focus | `<dialog>` |
| Menu button | arrows, Escape, typeahead | popover + links |
| ⭐ Tabs | arrows between tabs, roving tabindex | — |
| Combobox | `role="combobox"`, listbox, `aria-activedescendant` | `<datalist>` (limited) |
| Listbox | arrows, selection | `<select>` |
| Accordion | buttons with `aria-expanded` in headings | `<details name>` |
| Tooltip | on hover and focus, Escape | — |
| Switch | `role="switch"` + `aria-checked` | checkbox |
| Carousel | pause control, labelled slides | — |
| Headless libraries | React Aria, Radix UI, Headless UI | also seen |

## Visual
| Requirement | Value |
|:--|:--|
| ⭐ Text contrast | 4.5:1 (large 3:1) |
| ⭐ UI/focus contrast | 3:1 |
| ⭐ Target size | ≥ 24×24 CSS px |
| Zoom | 200% text, reflow at 320 px |
| Motion | honor `prefers-reduced-motion` |
| Flashing | ≤ 3 per second |
| `forced-colors` | Windows high contrast support |
| Color alone | never the only signal |

## Images and media
| Content | Alternative |
|:--|:--|
| ⭐ Informative image | descriptive `alt` |
| ⭐ Decorative | `alt=""` |
| Functional (in link/button) | describe the action |
| Complex chart | short alt + data table/text |
| Icon-only button | `aria-label` on button |
| ⭐ Video | captions; audio description/transcript |
| Audio | transcript |
| Autoplay | muted, with pause control |

## Testing tools
| Tool | What it does | Note |
|:--|:--|:--|
| ⭐ `@axe-core/playwright` | axe in E2E tests | `new AxeBuilder({ page }).analyze()` |
| ⭐ `.withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa'])` | scope rules | |
| `.include()` / `.exclude()` | scope regions | third-party widgets |
| ⭐ `getByRole(role, { name })` | role-based queries | Playwright + Testing Library |
| `toHaveAccessibleName` / `toHaveAccessibleDescription` | assertions | Playwright, jest-dom |
| ⭐ `toMatchAriaSnapshot` | accessibility tree snapshot | Playwright 1.49+ |
| axe DevTools extension | manual page scans | |
| Lighthouse accessibility | quick audit | subset of axe |
| eslint-plugin-jsx-a11y | JSX lint | check ESLint 10 support |
| vitest-axe / jest-axe | axe in component tests | also seen |
| WAVE | visual checker | also seen |
| Colour Contrast Analyser | contrast checks | |

## Screen readers
| Reader | Platform | Start / key commands |
|:--|:--|:--|
| ⭐ NVDA | Windows (free) | Ctrl+Alt+N; H headings; D landmarks; Insert+F7 lists |
| JAWS | Windows (paid) | common in enterprises |
| ⭐ VoiceOver | macOS / iOS | Cmd+F5; VO+U rotor; swipe on iOS |
| TalkBack | Android | swipe, double-tap |
| Narrator | Windows | built-in |

## Process
| Practice | Effect |
|:--|:--|
| ⭐ Definition of Done | a11y checked per feature |
| ⭐ Keyboard pass per PR | catches most blockers |
| Design review | contrast, focus, targets, order |
| Design-system ownership | fix once, everywhere |
| Accessibility statement | transparency, legal |
| Audits + user testing | real-world barriers |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `<div onClick>` | no keyboard, no role | `<button>` |
| `role="button"` without keys | ARIA without behavior | native element |
| Icon buttons without names | "button" announced | `aria-label` |
| `aria-hidden` on focusables | ghost focus | `inert`/`hidden` |
| Live region added with text | not announced | pre-existing region |
| `outline: none` | invisible focus | `:focus-visible` style |
| Positive tabindex | broken order | DOM order |
| Placeholder as label | disappears | `<label>` |
| Color-only errors | not perceivable | text + `aria-invalid` |
| axe-only testing | ~half of issues missed | manual checks |
| Tooltips with essential info | unreachable on touch/keyboard | visible text |
| Name ≠ visible label | voice control fails | include label text |

## Sources
| Source | Link |
|:--|:--|
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ |
| WCAG Quick Reference | https://www.w3.org/WAI/WCAG22/quickref/ |
| ARIA Authoring Practices | https://www.w3.org/WAI/ARIA/apg/ |
| Using ARIA | https://www.w3.org/TR/using-aria/ |
| MDN Accessibility | https://developer.mozilla.org/en-US/docs/Web/Accessibility |
| axe-core rules | https://dequeuniversity.com/rules/axe/ |
| Playwright accessibility testing | https://playwright.dev/docs/accessibility-testing |
| WebAIM | https://webaim.org/ |
