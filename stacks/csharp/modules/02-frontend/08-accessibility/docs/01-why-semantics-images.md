---
title: Why accessibility; semantics, the accessibility tree, images
tech: HTML, React 19.2
version: WCAG 2.2 AA
date: 2026-11-09
covers: [1, 2, 8]
---
# Why accessibility; semantics, the accessibility tree, images
[← Overview](00-overview.md)

## Why it matters
- An icon-only "trash" button has no name; a screen reader announces "button" and the user doesn't know it deletes their address.
- Product photos have `alt="product image"`; blind customers can't tell the 250 g bag from the 1 kg bag.
- A demo video has no captions; deaf users and everyone watching on mute on the train miss the brewing instructions.

## Concepts

### Why, in numbers and law
| Reason | Detail |
|:--|:--|
| users | permanent (blindness, motor), temporary (broken arm), situational (bright sunlight, holding a baby) |
| law | EAA (EU e-commerce, since 2025-06-28), ADA (US), national laws; procurement often requires WCAG 2.1/2.2 AA |
| business | larger market, better SEO, fewer support tickets |
| engineering | role-based selectors make tests stable (13-testing-monitoring) |

WCAG principles: **Perceivable, Operable, Understandable, Robust**. Levels A, AA (target), AAA.

### Roles, names, states
| Part | Comes from | Example |
|:--|:--|:--|
| role | the element (`<button>`, `<nav>`, `<h2>`) or `role` attribute | button |
| name | content, `<label>`, `alt`, `aria-label`, `aria-labelledby` | "Remove Ethiopia Guji" |
| description | `aria-describedby` | "Removes 2 bags from your cart" |
| states/properties | native (`disabled`, `checked`) or ARIA (`aria-expanded`, `aria-current`, `aria-invalid`) | expanded = false |

Name computation order (simplified): `aria-labelledby` → `aria-label` → native label/`alt`/content → `title`. Visible text should be part of the name (voice control users say what they see).

### Semantic HTML first
Native elements bring roles, keyboard behavior, and states for free (01-html). Every custom `<div>` widget must rebuild them, usually incompletely. In React: `<button>` not `<div onClick>`, `<Link>` (renders `<a>`) for navigation, headings in order, landmarks in layouts, lists as lists.

### Images, icons, and media
| Image kind | `alt` |
|:--|:--|
| informative (product photo) | what matters: "Ethiopia Guji, 250 g bag, light roast" |
| functional (image inside a link/button) | the action/destination: "Roastery home" |
| decorative (background flourish) | `alt=""` (and `aria-hidden` for inline SVG) |
| complex (chart) | short alt + full description nearby or a data table |
| text in images | avoid; if unavoidable, alt repeats the text |

Icons: icon-only buttons need an accessible name (`aria-label` or visually hidden text); decorative icons next to text get `aria-hidden="true"`.
Media: captions for video with speech, transcripts for audio, no autoplay with sound, pause controls for anything moving > 5 s.

## Example
`web/src/components/ui/IconButton.tsx`
```tsx
import type { ComponentProps, ReactNode } from "react";

type Props = ComponentProps<"button"> & { label: string; icon: ReactNode };

export function IconButton({ label, icon, ...props }: Props) {
  return (
    <button type="button" aria-label={label} {...props}>
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
// <IconButton label={`Remove ${line.name}`} icon={<TrashIcon />} onClick={() => remove(line.sku)} />
```
`web/src/features/catalog/ProductImage.tsx`
```tsx
import Image from "next/image";

export function ProductImage({ p }: { p: ProductDto }) {
  return (
    <figure>
      <Image src={p.imageUrl} width={800} height={800} alt={`${p.name}, ${p.weightGrams} g bag`} />
      <figcaption>Roasted on {p.roastedOn}</figcaption>
    </figure>
  );
}
```
The `alt` text comes from data: add an `ImageAlt` field to the C# product DTO so editors can write good descriptions instead of developers guessing.

## Production patterns
- Accessible names for every interactive element, including context in repeated controls ("Remove Ethiopia Guji", not "Remove" × 5).
- Alt text is content: stored with the product in the API and edited in the admin.
- Captions and transcripts are part of "done" for any video.
- Design system components (`Button`, `IconButton`, `Dialog`) encode these rules once.

## Mistakes
Wrong:
```tsx
<div onClick={remove}><TrashIcon /></div>
```
Right:
```tsx
<IconButton label={`Remove ${name}`} icon={<TrashIcon />} onClick={remove} />
```

Wrong: `alt="image of coffee"` on every product.
Right: specific, purposeful alt text from product data; `alt=""` for decoration.

## Check yourself
1. What are the three things assistive tech needs for each control?
2. When is `alt=""` correct?
3. Why should the visible label be part of the accessible name?

<details><summary>Answers</summary>

1. Role, name, and state.
2. For decorative images that add no information (or when the same information is in adjacent text).
3. Voice control users activate controls by saying the visible text; a different accessible name breaks that (WCAG 2.5.3 Label in Name).
</details>

## Sources
- [WCAG 2.2 at a glance](https://www.w3.org/WAI/standards-guidelines/wcag/glance/)
- [WAI — Accessible name and description (ARIA APG)](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
- [WAI — Images tutorial / alt decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/)
- [EAA overview (European Commission)](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en)
