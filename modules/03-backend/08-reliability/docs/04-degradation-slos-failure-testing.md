---
title: Degradation, dependency outages, SLOs, and failure testing
tech: Node.js 26, Express 5, BullMQ, Vitest, MSW
version: Node.js 26 LTS, Express 5.2, BullMQ 5, Vitest 4, MSW 2, AWS RDS / ElastiCache / FIS
date: 2026-11-07
covers: [9, 10, 11, 12]
---
# Degradation, dependency outages, SLOs, and failure testing
[← Overview](00-overview.md)

## Why it matters
- Redis restarts for maintenance. The product page's cache lookup throws, and the whole page returns 500 although Postgres is perfectly healthy.
- RDS fails over to its standby. Idle pool connections error, nobody attached `pool.on('error')`, and the process crashes in a loop.
- The team argues every sprint about whether reliability or features come first. Without an SLO, nobody can say what "reliable enough" means.

## Concepts

### Graceful degradation
Decide per feature: **critical** (the request fails without it) or **optional** (degrade). Write it down in a dependency table.
| Technique | Example |
|:--|:--|
| Serve stale | keep the last good value, serve it when the refresh fails (stale-if-error) |
| Defaults | empty recommendations, standard shipping estimate |
| Hide optional features | page renders without the reviews widget |
| Partial responses | return what you have plus `"degraded": ["reviews"]` |
| Defer | accept the order now, send the email when the provider is back (BullMQ) |
| Kill switches | config or flag to turn off expensive features under load |
| Read-only mode | browsing works while writes fail |
| Static fallback | the CDN serves a maintenance page when the origin is down |

### Dependency outages
| Dependency | Typical outage | App behavior |
|:--|:--|:--|
| Postgres (RDS Multi-AZ instance) | failover in 60–120 s; DNS moves to the new primary | `pool.on('error')`, short `connectionTimeoutMillis`, retry idempotent reads on connection errors; also seen: RDS Proxy, Multi-AZ DB clusters (~35 s) |
| Redis cache | restart, failover | treat errors as misses, `disableOfflineQueue: true`, breaker |
| Redis for BullMQ | restart | API: `enableOfflineQueue: false`, fail clearly or use the outbox; workers reconnect |
| Redis sessions | restart | authenticated routes fail closed (503); public pages keep working |
| Email/SMS provider | outage | queue with retries over hours |
| Payment provider | slow or down | timeout, clear error to the user, idempotent retries only |
| Certificates, DNS | expiry, misconfiguration | automation (ACM), expiry alerts |

### SLIs, SLOs, and error budgets
| Term | Meaning | Example |
|:--|:--|:--|
| SLI | measured ratio of good events to valid events | non-5xx responses faster than 500 ms / all responses |
| SLO | target for an SLI over a window | 99.9% over 30 days |
| Error budget | 1 − SLO | 0.1% ≈ 43 minutes of "bad" per 30 days |
| SLA | contract with penalties | looser than the SLO |
| Burn rate | how fast the budget is being spent | 14.4× empties a 30-day budget in about 2 days |

| SLO | Bad time per 30 days | Per year |
|:--|:--|:--|
| 99% | 7.2 h | 3.65 days |
| 99.9% | 43.2 min | 8.76 h |
| 99.95% | 21.6 min | 4.38 h |
| 99.99% | 4.3 min | 52.6 min |

Choose SLIs from **user journeys** (log in, search, check out), not from CPU or memory. Alert on **burn rate** with two windows, so alerts are fast for big incidents and quiet for blips:
| Alert | Burn rate | Long window | Short window | Budget spent |
|:--|:--|:--|:--|:--|
| Page | 14.4 | 1 h | 5 min | 2% |
| Page | 6 | 6 h | 30 min | 5% |
| Ticket | 1 | 3 days | 6 h | 10% |

**Error budget policy:** while budget remains, ship. When it's spent, freeze risky releases and fix reliability first.

### Testing failure
| Level | Tool | What you test |
|:--|:--|:--|
| Unit/integration | Vitest + MSW (`msw/node`) | timeouts, 5xx, 429, network errors, slow responses |
| Local stack | `docker compose stop redis` / `pause`; Toxiproxy (also seen) | outages, latency, dropped connections |
| Staging/production | AWS Fault Injection Service (FIS) | stop ECS tasks, CPU stress, network latency, RDS failover, AZ power interruption |
| Game days | planned team exercise | runbooks, alerts, people |
| Restore drills | backups | [04-shipping/05-data-safety](../../../04-shipping/05-data-safety/README.md) |

A chaos experiment has a **steady-state hypothesis** ("checkout success stays above 99.5%"), a **small blast radius**, **abort conditions**, and a follow-up list of fixes.

