---
title: TypeScript for app code, dates, and numbers
tech: TypeScript, JavaScript
version: TypeScript 6.0, ECMAScript 2025, Intl, Temporal
date: 2026-11-07
covers: [10, 11]
---
# TypeScript for app code, dates, and numbers
[← Overview](00-overview.md)

## Why it matters
- `0.1 + 0.2` is `0.30000000000000004`. Prices summed as floats show €19.989999 on an invoice, and refunds don't match charges.
- `new Date('2026-03-29')` is midnight UTC, which is the evening of March 28 in New York. A delivery date shows a day early for US customers.
- A function typed `(data: any)` accepts anything; a renamed API field compiles fine and breaks the order page in production.

## Concepts

### TypeScript for app code
| Feature | Use |
|:--|:--|
| Inference | let TS infer locals; annotate parameters and exported return types |
| Union + literal types | `type Status = 'pending' \| 'paid' \| 'shipped'` |
| Narrowing | `typeof`, `in`, `instanceof`, equality, discriminant checks |
| Discriminated unions | `{ kind: 'ok'; data: T } \| { kind: 'error'; error: string }` |
| Generics with constraints | `function byId<T extends { id: string }>(items: T[], id: string)` |
| Utility types | `Partial`, `Required`, `Pick`, `Omit`, `Record`, `Readonly`, `ReturnType`, `Parameters`, `Awaited`, `NonNullable` |
| `keyof`, `typeof`, indexed access | `type Keys = keyof User`; `type Role = User['role']` |
| `as const` objects | constant maps instead of `enum` |
| `satisfies` | check a value against a type, keep the narrow type |
| `unknown` over `any` | force checks before use |
| Mapped / conditional types | know they exist; reach for them in libraries, rarely in app code |

Avoid `enum` and `namespace` (not erasable; Node type stripping and `erasableSyntaxOnly` reject them). Use unions of string literals or `as const` objects.

### Numbers
| Problem | Practice |
|:--|:--|
| Floating point (`0.1 + 0.2`) | money as **integer minor units** (cents); format only for display |
| Large integers (> 2^53) | `BigInt` or strings (IDs from Postgres `bigint` arrive as strings via `pg`) |
| Rounding | `Math.round` on integers; `toFixed` returns a string and has edge cases |
| Parsing | `Number(x)` + `Number.isFinite`; `parseInt(x, 10)` with a radix |
| Display | `Intl.NumberFormat` with `style: 'currency'` |

### Dates and time zones
| Problem | Practice |
|:--|:--|
| `Date` is a UTC timestamp shown in local time | store and send UTC ISO 8601 (`2026-11-07T09:30:00Z`); Postgres `timestamptz` |
| Date-only values (birthdays, delivery days) | keep as `YYYY-MM-DD` strings or `Temporal.PlainDate`; never convert through `Date` |
| Parsing non-ISO strings | unreliable across browsers: don't |
| Months are 0-based in `Date` | another reason to prefer Temporal |
| Display | `Intl.DateTimeFormat(locale, { dateStyle, timeStyle, timeZone })` |
| Relative times | `Intl.RelativeTimeFormat` ("3 days ago") |

**Temporal** replaces `Date` with explicit, immutable types: `Temporal.Instant` (exact moment), `Temporal.ZonedDateTime` (moment + time zone), `Temporal.PlainDate` / `PlainTime` / `PlainDateTime` (wall-clock values without a zone), `Temporal.Duration`. It's on by default in Node 26 and shipping in Firefox and Chrome; check Safari support or use a polyfill.

### Intl at a glance
`Intl.NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`, `PluralRules`, `ListFormat`, `Collator` (locale-aware sorting), `Segmenter` (graphemes, words), `DisplayNames` (country/language names), `DurationFormat`. Full i18n is in [12-cross-cutting](../../12-cross-cutting/README.md).

