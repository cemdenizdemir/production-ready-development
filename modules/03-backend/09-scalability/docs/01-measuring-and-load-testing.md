---
title: Measuring and load testing with k6
tech: k6, Node.js 26, GitHub Actions
version: k6 1.x, Node.js 26 LTS, GitHub Actions
date: 2026-11-07
covers: [1, 2, 12]
---
# Measuring and load testing with k6
[← Overview](00-overview.md)

## Why it matters
- A team spends two sprints rewriting the data layer "for performance". p95 doesn't move: 80% of the time was one partner API call.
- Launch day: the database pool saturates at 300 requests/second. A one-hour load test the week before would have shown it.
- A dependency upgrade makes the product list 40% slower. Nobody notices until the AWS bill grows and customers complain.

## Concepts

### What to measure
| Signal | What | Why |
|:--|:--|:--|
| Latency percentiles | p50, p95, p99 per route | averages hide the slow tail |
| Throughput | requests/s per route | capacity and growth |
| Errors | 5xx, timeouts | load reveals failures |
| Saturation | CPU, event loop delay, pool wait time, queue depth | whatever fills up first is the limit |
| Where time goes | traces: DB, Redis, external calls, app code | fix the biggest slice |

Two checklists: **RED** for services (Rate, Errors, Duration) and **USE** for resources (Utilization, Saturation, Errors).

**The tail compounds.** A page that calls 10 services, each slow for 1% of calls, is slow for about 10% of page loads (1 − 0.99¹⁰ ≈ 9.6%). That's why p99 per dependency matters.

