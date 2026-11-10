---
title: HTML cheatsheet
tech: HTML
version: HTML Living Standard (Nov 2026), Baseline 2025
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
---
# HTML cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Landmarks
| Element | Role | Note |
|:--|:--|:--|
| ⭐ `<main>` | main | once per page |
| ⭐ `<nav aria-label="…">` | navigation | label each nav |
| `<header>` (top level) | banner | |
| `<footer>` (top level) | contentinfo | |
| `<aside>` | complementary | |
| `<section aria-labelledby>` | region | needs a name |
| `<search>` | search | Baseline |
| `<form aria-label>` | form | named forms |
| skip link | `<a href="#main">` | first focusable |

## Content elements
| Element | Use | Note |
|:--|:--|:--|
| ⭐ `<h1>`–`<h6>` | outline | one h1, no skipped levels |
| `<article>` | self-contained item | cards, posts |
| `<ul>` / `<ol>` / `<li>` | lists | screen readers count items |
| `<dl>` / `<dt>` / `<dd>` | term–value pairs | specs |
| `<time datetime>` | machine-readable dates | |
| `<address>` | contact info | |
| `<figure>` / `<figcaption>` | captioned media | |
| `<em>` / `<strong>` | emphasis / importance | not styling |
| `<abbr title>` | abbreviations | |
| `<mark>` | highlight | search results |

## Document essentials
| Item | Value | Note |
|:--|:--|:--|
| ⭐ `<!doctype html>` | standards mode | |
| ⭐ `<html lang="en">` | language | |
| `<meta charset="utf-8">` | encoding | first in head |
| ⭐ viewport | `width=device-width, initial-scale=1` | never disable zoom |
| ⭐ `<title>` | unique per page | |
| `<meta name="description">` | snippet | |
| `<link rel="icon">` | favicon | |
| `<meta name="theme-color">` | browser UI color | |

## Links and buttons
| Element | Use | Note |
|:--|:--|:--|
| ⭐ `<a href>` | navigation | Enter key, new tab |
| ⭐ `<button type="button">` | actions | Enter + Space |
| `<button type="submit">` | submit | default inside forms |
| `aria-current="page"` | current nav item | |
| `target="_blank"` | new tab | `rel="noopener"` implied in modern browsers |
| `download` | download link | |

## Native interactive elements
| Element / attribute | Gives | Note |
|:--|:--|:--|
| ⭐ `<details>` / `<summary>` | disclosure | keyboard + state |
| `<details name="x">` | exclusive accordion | Baseline |
| ⭐ `<dialog>` + `showModal()` | modal, focus, Escape, inert background | |
| `<form method="dialog">` | close dialog with `returnValue` | |
| `::backdrop` | style modal backdrop | |
| ⭐ `popover` + `popovertarget` | light-dismiss panel, top layer | |
| `popover="manual"` | no light dismiss | |
| `inert` | remove subtree from focus/AT | |
| `commandfor` / `command` | declarative open/close | check Baseline |
| `hidden="until-found"` | hidden but findable with Ctrl+F | |

## Form controls
| Item | Use | Note |
|:--|:--|:--|
| ⭐ `<label for>` | name + click target | placeholders aren't labels |
| `type="email"` / `tel` / `url` / `number` / `date` / `search` | right keyboard + validation | |
| ⭐ `autocomplete` | autofill | `email`, `name`, `street-address`, `postal-code` |
| `autocomplete="new-password"` / `current-password` | password managers | |
| `autocomplete="one-time-code"` | OTP from SMS | |
| `inputmode="numeric"` | keyboard only | |
| `required` / `minlength` / `maxlength` / `pattern` / `min` / `max` | built-in validation | server validates again |
| `<fieldset>` + `<legend>` | group with a question | radios, checkboxes |
| `aria-describedby` | hints and errors | |
| `<select>` / `<datalist>` | choices / suggestions | |
| `<output>` | computed result | |
| `name` | submitted key | |
| `form.requestSubmit()` | submit with validation | JS |

