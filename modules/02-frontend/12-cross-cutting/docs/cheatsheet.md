---
title: Cross-Cutting Frontend cheatsheet
tech: React 19.2, TypeScript, Tailwind CSS 4
version: React 19.2, Next.js 16, Tailwind CSS 4.3, Intl (ECMA-402), Baseline 2025
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Cross-Cutting Frontend cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Design tokens
| Layer | Example | Note |
|:--|:--|:--|
| Primitive | `--color-blue-600`, `--space-4` | palette |
| ⭐ Semantic | `--color-surface`, `--color-text`, `--color-muted`, `--color-danger` | used by components |
| Component | `--button-radius` | optional |
| ⭐ Tailwind `@theme` | tokens → utilities + CSS vars | `bg-surface`, `text-muted` |
| Themes | redefine semantic tokens | light, dark, high contrast, brands |
| Design Tokens format | W3C community group spec | tooling interchange |

## Component library
| Practice | What it gives |
|:--|:--|
| ⭐ Few primitives | Button, Field, Input, Select, Checkbox, Dialog, Toast, Card, Badge, Skeleton |
| ⭐ Typed variants | `variant`, `size` maps |
| ⭐ Composition | children, slots, compound components |
| ⭐ A11y built in | names, focus, keyboard, ARIA wiring |
| States built in | hover, focus-visible, disabled, loading, invalid |
| Docs | examples per component (also seen: Storybook) |
| Headless behavior libs | React Aria, Radix UI, Headless UI (also seen) |
| Copy-in components | shadcn/ui (also seen) |

## Responsive
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Mobile-first | base styles small, `md:` up | |
| ⭐ Container queries | component-level responsiveness | `@container`, `@md:` |
| ⭐ Touch targets | ≥ 24 px (44 px preferred) | WCAG 2.2 |
| `pointer: coarse` / `hover: hover` | input-specific styles | |
| `env(safe-area-inset-*)` | notches, home indicator | `viewport-fit=cover` |
| `dvh` | mobile viewport height | |
| Responsive tables | cards on mobile or scrollable region | |
| Real-device testing | iOS Safari, Android | |

## Theming
| Approach | Flash? | Note |
|:--|:--|:--|
| ⭐ `color-scheme` + `light-dark()` | no | OS preference only |
| `prefers-color-scheme` media | no | OS preference |
| Cookie read on server | no | request-specific page |
| ⭐ Inline `<head>` script + `localStorage` | no | needs CSP nonce/hash |
| Theme in `useEffect` | yes | avoid |
| `suppressHydrationWarning` on `<html>` | allow attribute mismatch | theme attribute |
| `@custom-variant dark (…)` | attribute/class dark mode | Tailwind 4 |
| next-themes | theme provider | also seen |

## Assets
| Asset | System |
|:--|:--|
| ⭐ Icons | inline SVG, `currentColor`, `aria-hidden` default |
| Icon sprite | `<use href="#id">` | 
| ⭐ Images | `next/image`, sizes per slot |
| ⭐ Fonts | `next/font` → CSS var → `--font-sans` |
| Illustrations | theme-aware SVG |
| Favicons | `app/icon.tsx` / `favicon.ico` |

## Internationalization
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Message catalogs | strings out of components | keys per locale |
| ⭐ ICU MessageFormat | plural/select/placeholders | `{count, plural, one {#} other {#}}` |
| ⭐ `Intl.PluralRules` | plural category per locale | zero/one/two/few/many/other |
| ⭐ No concatenation | full sentences with placeholders | |
| Locale negotiation | setting > URL > `Accept-Language` > default | |
| ⭐ Locale routing | `app/[locale]/…` + `generateStaticParams` | Next.js |
| `proxy.ts` locale redirect | detect and redirect | |
| ⭐ `<html lang dir>` | language + direction | |
| ⭐ RTL | logical CSS, `dir="rtl"`, mirrored icons | |
| Text expansion | +30–40% | flexible layouts |
| `Intl.DisplayNames` | language/country names | no flags for languages |
| `Intl.Collator` | locale-aware sorting | |
| `Intl.ListFormat` | "A, B and C" | |
| Pseudo-localization | find hard-coded strings, overflow | |
| `hreflang` | language alternates | SEO |
| Libraries | next-intl, react-intl/FormatJS, i18next | also seen |
| TMS | Crowdin, Lokalise | also seen |

## Dates and time zones
| Value | Store | Display |
|:--|:--|:--|
| ⭐ Moment | UTC ISO / `timestamptz` | viewer's zone |
| ⭐ Scheduled event | moment + event IANA zone | event zone (+ viewer) |
| ⭐ Calendar date | `YYYY-MM-DD` | as-is |
| Recurring local time | local time + zone | compute per occurrence |
| Viewer zone | `Intl.DateTimeFormat().resolvedOptions().timeZone` | save as preference |
| `timeZoneName: 'short'` | label the zone | "GMT+1" |
| `Intl.RelativeTimeFormat` | "in 3 days" | |
| Temporal | explicit zoned/plain types | newer in browsers |
| DST | 23/25-hour days | test transitions |

