---
title: Storage and Front Door, secrets, DNS, and TLS
tech: Azure Blob Storage, Azure Front Door, Key Vault, App Configuration, Azure DNS, Container Apps managed certificates
version: Azure (November 2026), Azure.Extensions.AspNetCore.Configuration.Secrets 1.x, Microsoft.Extensions.Configuration.AzureAppConfiguration 8.x
date: 2026-11-09
covers: [8, 9, 10]
---
# Storage and Front Door, secrets, DNS, and TLS
[← Overview](00-overview.md)

## Why it matters
- Product images were served straight from the storage account. A viral post sent 2 TB of egress through it in a day; Front Door caching would have served most of it from the edge.
- The Stripe secret key was rotated after a leak, but the new value had to be copied into four app settings by hand. One was missed, and refunds failed for a day.
- A custom domain's certificate expired on a Saturday. Checkout showed a browser security warning until Monday.

## Concepts

### Blob Storage and Front Door
| Setting | Practice |
|:--|:--|
| ⭐ public blob access | disabled on the account (`allowBlobPublicAccess: false`) |
| ⭐ shared key access | disabled where possible; apps use Entra ID (managed identity) and user delegation SAS |
| containers | `products` (served via Front Door), `uploads-quarantine`, `invoices` (private, SAS only) |
| redundancy | ZRS in production; GRS/GZRS if you need cross-region copies |
| soft delete + versioning | recover deleted or overwritten blobs (05-data-safety) |
| lifecycle rules | move old blobs to cool/cold/archive; delete abandoned uploads |
| ⭐ Front Door origin | storage via Private Link (Premium) or a locked-down origin; caching rules for static assets |
| static assets | Next.js `/_next/static/*` and product images cached at the edge with long TTLs |

### Secrets and configuration
| Service | Holds | How the app reads it |
|:--|:--|:--|
| ⭐ Key Vault | secrets (Stripe key, webhook secrets), keys, certificates | `AddAzureKeyVault(uri, credential)`, or Container Apps secrets with `keyVaultUrl` |
| App Configuration | non-secret settings, feature flags, Key Vault references | `AddAzureAppConfiguration(...)` with refresh |
| Container Apps secrets | per-app secrets, ideally Key Vault references | env vars with `secretRef` |
| environment variables | non-secret, per-deployment values | `ASPNETCORE_ENVIRONMENT`, `AZURE_CLIENT_ID` |

| Practice | Why |
|:--|:--|
| ⭐ RBAC permission model on Key Vault | same access model as everything else; `Key Vault Secrets User` for apps |
| ⭐ soft delete + purge protection | deleted secrets can be recovered; required for CMK scenarios |
| ⭐ rotation | rotate on a schedule and after any exposure; reference the secret **without a version** so apps pick up the latest |
| one vault per app per environment | blast radius and access stay small |
| expiry alerts | Event Grid `SecretNearExpiry` / Azure Monitor alerts |
| private endpoint | vault reachable only from the VNet |

### DNS and TLS
| Item | Practice |
|:--|:--|
| Azure DNS | host the zone (`shop.example`) in Azure, managed by IaC |
| ⭐ custom domain on Container Apps | CNAME (or A for apex) + TXT `asuid.<sub>` with the verification ID |
| ⭐ managed certificates | free, auto-renewing certificates for custom domains on Container Apps and Front Door |
| Front Door domains | `www.shop.example` and `api.shop.example` on Front Door, with managed certificates; origins use the default `*.azurecontainerapps.io` names |
| HSTS | `Strict-Transport-Security` once HTTPS is solid (02-frontend/03-backend security headers) |
| CAA records | restrict which CAs can issue for your domain |
| expiry monitoring | alert on bring-your-own certificates; managed ones renew themselves |