## Progressive enhancement
| Practice | Why | Note |
|:--|:--|:--|
| ⭐ links navigate, forms submit without JS | works before hydration | |
| `<form action method="post">` | real submission | |
| React 19 `<form action={fn}>` | enhanced, still a form | |
| server-rendered content | crawlers, slow devices | Next.js RSC |
| feature detection | `if ("showPopover" in HTMLElement.prototype)` | |

## Images and media
| Attribute | Purpose | Note |
|:--|:--|:--|
| ⭐ `alt` | purpose of image | `""` for decorative |
| ⭐ `width` / `height` | reserve space | no CLS |
| ⭐ `srcset` + `sizes` | responsive resolution | |
| `<picture>` + `<source type>` | AVIF/WebP + fallback | art direction |
| ⭐ `loading="lazy"` | below the fold | never the LCP image |
| ⭐ `fetchpriority="high"` | LCP image | |
| `decoding="async"` | off-main-thread decode | |
| `<video controls preload="metadata" poster>` | video | |
| `<track kind="captions">` | captions | |
| `next/image` | does srcset/formats | still needs alt + size |

## Tables
| Element | Use | Note |
|:--|:--|:--|
| ⭐ `<table>` | tabular data only | |
| ⭐ `<caption>` | table name | |
| `<thead>` / `<tbody>` / `<tfoot>` | sections | |
| ⭐ `<th scope="col">` / `scope="row"` | header association | |
| `headers` / `id` | complex tables | |
| scroll wrapper | wide tables on mobile | `overflow-x: auto` |

## Loading and hints
| Item | Effect | Note |
|:--|:--|:--|
| ⭐ `defer` | after parse, in order | |
| `async` | ASAP, any order | analytics |
| `type="module"` | deferred by default | |
| ⭐ `rel="preload" as=…` | fetch early | fonts need `crossorigin` |
| ⭐ `rel="preconnect"` | warm connection | API, image CDN |
| `rel="dns-prefetch"` | DNS only | |
| `rel="modulepreload"` | preload module | |
| `fetchpriority` | priority hint | images, scripts, fetch |

## Metadata
| Tag | Purpose | Note |
|:--|:--|:--|
| ⭐ `rel="canonical"` | original URL | filters, tracking params |
| ⭐ `robots noindex` | keep out of index | staging, carts, search |
| `og:title` / `og:description` / `og:image` / `og:url` | link previews | |
| `twitter:card` | X preview | `summary_large_image` |
| ⭐ JSON-LD | structured data | Product, Offer, BreadcrumbList |
| `hreflang` | language alternates | |
| `sitemap.xml` / `robots.txt` | crawl hints | Next.js file conventions |

## Validation and inspection
| Tool | Shows | Note |
|:--|:--|:--|
| ⭐ Nu HTML Checker | invalid markup | validator.w3.org/nu |
| `html-validate` | CI validation | npm |
| ⭐ DevTools Accessibility pane | role, name, state | |
| full accessibility tree | AT view | Chrome |
| Firefox Accessibility Inspector | tree + checks | |
| Lighthouse / axe | automated audits | 08-accessibility |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `<div onclick>` | no keyboard, no role | `<button>` |
| `<a href="#">` for actions | wrong semantics | `<button>` |
| button without `type` in a form | submits | `type="button"` |
| placeholder as label | no name, disappears | `<label>` |
| lazy LCP image | slow LCP | `fetchpriority="high"` |
| missing image dimensions | CLS | `width`/`height` |
| heading levels for size | broken outline | CSS |
| duplicate IDs | broken `for`/`aria-*` | unique IDs (`useId`) |
| `user-scalable=no` | blocks zoom | remove |

## Sources
| Source | Link |
|:--|:--|
| HTML Living Standard | https://html.spec.whatwg.org/multipage/ |
| MDN HTML | https://developer.mozilla.org/docs/Web/HTML |
| web.dev Learn HTML | https://web.dev/learn/html |
| web.dev Learn Forms | https://web.dev/learn/forms |
| WAI tutorials | https://www.w3.org/WAI/tutorials/ |
| Baseline | https://web.dev/baseline |
| Nu HTML Checker | https://validator.w3.org/nu/ |
| schema.org Product | https://schema.org/Product |
