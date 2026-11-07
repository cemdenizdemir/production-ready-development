---
title: Code smells, refactoring, and principles in review
tech: TypeScript 6 (strict)
version: TypeScript 6.0, Node.js 26 LTS, ESLint 10, Vitest 4
date: 2026-11-07
covers: [10, 11]
---
# Code smells, refactoring, and principles in review
[← Overview](00-overview.md)

## Why it matters
- A "small refactor" without tests changes rounding in invoices. Finance finds it at month end.
- A reviewer writes "violates SOLID" on a 30-line script. The author adds three interfaces and a factory; the code becomes harder to read and nothing improves.
- A 600-line function grows by 20 lines per sprint because nobody wants to be the one who breaks it.

## Concepts

### Common code smells
| Smell | Signal | Typical refactoring |
|:--|:--|:--|
| Long function | does many things, needs scrolling | Extract Function |
| Large class / god object | many responsibilities, many dependencies | Extract Class, split module |
| Long parameter list | 5+ parameters, flags | Introduce Parameter Object, split function |
| Feature envy | a function uses another object's data more than its own | Move Function |
| Shotgun surgery | one change edits many files | Move Function, consolidate the knowledge |
| Divergent change | one module changes for many reasons | split by reason to change (SRP) |
| Primitive obsession | strings and numbers for money, emails, IDs | Value object, branded type |
| Data clumps | the same fields always travel together | Introduce Parameter Object or value object |
| Switch on type | repeated `switch` over kinds | Replace Conditional with Polymorphism / dispatch table |
| Duplicated knowledge | the same rule in several places | Extract and centralize |
| Message chains | `a.b().c().d()` | Hide Delegate (Demeter) |
| Speculative generality | unused abstractions | Collapse Hierarchy, Inline |
| Comments explaining unclear code | "this does X because…" | Rename, Extract Function |
| Mutable shared data | many writers | Encapsulate, make immutable |

### Refactoring safely
| Step | Practice |
|:--|:--|
| 1. Tests first | characterization tests pin current behavior, even if it's odd |
| 2. Small steps | each step keeps tests green; commit often |
| 3. Separate PRs | refactoring PRs change structure only; feature PRs change behavior |
| 4. Tooling | IDE rename/extract/move refactorings, TypeScript errors as a guide |
| 5. Strangle large changes | new path beside the old, switch gradually, delete the old |
| Prefactoring | "make the change easy, then make the easy change" (Kent Beck) |

### Principles in review
| Instead of | Write |
|:--|:--|
| "violates SRP" | "pricing and email wording change for different reasons; move templates to notifications" |
| "use an interface" | "tests hit Stripe; a `PaymentGateway` port with a fake would make them fast" |
| "too complex" | "this function has 4 nested conditions; extracting `isEligibleForFreeShipping` names the rule" |
| "not DRY" | "VAT rates are defined in checkout and invoices; they disagree for AT" |

Over-engineering is a finding too: abstractions without a second use, layers that only forward calls, patterns used for their own sake.

## Example
Characterization test before touching legacy pricing:
```ts
import { describe, expect, test } from 'vitest';
import { legacyTotal } from './legacy-pricing.ts';

describe('legacyTotal (current behavior, pinned before refactoring)', () => {
  test.each([
    [[{ price: 1999, qty: 3 }], undefined, 5997],
    [[{ price: 1999, qty: 3 }], 'SAVE10', 5397],          // rounds down, not to nearest: keep it until finance decides
    [[], 'SAVE10', 0],
  ])('lines %j with code %s → %i', (lines, code, expected) => {
    expect(legacyTotal(lines, code)).toBe(expected);
  });
});
```
Refactoring a long function in small steps (each step keeps tests green):
```ts
// Before: one function, several responsibilities
export function legacyTotal(lines: { price: number; qty: number }[], code?: string): number {
  let t = 0;
  for (const l of lines) t += l.price * l.qty;
  if (code === 'SAVE10') t = Math.floor(t * 0.9);
  if (code === 'FIVEOFF' && t > 2000) t = t - 500;
  return t;
}

// Step 1: extract the subtotal. Step 2: replace the conditionals with a lookup of discount rules.
type DiscountRule = (subtotal: number) => number;
const DISCOUNTS: Record<string, DiscountRule> = {
  SAVE10: (t) => Math.floor(t * 0.9),
  FIVEOFF: (t) => (t > 2000 ? t - 500 : t),
};

const subtotal = (lines: readonly { price: number; qty: number }[]) => lines.reduce((t, l) => t + l.price * l.qty, 0);

export function legacyTotal(lines: { price: number; qty: number }[], code?: string): number {
  const rule = code ? DISCOUNTS[code] : undefined;
  return rule ? rule(subtotal(lines)) : subtotal(lines);
}
```
Lint rules that flag smells early (`eslint.config.js` excerpt):
```js
export default [
  {
    rules: {
      complexity: ['warn', 10],
      'max-depth': ['warn', 3],
      'max-params': ['warn', 4],
      'max-lines-per-function': ['warn', { max: 60, skipComments: true, skipBlankLines: true }],
    },
  },
];
```

## In our stack
- Review practice and Conventional Comments: [05-practice/01-engineering-practice lesson 02](../../../05-practice/01-engineering-practice/docs/02-code-review.md).
- The /review command scores Design (coupling, cohesion, boundaries, over-engineering) on every task.
- Tests that make refactoring safe: [01-foundations/03-testing](../../../01-foundations/03-testing/README.md).

## When not to
- Don't refactor code nobody will change again; smells cost money only when code changes.
- Don't mix refactoring with behavior changes in one PR.
- Don't chase lint thresholds blindly; a clear 70-line function beats five vague 14-line ones.

## Production patterns
- **Name the smell and the cost** in reviews, suggest the refactoring.
- **Characterization tests** before refactoring untested code.
- **Small, green, separate steps**; refactoring PRs reviewed quickly.
- **Refactor where you're working** (prefactoring), not in big-bang rewrites.

## Mistakes
Wrong: a big rewrite branch that runs for months. It never catches up with main. Right: incremental refactoring and the strangler approach.

Wrong: refactoring without tests. Behavior changes silently. Right: pin behavior first.

Wrong: review comments that cite a principle without saying what goes wrong. Right: the concrete cost and a concrete alternative.

## Check yourself
1. What's a characterization test, and when do you write one?
2. What's the difference between shotgun surgery and divergent change?
3. How do you phrase a design concern so it leads to action in a review?

<details>
<summary>Answers</summary>

1. A test that records what code currently does (including odd behavior) so refactoring can't change it unnoticed. Write it before refactoring code that lacks tests.
2. Shotgun surgery: one change requires edits in many places (knowledge is scattered). Divergent change: one module is edited for many unrelated reasons (too many responsibilities). The fixes go in opposite directions: consolidate vs split.
3. Describe the concrete problem and its cost (what breaks or slows down, and when), then propose a specific change; mention the principle only as a name for it, and mark whether it blocks the merge.
</details>

## Sources
- [Martin Fowler — Refactoring catalog](https://refactoring.com/catalog/)
- [refactoring.guru — Code smells](https://refactoring.guru/refactoring/smells)
- [Michael Feathers — Working Effectively with Legacy Code (characterization tests)](https://michaelfeathers.silvrback.com/characterization-testing)
- [ESLint — complexity rule](https://eslint.org/docs/latest/rules/complexity)
- [Kent Beck — "make the change easy, then make the easy change"](https://x.com/KentBeck/status/250733358307500032)
