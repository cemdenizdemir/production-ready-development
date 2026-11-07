---
title: Keyboard, focus, and forms
tech: HTML, React 19.2, Next.js 16
version: WCAG 2.2 AA, React 19.2
date: 2026-11-07
covers: [3, 4, 6]
---
# Keyboard, focus, and forms
[← Overview](00-overview.md)

## Why it matters
- After a client-side navigation, focus stays on the clicked link (now gone); keyboard and screen reader users are lost at the top of an unknown page.
- A form shows errors in red text only. A screen reader user submits, hears nothing, and gives up on the checkout.
- A cookie banner traps Tab inside it with no way to close it from the keyboard.

## Concepts

### Keyboard basics
| Key | Expected behavior |
|:--|:--|
| Tab / Shift+Tab | move between interactive elements in a logical order |
| Enter | activate links and buttons; submit forms |
| Space | activate buttons; toggle checkboxes |
| Arrow keys | move within composite widgets (tabs, menus, radios, listboxes) |
| Escape | close dialogs, menus, popovers |

Rules: everything clickable is focusable and operable by keyboard; focus order follows visual order (DOM order); focus is always visible (`:focus-visible`); no keyboard traps; the focused element isn't hidden behind sticky headers (WCAG 2.2 Focus Not Obscured).

| `tabindex` | Effect |
|:--|:--|
| none on native controls | focusable in DOM order |
| `0` | adds a custom element to the tab order |
| `-1` | focusable by script only (headings you move focus to, roving tabindex) |
| positive (`1`, `2`…) | never: breaks the natural order |

**Skip link:** the first focusable element, "Skip to main content", jumping to `<main id="main">`.

### Focus management in single-page apps
| Situation | Do |
|:--|:--|
| Route change | move focus to the new page's `<h1>` (with `tabIndex={-1}`) or announce the change; Next.js includes a route announcer that reads the page title |
| Open a modal | focus moves inside (first field or the dialog); background is inert; `dialog.showModal()` does this |
| Close a modal | focus returns to the element that opened it |
| Delete an item | move focus to the next item or the list heading, not `<body>` |
| Show new content after an action | focus it if the user must act on it; otherwise announce it (live region) |
| Overlays you build yourself | `inert` on the rest of the page |

### Accessible forms
| Need | Implementation |
|:--|:--|
| Label | visible `<label for>` on every field |
| Instructions | before the field, linked with `aria-describedby` |
| Required | `required` attribute (and a visible indicator explained once) |
| Error message | text next to the field, linked with `aria-describedby`; field gets `aria-invalid="true"` |
| On submit with errors | focus the first invalid field, or an error summary listing links to each field |
| Groups | `<fieldset>` + `<legend>` for radio groups and related fields |
| Autocomplete | `autocomplete` tokens (helps motor and cognitive disabilities) |
| Don't rely on color | icon or text "Error:" alongside red |
| Accessible authentication | allow paste and password managers; no cognitive puzzles without alternatives (WCAG 2.2) |

## Example
`SkipLink` and route focus in a layout:
```tsx
// app/layout.tsx (excerpt)
<body>
  <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:p-2">
    Skip to main content
  </a>
  <Header />
  <main id="main" tabIndex={-1}>{children}</main>
</body>
```
```tsx
// components/PageHeading.tsx — focus the heading after client-side navigation
'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function PageHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const pathname = usePathname();
  useEffect(() => { ref.current?.focus(); }, [pathname]);
  return <h1 ref={ref} tabIndex={-1} className="outline-none">{children}</h1>;
}
```
`EmailField.tsx` — errors that everyone gets.
```tsx
import { useId } from 'react';

export function EmailField({ error }: { error?: string }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id}>Email</label>
      <p id={hintId}>We send the receipt here.</p>
      <input
        id={id}
        name="email"
        type="email"
        autoComplete="email"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
      />
      {error && <p id={errorId} className="text-red-700">Error: {error}</p>}
    </div>
  );
}
```
Focus the first error on submit:
```tsx
function onInvalidSubmit(form: HTMLFormElement) {
  form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}
```
React Hook Form does this by default (`shouldFocusError: true`, see [10-forms](../../10-forms/README.md)).

## Production patterns
- **Unplug the mouse once per feature**: complete the main flow with Tab, Enter, Space, arrows, and Escape.
- **Visible focus everywhere**, styled by the design system, at least 2 px and good contrast.
- **Native `<dialog>` for modals** (focus trap, Escape, inert background, focus return for free).
- **Error handling designed for screen readers**: linked messages, `aria-invalid`, focus moved to the problem.
- **Sticky headers with `scroll-padding-top`** so focused elements aren't hidden underneath.

## Mistakes
Wrong: removing focus outlines. Right: `:focus-visible` with a clear custom style.

Wrong: positive tabindex to "fix" order.
```html
<input tabindex="3"><input tabindex="1"><button tabindex="2">
```
Right: fix the DOM order to match the visual order.

Wrong: errors announced by color only.
```tsx
<input className={error ? 'border-red-500' : ''} />
```
Right: a text message linked by `aria-describedby`, plus `aria-invalid`.

Wrong: deleting a row and letting focus fall to `<body>`. Right: move focus to the next row or the list heading.

## Check yourself
1. When is `tabindex="-1"` useful?
2. What should happen to focus when a modal closes?
3. Which two attributes connect an input to its error message?

<details>
<summary>Answers</summary>

1. To make a non-interactive element focusable by script only: headings you move focus to after navigation, containers in roving-tabindex widgets, or `<main>` as a skip-link target.
2. It returns to the element that opened the modal, so the user continues where they were.
3. `aria-describedby` (pointing at the message's id) and `aria-invalid="true"` on the input.
</details>

## Sources
- [W3C WAI — Keyboard compatible (WCAG 2.1.1)](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)
- [W3C WAI — Focus Not Obscured (WCAG 2.4.11)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [W3C WAI — Forms tutorial](https://www.w3.org/WAI/tutorials/forms/)
- [GOV.UK Design System — Error summary](https://design-system.service.gov.uk/components/error-summary/)
- [MDN — `inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert)
