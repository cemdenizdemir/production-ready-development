---
title: HTTP & Networking cheatsheet
tech: HTTP, Node.js 26, Express 5, curl, Chrome DevTools
version: Node.js 26 LTS, Express 5.2, curl 8, Chrome DevTools (Nov 2026)
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# HTTP & Networking cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Request path and latency
| Item | What it is | Note |
|:--|:--|:--|
| ⭐ RTT | round-trip time client ↔ server | mobile: 50–300 ms; dominates latency |
| DNS lookup | name → IP, cached for the record's TTL | `dig +short host` |
| A / AAAA / CNAME | IPv4 / IPv6 / alias records | apex can't be a CNAME; use ALIAS/ANAME |
| TCP handshake | SYN, SYN-ACK, ACK | 1 RTT per new connection |
| ⭐ TLS 1.3 handshake | key exchange + certificate | 1 RTT; 0-RTT on resumption |
| ⭐ Keep-alive | reuse a connection for many requests | skips DNS/TCP/TLS cost |
| TTFB | time to first byte | network + server time |
| Connection pool | reused sockets per origin | Undici pools by default in Node `fetch` |
| `dns-prefetch` / `preconnect` | `<link rel>` hints to warm connections | for critical third-party origins |
| Happy Eyeballs | race IPv6 and IPv4 connects | `autoSelectFamily` in Node 20+ |

## HTTP versions
| Version | Key fact | Note |
|:--|:--|:--|
| HTTP/1.1 | one request at a time per connection | browsers open ~6 per host |
| ⭐ HTTP/2 | multiplexed streams over one TCP connection | HPACK headers; TCP head-of-line blocking |
| ⭐ HTTP/3 | streams over QUIC (UDP) | no cross-stream HOL blocking; QPACK |
| ALPN | TLS extension choosing h2 / http/1.1 | negotiated in the handshake |
| `Alt-Svc` | header advertising HTTP/3 | `Alt-Svc: h3=":443"; ma=86400` |
| h2c | HTTP/2 without TLS | internal only; rare |
| Server push | HTTP/2 push | avoid: removed from Chrome; use 103 or preload |
| 103 Early Hints | send preload links before the response | supported by major CDNs |

## Methods
| Method | Safe | Idempotent | Use |
|:--|:-:|:-:|:--|
| ⭐ GET | ✓ | ✓ | read |
| HEAD | ✓ | ✓ | headers only, size checks |
| OPTIONS | ✓ | ✓ | CORS preflight, capabilities |
| ⭐ POST | ✗ | ✗ | create, actions; add `Idempotency-Key` for retries |
| ⭐ PUT | ✗ | ✓ | create or replace at a known URL |
| ⭐ PATCH | ✗ | ✗ | partial update (JSON Merge Patch or JSON Patch) |
| ⭐ DELETE | ✗ | ✓ | remove |
| QUERY | ✓ | ✓ | GET with a body; IETF draft, not yet usable |

## Status codes
| Code | Meaning | Remember |
|:--|:--|:--|
| 101 | Switching Protocols | WebSocket upgrade |
| 103 | Early Hints | preload before the real response |
| ⭐ 200 | OK | body included |
| ⭐ 201 | Created | send `Location` |
| 202 | Accepted | async; give a status URL |
| ⭐ 204 | No Content | no body allowed |
| 206 | Partial Content | `Range` requests, video seeking |
| ⭐ 301 / 308 | Moved permanently | 308 keeps method; browsers cache 301 hard |
| ⭐ 302 / 307 | Temporary redirect | 307 keeps method |
| 303 | See Other | POST → redirect → GET |
| ⭐ 304 | Not Modified | conditional GET hit |
| ⭐ 400 | Bad Request | malformed or invalid |
| ⭐ 401 | Unauthorized | not authenticated; `WWW-Authenticate` |
| ⭐ 403 | Forbidden | authenticated, not allowed |
| ⭐ 404 | Not Found | also hides existence |
| 405 | Method Not Allowed | send `Allow` |
| 406 | Not Acceptable | can't satisfy `Accept` |
| 408 | Request Timeout | client too slow sending |
| ⭐ 409 | Conflict | duplicate, version clash |
| 410 | Gone | permanently removed |
| 412 | Precondition Failed | `If-Match` mismatch |
| 413 | Content Too Large | body over the limit |
| 415 | Unsupported Media Type | wrong `Content-Type` |
| 422 | Unprocessable Content | semantic validation error |
| ⭐ 429 | Too Many Requests | `Retry-After` |
| 451 | Unavailable For Legal Reasons | geo or legal blocks |
| ⭐ 500 | Internal Server Error | bug |
| ⭐ 502 | Bad Gateway | upstream broken, often keep-alive mismatch |
| ⭐ 503 | Service Unavailable | overloaded, maintenance; `Retry-After` |
| ⭐ 504 | Gateway Timeout | upstream too slow |

