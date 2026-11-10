---
title: Secrets, Key Vault, and App Configuration
tech: dotnet user-secrets, Azure Key Vault, Azure App Configuration, managed identity, Azure.Identity
version: Azure.Extensions.AspNetCore.Configuration.Secrets 1.x, Microsoft.Azure.AppConfiguration.AspNetCore 8.x, Azure.Identity 1.x
date: 2026-11-09
covers: [6, 7, 12]
---
# Secrets, Key Vault, and App Configuration
[← Overview](00-overview.md)

## Why it matters
- Production secrets are pasted into Container Apps environment variables by hand. Nobody knows who changed what, and rotating means redeploying.
- A Key Vault client secret is needed to read Key Vault: the "secret zero" problem, solved badly by putting it in `appsettings.json`.
- 40 settings are copied between three apps; one app keeps an old timeout for months.

## Concepts

### Secrets vs config
| | Config | Secret |
|:--|:--|:--|
| examples | timeouts, URLs, page sizes, feature flags | API keys, passwords, signing keys, connection strings with credentials |
| stored in | `appsettings*.json`, App Configuration | user-secrets (local), Key Vault (cloud) |
| visible in Git | yes | never |
| change process | PR or App Configuration with audit log | Key Vault with access policy/RBAC and versions |

Best secret: none. Managed identity to Azure SQL, Storage, Service Bus, and Key Vault itself removes credentials entirely.

### Local: user-secrets and `.env`
| Tool | For | Where it lives |
|:--|:--|:--|
| `dotnet user-secrets` | the .NET app in Development | `%APPDATA%\Microsoft\UserSecrets\<id>\secrets.json` (or `~/.microsoft/usersecrets/`) |
| `.env` (git-ignored) + `.env.example` (committed) | Docker Compose variables, Next.js | repo root / `web/` |

`dotnet user-secrets init` adds a `UserSecretsId` to the `.csproj`; the provider loads only when the environment is Development.

### Azure Key Vault as a configuration provider
```csharp
builder.Configuration.AddAzureKeyVault(
    new Uri("https://kv-shop-prod.vault.azure.net/"),
    new DefaultAzureCredential(),
    new AzureKeyVaultConfigurationOptions { ReloadInterval = TimeSpan.FromMinutes(5) });
```
- Secret names can't contain `:`; use `--`: secret `Payments--ApiKey` → key `Payments:ApiKey`.
- `DefaultAzureCredential` tries, in order: environment, workload identity, managed identity, Visual Studio / Azure CLI / azd login… Locally it uses your `az login`; in Azure, the app's managed identity. In production you can pin it to `ManagedIdentityCredential` for speed and predictability.
- Grant the identity the **Key Vault Secrets User** role (RBAC) on that vault only.
- `ReloadInterval` re-reads secrets so rotations take effect without a restart; options read through `IOptionsMonitor<T>` see new values.

Alternative without code: Container Apps secrets can reference Key Vault (`keyvaultref:` with a managed identity) and expose them as environment variables. Simpler, but refresh happens on revision restart.

### Azure App Configuration
A central store for non-secret settings and feature flags, with labels (per environment), snapshots, history, and change notifications.
```csharp
builder.Configuration.AddAzureAppConfiguration(o => o
    .Connect(new Uri("https://appcs-shop.azconfig.io"), new DefaultAzureCredential())
    .Select("Shop:*", labelFilter: builder.Environment.EnvironmentName)
    .ConfigureKeyVault(kv => kv.SetCredential(new DefaultAzureCredential()))   // resolves Key Vault references
    .ConfigureRefresh(r => r.RegisterAll().SetRefreshInterval(TimeSpan.FromSeconds(30)))
    .UseFeatureFlags());

builder.Services.AddAzureAppConfiguration();
// ...
app.UseAzureAppConfiguration();     // triggers refresh based on request activity
```
App Configuration can store **Key Vault references**: the setting points to a secret; the provider fetches the secret from Key Vault with your identity. One place to look, secrets still in Key Vault.

### Rotation without downtime
1. Create the new secret version (or the secondary key at the provider).
2. Both old and new are valid for an overlap period.
3. Apps pick up the new version (reload interval or restart).
4. Revoke the old one after confirming no use (provider logs).

## Example
`src/Shop.Api/Program.cs`
```csharp
using Azure.Extensions.AspNetCore.Configuration.Secrets;
using Azure.Identity;

var builder = WebApplication.CreateBuilder(args);

if (!builder.Environment.IsDevelopment())
{
    var credential = new DefaultAzureCredential();
    var vaultUri = builder.Configuration["KeyVault:Uri"]
        ?? throw new InvalidOperationException("KeyVault:Uri is not configured.");

    builder.Configuration.AddAzureKeyVault(new Uri(vaultUri), credential,
        new AzureKeyVaultConfigurationOptions { ReloadInterval = TimeSpan.FromMinutes(5) });
}

builder.Services.AddOptions<PaymentsOptions>()
    .BindConfiguration(PaymentsOptions.Section)
    .ValidateDataAnnotations()
    .ValidateOnStart();       // fails startup if Payments:ApiKey didn't arrive from Key Vault
```
`terminal`
```bash
az keyvault secret set --vault-name kv-shop-prod --name "Payments--ApiKey" --value "sk_live_..."
az role assignment create --assignee <api-managed-identity-principal-id> \
  --role "Key Vault Secrets User" --scope $(az keyvault show -n kv-shop-prod --query id -o tsv)
az containerapp update -n ca-shop-api -g rg-shop --set-env-vars KeyVault__Uri=https://kv-shop-prod.vault.azure.net/
```

## Production patterns
- One Key Vault per environment (and per app if blast radius matters); RBAC, not access policies.
- Managed identity everywhere; `DefaultAzureCredential` in code so local dev works with `az login`.
- Non-secret shared settings and flags in App Configuration with labels per environment; secrets as Key Vault references.
- Validate on start, so a missing secret fails the rollout instead of the first payment.

## Mistakes
Wrong: a client secret to access Key Vault.
```json
"KeyVault": { "ClientId": "...", "ClientSecret": "..." }
```
Right: managed identity + `DefaultAzureCredential`; no secret in config.

Wrong: `Payments:ApiKey` as a Key Vault secret name (rejected) or `Payments-ApiKey` (maps to a different key).
Right: `Payments--ApiKey`.

## Check yourself
1. How does a Key Vault secret named `ConnectionStrings--Shop` appear in configuration?
2. What is "secret zero", and how does managed identity solve it?
3. What does a Key Vault reference in App Configuration give you?

<details><summary>Answers</summary>

1. As `ConnectionStrings:Shop`, readable with `GetConnectionString("Shop")`.
2. The first credential you need to fetch all other secrets. With managed identity, Azure gives the app an identity and short-lived tokens; there is no stored credential.
3. One configuration view for the app while the secret value stays in Key Vault, under Key Vault's access control and auditing.
</details>

## Sources
- [Safe storage of app secrets in development](https://learn.microsoft.com/aspnet/core/security/app-secrets)
- [Azure Key Vault configuration provider](https://learn.microsoft.com/aspnet/core/security/key-vault-configuration)
- [DefaultAzureCredential](https://learn.microsoft.com/dotnet/azure/sdk/authentication/credential-chains)
- [Azure App Configuration .NET provider](https://learn.microsoft.com/azure/azure-app-configuration/reference-dotnet-provider)
- [Key Vault references in App Configuration](https://learn.microsoft.com/azure/azure-app-configuration/use-key-vault-references-dotnet-core)
- [Manage secrets in Azure Container Apps](https://learn.microsoft.com/azure/container-apps/manage-secrets)
