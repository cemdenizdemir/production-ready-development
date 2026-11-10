---
title: Strategy, component tests, and Vitest browser mode
tech: Vitest 4, Testing Library, user-event
version: Vitest 4.x, @testing-library/react 16, @testing-library/user-event 14
date: 2026-11-09
covers: [1, 2, 5]
---
# Strategy, component tests, and Vitest browser mode
[← Overview](00-overview.md)

## Why it matters
- 400 snapshot tests break on every CSS change and get updated blindly; they've never caught a real bug.
- Tests find elements by `data-testid` and class names; a refactor breaks 60 tests, and an unlabeled button ships because no test cared about its name.
- A component works in jsdom but breaks in real browsers because jsdom doesn't implement layout, `<dialog>`, or `IntersectionObserver` faithfully.

## Concepts

### What to test where
| Level | Tool | Test | Keep |
|:--|:--|:--|:--|
| unit | Vitest | pure functions: money/date formatting, URL parsing, reducers, Zod extensions | many, fast |
| ⭐ component | Vitest + Testing Library (+ MSW) | a component's behavior through the UI: renders data, validation, interactions, states | most of the frontend suite |
| integration (page) | same, with providers and routes | a feature flow within one page | some |
| ⭐ E2E | Playwright | critical journeys against the real API (sign in, add to cart, checkout) | few, high value |
| visual | Playwright screenshots | design-system components, key pages | targeted |
| a11y | axe in Playwright, role queries everywhere | 08-accessibility | always |

The backend has its own tests (WebApplicationFactory + Testcontainers); frontend tests don't re-test business rules, they test the UI's handling of the API's responses.

### Testing Library principles
Test like a user: find by **role and accessible name**, interact with `user-event`, assert what's visible.
| Query priority | Example |
|:--|:--|
| ⭐ `getByRole` | `getByRole("button", { name: /add to cart/i })` |
| `getByLabelText` | `getByLabelText("Postal code")` |
| `getByText` | non-interactive text |
| `getByTestId` | last resort |

| Variant | Use |
|:--|:--|
| `getBy*` | must exist now (throws) |
| `queryBy*` | assert absence (`expect(queryByRole(...)).toBeNull()`) |
| `findBy*` | async, waits (data loading) |

`user-event` (`userEvent.setup()`) simulates real sequences (focus, keydown, input, click) better than `fireEvent`. `@testing-library/jest-dom` adds matchers like `toBeVisible`, `toBeDisabled`, `toHaveAccessibleName`.

### jsdom vs Vitest browser mode
| | jsdom / happy-dom | ⭐ browser mode (Vitest 4) |
|:--|:--|:--|
| runs in | Node with a fake DOM | real Chromium/Firefox/WebKit via Playwright |
| speed | fastest | a bit slower |
| fidelity | no layout, partial APIs (`<dialog>`, observers, CSS) | real browser behavior |
| good for | most logic-heavy components | layout, focus, dialogs, CSS-dependent behavior, design system |

Many teams use jsdom for the bulk and browser mode for components that depend on real browser features; Vitest 4 workspaces/projects let you run both.

## Example
`web/vitest.config.ts`
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      { extends: true, test: { name: "unit", environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"], setupFiles: ["./test/setup.ts"] } },
      { extends: true, test: { name: "browser", include: ["src/**/*.browser.test.tsx"],
          browser: { enabled: true, provider: playwright(), instances: [{ browser: "chromium" }] } } },
    ],
  },
});
```
`web/src/features/cart/QuantityStepper.test.tsx`
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuantityStepper } from "./QuantityStepper";

test("increments and announces the new quantity", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<QuantityStepper productName="Ethiopia Guji" value={1} max={5} onChange={onChange} />);

  await user.click(screen.getByRole("button", { name: "Increase quantity of Ethiopia Guji" }));

  expect(onChange).toHaveBeenCalledWith(2);
});

test("disables increase at the stock limit", () => {
  render(<QuantityStepper productName="Ethiopia Guji" value={5} max={5} onChange={() => {}} />);
  expect(screen.getByRole("button", { name: /increase/i })).toBeDisabled();
});
```
`web/src/components/ui/Dialog.browser.test.tsx` (real `<dialog>` behavior)
```tsx
import { render } from "vitest-browser-react";
import { page, userEvent } from "@vitest/browser/context";
import { ConfirmDialog } from "./ConfirmDialog";

test("Escape closes the dialog and returns focus", async () => {
  render(<ConfirmDialog trigger="Delete address" title="Delete address 'Home'?" onConfirm={() => {}} />);
  await page.getByRole("button", { name: "Delete address" }).click();
  await expect.element(page.getByRole("dialog")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("button", { name: "Delete address" })).toHaveFocus();
});
```

## Production patterns
- Component tests are the core of the frontend suite; E2E covers the few journeys that make money.
- Role-based queries everywhere: tests double as accessibility checks.
- Browser mode for design-system components and anything relying on real layout, focus, or native elements.
- No broad DOM snapshots; assert behavior and use targeted visual tests instead (lesson 03).

## Mistakes
Wrong:
```tsx
container.querySelector(".btn-primary")!.click();
expect(container).toMatchSnapshot();
```
Right: `await user.click(screen.getByRole("button", { name: /place order/i }))` and assert visible results.

Wrong: `getBy*` for content that loads asynchronously.
Right: `findBy*` (or `await expect.element(...)` in browser mode).

## Check yourself
1. Which query should you reach for first?
2. When is Vitest browser mode worth the extra time?
3. Why don't frontend tests re-test business rules like discount calculation?

<details><summary>Answers</summary>

1. `getByRole` with an accessible name.
2. When behavior depends on real browser features: layout, focus management, `<dialog>`/popover, observers, CSS.
3. The ASP.NET Core API owns and tests them; the frontend tests how it displays and handles the API's results.
</details>

## Sources
- [Testing Library — Queries](https://testing-library.com/docs/queries/about)
- [user-event](https://testing-library.com/docs/user-event/intro)
- [jest-dom matchers](https://github.com/testing-library/jest-dom)
- [Vitest — Browser mode](https://vitest.dev/guide/browser/)
- [Kent C. Dodds — The Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