### k6 basics
| Concept | Meaning |
|:--|:--|
| VU | virtual user running your function in a loop |
| Iteration | one run of the scenario function |
| Scenario + executor | how load is generated |
| Closed model (`ramping-vus`, `constant-vus`) | fixed number of users; a slower server gets fewer requests, which hides problems |
| **Open model** (`constant-arrival-rate`, `ramping-arrival-rate`) | fixed request rate like real traffic; requests keep arriving when the server slows |
| Checks | assertions on responses (recorded, don't stop the test) |
| Thresholds | pass/fail criteria; k6 exits with code 99 when one fails |
| Tags | split metrics, e.g. `name: 'GET /api/products/:id'` instead of one series per URL |
| `SharedArray` | test data loaded once and shared by all VUs |

### Test types
| Type | Load | Duration | Answers |
|:--|:--|:--|:--|
| Smoke | 1–5 VUs | 1 min | does the script work, any obvious errors? |
| Average load | normal peak | 10–60 min | do we meet the SLOs at a normal peak? |
| Stress | above peak (1.5–2×) | 10–60 min | how does it degrade? |
| Spike | sudden jump | minutes | do autoscaling and load shedding work? |
| Breakpoint | ramp until it breaks | until failure | max capacity of this setup |
| Soak | normal load | hours | memory leaks, slow degradation |

### Making load tests realistic
| Practice | Why |
|:--|:--|
| Production-sized data | a query on 1,000 rows tells you nothing about 50 million |
| Realistic endpoint mix | weight scenarios by production traffic |
| Varied IDs and users | if every VU reads the same product, the cache hides the real cost |
| Environment sized like production | results only transfer if the setup matches |
| Watch the load generator | if its CPU is maxed, you're measuring k6, not the API |
| Observe the system during the test | traces, metrics, `pg_stat_statements`, queue depth |
| Stub third parties | never load-test Stripe or an email provider; mind sandbox rate limits |

### Performance budgets in CI
| Check | When | Gate |
|:--|:--|:--|
| k6 smoke + small load | every PR, against a preview/staging environment | thresholds (p95, error rate) |
| Full load test | nightly or before big releases | compare with the last baseline |
| Query count per request | integration tests | assert no N+1 |
| Bundle size, Lighthouse | frontend ([02-frontend/07-performance](../../../02-frontend/07-performance/README.md)) | budgets |

## Example
`load/shop.ts` — open-model scenarios, realistic IDs, thresholds as SLOs.
```ts
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import type { Options } from 'k6/options';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE_URL ?? 'http://localhost:3000';
// 10,000 real product IDs exported from staging: varied IDs keep caches honest
const productIds = new SharedArray('products', () => JSON.parse(open('./data/product-ids.json')) as string[]);
const pick = () => productIds[Math.floor(Math.random() * productIds.length)];

export const options: Options = {
  scenarios: {
    browse: {
      executor: 'ramping-arrival-rate',        // open model: a request rate, like real traffic
      exec: 'browse',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 400,
      stages: [
        { target: 200, duration: '5m' },        // ramp to the expected peak
        { target: 200, duration: '15m' },       // hold at peak
        { target: 0, duration: '1m' },
      ],
    },
    checkout: {
      executor: 'constant-arrival-rate',
      exec: 'checkout',
      rate: 5,
      timeUnit: '1s',
      duration: '21m',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:browse}': ['p(95)<300', 'p(99)<800'],
    'http_req_duration{scenario:checkout}': ['p(95)<800'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: __ENV.LOAD_USER, password: __ENV.LOAD_PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'logged in': (r) => r.status === 200 });
  return { sid: res.cookies['__Host-sid']?.[0]?.value ?? '' };
}

export function browse() {
  const res = http.get(`${BASE}/api/products/${pick()}`, { tags: { name: 'GET /api/products/:id' } });
  check(res, { 'product 200': (r) => r.status === 200 });
}

export function checkout(data: { sid: string }) {
  const res = http.post(`${BASE}/api/orders`, JSON.stringify({ items: [{ productId: pick(), quantity: 1 }] }), {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': uuidv4(),
      Cookie: `__Host-sid=${data.sid}`,
      Origin: BASE,                             // if your CSRF protection checks Origin
    },
    tags: { name: 'POST /api/orders' },
  });
  check(res, { 'order 201': (r) => r.status === 201 });
}
```
Running it:
```bash
k6 run load/shop.ts -e BASE_URL=https://staging.example.com -e LOAD_USER=load@example.com -e LOAD_PASSWORD="$LOAD_PASSWORD"
# metrics into Prometheus (remote-write receiver enabled) for Grafana dashboards next to your API metrics
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write k6 run --out experimental-prometheus-rw load/shop.ts
```
`.github/workflows/load-smoke.yml` — a small load test gates every deploy to staging (pin actions to SHAs, see [01-foundations/04-ci-cd lesson 03](../../../01-foundations/04-ci-cd/docs/03-secure-workflows.md)).
```yaml
jobs:
  load-smoke:
    runs-on: ubuntu-latest
    needs: deploy-staging
    steps:
      - uses: actions/checkout@<40-char-commit-sha>
      - uses: grafana/setup-k6-action@<40-char-commit-sha>
      - uses: grafana/run-k6-action@<40-char-commit-sha>
        with:
          path: load/smoke.ts            # 2 minutes, 20 req/s, same thresholds
        env:
          BASE_URL: ${{ vars.STAGING_URL }}
          LOAD_USER: ${{ vars.LOAD_USER }}
          LOAD_PASSWORD: ${{ secrets.LOAD_PASSWORD }}
```

## Production patterns
- **Percentiles per route, never averages**; dashboards show p50/p95/p99 next to throughput and errors.
- **Open-model load tests** with production-sized data and a realistic mix of endpoints.
- **Thresholds mirror the SLOs** from [08-reliability lesson 04](../../08-reliability/docs/04-degradation-slos-failure-testing.md).
- **During every test, find the first thing that saturates** (CPU, event loop, pool, DB, Redis), then fix that.
- **Small load test on every deploy, full test before big launches**, results compared with a baseline.

## Mistakes
Wrong: reporting averages.
```text
avg 120 ms   <- looks fine
p99 4.8 s    <- 1 in 100 users waits 5 seconds
```
Right: p95/p99 per route, with throughput next to them.

Wrong: a closed-model test (fixed VUs, no arrival rate). When the server slows, VUs send fewer requests, so the test reports a healthy-looking system. Right: arrival-rate executors.

Wrong: every VU requests `/products/1`. 100% cache hits and a warm page cache: the numbers say nothing about real traffic. Right: thousands of varied IDs from realistic data.

Wrong: load-testing production from a laptop over Wi-Fi. You measure your network, and you may cause an incident. Right: a production-like staging environment, a load generator in the same region, and a heads-up to the team.

## Check yourself
1. Why are averages misleading for latency?
2. What is the difference between open and closed load models, and which one hides problems?
3. What should you look for while a load test is running?

<details>
<summary>Answers</summary>

1. Latency distributions have long tails. A small share of very slow requests barely moves the average but is exactly what frustrated users experience. Percentiles (p95, p99) show the tail directly.
2. A closed model has a fixed number of users who wait for each response before sending the next; when the server slows, the request rate drops and the slowdown looks smaller. An open model keeps requests arriving at a set rate, like real traffic, so slowdowns turn into queueing and errors you can see. The closed model hides problems.
3. The first resource to saturate: CPU, event loop delay, DB pool wait time, database CPU or locks, Redis latency, queue depth. Use traces to see which part of the request takes the time as load rises.
</details>

## Sources
- [Grafana k6 — Load test types](https://grafana.com/docs/k6/latest/testing-guides/test-types/)
- [Grafana k6 — Open and closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/)
- [Grafana k6 — Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)
- [grafana/run-k6-action (GitHub Action)](https://github.com/grafana/run-k6-action)
- [Dean and Barroso — The Tail at Scale](https://research.google/pubs/the-tail-at-scale/)
- [Brendan Gregg — The USE method](https://www.brendangregg.com/usemethod.html)
