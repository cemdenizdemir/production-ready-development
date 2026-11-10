---
title: Security and privacy review
tech: ASP.NET Core 10, ASP.NET Core Identity, Next.js 16, NuGet audit, GitHub Dependabot, Azure Key Vault
version: .NET 10, Next.js 16
date: 2026-11-10
covers: [1, 2]
---
# Security and privacy review
[← Overview](00-overview.md)

## Why it matters
- The first serious attacker shows up within days of launch: credential stuffing on login, coupon brute-forcing, scraping, and probing admin URLs.
- A single missing authorization check (`GET /me/orders/{number}` without an owner check) exposes every customer's address.
- Privacy obligations (GDPR) start with the first customer: you need to know what personal data you hold, why, and how to delete it.

## Security review (OWASP Top 10:2025 mapped to Roastery)
| Risk | Check in Roastery | Evidence |
|:--|:--|:--|
| ⭐ A01 Broken Access Control | every endpoint has `RequireAuthorization(...)` or an explicit `AllowAnonymous()`; owner checks on orders; staff policies on `/admin/*`; tests for another user's order → 404/403 | test run, endpoint inventory |
| A02 Security Misconfiguration | security headers (CSP, HSTS, `X-Content-Type-Options`), no detailed errors in prod, Hangfire dashboard behind Admin policy, Swagger/OpenAPI UI off in prod | header scan, config review |
| ⭐ A03 Software Supply Chain Failures | NuGet audit (transitive), npm audit, Dependabot, pinned actions and base images, SBOM + provenance, no unmaintained packages | CI logs, SBOM |
| A04 Cryptographic Failures | TLS everywhere, HSTS, Identity password hashing, Data Protection keys in Blob + Key Vault | config |
| A05 Injection | EF Core / parameterised Dapper only; no string-built SQL; output encoding; CSP | code search, analyzer results |
| A06 Insecure Design | threat model for checkout, webhooks, uploads, admin; abuse cases (coupon brute force) | threat model doc |
| ⭐ A07 Authentication Failures | lockout, rate limits on login/reset, MFA (passkeys/TOTP) for staff, `__Host-` cookies, session invalidation on password change | tests, config |
| A08 Software and Data Integrity Failures | Stripe webhook signatures, OIDC deploys, signed/provenance images, outbox integrity | tests |
| A09 Logging and Alerting Failures | auth failures, admin actions, refunds audited; alerts on spikes | dashboards |
| ⭐ A10 Mishandling of Exceptional Conditions | global exception handler, fail closed on auth/payment errors, no stack traces to clients, timeouts everywhere | tests, Problem Details samples |

| Item | Check |
|:--|:--|
| ⭐ secrets | none in Git (secret scanning on), Key Vault references, managed identities for SQL/Redis/Storage/Service Bus |
| ⭐ authorization tests | an integration test per protected endpoint for anonymous, wrong user, wrong role |
| headers | CSP for Next.js (nonces), HSTS, frame-ancestors, referrer policy |
| uploads | quarantine, scanning, magic bytes (03-backend/12 lesson 04) |
| SSRF | outgoing webhook/carrier URLs validated (03-backend/12 lesson 05) |
| dependency hygiene | no critical/high vulnerabilities open; supported runtimes (.NET 10, Node 24) |
| pen test | a time-boxed external or peer test of checkout, auth, and admin |

## Privacy and legal
| Item | Check | Evidence |
|:--|:--|:--|
| ⭐ data inventory | every personal data field: where stored (tables, blobs, logs, Stripe, ACS), why, retention | `docs/privacy/data-inventory.md` |
| ⭐ privacy policy | published, matches the inventory, names processors (Stripe, Microsoft/Azure, Sentry, carrier) | page link |
| consent | cookie banner for non-essential cookies/analytics; marketing emails opt-in | UI review |
| ⭐ data subject rights | export (access) and erasure flows work end to end, including blobs, search index, Sentry, partners; erasure log for restores | test run |
| breach process | 72-hour GDPR notification runbook, contacts, templates | runbook |
| ⭐ telemetry privacy | no emails/tokens in logs; redaction (`[Pii]`); short retention | log samples |
| terms and imprint | terms of sale, withdrawal right (EU 14 days), imprint/company details | page links |
| accessibility statement | published (EAA) with contact and known issues | page link |
| data residency | EU region for data stores; DPAs signed with processors | contracts |

## Example
Endpoint inventory test: no endpoint without an explicit authorization decision
```csharp
public sealed class AuthorizationInventoryTests(RoasteryApiFactory factory) : IClassFixture<RoasteryApiFactory>
{
    [Fact]
    public void Every_endpoint_declares_authorization()
    {
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>();
        var undeclared = endpoints
            .Where(e => e.Metadata.GetMetadata<IAuthorizeData>() is null && e.Metadata.GetMetadata<IAllowAnonymous>() is null)
            .Select(e => e.RoutePattern.RawText)
            .ToList();

        undeclared.ShouldBeEmpty();
    }

    [Fact]
    public async Task Customer_cannot_read_another_customers_order()
    {
        var ct = TestContext.Current.CancellationToken;
        var bob = await factory.CreateSignedInClientAsync("bob@example.test", ct);
        var aliceOrder = await factory.SeedOrderForAsync("alice@example.test", ct);

        var response = await bob.GetAsync($"/me/orders/{aliceOrder}", ct);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);         // don't reveal existence
    }
}
```
Supply chain checks in CI:
```xml
<!-- Directory.Build.props -->
<PropertyGroup>
  <NuGetAudit>true</NuGetAudit>
  <NuGetAuditMode>all</NuGetAuditMode>          <!-- transitive packages too (default in .NET 10) -->
  <NuGetAuditLevel>moderate</NuGetAuditLevel>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
</PropertyGroup>
```

## Mistakes
Wrong: "the admin UI is hidden, so the API is safe".
Right: every admin endpoint requires the staff policy, tested.

Wrong: a privacy policy copied from another shop.
Right: a policy written from your data inventory and processors.

## Check yourself
1. Which OWASP Top 10:2025 categories are new, and how does Roastery address them?
2. How do you prove every endpoint has an authorization decision?
3. What must an erasure request touch besides the database?

<details><summary>Answers</summary>

1. A03 Software Supply Chain Failures (NuGet/npm audits, Dependabot, pinned actions and images, SBOMs, provenance) and A10 Mishandling of Exceptional Conditions (global exception handling, failing closed, timeouts, no leaked stack traces).
2. With an inventory test over `EndpointDataSource` that fails if any endpoint lacks `IAuthorizeData` or `IAllowAnonymous` metadata, plus per-endpoint tests for anonymous, wrong-user, and wrong-role access.
3. Blob files, search indexes, caches, logs and telemetry (within retention), Sentry, and processors such as Stripe and the email provider, plus an erasure log so deletions are re-applied after restoring backups.
</details>

## Sources
- [OWASP Top 10:2025](https://owasp.org/Top10/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [ASP.NET Core security](https://learn.microsoft.com/aspnet/core/security/)
- [NuGet audit](https://learn.microsoft.com/nuget/concepts/auditing-packages)
- [GDPR Articles 15, 17, 33](https://gdpr-info.eu/)
- [01-foundations/06-security](../../../01-foundations/06-security/README.md), [03-backend/04-auth](../../../03-backend/04-auth/README.md)