## Request headers
| Header | What it does | Example |
|:--|:--|:--|
| ⭐ `Host` | target host (required in HTTP/1.1) | `Host: api.example.com` |
| ⭐ `Content-Type` | body format | `application/json` |
| ⭐ `Accept` | wanted formats | `application/json` |
| `Accept-Encoding` | compression the client accepts | `br, gzip, zstd` |
| `Accept-Language` | preferred languages | `de-DE, en;q=0.8` |
| ⭐ `Authorization` | credentials | `Bearer eyJ…` |
| ⭐ `Cookie` | cookies for this request | `__Host-sid=…` |
| `Origin` | requesting origin (CORS, CSRF checks) | `https://app.example.com` |
| `Referer` | page that linked here | controlled by `Referrer-Policy` |
| `User-Agent` | client software | logs, analytics |
| `If-None-Match` | conditional GET by ETag | `"v3"` |
| `If-Modified-Since` | conditional GET by date | HTTP date |
| `If-Match` | conditional write | → 412 on mismatch |
| `Range` | partial content | `bytes=0-1023` |
| `Idempotency-Key` | dedupe retried POSTs | UUID per logical operation |
| `traceparent` | W3C trace context | propagated by OpenTelemetry |
| `Sec-Fetch-Site` / `-Mode` / `-Dest` | Fetch Metadata: where the request comes from | reject cross-site on sensitive routes |

## Response headers
| Header | What it does | Example |
|:--|:--|:--|
| ⭐ `Content-Type` | body format + charset | `text/html; charset=utf-8` |
| `Content-Length` | body bytes | absent when chunked |
| `Content-Encoding` | applied compression | `br` |
| ⭐ `Location` | created URL or redirect target | `/orders/42` |
| ⭐ `Retry-After` | wait before retrying | `120` |
| ⭐ `Cache-Control` | caching rules | `no-cache` |
| `ETag` / `Last-Modified` | validators | `"v3"` |
| `Vary` | request headers that vary the response | `Origin, Accept-Encoding` |
| ⭐ `Set-Cookie` | create or update a cookie | see Cookies |
| `Allow` | allowed methods | with 405 |
| `WWW-Authenticate` | auth scheme | with 401 |
| `Server-Timing` | server phases for DevTools | `db;dur=53, render;dur=12` |
| `Content-Disposition` | download filename | `attachment; filename="r.csv"` |
| ⭐ `Strict-Transport-Security` | HTTPS only for this host | `max-age=63072000; includeSubDomains` |
| `RateLimit` / `RateLimit-Policy` | remaining quota (IETF draft) | express-rate-limit `draft-8` |

## Cookies
| Attribute or term | What it does | Note |
|:--|:--|:--|
| ⭐ `HttpOnly` | hide from JavaScript | always on session cookies |
| ⭐ `Secure` | HTTPS only | localhost counts as secure |
| ⭐ `SameSite=Lax` | no cross-site POSTs/subrequests | browser default when unset |
| `SameSite=Strict` | never cross-site | breaks inbound links' login state |
| `SameSite=None` | always sent; needs `Secure` | embeds, third-party |
| `Domain` | share with subdomains | omit for host-only |
| `Path` | path scope | not a security boundary |
| `Max-Age` / `Expires` | persistence | Express `maxAge` is in ms |
| ⭐ `__Host-` prefix | forces Secure, Path=/, no Domain | best for session cookies |
| `__Secure-` prefix | forces Secure | |
| `Partitioned` | CHIPS: per-top-site third-party cookie | embeds |
| Same-site | same registrable domain (eTLD+1) | `a.example.com` ↔ `b.example.com` |
| Third-party cookies | cookies in a cross-site context | blocked by Safari and Firefox by default |
| Size | ~4 KB per cookie | store an ID, not data |
| `res.cookie()` / `res.clearCookie()` | Express helpers | clear with the same attributes |

## CORS
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Origin | scheme + host + port | port matters |
| ⭐ Simple request | no preflight | GET/HEAD/POST + safelisted headers |
| ⭐ Preflight | `OPTIONS` before the real request | JSON body, `Authorization`, PUT/PATCH/DELETE |
| ⭐ `Access-Control-Allow-Origin` | allowed origin | exact origin or `*` |
| `Access-Control-Allow-Credentials` | allow cookies and reading | never with `*` |
| `Access-Control-Allow-Methods` | methods for preflight | |
| `Access-Control-Allow-Headers` | headers for preflight | `Content-Type, Authorization` |
| `Access-Control-Max-Age` | cache preflight | Chrome caps 7200 s |
| `Access-Control-Expose-Headers` | headers readable by JS | `Location`, `X-Request-Id` |
| ⭐ `Vary: Origin` | per-origin caching | required when ACAO is dynamic |
| `credentials: 'include'` | fetch option to send cookies | client side |
| `mode: 'no-cors'` | opaque response | can't read it; rarely useful |
| CORP / COEP / COOP | cross-origin isolation headers | needed for `SharedArrayBuffer` |
| Same-origin proxy | `/api` on the app's domain | removes CORS entirely |

