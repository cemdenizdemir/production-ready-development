---
title: Internationalization, dates, numbers, and currencies
tech: React 19.2, TypeScript, Next.js 16, Intl
version: Intl (ECMA-402), Next.js 16, React 19.2
date: 2026-11-07
covers: [4, 5]
---
# Internationalization, dates, numbers, and currencies
[← Overview](00-overview.md)

## Why it matters
- "You have 1 items" in English, and Polish needs three plural forms. String concatenation can't express either.
- A meeting at 09:00 Berlin time is shown as 09:00 to a colleague in New York, who joins six hours early.
- German translations are 30% longer; buttons overflow and the checkout button text is cut off mid-word.

## Concepts

### i18n vs l10n
- **Internationalization (i18n):** building so the app *can* be localized: externalized strings, locale-aware formatting, flexible layouts, RTL support.
- **Localization (l10n):** translating and adapting for a specific locale.

### Building blocks
| Concern | Practice |
|:--|:--|
| Locale choice | explicit user setting > URL prefix (`/de/...`) > `Accept-Language` > default |
| Messages | catalogs per locale with stable keys; no strings in components |
| Plurals, gender, select | ICU MessageFormat (`{count, plural, one {# item} other {# items}}`) or `Intl.PluralRules` |
| Interpolation | placeholders in messages; never concatenate translated fragments |
| Formatting | `Intl.NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`, `ListFormat`, `DisplayNames` |
| Sorting | `Intl.Collator` (ä, ß, accents sort correctly) |
| Text length | layouts tolerate +30–40% (German, Finnish); avoid fixed-width buttons |
| Right-to-left | `<html dir="rtl">`, logical CSS properties, mirror directional icons |
| `lang` | correct `lang` on `<html>` (and on parts in other languages) |
| SEO | `hreflang` alternates per locale ([06-rendering](../../06-rendering/docs/05-metadata-and-self-hosting.md)) |
| Testing | pseudo-localization (`[Ŝéţţîñĝš !!!]`) shows hard-coded strings and overflow |
| Workflow | key extraction, translation management system, review in context (also seen: Crowdin, Lokalise) |

Libraries (also seen): next-intl (Next.js App Router), react-intl/FormatJS (ICU), i18next. Pick one and record it in STACK.md; the concepts below apply to all of them.

### Dates and time zones
| Value | Store / send | Display |
|:--|:--|:--|
| A moment (order placed) | UTC ISO string / `timestamptz` | in the **viewer's** time zone |
| A scheduled event (meeting, flight) | moment + the **event's** IANA zone | in the event zone (and optionally the viewer's) |
| A calendar date (birthday, due date) | `YYYY-MM-DD` | as-is, never converted |
| A recurring local time ("every day at 09:00") | local time + IANA zone | compute each occurrence with the zone rules (DST) |

The browser's zone: `Intl.DateTimeFormat().resolvedOptions().timeZone`. Save it as a user preference for emails and notifications sent from the server.

### Numbers and currencies
- Format with `Intl.NumberFormat(locale, { style: 'currency', currency })`: symbol position, separators, and decimals vary by locale and currency (JPY has no minor units).
- Currency is part of the data (`{ amountCents, currency }`); locale only decides formatting. Changing the UI language must not change the currency.
- Parsing localized input ("1.234,56") is hard: prefer structured inputs, `inputMode="decimal"`, and clear format hints.

