---
title: Vitest essentials
tech: Vitest 4, TypeScript
version: Vitest 4.x, Node.js 26 LTS
date: 2026-11-07
covers: [3, 6, 9]
---
# Vitest essentials
[← Overview](00-overview.md)

## Why it matters
- A test for an async error path forgets `await`. It passes for a year while the code it guards throws the wrong error.
- Tests share one mutable `user` object. One test changes it, and three others fail only when run in a certain order.
- Edge cases (empty list, unicode, the 31st of the month) are where production bugs hide, and nobody wrote them down.

## Concepts

### Setup
```bash
pnpm add -D vitest
```
`vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true, // undo vi.spyOn/vi.fn changes after every test
  },
});
```
`package.json` scripts: `"test": "vitest"` (watch mode locally) and `"test:ci": "vitest run"` (single run).

### Core API
| API | Use |
|:--|:--|
| `describe`, `it` / `test` | group and define tests |
| `expect(x).toBe(y)` | `Object.is` equality (primitives, same reference) |
| `toEqual` / `toStrictEqual` | deep equality / also checks `undefined` keys and classes |
| `toMatchObject` | subset match on objects |
| `toThrow(msg or class)` | sync function throws |
| `await expect(p).rejects.toThrow()` | promise rejects |
| `test.each([...])` | same test over a table of inputs |
| `beforeEach` / `afterEach` / `beforeAll` / `afterAll` | hooks |
| `test.only` / `test.skip` / `test.todo` | focus, skip, placeholder |
| `test.extend({...})` | typed fixtures with setup and teardown |
| `expect.assertions(n)` | fail unless n assertions ran |
| `vitest -t "coupon"` | run tests whose name matches |

### Async tests
Return or `await` every promise. A test that doesn't wait for its promise ends before the assertion runs, and passes.

### Edge cases worth a test
| Category | Examples |
|:--|:--|
| Empty and missing | `''`, `[]`, `null`, `undefined`, missing keys |
| Boundaries | 0, 1, max, max + 1, exact expiry moment |
| Text | unicode, emoji, very long strings, leading/trailing spaces |
| Numbers | negatives, decimals, `NaN`, money rounding |
| Time | time zones, DST changes, month ends, leap days |
| Failure | upstream errors, timeouts, duplicate requests |

### Test data: factories over shared fixtures
A **factory** builds a valid object with defaults and lets each test override only what it cares about. Each test gets a fresh object, so tests can't leak state into each other.

## Example
`src/slugify.ts`
```ts
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents after decomposing
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```
`src/slugify.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { slugify } from './slugify.ts';

describe('slugify', () => {
  it.each([
    ['Hello World', 'hello-world'],
    ['  trim me  ', 'trim-me'],
    ['Crème Brûlée', 'creme-brulee'],
    ['a---b', 'a-b'],
    ['', ''],
    ['!!!', ''],
  ])('slugify(%j) → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
```
`src/test/factories.ts` and an async test with a fixture:
```ts
import { randomUUID } from 'node:crypto';

export type User = { id: string; email: string; role: 'member' | 'admin'; createdAt: Date };

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: randomUUID(),
    email: `user-${randomUUID().slice(0, 8)}@example.test`, // unique per call
    role: 'member',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}
```
```ts
import { test as base, expect } from 'vitest';
import { buildUser, type User } from './test/factories.ts';
import { InMemoryUserRepo } from './user-repo.ts';

const test = base.extend<{ repo: InMemoryUserRepo; admin: User }>({
  repo: async ({}, use) => {
    const repo = new InMemoryUserRepo();
    await use(repo);   // the test runs here
    repo.clear();      // teardown after the test
  },
  admin: async ({ repo }, use) => {
    const admin = buildUser({ role: 'admin' });
    await repo.save(admin);
    await use(admin);
  },
});

test('rejects deleting the last admin', async ({ repo, admin }) => {
  await expect(repo.delete(admin.id)).rejects.toThrow('Cannot delete the last admin');
});
```
Fixtures run only when a test asks for them, so tests that don't need `admin` don't pay for it.

## Production patterns
- **Watch mode while coding** (`pnpm vitest`): it reruns only tests affected by the files you change.
- **`restoreMocks: true` in config** so no test inherits another test's spies.
- **Table-driven tests (`it.each`) for pure functions** with many inputs; one row per edge case.
- **Factories with unique values** (emails, IDs), so tests never collide on unique constraints.
- **Ban `.only` in CI**: Vitest fails `vitest run` when it finds `.only` and `allowOnly` is off (the CI default).

## Mistakes
Wrong: an un-awaited rejection.
```ts
it('rejects bad input', () => {
  expect(parseOrder('x')).rejects.toThrow(); // not awaited: the test ends first and passes
});
```
Right:
```ts
it('rejects bad input', async () => {
  await expect(parseOrder('x')).rejects.toThrow('Invalid order');
});
```

Wrong: `toBe` for objects.
```ts
expect(buildUser({ email: 'a@b.c' })).toBe({ email: 'a@b.c' }); // different references: fails
```
Right:
```ts
expect(buildUser({ email: 'a@b.c' })).toMatchObject({ email: 'a@b.c' });
```

Wrong: one shared mutable fixture at module level.
```ts
const user = buildUser();
it('promotes', () => { user.role = 'admin'; /* ... */ });
it('is a member by default', () => expect(user.role).toBe('member')); // order-dependent
```
Right: build a fresh object inside each test, or use a `test.extend` fixture.

## Check yourself
1. What is the difference between `toEqual` and `toStrictEqual`?
2. Why can a test of an async rejection pass when the code is broken?
3. What advantage does a `test.extend` fixture have over `beforeEach`?

<details>
<summary>Answers</summary>

1. `toStrictEqual` also fails on `undefined`-valued keys that are missing on the other side, sparse arrays, and different classes with the same fields. `toEqual` ignores those.
2. If the assertion promise is not awaited or returned, the test function finishes before the promise settles, so Vitest sees no failure.
3. Fixtures are typed, run only for tests that request them, compose (one fixture can use another), and keep setup and teardown together.
</details>

## Sources
- [Vitest — API reference](https://vitest.dev/api/)
- [Vitest — `expect`](https://vitest.dev/api/expect.html)
- [Vitest — Test context and fixtures](https://vitest.dev/guide/test-context.html)
- [Vitest — Configuration](https://vitest.dev/config/)
