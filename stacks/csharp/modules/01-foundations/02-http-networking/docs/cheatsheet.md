---
title: HTTP & Networking cheatsheet
tech: HTTP, ASP.NET Core 10 (Kestrel), curl, Chrome DevTools
version: .NET 10.0.14, ASP.NET Core 10, curl 8.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
---
# HTTP & Networking cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Request path
| Step | Cost | Note |
|:--|:--|:--|
| DNS | 0–100 ms | cached by OS and resolvers |
| TCP handshake | 1 RTT | reused with keep-alive |
| TLS 1.3 | 1 RTT, 0 on resumption | ALPN picks h2 |
| ⭐ TTFB | server time + 1 RTT | `curl -w %{time_starttransfer}` |
| Transfer | size / bandwidth | compress text |
| ⭐ Connection reuse | skips DNS/TCP/TLS | `IHttpClientFactory` |

## Methods
| Method | Safe / idempotent | Note |
|:--|:--|:--|
| ⭐ GET | ✓ / ✓ | cacheable |
| HEAD | ✓ / ✓ | headers only |
| OPTIONS | ✓ / ✓ | CORS preflight |
| ⭐ PUT | ✗ / ✓ | replace |
| ⭐ DELETE | ✗ / ✓ | |
| ⭐ POST | ✗ / ✗ | add `Idempotency-Key` for retries |
| PATCH | ✗ / ✗ | partial update |

## Status codes and TypedResults
| Code | Meaning | ASP.NET Core |
|:--|:--|:--|
| ⭐ 200 | OK | `TypedResults.Ok(x)` |
| ⭐ 201 | created + `Location` | `TypedResults.Created(uri, x)` |
| 202 | accepted for later | `TypedResults.Accepted(uri)` |
| ⭐ 204 | no content | `TypedResults.NoContent()` |
| 301 / 308 | permanent redirect (308 keeps method) | `TypedResults.Redirect(url, permanent: true, preserveMethod: true)` |
| 302 / 307 | temporary redirect (307 keeps method) | `TypedResults.Redirect(url)` |
| 304 | not modified | `Results.StatusCode(304)` |
| ⭐ 400 | bad request | `TypedResults.BadRequest()` / `ValidationProblem` |
| ⭐ 401 vs 403 | not logged in vs not allowed | `Unauthorized()` / `Forbid()` |
| ⭐ 404 | not found | `TypedResults.NotFound()` |
| 409 | state conflict | `TypedResults.Conflict()` |
| 412 | `If-Match` failed | `Results.StatusCode(412)` |
| 413 | body too large | Kestrel limit |
| 422 | semantic validation failed | `TypedResults.UnprocessableEntity()` |
| ⭐ 429 | rate limited + `Retry-After` | rate limiter |
| 500 | bug | `UseExceptionHandler()` |
| 502 / 503 / 504 | upstream bad / unavailable / timeout | usually proxy |
| `Results<Ok<T>, NotFound>` | typed union of responses | shows in OpenAPI |
| ⭐ `AddProblemDetails()` | RFC 9457 errors everywhere | with `UseStatusCodePages()` |

## Headers
| Header | Use | Note |
|:--|:--|:--|
| ⭐ `Content-Type` | body format | `application/json; charset=utf-8` |
| `Accept` | wanted format | |
| ⭐ `Authorization` | credentials | never log |
| `Location` | new resource / redirect | |
| ⭐ `Retry-After` | when to retry | 429, 503 |
| `traceparent` | W3C trace context | added by .NET |
| `Idempotency-Key` | safe POST retry | your API contract |
| `User-Agent` | client identity | |
| `ctx.Request.GetTypedHeaders()` | typed header access | `Microsoft.Net.Http.Headers` |

## HTTP versions
| Version | Key fact | Kestrel |
|:--|:--|:--|
| HTTP/1.1 | one request at a time per connection | default |
| ⭐ HTTP/2 | multiplexed streams, HPACK | default with TLS; `Http1AndHttp2` |
| HTTP/3 | QUIC over UDP, no TCP HOL blocking | opt-in, `libmsquic` on Linux |
| h2c | HTTP/2 without TLS | internal hops, gRPC |
| ALPN | negotiates h2 in TLS | |
| `Alt-Svc` | advertises h3 | |

## Kestrel endpoints
| Setting | Example | Note |
|:--|:--|:--|
| `launchSettings.json` | `applicationUrl` | local `dotnet run` only |
| ⭐ `ASPNETCORE_HTTP_PORTS` | `8080` | container default (.NET 8+) |
| `ASPNETCORE_HTTPS_PORTS` | `8443` | |
| `ASPNETCORE_URLS` | `http://+:8080` | `+` = all interfaces |
| `Kestrel:Endpoints:Https:Url` | config section | per-endpoint certs |
| `ConfigureKestrel(k => k.ListenAnyIP(8080))` | code | |
| `Kestrel:Certificates:Default` | default cert | path or store |

