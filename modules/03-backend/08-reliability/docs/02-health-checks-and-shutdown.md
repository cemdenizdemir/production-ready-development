---
title: Health checks and graceful shutdown
tech: Node.js 26, Express 5, AWS ECS
version: Node.js 26 LTS, Express 5.2, AWS ECS Fargate + Application Load Balancer, Terraform 1.14
date: 2026-11-07
covers: [4, 5]
---
# Health checks and graceful shutdown
[← Overview](00-overview.md)

## Why it matters
- The health check queries the database. During a 90-second RDS failover, every task fails it, ECS replaces all of them, and the API stays down long after the database is back.
- Every deploy produces a burst of 502s: tasks exit while the load balancer still sends them traffic, or Node closes keep-alive connections the ALB is about to reuse.
- The container runs `npm start`; SIGTERM never reaches Node, ECS sends SIGKILL after 30 seconds, and every in-flight request is cut off.

## Concepts

### Health check types
| Probe | Question | Checks | On failure |
|:--|:--|:--|:--|
| Liveness | is the process stuck? | it can answer at all; no dependency checks | restart the task |
| Readiness | should it get traffic? | started, not draining, local state fine | stop routing to it, don't restart |
| Startup | has it finished booting? | migrations, warm-up done | wait before liveness/readiness count |
| Dependency status | how are the dependencies? | DB, Redis, partners, with latency | dashboards and alerts only |

**Rule:** a health check should fail only for problems that restarting or rerouting **this instance** fixes. A database outage hits every instance at once; failing health checks for it just replaces healthy tasks. Report it through metrics and alerts instead.

### Health checks on ECS and ALB
| Mechanism | Acts as | Settings |
|:--|:--|:--|
| ALB target group health check | readiness | path `/health/ready`, interval 10 s, healthy 2, unhealthy 3, timeout 5 s |
| ECS container `healthCheck` | liveness | `/health/live`, interval 15 s, retries 3, `startPeriod` 30 s |
| ECS service `healthCheckGracePeriodSeconds` | startup | ignore ALB checks while booting (e.g. 60 s) |
| ALB fail-open | safety net | if all targets are unhealthy, the ALB routes to all of them |
| ECS deployment circuit breaker | bad deploys | stops and rolls back deployments whose tasks never get healthy |

ECS also replaces tasks that keep failing the **ALB** check, so a "deep" readiness check is as dangerous as a deep liveness check there.

### Graceful shutdown on ECS
```mermaid
sequenceDiagram
  participant ECS
  participant ALB
  participant App as Node process
  ECS->>ALB: deregister target (draining)
  Note over ALB,App: no new requests; in-flight ones finish (deregistration delay)
  ECS->>App: SIGTERM
  App->>App: readiness 503, server.close(), finish in-flight, close pools
  App-->>ECS: exit 0
  Note over ECS,App: still running after stopTimeout (30 s)? SIGKILL
```
| Setting | Default | Recommended |
|:--|:--|:--|
| ALB `deregistration_delay` | 300 s | 30–60 s (longer than your slowest request) |
| ECS `stopTimeout` | 30 s | longer than the app's shutdown deadline (max 120 s) |
| App shutdown deadline | none | ~25 s with a 30 s `stopTimeout` |
| `initProcessEnabled` | false | true: an init process forwards signals and reaps zombies |
| Dockerfile `CMD` | — | exec form `["node", "src/server.ts"]`, never `npm start` |
| `minimumHealthyPercent` / `maximumPercent` | 100 / 200 | rolling deploys without losing capacity |

The Node side (stop accepting, finish in-flight requests, close pools, deadline) is in [01-language-runtime lesson 02](../../01-language-runtime/docs/02-async-errors-lifecycle.md). Workers close with `worker.close()` ([07-background-jobs lesson 03](../../07-background-jobs/docs/03-scheduling-flows-shutdown.md)); they aren't behind the ALB, so only the container health check applies.

