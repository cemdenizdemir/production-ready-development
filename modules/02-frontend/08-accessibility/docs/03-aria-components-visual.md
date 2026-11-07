---
title: ARIA, custom components, and visual design
tech: HTML, React 19.2, CSS
version: WAI-ARIA 1.2, ARIA Authoring Practices Guide, WCAG 2.2 AA
date: 2026-11-07
covers: [5, 7, 9]
---
# ARIA, custom components, and visual design
[← Overview](00-overview.md)

## Why it matters
- `role="button"` is added to a `<div>`, but it doesn't respond to Enter or Space. ARIA promised a button; the keyboard got nothing.
- A "Saved" confirmation appears visually, but screen reader users never hear it; they save three more times.
- Light gray placeholder-style text (2.3:1 contrast) is used for prices; many users over 50 can't read it in daylight.

## Concepts

### Rules of ARIA use
1. **Use native HTML** when an element with the semantics and behavior exists (`<button>`, `<dialog>`, `<details>`, `<input type="checkbox">`).
2. **Don't change native semantics** unless you must (`<h2 role="tab">` is wrong).
3. **All interactive ARIA controls must be keyboard operable.** ARIA changes what is announced, not how it behaves.
4. **Don't hide focusable elements** with `aria-hidden="true"` or `role="presentation"`.
5. **Interactive elements need an accessible name.**

No ARIA is better than bad ARIA: pages with ARIA average more accessibility errors, because it's easy to promise behavior you don't implement.

### ARIA you'll actually use
| Attribute | Use |
|:--|:--|
| `aria-label` / `aria-labelledby` | name an element (icon buttons, regions, dialogs) |
| `aria-describedby` | extra description (hints, errors) |
| `aria-expanded` | disclosure/menu open state on the trigger |
| `aria-controls` | the element a trigger controls |
| `aria-current="page"` | current item in navigation |
| `aria-pressed` | toggle buttons |
| `aria-selected` | selected tab or option |
| `aria-invalid` | invalid field |
| `aria-hidden="true"` | hide decorative content from assistive tech |
| `aria-live="polite"` / `role="status"` | announce updates without moving focus |
| `role="alert"` | announce urgent updates immediately |
| `aria-busy` | region is updating |
| `aria-modal="true"` | custom modal dialogs (native `<dialog>` handles it) |

Live regions must exist in the DOM **before** their content changes; inserting a region with text already inside is often not announced.

### Custom components: follow the APG
The ARIA Authoring Practices Guide (APG) defines roles, states, and keyboard behavior for common widgets.

| Widget | Key behavior |
|:--|:--|
| Disclosure (show/hide) | button with `aria-expanded`; Enter/Space toggles. Prefer `<details>` |
| Modal dialog | focus inside, Tab trapped, Escape closes, focus returns. Prefer `<dialog>` |
| Menu button | Enter/Space/Down opens; arrows move; Escape closes. Most "menus" are really navigation lists or popovers |
| Tabs | `tablist`/`tab`/`tabpanel`; arrow keys move between tabs (roving tabindex); Tab moves into the panel |
| Combobox (autocomplete) | input with `role="combobox"`, `aria-expanded`, listbox of options, `aria-activedescendant` for the highlighted option |
| Tooltip | shows on hover **and** focus; Escape dismisses; never holds essential info or interactive content |

Prefer a well-tested headless library over building these from scratch (also seen: React Aria, Radix UI, Headless UI); verify its keyboard behavior anyway.

### Visual design
| Requirement | Level | Detail |
|:--|:--|:--|
| Text contrast | AA | 4.5:1; large text (24 px, or 18.7 px bold) 3:1 |
| Non-text contrast | AA | UI component boundaries, icons, focus indicators 3:1 |
| Don't use color alone | A | add text, icons, or patterns |
| Resize text to 200% | AA | no loss of content or function |
| Reflow at 320 px wide | AA | no horizontal scrolling for text (400% zoom) |
| Text spacing | AA | layouts survive increased line/letter/word spacing |
| Target size | AA | at least 24×24 CSS px (or enough spacing) |
| Motion | AAA (but do it) | honor `prefers-reduced-motion`; nothing flashes more than 3 times per second |

