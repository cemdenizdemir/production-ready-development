---
title: Semantic structure, document essentials, and tables
tech: HTML
version: HTML Living Standard (Nov 2026)
date: 2026-11-09
covers: [1, 2, 6, 10]
---
# Semantic structure, document essentials, and tables
[← Overview](00-overview.md)

## Why it matters
- A shop's pages are built from `<div>`s only. Screen reader users can't jump to the main content or the navigation; a legal accessibility complaint follows.
- Every page has the title "Shop". Search results and browser tabs are useless, and analytics can't tell pages apart.
- An order history "table" is made of flexbox rows. Screen readers read 200 unrelated cells with no headers.

## Concepts

### Landmarks
| Element | Role | Use |
|:--|:--|:--|
| `<header>` (top level) | banner | site header |
| `<nav>` | navigation | main and secondary navigation (label each: `aria-label="Breadcrumb"`) |
| `<main>` | main | the page's main content, once per page |
| `<aside>` | complementary | related content |
| `<footer>` (top level) | contentinfo | site footer |
| `<section>` with a heading | region | a titled part of the page |
| `<form>` with a name | form | named forms |
| `<search>` | search | wraps a search form |

### Headings
One `<h1>` describing the page, then `<h2>`… in order, no skipping levels for styling. Screen reader users navigate by headings more than anything else. Style with CSS, not by picking a smaller heading.

### Choosing the element
| Need | Element | Not |
|:--|:--|:--|
| navigate to a URL | `<a href>` | `<div onclick>` |
| do something on this page | `<button type="button">` | `<a href="#">` |
| list of things | `<ul>/<ol>` + `<li>` | `<div>` stack |
| emphasis / importance | `<em>` / `<strong>` | `<i>` / `<b>` for meaning |
| time | `<time datetime="2026-11-09">` | plain text |
| address / contact | `<address>` | |
| self-contained item (card, post) | `<article>` | |
| tabular data | `<table>` | grid of divs |

### Document essentials
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ethiopia Guji, 250 g – Roastery</title>
  <meta name="description" content="Washed Ethiopian coffee with peach and jasmine notes. Roasted to order.">
</head>
```
| Item | Why |
|:--|:--|
| `<!doctype html>` | standards mode |
| `lang` | screen reader pronunciation, translation, hyphenation |
| `charset` first in `<head>` | correct text decoding |
| viewport meta | mobile layout; never `user-scalable=no` |
| unique `<title>` | tabs, history, search results, screen readers announce it on navigation |
| description | search snippet |

In Next.js these come from the root layout and the Metadata API (06-rendering).

### Tables for tabular data
```html
<table>
  <caption>Your orders, last 12 months</caption>
  <thead>
    <tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Total</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">#1042</th><td><time datetime="2026-11-08">8 Nov 2026</time></td><td>€27.00</td></tr>
  </tbody>
</table>
```
`<caption>` names the table, `<th scope>` ties cells to headers. For wide tables on mobile, wrap in a scroll container (`overflow-x: auto`) instead of turning it into cards that lose header associations.

### Validating and inspecting
| Tool | Shows |
|:--|:--|
| W3C Nu HTML Checker | invalid nesting, duplicate IDs, missing attributes |
| Chrome DevTools → Elements → Accessibility pane | computed role, name, and properties of an element |
| Chrome full accessibility tree view | the whole tree as assistive tech sees it |
| Firefox Accessibility Inspector | tree + automatic checks |
| axe DevTools / Lighthouse | automated issues (08-accessibility) |

## Example
`app/products/[slug]/page.html` (rendered output to aim for)
```html
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header>
    <a href="/">Roastery</a>
    <nav aria-label="Main">
      <ul><li><a href="/coffee" aria-current="page">Coffee</a></li><li><a href="/brewing">Brewing</a></li></ul>
    </nav>
    <search><form action="/search"><label for="q">Search</label><input id="q" name="q" type="search"></form></search>
  </header>
  <main id="main">
    <nav aria-label="Breadcrumb"><ol><li><a href="/coffee">Coffee</a></li><li aria-current="page">Ethiopia Guji</li></ol></nav>
    <article>
      <h1>Ethiopia Guji, 250 g</h1>
      <p>Washed process. Notes of peach and jasmine.</p>
      <section aria-labelledby="brew"><h2 id="brew">How to brew</h2>…</section>
    </article>
  </main>
  <footer><address><a href="mailto:hello@roastery.test">hello@roastery.test</a></address></footer>
</body>
```

## Production patterns
- Layout components (`<SiteHeader>`, `<Main>`) render the landmarks once, so pages can't forget them.
- A unique `<title>` and description per route, generated from the same data as the page.
- Check new pages in the DevTools accessibility tree before review; it takes a minute.
- Run the Nu checker or `html-validate` in CI on rendered pages for structural errors.

## Mistakes
Wrong:
```html
<div class="title">Ethiopia Guji</div>
<div class="btn" onclick="addToCart()">Add to cart</div>
```
Right:
```html
<h1>Ethiopia Guji</h1>
<button type="button">Add to cart</button>
```

Wrong: picking `<h4>` because it looks right.
Right: the correct level, styled with CSS.

## Check yourself
1. Why should a page have exactly one `<main>`?
2. What does `scope="col"` on `<th>` do?
3. Where can you see the role and accessible name Chrome computes for an element?

<details><summary>Answers</summary>

1. It's the landmark assistive tech jumps to for "the content"; several mains make that ambiguous.
2. It tells assistive tech the header applies to the cells in its column.
3. DevTools → Elements → Accessibility pane (or the full accessibility tree view).
</details>

## Sources
- [MDN — Document and website structure](https://developer.mozilla.org/docs/Learn_web_development/Core/Structuring_content/Structuring_documents)
- [WAI — Page structure tutorial](https://www.w3.org/WAI/tutorials/page-structure/)
- [WAI — Tables tutorial](https://www.w3.org/WAI/tutorials/tables/)
- [Nu HTML Checker](https://validator.w3.org/nu/)
- [Chrome — Accessibility features reference](https://developer.chrome.com/docs/devtools/accessibility/reference)