## Kestrel limits
| Limit | Default | Note |
|:--|:--|:--|
| ⭐ `MaxRequestBodySize` | 30,000,000 bytes | per endpoint: `RequestSizeLimitAttribute` |
| ⭐ `KeepAliveTimeout` | 130 s | longer than proxy idle timeout |
| `RequestHeadersTimeout` | 30 s | slowloris |
| `MaxRequestHeadersTotalSize` | 32 KB | big cookies |
| `MaxRequestLineSize` | 8 KB | long URLs |
| `MaxConcurrentConnections` | unlimited | |
| `MinRequestBodyDataRate` | 240 B/s, 5 s grace | slow uploads |
| `Http2.MaxStreamsPerConnection` | 100 | |
| `FormOptions.MultipartBodyLengthLimit` | 128 MB | form uploads |

## TLS and HTTPS
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `dotnet dev-certs https --trust` | trusted localhost cert | once per machine |
| `dotnet dev-certs https --clean` | remove dev certs | when broken |
| ⭐ `app.UseHttpsRedirection()` | http → https | needs forwarded headers behind proxy |
| ⭐ `app.UseHsts()` | `Strict-Transport-Security` | not in Development |
| `AddHsts(o => o.MaxAge = …)` | HSTS options | default 30 days |
| HSTS preload | browsers hardcode HTTPS | one-way door |
| TLS termination at proxy | Front Door / ingress | managed certs |
| `SslProtocols` | allowed TLS versions | default lets OS choose |

## Cookies
| Item | Effect | Note |
|:--|:--|:--|
| ⭐ `HttpOnly` | no JS access | auth cookies |
| ⭐ `Secure` | HTTPS only | always |
| ⭐ `SameSite=Lax` | blocks cross-site subrequests | default for auth |
| `SameSite=Strict` | blocks cross-site navigation too | admin apps |
| `SameSite=None` | always sent, needs `Secure` | embeds only |
| ⭐ `__Host-` prefix | Secure, `Path=/`, no Domain | session cookies |
| `__Secure-` prefix | requires Secure | |
| `CookieOptions` | ASP.NET Core cookie settings | `Response.Cookies.Append` |
| `IsEssential` | bypass consent policy | only truly essential |
| same-site vs same-origin | registrable domain vs scheme+host+port | |

## CORS
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `AddCors(o => o.AddPolicy(...))` | define policy | |
| ⭐ `WithOrigins(...)` | allowlist | from config |
| `AllowCredentials()` | cookies / auth allowed | never with any origin |
| `WithMethods` / `WithHeaders` | allowed preflight values | |
| `WithExposedHeaders("Location")` | readable response headers | |
| `SetPreflightMaxAge(...)` | cache preflight | fewer OPTIONS |
| ⭐ `app.UseCors("web")` | apply | before auth middleware |
| `.RequireCors("web")` | per endpoint | |
| `SetIsOriginAllowed(_ => true)` | reflect any origin | avoid |
| Preflight trigger | JSON body, `Authorization`, PUT/PATCH/DELETE | |
| `Vary: Origin` | cache per origin | added automatically |
| Same-origin proxy | Next.js rewrites `/api` | no CORS needed |

## HTTP caching
| Directive / header | Meaning | Note |
|:--|:--|:--|
| ⭐ `max-age=N` | fresh N s | |
| `s-maxage=N` | CDN TTL | |
| ⭐ `private` | browser only | per-user data |
| ⭐ `no-cache` | revalidate each use | HTML |
| ⭐ `no-store` | never store | secrets |
| `immutable` | never changes | hashed assets |
| `stale-while-revalidate=N` | serve stale while refreshing | |
| ⭐ `ETag` + `If-None-Match` | validator → 304 | |
| `If-Match` | optimistic concurrency → 412 | PUT/PATCH |
| `Last-Modified` | date validator | weaker |
| `GetTypedHeaders().CacheControl` | set typed | `CacheControlHeaderValue` |
| `AddOutputCache()` | server-side cache | see 03-backend/06-caching |
| `AddResponseCaching()` | header-driven server cache | rarely needed |

## Compression and negotiation
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `AddResponseCompression()` + `UseResponseCompression()` | compress responses | |
| `BrotliCompressionProvider` | `br` | built in |
| `GzipCompressionProvider` | `gzip` | built in |
| zstd | modern codec | not built in; CDN |
| `EnableForHttps` | compress over TLS | BREACH risk with secrets |
| `MimeTypes` | what to compress | text only |
| ⭐ `Vary: Accept-Encoding` | cache per encoding | |
| `AddRequestDecompression()` | accept compressed request bodies | .NET 7+ |
| `Accept` negotiation | pick representation | JSON by default |

