---
title: Rate limits, SSRF, paths, and uploads
tech: Node.js 26, Express 5, express-rate-limit, Redis 8
version: Node.js 26 LTS, Express 5.2, express-rate-limit 8, rate-limit-redis 4
date: 2026-11-07
covers: [8, 9]
---
# Rate limits, SSRF, paths, and uploads
[← Overview](00-overview.md)

## Why it matters
- A login endpoint without limits gets 2 million credential-stuffing attempts overnight, using passwords leaked from other sites. Hundreds of accounts are taken over.
- A "fetch the image from this URL" feature is asked for `http://169.254.169.254/latest/meta-data/iam/security-credentials/` and returns the server's cloud credentials (the Capital One breach pattern).
- A download route serves `../../.env` because it joins user input into a file path.

## Concepts

### Rate limiting
| Decision | Options |
|:--|:--|
| Key | IP (with correct `trust proxy`), user ID, API key, email being tried |
| Algorithm | fixed window (simple), sliding window, token bucket (allows bursts) |
| Store | memory (single instance only) or Redis (shared by all instances) |
| Response | `429` + `Retry-After` + `RateLimit` headers |
| Scope | global baseline, plus tight limits on login, signup, password reset, OTP, expensive search |

Brute force needs limits on more than IP: attackers rotate IPs, so also limit per target account (failed attempts per email) and add exponential delays or CAPTCHAs after repeated failures. [03-backend/05-validation-abuse](../../../03-backend/05-validation-abuse/README.md) goes deeper.

### SSRF: server-side request forgery
Your server fetches a URL the user controls, so the attacker reaches what your server can reach: cloud metadata, internal admin APIs, databases.

| Defense | Why |
|:--|:--|
| Allowlist hosts when possible | the only robust control |
| Only `https:` (and maybe `http:`) schemes | no `file:`, `gopher:`, `ftp:` |
| Resolve DNS and block private/link-local/loopback ranges | stops `127.0.0.1`, `10.0.0.0/8`, `169.254.169.254`, `::1`, `fc00::/7` |
| Pin the resolved IP for the connection | defeats DNS rebinding between check and use |
| No redirects, or re-validate each hop | a public URL can redirect to an internal one |
| IMDSv2 with hop limit 1 on AWS | metadata needs a session token, unreachable from containers |
| Egress firewall for the fetcher | network-level backstop |

### Path traversal
User input in file paths can climb out of the intended folder with `../` or absolute paths. Resolve the final path and confirm it is still inside the base directory, or better, never use user input as a path: map IDs to stored keys.

### File uploads
| Risk | Control |
|:--|:--|
| Huge files (DoS) | size limit at the proxy and in the app |
| Wrong type (HTML/SVG with script) | check magic bytes, not extension or `Content-Type` |
| Overwrites and traversal | random server-side names, never the client's filename |
| Running in your origin | store in object storage (S3), serve from a separate domain, `Content-Disposition: attachment` |
| Malware | scan when users share files with others |
| Image parser bugs | re-encode images server-side |

## Example
`src/limits.ts` — Redis-backed limits shared by all instances (Redis 8, node-redis 5).
```ts
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const store = (prefix: string) =>
  new RedisStore({ prefix, sendCommand: (...args: string[]) => redis.sendCommand(args) });

const app = express();
app.set('trust proxy', 1); // correct client IPs behind one load balancer (02-http-networking lesson 04)

app.use(rateLimit({
  windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, store: store('rl:global:'),
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,                         // per IP (IPv6 grouped by /56 by default)
  skipSuccessfulRequests: true,      // count only failures
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: store('rl:login:'),
});

app.post('/auth/login', express.json(), loginLimiter, async (_req, res) => {
  // ...also count failures per email and slow down after 5 (03-backend/04-auth)...
  res.status(204).end();
});
```
`src/safe-fetch.ts` — SSRF-resistant fetch for user-supplied URLs.
```ts
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [net, bits] of [['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['0.0.0.0', 8], ['100.64.0.0', 10]] as const) blocked.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [['::1', 128], ['fc00::', 7], ['fe80::', 10]] as const) blocked.addSubnet(net, bits, 'ipv6');

export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('Only https URLs are allowed');
  const addresses = isIP(url.hostname) ? [{ address: url.hostname, family: isIP(url.hostname) }]
    : await lookup(url.hostname, { all: true });
  for (const { address, family } of addresses) {
    if (blocked.check(address, family === 6 ? 'ipv6' : 'ipv4')) throw new Error('Address not allowed');
  }
  return url;
}

export async function fetchUserImage(raw: string) {
  const url = await assertPublicUrl(raw);
  // redirect: 'manual' stops a public URL from bouncing to an internal one
  return fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5_000) });
}
```
The check-then-fetch gap still allows DNS rebinding; pin the resolved address (a custom Undici `Agent` with a `connect.lookup`) or route fetches through an egress proxy for full protection.

