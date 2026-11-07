---
title: "Scaling Node.js: stateless tasks, profiling, worker threads, real-time"
tech: Node.js 26, Express 5, Redis 8, AWS ECS
version: Node.js 26 LTS, Express 5.2, node-redis 5, AWS ECS Fargate, Terraform 1.14
date: 2026-11-07
covers: [3, 6, 11]
---
# Scaling Node.js: stateless tasks, profiling, worker threads, real-time
[← Overview](00-overview.md)

## Why it matters
- Sessions and uploads live on the task's local disk. After scaling to three tasks, users are logged out at random and half the uploads return 404.
- One endpoint ranks search results with heavy synchronous code. At 20 requests/second the event loop delay reaches 2 seconds, and every endpoint on that task slows down. Doubling the task's vCPUs changes nothing.
- Live notifications only reach users connected to the same task that handled the event, so they "randomly" don't arrive.

## Concepts

### Stateless services
| State | Where it lives instead |
|:--|:--|
| Sessions | Redis ([04-auth](../../04-auth/README.md)) |
| Uploads and files | S3 ([12-integrations](../../12-integrations/README.md)) |
| Caches | Redis; in-process only for small, short-lived data |
| Scheduled work | BullMQ job schedulers, not per-instance timers |
| Locks, counters, rate limits | Redis or Postgres |
| Real-time fan-out | Redis pub/sub |
| Config | environment variables at startup |

The test: you can kill any task at any moment and no user notices. Then you can run N identical tasks behind the load balancer, without sticky sessions.

### Scaling on ECS Fargate
| Lever | Detail |
|:--|:--|
| Task size | 0.25–16 vCPU. JavaScript runs on one thread, so ~1 vCPU per Node process unless you use worker threads |
| Task count | at least 2 across AZs; autoscale with demand |
| Target tracking | `ECSServiceAverageCPUUtilization` around 60%, or `ALBRequestCountPerTarget` |
| Scale out vs in | out fast (60 s cooldown), in slowly (300 s+) |
| Scheduled scaling | known peaks: campaigns, business hours |
| Startup time | smaller images and less boot work = faster scale-out |
| Watch | DB connections grow with every task ([lesson 03](03-scaling-postgresql.md)) |

Extra vCPUs only help the libuv threadpool, garbage collection, and worker threads. Prefer more small tasks over a few big ones. The `cluster` module and PM2 come from the VM era; in containers, the orchestrator runs more processes for you.

### Node.js performance
| Problem | Tool or fix |
|:--|:--|
| CPU hot spots | `node --cpu-prof` → `.cpuprofile`, open in Chrome DevTools (flame chart); also seen: 0x, Clinic.js |
| Event loop blocking | `monitorEventLoopDelay()`; move CPU work to worker threads or a job |
| Threadpool saturation | `UV_THREADPOOL_SIZE` (default 4) is shared by `fs`, `dns.lookup`, `crypto.pbkdf2`/`scrypt`, `zlib`, many native addons |
| Memory leaks | heap snapshots (`--heapsnapshot-signal=SIGUSR2`, `v8.writeHeapSnapshot()`), compare snapshots over time |
| Heap size in containers | `--max-old-space-size` ≈ 75% of the task's memory |
| GC pressure | fewer allocations: stream data, avoid huge JSON objects |
| Sync APIs in handlers | `readFileSync`, `pbkdf2Sync`, `gzipSync` → async versions |
| Slow regexes (ReDoS) | bound input length, avoid nested quantifiers |
| Logging cost | Pino with async transport; sample debug logs |

