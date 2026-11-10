---
title: Keyboard, focus management, and forms
tech: HTML, React 19.2, Next.js 16
version: WCAG 2.2 AA
date: 2026-11-09
covers: [3, 4, 6]
---
# Keyboard, focus management, and forms
[← Overview](00-overview.md)

## Why it matters
- After a client-side navigation, focus stays on the clicked link in the old page; screen reader users hear nothing and don't know the page changed.
- The checkout form shows "There are errors" at the top, with no link to the fields and no indication which ones; keyboard users tab through 18 fields to find them.
- A date picker can't be closed with Escape; keyboard users are trapped in it.

## Concepts

### Keyboard access
| Rule | How |
|:--|:--|
| everything works with a keyboard | native controls; custom widgets follow APG keyboard patterns |
| logical focus order | DOM order matches visual order; avoid positive `tabindex` |
| ⭐ visible focus | `:focus-visible` ring with ≥ 3:1 contrast (02-css) |
| focus not obscured (WCAG 2.2) | sticky headers/footers don't cover the focused element (`scroll-padding`) |
| skip link | "Skip to content" as the first focusable element |
| no keyboard traps | Escape closes overlays; Tab can leave components |
| `tabindex="0"` / `-1` | make focusable / focusable by script only |

### Focus management in single-page apps
| Situation | Do |
|:--|:--|
| route change | move focus to the new page's `<h1>` (or main) and announce the title; Next.js announces route changes, but setting focus is your job for complex flows |
| dialog opens | focus the first meaningful control (native `<dialog>.showModal()` does this) |
| dialog closes | return focus to the element that opened it |
| item deleted from a list | focus the next item or the list heading |
| inline error after submit | focus the error summary or the first invalid field |
| content loaded on demand | don't steal focus; announce with a live region if important |

### Accessible forms
| Requirement | How |
|:--|:--|
| ⭐ every field has a visible label | `<label htmlFor>`; group radios in `<fieldset><legend>` |
| required fields indicated | text ("required") and `required`/`aria-required` |
| instructions before the field | `aria-describedby` hint |
| ⭐ errors identified in text | message next to the field, linked with `aria-describedby`, `aria-invalid="true"` |
| error summary for long forms | list of links to fields, focused after submit |
| don't rely on color alone | icon + text |
| autocomplete | `autocomplete` tokens (01-html) |
| redundant entry (WCAG 2.2) | don't ask for the same info twice (billing = shipping checkbox) |
| accessible authentication (WCAG 2.2) | allow paste and password managers; no puzzles |

Server validation from ASP.NET Core (`ValidationProblemDetails.errors`) maps to the same field-level messages (10-forms).

## Example
`web/src/components/ui/Field.tsx`
```tsx
import { useId, type ReactElement, cloneElement } from "react";

type Props = { label: string; hint?: string; error?: string; required?: boolean; children: ReactElement<Record<string, unknown>> };

export function Field({ label, hint, error, required, children }: Props) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="grid gap-1">
      <label htmlFor={id}>{label}{required && <span> (required)</span>}</label>
      {hint && <p id={hintId} className="text-sm">{hint}</p>}
      {cloneElement(children, {
        id,
        required,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      })}
      {error && <p id={errorId} className="text-danger">⚠ {error}</p>}
    </div>
  );
}
```
`web/src/components/a11y/FocusOnMount.tsx` (focus the heading after navigation)
```tsx
"use client";
import { useEffect, useRef } from "react";

export function PageHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <h1 ref={ref} tabIndex={-1} className="outline-none focus-visible:outline-3">{children}</h1>;
}
```
`web/src/app/globals.css` (sticky header and focus not obscured)
```css
html { scroll-padding-block-start: 5rem; }   /* height of the sticky header */
```

## Production patterns
- Do a keyboard-only pass on every new screen: Tab, Shift+Tab, Enter, Space, Escape, arrow keys in composite widgets.
- Restore focus when overlays close; move focus deliberately after route changes in multi-step flows like checkout.
- One `Field` component wires labels, hints, errors, and ARIA consistently.
- Error summaries with links for forms longer than a few fields.

## Mistakes
Wrong: `tabindex="3"` to fix order.
Right: fix the DOM order; use only `0` and `-1`.

Wrong: errors shown only as red borders.
Right: text message linked via `aria-describedby`, `aria-invalid`, and an icon.

## Check yourself
1. Where should focus go when a dialog closes?
2. What does WCAG 2.2 "Focus Not Obscured" require?
3. How does a screen reader learn about a field's error message?

<details><summary>Answers</summary>

1. Back to the element that opened it (or a logical next place if that element is gone).
2. The focused element must not be completely hidden by author content like sticky headers or banners.
3. Through `aria-describedby` pointing to the message, plus `aria-invalid="true"` on the field.
</details>

## Sources
- [WAI — Keyboard compatibility](https://www.w3.org/WAI/perspective-videos/keyboard/)
- [WCAG 2.2 — Focus Not Obscured (2.4.11)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [WAI — Forms tutorial](https://www.w3.org/WAI/tutorials/forms/)
- [GOV.UK Design System — Error summary](https://design-system.service.gov.uk/components/error-summary/)
- [Next.js — Route announcer](https://nextjs.org/docs/architecture/accessibility#route-announcements)