`src/files.ts` — path traversal guard.
```ts
import { resolve, sep } from 'node:path';

const BASE = resolve('storage/reports');

export function safeReportPath(name: string): string {
  const full = resolve(BASE, name);
  if (!full.startsWith(BASE + sep)) throw new Error('Invalid path'); // blocks ../ and absolute paths
  return full;
}
```

## Production patterns
- **Global limit + tight per-route limits** on auth and expensive endpoints, in Redis so all instances share counts.
- **Correct client IPs first** (`trust proxy`); otherwise limits hit the load balancer or are trivially bypassed.
- **Never fetch arbitrary URLs from servers** unless the feature truly needs it; then use an allowlist or a hardened fetch service with egress rules.
- **IMDSv2 required, hop limit 1** on every EC2 instance; containers on ECS use task roles, not instance metadata.
- **Uploads go straight to S3 via presigned URLs** ([03-backend/12-integrations](../../../03-backend/12-integrations/README.md)); your server never parses big files.
- **Body size limits everywhere** (`express.json({ limit })`, proxy limits) as basic DoS protection.

## Mistakes
Wrong: in-memory limits on several instances.
```ts
app.use(rateLimit({ windowMs: 60_000, limit: 100 })); // each of 4 instances allows 100 → 400
```
Right: a shared Redis store.

Wrong: IP-only protection for login. Botnets rotate thousands of IPs.
Right: per-IP and per-account failure counts, delays, and breach-password checks.

Wrong: fetching user URLs directly.
```ts
const res = await fetch(req.body.imageUrl); // reaches 169.254.169.254, localhost, internal services
```
Right: `assertPublicUrl` checks, no redirects, timeouts, ideally an allowlist.

Wrong: joining paths.
```ts
res.sendFile(path.join(__dirname, 'reports', req.query.file)); // ?file=../../.env
```
Right: resolve and verify the base, or look up files by ID.

## Check yourself
1. Why is `skipSuccessfulRequests: true` useful on a login limiter?
2. Why isn't checking the hostname string (`!== 'localhost'`) enough to stop SSRF?
3. How does IMDSv2 reduce SSRF impact on AWS?

<details>
<summary>Answers</summary>

1. Legitimate users who log in successfully don't use up the budget; only failures count, which is what brute force produces.
2. Many names and formats reach internal addresses: DNS names that resolve to private IPs, decimal or IPv6 forms of `127.0.0.1`, redirects, and DNS rebinding. You must check resolved IP addresses (and pin them).
3. Metadata requires a session token obtained with a PUT request carrying a special header, which simple SSRF (GET-only) can't do; a hop limit of 1 also stops containers behind the host from reaching it.
</details>

## Sources
- [express-rate-limit](https://express-rate-limit.mintlify.app/)
- [rate-limit-redis](https://github.com/express-rate-limit/rate-limit-redis)
- [OWASP — SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP — File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [AWS — Use IMDSv2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html)
- [Node.js — `net.BlockList`](https://nodejs.org/api/net.html#class-netblocklist)
