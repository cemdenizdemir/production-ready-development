---
title: Security Fundamentals cheatsheet
tech: ASP.NET Core 10, rate limiting middleware, NetEscapades.AspNetCore.SecurityHeaders, NuGet Audit, Dependabot, CodeQL, gitleaks
version: ASP.NET Core 10, NetEscapades.AspNetCore.SecurityHeaders 1.3.x, OWASP Top 10:2025
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
---
# Security Fundamentals cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Threat modeling
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ trust boundary | where data crosses privilege levels | browser↔API, API↔DB, API↔3rd party |
| asset | what attackers want | PII, payments, credentials, availability |
| ⭐ STRIDE | Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation | per data flow |
| four questions | build? wrong? do? good job? | Threat Modeling Manifesto |
| mitigate / accept / transfer | decisions | write them down |
| DREAD / CVSS | severity scoring | CVSS for vulns |

## OWASP Top 10:2025
| # | Risk | ASP.NET Core control |
|:--|:--|:--|
| ⭐ A01 | Broken Access Control (incl. SSRF) | fallback policy, ownership checks, URL allowlists |
| A02 | Security Misconfiguration | env-specific config, no dev pages, headers |
| ⭐ A03 | Software Supply Chain Failures | lock files, NuGet Audit, source mapping, Dependabot |
| A04 | Cryptographic Failures | Data Protection, Identity hasher, TLS, Key Vault |
| ⭐ A05 | Injection | EF Core/Dapper parameters, `ArgumentList` |
| A06 | Insecure Design | threat models, server-side rules |
| A07 | Authentication Failures | Identity lockout, MFA, rate limits |
| A08 | Software or Data Integrity Failures | signed webhooks, safe deserialization |
| A09 | Security Logging and Alerting Failures | security events + alerts |
| A10 | Mishandling of Exceptional Conditions | fail closed, ProblemDetails |

## Secure defaults
| Default | Code | Note |
|:--|:--|:--|
| ⭐ deny by default | `SetFallbackPolicy(...RequireAuthenticatedUser())` | `AllowAnonymous()` explicit |
| ⭐ generic errors | `AddProblemDetails()` + `UseExceptionHandler()` | |
| dev page only in Development | `UseDeveloperExceptionPage()` | |
| HTTPS | `UseHttpsRedirection()`, `UseHsts()` | |
| no `Server` header | `AddServerHeader = false` | Kestrel |
| request limits | Kestrel `MaxRequestBodySize` | per endpoint overrides |

## Injection
| API | Safe? | Note |
|:--|:--|:--|
| LINQ | ✓ | parameterized |
| ⭐ `FromSql($"…{x}")` | ✓ | `FormattableString` → parameters |
| `SqlQuery<T>($"…")` / `ExecuteSql($"…")` | ✓ | EF Core 8+ |
| `FromSqlRaw("… {0}", x)` | ✓ | positional |
| ⭐ `FromSqlRaw($"…{x}")` / concatenation | ✗ | injection |
| Dapper `@param` + anonymous object | ✓ | |
| identifiers (ORDER BY column) | allowlist | can't parameterize |
| `ProcessStartInfo.ArgumentList` | ✓ | no shell |
| CA2100 | SQL from strings | analyzer |
| log message templates | ✓ | no interpolation |

## Deserialization
| Serializer | Verdict | Note |
|:--|:--|:--|
| `BinaryFormatter` | removed | .NET 9+ throws |
| `NetDataContractSerializer`, `SoapFormatter` | never | |
| Newtonsoft `TypeNameHandling` ≠ None | dangerous | binder if unavoidable |
| ⭐ System.Text.Json | safe default | no payload-chosen types |
| `[JsonPolymorphic]` + `[JsonDerivedType]` | allowlisted polymorphism | |
| `MaxDepth` | nesting limit | default 64 |
| `XmlReader` `DtdProcessing.Prohibit` | blocks XXE | default in .NET |
| CA2300–CA2330 | insecure deserializer rules | |