### Real-time connections at scale
| Concern | Approach |
|:--|:--|
| Fan-out across tasks | Redis pub/sub: each task forwards messages to its own connections; Socket.IO: `@socket.io/redis-adapter` |
| Connection limits | memory and file descriptors per task; measure connections per task |
| Idle timeouts | heartbeats more often than the ALB idle timeout (60 s) |
| Deploys | close connections gradually; clients reconnect with jitter |
| Sticky sessions | only for Socket.IO's long-polling fallback |
| Scaling signal | open connections per task, not just CPU |
| SSE vs WebSockets | SSE for server → client updates over plain HTTP; WebSockets when the client sends a lot too ([02-http-networking lesson 06](../../../01-foundations/02-http-networking/docs/06-debugging-and-real-time.md)) |

## Example
Profiling under load:
```bash
# CPU profile: start, run the k6 test, stop with Ctrl+C, open profiles/*.cpuprofile in Chrome DevTools
node --cpu-prof --cpu-prof-dir=./profiles src/server.ts

# Heap snapshots on demand: kill -USR2 <pid> writes Heap-*.heapsnapshot; take two, 10 minutes apart, and compare
node --heapsnapshot-signal=SIGUSR2 src/server.ts

# In a 2 GB task: leave room for buffers, native memory, and the threadpool
node --max-old-space-size=1536 src/server.ts
```
`src/cpu/pool.ts` — a small fixed-size worker thread pool for CPU-heavy work that must answer in the request (also seen: Piscina).
```ts
import { Worker } from 'node:worker_threads';

type Task = { input: unknown; resolve: (value: unknown) => void; reject: (err: unknown) => void };

export function createWorkerPool(file: URL, size: number, maxQueued = 100) {
  const workers = new Set<Worker>();
  const idle: Worker[] = [];
  const queued: Task[] = [];

  function spawn() {
    const worker = new Worker(file);
    workers.add(worker);
    worker.once('exit', () => workers.delete(worker));
    dispatch(worker);
  }

  function dispatch(worker: Worker) {
    const task = queued.shift();
    if (!task) {
      idle.push(worker);
      return;
    }
    const onMessage = (result: unknown) => {
      worker.off('error', onError);
      task.resolve(result);
      dispatch(worker);                                 // next task, or back to idle
    };
    const onError = (err: Error) => {
      worker.off('message', onMessage);
      task.reject(err);
      spawn();                                          // a worker that threw has exited: replace it
    };
    worker.once('message', onMessage);
    worker.once('error', onError);
    worker.postMessage(task.input);
  }

  for (let i = 0; i < size; i++) spawn();

  return {
    run<T>(input: unknown): Promise<T> {
      if (queued.length >= maxQueued) return Promise.reject(new Error('worker pool queue is full'));
      return new Promise<T>((resolve, reject) => {
        queued.push({ input, resolve: resolve as (value: unknown) => void, reject });
        const worker = idle.pop();
        if (worker) dispatch(worker);
      });
    },
    close: () => Promise.all([...workers].map((w) => w.terminate())),
  };
}
```
`src/search/rank.worker.ts` and its use in a route:
```ts
import { parentPort } from 'node:worker_threads';
import { rankProducts, type Candidate } from './rank.ts';   // pure, CPU-heavy, synchronous

parentPort!.on('message', (input: { query: string; candidates: Candidate[] }) => {
  parentPort!.postMessage(rankProducts(input.query, input.candidates));
});
```
```ts
import { availableParallelism } from 'node:os';
import { createWorkerPool } from '#src/cpu/pool.ts';

// Worker threads need spare cores: give this service 2+ vCPU tasks
const rankPool = createWorkerPool(new URL('./rank.worker.ts', import.meta.url), Math.max(1, availableParallelism() - 1));

router.get('/search', async (req, res) => {
  const query = SearchQuery.parse(req.query).q;
  const candidates = await searchRepo.candidates(query);    // DB work stays on the main thread
  const ranked = await rankPool.run<RankedProduct[]>({ query, candidates });
  res.json(ranked.slice(0, 20));
});
```
If the result isn't needed in the response, use a BullMQ job instead ([07-background-jobs](../../07-background-jobs/README.md)).