## Example
`src/http/health.ts`
```ts
import { Router } from 'express';
import { pool } from '#src/db.ts';
import { redis } from '#src/redis.ts';

export const health = Router();

// Liveness: can this process answer at all? No dependency checks.
health.get('/health/live', (_req, res) => {
  res.json({ status: 'ok' });
});

// Readiness: should the load balancer send this instance traffic?
health.get('/health/ready', (req, res) => {
  const shuttingDown = req.app.locals.isShuttingDown?.() ?? false; // set in src/server.ts
  if (shuttingDown) return res.status(503).json({ status: 'draining' });
  res.json({ status: 'ready' });
});

// Dependency status: for dashboards and alerts, never for killing tasks.
// Keep it off the public listener (no ALB rule for it) or behind an internal token.
health.get('/health/deps', async (_req, res) => {
  const check = async (name: string, fn: () => Promise<unknown>) => {
    const started = performance.now();
    try {
      await fn();
      return { name, ok: true, ms: Math.round(performance.now() - started) };
    } catch (err) {
      return { name, ok: false, error: (err as Error).message };
    }
  };
  const results = await Promise.all([
    check('postgres', () => pool.query('SELECT 1')),   // bounded by connectionTimeoutMillis + statement_timeout
    check('redis', () => redis.ping()),
  ]);
  res.status(results.every((r) => r.ok) ? 200 : 503).json({ results });
});
```
`src/app.ts` — health routes first, so auth, rate limiting, and load shedding never block them.
```ts
app.use(health);
app.use(loadShedding({ /* lesson 03 */ }));
app.use(sessionMiddleware);
app.use('/api', apiRouter);
```
`infra/alb.tf` — target group settings (Terraform, more in [04-shipping/03-iac](../../../04-shipping/03-iac/README.md)).
```hcl
resource "aws_lb_target_group" "api" {
  name                 = "api"
  port                 = 3000
  protocol             = "HTTP"
  target_type          = "ip"   # Fargate
  vpc_id               = var.vpc_id
  deregistration_delay = 30     # default 300 s makes every deploy slow

  health_check {
    path                = "/health/ready"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }
}
```
Task definition excerpt (JSON) — liveness without curl in the image, signals forwarded by an init process.
```json
{
  "name": "api",
  "image": "123456789012.dkr.ecr.eu-central-1.amazonaws.com/api:2026-11-07-a1b2c3d",
  "portMappings": [{ "containerPort": 3000 }],
  "stopTimeout": 30,
  "linuxParameters": { "initProcessEnabled": true },
  "healthCheck": {
    "command": ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/health/live').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))\""],
    "interval": 15,
    "timeout": 5,
    "retries": 3,
    "startPeriod": 30
  }
}
```

## Production patterns
- **Liveness is shallow, readiness is local, dependency status is for humans.**
- **Health routes are mounted first**, unauthenticated, cheap, and excluded from load shedding and request logs.
- **Short deregistration delay, a shutdown deadline inside `stopTimeout`**, and exec-form `CMD` or an init process.
- **Deployment circuit breaker with rollback** turned on for ECS services.
- **Test shutdown**: send SIGTERM under load locally (`docker stop`) and confirm zero failed requests.

## Mistakes
Wrong: liveness that checks dependencies.
```ts
health.get('/health/live', async (_req, res) => { await pool.query('SELECT 1'); res.send('ok'); }); // DB blip = every task restarted
```
Right: liveness answers without touching dependencies; dependency status goes to `/health/deps` and alerts.

Wrong: exiting right away on SIGTERM.
```ts
process.on('SIGTERM', () => process.exit(0)); // in-flight requests cut off
```
Right: drain (readiness 503, `server.close()`, wait for in-flight work), close pools, then exit.

Wrong: `CMD npm start` or shell-form `CMD node src/server.ts`. The signal goes to npm or `sh`, not Node. Right: `CMD ["node", "src/server.ts"]` or `initProcessEnabled`.

Wrong: an app shutdown deadline of 60 s with the default 30 s `stopTimeout`. ECS kills the process mid-cleanup. Right: deadline below `stopTimeout`, or raise `stopTimeout`.

## Check yourself
1. Why shouldn't liveness (or the ALB check on ECS) depend on the database?
2. In ECS behind an ALB, what happens between "task stopping" and SIGTERM?
3. Why does the Dockerfile `CMD` form matter for shutdown?

<details>
<summary>Answers</summary>

1. A database outage affects every instance. Failing health checks makes ECS replace all tasks, which can't fix the database, adds cold starts, and can leave the API down after the database recovers. Health checks should fail only for instance-local problems.
2. ECS deregisters the target; the ALB stops sending new requests and lets in-flight ones finish during the deregistration delay. Then ECS sends SIGTERM and waits up to `stopTimeout` before SIGKILL.
3. With shell form or `npm start`, PID 1 is `sh` or npm, which may not forward SIGTERM to Node. Node never starts its graceful shutdown, and ECS kills it after `stopTimeout`. Exec form makes Node receive the signal; an init process also forwards it.
</details>

## Sources
- [AWS Builders' Library — Implementing health checks](https://aws.amazon.com/builders-library/implementing-health-checks/)
- [Amazon ECS — Task lifecycle](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-lifecycle-explanation.html)
- [Elastic Load Balancing — Target group health checks](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html)
- [Amazon ECS — Deployment circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html)
- [Docker Node.js best practices — handling kernel signals](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals)