## SSRF, paths, uploads
| Risk | Control | Note |
|:--|:--|:--|
| ⭐ SSRF | allowlist hosts, https only | |
| private IPs | block 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7 | metadata endpoint |
| DNS rebinding | check IP in `ConnectCallback` | `SocketsHttpHandler` |
| redirects | `AllowAutoRedirect = false` | |
| ⭐ path traversal | `Path.GetFileName`, `GetFullPath` + root prefix check | |
| uploads | Blob Storage, random names, size limits | |
| content type | magic bytes, `nosniff` | |
| malware | Defender for Storage scan | |
| `IFormFile` | multipart uploads | stream large files |

## Access control
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ ownership in query | `Where(o => o.Id == id && o.CustomerId == userId)` | |
| resource-based authorization | `IAuthorizationService.AuthorizeAsync(user, resource, policy)` | |
| `AuthorizationHandler<TRequirement, TResource>` | resource rule | |
| ⭐ 404 for others' resources | don't confirm existence | |
| ⭐ request DTOs | stop over-posting | never bind entities |
| `ExecuteUpdateAsync` + `SetProperty` | explicit allowed fields | |
| global query filter | tenant isolation | EF Core |
| `LocalRedirect` / `Url.IsLocalUrl` | open-redirect protection | |
| `RequireAuthorization("policy")` | per endpoint/group | |

## XSS and encoding
| Context | Tool | Note |
|:--|:--|:--|
| JSON | System.Text.Json escapes | `application/json` |
| ⭐ HTML you build | `HtmlEncoder.Default.Encode` | emails |
| URLs | `UrlEncoder.Default.Encode` | block `javascript:` |
| JS strings | `JavaScriptEncoder.Default.Encode` | |
| Razor | encodes by default | `Html.Raw` is an escape hatch |
| ⭐ API CSP | `default-src 'none'; frame-ancestors 'none'` | |
| frontend CSP | nonce-based | 02-frontend/11 |

## CSRF
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `SameSite=Lax` cookies | blocks most cross-site POSTs | not enough alone |
| `AddAntiforgery()` + `UseAntiforgery()` | antiforgery services/middleware | .NET 8+ |
| form endpoints | validated automatically | `[FromForm]`, `IFormFile` |
| `IAntiforgery.GetAndStoreTokens` | issue token | SPA cookie + header |
| `IAntiforgery.ValidateRequestAsync` | validate JSON requests | endpoint filter |
| `HeaderName = "X-XSRF-TOKEN"` | header for SPAs | |
| `Origin` header check | extra defense | unsafe methods |
| bearer tokens | not CSRF-prone | not auto-attached |
| `.DisableAntiforgery()` | opt out | only with other protection |

