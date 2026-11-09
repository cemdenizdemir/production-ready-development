---
title: Feature flags, analytics, and consent
tech: React 19.2, Next.js 16, TypeScript
version: Next.js 16.x, React 19.2
date: 2026-11-07
covers: [7, 8]
---
# Feature flags, analytics, and consent
[← Overview](00-overview.md)

## Why it matters
- A new checkout is flag-gated on the client: users see the old checkout for half a second, then it flips. Some click the wrong button mid-flip.
- Analytics events contain user emails. A privacy review finds personal data in a third-party tool without a legal basis.
- A cookie banner says "we respect your choice", but the analytics script loads before the user answers. That's a GDPR violation regulators fine for.

## Concepts

### Feature flags in the frontend
| Where evaluated | Pros | Cons |
|:--|:--|:--|
| Server (Server Components, API) | no flicker, flag rules stay private, works without JS | page becomes request-specific if per-user |
| Client (SDK in the browser) | instant updates, client-only apps | flicker unless bootstrapped; rules visible |
| Client, bootstrapped from the server | no flicker, live updates later | more setup |

Practices: evaluate on the server when possible and pass booleans to Client Components; keep percentage rollouts **sticky** (hash a stable user ID); include active flag variants in analytics events so you can compare cohorts; give every release flag an owner and a removal date; kill switches default to the safe behavior ([01-foundations/07-config-environments](../../../01-foundations/07-config-environments/docs/03-secrets-flags-frontend.md)).

### Analytics that answer questions
| Practice | Why |
|:--|:--|
| Start from questions ("where do users drop out of checkout?") | events you'll actually use |
| Event naming `object_action` (`checkout_started`, `order_completed`) | consistent, searchable |
| Typed event catalog in code | no typos, documented properties |
| Pseudonymous IDs, never emails/names | privacy and compliance |
| Critical conversions sent server-side | reliable despite ad blockers |
| `navigator.sendBeacon` for page-hide events | delivered as the page closes |
| Flag variants and app version on events | experiment analysis, regression tracking |

### Consent and privacy
| Rule | Practice |
|:--|:--|
| EU (GDPR + ePrivacy) | non-essential cookies/trackers need **opt-in** consent before they load |
| Categories | necessary (always), preferences, analytics, marketing |
| Equal choice | "Reject all" as easy as "Accept all"; no pre-ticked boxes |
| Changeable | a link to reopen settings (footer) |
| Record | store the choice and its date; respect it on every page load |
| Google Consent Mode v2 | required in the EEA for Google ads measurement; pass consent states to Google tags |
| Global Privacy Control (`navigator.globalPrivacyControl`) | treat as an opt-out signal (binding under CCPA/CPRA and other US laws) |
| Minimization | collect only what you use; set retention periods |

Privacy-friendly, cookieless analytics may not need consent in some jurisdictions; check with your legal/privacy team (also seen: Plausible, Fathom, Umami, PostHog cookieless mode).

