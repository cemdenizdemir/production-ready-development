---
title: Strategy and component tests
tech: Vitest 4, Testing Library, React 19.2
version: Vitest 4.x, @testing-library/react 16, @testing-library/user-event 14, jest-dom 6
date: 2026-11-07
covers: [1, 2, 5]
---
# Strategy and component tests
[← Overview](00-overview.md)

## Why it matters
- 300 snapshot tests break whenever a class name changes; the team runs `-u` by reflex, and real regressions get approved with the noise.
- Tests query by CSS classes and test IDs only. The "Pay" button loses its accessible name, every test still passes, and screen reader users can't pay.
- A component works in jsdom but crashes in Safari because of a browser API jsdom fakes.

## Concepts

### What to test where
| Layer | Tool | Test | Speed |
|:--|:--|:--|:--|
| Pure logic | Vitest | formatters, reducers, validation | ms |
| Components | Vitest + Testing Library (+ MSW) | behavior users see: rendering states, interactions, form flows | 10–100 ms |
| Real browser components | Vitest browser mode | components that rely on real layout, CSS, browser APIs | slower |
| End-to-end | Playwright | critical journeys across pages: sign up, checkout, login | seconds |
| Visual | Playwright / Vitest screenshots | design-system components, key pages | seconds |
| Accessibility | axe (Playwright), role queries | rule violations, names | in the above |

Most value per minute: **component tests of real behavior** with the network mocked by MSW, plus **a handful of E2E flows**.

### Testing Library principles
- **Query like a user**, in this priority: `getByRole` (with `name`) → `getByLabelText` → `getByPlaceholderText` → `getByText` → `getByDisplayValue` → `getByAltText` → `getByTitle` → `getByTestId` (last resort).
- **Interact like a user** with `user-event` (`await user.click`, `await user.type`), not `fireEvent`.
- **Assert on what users perceive**: text, roles, names, states (`toBeDisabled`, `toHaveAccessibleName`, `toHaveFocus`), not internal state or props.

| Query variant | Returns | Use |
|:--|:--|:--|
| `getBy…` | element or throws | it must be there now |
| `queryBy…` | element or `null` | assert absence |
| `findBy…` | promise, retries until timeout | it appears asynchronously |
| `…AllBy…` | arrays | lists |

### jsdom vs browser mode
| | jsdom (`environment: 'jsdom'`) | Vitest browser mode |
|:--|:--|:--|
| Runs in | Node with a simulated DOM | a real browser (Playwright provider) |
| Fast | yes | slower |
| Layout, CSS, real events | no (no layout engine) | yes |
| Browser APIs | partial fakes | real |
| Good for | most component tests | components depending on layout, focus, scrolling, canvas, real APIs |

## Example
`vitest.config.ts` and setup (jsdom)
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
});
```
```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```
`QuantityStepper.test.tsx`
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuantityStepper } from './QuantityStepper.tsx';

describe('QuantityStepper', () => {
  it('increases and decreases within limits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuantityStepper label="Quantity" value={1} min={1} max={3} onChange={onChange} />);

    const decrease = screen.getByRole('button', { name: 'Decrease quantity' });
    expect(decrease).toBeDisabled();                                   // at the minimum

    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('accepts typed values and is labelled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuantityStepper label="Quantity" value={1} min={1} max={10} onChange={onChange} />);

    const input = screen.getByRole('spinbutton', { name: 'Quantity' }); // fails if the label is missing
    await user.clear(input);
    await user.type(input, '5');
    expect(onChange).toHaveBeenLastCalledWith(5);
  });
});
```
Browser mode for a layout-dependent component (Vitest 4):
```ts
// vitest.browser.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.browser.test.tsx'],
    browser: { enabled: true, provider: playwright(), instances: [{ browser: 'chromium' }, { browser: 'webkit' }] },
  },
});
```
```tsx
// StickyHeader.browser.test.tsx
import { expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { StickyHeader } from './StickyHeader.tsx';

it('stays visible after scrolling', async () => {
  render(<div style={{ height: 3000 }}><StickyHeader /></div>);
  window.scrollTo(0, 1500);
  await expect.element(page.getByRole('banner')).toBeInViewport();
});
```

## Production patterns
- **Role-based queries by default**; a test that can't find a control by role and name has found an accessibility bug.
- **One behavior per test**, with realistic data from factories; avoid giant snapshots.
- **jsdom for most component tests, browser mode for layout/browser-API-dependent ones**, Playwright for journeys.
- **Test states, not only the happy path**: loading, empty, error, disabled ([09-ux-states](../../09-ux-states/README.md)).
- **Colocate tests** with components (`Button.test.tsx` next to `Button.tsx`).

## Mistakes
Wrong: implementation-detail queries.
```tsx
container.querySelector('.btn-primary')!.click();
```
Right: `await user.click(screen.getByRole('button', { name: 'Save' }))`.

Wrong: `getBy` for something that appears later.
```tsx
expect(screen.getByText('Saved')).toBeInTheDocument(); // throws before the async update
```
Right: `expect(await screen.findByText('Saved')).toBeInTheDocument()`.

Wrong: large snapshot tests as the main safety net. Right: targeted assertions; small snapshots only for stable output.

Wrong: testing that `setState` was called. Right: assert what changed on screen.

## Check yourself
1. Why is `getByRole` preferred over `getByTestId`?
2. When do you use `findBy` vs `queryBy`?
3. Which components belong in Vitest browser mode instead of jsdom?

<details>
<summary>Answers</summary>

1. It finds elements the way assistive technologies and users do (role + accessible name), so tests also verify accessibility and survive markup refactors; test IDs are invisible to users and prove nothing about usability.
2. `findBy` for elements that appear asynchronously (it retries); `queryBy` to assert that something is absent (returns `null` instead of throwing).
3. Components that depend on real layout (sticky/scroll, measurements, overflow), focus behavior, CSS, canvas, or browser APIs jsdom doesn't implement faithfully.
</details>

## Sources
- [Testing Library — Queries priority](https://testing-library.com/docs/queries/about#priority)
- [Testing Library — user-event](https://testing-library.com/docs/user-event/intro)
- [jest-dom matchers](https://github.com/testing-library/jest-dom)
- [Vitest — Browser mode](https://vitest.dev/guide/browser/)
- [Kent C. Dodds — Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