## Security headers
| Header | API value | Note |
|:--|:--|:--|
| ⭐ HSTS | `max-age=31536000; includeSubDomains` | `UseHsts()` |
| ⭐ `X-Content-Type-Options` | `nosniff` | |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` | |
| `X-Frame-Options` | `DENY` | legacy |
| `Referrer-Policy` | `no-referrer` | |
| `Cross-Origin-Resource-Policy` | `same-site` | |
| `Permissions-Policy` | features off | |
| ⭐ `AddSecurityHeaderPolicies()` | NetEscapades policies | 1.x API |
| `AddDefaultApiSecurityHeaders()` | API preset | |
| `AddDefaultSecurityHeaders()` | HTML app preset | add CSP |
| `app.UseSecurityHeaders()` | apply | |

## Rate limiting
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `AddRateLimiter` + `UseRateLimiter` | built-in middleware | .NET 7+ |
| fixed window | N per window | |
| sliding window | segmented window | |
| ⭐ token bucket | bursts + average | |
| concurrency | max in flight | |
| `PartitionedRateLimiter.Create` | global limiter by key | |
| `RateLimitPartition.Get*Limiter(key, …)` | per-key limits | user, IP, API key |
| `AddPolicy("name", …)` | named policy | |
| `.RequireRateLimiting("login")` | per endpoint | |
| `.DisableRateLimiting()` | opt out | |
| `RejectionStatusCode = 429` | status | default 503 |
| `OnRejected` + `MetadataName.RetryAfter` | `Retry-After` header | |
| per instance | multiply by instance count | Redis or edge for global |
| Front Door WAF rate limit | edge limits | |

## Secrets
| Item | Use | Note |
|:--|:--|:--|
| ⭐ `dotnet user-secrets` | local | Development only |
| ⭐ Key Vault + `AddAzureKeyVault` | cloud secrets | managed identity |
| `DefaultAzureCredential` | auth chain | local: az login; cloud: MI |
| `ReloadInterval` | pick up rotations | |
| ⭐ managed identity | no secret at all | SQL, Storage, Service Bus |
| primary/secondary keys | rotation without downtime | |
| gitleaks | secret scanning | hook + CI |
| push protection | block known patterns | GitHub |

## Supply chain
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `packages.lock.json` + `--locked-mode` | exact deps | |
| ⭐ NuGet Audit | vuln warnings | NU1901 low … NU1904 critical |
| `NuGetAuditMode` | `direct` / `all` | `all` default for net10.0 |
| `NuGetAuditLevel` | min severity | `low` default |
| ⭐ package source mapping | ID → source | dependency confusion |
| `<clear />` in sources | no inherited feeds | |
| transitive pinning | patch deep deps | CPM |
| `dotnet nuget verify` | signatures | |
| ⭐ Dependabot | nuget, npm, github-actions | groups |
| dependency review action | block bad PR deps | |
| `pnpm audit` | npm advisories | |
| licence review | commercial switches | |

## CodeQL and review
| Item | What it does | Note |
|:--|:--|:--|
| default setup | one-click CodeQL | Settings → Code security |
| `github/codeql-action/init@v4` + `analyze` | advanced setup | |
| `languages: csharp` | C# analysis | `build-mode: none` |
| `javascript-typescript` | frontend | |
| `queries: security-extended` | more queries | |
| `security-events: write` | upload results | permission |
| scheduled scan | new queries, old code | weekly |
| security review | authz rules, business logic | humans |

## Logging and operations
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ log auth events | success, failure, lockout, MFA | |
| log authorization failures | 403/404 on owned data | |
| ⭐ never log secrets | tokens, passwords, cookies, card numbers | |
| alert on spikes | 401/403/429 | |
| least privilege | narrow roles, app SQL user | |
| `SECURITY.md` | how to report | |
| private vulnerability reporting | GitHub feature | |
| security advisory | private fix + CVE | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `FromSqlRaw($"…")` | looks safe, isn't | `FromSql($"…")` |
| `FindAsync(id)` for user data | IDOR | owner in query |
| binding entities | over-posting | DTOs |
| rate limiter before forwarded headers | everyone is one IP | headers first |
| per-instance limits as security | multiply with scale | edge/Redis |
| `SameSite` as only CSRF defense | subdomains, GET side effects | tokens / Origin |
| `NoWarn NU1903` | hides vulnerable deps | upgrade/pin |
| exceptions returned to clients | info disclosure | ProblemDetails |
| user URLs fetched by server | SSRF to metadata | allowlist + IP check |

## Sources
| Source | Link |
|:--|:--|
| OWASP Top 10:2025 | https://owasp.org/Top10/2025/0x00_2025-Introduction/ |
| OWASP .NET cheat sheet | https://cheatsheetseries.owasp.org/cheatsheets/DotNet_Security_Cheat_Sheet.html |
| ASP.NET Core security | https://learn.microsoft.com/aspnet/core/security/ |
| EF Core raw SQL | https://learn.microsoft.com/ef/core/querying/sql-queries |
| Antiforgery | https://learn.microsoft.com/aspnet/core/security/anti-request-forgery |
| Rate limiting | https://learn.microsoft.com/aspnet/core/performance/rate-limit |
| SecurityHeaders | https://github.com/andrewlock/NetEscapades.AspNetCore.SecurityHeaders |
| NuGet auditing | https://learn.microsoft.com/nuget/concepts/auditing-packages |
| Package source mapping | https://learn.microsoft.com/nuget/consume-packages/package-source-mapping |
| CodeQL | https://docs.github.com/en/code-security/code-scanning |
