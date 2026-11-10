---
title: Feature flags, analytics, and consent
tech: Next.js 16, React 19.2, Azure App Configuration (via the API), consent management
version: Next.js 16.x
date: 2026-11-09
covers: [7, 8]
---
# Feature flags, analytics, and consent
[← Overview](00-overview.md)

## Why it matters
- The new checkout is behind a flag in the API but not in the frontend; 10% of users get a UI that calls endpoints the API rejects for them.
- Analytics and marketing pixels load before the consent banner is answered; a data protection authority fines the shop.
- 60 feature flags exist; nobody knows which are still used, and testing every combination is impossible.

## Concepts

### Feature flags in the frontend
In this stack, flags live in Azure App Configuration and are evaluated by the ASP.NET Core API with Microsoft.FeatureManagement (01-foundations/07-config-environments). The frontend should **see the same decision** as the API.
| Approach | How | Use |
|:--|:--|:--|
| ⭐ API-evaluated flags | `GET /me/features` returns `{ "NewCheckout": true }` for this user (targeting) | per-user rollouts, consistent with API behavior |
| server-side in Next.js | Server Components read flags (cached briefly) and render the variant | no flicker, no client JS for flag logic |
| client-side SDK | browser evaluates flags | experiments needing instant toggles; risk of flicker |
| build-time | constant in the bundle | never for rollouts |

Rules: default to "off" on errors, evaluate once per request/page, keep the flag name identical in C# and TypeScript (generate the list from one source), and delete flags after rollout (owner + removal date).

### Gradual rollouts
Percentage or targeting filters on the API side; the frontend reads the result. Monitor errors and conversion per variant (Sentry tags, analytics properties) and keep a kill switch.

### Analytics and consent
| Principle | Practice |
|:--|:--|
| ⭐ consent first (EU: GDPR + ePrivacy) | non-essential cookies/scripts only after opt-in; equal "Reject" and "Accept" buttons |
| purpose-based | categories: necessary, analytics, marketing, preferences |
| record consent | timestamp, version, choices (cookie + server-side record via the API) |
| withdraw anytime | footer link to reopen settings |
| privacy-friendly analytics | first-party, cookieless, aggregated (e.g. Plausible-style) where possible |
| ⭐ event taxonomy | `product_viewed`, `add_to_cart`, `checkout_started`, `order_placed` with defined properties |
| no PII in events | IDs hashed, no emails or addresses |
| server-side events for money | `order_placed` sent by the API after payment confirmation, not by the browser |

Google Consent Mode v2 and IAB TCF are common requirements when using Google ads/analytics in the EU (also seen).

## Example
`web/src/server/features.ts`
```ts
import "server-only";
import { cookies } from "next/headers";

export type Features = { NewCheckout: boolean; Recommendations: boolean };
const defaults: Features = { NewCheckout: false, Recommendations: true };

export async function getFeatures(): Promise<Features> {
  try {
    const res = await fetch(`${process.env.API_URL}/me/features`, {
      headers: { cookie: (await cookies()).toString() },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return defaults;
    return { ...defaults, ...((await res.json()) as Partial<Features>) };
  } catch {
    return defaults;                                 // fail safe: flags off, kill switches honored
  }
}
```
`web/src/app/(shop)/checkout/page.tsx`
```tsx
import { getFeatures } from "@/server/features";
import { NewCheckout } from "@/features/checkout/NewCheckout";
import { ClassicCheckout } from "@/features/checkout/ClassicCheckout";

export default async function CheckoutPage() {
  const f = await getFeatures();
  return f.NewCheckout ? <NewCheckout /> : <ClassicCheckout />;
}
```
`web/src/lib/analytics.ts`
```ts
type EventMap = {
  product_viewed: { sku: string; priceMinor: number; currency: string };
  add_to_cart: { sku: string; quantity: number };
  checkout_started: { lineCount: number; valueMinor: number; currency: string };
};

export function track<E extends keyof EventMap>(name: E, props: EventMap[E]) {
  if (!hasConsent("analytics")) return;              // no consent → no event
  navigator.sendBeacon?.("/api/events", JSON.stringify({ name, props, ts: Date.now() }));
}
```
`order_placed` is emitted by the ASP.NET Core API when payment succeeds (webhook confirmed), so revenue numbers don't depend on the browser.

## Production patterns
- One flag source (App Configuration) evaluated by the API; the frontend asks the API.
- Flags have owners, creation dates, and removal tickets; a lint/script lists flags older than N weeks.
- Consent before any non-essential script or cookie; consent state checked in code paths, not only by the banner.
- A typed event map shared by the team; revenue events from the server.

## Mistakes
Wrong: frontend-only flag for a feature the API also gates differently.
Right: the frontend reads the API's evaluation for this user.

Wrong: analytics script in the root layout unconditionally.
Right: load after consent (`next/script` with `lazyOnload`, 07-performance).

## Check yourself
1. Why should the frontend read flags from the API instead of evaluating them itself?
2. What should `getFeatures` return when the API call fails?
3. Why send `order_placed` from the API rather than the browser?

<details><summary>Answers</summary>

1. The API enforces the feature; reading its decision keeps UI and backend consistent for each user (same targeting, same percentage bucket).
2. Safe defaults: new features off, kill switches in their protective state.
3. The browser can be closed, blocked by ad blockers, or tampered with; the API knows when payment really succeeded.
</details>

## Sources
- [.NET feature management](https://learn.microsoft.com/azure/azure-app-configuration/feature-management-dotnet-reference)
- [Martin Fowler — Feature Toggles](https://martinfowler.com/articles/feature-toggles.html)
- [EDPB — Guidelines on consent](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en)
- [ICO — Guidance on cookies](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/)
- [Google — Consent Mode](https://developers.google.com/tag-platform/security/guides/consent)
