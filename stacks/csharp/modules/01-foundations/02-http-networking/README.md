---
title: HTTP & Networking
module: 01-foundations
tech: HTTP, ASP.NET Core 10 (Kestrel), curl, Chrome DevTools
---
# HTTP & Networking
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ What happens on a request: DNS, TCP, TLS, HTTP, and where the latency goes
- [ ] ⭐ Methods, safety, idempotency, and status codes used correctly
- [ ] Headers that matter: `Content-Type`, `Accept`, `Authorization`, `Location`, `Retry-After`
- [ ] HTTP/1.1 vs HTTP/2 vs HTTP/3: multiplexing, head-of-line blocking, QUIC
- [ ] ⭐ HTTPS and TLS: certificates, HSTS, and redirects
- [ ] ⭐ Cookies done right: `HttpOnly`, `Secure`, `SameSite`, `Path`, `__Host-` prefix
- [ ] ⭐ CORS: simple vs preflighted requests, credentials, and common misconfigurations
- [ ] ⭐ HTTP caching: `Cache-Control`, `ETag`, conditional requests, CDNs
- [ ] Compression and content negotiation: Brotli, gzip, zstd, `Vary`
- [ ] Proxies and load balancers: `X-Forwarded-*`, `Forwarded`, ASP.NET Core Forwarded Headers Middleware
- [ ] ⭐ Timeouts and keep-alive that line up across client, load balancer, and server
- [ ] Debugging with curl and the DevTools Network panel
- [ ] Real-time options: polling, Server-Sent Events, WebSockets
- [ ] Kestrel: endpoints, HTTPS development certificates (`dotnet dev-certs`), HTTP/2 and HTTP/3, request limits
- [ ] Real-time in ASP.NET Core: Server-Sent Events with `TypedResults.ServerSentEvents`, and SignalR
- [ ] Repeatable requests with `.http` files in VS Code and Visual Studio

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · A request end to end, methods, status codes, headers](docs/01-request-semantics.md)
- [02 · Kestrel, HTTP versions, and TLS](docs/02-kestrel-versions-tls.md)
- [03 · Cookies and CORS in ASP.NET Core](docs/03-cookies-cors.md)
- [04 · HTTP caching, compression, and content negotiation](docs/04-caching-compression.md)
- [05 · Proxies, forwarded headers, timeouts, and keep-alive](docs/05-proxies-timeouts.md)
- [06 · Debugging tools and real-time options](docs/06-debugging-realtime.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/01-foundations/02-http-networking mode=tasks` when you are ready to build._
