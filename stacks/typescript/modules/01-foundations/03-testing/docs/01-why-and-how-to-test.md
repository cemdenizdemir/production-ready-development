---
title: Why and how to test
tech: Vitest 4, TypeScript
version: Vitest 4.x, Node.js 26 LTS
date: 2026-11-07
covers: [1, 2, 12]
---
# Why and how to test
[← Overview](00-overview.md)

## Why it matters
- A refactor of the discount code ships, and every coupon over 50% now gives a negative price. Nobody had a test for the boundary.
- A suite with 400 tests that mirror implementation breaks on every refactor. The team starts skipping it, and it stops catching anything.
- A bug fixed without a test returns three months later, after someone "cleans up" the fix.

## Concepts

### What tests buy you
1. **Confidence to change code.** The main reason.
2. **Executable documentation.** A test named "rejects an expired coupon" says what the code promises.
3. **Design feedback.** Code that is painful to test usually has tangled dependencies.

### Kinds of tests
| Kind | Scope | Speed | Catches |
|:--|:--|:--|:--|
| Static | types, lint | instant | typos, wrong types, unsafe patterns |
| Unit | one function or module, no I/O | ~1 ms | logic and edge cases |
| Integration | module + real dependencies (HTTP, DB) | 10–500 ms | SQL, wiring, serialization, auth |
| End-to-end | whole system through UI or public API | seconds | broken journeys, config, deploys |

The classic **pyramid** says many unit tests, fewer integration, very few E2E. The **testing trophy** puts the bulk in integration tests, because that is where web apps break. For a backend, a good split is: unit tests for pure domain logic, most confidence from HTTP-level integration tests with a real database, and a handful of E2E smoke tests.

### Properties of a good test (FIRST)
| Property | Meaning |
|:--|:--|
| Fast | the unit suite runs in seconds, so people run it |
| Isolated | no test depends on another test's leftovers or order |
| Repeatable | same result every run, on every machine |
| Self-checking | passes or fails without a human reading output |
| Timely | written with the code, or before it |

### Test behavior, not implementation
Assert on what callers can observe: return values, HTTP responses, rows in the database, messages sent. Avoid asserting which private helper was called. Behavior tests survive refactors; implementation tests break on every one.

### Arrange, Act, Assert
Each test sets up the world, does one thing, and checks the outcome. One behavior per test, so a failure points at one cause. Name tests as a sentence about behavior.

### Test-driven development
**Red:** write a failing test for the next small behavior. **Green:** write the simplest code that passes. **Refactor:** clean up with the tests as a safety net.
- It shines for bug fixes (reproduce first), clear business rules, and parsers.
- It fits poorly in exploratory spikes. Spike, throw it away, then test-drive the real version.

### Legacy code
Before changing untested code, write **characterization tests**: tests that record what the code does today, even if it is odd. Then refactor in small steps. Look for **seams**, places where you can swap a dependency (a parameter, a constructor argument) without editing the logic.

## Example
`src/pricing.ts`
```ts
export type Coupon = { percentOff: number; expiresAt: Date };

export function applyCoupon(totalCents: number, coupon: Coupon, now: Date): number {
  if (now >= coupon.expiresAt) throw new Error('Coupon expired');
  const percent = Math.min(Math.max(coupon.percentOff, 0), 100);
  return Math.round(totalCents * (1 - percent / 100));
}
```
`src/pricing.test.ts` — run with `pnpm vitest`.
```ts
import { describe, expect, it } from 'vitest';
import { applyCoupon } from './pricing.ts';

const now = new Date('2026-11-07T12:00:00Z');
const tomorrow = new Date('2026-11-08T12:00:00Z');

describe('applyCoupon', () => {
  it('takes the percentage off and rounds to whole cents', () => {
    // Arrange
    const coupon = { percentOff: 15, expiresAt: tomorrow };
    // Act
    const result = applyCoupon(999, coupon, now);
    // Assert
    expect(result).toBe(849); // 999 * 0.85 = 849.15
  });

  it('never makes the total negative, even above 100%', () => {
    expect(applyCoupon(1000, { percentOff: 150, expiresAt: tomorrow }, now)).toBe(0);
  });

  it('rejects a coupon at the exact expiry moment', () => {
    expect(() => applyCoupon(1000, { percentOff: 10, expiresAt: now }, now)).toThrow('Coupon expired');
  });
});
```
`now` is a parameter, so the test controls time without mocks. That parameter is a seam.

## Production patterns
- **Every bug fix starts with a failing test** that reproduces it. The test stays forever.
- **Test the contract at the boundary you ship**: HTTP responses for an API, exported functions for a library.
- **Keep the unit suite under ~10 seconds** and run it in watch mode while coding.
- **Rewrite or delete tests that only mirror implementation.** They cost more than they catch.
- **Review tests like production code.** Unclear tests hide unclear requirements.

## Mistakes
Wrong: asserting on internals.
```ts
const spy = vi.spyOn(pricing, 'clampPercent');
applyCoupon(1000, coupon, now);
expect(spy).toHaveBeenCalled(); // breaks if clampPercent is inlined; proves nothing about the price
```
Right:
```ts
expect(applyCoupon(1000, { percentOff: 150, expiresAt: tomorrow }, now)).toBe(0);
```

Wrong: one test checking five behaviors. When it fails, you don't know which rule broke.
Right: one behavior per test, named as a sentence.

Wrong: weak assertions.
```ts
expect(applyCoupon(999, coupon, now)).toBeTruthy(); // 1 would pass too
```
Right:
```ts
expect(applyCoupon(999, coupon, now)).toBe(849);
```

Wrong: `new Date()` inside the function under test, then flaky tests at midnight or month end.
Right: pass the time in, or use fake timers (lesson 03).

## Check yourself
1. Why does the testing trophy favor integration tests for web backends?
2. What makes a test "test implementation" instead of behavior?
3. You must change a 600-line untested function. What do you write first?

<details>
<summary>Answers</summary>

1. Most backend bugs come from how pieces fit: SQL, serialization, middleware order, auth. Integration tests through HTTP with a real database catch those; unit tests with mocks don't.
2. It checks how the result is produced (which helpers ran, in which order, internal state) rather than what a caller observes. Any refactor breaks it even when behavior is unchanged.
3. Characterization tests that pin its current outputs for representative inputs, including odd ones. Then refactor in small, tested steps.
</details>

## Sources
- [Martin Fowler — The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Kent C. Dodds — The Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Martin Fowler — Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Vitest — Getting started](https://vitest.dev/guide/)
