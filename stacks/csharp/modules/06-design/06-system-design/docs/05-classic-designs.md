---
title: Classic designs
tech: Azure SQL, Redis 8, Azure Service Bus, Azure SignalR Service, Azure AI Search, Blob Storage, C# 14
version: November 2026
date: 2026-11-09
covers: [10]
---
# Classic designs
[← Overview](00-overview.md)

## Why it matters
- Classic designs (URL shortener, feed, chat, notifications, autocomplete) are small enough to discuss in an hour but contain most real trade-offs: ID generation, read/write ratios, fan-out, real-time delivery, and prefix search.
- They come up in interviews and, in disguise, in real products: the shop's "share this coffee" links, "what's new" feed, support chat, order notifications, and search box.

## Concepts

### URL shortener
| Aspect | Design |
|:--|:--|
| requirements | create short link; redirect fast; optional expiry and analytics; ~100:1 reads to writes |
| ⭐ ID generation | counter (SQL sequence / Redis `INCR`) + Base62 encoding, or random 7-char Base62 with collision check |
| storage | `ShortLinks(Code PK, TargetUrl, CreatedAt, ExpiresAt)` in SQL; ~7 chars covers 62^7 ≈ 3.5 trillion |
| ⭐ reads | Front Door / Redis cache by code; `301` (cacheable) vs `302` (count every click) |
| analytics | redirect publishes a click event to a queue/stream; aggregate asynchronously |
| abuse | validate targets (no internal IPs), rate limit creation, malware lists |

### News feed ("what's new" for followed roasters)
| Aspect | Design |
|:--|:--|
| ⭐ fan-out on write | on post, write post ID into each follower's feed list (Redis list / SQL table); fast reads |
| ⭐ fan-out on read | on read, merge recent posts from followed accounts; cheap writes, slower reads |
| ⭐ hybrid | write fan-out for normal accounts; read-time merge for accounts with huge follower counts |
| ranking | start chronological; rank later |
| pagination | cursor by (time, ID) |

### Chat (support chat)
| Aspect | Design |
|:--|:--|
| ⭐ connections | WebSockets via Azure SignalR Service (no sticky sessions, scales connections) |
| delivery | message → persisted (SQL) → broadcast to conversation group; client acks; resend on reconnect from last seen ID |
| ordering | per-conversation sequence numbers assigned by the server |
| presence | Redis with TTL heartbeats |
| storage | `Messages(ConversationId, Seq, SenderId, Body, SentAt)`, clustered by (ConversationId, Seq) |

### Notifications
| Aspect | Design |
|:--|:--|
| ⭐ pipeline | domain event → notification service decides channels per user preferences → per-channel queues → senders |
| channels | email (ACS), push (provider), SMS, in-app (SignalR) |
| ⭐ reliability | outbox, idempotent senders (notification ID), retries with backoff, DLQ |
| preferences | opt-outs per type and channel; quiet hours; suppression (bounces) |
| templates | versioned, localised |
| rate | per-user caps to avoid spamming |

### Search autocomplete
| Aspect | Design |
|:--|:--|
| ⭐ data structure | prefix lookup: trie (08-data-structures-algorithms), or a search engine's suggester |
| ⭐ managed | Azure AI Search suggesters / autocomplete API on product names |
| ranking | popularity (search counts), recency, personalisation later |
| latency | < 100 ms: cache popular prefixes (Redis/CDN), debounce in the UI (300 ms) |
| updates | rebuild suggestions periodically from logs; product changes via events |

## In our stack
- Redis, SQL, Service Bus, SignalR Service, AI Search, Front Door: [02-building-blocks-storage](02-building-blocks-storage.md).
- SignalR scale-out: [03-backend/09-scalability lesson 03](../../../03-backend/09-scalability/docs/03-horizontal-scaling-load-balancing.md).
- Notifications pipeline pieces: [03-backend/07-background-jobs](../../../03-backend/07-background-jobs/README.md), [03-backend/12-integrations lesson 03](../../../03-backend/12-integrations/docs/03-email-acs-deliverability.md).
- Tries and BFS for autocomplete and graphs: [08-data-structures-algorithms](../../08-data-structures-algorithms/README.md).

## When not to
- Don't build a custom trie service when Azure AI Search suggesters meet the latency and relevance needs.
- Don't implement fan-out on write for a feed with 50 users; a query on read is fine.
- Don't build your own WebSocket scale-out when SignalR Service exists.

