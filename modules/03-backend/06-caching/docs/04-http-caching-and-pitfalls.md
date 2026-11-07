---
title: HTTP caching for APIs and caching pitfalls
tech: Redis 8, Express 5, CloudFront
version: Express 5.2, RFC 9111, AWS CloudFront
date: 2026-11-07
covers: [8, 11]
---
# HTTP caching for APIs and caching pitfalls
[← Overview](00-overview.md)

## Why it matters
- A public "top products" endpoint takes 200 ms and gets hammered by every page view; one `Cache-Control` header would let the CDN absorb 99% of it.
- A CDN caches `GET /api/me` because the response had no `Cache-Control`; for an hour, users see someone else's profile.
- Dates come back from the cache as strings; `order.createdAt.getTime()` throws only on cache hits, so the bug appears randomly.

## Concepts

### HTTP caching for API responses
| Response | Headers |
|:--|:--|
| Public, shared data (catalog, top lists, exchange rates) | `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600` |
| Per-user data | `Cache-Control: private, no-cache` (or `no-store` for sensitive data) |
| Rarely changing resources clients poll | `ETag` + `If-None-Match` → `304 Not Modified` |
| Anything varying by a header | `Vary: Accept-Encoding, Accept-Language` |
| Authenticated responses | never cached by shared caches unless explicitly `public` (and then never personalized) |

ETags save bandwidth; they save server work only if computing them is cheap (e.g. from `updated_at` or a version column, not by hashing a freshly built response).

CDN caching for APIs (CloudFront): a cache policy decides which query strings, headers, and cookies form the cache key. Include only what changes the response; forwarding all cookies/headers makes every request unique. Use `s-maxage` (or `CDN-Cache-Control`) to give the CDN a longer TTL than browsers.

### Caching pitfalls
| Pitfall | Effect | Fix |
|:--|:--|:--|
| Personalized data under shared keys | data leak between users/tenants | user/tenant in keys; `private` HTTP caching |
| Missing `Cache-Control` on dynamic responses | proxies/CDNs may cache heuristically | set it explicitly on every API response |
| Stale data after writes | wrong prices, confused users | invalidate after writes; short TTLs for volatile data |
| Unbounded keys (user input in keys) | memory exhaustion, evictions | TTLs, normalize inputs, cap cardinality |
| Caching errors or empty results too long | outages extended by the cache | short TTLs for negative/error caching |
| Serialization surprises | Dates/BigInt/Maps lost in JSON | DTOs with ISO strings, revive explicitly |
| Big values | slow reads, network saturation | smaller, per-entity values |
| Cache as source of truth | data loss on eviction/flush | always rebuildable from the DB |
| Cold cache after deploy or flush | traffic spike to the DB | warm critical keys, ramp versions |
| Security-sensitive data in Redis without TLS/auth | exposure | TLS, ACLs, network isolation |
| Inconsistent L1 caches across instances | users see different values | short L1 TTLs, pub/sub invalidation |

## Example
Express: public endpoint with CDN-friendly headers and cheap ETags.
```ts
router.get('/v1/catalog/top-products', async (req, res) => {
  const { rows: [meta] } = await db.query('SELECT max(updated_at) AS updated_at FROM products WHERE featured');
  const etag = `"top-${new Date(meta.updated_at).getTime()}"`;               // cheap validator
  res.set({
    'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    ETag: etag,
  });
  if (req.get('if-none-match') === etag) return res.status(304).end();       // no body, no heavy query
  res.json(await cached('shop:top-products:v1', 120, () => catalog.topProducts()));
});

router.get('/v1/me', requireUser, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');                              // never shared, never stored
  res.json(toUserDTO(await users.get(req.user!.id)));
});
```
A default for every API response, overridden per route:
```ts
app.use('/v1', (_req, res, next) => {
  res.set('Cache-Control', 'private, no-cache');  // safe default: dynamic and per-user unless a route says otherwise
  next();
});
```
Reviving dates from cached JSON:
```ts
type OrderDTO = { id: string; createdAt: string };            // DTOs carry ISO strings: no surprises
const order = (await cached(`shop:order:v1:${id}`, 60, () => orders.getDTO(id)))!;
const created = new Date(order.createdAt);                    // explicit conversion where needed
```
CloudFront cache policy idea (Terraform, [04-shipping/03-iac](../../../04-shipping/03-iac/README.md)):
```hcl
resource "aws_cloudfront_cache_policy" "api_public" {
  name        = "api-public"
  min_ttl     = 0
  default_ttl = 60
  max_ttl     = 600
  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config { cookie_behavior = "none" }                  # no cookies in the key: shared responses only
    headers_config { header_behavior = "none" }
    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings { items = ["category", "page"] }             # only params that change the response
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}
```

## Production patterns
- **Explicit `Cache-Control` on every API response**, with a safe private default.
- **CDN caching only for truly shared responses**, with minimal cache keys and `s-maxage` + `stale-while-revalidate`.
- **Cheap ETags** from versions/timestamps for resources clients poll.
- **DTOs as cache values** (plain JSON types), never raw ORM objects with Dates and methods.
- **A caching review checklist**: key scope (user/tenant), TTL, invalidation trigger, failure behavior, size.

## Mistakes
Wrong: no cache headers on authenticated responses behind a CDN. Right: `private, no-store`/`no-cache` explicitly.

Wrong: forwarding all cookies to the CDN cache key for public endpoints. The hit ratio drops to zero. Right: no cookies in the key for public responses.

Wrong: caching ORM entities with `Date` fields and reading them back as if they were still Dates. Right: cache DTOs with ISO strings and convert explicitly.

Wrong: caching error responses or empty results for long periods. Right: short TTLs (seconds) for negative results; don't cache 5xx responses.

## Check yourself
1. What's the difference between `max-age` and `s-maxage`?
2. Why set a default `Cache-Control: private, no-cache` for all API routes?
3. Name three ways a cache can leak or corrupt data.

<details>
<summary>Answers</summary>

1. `max-age` applies to all caches (browsers and shared); `s-maxage` overrides it for shared caches like CDNs, so the CDN can keep responses longer than browsers do.
2. Without explicit headers, intermediaries may cache responses heuristically; a safe default prevents accidental shared caching of personalized data, and public routes opt in explicitly.
3. Shared keys for per-user data, CDN caching of authenticated responses without `private`, stale entries after writes without invalidation, serialization changing types (Dates to strings), and long-cached error/empty results.
</details>

## Sources
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111)
- [MDN — Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
- [AWS — CloudFront cache policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html)
- [web.dev — HTTP cache](https://web.dev/articles/http-cache)
- [OWASP — Web Cache Deception](https://owasp.org/www-community/attacks/Web_Cache_Deception)
