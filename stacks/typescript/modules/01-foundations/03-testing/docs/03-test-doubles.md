---
title: Test doubles, time, and modules
tech: Vitest 4, TypeScript
version: Vitest 4.x, Node.js 26 LTS
date: 2026-11-07
covers: [4, 5]
---
# Test doubles, time, and modules
[← Overview](00-overview.md)

## Why it matters
- Every dependency is mocked, all tests pass, and production fails on the first real SQL query because the mocked repository returned data the real one never would.
- A test for "retry after 30 seconds" really waits 30 seconds. The suite takes 20 minutes and nobody runs it.
- A `vi.mock` path doesn't match the import, so the real email client runs in tests and sends mail to customers from a laptop.

## Concepts

### Kinds of test doubles
| Double | What it does | Example |
|:--|:--|:--|
| Dummy | fills a parameter, never used | `null as never` for an unused logger |
| Stub | returns canned answers | `getRate: () => 1.1` |
| Spy | records calls; may keep real behavior | `vi.spyOn(console, 'warn')` |
| Mock | stub + expectations about calls | `expect(send).toHaveBeenCalledWith(...)` |
| Fake | working lightweight implementation | in-memory repository, fake clock |

### When to use one
| Dependency | Use a double? |
|:--|:--|
| Third-party APIs (payments, email, SMS) | ✓ fake or stub; HTTP-level with MSW |
| Time, randomness, IDs | ✓ fake clock, seeded or injected values |
| Your own database | ✗ in integration tests: run it for real (lesson 04) |
| The module under test | ✗ never |
| Your own small pure helpers | ✗ just call them |

Mocks verify *interactions*. Use them when the interaction is the behavior ("we sent exactly one receipt email"), not to check internal plumbing.

### Seams: injection first, module mocks second
The cleanest seam is a parameter: pass the clock, mailer, or HTTP client in. Module mocking (`vi.mock`) is for code you can't easily change.

### Vitest tools
| Tool | Use |
|:--|:--|
| `vi.fn()` | standalone mock function; `.mockReturnValue`, `.mockResolvedValue`, `.mockImplementation` |
| `vi.spyOn(obj, 'method')` | spy on an existing method; restore with `mockRestore` |
| `vi.mock('./module.ts', factory)` | replace a module; hoisted to the top of the file |
| `vi.hoisted(() => ...)` | create values usable inside a hoisted `vi.mock` factory |
| `vi.importActual()` | keep the real module and override parts |
| `vi.mocked(fn)` | typed access to a mocked function |
| `vi.useFakeTimers()` / `vi.useRealTimers()` | control `setTimeout`, `setInterval`, `Date` |
| `vi.advanceTimersByTime(ms)` / `vi.runAllTimers()` | move fake time forward |
| `vi.setSystemTime(date)` | fix `Date.now()` and `new Date()` |
| `vi.stubEnv('KEY', 'v')` / `vi.stubGlobal('fetch', fn)` | env vars and globals, undone by `unstubAllEnvs`/`unstubAllGlobals` |