## Example
`lib/flags.ts` and server-side evaluation (Next.js 16).
```ts
import 'server-only';
import { createHash } from 'node:crypto';

type Flag = 'new-checkout' | 'recommendations';
const ROLLOUT: Record<Flag, number> = { 'new-checkout': 20, recommendations: 100 }; // percent

export function isEnabled(flag: Flag, userId: string): boolean {
  const hash = createHash('sha256').update(`${flag}:${userId}`).digest().readUInt32BE(0);
  return hash % 100 < ROLLOUT[flag];        // same user, same answer: sticky rollout
}
```
```tsx
// app/checkout/page.tsx
import { getCurrentUser } from '@/lib/dal/users';
import { isEnabled } from '@/lib/flags';

export default async function CheckoutPage() {
  const user = await getCurrentUser();                 // DTO that includes a stable user id
  const newCheckout = user ? isEnabled('new-checkout', user.id) : false;
  return newCheckout ? <NewCheckout /> : <ClassicCheckout />;  // decided on the server: no flicker
}
```
`lib/analytics.ts` — a typed event catalog, gated by consent.
```ts
type Events = {
  checkout_started: { cartValueCents: number; items: number };
  order_completed: { orderId: string; valueCents: number; currency: string };
  search_performed: { queryLength: number; results: number }; // no raw query text: may contain PII
};

let analyticsAllowed = false;
export function setAnalyticsConsent(allowed: boolean) { analyticsAllowed = allowed; }

export function track<E extends keyof Events>(event: E, props: Events[E]) {
  if (!analyticsAllowed || navigator.globalPrivacyControl) return;   // consent + GPC respected
  const body = JSON.stringify({ event, props, path: location.pathname, ts: Date.now() });
  navigator.sendBeacon('/api/events', body);                          // first-party endpoint
}
```
`ConsentBanner.tsx` — load analytics only after opt-in.
```tsx
'use client';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { setAnalyticsConsent } from '@/lib/analytics';

type Consent = { analytics: boolean; decidedAt: string };

export function ConsentBanner() {
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined); // undefined = not read yet

  useEffect(() => {
    const saved = localStorage.getItem('consent:v1');
    const parsed = saved ? (JSON.parse(saved) as Consent) : null;
    setConsent(parsed);
    setAnalyticsConsent(parsed?.analytics ?? false);
  }, []);

  function decide(analytics: boolean) {
    const value = { analytics, decidedAt: new Date().toISOString() };
    localStorage.setItem('consent:v1', JSON.stringify(value));
    setConsent(value);
    setAnalyticsConsent(analytics);
  }

  return (
    <>
      {consent?.analytics && <Script src="https://analytics.example.com/script.js" strategy="lazyOnload" />}
      {consent === null && (
        <div role="dialog" aria-labelledby="consent-title" className="fixed inset-x-0 bottom-0 bg-surface-raised p-4 shadow-lg">
          <h2 id="consent-title">Cookies and analytics</h2>
          <p>We use analytics to improve the shop. You can change this anytime under “Privacy settings”.</p>
          <button onClick={() => decide(false)}>Reject all</button>
          <button onClick={() => decide(true)}>Accept analytics</button>
        </div>
      )}
    </>
  );
}
```
`navigator.globalPrivacyControl` may need a type declaration (`interface Navigator { globalPrivacyControl?: boolean }`).

## Production patterns
- **Server-side flag evaluation** for UI that would flicker; client SDKs bootstrapped with server values otherwise.
- **Sticky, hashed rollouts** and flag variants recorded on analytics events.
- **A typed event catalog** reviewed like an API: names, properties, and a privacy check per property.
- **Nothing non-essential loads before consent**; reject is as easy as accept; GPC honored.
- **First-party event endpoint** (your API) that forwards to analytics tools, so you control data and survive blockers.

## Mistakes
Wrong: client-side flag checks that flip after hydration.
```tsx
const enabled = useFlag('new-checkout'); // false on first render, true a moment later
```
Right: evaluate on the server, or bootstrap the client SDK with server-evaluated values.

Wrong: PII in events.
```ts
track('signup', { email: user.email, name: user.name });
```
Right: pseudonymous IDs and non-identifying properties.

Wrong: loading analytics in the root layout unconditionally, banner or not. Right: load after opt-in (and only the categories consented to).

Wrong: random per-page-load rollout (`Math.random() < 0.2`). Users flip between variants. Right: hash of a stable ID.

## Check yourself
1. Why evaluate feature flags on the server for above-the-fold UI?
2. What makes a percentage rollout "sticky"?
3. Name three requirements for a GDPR-compliant consent flow.

<details>
<summary>Answers</summary>

1. The HTML arrives with the right variant; no flicker or layout shift after hydration, and flag rules stay private.
2. Assignment is a deterministic function of a stable identifier (hash of flag name + user ID), so the same user always lands in the same bucket.
3. No non-essential tracking before opt-in; rejecting is as easy as accepting (no dark patterns, no pre-ticked boxes); choices are recorded and can be changed later, and are respected on every page.
</details>

## Sources
- [Martin Fowler — Feature Toggles](https://martinfowler.com/articles/feature-toggles.html)
- [OpenFeature — Web SDK](https://openfeature.dev/docs/reference/technologies/client/web/)
- [European Data Protection Board — Guidelines on consent](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en)
- [Google — Consent mode overview](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [Global Privacy Control](https://globalprivacycontrol.org/)
- [MDN — `navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