## Example
`money.ts` and `dates.ts`
```ts
export type Money = { amountCents: number; currency: 'EUR' | 'USD' | 'GBP' };

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  return { amountCents: a.amountCents + b.amountCents, currency: a.currency };
}

export function formatMoney(m: Money, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(m.amountCents / 100);
}

formatMoney({ amountCents: 1999, currency: 'EUR' }, 'de-DE'); // "19,99 €"
formatMoney({ amountCents: 1999, currency: 'EUR' }, 'en-IE'); // "€19.99"
```
```ts
// A moment in time, shown in the user's zone
export function formatOrderTime(isoUtc: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone })
    .format(new Date(isoUtc));
}
formatOrderTime('2026-11-07T09:30:00Z', 'en-US', 'America/New_York'); // "Nov 7, 2026, 4:30 AM"

// A calendar date: no time zone involved (Temporal where available)
const delivery = Temporal.PlainDate.from('2026-11-12');
const reminder = delivery.subtract({ days: 2 });   // 2026-11-10, never shifted by zones

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
rtf.format(-1, 'day');                              // "yesterday"
```
Types that model API results:
```ts
type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

const STATUS_LABEL = { pending: 'Pending', paid: 'Paid', shipped: 'Shipped' } as const;
type OrderStatus = keyof typeof STATUS_LABEL;      // 'pending' | 'paid' | 'shipped'

function render(result: ApiResult<{ status: OrderStatus }>) {
  if (!result.ok) return `Error ${result.status}: ${result.message}`; // narrowed
  return STATUS_LABEL[result.data.status];
}
```

## Production patterns
- **Money = integer cents + currency code** end to end (DB, API, UI). Format at the edge with `Intl`.
- **Moments as UTC ISO strings**, calendar dates as `YYYY-MM-DD`; convert to local time only for display, with an explicit `timeZone`.
- **Store the user's time zone** (IANA name like `Europe/Berlin`) when schedules matter (reminders at 9:00 local).
- **Types from schemas** (Zod) at API boundaries; unions and discriminants for states inside.
- **No `any`** in app code; `unknown` plus narrowing at the edges.

## Mistakes
Wrong: floats for money.
```ts
const total = items.reduce((s, i) => s + i.price * i.qty, 0); // 19.989999999
```
Right: integer cents, and `Intl.NumberFormat` only for display.

Wrong: date-only values through `Date`.
```ts
new Date('2026-11-12').getDate(); // 11 in New York: UTC midnight is the previous evening
```
Right: keep `'2026-11-12'` as a string, or `Temporal.PlainDate.from('2026-11-12')`.

Wrong: `enum` in code that Node runs or `erasableSyntaxOnly` checks.
```ts
enum Status { Pending, Paid } // not erasable; also numeric values leak into APIs
```
Right: `const Status = { Pending: 'pending', Paid: 'paid' } as const;` or a literal union.

Wrong: `parseInt('08')` habits and `Number('')` → `0` surprises. Right: validate inputs with a schema (`z.coerce.number().int()`).

## Check yourself
1. Why store money as integer cents?
2. What is the difference between `Temporal.Instant` and `Temporal.PlainDate`?
3. When should you annotate types explicitly instead of relying on inference?

<details>
<summary>Answers</summary>

1. Binary floating point can't represent most decimal fractions exactly, so sums drift. Integers are exact; you format as currency only when displaying.
2. An `Instant` is an exact point on the global timeline (like a UTC timestamp). A `PlainDate` is a calendar date with no time or zone, such as a birthday; it never shifts across time zones.
3. At boundaries: function parameters, exported function return types, public APIs, and values coming from outside (validated). Inside functions, inference is usually clearer.
</details>

## Sources
- [TypeScript Handbook — Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript — Utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [MDN — `Intl`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [MDN — Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)
- [TC39 — Temporal documentation](https://tc39.es/proposal-temporal/docs/)
- [What every programmer should know about floating-point](https://floating-point-gui.de/)
