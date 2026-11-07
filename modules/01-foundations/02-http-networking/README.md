---
title: HTTP & Networking
module: 01-foundations
tech: HTTP, Node.js 26, Express 5, curl, Chrome DevTools
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
- [ ] Proxies and load balancers: `X-Forwarded-*`, `Forwarded`, Express `trust proxy`
- [ ] ⭐ Timeouts and keep-alive that line up across client, load balancer, and server
- [ ] Debugging with curl and the DevTools Network panel
- [ ] Real-time options: polling, Server-Sent Events, WebSockets

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · What happens on a request](docs/01-request-lifecycle.md)
- [02 · Methods, status codes, and headers](docs/02-methods-status-headers.md)
- [03 · HTTPS, TLS, and cookies](docs/03-https-and-cookies.md)
- [04 · CORS and proxies](docs/04-cors-and-proxies.md)
- [05 · HTTP caching and compression](docs/05-caching-and-compression.md)
- [06 · Debugging HTTP and real-time options](docs/06-debugging-and-real-time.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 01-foundations/02-http-networking mode=tasks` when you are ready to build._
