---
title: Interactive elements, forms, and progressive enhancement
tech: HTML
version: HTML Living Standard (Nov 2026), Baseline 2025
date: 2026-11-07
covers: [3, 4, 9]
---
# Interactive elements, forms, and progressive enhancement
[← Overview](00-overview.md)

## Why it matters
- A "button" made from `<div onclick>` can't be reached with Tab or activated with Enter/Space. Keyboard and switch users can't check out.
- A custom modal built from divs doesn't trap focus or close on Escape; screen reader users get lost behind it.
- A sign-up form without `autocomplete` and proper input types makes phone users type everything by hand, and conversion drops.

## Concepts

### Links vs buttons
| Element | Does | Activated by |
|:--|:--|:--|
| `<a href>` | navigates to a URL; can open in a new tab, be bookmarked | Enter |
| `<button>` | performs an action on this page | Enter and Space |

`<a>` without `href` is not focusable. `<button>` inside a `<form>` defaults to `type="submit"`; use `type="button"` for other actions.

### Native interactive elements
| Element / API | Gives you for free | Note |
|:--|:--|:--|
| `<details>` + `<summary>` | disclosure widget, keyboard, state | `name="faq"` makes an exclusive accordion |
| `<dialog>` + `showModal()` | modal with focus trap, Escape to close, `::backdrop`, inert background | `close()`, `returnValue`, `method="dialog"` forms |
| `popover` attribute | top-layer popups, light dismiss, Escape | `popovertarget` on a button; no JS needed |
| `inert` attribute | removes a subtree from focus and the accessibility tree | background of custom overlays |
| invoker commands | `commandfor` + `command="show-modal"` buttons control dialogs/popovers without JS | newer (2025); check Baseline |

### Forms
| Feature | Use |
|:--|:--|
| `<label for>` (or wrapping) | accessible name; click target |
| `type` | `email`, `tel`, `url`, `password`, `search`, `date`, `number` (only for quantities) |
| `autocomplete` | `email`, `name`, `given-name`, `street-address`, `postal-code`, `tel`, `new-password`, `current-password`, `one-time-code`, `cc-number` |
| `inputmode` | keyboard hint: `numeric`, `decimal`, `email`, `tel` |
| `enterkeyhint` | label of the mobile Enter key: `next`, `send`, `search` |
| `required`, `minlength`, `maxlength`, `min`, `max`, `step`, `pattern` | built-in validation |
| `:user-invalid` / `:user-valid` | style errors only after the user interacts |
| `<fieldset>` + `<legend>` | group related controls (radio groups, address) |
| `name` | key in the submitted data and `FormData` |
| `novalidate` | turn off native bubbles when JS shows its own errors |

### Progressive enhancement
Start with HTML that works: real links, forms with `action` and `method`, content in the HTML. Then add JavaScript for a better experience. If the script fails to load, the user can still finish the task. React 19 and Next.js `<form action={serverFunction}>` follow the same idea: the form submits even before hydration ([10-forms](../../10-forms/README.md)).

## Example
`signup.html`
```html
<form action="/signup" method="post">
  <h2>Create your account</h2>

  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="email" required>

  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="new-password"
         minlength="12" required aria-describedby="password-hint">
  <p id="password-hint">At least 12 characters.</p>

  <fieldset>
    <legend>Plan</legend>
    <label><input type="radio" name="plan" value="free" checked> Free</label>
    <label><input type="radio" name="plan" value="pro"> Pro</label>
  </fieldset>

  <label for="code">Verification code</label>
  <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}">

  <button type="submit">Create account</button>
</form>

<style>
  input:user-invalid { outline: 2px solid #b00020; }
</style>
```
A modal with no custom focus code:
```html
<button type="button" id="open-delete">Delete account</button>

<dialog id="confirm-delete" aria-labelledby="confirm-title">
  <h2 id="confirm-title">Delete your account?</h2>
  <p>This removes all orders and cannot be undone.</p>
  <form method="dialog">
    <button value="cancel" autofocus>Cancel</button>
    <button value="delete">Delete</button>
  </form>
</dialog>

<script type="module">
  const dialog = document.querySelector('#confirm-delete');
  document.querySelector('#open-delete').addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('close', () => {
    if (dialog.returnValue === 'delete') { /* call the API */ }
  });
</script>
```
A popover menu with zero JavaScript:
```html
<button popovertarget="account-menu">Account</button>
<div id="account-menu" popover>
  <a href="/settings">Settings</a>
  <a href="/logout">Log out</a>
</div>
```

## Production patterns
- **Native first.** `<button>`, `<a>`, `<dialog>`, `<details>`, popover. Custom widgets only when no element fits, following WAI-ARIA patterns ([08-accessibility](../../08-accessibility/README.md)).
- **Every input has a visible label** and the right `type` and `autocomplete`. Password managers and autofill depend on them.
- **Forms work without JavaScript** where feasible; JS adds inline validation and optimistic UI.
- **Default to `type="button"`** in component libraries; make submit buttons explicit.

## Mistakes
Wrong: div buttons.
```html
<div class="btn" onclick="save()">Save</div>
```
Right:
```html
<button type="button" onclick="save()">Save</button>
```

Wrong: links that act like buttons.
```html
<a href="#" onclick="deleteItem()">Delete</a>
```
Right: `<button type="button">` for actions; `<a href="/items/7">` for navigation.

Wrong: placeholder instead of a label.
```html
<input type="email" placeholder="Email">
```
Right: a `<label>`; placeholders vanish while typing and have poor contrast.

Wrong: `type="number"` for card numbers, ZIP codes, or phone numbers (spinners, lost leading zeros).
Right: `type="text"` with `inputmode="numeric"` and the right `autocomplete`.

## Check yourself
1. Why does a `<button>` inside a form sometimes submit unexpectedly?
2. What do you get from `dialog.showModal()` that you would otherwise build by hand?
3. When is `inputmode="numeric"` better than `type="number"`?

<details>
<summary>Answers</summary>

1. Its default `type` is `submit`. Set `type="button"` for buttons that don't submit.
2. Rendering in the top layer, a focus trap with focus moved into the dialog, Escape to close, an inert background, `::backdrop` styling, and focus returned to the opener on close.
3. For digit strings that aren't quantities: codes, card numbers, postal codes. You get a numeric keyboard without spinners, rounding, or lost leading zeros.
</details>

## Sources
- [MDN — `<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
- [MDN — Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
- [MDN — `autocomplete` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete)
- [web.dev — Sign-up form best practices](https://web.dev/articles/sign-up-form-best-practices)
- [MDN — Progressive enhancement](https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement)
