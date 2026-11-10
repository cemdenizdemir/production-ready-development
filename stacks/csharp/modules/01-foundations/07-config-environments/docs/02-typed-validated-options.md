---
title: Typed, validated options
tech: Microsoft.Extensions.Options, DataAnnotations, options validation source generator
version: .NET 10
date: 2026-11-09
covers: [4, 5]
---
# Typed, validated options
[← Overview](00-overview.md)

## Why it matters
- `int.Parse(config["Payments:TimeoutSeconds"])` is copied into four classes; one has a typo in the key and silently uses 0, which means "no timeout".
- A missing API key is discovered when the first customer tries to pay, not when the container starts. The deploy looked healthy for an hour.
- A service registered as a singleton injects `IOptionsSnapshot<T>`; the app fails at startup with a scope error nobody understands.

## Concepts

### The Options pattern
Bind a configuration section to a class once, validate it, inject it.
```csharp
public sealed class PaymentsOptions
{
    public const string Section = "Payments";

    [Required, Url] public required string BaseUrl { get; init; }
    [Required, MinLength(20)] public required string ApiKey { get; init; }
    [Range(1, 60)] public int TimeoutSeconds { get; init; } = 10;
}
```
```csharp
builder.Services.AddOptions<PaymentsOptions>()
    .BindConfiguration(PaymentsOptions.Section)
    .ValidateDataAnnotations()
    .Validate(o => o.BaseUrl.StartsWith("https://", StringComparison.Ordinal), "Payments:BaseUrl must be https.")
    .ValidateOnStart();
```
- `ValidateOnStart()` validates while the host starts; a bad config **fails the deploy** (the container never becomes ready) instead of failing requests.
- `ValidateDataAnnotations()` runs `[Required]`, `[Range]`, `[Url]`… Nested objects need `[ValidateObjectMembers]` / `[ValidateEnumeratedItems]`.
- Complex rules: implement `IValidateOptions<T>` and register it.

### Source-generated validation (.NET 8+)
```csharp
[OptionsValidator]
public partial class PaymentsOptionsValidator : IValidateOptions<PaymentsOptions>;

builder.Services.AddSingleton<IValidateOptions<PaymentsOptions>, PaymentsOptionsValidator>();
```
No reflection, AOT-friendly, same DataAnnotations. Pair with `<EnableConfigurationBindingGenerator>true</EnableConfigurationBindingGenerator>` for reflection-free binding.

### Which interface to inject
| Interface | Lifetime | Reloads? | Use |
|:--|:--|:--|:--|
| ⭐ `IOptions<T>` | singleton | no (value read once) | most settings |
| `IOptionsSnapshot<T>` | scoped | per request | settings that may change, read in scoped services |
| `IOptionsMonitor<T>` | singleton | yes, `CurrentValue` + `OnChange` | singletons that must see changes |
| named options | any | — | several configs of one type: `IOptionsMonitor<T>.Get("eu")` |

Reload happens when a provider supports it: JSON files (`reloadOnChange`), App Configuration with refresh, Key Vault with `ReloadInterval`. Environment variables never change at runtime.

### Rules for config access
- No `IConfiguration` in business code. Only `Program.cs` (and extension methods it calls) touches raw configuration.
- One options class per feature section; names match section names.
- Defaults live in the class (`= 10`) **and** in `appsettings.json`, so both readers and humans see them.
- Connection strings: `builder.Configuration.GetConnectionString("Shop")` in `Program.cs`, passed to `AddDbContext`.

## Example
`src/Shop.Api/Payments/PaymentsClient.cs`
```csharp
using Microsoft.Extensions.Options;

public sealed class PaymentsClient(HttpClient http, IOptions<PaymentsOptions> options)
{
    private readonly PaymentsOptions _opt = options.Value;

    public Task<HttpResponseMessage> Ping(CancellationToken ct) =>
        http.GetAsync($"{_opt.BaseUrl}/v1/ping", ct);
}
```
`src/Shop.Api/Program.cs`
```csharp
builder.Services.AddOptions<PaymentsOptions>()
    .BindConfiguration(PaymentsOptions.Section)
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddHttpClient<PaymentsClient>((sp, http) =>
{
    var opt = sp.GetRequiredService<IOptions<PaymentsOptions>>().Value;
    http.Timeout = TimeSpan.FromSeconds(opt.TimeoutSeconds);
});
```
`terminal`
```bash
dotnet run --project src/Shop.Api --Payments:ApiKey=short
# Unhandled exception. Microsoft.Extensions.Options.OptionsValidationException:
#   DataAnnotation validation failed for 'PaymentsOptions' members: 'ApiKey' with the error: 'The field ApiKey must be a string or array type with a minimum length of '20'.'.
```
A unit test for the validation:
```csharp
[Fact]
public void Rejects_short_api_key()
{
    var opts = new PaymentsOptions { BaseUrl = "https://api.stripe.test", ApiKey = "too-short" };

    var result = new PaymentsOptionsValidator().Validate(Options.DefaultName, opts);

    result.Failed.ShouldBeTrue();
    result.FailureMessage.ShouldContain("ApiKey");
}
```

## Production patterns
- Every options class: `BindConfiguration` + validation + `ValidateOnStart()`. A misconfigured app should never pass its readiness probe.
- `IOptions<T>` by default; reach for `IOptionsMonitor<T>` only for settings you really change at runtime (flags, limits).
- Validation messages name the full key (`Payments:BaseUrl`), so the on-call engineer knows what to fix.
- Keep secrets in options too (e.g. `ApiKey`), populated from Key Vault; the code doesn't care where values come from.

## Mistakes
Wrong: scattered raw reads.
```csharp
var timeout = int.Parse(config["Payments:Timeout"] ?? "0");   // wrong key, silent 0
```
Right: bound, validated options with defaults.

Wrong: `IOptionsSnapshot<T>` in a singleton.
```csharp
builder.Services.AddSingleton<Cache>();   // Cache(IOptionsSnapshot<CacheOptions> o) → scope validation error
```
Right: `IOptionsMonitor<T>` in singletons.

## Check yourself
1. What does `ValidateOnStart()` change compared to validating on first use?
2. Which options interface should a singleton use to see reloaded values?
3. Why keep `IConfiguration` out of business classes?

<details><summary>Answers</summary>

1. Validation runs during host startup, so the app fails to start (and the deploy fails) instead of failing a request later.
2. `IOptionsMonitor<T>` (`CurrentValue`).
3. Raw string keys spread typos and parsing everywhere, skip validation, and make dependencies invisible; typed options centralize all of it.
</details>

## Sources
- [Options pattern in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/configuration/options)
- [Options validation](https://learn.microsoft.com/dotnet/core/extensions/options#options-validation)
- [Compile-time options validation source generation](https://learn.microsoft.com/dotnet/core/extensions/options-validation-generator)
- [Configuration binding source generator](https://learn.microsoft.com/dotnet/core/whats-new/dotnet-8/runtime#configuration-binding-source-generator)