## Example
`src/products/product-page.ts` — critical vs optional dependencies.
```ts
export async function getProductPage(id: string, userId: string | undefined, budget: AbortSignal) {
  const product = await getProductCached(id);                        // critical: errors propagate (404/500)
  if (!product) throw new NotFoundError(`Product ${id} not found`);

  const [reviews, recommendations] = await Promise.allSettled([
    getReviewSummary(id, budget),                                    // optional
    userId ? getRecommendations(userId, budget) : Promise.resolve([]), // optional, has its own fallback
  ]);

  const degraded: string[] = [];
  if (reviews.status === 'rejected') degraded.push('reviews');
  return {
    product,
    reviews: reviews.status === 'fulfilled' ? reviews.value : null,
    recommendations: recommendations.status === 'fulfilled' ? recommendations.value : [],
    degraded,                                                        // the UI hides what's missing
  };
}

async function getProductCached(id: string) {
  try {
    const hit = await redis.get(`shop:product:v2:${id}`);
    if (hit) return JSON.parse(hit) as Product;
  } catch (err) {
    logger.warn({ err }, 'cache unavailable, reading from Postgres'); // cache errors are misses
  }
  return products.findById(id);
}
```
SLI and burn-rate alert (PromQL on OpenTelemetry HTTP metrics in Grafana Mimir; set up in [10-observability](../../10-observability/README.md)).
```promql
# Error ratio over 1 h divided by the error budget (SLO 99.9%): page when > 14.4 and the 5 min window agrees
(
  sum(rate(http_server_request_duration_seconds_count{job="api", http_response_status_code=~"5.."}[1h]))
  /
  sum(rate(http_server_request_duration_seconds_count{job="api"}[1h]))
) / 0.001 > 14.4
and
(
  sum(rate(http_server_request_duration_seconds_count{job="api", http_response_status_code=~"5.."}[5m]))
  /
  sum(rate(http_server_request_duration_seconds_count{job="api"}[5m]))
) / 0.001 > 14.4
```
`src/http/fetch-json.test.ts` — failure tests with Vitest and MSW.
```ts
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import { fetchJson, UpstreamError } from './fetch-json.ts';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('retries a 503, then succeeds', async () => {
  let calls = 0;
  server.use(http.get('https://carrier.test/track/1', () => {
    calls++;
    return calls < 3 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ status: 'in_transit' });
  }));
  await expect(fetchJson('https://carrier.test/track/1', { attempts: 3 })).resolves.toEqual({ status: 'in_transit' });
  expect(calls).toBe(3);
});

test('gives up when the dependency hangs', async () => {
  server.use(http.get('https://carrier.test/track/2', async () => {
    await delay('infinite');
  }));
  await expect(fetchJson('https://carrier.test/track/2', { timeoutMs: 50, attempts: 2 })).rejects.toBeInstanceOf(UpstreamError);
});

test('does not retry a 404', async () => {
  let calls = 0;
  server.use(http.get('https://carrier.test/track/3', () => {
    calls++;
    return new HttpResponse(null, { status: 404 });
  }));
  await expect(fetchJson('https://carrier.test/track/3')).rejects.toMatchObject({ status: 404 });
  expect(calls).toBe(1);
});

test('surfaces network errors after the last attempt', async () => {
  server.use(http.get('https://carrier.test/track/4', () => HttpResponse.error()));
  await expect(fetchJson('https://carrier.test/track/4', { attempts: 2 })).rejects.toMatchObject({ retryable: true });
});
```

## Production patterns
- **A dependency table per service**: each dependency marked critical or optional, with its timeout, fallback, and owner.
- **Cache and optional dependencies never fail the request**; critical ones fail it clearly and quickly.
- **2–4 SLOs per service** based on user journeys, alerted on multi-window burn rates, with a written error budget policy.
- **Failure tests in CI** (timeouts, 5xx, network errors) and **regular experiments** in staging (FIS, game days).
- **Every incident adds a test or an experiment** so the same failure is caught next time.

## Mistakes
Wrong: every dependency is critical.
```ts
const [product, reviews, recs] = await Promise.all([getProduct(id), getReviews(id), getRecs(user)]); // any failure = 500
```
Right: `Promise.allSettled` for optional parts, fallbacks, and a `degraded` marker.

Wrong: a 100% SLO, or SLOs on CPU usage. Nothing is 100% reliable, and users don't feel CPU. Right: 99.x% targets on what users experience.

Wrong: alerting on every 5xx spike. Pages at 3 a.m. for blips nobody noticed lead to alert fatigue. Right: burn-rate alerts against the SLO.

Wrong: running chaos experiments in production without abort conditions or a steady-state metric. Right: hypothesis, small blast radius, automatic stop conditions.

## Check yourself
1. How do you decide whether a dependency failure should fail the request?
2. A 99.9% SLO over 30 days: how much error budget is that, and what does a burn rate of 14.4 mean?
3. What does a good chaos experiment define before it starts?

<details>
<summary>Answers</summary>

1. Ask whether the response is still useful without it. If the core purpose of the request depends on it (the product itself, the payment), it's critical: fail clearly. If it's an enhancement (reviews, recommendations), it's optional: degrade with a fallback and mark the response.
2. 0.1% of the window, about 43 minutes of bad requests' worth per 30 days. A burn rate of 14.4 means errors are arriving 14.4 times faster than the budget allows; if it continues, the whole monthly budget is gone in about 2 days.
3. A steady-state hypothesis (the metric that should not change), the scope or blast radius, abort conditions that stop it automatically, and who watches it. Afterward, the findings become fixes.
</details>

## Sources
- [Google SRE book — Service level objectives](https://sre.google/sre-book/service-level-objectives/)
- [Google SRE workbook — Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
- [Amazon RDS — Multi-AZ deployments and failover](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html)
- [AWS Fault Injection Service](https://docs.aws.amazon.com/fis/latest/userguide/what-is.html)
- [MSW — Node.js integration](https://mswjs.io/docs/integrations/node)
- [Principles of Chaos Engineering](https://principlesofchaos.org/)
