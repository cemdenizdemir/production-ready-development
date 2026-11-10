---
title: Internationalization, dates, numbers, and currencies
tech: Intl (ECMA-402), Next.js 16, next-intl, ASP.NET Core localization
version: ECMA-402, Next.js 16.x, next-intl 4.x
date: 2026-11-09
covers: [4, 5]
---
# Internationalization, dates, numbers, and currencies
[← Overview](00-overview.md)

## Why it matters
- Strings are concatenated: `"You have " + n + " items"`. In Turkish and Arabic the word order and plural rules differ; translations become impossible.
- Prices show `€1,234.50` to German users, who expect `1.234,50 €`; and `₺` prices appear with euro formatting for Turkish users.
- "Delivered on 9 November" shows as 8 November for users in Los Angeles because a calendar date was treated as midnight UTC.

## Concepts

### What i18n covers
| Concern | Tool |
|:--|:--|
| ⭐ translated messages with variables, plurals, gender | ICU MessageFormat (next-intl, FormatJS) |
| numbers, percentages, units | `Intl.NumberFormat` |
| ⭐ currencies | `Intl.NumberFormat(locale, { style: "currency", currency })` |
| dates and times | `Intl.DateTimeFormat` with explicit `timeZone` |
| relative times | `Intl.RelativeTimeFormat` |
| lists ("A, B and C") | `Intl.ListFormat` |
| sorting and search | `Intl.Collator` (locale-aware, accent-insensitive options) |
| right-to-left | `dir="rtl"`, logical CSS properties (02-css) |
| locale routing | `/tr/...`, `/de/...` segments |

### ICU messages
```json
{
  "cart": {
    "items": "{count, plural, =0 {Your cart is empty} one {# item} other {# items}}",
    "shipsOn": "Ships on {date, date, long}"
  }
}
```
Never build sentences from pieces; each message is a complete sentence with placeholders.

### Locale routing in the App Router
`app/[locale]/layout.tsx` + `proxy.ts` that detects the locale (cookie → `Accept-Language` → default) and redirects `/coffee` to `/en/coffee`. Set `<html lang={locale}>`, add `hreflang` alternates (03-seo), and pass the locale to the ASP.NET Core API (`Accept-Language`) for localized product content and server-generated emails. next-intl is a common library for messages, formatting, and routing in Next.js.

### Dates, times, and money across the stack
| Value | C# (API) | Wire | Frontend |
|:--|:--|:--|:--|
| moment in time | `DateTimeOffset` (UTC) | ISO 8601 with offset | `Intl.DateTimeFormat(locale, { timeZone })` |
| calendar date | `DateOnly` | `"2026-11-10"` | format as a plain date, no time zone conversion |
| user time zone | stored on profile (IANA, e.g. `Europe/Istanbul`) | field | used for display |
| money | `decimal` + currency code | minor units or decimal string + `"EUR"` | `Intl.NumberFormat` currency |
| currency per market | price list per currency in API | | never convert in the browser |

Server-side formatting in Server Components must use the **user's** locale and time zone, not the server's (which is UTC in containers).

## Example
`web/src/lib/format.ts`
```ts
export function formatPrice(amountMinor: number, currency: string, locale: string) {
  const digits = new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amountMinor / 10 ** digits);
}

export function formatInstant(iso: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));
}

export function formatCalendarDate(isoDate: string, locale: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

export const relative = (days: number, locale: string) =>
  new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");    // "tomorrow", "yarın"
```
```ts
formatPrice(123450, "EUR", "de-DE");   // "1.234,50 €"
formatPrice(123450, "TRY", "tr-TR");   // "₺1.234,50"
formatCalendarDate("2026-11-10", "en-US");   // "November 10, 2026" everywhere
```
`web/src/app/[locale]/(shop)/cart/page.tsx` (with next-intl)
```tsx
import { getTranslations } from "next-intl/server";

export default async function CartPage() {
  const t = await getTranslations("cart");
  const cart = await getCart();
  return <h1>{t("items", { count: cart.lines.length })}</h1>;
}
```

## Production patterns
- All user-facing strings in message files from day one, even with one language; keys by feature.
- Locale and time zone resolved once per request and passed down; never `toLocaleString()` without arguments on the server.
- Prices and totals computed by the API per currency; the frontend formats only.
- Pseudo-localization (longer strings, accented characters) in development to catch layout breaks and hardcoded text.

## Mistakes
Wrong:
```tsx
<p>{"You have " + count + " items"}</p>
```
Right: ICU plural message.

Wrong: `new Date("2026-11-10").toLocaleDateString()` for a delivery date.
Right: format the plain date without converting it (or Temporal `PlainDate`).

## Check yourself
1. Why are concatenated strings a problem for translation?
2. Why can't Server Components use the default locale/time zone of the container?
3. Who should convert prices between currencies?

<details><summary>Answers</summary>

1. Word order, plural forms, and grammar differ by language; translators need whole sentences with placeholders.
2. Containers usually run in UTC with a default locale, so users would see dates and numbers formatted for the server, not for them.
3. The API (business rules, price lists, rounding per currency); the frontend only formats.
</details>

## Sources
- [MDN — Intl](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
- [Next.js — Internationalization](https://nextjs.org/docs/app/guides/internationalization)
- [next-intl](https://next-intl.dev/)
- [ASP.NET Core — Globalization and localization](https://learn.microsoft.com/aspnet/core/fundamentals/localization)
