---
title: ARIA, custom components, and visual design
tech: WAI-ARIA 1.2, React 19.2, CSS
version: WAI-ARIA 1.2 + APG, WCAG 2.2 AA
date: 2026-11-09
covers: [5, 7, 9]
---
# ARIA, custom components, and visual design
[← Overview](00-overview.md)

## Why it matters
- `role="button"` is added to a `<div>` but no keyboard handler; the "button" can't be activated with Enter or Space.
- "Added to cart" appears as a small toast; screen reader users never hear it and add the item three times.
- Light grey text on white (2.1:1) looks elegant in the design file and is unreadable outdoors on a phone.

## Concepts

### The rules of ARIA
1. **Use native HTML** if an element with the semantics and behavior exists.
2. Don't change native semantics (`<h2 role="tab">`) unless you must.
3. All interactive ARIA controls must be keyboard operable.
4. Don't use `role="presentation"`/`aria-hidden="true"` on focusable elements.
5. Interactive elements must have an accessible name.

No ARIA is better than bad ARIA. ARIA changes what assistive tech is told; it adds no behavior.

### Attributes you'll actually use
| Attribute | Use |
|:--|:--|
| `aria-label` / `aria-labelledby` | name when there's no visible label element |
| `aria-describedby` | hints, errors |
| `aria-expanded` | disclosure buttons, menus, comboboxes |
| `aria-controls` | element controlled by this button |
| `aria-current="page"` | current item in navigation/breadcrumbs |
| `aria-invalid` | invalid field |
| `aria-hidden="true"` | hide decorative content from AT |
| `aria-busy` | region updating |
| `aria-live="polite"` / `role="status"` | announce non-urgent updates |
| `role="alert"` (assertive) | urgent errors only |

Live regions must exist in the DOM **before** the message is inserted; then changes to their text are announced.

### Custom components (APG patterns)
| Component | Native first? | If custom: key behavior |
|:--|:--|:--|
| disclosure | `<details>` | Enter/Space toggles, `aria-expanded` |
| modal dialog | `<dialog>.showModal()` | focus in, Escape closes, focus returns |
| menu button | `popover` + buttons, or a library | arrows move, Escape closes |
| tabs | none native | `tablist`/`tab`/`tabpanel`, arrow keys, roving `tabindex` |
| combobox / autocomplete | `<datalist>` for simple cases | `role="combobox"`, `aria-activedescendant`, listbox, arrows/Enter/Escape |
| carousel | avoid | pause, buttons, no auto-advance |

Use a headless library that implements APG correctly (React Aria, Radix UI, Ariakit) instead of building complex widgets yourself.

### Visual design
| Requirement | Level | Rule |
|:--|:--|:--|
| ⭐ text contrast | AA | 4.5:1 (normal), 3:1 (large ≥ 24 px or 18.66 px bold) |
| non-text contrast | AA | 3:1 for UI component boundaries, focus indicators, icons that convey meaning |
| use of color | A | not the only way to convey info (errors, required, links in text) |
| ⭐ resize text | AA | 200% zoom without loss |
| ⭐ reflow | AA | 320 CSS px wide (400% zoom) without horizontal scroll |
| text spacing | AA | works with increased line/letter/word spacing |
| target size (2.2) | AA | ≥ 24×24 CSS px (or enough spacing) |
| motion | AAA / best practice | respect `prefers-reduced-motion`; no flashing > 3/s (A) |

## Example
`web/src/components/ui/LiveAnnouncer.tsx`
```tsx
"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<(msg: string) => void>(() => {});

export function LiveAnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const announce = useCallback((msg: string) => {
    setMessage("");
    requestAnimationFrame(() => setMessage(msg));      // re-announce identical messages
  }, []);
  return (
    <Ctx.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">{message}</div>
    </Ctx.Provider>
  );
}
export const useAnnounce = () => useContext(Ctx);
```
Usage after a successful mutation: `announce(\`${product.name} added to cart. Cart has ${count} items.\`)`.

`web/src/components/ui/Disclosure.tsx` (when `<details>` can't be styled as needed)
```tsx
"use client";
import { useId, useState, type ReactNode } from "react";

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{title}</button>
      <div id={id} hidden={!open}>{children}</div>
    </div>
  );
}
```

## Production patterns
- Headless, APG-compliant primitives for complex widgets; style them with Tailwind.
- One app-wide polite live region for status messages (added to cart, saved, copied).
- Design tokens checked for contrast in light and dark themes before they ship.
- Test at 320 px width and 400% zoom; fix horizontal scrolling (except data tables and maps).

## Mistakes
Wrong:
```tsx
<div role="button" onClick={save}>Save</div>           // no keyboard, no focus
```
Right: `<button type="button" onClick={save}>Save</button>`.

Wrong: `role="alert"` for "Saved".
Right: `role="status"` (polite); reserve alerts for errors that need immediate attention.

## Check yourself
1. What is the first rule of ARIA?
2. Why must a live region exist before its message changes?
3. What contrast does a focus indicator need?

<details><summary>Answers</summary>

1. Don't use ARIA if a native HTML element or attribute provides the semantics and behavior you need.
2. Screen readers watch existing live regions for changes; a region inserted together with its text is often not announced.
3. At least 3:1 against adjacent colors (non-text contrast).
</details>

## Sources
- [WAI — Using ARIA (rules)](https://www.w3.org/TR/using-aria/)
- [ARIA Authoring Practices Guide — Patterns](https://www.w3.org/WAI/ARIA/apg/patterns/)
- [MDN — ARIA live regions](https://developer.mozilla.org/docs/Web/Accessibility/ARIA/Guides/Live_regions)
- [WCAG 2.2 — Contrast (minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [React Aria](https://react-spectrum.adobe.com/react-aria/) · [Radix UI](https://www.radix-ui.com/primitives)
