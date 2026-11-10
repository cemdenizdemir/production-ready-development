---
title: Feature flags, frontend config, and changing config safely
tech: Microsoft.FeatureManagement, Azure App Configuration, Next.js 16
version: Microsoft.FeatureManagement.AspNetCore 4.x, Next.js 16
date: 2026-11-09
covers: [9, 10, 11]
---
# Feature flags, frontend config, and changing config safely
[← Overview](00-overview.md)

## Why it matters
- A new checkout is merged behind an `if (config["NewCheckout"] == "true")`. Turning it off in production needs a redeploy, which takes 15 minutes during an incident.
- The Next.js image has `NEXT_PUBLIC_API_URL=https://staging-api...` baked in; the "promoted" production frontend calls staging.
- Someone renames `Payments:Timeout` to `Payments:TimeoutSeconds`; production still sets the old name and silently falls back to the default.

## Concepts

### Runtime config vs build-time config
| Kind | When it's fixed | Examples | Changing it |
|:--|:--|:--|:--|
| build-time | when the image is built | .NET constants, `NEXT_PUBLIC_*` values | rebuild |
| deploy-time | when the container starts | environment variables, Key Vault (without reload) | restart / new revision |
| runtime | while running | App Configuration with refresh, feature flags | seconds |

Promote images, not builds: anything that differs per environment must be deploy-time or runtime.

### Feature flags with Microsoft.FeatureManagement
```json
{
  "feature_management": {
    "feature_flags": [
      { "id": "NewCheckout", "enabled": true,
        "conditions": { "client_filters": [ { "name": "Microsoft.Percentage", "parameters": { "Value": 10 } } ] } },
      { "id": "BulkExport", "enabled": false }
    ]
  }
}
```
```csharp
builder.Services.AddFeatureManagement();
app.MapPost("/checkout", async (IFeatureManager features, CheckoutRequest req) =>
    await features.IsEnabledAsync("NewCheckout") ? NewCheckout(req) : OldCheckout(req));
```
| Flag type | Lifetime | Example |
|:--|:--|:--|
| release toggle | days–weeks; delete after rollout | `NewCheckout` |
| ops / kill switch | long-lived | `DisableRecommendations` under load |
| experiment | weeks | A/B variants (`IVariantFeatureManager`) |
| permission | long-lived (often better as authorization) | beta customers via targeting filter |

Filters: `Microsoft.Percentage`, `Microsoft.TimeWindow`, `Microsoft.Targeting` (users, groups, rollout percentage). Store flags in Azure App Configuration to change them without a deploy (`UseFeatureFlags()` + refresh, lesson 03). Every release flag gets an owner and a removal ticket.

### Frontend config (Next.js)
| Variable | Visible where | Fixed when |
|:--|:--|:--|
| `NEXT_PUBLIC_*` | browser bundle | `next build` (inlined) |
| other env vars | server only (Server Components, route handlers) | runtime |

For one image across environments:
- Server-side code reads `API_URL` at runtime and calls the ASP.NET Core API.
- The browser calls same-origin `/api/*`, which Next.js proxies to the API at request time (`proxy.ts`), so the browser never needs the API URL.
- Truly public per-environment values (analytics key) come from a small runtime endpoint or are rendered by the server, not from `NEXT_PUBLIC_*`.

### Changing config safely
| Practice | How |
|:--|:--|
| defaults in code and `appsettings.json` | missing keys behave sensibly |
| ⭐ validation on start | bad values fail the rollout (lesson 02) |
| reviews | `appsettings*.json` and IaC changes go through PRs |
| audit trail | App Configuration and Key Vault history; Azure Activity Log |
| renames: expand → migrate → contract | read new key, fall back to old, log a deprecation warning; remove after all environments moved |
| labels and snapshots | App Configuration snapshot per release; roll back by pointing to the previous snapshot |
| gradual changes | flags with percentage filters; one environment at a time |
| observability | log config version or snapshot name at startup |

## Example
Deprecating a renamed key:
```csharp
builder.Services.AddOptions<PaymentsOptions>()
    .BindConfiguration(PaymentsOptions.Section)
    .PostConfigure<IConfiguration, ILoggerFactory>((o, cfg, lf) =>
    {
        var legacy = cfg["Payments:Timeout"];                 // old name
        if (legacy is not null && cfg["Payments:TimeoutSeconds"] is null)
        {
            lf.CreateLogger("Config").LogWarning("Payments:Timeout is deprecated; use Payments:TimeoutSeconds.");
            o.TimeoutSeconds = int.Parse(legacy, CultureInfo.InvariantCulture);
        }
    })
    .ValidateDataAnnotations()
    .ValidateOnStart();
```
A same-origin `/api` proxy in Next.js 16 that reads the API URL per request:

`web/proxy.ts`
```ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/^\/api/, "");
  return NextResponse.rewrite(new URL(path + req.nextUrl.search, process.env.API_URL));
}

export const config = { matcher: "/api/:path*" };
```
`proxy.ts` (formerly `middleware.ts`) runs at request time, so `API_URL` comes from the container's environment and the same image works everywhere. Don't put the URL in `next.config` `rewrites()`: with `output: "standalone"` the config is serialized at build time.

## Production patterns
- Kill switches for risky dependencies (recommendations, third-party calls) live in App Configuration and are tested regularly.
- Release flags removed within a sprint or two of full rollout; stale flags are tech debt with a blast radius.
- No `NEXT_PUBLIC_*` for values that differ between staging and production.
- Config renames always go expand → migrate → contract, like database columns.

## Mistakes
Wrong: flags as raw config reads.
```csharp
if (config["NewCheckout"] == "true") { ... }
```
Right: `IFeatureManager.IsEnabledAsync("NewCheckout")` with flags in App Configuration.

Wrong: `NEXT_PUBLIC_API_URL` per environment in one promoted image.
Right: server-side `API_URL` + a same-origin `/api` proxy evaluated per request.

## Check yourself
1. Why can't `NEXT_PUBLIC_API_URL` differ between staging and production for a single image?
2. What are the three steps of a safe config key rename?
3. Which feature filter would you use to enable a feature for 10% of users?

<details><summary>Answers</summary>

1. It's inlined into the JavaScript bundle at build time; the value can't change without rebuilding.
2. Expand (read both, prefer new), migrate (set the new key everywhere), contract (remove the old key and the fallback).
3. `Microsoft.Percentage`, or `Microsoft.Targeting` with a rollout percentage for sticky per-user assignment.
</details>

## Sources
- [.NET feature management](https://learn.microsoft.com/azure/azure-app-configuration/feature-management-dotnet-reference)
- [Feature flags in Azure App Configuration](https://learn.microsoft.com/azure/azure-app-configuration/concept-feature-management)
- [Next.js — Environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Next.js — proxy.ts](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Martin Fowler — Feature Toggles](https://martinfowler.com/articles/feature-toggles.html)
