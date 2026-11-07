---
title: Security and privacy review
tech: Express 5, Next.js 16, AWS
version: OWASP Top 10:2025, Helmet, express-rate-limit, Dependabot, CodeQL, gitleaks, Better Auth, GDPR
date: 2026-11-07
covers: [1, 2]
---
# Security and privacy review
[← Overview](00-overview.md)

## Why it matters
- One missing authorization check on `GET /v1/orders/{id}` exposes every customer's address (IDOR, the most common API breach).
- A launch without a privacy policy, consent for analytics cookies, or a way to delete accounts can be a legal problem on day one in the EU.
- Leaked secrets in git history are found by bots within minutes of a repository going public.

## Security review
| Area (OWASP 2025) | Check | How to verify |
|:--|:--|:--|
| A01 Broken access control | every route has authentication and authorization; queries scoped by account | authorization test matrix (routes × roles × other account's IDs → 401/403/404) |
| A02 Security misconfiguration | production config: no debug, strict CORS, no default credentials, minimal IAM | config review, `curl -I` header check, IAM Access Analyzer |
| A03 Supply chain | lockfile, Dependabot, pinned actions, no unknown packages | `pnpm audit --prod`, Dependabot alerts empty or triaged, CodeQL green |
| A04 Cryptographic failures | TLS everywhere, HSTS, argon2id passwords, secrets in Secrets Manager | SSL Labs grade A, code review of auth module |
| A05 Injection | parameterized SQL (Drizzle), output encoding, no `dangerouslySetInnerHTML` with user input | CodeQL, grep for `sql.raw` and string-built queries |
| A06 Insecure design | server-side prices, rate limits on login/coupons/checkout, abuse cases | threat model document, abuse tests |
| A07 Authentication failures | MFA for staff, session rotation on login, generic errors, breached-password check | auth tests, manual review |
| A08 Integrity failures | Stripe webhook signatures, no unsafe deserialization, signed images/provenance | webhook tests with bad signatures |
| A09 Logging and alerting failures | security events logged (logins, refunds, role changes), alerts on anomalies | log queries, alert rules |
| A10 Exceptional conditions | errors fail closed, no stack traces to clients | tests for 500 responses (problem+json without internals) |
| Headers | HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame protection | header check script below |
| Secrets | none in repo or images; gitleaks clean history | `gitleaks detect`, image inspection |
| Uploads | type/size checks, quarantine, separate domain | upload tests |

## Privacy and legal review
| Item | Check | Evidence |
|:--|:--|:--|
| Data inventory | what personal data, where stored, why, retention | `docs/privacy/data-inventory.md` |
| Privacy policy | published, matches the inventory, processors listed (AWS, Stripe, SES, Sentry) | page URL |
| Legal basis and consent | analytics/marketing cookies only after consent; necessary cookies documented | consent banner test (no analytics requests before consent) |
| Data subject rights | export and deletion (erasure) flows; erasure log replayed after restores | admin tool or script + test |
| Processors (DPAs) | data processing agreements with providers | signed DPAs |
| Breach process | who decides, 72-hour notification path | runbook `docs/runbooks/security-incident.md` |
| Terms, imprint, withdrawal rights | shop terms, EU withdrawal (14 days) information | pages |
| Accessibility statement | EAA/WCAG statement and contact | page |
| Telemetry privacy | no personal data in logs/traces/Sentry | log sampling review |

## Example
`scripts/check-headers.sh` — evidence for the headers row.
```bash
#!/usr/bin/env bash
set -euo pipefail
URL="${1:-https://shop.example.com}"
HEADERS=$(curl -sI "$URL")
fail=0
for h in "strict-transport-security" "content-security-policy" "x-content-type-options: nosniff" "referrer-policy"; do
  if ! grep -qi "^$h" <<<"$HEADERS"; then echo "missing: $h"; fail=1; fi
done
grep -qi "^x-powered-by" <<<"$HEADERS" && { echo "remove: x-powered-by"; fail=1; }
exit $fail
```
An authorization test matrix (Vitest + Supertest):
```ts
const routes = [
  ['get', '/v1/me/orders/:orderId'],
  ['post', '/v1/me/orders/:orderId/cancellation'],
  ['get', '/v1/admin/orders/:orderId'],
] as const;

describe.each(routes)('%s %s', (method, path) => {
  test('anonymous → 401', async () => {
    await request(app)[method](path.replace(':orderId', aliceOrder.id)).expect(401);
  });
  test("another customer's order → 404", async () => {
    await request(app)[method](path.replace(':orderId', aliceOrder.id)).set('cookie', bobSession).expect(path.includes('/admin/') ? 403 : 404);
  });
});
```

## Mistakes
Wrong: "we use an auth middleware, so authorization is done". Authentication isn't authorization. Right: per-object checks and scoped queries, proven by tests.

Wrong: analytics scripts loading before consent. Right: no non-essential cookies or requests until consent is given.

Wrong: treating the privacy policy as a template. Right: it must match the real data inventory and processors.

## Check yourself
1. What's the strongest evidence that IDOR is prevented?
2. Which privacy items must exist before launch in the EU?
3. Why scan git history, not just the current files, for secrets?

<details>
<summary>Answers</summary>

1. An automated test matrix that requests every object route as anonymous, as another customer, and with the wrong role, and asserts 401/403/404, running in CI so new routes can't skip it.
2. A privacy policy matching a data inventory, consent for non-essential cookies, working access and erasure processes, processor agreements, a breach process with the 72-hour path, shop terms and withdrawal information, and an accessibility statement.
3. A secret committed and later deleted still lives in history and any clone; attackers scan history. If gitleaks finds one, rotate the secret, then clean up.
</details>

## Sources
- [OWASP Top 10](https://owasp.org/Top10/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [GDPR — full text](https://gdpr-info.eu/)
- [gitleaks](https://github.com/gitleaks/gitleaks)