## Example
`useAnnouncer.tsx` — one polite live region for the whole app.
```tsx
'use client';
import { createContext, use, useState, type ReactNode } from 'react';

const AnnounceContext = createContext<(message: string) => void>(() => {});

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  function announce(text: string) {
    setMessage('');
    requestAnimationFrame(() => setMessage(text)); // clear first so repeated messages are announced
  }
  return (
    <AnnounceContext value={announce}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">{message}</div> {/* always in the DOM */}
    </AnnounceContext>
  );
}

export const useAnnounce = () => use(AnnounceContext);

// usage after a save: const announce = useAnnounce(); announce('Address saved');
```
`Tabs.tsx` keyboard handling (roving tabindex), extending the compound component from [04-framework lesson 03](../../04-framework/docs/03-composition-structure-errors.md):
```tsx
function onTabListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === 'ArrowRight' ? (index + 1) % tabs.length :
    event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length :
    event.key === 'Home' ? 0 :
    event.key === 'End' ? tabs.length - 1 : -1;
  if (next === -1) return;
  event.preventDefault();
  tabs[next]!.focus();
  tabs[next]!.click(); // automatic activation; manual activation would wait for Enter/Space
}

// each tab: tabIndex={selected ? 0 : -1} so only the active tab is in the Tab order
```
Contrast-safe tokens and reduced motion:
```css
:root {
  --text: oklch(25% 0.02 255);      /* ~12:1 on white */
  --text-muted: oklch(45% 0.02 255); /* ~5.6:1 on white: still AA */
}
@media (prefers-reduced-motion: reduce) {
  .carousel { scroll-behavior: auto; }
  .toast { animation: none; }
}
```

## Production patterns
- **Native elements first, APG patterns for the rest**, ideally via a tested headless library.
- **One app-level live region** for status messages (saved, deleted, filters applied); `role="alert"` only for urgent errors.
- **Contrast is a token property**: check every text/background token pair once in the design system.
- **Test at 200% and 400% zoom** and with Windows high contrast (`forced-colors`).
- **No information in tooltips only**; tooltips must work on focus and touch.

## Mistakes
Wrong: ARIA without behavior.
```tsx
<div role="button" onClick={save}>Save</div> {/* not focusable, no Enter/Space */}
```
Right: `<button type="button" onClick={save}>Save</button>`.

Wrong: `aria-hidden="true"` on a container with focusable links. Keyboard users land on invisible items.
Right: hide with `hidden`/`inert`, or don't hide.

Wrong: a live region mounted together with its message.
```tsx
{saved && <div role="status">Saved</div>} // often not announced
```
Right: keep the region mounted; change its text.

Wrong: gray-on-gray text that fails 4.5:1 "because it looks elegant". Right: adjust tokens until they pass.

## Check yourself
1. What is the first rule of ARIA?
2. Why must a live region exist before its content changes?
3. How should Tab and arrow keys behave in a tabs widget?

<details>
<summary>Answers</summary>

1. Use a native HTML element with the needed semantics and behavior instead of adding ARIA to something else.
2. Screen readers watch existing live regions for changes; a region inserted with content already in it often isn't registered in time, so nothing is announced.
3. Tab moves focus into the tab list (to the active tab) and then out to the panel; arrow keys move between tabs (with Home/End for first/last). Only the active tab is in the Tab order (roving tabindex).
</details>

## Sources
- [W3C — Using ARIA (rules of ARIA use)](https://www.w3.org/TR/using-aria/)
- [W3C — APG patterns](https://www.w3.org/WAI/ARIA/apg/patterns/)
- [MDN — ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
- [W3C WAI — Understanding Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WebAIM — The WebAIM Million](https://webaim.org/projects/million/)
