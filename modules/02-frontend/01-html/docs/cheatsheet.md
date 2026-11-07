---
title: HTML cheatsheet
tech: HTML
version: HTML Living Standard (Nov 2026), Baseline 2025
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
---
# HTML cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Document essentials
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `<!doctype html>` | standards mode | first line |
| ⭐ `<html lang="en">` | page language | `lang` on parts in other languages too |
| ⭐ `<meta charset="utf-8">` | encoding | first in `<head>` |
| ⭐ `<meta name="viewport" content="width=device-width, initial-scale=1">` | mobile layout | never block zoom |
| ⭐ `<title>` | tab + search title | unique per page |
| `<meta name="description">` | search snippet | ~150 chars |
| `<link rel="icon" href="/favicon.svg">` | favicon | SVG + PNG fallback |
| `<link rel="manifest">` | web app manifest | installable apps |
| `<meta name="theme-color">` | browser UI color | per color scheme |
| `<base href>` | base for relative URLs | rarely needed; surprising |
| `dir="rtl"` | right-to-left text | Arabic, Hebrew |

## Landmarks and structure
| Element | Role / meaning | Note |
|:--|:--|:--|
| ⭐ `<header>` | banner (top level) | site header |
| ⭐ `<nav>` | navigation | label several: `aria-label="Main"` |
| ⭐ `<main>` | main content | exactly one |
| `<aside>` | complementary | sidebars |
| ⭐ `<footer>` | contentinfo (top level) | |
| `<search>` | search landmark | wraps search forms |
| `<section>` | region when labelled | needs a heading |
| `<article>` | self-contained content | posts, cards, comments |
| ⭐ `<h1>`–`<h6>` | outline | one h1, no skipped levels |
| `<hgroup>` | heading + subtitle | |
| `<div>` / `<span>` | no meaning | styling hooks only |

## Text-level semantics
| Element | Meaning |
|:--|:--|
| `<strong>` / `<em>` | importance / stress emphasis |
| `<b>` / `<i>` | styling-only offset text (no extra meaning) |
| `<time datetime="2026-11-07">` | machine-readable date/time |
| `<abbr title>` | abbreviation |
| `<code>` / `<pre>` / `<kbd>` / `<samp>` | code / preformatted / keys / output |
| `<blockquote cite>` / `<q>` / `<cite>` | quotes and sources |
| `<mark>` | highlighted (search hits) |
| `<small>` | side comments, fine print |
| `<del>` / `<ins>` | removed / added text |
| `<sub>` / `<sup>` | subscript / superscript |
| `<address>` | contact info for the nearest article/body |
| `<br>` / `<wbr>` | line break / optional break point |
| `<data value>` | machine-readable value |

## Lists, figures, tables
| Element | Use | Note |
|:--|:--|:--|
| `<ul>` / `<ol>` / `<li>` | lists | `start`, `reversed` on `<ol>` |
| `<dl>` / `<dt>` / `<dd>` | term–description pairs | metadata, FAQs |
| `<figure>` / `<figcaption>` | captioned content | images, code, charts |
| ⭐ `<table>` | tabular data only | never layout |
| ⭐ `<caption>` | table name | first child |
| `<thead>` / `<tbody>` / `<tfoot>` | sections | |
| ⭐ `<th scope="col\|row">` | header cells | associates headers |
| `colspan` / `rowspan` | merged cells | keep simple |
| `headers` attribute | complex header associations | rare |

## Links and buttons
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `<a href>` | navigation | `<a>` without href isn't focusable |
| ⭐ `<button type="button">` | in-page action | default `type` is `submit` in forms |
| `target="_blank"` | new tab | implies `rel="noopener"` in modern browsers |
| `rel="noreferrer"` | no Referer header | also implies noopener |
| `rel="nofollow"` / `"ugc"` / `"sponsored"` | link hints for search engines | user content, ads |
| `download` | download instead of navigate | same-origin |
| `aria-current="page"` | current nav item | |
| `href="mailto:"` / `"tel:"` | email / phone links | |

## Native interactive elements
| Element / API | What you get | Note |
|:--|:--|:--|
| ⭐ `<dialog>` + `showModal()` | modal, focus trap, Escape, inert background | `close(value)`, `returnValue` |
| `<form method="dialog">` | buttons close the dialog with a value | |
| `::backdrop` | style the overlay | |
| `<dialog closedby="any">` | light-dismiss control | newer |
| ⭐ `<details>` / `<summary>` | disclosure | `open` attribute |
| `<details name="x">` | exclusive accordion | Baseline 2024 |
| ⭐ `popover` + `popovertarget` | popups without JS | `popover="manual"` for no light dismiss |
| `popovertargetaction` | `show` / `hide` / `toggle` | |
| `commandfor` + `command` | invoker buttons for dialogs/popovers | newer (2025) |
| ⭐ `inert` | remove subtree from focus + a11y tree | behind overlays |
| `hidden="until-found"` | hidden but findable with Ctrl+F | |
| `contenteditable` | editable region | complex; avoid if possible |
| `<select>` with `appearance: base-select` | customizable select | newer, Chromium first |

