---
title: Debugging tools and real-time options
tech: curl, Chrome DevTools, .http files, ASP.NET Core 10 (SSE, SignalR)
version: ASP.NET Core 10, curl 8.x
date: 2026-11-09
covers: [12, 13, 15, 16]
---
# Debugging tools and real-time options
[← Overview](00-overview.md)

## Why it matters
- "The API is slow" turns out to be a 600 ms TLS handshake to a far region. `curl -w` shows it in one command.
- A dashboard polls `/orders` every second from 5,000 browsers: 5,000 requests per second for data that changes once a minute.
- A team picks WebSockets for one-way notifications and then builds reconnects, heartbeats, and scaling for something SSE does natively.

## Concepts

### curl for HTTP debugging
| Need | Command |
|:--|:--|
| full request and response headers | `curl -v https://localhost:7043/health -k` |
| response headers only | `curl -sI url` |
| status line + headers + body | `curl -si url` |
| POST JSON | `curl -si -X POST url -H 'Content-Type: application/json' -d @order.json` |
| force a version | `--http1.1`, `--http2` |
| where time goes | `curl -so /dev/null -w 'dns %{time_namelookup} connect %{time_connect} tls %{time_appconnect} ttfb %{time_starttransfer} total %{time_total}\n' url` |
| hit one backend by IP | `--resolve api.shop.test:443:10.0.1.5` |
| follow redirects and show them | `-L -v` |

### Chrome DevTools Network panel
| Feature | Use |
|:--|:--|
| Timing tab | queueing, DNS, connect, TLS, TTFB, download |
| Protocol column | h2 / h3 per request |
| Preserve log | keep requests across redirects and navigations |
| Disable cache | test without browser caching |
| Copy as cURL | replay a browser request in the terminal |
| Throttling | slow 4G, offline |
| CORS errors | Console shows which header was missing |
| Initiator | which code started the request |

### `.http` files
`dotnet new webapi` creates `Shop.Api.http`. Visual Studio runs these natively; in VS Code use the REST Client extension. Commit them: they are executable API docs.

`src/Shop.Api/Shop.Api.http`
```http
@host = https://localhost:7043

### Create an order
POST {{host}}/orders
Content-Type: application/json

{ "sku": "COF-1", "quantity": 2 }

### Conditional GET
GET {{host}}/catalog
If-None-Match: "42"
```
Environment values (hosts, tokens) go in `http-client.env.json`; keep the private file (`http-client.env.json.user`) out of Git.

### Real-time options
| Option | Direction | Transport | Use when |
|:--|:--|:--|:--|
| Short polling | client asks every N s | plain HTTP | rare updates, simplest |
| Long polling | server holds the request | plain HTTP | legacy fallback |
| ⭐ Server-Sent Events | server → client | one long HTTP response, `text/event-stream` | notifications, progress, feeds |
| WebSockets | both ways | upgraded TCP connection | chat, collaboration, games |
| ⭐ SignalR | both ways | WebSockets, falls back to SSE / long polling | .NET apps needing hubs, groups, reconnects |

SSE gives automatic reconnects and `Last-Event-ID` resumption in the browser's `EventSource`, works over HTTP/2, and passes through most proxies. Scaling either SSE or SignalR across instances needs a backplane (03-backend/09-scalability).

### SSE in ASP.NET Core 10
`TypedResults.ServerSentEvents` streams an `IAsyncEnumerable<T>`; each item becomes an event. Use `SseItem<T>` to set the event type and id.

## Example
`src/Shop.Api/Program.cs`
```csharp
using System.Net.ServerSentEvents;
using System.Runtime.CompilerServices;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSignalR();
var app = builder.Build();

app.MapGet("/orders/{id:int}/progress", (int id, CancellationToken ct) =>
    TypedResults.ServerSentEvents(Progress(id, ct)));

app.MapHub<OrdersHub>("/hubs/orders");
app.Run();

static async IAsyncEnumerable<SseItem<OrderStatus>> Progress(
    int id, [EnumeratorCancellation] CancellationToken ct)
{
    string[] steps = ["paid", "roasting", "packed", "shipped"];
    for (var i = 0; i < steps.Length; i++)
    {
        await Task.Delay(TimeSpan.FromSeconds(1), ct);
        yield return new SseItem<OrderStatus>(new OrderStatus(id, steps[i]), eventType: "status")
        {
            EventId = i.ToString(),
        };
    }
}

record OrderStatus(int OrderId, string Status);

class OrdersHub : Microsoft.AspNetCore.SignalR.Hub
{
    public Task Subscribe(int orderId) => Groups.AddToGroupAsync(Context.ConnectionId, $"order-{orderId}");
}
```
`terminal`
```bash
curl -N localhost:5000/orders/7/progress
# event: status
# id: 0
# data: {"orderId":7,"status":"paid"}
```
Browser:
```ts
const es = new EventSource("/api/orders/7/progress");
es.addEventListener("status", (e) => console.log(JSON.parse(e.data)));
```

## Production patterns
- Start with polling or SSE; move to SignalR/WebSockets only for true two-way needs.
- Long-lived connections bypass request timeouts and hold memory; cap them per user and close idle ones.
- Disable response buffering and compression for `text/event-stream` at proxies, or events arrive in batches.
- Keep `.http` files next to the API and use them in code review to show how an endpoint is called.

## Mistakes
Wrong: a WebSocket for one-way progress updates.
Right: SSE (`TypedResults.ServerSentEvents`) with automatic browser reconnects.

Wrong: guessing about latency.
Right: `curl -w` timings or the DevTools Timing tab, then fix the slow phase.

## Check yourself
1. Which curl variable shows time to first byte?
2. What does SSE give you that a simple polling loop doesn't?
3. Why do SSE and SignalR need extra work when you run three instances of the API?

<details><summary>Answers</summary>

1. `%{time_starttransfer}`.
2. Server push without repeated requests, automatic reconnects, and resumption with `Last-Event-ID`.
3. Each client is connected to one instance; an event produced on another instance must be relayed through a backplane (Redis, Azure SignalR Service).
</details>

## Sources
- [curl — write-out variables](https://everything.curl.dev/usingcurl/verbose/writeout)
- [Chrome DevTools — Network reference](https://developer.chrome.com/docs/devtools/network/reference)
- [Use .http files in Visual Studio](https://learn.microsoft.com/aspnet/core/test/http-files)
- [What's new in ASP.NET Core 10 — Server-Sent Events](https://learn.microsoft.com/aspnet/core/release-notes/aspnetcore-10.0)
- [ASP.NET Core SignalR overview](https://learn.microsoft.com/aspnet/core/signalr/introduction)
- [MDN — Server-sent events](https://developer.mozilla.org/docs/Web/API/Server-sent_events)