## Caching
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `max-age=N` | fresh for N s | |
| `s-maxage=N` | CDN-only freshness | |
| ⭐ `no-cache` | revalidate every time | not "don't cache" |
| ⭐ `no-store` | never store | secrets, PII |
| ⭐ `private` | browser only | personalized |
| `public` | shared caches allowed | |
| ⭐ `immutable` | never revalidate while fresh | fingerprinted assets |
| `stale-while-revalidate=N` | serve stale while refreshing | |
| `stale-if-error=N` | serve stale on origin errors | |
| `must-revalidate` | no stale after expiry | |
| ⭐ ETag | content version | strong `"x"`, weak `W/"x"` |
| Last-Modified | content date | second precision |
| ⭐ 304 flow | `If-None-Match` → 304, empty body | `req.fresh` in Express |
| `Age` | seconds in a shared cache | CDN debugging |
| `CDN-Cache-Control` | CDN-specific directives | some CDNs |
| `Clear-Site-Data` | wipe cache/cookies/storage | on logout |
| Cache key | URL + Vary headers | query string order matters on some CDNs |

## Compression and negotiation
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Brotli (`br`) | best text compression | pre-compress at level 11 |
| gzip | universal fallback | level 6 is a good default |
| zstd | fast, good ratio | Chrome/Firefox 2024+ |
| `Accept-Encoding` / `Content-Encoding` | negotiate / declare | + `Vary: Accept-Encoding` |
| Content negotiation | pick format/language by `Accept*` | `res.format()` in Express |
| BREACH | compression leaks secrets mixed with input | mask tokens per request |
| `compression` middleware | Express gzip/br | also seen; prefer edge compression |

## Proxies and forwarded headers
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `X-Forwarded-For` | client IP chain | leftmost entries are spoofable |
| ⭐ `X-Forwarded-Proto` | original scheme | drives `req.secure` |
| `X-Forwarded-Host` | original host | |
| `Forwarded` | RFC 7239 standard header | `for=…;proto=https` |
| ⭐ `app.set('trust proxy', 1)` | trust one hop | ALB = 1, CloudFront + ALB = 2 |
| `trust proxy` subnets | `'loopback, 10.0.0.0/8'` | safest for fixed infra |
| `req.ip` / `req.ips` | client IP / chain | depends on trust proxy |
| `req.protocol` / `req.secure` / `req.hostname` | original scheme / HTTPS? / host | depends on trust proxy |
| Reverse proxy | nginx, Envoy, ALB, CDN in front of app | terminates TLS, buffers, routes |
| PROXY protocol | passes client IP at TCP level | NLB, HAProxy |

## Node and Express HTTP APIs
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `server.keepAliveTimeout` | idle keep-alive before close | default 5 s; set > LB idle |
| ⭐ `server.headersTimeout` | time to receive headers | > keepAliveTimeout |
| `server.requestTimeout` | whole request deadline | default 300 s |
| `server.maxHeadersCount` / `--max-http-header-size` | header limits | default 16 KB headers |
| ⭐ `AbortSignal.timeout(ms)` | deadline for `fetch` | throws `TimeoutError` |
| `AbortSignal.any([a, b])` | combine signals | Node 20+ |
| `fetch` (Undici 8) | built-in HTTP client | Node 26 |
| `undici` `Agent` | pool tuning, keep-alive, connections | `setGlobalDispatcher()` |
| `express.json({ limit })` | parse JSON with a size cap | default 100 kb |
| `req.is(type)` / `req.accepts(types)` | check `Content-Type` / `Accept` | |
| `req.get(name)` | read a request header | case-insensitive |
| `res.status().json()` / `.end()` | send | |
| `res.location()` / `res.redirect(308, url)` | set Location / redirect | |
| `res.set()` / `res.vary()` / `res.type()` | headers | |
| `res.format({ json, html })` | content negotiation | |
| `res.flushHeaders()` | send headers now | SSE |

