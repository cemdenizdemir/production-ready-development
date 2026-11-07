---
title: Semantic structure and the document
tech: HTML
version: HTML Living Standard (Nov 2026)
date: 2026-11-07
covers: [1, 2, 6, 10]
---
# Semantic structure and the document
[← Overview](00-overview.md)

## Why it matters
- A page built from `<div>`s gives screen reader users no landmarks or headings to jump between. They must listen to everything, top to bottom.
- `<html>` without `lang`: screen readers read German text with English pronunciation, and browsers offer the wrong translation.
- A missing viewport meta tag renders a tiny desktop layout on phones; no media query will help.

## Concepts

### Landmarks and headings
| Element | Landmark role | Use |
|:--|:--|:--|
| `<header>` (top level) | banner | site header, logo, global nav |
| `<nav>` | navigation | major navigation blocks; label several with `aria-label` |
| `<main>` | main | the page's primary content; exactly one |
| `<aside>` | complementary | related content (sidebar) |
| `<footer>` (top level) | contentinfo | site footer |
| `<search>` | search | wraps a search form |
| `<section>` with a heading | region | thematic group with a heading |
| `<form>` with a name | form | a labelled form |

Headings (`<h1>`–`<h6>`) form the outline: one `<h1>` per page, no skipped levels, levels chosen by structure, not font size.

### Choosing elements
| Need | Element |
|:--|:--|
| Self-contained item (post, card, comment) | `<article>` |
| Group with a heading | `<section>` |
| Styling hook only | `<div>` / `<span>` |
| Lists | `<ul>`, `<ol>`, `<dl>` (term + description) |
| Dates and times | `<time datetime="2026-11-07">` |
| Figure with caption | `<figure>` + `<figcaption>` |
| Importance / emphasis | `<strong>` / `<em>` (not `<b>`/`<i>` for meaning) |
| Code and keys | `<code>`, `<pre>`, `<kbd>` |
| Quotes | `<blockquote cite>`, `<q>` |
| Contact info | `<address>` |

### Document essentials
| Piece | Why |
|:--|:--|
| `<!doctype html>` | standards mode |
| `<html lang="en">` | language for screen readers, translation, hyphenation |
| `<meta charset="utf-8">` | first in `<head>`, within 1024 bytes |
| `<meta name="viewport" content="width=device-width, initial-scale=1">` | proper mobile layout; never disable zoom |
| `<title>` | tab name, history, search result title; unique per page |
| `<meta name="description">` | search snippet |
| `<link rel="icon">` | favicon |

### Tables for data
Use tables for tabular data only: `<caption>` names it, `<th scope="col|row">` labels headers, `<thead>`/`<tbody>` structure it. Never for layout.

### Validate and inspect
- **W3C Nu HTML Checker** catches invalid nesting and attributes.
- **DevTools accessibility tree** (Chrome Elements → Accessibility; Firefox Accessibility panel) shows each element's role and accessible name.
- **Lighthouse** accessibility and SEO audits catch common gaps.

## Example
`index.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Orders · Acme Shop</title>
  <meta name="description" content="Track and manage your Acme Shop orders.">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header>
    <a href="/"><img src="/logo.svg" alt="Acme Shop home" width="120" height="32"></a>
    <nav aria-label="Main">
      <ul>
        <li><a href="/orders" aria-current="page">Orders</a></li>
        <li><a href="/account">Account</a></li>
      </ul>
    </nav>
    <search>
      <form action="/search" method="get">
        <label for="q">Search orders</label>
        <input id="q" name="q" type="search">
        <button>Search</button>
      </form>
    </search>
  </header>

  <main id="main">
    <h1>Your orders</h1>
    <section aria-labelledby="recent-heading">
      <h2 id="recent-heading">Recent</h2>
      <table>
        <caption>Orders from the last 30 days</caption>
        <thead>
          <tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Total</th></tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row"><a href="/orders/1043">#1043</a></th>
            <td><time datetime="2026-11-02">2 Nov 2026</time></td>
            <td>€25.99</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>

  <footer>
    <p>&copy; 2026 Acme Shop · <a href="/privacy">Privacy</a></p>
  </footer>
</body>
</html>
```
Check it: paste into validator.w3.org/nu, then open DevTools → Accessibility tree and confirm landmarks, headings, and the table's names.

## Production patterns
- **Landmarks + headings on every page**: they are the navigation menu for screen reader users.
- **Unique, descriptive `<title>` per route**, set by the framework (Next.js Metadata API in [06-rendering](../../06-rendering/README.md)).
- **Components render semantic elements**: a `<Card>` that is an `<article>`, a `<Button>` that is a `<button>`.
- **Validate templates in CI** for static pages, and run Lighthouse/axe on key routes ([08-accessibility](../../08-accessibility/README.md)).

## Mistakes
Wrong: heading levels picked for size.
```html
<h1>Orders</h1>
<h4>Recent</h4>   <!-- skipped h2, h3 because h4 "looked right" -->
```
Right: `<h2>` and style it with CSS.

Wrong: zoom disabled.
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```
Right: `width=device-width, initial-scale=1` only. Users with low vision need zoom.

Wrong: a layout table, or a "table" made of `<div>`s for real data. Right: CSS Grid for layout; `<table>` with `<th scope>` for data.

Wrong: `<div class="header">` and `<div class="nav">`. Right: `<header>`, `<nav>`, `<main>`, `<footer>`.

## Check yourself
1. How many `<main>` elements should a page have, and why does it matter?
2. When should you use `<section>` vs `<div>`?
3. Where do you look to see what a screen reader will announce for an element?

<details>
<summary>Answers</summary>

1. Exactly one visible `<main>`. Assistive technology offers "jump to main content", and skip links target it.
2. `<section>` for a thematic group that has a heading (it becomes a region landmark when labelled); `<div>` when you only need a styling or layout wrapper.
3. The accessibility tree in DevTools: it shows each node's role, accessible name, and states.
</details>

## Sources
- [MDN — Document and website structure](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Structuring_documents)
- [W3C WAI — Page structure tutorial](https://www.w3.org/WAI/tutorials/page-structure/)
- [W3C WAI — Tables tutorial](https://www.w3.org/WAI/tutorials/tables/)
- [MDN — `<search>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/search)
- [Chrome DevTools — Accessibility features reference](https://developer.chrome.com/docs/devtools/accessibility/reference)
