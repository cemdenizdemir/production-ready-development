---
title: Server-side sessions in Redis
tech: Express 5, Redis 8, node-redis
version: Express 5.2, Redis 8, node-redis 5
date: 2026-11-07
covers: [3, 4, 13]
---
# Server-side sessions in Redis
[← Overview](00-overview.md)

## Why it matters
- The session ID isn't rotated at login. An attacker plants a known session ID in a victim's browser (session fixation), waits for them to log in, and uses the same ID.
- After a password reset, old sessions stay valid; the attacker who knew the old password stays logged in.
- Support can't answer "was my account accessed from another country?" because login events were never recorded.

## Concepts

### Session design
| Decision | Choice |
|:--|:--|
| ID | 32 random bytes, base64url (`crypto.randomBytes(32)`) |
| Storage key | `session:<sha256(id)>`: a Redis leak doesn't reveal usable IDs |
| Value | `{ userId, createdAt, lastSeenAt, ip, userAgent, mfa }` |
| Cookie | `__Host-sid=<id>; HttpOnly; Secure; SameSite=Lax; Path=/` |
| Idle timeout | sliding TTL (e.g. 7 days), refreshed at most every few minutes |
| Absolute timeout | e.g. 30 days since login, regardless of activity |
| Index per user | `user:<id>:sessions` set of session hashes for listing and revoking |

### Session lifecycle rules
| Event | Action |
|:--|:--|
| Login | create a **new** session ID (prevents fixation); delete any pre-login session |
| Privilege change (MFA completed, role elevated) | rotate the session ID |
| Logout | delete the session in Redis and clear the cookie |
| Password change or reset | delete **all** the user's sessions (except optionally the current one) |
| "Log out everywhere" | delete all sessions in the user index |
| Suspicious activity | revoke sessions, notify the user |

### Auth event auditing
Record security events in a durable store (Postgres table or log pipeline), not only debug logs:

| Event | Fields |
|:--|:--|
| `login.success` / `login.failure` (reason) | userId (if known), email hash, IP, user agent, time |
| `session.revoked`, `logout.everywhere` | actor, target sessions |
| `password.changed`, `password.reset.requested/completed` | userId, IP |
| `mfa.enrolled`, `mfa.disabled`, `mfa.failed` | userId, method |
| `role.changed` | actor, target, old/new role |

Alert on patterns (spikes in failures, logins from new countries for admins) and show users their recent sessions and security events.

