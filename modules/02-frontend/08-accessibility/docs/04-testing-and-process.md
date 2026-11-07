---
title: Testing and process
tech: axe-core, Playwright, Vitest, Testing Library
version: @axe-core/playwright 4.x, Playwright 1.5x, WCAG 2.2 AA
date: 2026-11-07
covers: [10, 11, 12]
---
# Testing and process
[← Overview](00-overview.md)

## Why it matters
- A redesign ships with low-contrast buttons on every page; an automated check in CI would have caught it in the PR.
- All automated checks pass, but the date picker can't be used with a keyboard. Tools catch roughly a third to half of issues; the rest needs humans.
- Accessibility is "someone's project" twice a year, so regressions pile up between audits.

## Concepts

### What automation catches (and doesn't)
| Automated tools catch | Only humans catch |
|:--|:--|
| missing names on buttons/links/inputs | whether alt text is meaningful |
| contrast failures | logical focus order |
| missing `lang`, landmarks, duplicate IDs | keyboard traps in custom widgets |
| invalid ARIA (wrong roles, attributes) | whether announcements make sense |
| form fields without labels | whether errors are understandable |
| images without `alt` | usability with zoom and screen readers |

### Layers of testing
| Layer | Tool | Catches |
|:--|:--|:--|
| Editor/lint | eslint-plugin-jsx-a11y (check ESLint 10 support) | obvious JSX mistakes |
| Component tests | Testing Library `getByRole` queries (+ vitest-axe, also seen) | missing roles/names; inaccessible components fail to be found |
| E2E | Playwright + `@axe-core/playwright` | page-level rule violations in real browsers |
| Accessibility tree snapshots | Playwright `toMatchAriaSnapshot` | regressions in structure, names, states |
| Manual | keyboard pass, screen readers, zoom | everything else |
| Audit | external experts, users with disabilities | real-world barriers |

### Manual testing routine (per feature)
1. **Keyboard:** complete the flow with Tab, Shift+Tab, Enter, Space, arrows, Escape. Is focus always visible and logical?
2. **Screen reader:** NVDA + Firefox/Chrome on Windows, or VoiceOver + Safari on macOS/iOS. Navigate by headings (H), landmarks (D in NVDA / rotor in VoiceOver), and form fields; check names and announcements.
3. **Zoom:** 200% and 400% (reflow at 320 px), no horizontal scrolling for text.
4. **Visual:** contrast, `forced-colors` (Windows high contrast), reduced motion.

| Screen reader | Start | Useful keys |
|:--|:--|:--|
| NVDA (Windows) | Ctrl+Alt+N | Insert+Down read all, H headings, D landmarks, F form fields, Insert+F7 elements list |
| VoiceOver (macOS) | Cmd+F5 | VO (Ctrl+Option)+Right next item, VO+U rotor, VO+Space activate |
| VoiceOver (iOS) | Settings or triple-click side button | swipe right/left, double-tap, rotor gesture |
| TalkBack (Android) | volume keys shortcut | swipe, double-tap |

### Accessibility in the process
| Practice | Effect |
|:--|:--|
| Definition of Done includes accessibility checks | it's part of "done", not a later project |
| Design reviews check contrast, focus states, target sizes, reading order | fewer issues reach code |
| Design-system components tested once, reused everywhere | fixes scale |
| Accessibility statement (known issues, contact, date) | legal requirement in many EU contexts; builds trust |
| Conformance report (VPAT/ACR) | often required in B2B sales |
| Periodic audits + user testing with disabled people | finds what checklists miss |

## Example
`tests/a11y.spec.ts` — axe on key pages, scoped to WCAG A/AA.
```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = ['/', '/products/oak-desk-140', '/cart', '/checkout'];

for (const path of pages) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .exclude('#third-party-chat')               // not ours; track separately
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('checkout errors are reachable and announced', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Place order' }).click();
  const email = page.getByRole('textbox', { name: 'Email' });
  await expect(email).toBeFocused();                       // focus moved to the first error
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription(/Enter an email address/);
});

test('navigation structure stays accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toMatchAriaSnapshot(`
    - navigation "Main":
      - list:
        - listitem:
          - link "Orders"
        - listitem:
          - link "Account"
  `);
});
```
Run states too: open dialogs, menus, and error states before calling `analyze()`, since axe only checks what's rendered.

## Production patterns
- **axe in Playwright for every key page and state** (dialog open, errors shown), failing the build on new violations.
- **Role-based queries everywhere** in tests; if a test can't find a control by role and name, users of assistive tech can't either.
- **A short manual checklist per PR** that changes UI: keyboard pass + one screen reader smoke test.
- **Fix in the design system first**; one component fix repairs every page.
- **Publish and maintain an accessibility statement** with a contact for feedback.

## Mistakes
Wrong: treating a clean axe run as "accessible". Right: automation plus keyboard and screen reader testing.

Wrong: running axe only on the initial page load. Dialogs, menus, and errors are never checked.
Right: drive the UI into each state, then analyze.

Wrong: excluding whole pages from scans to make CI green. Right: exclude only third-party regions you can't change, track them, and pressure vendors.

Wrong: accessibility as a yearly audit. Right: in the Definition of Done, design reviews, and CI.

## Check yourself
1. Name three accessibility problems automated tools can't detect.
2. Why do `getByRole` queries improve accessibility as a side effect?
3. What belongs in an accessibility statement?

<details>
<summary>Answers</summary>

1. Meaningless alt text, illogical focus order, keyboard traps or missing keyboard support in custom widgets, confusing announcements or error messages, and problems only visible when zoomed.
2. They only find elements exposed with the right role and accessible name; writing tests this way forces markup that assistive technologies can use.
3. The standard targeted (e.g. WCAG 2.2 AA), the conformance status, known issues and workarounds, how to give feedback or request alternatives, and the date it was last reviewed.
</details>

## Sources
- [Playwright — Accessibility testing](https://playwright.dev/docs/accessibility-testing)
- [Playwright — Aria snapshots](https://playwright.dev/docs/aria-snapshots)
- [Deque — axe-core rules](https://dequeuniversity.com/rules/axe/)
- [W3C WAI — Easy checks](https://www.w3.org/WAI/test-evaluate/preliminary/)
- [W3C WAI — Developing an accessibility statement](https://www.w3.org/WAI/planning/statements/)
- [WebAIM — Using NVDA](https://webaim.org/articles/nvda/)