## Example
`src/reminders.ts` — dependencies are injected.
```ts
export type Mailer = { send(to: string, subject: string): Promise<void> };
export type Clock = { now(): Date };
export type Invoice = { id: string; email: string; dueAt: Date; paid: boolean };

export async function sendOverdueReminders(invoices: Invoice[], mailer: Mailer, clock: Clock) {
  const now = clock.now();
  const overdue = invoices.filter((i) => !i.paid && i.dueAt < now);
  for (const invoice of overdue) {
    await mailer.send(invoice.email, `Invoice ${invoice.id} is overdue`);
  }
  return overdue.length;
}
```
`src/reminders.test.ts`
```ts
import { expect, it, vi } from 'vitest';
import { sendOverdueReminders, type Invoice } from './reminders.ts';

const clock = { now: () => new Date('2026-11-07T09:00:00Z') }; // fake
const invoice = (over: Partial<Invoice>): Invoice => ({
  id: 'inv-1', email: 'a@example.test', dueAt: new Date('2026-11-01'), paid: false, ...over,
});

it('emails only unpaid invoices past their due date', async () => {
  const mailer = { send: vi.fn().mockResolvedValue(undefined) }; // mock: the email IS the behavior

  const count = await sendOverdueReminders(
    [invoice({ id: 'late' }), invoice({ id: 'paid', paid: true }), invoice({ id: 'future', dueAt: new Date('2026-12-01') })],
    mailer,
    clock,
  );

  expect(count).toBe(1);
  expect(mailer.send).toHaveBeenCalledExactlyOnceWith('a@example.test', 'Invoice late is overdue');
});
```
Fake timers for retry delays, `src/retry.test.ts`:
```ts
import { afterEach, expect, it, vi } from 'vitest';
import { retry } from './retry.ts'; // retries fn with 1s, 2s, 4s delays

afterEach(() => vi.useRealTimers());

it('retries with backoff and succeeds on the third try', async () => {
  vi.useFakeTimers();
  const fn = vi.fn()
    .mockRejectedValueOnce(new Error('down'))
    .mockRejectedValueOnce(new Error('down'))
    .mockResolvedValue('ok');

  const promise = retry(fn, { attempts: 3, baseDelayMs: 1_000 });
  await vi.advanceTimersByTimeAsync(1_000 + 2_000); // runs timers and flushes promises in between

  await expect(promise).resolves.toBe('ok');
  expect(fn).toHaveBeenCalledTimes(3);
});
```
Module mocking when you can't inject, `src/signup.test.ts`:
```ts
import { expect, it, vi } from 'vitest';
import { signup } from './signup.ts';
import { sendWelcomeEmail } from './email.ts';

vi.mock('./email.ts', () => ({ sendWelcomeEmail: vi.fn() })); // same specifier signup.ts imports

it('sends a welcome email after signup', async () => {
  await signup({ email: 'new@example.test' });
  expect(vi.mocked(sendWelcomeEmail)).toHaveBeenCalledWith('new@example.test');
});
```

## Production patterns
- **Inject time, randomness, and external clients.** Tests become plain function calls with no mocking library.
- **Fake at the network edge with MSW** for outgoing HTTP: the real client code, headers, and parsing all run ([02-frontend/13](../../../02-frontend/13-testing-monitoring/README.md) covers MSW).
- **Prefer fakes over deep mock chains.** An in-memory repository is reusable and behaves like a repository.
- **Restore everything after each test** (`restoreMocks: true`, `vi.useRealTimers()` in `afterEach`).
- **A contract test or integration test backs every fake**, so the fake can't drift from the real thing.

## Mistakes
Wrong: mocking the database in an "integration" test.
```ts
vi.mock('./db.ts', () => ({ query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }] }) }));
// the SQL is never executed: typos, constraints, and migrations are untested
```
Right: run Postgres in a container (lesson 04) and keep mocks for third parties.

Wrong: really waiting in tests.
```ts
await new Promise((r) => setTimeout(r, 30_000));
```
Right: `vi.useFakeTimers()` and `await vi.advanceTimersByTimeAsync(30_000)`.

Wrong: asserting every internal call.
```ts
expect(repo.findById).toHaveBeenCalledBefore(repo.save); // pins implementation order
```
Right: assert the observable result: the saved record, the response, the email sent.

Wrong: a `vi.mock` specifier that differs from the import (`'./email'` vs `'./email.ts'`, or a path alias). The real module runs.
Right: mock the exact specifier the code under test resolves, and assert the mock was called.

## Check yourself
1. What is the difference between a stub and a mock?
2. When is a fake better than `vi.fn()` chains?
3. Why use `advanceTimersByTimeAsync` instead of `advanceTimersByTime` for async retry code?

<details>
<summary>Answers</summary>

1. A stub only supplies answers so the code can run. A mock also carries expectations: the test asserts how it was called.
2. When many tests need the dependency to behave realistically (save then find, uniqueness, ordering). A fake implements the behavior once; mock chains re-script it in every test and drift.
3. The async version flushes pending promises between timers, so code that awaits after each delay gets to schedule its next timer before time moves on.
</details>

## Sources
- [Vitest — Mocking guide](https://vitest.dev/guide/mocking.html)
- [Vitest — `vi` API](https://vitest.dev/api/vi.html)
- [Martin Fowler — Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html)
- [Martin Fowler — Test Double](https://martinfowler.com/bliki/TestDouble.html)