## Numbers and currencies
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `Intl.NumberFormat(locale, { style: 'currency', currency })` | money display | |
| ⭐ Currency with amount | `{ amountCents, currency }` | locale ≠ currency |
| Minor units vary | JPY 0, EUR 2, KWD 3 decimals | store per currency |
| `notation: 'compact'` | "1.2K" | |
| `style: 'unit'` | "5 km", "3 GB" | |
| `style: 'percent'` | "12%" | |
| Localized input parsing | hard; prefer structured inputs | `inputMode="decimal"` |

## SEO
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Server-rendered content | crawlable | RSC/SSR |
| ⭐ Real links | `<Link href>` → `<a>` | |
| ⭐ Unique title + description | per page | `generateMetadata` |
| ⭐ Canonical | one URL per content | |
| ⭐ `sitemap.ts` / `robots.ts` | crawler files | per environment |
| `noindex` | keep pages out of results | app screens, staging |
| ⭐ Real 404 / 301 | correct status codes | no soft 404s |
| ⭐ JSON-LD | Product, BreadcrumbList, Organization, Article | escape `<` |
| Open Graph images | link previews | `opengraph-image.tsx` |
| Search Console | coverage, CWV, sitemaps | |
| CWV | ranking signal | 07-performance |

## Browser support
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Baseline widely available | safe default target | 30+ months support |
| ⭐ browserslist | shared targets | `baseline widely available` query |
| Vite `build.target` | defaults to Baseline widely available | since Vite 7 |
| ⭐ `@supports` | CSS feature detection | |
| JS feature detection | `'x' in obj` checks | |
| Conditional polyfills | only where needed | |
| ⭐ WebKit testing | all iOS browsers use WebKit | Playwright `webkit` |
| Analytics-driven targets | support what users run | |

## Offline and PWA
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `app/manifest.ts` | installable app metadata | |
| Service worker | network proxy in the browser | caching, push |
| Cache-first | static assets | |
| ⭐ Network-first | HTML, API | avoid stale code |
| Stale-while-revalidate | non-critical data | |
| Offline fallback page | when navigation fails | |
| Update prompt | new version waiting | `skipWaiting` on consent |
| Kill switch | unregister broken SW | |
| Web Push | notifications | iOS 16.4+ installed PWAs |
| Workbox / Serwist | SW tooling | also seen |

## Feature flags (frontend)
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Server-side evaluation | no flicker | pass booleans down |
| Client SDK + bootstrap | live updates, no flicker | |
| ⭐ Sticky rollout | hash(flag + userId) % 100 | |
| Flag variants on events | cohort analysis | |
| Owner + removal date | flag debt control | |
| Kill switch safe default | resilience | |
| OpenFeature | vendor-neutral SDKs | also seen |

## Analytics
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Questions first | measure what matters | |
| ⭐ `object_action` names | `checkout_started` | |
| ⭐ Typed event catalog | documented, no typos | |
| ⭐ No PII in events | IDs only | |
| Server-side conversions | reliable | ad blockers |
| `sendBeacon` | delivery on page hide | |
| First-party endpoint | control and resilience | `/api/events` |
| Cookieless analytics | Plausible, Fathom, Umami | also seen |

## Consent and privacy
| Rule | Practice |
|:--|:--|
| ⭐ Opt-in before tracking (EU) | load non-essential scripts after consent |
| ⭐ Reject as easy as accept | no dark patterns |
| Categories | necessary, preferences, analytics, marketing |
| Record + revisit | store choice/date; footer settings link |
| Google Consent Mode v2 | EEA ads measurement |
| ⭐ Global Privacy Control | honor `navigator.globalPrivacyControl` |
| Data minimization + retention | collect less, delete on schedule |
| CMP | consent management platform (also seen) |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Palette colors in components | inconsistent dark mode | semantic tokens |
| Theme set in effect | flash | head script / CSS-only |
| PNG icons / icon fonts | blurry, inaccessible | inline SVG |
| String concatenation | broken grammar/plurals | ICU messages |
| Times in server zone | wrong hours | explicit `timeZone` |
| Currency from locale | wrong money | currency in data |
| Language flags | wrong association | language names |
| Staging robots in prod | deindexed site | env-aware robots |
| Soft 404s | wasted crawl, bad results | real 404 |
| No WebKit testing | iOS bugs | Playwright webkit |
| Client flags flicker | layout jump | server evaluation |
| Analytics before consent | GDPR violation | consent gating |
| PII in events | privacy breach | IDs |
| SW without kill switch | stuck broken app | update + unregister plan |

## Sources
| Source | Link |
|:--|:--|
| Tailwind theme variables | https://tailwindcss.com/docs/theme |
| MDN Intl | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl |
| CLDR plural rules | https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html |
| Next.js internationalization | https://nextjs.org/docs/app/guides/internationalization |
| Google SEO starter guide | https://developers.google.com/search/docs/fundamentals/seo-starter-guide |
| web.dev Baseline | https://web.dev/baseline |
| web.dev PWA | https://web.dev/explore/progressive-web-apps |
| EDPB consent guidelines | https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en |