## Forms
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `<label for="id">` | accessible name + click target | or wrap the input |
| ⭐ `name` | key in submitted data / `FormData` | |
| ⭐ `type="email\|tel\|url\|password\|search\|date"` | right keyboard and validation | |
| `type="number"` | quantities only | not for codes/phones |
| ⭐ `autocomplete` | autofill tokens | `email`, `new-password`, `one-time-code` |
| `inputmode` | keyboard hint | `numeric`, `decimal` |
| `enterkeyhint` | mobile Enter key label | `next`, `send` |
| ⭐ `required` / `minlength` / `maxlength` / `min` / `max` / `step` / `pattern` | built-in validation | |
| `:user-invalid` / `:user-valid` | error styles after interaction | Baseline 2023 |
| `novalidate` | disable native validation UI | custom JS validation |
| `<fieldset>` + `<legend>` | group controls | radio groups |
| `<datalist>` | input suggestions | |
| `<output>` | calculation result | |
| `<progress>` / `<meter>` | progress / gauge | |
| `form="id"` attribute | control outside its form | |
| `formaction` / `formmethod` on buttons | per-button submit target | |
| `accept` on file inputs | allowed types (hint only) | validate on server |
| `capture` | camera on mobile file inputs | |

## Images and media
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `alt` | text alternative | `""` for decorative |
| ⭐ `width` + `height` | reserve space | prevents CLS |
| ⭐ `srcset` + `sizes` | responsive resolution | `800w`, `1600w` |
| ⭐ `<picture>` + `<source type>` | AVIF/WebP with fallback | |
| ⭐ `loading="lazy"` | defer offscreen images/iframes | never the LCP image |
| ⭐ `fetchpriority="high"` | boost LCP image | one per page |
| `decoding="async"` | async decode | |
| `<video controls preload="metadata" poster>` | video | |
| `<track kind="captions">` | captions | required for a11y |
| `muted playsinline autoplay` | allowed autoplay | respect reduced motion |
| `<iframe loading="lazy" title>` | embeds | `sandbox`, `allow` attributes |
| `<svg>` with `<title>` / `role="img"` | inline icons | `aria-hidden="true"` if decorative |

## Scripts and loading
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `<script defer>` | run after parse, in order | |
| `<script async>` | run when loaded | independent scripts |
| ⭐ `<script type="module">` | ES module, deferred | |
| `nomodule` | legacy fallback | rarely needed now |
| ⭐ `<link rel="preconnect">` | warm connection | critical origins only |
| `<link rel="dns-prefetch">` | DNS only | |
| ⭐ `<link rel="preload" as>` | early fetch | fonts need `crossorigin` |
| `<link rel="modulepreload">` | preload module graph | |
| `<link rel="prefetch">` | next-page resources | low priority |
| `fetchpriority` | priority hint | images, scripts, links |
| `<script type="speculationrules">` | prerender/prefetch next pages | Chromium |
| `blocking="render"` | explicitly render-blocking | rare |
| `<noscript>` | fallback without JS | |
| `integrity` + `crossorigin` | Subresource Integrity for CDN files | see 11-security |

## Metadata for search and sharing
| Tag | What it does | Note |
|:--|:--|:--|
| ⭐ `<link rel="canonical">` | preferred URL | |
| `<meta name="robots" content="noindex, nofollow">` | search indexing | staging sites |
| ⭐ `og:title` / `og:description` / `og:image` / `og:url` | link previews | image 1200×630 |
| `og:type` / `og:site_name` / `og:locale` | more preview data | |
| `twitter:card` | X card type | `summary_large_image` |
| `<link rel="alternate" hreflang="de">` | language versions | |
| ⭐ JSON-LD | structured data | Product, Organization, BreadcrumbList, FAQ |
| `/robots.txt` / `/sitemap.xml` | crawler rules / URL list | see 12-cross-cutting |

## Global attributes
| Attribute | What it does |
|:--|:--|
| `id` / `class` | identity / styling |
| `hidden` | not rendered |
| `tabindex="0"` / `"-1"` | focusable in order / programmatically only |
| `title` | tooltip (not accessible; don't rely on it) |
| `lang` / `dir` | language / direction |
| `data-*` | custom data for scripts |
| `translate="no"` | don't auto-translate (brand names) |
| `spellcheck` | spellchecking |
| `autofocus` | focus on load (use sparingly) |
| `draggable` | drag and drop |
| `aria-*` / `role` | accessibility overrides (see 08-accessibility) |

## Validation and inspection
| Tool | What it does |
|:--|:--|
| ⭐ W3C Nu HTML Checker | validates markup |
| ⭐ DevTools accessibility tree | roles, names, states |
| Lighthouse | a11y, SEO, best-practice audits |
| axe DevTools | accessibility checks |
| Rich Results Test | validates JSON-LD |
| opengraph.xyz | previews link cards |
| `document.querySelectorAll('h1,h2,h3')` | quick outline check in the console |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `<div onclick>` | not keyboard accessible | `<button>` |
| `<a href="#">` for actions | wrong semantics, jumps to top | `<button type="button">` |
| Button in form submits | default `type="submit"` | `type="button"` |
| Placeholder as label | disappears, low contrast | `<label>` |
| `type="number"` for codes | spinners, lost zeros | `inputmode="numeric"` |
| Lazy LCP image | slow LCP | `fetchpriority="high"` |
| No image dimensions | layout shift | `width` + `height` |
| `user-scalable=no` | blocks zoom | remove it |
| Skipped heading levels | broken outline | style headings with CSS |
| Missing `lang` | wrong pronunciation | `<html lang>` |
| Blocking `<script>` in head | slow first paint | `defer` / `type="module"` |
| `title` attribute for info | invisible to keyboard/touch | visible text |

## Sources
| Source | Link |
|:--|:--|
| HTML Living Standard | https://html.spec.whatwg.org/ |
| MDN HTML elements | https://developer.mozilla.org/en-US/docs/Web/HTML/Element |
| MDN HTML attributes | https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes |
| web.dev Baseline | https://web.dev/baseline |
| W3C WAI tutorials | https://www.w3.org/WAI/tutorials/ |
| Open Graph protocol | https://ogp.me/ |
| schema.org | https://schema.org/ |