## Proxies and forwarded headers
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `UseForwardedHeaders()` | restore IP, scheme | first middleware |
| `XForwardedFor` / `XForwardedProto` | which headers to read | |
| ⭐ `KnownIPNetworks` | trusted proxy CIDRs | .NET 10; `KnownNetworks` obsolete (ASPDEPR005) |
| `KnownProxies` | trusted proxy IPs | |
| `ForwardLimit` | how many hops | default 1 |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | enable, trust all | private ingress only |
| `ctx.Connection.RemoteIpAddress` | client IP after middleware | |
| `X-Forwarded-Host` | original host | only if you trust it |

## Timeouts and keep-alive
| Item | Default / limit | Note |
|:--|:--|:--|
| ⭐ `AddRequestTimeouts()` + `UseRequestTimeouts()` | none by default | .NET 8+ |
| `.WithRequestTimeout(...)` | per endpoint | not while debugging |
| ⭐ `HttpClient.Timeout` | 100 s | set much lower |
| `PooledConnectionLifetime` | infinite | set ~5 min for DNS changes |
| `PooledConnectionIdleTimeout` | 1 min | |
| Container Apps ingress | 240 s fixed | long work → 202 + job |
| Front Door origin timeout | 60 s (16–240 s) | |
| SQL command timeout | 30 s | EF Core `CommandTimeout` |
| ⭐ `CancellationToken` in handlers | fires on abort/timeout | pass it down |

## Debugging
| Tool / command | What it does | Note |
|:--|:--|:--|
| ⭐ `curl -v` | full exchange | `-k` for dev certs |
| `curl -si` / `-sI` | headers + body / headers | |
| ⭐ `curl -w '…%{time_starttransfer}…'` | timing breakdown | |
| `curl --resolve host:443:ip` | pin backend | |
| `curl -N` | no buffering | SSE |
| ⭐ DevTools Timing tab | per-phase timing | |
| Copy as cURL | replay browser request | |
| Preserve log / Disable cache | debugging toggles | |
| ⭐ `.http` files | runnable requests | VS built in; VS Code REST Client |
| `http-client.env.json` | environments for `.http` | private `.user` file ignored |

## Real-time
| Option | Direction | Note |
|:--|:--|:--|
| Polling | client pull | simplest |
| Long polling | held request | fallback |
| ⭐ SSE | server → client | `TypedResults.ServerSentEvents` (.NET 10) |
| `SseItem<T>` | event type + id | `System.Net.ServerSentEvents` |
| `EventSource` | browser SSE client | auto reconnect, `Last-Event-ID` |
| WebSockets | both ways | `app.UseWebSockets()` |
| ⭐ SignalR | hubs, groups, fallbacks | `AddSignalR()`, `MapHub<T>()` |
| Backplane | fan-out across instances | Redis / Azure SignalR Service |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Listening on `localhost` in a container | unreachable | `+:8080` |
| HSTS in Development | breaks localhost for a year | only in Production |
| No forwarded headers behind proxy | wrong IP, http redirects | `UseForwardedHeaders` first |
| `AllowAnyOrigin` + credentials | rejected; people reflect origins | explicit allowlist |
| `UseCors` after auth | preflight gets 401 | before auth |
| `new HttpClient()` per call | socket exhaustion, no reuse | `IHttpClientFactory` |
| No timeout on long requests | proxy kills, client retries | request timeouts + 202 jobs |
| Personal data without `private` | CDN serves it to others | `private, no-store` |
| Compression on SSE | events batched | disable for `text/event-stream` |

## Sources
| Source | Link |
|:--|:--|
| RFC 9110 | https://www.rfc-editor.org/rfc/rfc9110 |
| RFC 9111 | https://www.rfc-editor.org/rfc/rfc9111 |
| Kestrel | https://learn.microsoft.com/aspnet/core/fundamentals/servers/kestrel |
| Proxies and load balancers | https://learn.microsoft.com/aspnet/core/host-and-deploy/proxy-load-balancer |
| CORS | https://learn.microsoft.com/aspnet/core/security/cors |
| Response compression | https://learn.microsoft.com/aspnet/core/performance/response-compression |
| Request timeouts | https://learn.microsoft.com/aspnet/core/performance/timeouts |
| SignalR | https://learn.microsoft.com/aspnet/core/signalr/introduction |
| MDN HTTP | https://developer.mozilla.org/docs/Web/HTTP |
