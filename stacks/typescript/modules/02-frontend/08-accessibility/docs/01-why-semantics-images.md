---
title: Why, semantics, names, and images
tech: HTML, React 19.2
version: WCAG 2.2 AA, HTML Living Standard
date: 2026-11-07
covers: [1, 2, 8]
---
# Why, semantics, names, and images
[← Overview](00-overview.md)

## Why it matters
- An icon-only "trash" button has no accessible name; a screen reader announces "button", and the user can't tell it deletes the order.
- Product images have `alt="image"` or the file name; blind shoppers can't compare products.
- A shop launches in the EU without accessibility checks and receives a formal complaint under the European Accessibility Act within weeks.

## Concepts

### Who benefits
| Need | Examples | Depends on |
|:--|:--|:--|
| Blind / low vision | screen readers, magnification, high contrast | semantics, names, contrast, zoom |
| Motor | keyboard only, switch devices, voice control | keyboard support, target size, names that match labels |
| Deaf / hard of hearing | captions, transcripts | media alternatives |
| Cognitive | plain language, consistent navigation, no time pressure | clear content and errors |
| Situational | sunlight, broken arm, noisy room | all of the above |

### WCAG 2.2 in one table
Four principles (POUR), success criteria at levels A, AA, AAA. Target **AA**.

| Principle | Means | Examples |
|:--|:--|:--|
| Perceivable | users can perceive content | text alternatives, captions, contrast 4.5:1, reflow at 320 px |
| Operable | users can operate the UI | keyboard access, visible focus, target size 24×24, no traps |
| Understandable | content and UI are clear | labels, error messages, consistent navigation |
| Robust | works with assistive tech | correct roles, names, states |

Law: the EU's European Accessibility Act (since June 2025) covers e-commerce, banking, transport, e-books, and more; the US ADA is enforced through lawsuits; many public sectors require WCAG AA.

### Role, name, state
- **Role:** what it is. Native elements have implicit roles (`<button>` → button, `<nav>` → navigation, `<h2>` → heading level 2).
- **Name:** what it's called. Computed from, in priority order: `aria-labelledby`, `aria-label`, native labeling (`<label>`, `alt`, `<caption>`, `<legend>`, the element's text content), and last `title`.
- **State/properties:** checked, expanded, disabled, invalid, current page.

Inspect them in DevTools → Accessibility pane, or with Playwright's `getByRole('button', { name: 'Delete order #1043' })`, which only finds elements that are accessible by that role and name.

### Images, icons, media
| Content | Alternative |
|:--|:--|
| Informative image | `alt` describes the information it conveys in context |
| Decorative image | `alt=""` (empty, not missing) or CSS background |
| Functional image (inside a link/button) | `alt` describes the action/destination ("Acme home") |
| Image of text | avoid; if unavoidable, `alt` with the same text |
| Complex image (chart) | short `alt` + nearby text or table with the data |
| Icon in a button with text | `aria-hidden="true"` on the icon |
| Icon-only button | accessible name on the button (`aria-label` or visually hidden text) |
| Video | captions (`<track kind="captions">`), audio description or transcript for key visual info |
| Audio | transcript |

## Example
`OrderActions.tsx`
```tsx
import { DownloadIcon, TrashIcon } from '@/components/icons'; // local inline-SVG components

export function OrderActions({ orderId }: { orderId: string }) {
  return (
    <div role="group" aria-label={`Actions for order ${orderId}`}>
      {/* icon + visible text: hide the icon from assistive tech */}
      <button type="button">
        <DownloadIcon aria-hidden="true" /> Download invoice
      </button>

      {/* icon-only: the button needs a name */}
      <button type="button" aria-label={`Delete order ${orderId}`}>
        <TrashIcon aria-hidden="true" />
      </button>
    </div>
  );
}
```
Visually hidden text works too and is translated by browser translation tools:
```tsx
<button type="button">
  <TrashIcon aria-hidden="true" />
  <span className="sr-only">Delete order {orderId}</span>   {/* Tailwind's sr-only utility */}
</button>
```
Images in context:
```tsx
<img src={product.imageUrl} alt={`${product.name}, ${product.color}`} width={640} height={480} />
<img src="/decorations/wave.svg" alt="" />                          {/* decorative */}
<a href="/"><img src="/logo.svg" alt="Acme Shop home" /></a>        {/* functional */}

<figure>
  <img src="/charts/sales-q3.png" alt="Bar chart: Q3 sales by region, Europe highest." />
  <figcaption>Q3 sales by region. <a href="#sales-table">See the data table</a>.</figcaption>
</figure>
```

## Production patterns
- **Semantic HTML first**: most accessibility comes free with the right element.
- **Design system components carry accessibility**: buttons require a name, icons default to `aria-hidden`, images require `alt` (enforce with TypeScript props).
- **Alt text is content**: written by people who know the context (product team, editors), reviewed like copy.
- **Captions for all video** with speech, generated and then edited.
- **Name what you show**: the accessible name should contain the visible label text (voice control users say what they see).

## Mistakes
Wrong: icon-only buttons without a name.
```tsx
<button onClick={remove}><TrashIcon /></button> {/* announced as "button" */}
```
Right: `aria-label="Delete order 1043"` and `aria-hidden` on the icon.

Wrong: `alt` attributes that say nothing or repeat file names.
```html
<img src="IMG_4482.jpg" alt="IMG_4482.jpg">
<img src="desk.jpg" alt="image">
```
Right: describe the content in context, or `alt=""` if decorative.

Wrong: missing `alt` entirely on decorative images; screen readers may read the file name. Right: `alt=""`.

Wrong: `aria-label` that contradicts the visible text ("Submit" visible, `aria-label="Send form"`). Voice control users say "click Submit" and nothing happens.
Right: the name includes the visible label.

## Check yourself
1. What three things does the accessibility tree expose for each element?
2. When should an image have `alt=""`?
3. Why should an accessible name contain the visible label text?

<details>
<summary>Answers</summary>

1. Role, accessible name, and states/properties (plus value for inputs).
2. When it's purely decorative or its meaning is already given by nearby text; empty `alt` tells assistive technology to skip it.
3. Voice control users activate controls by speaking their visible label; if the accessible name differs, the command fails (WCAG 2.5.3 Label in Name).
</details>

## Sources
- [W3C — WCAG 2.2 at a glance](https://www.w3.org/WAI/standards-guidelines/wcag/glance/)
- [W3C WAI — Images tutorial](https://www.w3.org/WAI/tutorials/images/)
- [W3C — Accessible Name and Description Computation](https://www.w3.org/TR/accname-1.2/)
- [WebAIM — Alternative text](https://webaim.org/techniques/alttext/)
- [W3C WAI — Understanding Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)
