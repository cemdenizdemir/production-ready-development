---
title: Cross-Cutting Frontend cheatsheet
tech: React 19.2, TypeScript, Tailwind CSS 4
version: React 19.2, Next.js 16, Tailwind CSS 4.3, Intl (ECMA-402), Baseline 2025
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Cross-Cutting Frontend cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Responsive
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ mobile-first | base small, add `md:`/`lg:` | |
| ⭐ container queries | `@container` + `@md:` | components |
| intrinsic grids | `auto-fit` + `minmax` | |
| touch targets | ≥ 44 px (≥ 24 px WCAG min) | |
| `hover:` | enhancement only | touch |
| `pointer: coarse` | touch tweaks | media query |
| `dvh` | full-height panels | |
| test matrix | 320/375/tablet/desktop/200% zoom | |

## Tokens and components
| Item | Does | Note |
|:--|:--|:--|
| primitive tokens | raw values | one file |
| ⭐ semantic tokens | brand, surface, danger | components use these |
| component tokens | rare overrides | |
| `@theme` | tokens → utilities | Tailwind 4 |
| `@theme inline` | map runtime vars | theming |
| ⭐ `components/ui` | Button, Input, Field, Dialog, Toast… | accessible |
| `cva` + `tailwind-merge` | variants | |
| Storybook / `/dev/components` | catalog | also seen |

## Theming
| Item | Does | Note |
|:--|:--|:--|
| `light-dark()` / `.dark` vars | two themes | |
| `color-scheme: light dark` | native controls | |
| `@custom-variant dark` | class-based dark | Tailwind |
| ⭐ pre-paint script | no theme flash | CSP nonce/hash |
| `suppressHydrationWarning` on `<html>` | class differs | |
| cookie/localStorage + system | preference order | |
| contrast in both themes | a11y | |

## Assets as a system
| Asset | Practice | Note |
|:--|:--|:--|
| icons | one set, per-icon imports, `currentColor` | `aria-hidden` |
| images | `next/image`, standard ratios | alt from data |
| fonts | `next/font`, CSS variables | ≤ 2 families |
| SVG illustrations | `currentColor` | theme-aware |

## i18n
| Item | Does | Note |
|:--|:--|:--|
| ⭐ ICU messages | plurals, variables | full sentences |
| `{count, plural, one {#} other {#}}` | plural syntax | |
| next-intl | messages, routing, formatting | Next.js |
| `[locale]` segment | locale routing | `/tr/...` |
| `proxy.ts` detection | cookie → Accept-Language | |
| `<html lang dir>` | language, direction | RTL |
| `hreflang` | alternates | SEO |
| `Accept-Language` to API | localized content | ASP.NET Core |
| pseudo-localization | catch hardcoded text | dev |

## Intl formatting
| API | Use | Note |
|:--|:--|:--|
| ⭐ `NumberFormat` currency | prices | API computes amounts |
| `NumberFormat` unit/percent/compact | numbers | |
| ⭐ `DateTimeFormat` + `timeZone` | instants | user's zone |
| plain dates | format without conversion | `DateOnly` |
| `RelativeTimeFormat` | "tomorrow" | `numeric: "auto"` |
| `ListFormat` | "A, B and C" | |
| `Collator` | sorting/search | |
| `PluralRules` | plural category | |
| `Segmenter` | graphemes/words | |

## Dates and money across the stack
| Value | C# | Wire |
|:--|:--|:--|
| ⭐ instant | `DateTimeOffset` | ISO 8601 + offset |
| ⭐ calendar date | `DateOnly` | `YYYY-MM-DD` |
| user time zone | IANA string | `Europe/Istanbul` |
| ⭐ money | `decimal` + currency | minor units / decimal string |
| currency per market | price lists in API | no browser conversion |

## SEO
| Item | Does | Note |
|:--|:--|:--|
| ⭐ server-rendered content | crawlable | RSC |
| `generateMetadata` | titles, descriptions | |
| ⭐ canonical | dedupe filtered URLs | |
| `noindex` | search, cart, account, non-prod | |
| `app/sitemap.ts` | sitemap from API | 50k URL limit per file |
| `app/robots.ts` | robots.txt | per env |
| JSON-LD | Product, Offer, Breadcrumb | escape `<` |
| `notFound()` / 308 | correct status | moved products |

## Browser support
| Item | Does | Note |
|:--|:--|:--|
| ⭐ Baseline newly / widely | support levels | |
| browserslist | shared target | |
| `@supports` | CSS fallback | |
| feature detection | JS fallback | |
| conditional polyfills | only when needed | |
| Playwright projects | Chromium/Firefox/WebKit | CI |
| analytics-driven floor | drop old browsers | |

## Offline basics
| Item | Does | Note |
|:--|:--|:--|
| offline banner | status | 09-ux-states |
| service worker | static assets, offline page | never transactional data |
| `app/manifest.ts` | installable | |
| Serwist | SW tooling for Next.js | also seen |
| background sync | retry queue | limited support |

## Feature flags
| Item | Does | Note |
|:--|:--|:--|
| ⭐ API-evaluated | `GET /me/features` | consistent with API |
| server-side render | no flicker | RSC |
| client SDK | instant toggles | flicker risk |
| ⭐ safe defaults | off on errors | kill switches |
| same names in C# and TS | one source | generate list |
| owner + removal date | cleanup | |
| per-variant monitoring | errors, conversion | Sentry tags |

## Analytics and consent
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ opt-in before non-essential | GDPR/ePrivacy | |
| equal reject/accept | no dark patterns | |
| categories | necessary/analytics/marketing/preferences | |
| record consent | version + choices + time | |
| withdraw | footer link | |
| ⭐ typed event map | consistent events | |
| no PII | hashed IDs | |
| server-side revenue events | `order_placed` from API | |
| Consent Mode v2 / TCF | Google/ads requirements | also seen |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| hex colors in features | rebrand pain | semantic tokens |
| theme in `useEffect` | flash | pre-paint |
| concatenated strings | untranslatable | ICU |
| server-default locale | wrong formats | user locale/zone |
| browser currency conversion | wrong prices | API |
| indexing filters | crawl waste | canonical/noindex |
| SW caching checkout | stale prices | static only |
| frontend-only flags | inconsistent | API evaluation |
| analytics before consent | fines | consent gate |

## Sources
| Source | Link |
|:--|:--|
| Tailwind theme | https://tailwindcss.com/docs/theme |
| Next.js i18n | https://nextjs.org/docs/app/guides/internationalization |
| next-intl | https://next-intl.dev/ |
| MDN Intl | https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl |
| Google SEO starter | https://developers.google.com/search/docs/fundamentals/seo-starter-guide |
| Baseline | https://web.dev/baseline |
| .NET feature management | https://learn.microsoft.com/azure/azure-app-configuration/feature-management-dotnet-reference |
| EDPB consent | https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en |
