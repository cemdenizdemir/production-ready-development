---
title: Blue/green, canary, and feature flags
tech: Azure Container Apps (multiple revisions, labels, traffic weights), Azure App Configuration, Microsoft.FeatureManagement
version: Azure CLI 2.7x, Microsoft.FeatureManagement.AspNetCore 4.x
date: 2026-11-09
covers: [6, 9]
---
# Blue/green, canary, and feature flags
[← Overview](00-overview.md)

## Why it matters
- A new search algorithm went to 100% of users at once. It was slower for long queries, and conversions dropped 8% before anyone connected the two.
- A half-finished feature was hidden behind `if (DateTime.Now > launchDate)` in code. The launch moved, and a hotfix deploy was needed to change the date.
- Feature flags from three years ago were still in the code. Nobody knew which were safe to remove, and two contradicted each other.

## Concepts

### Release strategies
| Strategy | How | Pros | Cons |
|:--|:--|:--|:--|
| rolling | replace replicas gradually (single revision mode) | simple, no extra capacity | all users get the new version within minutes |
| ⭐ blue/green | new revision (green) fully deployed beside blue; test via its label URL; switch 100% at once | instant switch and rollback | double capacity during the switch; all-at-once exposure |
| ⭐ canary | send 5–10% to the new revision, watch metrics, then increase | limits blast radius; real-traffic validation | needs per-revision metrics and time |
| linear | canary in fixed steps (10% → 25% → 50% → 100%) on a timer | predictable | slower |
| ⭐ feature flags | code deployed off; turned on per user, percentage, or segment | release without deploy; instant kill switch | flag debt; testing combinations |

Container Apps traffic splitting is per request (no stickiness by default). With canaries for stateful flows (checkout), consider session affinity or a feature flag with user targeting instead, so one user doesn't bounce between versions.

### Canary analysis
| Signal | Compare new vs old revision |
|:--|:--|
| ⭐ error rate | 5xx per revision (`cloud_RoleInstance` / revision name in telemetry) |
| ⭐ latency | p95/p99 per revision |
| new exception groups | errors only seen in the new version |
| business metrics | conversion, payment success (with enough traffic) |
| decision | automatic promote/rollback by thresholds, or a human with a dashboard |

Tag telemetry with the revision or `service.version` (03-backend/10-observability) so you can split metrics by version.

### Feature flags
| Concept | Microsoft.FeatureManagement |
|:--|:--|
| ⭐ on/off flag | `"Recommendations": true` |
| ⭐ percentage rollout | `Microsoft.Percentage` filter (`Value: 10`) |
| ⭐ targeting | `Microsoft.Targeting` filter: users, groups, default rollout percentage; stable per user |
| time window | `Microsoft.TimeWindow` filter |
| variants | A/B options with allocation |
| ⭐ kill switch | a flag that disables a feature or dependency instantly |
| source | `appsettings.json` locally; Azure App Configuration in the cloud (changes without deploy) |
| API | `IFeatureManager.IsEnabledAsync("X")`, `[FeatureGate]`, `.WithFeatureGate(...)` |
| frontend | expose evaluated flags to Next.js via an API, not the raw configuration |

| Flag hygiene | Practice |
|:--|:--|
| ⭐ owner and expiry | each release flag has an owner and a removal date |
| types | release (short-lived), ops/kill switch (long-lived), experiment, permission |
| cleanup | remove the flag and dead branch within 2–4 weeks of 100% rollout |
| tests | test both states of each active flag |
| limits | few flags per code path; never nest flags |

