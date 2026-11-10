---
title: Testing and process
tech: axe-core, @axe-core/playwright, Playwright, eslint-plugin-jsx-a11y, NVDA, VoiceOver
version: axe-core 4.x, Playwright 1.5x
date: 2026-11-09
covers: [10, 11, 12]
---
# Testing and process
[← Overview](00-overview.md)

## Why it matters
- An accessibility audit finds 140 issues two weeks before a public-sector contract deadline; most were introduced months ago and copied into many screens.
- A green axe run is treated as "accessible"; the checkout still can't be completed with a screen reader because focus is lost after the address step.
- Accessibility is "the frontend team's job"; designers ship low-contrast palettes and product managers cut captions from scope.

## Concepts

### Automated testing
| Layer | Tool | Catches |
|:--|:--|:--|
| editor/lint | `eslint-plugin-jsx-a11y` | missing alt, invalid ARIA, click handlers on divs |
| component tests | Testing Library role queries (`getByRole("button", { name: /add/i })`) | missing names and roles (tests fail) |
| ⭐ page tests | `@axe-core/playwright` in E2E | contrast, labels, ARIA misuse, landmarks, duplicate IDs |
| CI dashboards | Lighthouse accessibility audit | regressions |

Automated tools find roughly 30–40% of WCAG issues. They can't judge alt text quality, focus order logic, or whether a flow is usable.

### Manual testing
| Pass | How |
|:--|:--|
| ⭐ keyboard | unplug the mouse: complete the main flows (search, add to cart, checkout, account) |
| screen reader | NVDA + Firefox/Chrome (Windows), VoiceOver + Safari (macOS/iOS), TalkBack (Android): headings list, landmarks, forms, dialogs |
| zoom and reflow | 200% and 400% zoom, 320 px viewport |
| contrast | DevTools color picker / contrast checker on states (hover, disabled, focus) |
| reduced motion, dark mode, high contrast (Windows) | OS settings |
| voice control | Voice Access / Voice Control: "click Add to cart" |

NVDA basics: `Insert` is the NVDA key; `H` next heading, `D` next landmark, `F` next form field, `Tab` next focusable, `Insert+F7` elements list.

### Accessibility in the process
| Stage | Practice |
|:--|:--|
| design | contrast-checked tokens, focus states designed, annotations for headings/landmarks/reading order |
| tickets | acceptance criteria include keyboard and screen reader behavior |
| ⭐ Definition of Done | axe passes, keyboard pass done, labels/alt reviewed |
| code review | checklist items for names, focus, errors |
| CI | axe in Playwright on key pages, failing on serious/critical |
| releases | periodic manual audit of main flows |
| public | accessibility statement with known issues and a contact (EAA expects one) |
| content | alt text and captions as part of content workflows (admin fields) |

## Example
`web/tests/e2e/a11y.spec.ts`
```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = ["/", "/coffee", "/coffee/ethiopia-guji", "/cart", "/sign-in"];

for (const path of pages) {
  test(`no serious a11y violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude("#third-party-chat")
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
  });
}

test("checkout works with the keyboard only", async ({ page }) => {
  await page.goto("/cart");
  await page.keyboard.press("Tab");                                   // skip link
  await page.getByRole("link", { name: "Checkout" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Delivery address" })).toBeFocused();
});
```
`.github/pull_request_template.md` (excerpt)
```markdown
## Accessibility
- [ ] Keyboard pass done (Tab/Shift+Tab/Enter/Space/Escape)
- [ ] New controls have visible labels or accessible names
- [ ] axe E2E checks pass
```

## Production patterns
- axe in E2E on the main pages and states (open dialogs, error states), failing CI on serious/critical.
- Role-based queries in component tests: if a test can't find the button by role and name, neither can a screen reader user.
- A manual screen reader pass on every new flow, and a quarterly audit of the top journeys.
- An accessibility statement page and an email/form to report barriers.

## Mistakes
Wrong: "axe is green, so it's accessible."
Right: automated + keyboard + screen reader + zoom checks.

Wrong: excluding whole pages from axe because of one third-party widget.
Right: `.exclude("#widget")` for that element and track it with the vendor.

## Check yourself
1. Roughly what share of WCAG issues do automated tools find?
2. Which NVDA keys jump between headings and landmarks?
3. Name two process changes that prevent accessibility regressions.

<details><summary>Answers</summary>

1. About a third (30–40%).
2. `H` for headings, `D` for landmarks (in browse mode).
3. Accessibility in the Definition of Done and PR checklist; axe checks in CI; designed focus states and contrast-checked tokens; acceptance criteria with keyboard behavior.
</details>

## Sources
- [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
- [Playwright — Accessibility testing](https://playwright.dev/docs/accessibility-testing)
- [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)
- [NVDA user guide](https://www.nvaccess.org/files/nvda/documentation/userGuide.html)
- [WAI — Developing an accessibility statement](https://www.w3.org/WAI/planning/statements/)
