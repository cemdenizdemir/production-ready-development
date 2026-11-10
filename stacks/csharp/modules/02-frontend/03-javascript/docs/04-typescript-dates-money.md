---
title: TypeScript for app code; dates, numbers, and money
tech: TypeScript, JavaScript Intl, Temporal
version: TypeScript 6.0, ECMA-402 (Intl)
date: 2026-11-09
covers: [10, 11]
---
# TypeScript for app code; dates, numbers, and money
[← Overview](00-overview.md)

## Why it matters
- The C# API sends `"total": 12.10` (a JSON number from a `decimal`). JavaScript reads it as a binary float; summing 300 lines shows `€3629.9999999999995`.
- A delivery date `2026-11-10` is parsed with `new Date("2026-11-10")` (UTC midnight) and displayed as 9 November for users in New York.
- An API response type is declared as `Order` but the API returns `status: "Refunded"`, a value the union doesn't include; the UI crashes in a `switch`.

## Concepts

### TypeScript for app code
| Feature | Use | C# parallel |
|:--|:--|:--|
| inference | `const total = lines.reduce(...)` is `number` without annotation | `var` |
| ⭐ union types | `type Status = "Placed" \| "Paid" \| "Shipped"` | enums; C# 15 unions |
| ⭐ narrowing | `if (typeof x === "string")`, `in`, `instanceof`, discriminants | pattern matching |
| discriminated unions | `{ kind: "card"; last4: string } \| { kind: "bank"; iban: string }` | sealed record hierarchy |
| exhaustiveness | `default: const _: never = x;` | CS8509 warning |
| generics | `function first<T>(xs: T[]): T \| undefined` | generics |
| utility types | `Partial<T>`, `Pick<T, K>`, `Omit<T, K>`, `Record<K, V>`, `Readonly<T>`, `ReturnType<F>`, `Awaited<P>` | — |
| `satisfies` | check a value against a type, keep its literal type | — |
| `unknown` | safe "any"; must narrow | `object` + checks |
| `as const` | literal, readonly | `const` |

Types are erased at runtime. Data crossing the network is `unknown` until validated. In this stack, Orval generates both the TypeScript types **and** Zod schemas from the API's OpenAPI document, so the frontend can validate responses where it matters (10-forms, 05-state-management).

### Numbers and money
- JavaScript `number` is a 64-bit float. `0.1 + 0.2 !== 0.3`. Integers are exact up to `Number.MAX_SAFE_INTEGER` (2⁵³−1).
- C# `decimal` is exact base-10. Serialized by System.Text.Json as a JSON number, it loses that property in the browser.

| Option for money across the API | Pros | Cons |
|:--|:--|:--|
| ⭐ integer minor units (`totalMinor: 1210`) | exact, simple arithmetic | convert for display |
| decimal as string (`"12.10"`) | exact | parse for arithmetic (use a decimal library) |
| JSON number from `decimal` | default | float rounding in JS |

Display with `Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(minor / 100)`. Don't do money math in floats; let the API compute totals.

`bigint` for IDs beyond 2⁵³ (`long` in C#): serialize large `long` values as strings from the API, or use `Guid`/strings for IDs.

### Dates and times
| Kind of value | API (C#) | Frontend |
|:--|:--|:--|
| an instant (paid at) | `DateTimeOffset` → ISO 8601 with offset `2026-11-09T14:30:00+00:00` | `new Date(iso)` or `Temporal.Instant.from(iso)` |
| a calendar date (delivery day, birthday) | `DateOnly` → `"2026-11-10"` | `Temporal.PlainDate.from(s)`; never `new Date(s)` |
| a time of day | `TimeOnly` → `"14:30:00"` | `Temporal.PlainTime` |
| durations | `TimeSpan` | `Temporal.Duration` |

`Date` is a UTC instant with local-time helpers and many traps. **Temporal** has separate types for instants, plain dates, and zoned date-times; use it (or a polyfill) for date logic. Format for humans with `Intl.DateTimeFormat` / `toLocaleDateString(locale, { timeZone })`.

`Intl` APIs: `NumberFormat` (currency, units, compact), `DateTimeFormat`, `RelativeTimeFormat` ("in 3 days"), `PluralRules`, `ListFormat`, `Collator` (locale-aware sorting), `Segmenter` (grapheme-safe string splitting).

## Example
`web/src/lib/money.ts`
```ts
export type Money = { amountMinor: number; currency: "EUR" | "USD" | "TRY" };

const minorDigits: Record<Money["currency"], number> = { EUR: 2, USD: 2, TRY: 2 };

export function formatMoney(m: Money, locale: string): string {
  const value = m.amountMinor / 10 ** minorDigits[m.currency];
  return new Intl.NumberFormat(locale, { style: "currency", currency: m.currency }).format(value);
}
```
`web/src/orders/status.ts`
```ts
export type OrderStatus = "Placed" | "Paid" | "Shipped" | "Cancelled";

export function statusLabel(s: OrderStatus): string {
  switch (s) {
    case "Placed": return "Order placed";
    case "Paid": return "Paid";
    case "Shipped": return "On its way";
    case "Cancelled": return "Cancelled";
    default: {
      const unreachable: never = s;          // compile error if a new status is added and not handled
      return unreachable;
    }
  }
}

export function deliveryLabel(isoDate: string, locale: string): string {
  const d = Temporal.PlainDate.from(isoDate);                     // "2026-11-10", no time zone shift
  return d.toLocaleString(locale, { weekday: "long", day: "numeric", month: "long" });
}
```

## Production patterns
- Agree on wire formats with the API team (yourself): money in minor units or strings, dates as ISO 8601, `DateOnly` for calendar dates, IDs as strings.
- Generated types from OpenAPI; validate untrusted data at the boundary with the generated Zod schemas.
- `never` exhaustiveness checks on every switch over a union from the API; handle unknown values gracefully at runtime too.
- All user-facing formatting through `Intl` with the user's locale and time zone.

## Mistakes
Wrong: float money math.
```ts
const total = lines.reduce((s, l) => s + l.price * l.qty, 0);   // 12.1 * 3 = 36.300000000000004
```
Right: integer minor units, or let the API return totals.

Wrong: `new Date("2026-11-10")` for a calendar date.
Right: `Temporal.PlainDate.from("2026-11-10")` (or treat it as a string and format by parts).

## Check yourself
1. Why can a C# `decimal` turn into a rounding bug in the browser?
2. Which C# type should a delivery date be, and how should the frontend parse it?
3. What does assigning to a `never` variable in `default` give you?

<details><summary>Answers</summary>

1. It's serialized as a JSON number; JavaScript parses numbers as binary floats, which can't represent many decimal fractions exactly.
2. `DateOnly`, sent as `"2026-11-10"`; parse with `Temporal.PlainDate`, not `new Date`, to avoid time zone shifts.
3. A compile-time error when a new union member isn't handled.
</details>

## Sources
- [TypeScript handbook — Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript — Utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [MDN — Temporal](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal)
- [MDN — Intl](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [System.Text.Json — DateOnly and TimeOnly support](https://learn.microsoft.com/dotnet/standard/datetime/how-to-use-dateonly-timeonly)