## Example
Canary with multiple revision mode (in the deploy workflow):
```bash
az containerapp revision set-mode -g "$RG" -n "$APP" --mode multiple     # once
OLD=$(az containerapp ingress show -g "$RG" -n "$APP" --query "traffic[?weight>\`0\`].revisionName | [0]" -o tsv)
az containerapp update -g "$RG" -n "$APP" --image "$IMAGE" --revision-suffix "r$RUN"
NEW="$APP--r$RUN"
# wait for healthy (lesson 02), then label and canary
az containerapp revision label add -g "$RG" -n "$APP" --label green --revision "$NEW" --yes
curl --fail "https://$APP---green.$ENV_DOMAIN/health/ready"                 # test via the label URL
az containerapp ingress traffic set -g "$RG" -n "$APP" --revision-weight "$OLD=90" "$NEW=10"
sleep 900                                                                   # watch window (or poll metrics)
./scripts/check-canary.sh "$NEW" && \
  az containerapp ingress traffic set -g "$RG" -n "$APP" --revision-weight "$NEW=100" || \
  az containerapp ingress traffic set -g "$RG" -n "$APP" --revision-weight "$OLD=100"
```
`scripts/check-canary.sh` runs a KQL query comparing the new revision's error rate and p95 with the old one's over the window, and exits non-zero on regression.

`appsettings.json` (feature flags, local defaults)
```json
"feature_management": {
  "feature_flags": [
    { "id": "NewSearch", "enabled": true,
      "conditions": { "client_filters": [
        { "name": "Microsoft.Targeting", "parameters": { "Audience": {
          "Users": ["qa@shop.example"], "Groups": [{ "Name": "staff", "RolloutPercentage": 100 }], "DefaultRolloutPercentage": 10 } } } ] } },
    { "id": "Recommendations", "enabled": true }
  ]
}
```
`src/Shop.Api/Program.cs`
```csharp
using Microsoft.FeatureManagement;

builder.Services.AddFeatureManagement().WithTargeting();            // ITargetingContextAccessor from the signed-in user
// with App Configuration: .UseFeatureFlags() in AddAzureAppConfiguration (02-cloud lesson 04)

app.MapGet("/search", async (string q, IFeatureManager flags, SearchV1 v1, SearchV2 v2, CancellationToken ct) =>
    await flags.IsEnabledAsync("NewSearch") ? await v2.SearchAsync(q, ct) : await v1.SearchAsync(q, ct));
```

## Production patterns
- Production in multiple revision mode: new revision tested via its label URL, canary at 5–10% with automated comparison, then 100%; the old revision stays active for the watch window.
- Risky features ship dark behind flags and roll out by targeting (staff → 10% → 50% → 100%); kill switches for expensive or external dependencies.
- Flags live in App Configuration with owners and expiry dates; cleanup is part of the definition of done.
- Telemetry carries the version, so every chart can be split by release.

## Mistakes
Wrong: hard-coded launch dates or `if (env == "Production")` to hide features.
Right: a feature flag you can change without deploying.

Wrong: canary at 10% without comparing metrics per revision ("nobody complained, ship it").
Right: per-revision error rate and latency, with thresholds that decide promotion or rollback.

## Check yourself
1. What's the main difference between blue/green and canary?
2. Why use targeting rather than a random percentage for a checkout change?
3. What makes feature flags turn into technical debt?

<details><summary>Answers</summary>

1. Blue/green switches all traffic at once after testing the new version on the side (fast switch, full exposure); canary exposes a small share of real traffic first and grows it while comparing metrics (limited blast radius, takes longer).
2. Targeting assigns each user consistently, so a user doesn't switch between old and new checkout on different requests; it also lets you start with staff or specific groups.
3. Flags that stay after full rollout: dead code paths, untested combinations, and confusion about which flags matter. Owners, expiry dates, and cleanup after rollout prevent it.
</details>

## Sources
- [Blue-green deployment in Container Apps](https://learn.microsoft.com/azure/container-apps/blue-green-deployment)
- [Traffic splitting in Container Apps](https://learn.microsoft.com/azure/container-apps/traffic-splitting)
- [.NET feature management](https://learn.microsoft.com/azure/azure-app-configuration/feature-management-dotnet-reference)
- [Targeting filter](https://learn.microsoft.com/azure/azure-app-configuration/howto-targetingfilter)
- [Martin Fowler — Feature toggles](https://martinfowler.com/articles/feature-toggles.html)