## Example
`src/auth/sessions.ts`
```ts
import { createHash, randomBytes } from 'node:crypto';
import type { RedisClientType } from 'redis';

const IDLE_TTL_S = 7 * 24 * 3600;
const ABSOLUTE_MS = 30 * 24 * 3600 * 1000;
const TOUCH_EVERY_MS = 5 * 60 * 1000;

type Session = { userId: string; createdAt: number; lastSeenAt: number; ip: string; userAgent: string };
const keyOf = (id: string) => `session:${createHash('sha256').update(id).digest('hex')}`;
const userIndex = (userId: string) => `user:${userId}:sessions`;

export function createSessionStore(redis: RedisClientType) {
  return {
    async create(userId: string, ip: string, userAgent: string) {
      const id = randomBytes(32).toString('base64url');
      const now = Date.now();
      const key = keyOf(id);
      await redis.multi()
        .set(key, JSON.stringify({ userId, createdAt: now, lastSeenAt: now, ip, userAgent } satisfies Session), { EX: IDLE_TTL_S })
        .sAdd(userIndex(userId), key)
        .exec();
      return id;                                     // goes into the cookie; only its hash is stored
    },

    async get(id: string): Promise<(Session & { key: string }) | null> {
      const key = keyOf(id);
      const raw = await redis.get(key);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      const now = Date.now();
      if (now - s.createdAt > ABSOLUTE_MS) { await this.destroyKey(s.userId, key); return null; }
      if (now - s.lastSeenAt > TOUCH_EVERY_MS) {     // sliding expiry without a write per request
        await redis.set(key, JSON.stringify({ ...s, lastSeenAt: now }), { EX: IDLE_TTL_S });
      }
      return { ...s, key };
    },

    async destroyKey(userId: string, key: string) {
      await redis.multi().del(key).sRem(userIndex(userId), key).exec();
    },

    async destroyAllForUser(userId: string) {
      const keys = await redis.sMembers(userIndex(userId));
      if (keys.length) await redis.del(keys);
      await redis.del(userIndex(userId));
    },
  };
}
```
`src/auth/routes.ts` (login, logout, logout everywhere)
```ts
const cookie = { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 3600 * 1000 } as const;

router.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = LoginBody.parse(req.body);
  const user = await users.findByEmail(email);
  const { ok, needsRehash } = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);
  if (!user || !ok) {
    await audit('login.failure', { email, ip: req.ip, reason: user ? 'bad_password' : 'unknown_user' });
    return res.status(401).json({ title: 'Invalid email or password' });
  }
  if (needsRehash) await users.updatePasswordHash(user.id, await hashPassword(password));

  const oldId = req.cookies?.['__Host-sid'];
  if (oldId) { const old = await sessions.get(oldId); if (old) await sessions.destroyKey(old.userId, old.key); } // no fixation
  const id = await sessions.create(user.id, req.ip ?? '', req.get('user-agent') ?? '');
  await audit('login.success', { userId: user.id, ip: req.ip });
  res.cookie('__Host-sid', id, cookie).status(204).end();
});

router.post('/auth/logout', requireUser, async (req, res) => {
  await sessions.destroyKey(req.user!.id, req.session!.key);
  res.clearCookie('__Host-sid', { ...cookie, maxAge: undefined }).status(204).end();
});

router.post('/auth/logout-everywhere', requireUser, async (req, res) => {
  await sessions.destroyAllForUser(req.user!.id);
  await audit('logout.everywhere', { userId: req.user!.id, ip: req.ip });
  res.clearCookie('__Host-sid', { ...cookie, maxAge: undefined }).status(204).end();
});
```
`req.cookies` needs a cookie parser (also seen: `cookie-parser`), or parse `req.headers.cookie` yourself. The `authenticate` middleware reads the cookie, calls `sessions.get`, and attaches `req.user`/`req.session`.

## Production patterns
- **Opaque, random IDs; store only their hash**; HttpOnly `__Host-` cookies.
- **Rotate on login and privilege changes**; revoke all sessions on password reset and on user request.
- **Idle + absolute timeouts**, with throttled "touch" writes.
- **A per-user session index** for "where you're logged in" pages and revocation.
- **Durable auth audit events** with alerts on anomalies; Redis persistence and replication so a restart doesn't log everyone out ([06-caching](../../06-caching/docs/03-redis-structures-and-operations.md)).

## Mistakes
Wrong: reusing the pre-login session ID.
```ts
req.session.userId = user.id; // same ID as before login: session fixation
```
Right: destroy the old session and issue a new ID.

Wrong: storing raw session IDs as Redis keys. A leaked RDB file or `KEYS *` output gives usable sessions.
Right: `session:<sha256(id)>`.

Wrong: password reset that leaves other sessions alive. Right: `destroyAllForUser` as part of the reset.

Wrong: sliding expiry with a Redis write on every request. Right: refresh `lastSeenAt` at most every few minutes.

## Check yourself
1. What is session fixation, and how does rotating the ID on login prevent it?
2. Why store a hash of the session ID instead of the ID?
3. Which events should revoke all of a user's sessions?

<details>
<summary>Answers</summary>

1. An attacker gets a victim to use a session ID the attacker knows, then waits for the victim to log in with it. Issuing a fresh ID at login means the attacker's known ID never becomes authenticated.
2. Anyone who reads the Redis data (backup, snapshot, debug output) gets only hashes, which can't be used as cookies.
3. Password change or reset, "log out everywhere", account compromise or suspicious activity, MFA reset, and account deletion or suspension.
</details>

## Sources
- [OWASP — Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Redis — Session management](https://redis.io/solutions/session-management/)
- [node-redis](https://github.com/redis/node-redis)
- [OWASP — Logging Cheat Sheet (security events)](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [MDN — Set-Cookie prefixes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#cookie_prefixes)
