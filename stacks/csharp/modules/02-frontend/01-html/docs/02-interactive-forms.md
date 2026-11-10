---
title: Interactive elements, forms, and progressive enhancement
tech: HTML
version: HTML Living Standard (Nov 2026), Baseline 2025
date: 2026-11-09
covers: [3, 4, 9]
---
# Interactive elements, forms, and progressive enhancement
[← Overview](00-overview.md)

## Why it matters
- A custom modal built from `<div>`s doesn't trap focus or close on Escape. Keyboard users get stuck behind it.
- The checkout form uses placeholders instead of labels; autofill fails, error messages aren't announced, and conversion drops.
- The "Subscribe" form only works after 400 KB of JavaScript loads. On a slow connection, the button does nothing for six seconds.

## Concepts

### Links vs buttons
| | `<a href>` | `<button>` |
|:--|:--|:--|
| purpose | go somewhere (URL changes) | do something (submit, open, toggle) |
| keyboard | Enter | Enter and Space |
| middle-click / open in new tab | yes | no |
| default `type` | — | `submit` inside forms: always set `type="button"` otherwise |

### Native interactive elements
| Element / attribute | Gives you | Use for |
|:--|:--|:--|
| `<details>` + `<summary>` | toggle, keyboard, state announced | FAQs, "show more", filters |
| `<details name="faq">` | exclusive accordion | one open at a time |
| `<dialog>` + `showModal()` | modal, focus moved in, Escape closes, backdrop, rest of page inert | confirmations, forms |
| `popover` attribute + `popovertarget` | light-dismiss, top layer, no JS | menus, tooltips-like panels |
| `inert` | removes a subtree from focus and the accessibility tree | content behind a custom overlay |
| `<button commandfor="d" command="show-modal">` | open dialogs/popovers declaratively | check Baseline |

### Forms in plain HTML
```html
<form action="/api/newsletter" method="post">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="email" required aria-describedby="email-hint">
  <p id="email-hint">We send one email a month.</p>
  <button type="submit">Subscribe</button>
</form>
```
| Feature | Why |
|:--|:--|
| `<label for>` (or wrapping label) | click target, accessible name; placeholders are not labels |
| correct `type` | `email`, `tel`, `url`, `number`, `date`, `search`: right keyboard on mobile, basic validation |
| ⭐ `autocomplete` | `email`, `name`, `street-address`, `postal-code`, `cc-number`, `one-time-code`, `new-password`, `current-password` |
| `required`, `minlength`, `maxlength`, `min`, `max`, `pattern` | built-in validation |
| `inputmode` | keyboard hint without changing validation (`inputmode="numeric"`) |
| `<fieldset>` + `<legend>` | group radios/checkboxes with a question |
| `aria-describedby` | hints and error messages read with the field |
| `name` | what the server receives |

Built-in validation is a UX convenience. The ASP.NET Core API validates everything again (03-backend/05-validation-abuse).

### Progressive enhancement
Start with HTML that works (links navigate, forms submit), then add JavaScript for a better experience. In this stack:
- Next.js Server Components render real HTML; links are `<Link>` → `<a href>`.
- React 19 `<form action={serverAction}>` submits even before hydration finishes.
- A form posting to `/api/...` with `method="post"` still works if a script fails; the JS version can intercept it for inline feedback.

## Example
`newsletter.html`
```html
<details name="faq">
  <summary>How often do you ship?</summary>
  <p>Every Tuesday and Friday.</p>
</details>

<button type="button" popovertarget="cart-preview">Cart (2)</button>
<div id="cart-preview" popover>
  <p>2 items · €27.00</p>
  <a href="/cart">View cart</a>
</div>

<button type="button" id="open-cancel">Cancel order</button>
<dialog id="cancel" aria-labelledby="cancel-title">
  <form method="dialog">
    <h2 id="cancel-title">Cancel order #1042?</h2>
    <p>You'll get a refund in 3–5 days.</p>
    <button value="keep">Keep order</button>
    <button value="cancel">Cancel order</button>
  </form>
</dialog>
<script>
  const d = document.getElementById("cancel");
  document.getElementById("open-cancel").addEventListener("click", () => d.showModal());
  d.addEventListener("close", () => { if (d.returnValue === "cancel") {/* call the API */} });
</script>
```
`<form method="dialog">` closes the dialog and sets `returnValue` to the clicked button's value. No focus-trap library needed.

## Production patterns
- A design system's `Button`, `Dialog`, `Disclosure` wrap the native elements; don't rebuild them from divs.
- Every input has a visible label and the right `autocomplete`; it's the cheapest checkout conversion win.
- Forms first work as plain HTML submissions; JavaScript enhances.
- Use `<dialog>` for modals and `popover` for non-modal floating UI before reaching for a library.

## Mistakes
Wrong: a link that acts like a button.
```html
<a href="#" onclick="cancelOrder()">Cancel</a>
```
Right:
```html
<button type="button" onclick="cancelOrder()">Cancel</button>
```

Wrong: placeholder as label.
```html
<input placeholder="Email">
```
Right: `<label>` + `<input type="email" autocomplete="email">`.

## Check yourself
1. Why set `type="button"` on buttons inside forms that shouldn't submit?
2. What does `showModal()` give you that `show()` doesn't?
3. Which attribute helps password managers tell sign-up from sign-in fields?

<details><summary>Answers</summary>

1. The default type is `submit`, so clicking would submit the form.
2. A modal in the top layer: backdrop, Escape to close, focus moved into it, and the rest of the page made inert.
3. `autocomplete="new-password"` vs `autocomplete="current-password"`.
</details>

## Sources
- [MDN — `<dialog>`](https://developer.mozilla.org/docs/Web/HTML/Element/dialog)
- [MDN — Popover API](https://developer.mozilla.org/docs/Web/API/Popover_API)
- [MDN — autocomplete values](https://developer.mozilla.org/docs/Web/HTML/Attributes/autocomplete)
- [web.dev — Learn Forms](https://web.dev/learn/forms)
- [GOV.UK — Progressive enhancement](https://www.gov.uk/service-manual/technology/using-progressive-enhancement)
