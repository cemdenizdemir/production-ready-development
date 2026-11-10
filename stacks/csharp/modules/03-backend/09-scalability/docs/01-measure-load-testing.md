---
title: Measuring and load testing with k6
tech: k6, dotnet-counters, OpenTelemetry metrics, GitHub Actions
version: k6 1.x, .NET 10
date: 2026-11-09
covers: [1, 2, 14]
---
# Measuring and load testing with k6
[← Overview](00-overview.md)

## Why it matters
- The team "optimised" JSON serialisation for a week. A profile later showed 80% of request time was one SQL query missing an index.
- A load test with 50 virtual users showed 120 ms average latency. The real flash sale showed p99 at 9 s, because averages hide tails, and closed-model tests slow down along with the server.
- A refactor doubled allocations per request. Nobody noticed until the monthly bill rose, because no performance budget ran in CI.

## Concepts

### What to measure
| Signal | Meaning | Source |
|:--|:--|:--|
| ⭐ latency percentiles | p50 (typical), p95, p99 (tail); never only the average | `http.server.request.duration` histogram |
| ⭐ throughput | requests per second at an acceptable latency | k6, App Insights |
| ⭐ error rate | failed ÷ total | `http_req_failed`, 5xx count |
| ⭐ saturation | how full: CPU, thread-pool queue, SQL pool, DTUs/vCores, Redis CPU | `dotnet-counters`, Azure metrics |
| where time goes | traces split by span: SQL, HTTP, Redis | OpenTelemetry traces (10-observability) |

RED for services (Rate, Errors, Duration), USE for resources (Utilization, Saturation, Errors).

| .NET tool | Use |
|:--|:--|
| `dotnet-counters monitor -n Shop.Api` | live runtime and ASP.NET Core counters (GC, thread pool, requests) |
| `dotnet-trace collect -n Shop.Api` | CPU and event trace → open in PerfView, Visual Studio, or Speedscope |
| `dotnet-gcdump` / `dotnet-dump` | heap and memory analysis |
| Visual Studio profiler / dotTrace | local CPU and allocation profiling |
| Application Insights Profiler | sampled traces from production |

### Load testing with k6
| Test type | Shape | Answers |
|:--|:--|:--|
| ⭐ smoke | 1–2 VUs, 1 min | does the script and system work? |
| ⭐ average load | expected traffic, 10–30 min | do we meet SLOs normally? |
| ⭐ stress | above expected, ramping | where does it degrade, and how? |
| spike | sudden jump | do autoscaling and shedding hold? |
| soak | normal load for hours | leaks, pool exhaustion, slow growth |
| breakpoint | ramp until failure | maximum capacity |

| Model | k6 executors | Behaviour |
|:--|:--|:--|
| closed | `constant-vus`, `ramping-vus`, `per-vu-iterations` | each VU waits for a response; a slow server gets *less* load (hides problems) |
| ⭐ open | `constant-arrival-rate`, `ramping-arrival-rate` | requests arrive at a fixed rate whatever the latency, like real users |

**Realistic data:** many products and users (not one ID), a realistic mix of endpoints (80% browse, 15% search, 5% checkout), think time, auth tokens, and a production-like database size. Run against an isolated environment, never production without agreement.

## Example
`perf/k6/shop-browse.ts` (k6 runs TypeScript directly)
```typescript
import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const products = new SharedArray("products", () => JSON.parse(open("./data/product-ids.json")) as number[]);
const BASE = __ENV.BASE_URL ?? "http://localhost:5080";

export const options = {
  scenarios: {
    browse: {
      executor: "ramping-arrival-rate",
      startRate: 20, timeUnit: "1s", preAllocatedVUs: 50, maxVUs: 400,
      stages: [
        { target: 200, duration: "2m" },   // ramp to 200 req/s
        { target: 200, duration: "10m" },  // hold
        { target: 0, duration: "1m" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{name:product}": ["p(95)<300", "p(99)<800"],
    "http_req_duration{name:search}": ["p(95)<600"],
  },
};

export default function () {
  const id = products[Math.floor(Math.random() * products.length)];
  const res = http.get(`${BASE}/products/${id}`, { tags: { name: "product" } });
  check(res, { "status 200": (r) => r.status === 200 });

  if (Math.random() < 0.2) {
    http.get(`${BASE}/products?q=ethiopia&pageSize=20`, { tags: { name: "search" } });
  }
  sleep(Math.random() * 2);
}
```
Run: `k6 run perf/k6/shop-browse.ts -e BASE_URL=https://staging.shop.example`. Thresholds that fail make k6 exit non-zero, which fails CI.

While it runs: `dotnet-counters monitor -n Shop.Api --counters System.Runtime,Microsoft.AspNetCore.Hosting,System.Net.Http`, and watch the thread-pool queue length, GC pause time, and requests per second.

`.github/workflows/perf.yml` (performance budget in CI, short version)
```yaml
jobs:
  smoke-perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - run: docker compose --profile perf up -d --wait
      - uses: grafana/setup-k6-action@v1
      - uses: grafana/run-k6-action@v1
        with:
          path: perf/k6/smoke.ts          # 1–2 minutes, same thresholds, small rate
```
Run the long average-load and stress tests nightly or before big releases, not on every PR.

## Production patterns
- Baseline first: record p95/p99, throughput, and saturation for each critical endpoint, then change one thing at a time.
- Open-model k6 tests with realistic data and endpoint mix; thresholds match the SLOs from 08-reliability.
- Smoke performance tests on every PR (fast, small), full load tests nightly against staging, and results kept so you can compare runs.
- During every test, watch server-side saturation, not just k6's client-side numbers.

## Mistakes
Wrong: reporting "average 120 ms" from a 10-VU closed test against a laptop.
Right: open-model arrival rate, p95/p99 thresholds, production-like environment and data.

Wrong: load testing with one product ID (everything is cached, so the result is meaningless).
Right: a `SharedArray` of thousands of realistic IDs and queries.

## Check yourself
1. Why do closed-model load tests hide overload?
2. What does saturation tell you that latency doesn't?
3. Which load tests belong in CI on every PR, and which nightly?

<details><summary>Answers</summary>

1. Each virtual user waits for its response before sending the next request. When the server slows down, the request rate drops with it, so the test never pushes the load that real users (who keep arriving) would.
2. How close a resource is to its limit (CPU, thread pool, connection pool). Saturation rises before latency explodes, so it warns you early and points to the bottleneck.
3. Short smoke-level performance tests with thresholds on every PR. Long average-load, stress, and soak tests nightly or before releases, against staging.
</details>

## Sources
- [k6 — Load test types](https://grafana.com/docs/k6/latest/testing-guides/test-types/)
- [k6 — Open and closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/)
- [k6 — Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)
- [dotnet-counters](https://learn.microsoft.com/dotnet/core/diagnostics/dotnet-counters)
- [ASP.NET Core load and stress testing](https://learn.microsoft.com/aspnet/core/test/load-tests)