## curl
| Flag | What it does | Example |
|:--|:--|:--|
| ⭐ `-i` / `-I` | headers + body / HEAD | `curl -I https://x` |
| ⭐ `-v` | verbose exchange incl. TLS | |
| `-X` | method | `-X PATCH` |
| ⭐ `-H` | header | `-H 'Authorization: Bearer …'` |
| `-d` / `--data-raw` | body | |
| ⭐ `--json` | JSON body + headers | curl 7.82+ |
| `-F` | multipart form field / file | `-F file=@a.png` |
| ⭐ `-w` | write-out timing and status | `-w '%{http_code} %{time_total}'` |
| `-s -o /dev/null` | silence body | pair with `-w` |
| `-L` | follow redirects | |
| `-b` / `-c` | send / store cookies | `-c jar.txt` |
| `--resolve` | pin host to IP | test one backend |
| `--connect-to` | redirect host:port to another | |
| `--http2` / `--http3` | force version | |
| `--compressed` | request + decode compression | |
| `--max-time` / `--connect-timeout` | deadlines | |
| `--retry N --retry-all-errors` | retries | |
| `-N` | no buffering | streams, SSE |
| `-k` | skip TLS verification | avoid outside local experiments |
| `--cacert` | trust a private CA | |

## DevTools Network panel
| Feature | What it does | Note |
|:--|:--|:--|
| ⭐ Timing tab | DNS, connect, SSL, TTFB, download | find the slow phase |
| ⭐ Copy as cURL / fetch | reproduce a request | strip secrets |
| Preserve log | keep entries across navigations | redirects, logins |
| Disable cache | cold-load testing | only while DevTools is open |
| Throttling | slow network simulation | Fast 4G, Slow 3G, custom |
| Protocol column | h2 / h3 / http/1.1 | right-click headers to add |
| Initiator | what triggered the request | stack trace for fetch |
| Block request URL | simulate failures | |
| Local overrides | edit responses and headers locally | |
| Export HAR | session archive | contains secrets unless sanitized |
| Issues tab | cookie, CORS, mixed-content explanations | |
| Application → Cookies | inspect and edit cookies | flags shown |

## Real-time options
| Option | What it is | Note |
|:--|:--|:--|
| Short polling | repeat GET on an interval | ETag + 304 makes it cheap |
| Long polling | server holds request until data | fallback transport |
| ⭐ SSE / `EventSource` | server → client event stream | auto-reconnect, `Last-Event-ID` |
| SSE format | `event:`, `data:`, `id:`, `retry:` lines, blank line ends event | `: comment` = heartbeat |
| ⭐ WebSocket | full-duplex over `Upgrade` | check `Origin`, auth at upgrade |
| `ws` package | WebSocket server for Node | also seen: Socket.IO |
| WebSocket client | global `WebSocket` in Node 22+ | browser API on the server |
| WebTransport | HTTP/3 streams + datagrams | niche, newer |
| Heartbeat | periodic bytes on idle streams | < LB idle timeout |
| Pub/sub fan-out | broadcast across instances | Redis pub/sub |

## Numbers worth remembering
| Number | Meaning |
|:--|:--|
| 5 s | Node default `keepAliveTimeout` |
| 60 s | AWS ALB default idle timeout |
| 6 | HTTP/1.1 connections per host in browsers |
| 100 kb | Express JSON body limit default |
| 7200 s | Chrome's max preflight cache |
| ~4 KB | max size of one cookie |
| 31536000 | one year in seconds (`max-age` for assets) |
| 200 / 100 / 47 days | max public TLS cert lifetime from 2026 / 2027 / 2029 |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Node keep-alive < LB idle | intermittent 502s | `keepAliveTimeout` 65 s behind a 60 s ALB |
| No timeout on `fetch` | hung upstream holds requests | `AbortSignal.timeout()` |
| `no-cache` ≠ don't cache | private data stored | `no-store` |
| Cached HTML after deploy | old HTML references missing assets | HTML `no-cache`, assets fingerprinted |
| ACAO reflects any origin | data readable by any site | allowlist |
| CORS check after auth | preflight 401 = "CORS error" | answer OPTIONS first |
| `trust proxy: true` | spoofed IPs in limits and logs | hop count or subnets |
| Express `maxAge` in seconds | cookie dies in minutes | milliseconds |
| `Domain` on session cookie | all subdomains get it | omit, use `__Host-` |
| 301 for temporary moves | cached forever by browsers | 302 / 307 |
| 200 with an error body | caches and dashboards lie | real status codes |
| SSE behind buffering proxy | events arrive in bursts | `X-Accel-Buffering: no`, disable buffering |

## Sources
| Source | Link |
|:--|:--|
| MDN HTTP | https://developer.mozilla.org/en-US/docs/Web/HTTP |
| RFC 9110 HTTP Semantics | https://www.rfc-editor.org/rfc/rfc9110 |
| RFC 9111 HTTP Caching | https://www.rfc-editor.org/rfc/rfc9111 |
| Express 5 API | https://expressjs.com/en/5x/api.html |
| Node.js http | https://nodejs.org/api/http.html |
| Everything curl | https://everything.curl.dev/ |
| Chrome DevTools Network | https://developer.chrome.com/docs/devtools/network/reference |
| OWASP Session Management | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html |
