---
title: Debugging HTTP and real-time options
tech: HTTP, Node.js 26, Express 5, curl, Chrome DevTools
version: Node.js 26 LTS, Express 5.2, curl 8, Chrome DevTools (Nov 2026)
date: 2026-11-07
covers: [12, 13]
---
# Debugging HTTP and real-time options
[← Overview](00-overview.md)

## Why it matters
- "The API is broken" tickets take hours because nobody can reproduce the exact request. A copied curl command reproduces it in seconds.
- A team picks WebSockets for a notification badge, then fights sticky sessions, proxies dropping idle connections, and reconnect logic. Server-Sent Events would have been 20 lines.
- 50,000 clients polling every second melt the database.

## Concepts

### curl flags you will actually use
| Flag | Use |
|:--|:--|
| `-i` / `-I` | include response headers / send HEAD |
| `-v` | full exchange, including TLS handshake and request headers |
| `-X POST` | set the method |
| `-H 'Name: value'` | add a header |
| `--json '{"a":1}'` | JSON body with matching `Content-Type` and `Accept` |
| `-o /dev/null -s -w '%{http_code} %{time_total}\n'` | status and timing only |
| `-L` | follow redirects |
| `-b` / `-c` | send cookies / save cookies to a file |
| `--resolve api.example.com:443:10.0.1.5` | hit one specific server, skipping DNS |
| `--max-time 5` | overall timeout |
| `-N` | no buffering; needed to watch streams |

### DevTools Network panel
| Feature | Use |
|:--|:--|
| Filters (Fetch/XHR, Doc, JS) and search | find the request |
| Preserve log, Disable cache | keep requests across navigations; test cold loads |
| Protocol, Remote address, Initiator columns | h2/h3? which server? who triggered it? |
| Timing tab | Queueing, Stalled, DNS, Initial connection, SSL, Waiting (TTFB), Content Download |
| Copy as cURL / Copy as fetch | reproduce the exact request elsewhere |
| Throttling | simulate slow mobile networks |
| Block request URL, Local overrides | test failures and edited responses |
| Export HAR | share a session; it can contain cookies and tokens, so sanitize it |
| `Server-Timing` response header | your server's phases (`db;dur=53`) shown in the Timing tab |

CORS and cookie problems show up in the **Console** and the **Issues** tab with an explanation.

### Real-time options
| Option | Direction | Transport | Good for | Costs |
|:--|:--|:--|:--|:--|
| Short polling | client pulls | HTTP | rare updates | wasted requests; latency = interval |
| Long polling | client pulls, server holds | HTTP | fallback | one open request per client |
| Server-Sent Events | server → client | HTTP, `text/event-stream` | notifications, feeds, progress, AI token streams | one-way; needs HTTP/2 for many tabs |
| WebSocket | both ways | `Upgrade` to `ws://` / `wss://` | chat, multiplayer, live collaboration | stateful: sticky sessions, pub/sub fan-out, auth at upgrade |
| WebTransport | both ways, streams and datagrams | HTTP/3 | low-latency media and games | newer; uneven support |

Default choice: **SSE** for server-to-client push, plus normal POSTs for client actions. Pick **WebSocket** when clients also send frequent messages.

## Example: Server-Sent Events
`events.ts`
```ts
import express from 'express';
import { EventEmitter } from 'node:events';

const app = express();
const bus = new EventEmitter(); // one process only; use Redis pub/sub for several instances

app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no', // ask buffering proxies to stream immediately
  });
  res.flushHeaders();

  const send = (data: unknown) => res.write(`event: order\ndata: ${JSON.stringify(data)}\n\n`);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000); // under the LB idle timeout
  bus.on('order', send);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('order', send);
  });
});

app.post('/orders', (_req, res) => {
  bus.emit('order', { id: crypto.randomUUID(), at: new Date().toISOString() });
  res.status(202).end();
});

app.listen(3000);
```
In the browser:
```js
const events = new EventSource('/events', { withCredentials: true });
events.addEventListener('order', (e) => console.log(JSON.parse(e.data)));
// EventSource reconnects by itself. Send `id:` lines and read Last-Event-ID to resume.
```
Watch it: `curl -N localhost:3000/events` in one terminal, `curl -X POST localhost:3000/orders` in another.

## Production patterns
- **Reproduce with "Copy as cURL"** and paste it, minus secrets, into the bug report.
- **Return `X-Request-Id` on every response** and log it. Support asks users for it, and you find the exact log line.
- **Send `Server-Timing`** for slow endpoints in non-production, so DevTools shows where the server spends time.
- **Heartbeats shorter than every idle timeout on the path** (ALB default: 60 s) for SSE and WebSocket.
- **Fan out across instances with Redis pub/sub** ([03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md)). In-memory emitters only reach clients on the same process.
- **Authenticate streams at connect time.** EventSource cannot set headers, so use the session cookie. For WebSocket, check the session and the `Origin` header during the upgrade.
- **Cap connections per user and their lifetime.** Let clients reconnect; it also rebalances them after deploys.

## Mistakes
Wrong: `curl -k` in scripts and CI. It turns off certificate checks for good.
Right: fix the certificate chain, or pass `--cacert` for a private CA.

Wrong: posting a full HAR file in a public ticket. It can contain session cookies and tokens.
Right: export the sanitized HAR (Chrome's default) and check it before sharing.

Wrong: accepting a WebSocket upgrade from any origin. That is Cross-Site WebSocket Hijacking: another site opens a socket with the user's cookies.
Right: check `Origin` against an allowlist and verify the session before upgrading.

Wrong: polling every second for data that changes hourly.
Right: SSE, or a longer interval with ETags so most polls are cheap 304s.

## Check yourself
1. DevTools shows a long "Stalled" phase on many requests. What are likely causes?
2. Why does SSE often fit an AI chat token stream better than WebSocket?
3. SSE clients disconnect every 60 seconds in production but never locally. Why?

<details>
<summary>Answers</summary>

1. The browser is waiting for a free connection: HTTP/1.1 allows about 6 per host. HTTP/2 (multiplexing) or fewer parallel requests fixes it. Proxy negotiation and cache lookups also show up there.
2. Tokens flow one way, server to client. SSE is plain HTTP, so it works with existing cookies, proxies, HTTP/2, and automatic reconnects, while the prompt goes out as a normal POST.
3. The load balancer's idle timeout (60 s on an ALB) closes connections that carry no bytes. Send a heartbeat comment every ~25 s, or raise the idle timeout for that route.
</details>

## Sources
- [Everything curl](https://everything.curl.dev/)
- [Chrome DevTools — Network features reference](https://developer.chrome.com/docs/devtools/network/reference)
- [MDN — Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [MDN — The WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [MDN — Server-Timing](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing)