`src/realtime/notifications.ts` — SSE plus Redis pub/sub, so an event reaches the user on whichever task holds the connection.
```ts
import type { Request, Response } from 'express';
import { redis } from '#src/redis.ts';

const subscriber = redis.duplicate();                      // subscriptions need their own connection
await subscriber.connect();

const connections = new Map<string, Set<Response>>();     // userId → open SSE responses on this task

await subscriber.pSubscribe('notify:user:*', (message, channel) => {
  const userId = channel.slice('notify:user:'.length);
  for (const res of connections.get(userId) ?? []) res.write(`data: ${message}\n\n`);
});

export function stream(req: Request, res: Response) {
  const userId = req.user!.id;
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  res.flushHeaders();

  const mine = connections.get(userId) ?? new Set<Response>();
  mine.add(res);
  connections.set(userId, mine);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000); // under the ALB idle timeout
  req.on('close', () => {
    clearInterval(heartbeat);
    mine.delete(res);
    if (mine.size === 0) connections.delete(userId);
  });
}

// From any task or worker: publish once, every task delivers to its own connections
export const notifyUser = (userId: string, event: object) =>
  redis.publish(`notify:user:${userId}`, JSON.stringify(event));
```
`infra/autoscaling.tf` — target tracking for the API service.
```hcl
resource "aws_appautoscaling_target" "api" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = 2
  max_capacity       = 20   # check the DB connection budget before raising this
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "api-cpu-60"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_out_cooldown = 60
    scale_in_cooldown  = 300
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
```

## Production patterns
- **Stateless tasks**: any task can die anytime; state lives in Redis, Postgres, or S3.
- **More small tasks**, autoscaled on CPU or requests per target, minimum two across AZs.
- **Profile before optimizing**: CPU profile under load, heap snapshots for growth, event loop delay as the key metric.
- **CPU-heavy work off the main thread**: worker threads when the response needs it, jobs otherwise.
- **Real-time through Redis pub/sub**, heartbeats under the ALB timeout, connection count as a scaling signal.

## Mistakes
Wrong: in-memory sessions or local files.
```ts
app.use(session({ secret })); // default MemoryStore: per task, lost on every deploy
```
Right: Redis-backed sessions, S3 for files.

Wrong: bigger tasks to fix event loop blocking. One JavaScript thread can't use the extra vCPUs. Right: profile, fix the hot code, or move it to worker threads.

Wrong: a new `Worker` per request. Startup costs milliseconds and megabytes each time. Right: a fixed pool with a bounded queue.

Wrong: autoscaling a WebSocket service on CPU only. Connections hit memory or file-descriptor limits while CPU looks idle. Right: also scale on connections per task.

## Check yourself
1. What makes a service stateless, and why does it matter for scaling?
2. Why doesn't a 4 vCPU task fix a blocked event loop?
3. How does an event reach a user connected to a different task?

<details>
<summary>Answers</summary>

1. No request depends on data kept in one task's memory or disk: sessions, files, caches that must be consistent, schedules, and locks live in shared stores. Then tasks are interchangeable, so you can add, remove, or replace them freely behind a load balancer.
2. JavaScript runs on a single thread per process. Extra vCPUs only help background threads (threadpool, GC). The fix is to remove the blocking code or run it in worker threads, which do use the extra cores.
3. The task that handles the event publishes it to a Redis channel. Every task is subscribed and forwards the message to the connections it holds for that user, so it doesn't matter which task the user is connected to.
</details>

## Sources
- [Node.js — Profiling Node.js applications](https://nodejs.org/en/learn/getting-started/profiling)
- [Node.js — Don't block the event loop](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)
- [Node.js — `worker_threads`](https://nodejs.org/api/worker_threads.html)
- [Amazon ECS — Service auto scaling](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html)
- [Socket.IO — Redis adapter](https://socket.io/docs/v4/redis-adapter/)