## Example
Container Apps secret as a Key Vault reference (Bicep excerpt, 03-iac):
```bicep
configuration: {
  secrets: [
    { name: 'stripe-secret-key', keyVaultUrl: '${keyVault.properties.vaultUri}secrets/stripe-secret-key', identity: apiIdentity.id }
  ]
}
template: {
  containers: [ {
    name: 'api'
    image: image
    env: [
      { name: 'Payments__Stripe__SecretKey', secretRef: 'stripe-secret-key' }
      { name: 'AZURE_CLIENT_ID', value: apiIdentity.properties.clientId }
    ]
  } ]
}
```
No version in the URL means Container Apps fetches the latest version periodically; restart the revision to apply a rotated value immediately.

App Configuration with Key Vault references and feature flags:
```csharp
using Azure.Identity;

var credential = new DefaultAzureCredential();
builder.Configuration.AddAzureAppConfiguration(o => o
    .Connect(new Uri(builder.Configuration["AppConfig:Endpoint"]!), credential)
    .Select("Shop:*", LabelFilter.Null)
    .Select("Shop:*", builder.Environment.EnvironmentName)            // environment label overrides
    .ConfigureKeyVault(kv => kv.SetCredential(credential))
    .ConfigureRefresh(r => r.RegisterAll().SetRefreshInterval(TimeSpan.FromMinutes(5)))
    .UseFeatureFlags());
builder.Services.AddAzureAppConfiguration();
// app.UseAzureAppConfiguration();  // enables refresh per request
```
Custom domain with a managed certificate:
```bash
az containerapp hostname add -g rg-shop-prod-weu -n ca-shop-web --hostname www.shop.example
# create DNS: CNAME www → ca-shop-web.<env>.westeurope.azurecontainerapps.io and TXT asuid.www → verification ID
az containerapp hostname bind -g rg-shop-prod-weu -n ca-shop-web --hostname www.shop.example \
  --environment cae-shop-prod --validation-method CNAME
```

## Production patterns
- Storage accounts private, Entra-only, zone-redundant, with soft delete and versioning; public assets only through Front Door.
- Secrets live in one Key Vault per app and environment (RBAC, purge protection, private endpoint), referenced without versions and rotated on a schedule.
- Non-secret settings and feature flags in App Configuration with environment labels; secrets referenced, never copied.
- DNS zones in IaC; managed certificates everywhere possible; alerts for anything that can expire.

## Mistakes
Wrong: copying the Stripe key into each app's environment variables.
Right: one Key Vault secret, referenced by every app through Key Vault references.

Wrong: certificates uploaded by hand with a calendar reminder to renew.
Right: managed certificates on Front Door / Container Apps, plus expiry alerts for anything else.

## Check yourself
1. Why reference Key Vault secrets without a version?
2. What's the difference between Key Vault and App Configuration?
3. Which two DNS records validate a custom domain on Container Apps?

<details><summary>Answers</summary>

1. The app then picks up the latest version automatically after rotation (on refresh or restart), instead of every reference needing an update.
2. Key Vault stores secrets, keys, and certificates with strict access control and auditing. App Configuration stores non-secret settings and feature flags with labels and refresh, and can reference Key Vault secrets.
3. A CNAME (or A record for an apex domain) pointing at the app, and a TXT record `asuid.<subdomain>` containing the domain verification ID.
</details>

## Sources
- [Azure Storage security recommendations](https://learn.microsoft.com/azure/storage/blobs/security-recommendations)
- [Front Door with Private Link to storage](https://learn.microsoft.com/azure/frontdoor/standard-premium/how-to-enable-private-link-storage-account)
- [Key Vault best practices](https://learn.microsoft.com/azure/key-vault/general/best-practices)
- [Manage secrets in Container Apps](https://learn.microsoft.com/azure/container-apps/manage-secrets)
- [Azure App Configuration with ASP.NET Core](https://learn.microsoft.com/azure/azure-app-configuration/quickstart-aspnet-core-app)
- [Custom domains and managed certificates in Container Apps](https://learn.microsoft.com/azure/container-apps/custom-domains-managed-certificates)