## Example
`i18n/messages.ts` — catalogs and a tiny formatter on platform APIs.
```ts
export const locales = ['en', 'de', 'ar'] as const;
export type Locale = (typeof locales)[number];

const messages = {
  en: { cartItems: { one: '{count} item in your cart', other: '{count} items in your cart' }, checkout: 'Checkout' },
  de: { cartItems: { one: '{count} Artikel im Warenkorb', other: '{count} Artikel im Warenkorb' }, checkout: 'Zur Kasse' },
  ar: {
    cartItems: { zero: 'لا توجد عناصر', one: 'عنصر واحد', two: 'عنصران', few: '{count} عناصر', many: '{count} عنصرًا', other: '{count} عنصر' },
    checkout: 'الدفع',
  },
} as const satisfies Record<Locale, unknown>;

export function plural(locale: Locale, forms: Partial<Record<Intl.LDMLPluralRule, string>>, count: number) {
  const rule = new Intl.PluralRules(locale).select(count);           // 'one', 'few', 'many', …
  const template = forms[rule] ?? forms.other ?? '';
  return template.replace('{count}', new Intl.NumberFormat(locale).format(count));
}

export const t = (locale: Locale) => messages[locale];
export const dir = (locale: Locale) => (locale === 'ar' ? 'rtl' : 'ltr');
```
`app/[locale]/layout.tsx` — locale from the URL, `lang` and `dir` on `<html>`.
```tsx
import { notFound } from 'next/navigation';
import { dir, locales, type Locale } from '@/i18n/messages';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return (
    <html lang={locale} dir={dir(locale as Locale)}>
      <body>{children}</body>
    </html>
  );
}
```
Formatting moments, events, and money:
```ts
const fmtMoment = (iso: string, locale: string, timeZone: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(iso));

fmtMoment('2026-11-07T08:00:00Z', 'de-DE', 'Europe/Berlin');      // "07.11.2026, 09:00"
fmtMoment('2026-11-07T08:00:00Z', 'en-US', 'America/New_York');   // "Nov 7, 2026, 3:00 AM"

// A meeting belongs to its own zone; show it there and label the zone
new Intl.DateTimeFormat('en-US', { timeStyle: 'short', timeZone: 'Europe/Berlin', timeZoneName: 'short' })
  .format(new Date('2026-11-07T08:00:00Z'));                          // "9:00 AM GMT+1"

const money = (cents: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
money(123456, 'EUR', 'de-DE'); // "1.234,56 €"
money(123456, 'EUR', 'en-IE'); // "€1,234.56"
money(1200, 'JPY', 'ja-JP');   // "￥12" — careful: JPY has no minor unit; store amounts in each currency's minor unit
```

## Production patterns
- **No user-facing strings in components**; keys and catalogs from day one, even with one language.
- **Locale in the URL** for public pages (shareable, crawlable, `hreflang`); user setting for logged-in apps.
- **Moments in UTC, displayed in the right zone**; events carry their own zone; dates stay dates.
- **Currency travels with amounts**; locale affects formatting only.
- **Pseudo-localize in CI or staging** to catch hard-coded strings and overflow; design layouts for long text and RTL.

## Mistakes
Wrong: concatenation.
```tsx
<p>{'You have ' + count + ' items'}</p>
```
Right: a message with plural forms and a placeholder.

Wrong: displaying times in the server's zone (often UTC) or the developer's. Right: an explicit `timeZone` for the viewer or the event.

Wrong: physical CSS (`margin-left`, `text-align: left`) in an app that supports Arabic. Right: logical properties and `dir="rtl"`.

Wrong: language flags (a flag is a country, not a language: Spanish ≠ Spain). Right: language names in their own language ("Deutsch", "العربية") via `Intl.DisplayNames`.

## Check yourself
1. Why can't you implement plurals with `count === 1 ? one : other`?
2. Which time zone do you display a scheduled meeting in?
3. Why must the currency be stored with the amount?

<details>
<summary>Answers</summary>

1. Many languages have more categories (Arabic has six, Polish and Russian three) or different rules (French treats 0 as singular). `Intl.PluralRules` or ICU messages encode these rules per locale.
2. In the event's own time zone (where the meeting is anchored), labeled with the zone, and optionally converted for the viewer. Converting blindly to the viewer's zone breaks across DST changes and in invitations.
3. Formatting depends on locale, but the value's meaning depends on the currency; switching the UI language must never turn €100 into $100.
</details>

## Sources
- [MDN — `Intl.PluralRules`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules)
- [Unicode CLDR — Language plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
- [Next.js — Internationalization](https://nextjs.org/docs/app/guides/internationalization)
- [W3C — Internationalization techniques](https://www.w3.org/International/techniques/authoring-html)
- [FormatJS — ICU message syntax](https://formatjs.github.io/docs/core-concepts/icu-syntax)