## Example
Base62 encoding for short codes:
```csharp
public static class Base62
{
    private const string Alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    public static string Encode(long value)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(value);
        if (value == 0) return "0";
        Span<char> buffer = stackalloc char[11];                 // long.MaxValue needs 11 chars
        var i = buffer.Length;
        while (value > 0) { buffer[--i] = Alphabet[(int)(value % 62)]; value /= 62; }
        return new string(buffer[i..]);
    }

    public static long Decode(string code)
    {
        long value = 0;
        foreach (var c in code)
        {
            var digit = Alphabet.IndexOf(c);
            if (digit < 0) throw new FormatException($"Invalid character '{c}' in {code}");
            value = checked(value * 62 + digit);
        }
        return value;
    }
}

Console.WriteLine(Base62.Encode(125_000_000));   // "8SUD2" (5 chars, URL-safe); Decode("8SUD2") == 125_000_000
```
Short link redirect endpoint with caching and async click tracking:
```csharp
app.MapGet("/s/{code}", async (string code, HybridCache cache, ShortLinksDb db, ServiceBusSender clicks, CancellationToken ct) =>
{
    var target = await cache.GetOrCreateAsync($"short:{code}",
        async c => await db.ShortLinks.Where(l => l.Code == code && (l.ExpiresAt == null || l.ExpiresAt > DateTimeOffset.UtcNow))
                                      .Select(l => l.TargetUrl).SingleOrDefaultAsync(c),
        cancellationToken: ct);
    if (target is null) return Results.NotFound();

    _ = clicks.SendMessageAsync(new ServiceBusMessage(BinaryData.FromObjectAsJson(new { code, at = DateTimeOffset.UtcNow })), CancellationToken.None);
    return Results.Redirect(target, permanent: false);              // 302: every click reaches us for analytics
});
```
The click send is fire-and-forget on purpose (analytics may lose a few clicks; the redirect must stay fast). For data that must not be lost, use the outbox instead.

Feed (hybrid) as a sketch:
```text
Post created by roaster R (followers: F)
  if |F| < 10,000 → fan-out on write: push postId into Redis list feed:{followerId} (trim to 500) via workers
  else           → mark R as "celebrity"; readers merge R's latest posts at read time
Read feed: LRANGE feed:{me} 0 49  ∪  latest posts of followed celebrities → sort by time → page by cursor
```

## Production patterns
- Start every classic design with requirements and estimates; the read/write ratio and fan-out size drive the design.
- Use managed building blocks (SignalR Service, AI Search suggesters, Service Bus) before custom infrastructure.
- Separate the fast path (redirect, read feed, send message) from the slow path (analytics, ranking, fan-out) with queues.

## Mistakes
Wrong: random 4-character short codes without collision handling.
Right: a counter + Base62 (no collisions) or longer random codes with a unique constraint and retry.

Wrong: fan-out on write for an account with 2 million followers inside the request.
Right: hybrid fan-out; celebrities merged at read time; fan-out workers off the request path.

## Check yourself
1. Why might a URL shortener use 302 instead of 301?
2. When is fan-out on read better than fan-out on write?
3. Which Azure services cover chat connections and autocomplete?

<details><summary>Answers</summary>

1. 301 is cached by browsers and proxies, so later clicks never reach the service and can't be counted; 302 sends every click through, enabling analytics and changing targets.
2. When accounts have very many followers (writes would explode) or most feeds are rarely read; reads assemble the feed on demand instead of writing to millions of lists.
3. Azure SignalR Service for scalable real-time WebSocket connections, and Azure AI Search (suggesters/autocomplete) for prefix suggestions.
</details>

## Sources
- [Alex Xu — System Design Interview (URL shortener, news feed, chat, notifications, autocomplete)](https://bytebytego.com/)
- [Azure SignalR Service](https://learn.microsoft.com/azure/azure-signalr/signalr-overview)
- [Azure AI Search — autocomplete and suggestions](https://learn.microsoft.com/azure/search/search-add-autocomplete-suggestions)
- [Notification system design (Azure Architecture Center, event-driven)](https://learn.microsoft.com/azure/architecture/guide/architecture-styles/event-driven)
- [Designing Data-Intensive Applications (Twitter timeline example)](https://dataintensive.net/)
