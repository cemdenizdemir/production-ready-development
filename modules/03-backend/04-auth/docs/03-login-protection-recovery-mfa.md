---
title: Login protection, recovery, and MFA
tech: Express 5, Redis 8, argon2, express-rate-limit
version: Express 5.2, Redis 8, express-rate-limit 8, WebAuthn Level 3
date: 2026-11-07
covers: [5, 6, 7]
---
# Login protection, recovery, and MFA
[← Overview](00-overview.md)

## Why it matters
- A botnet tries leaked email/password pairs from other sites against your login, 2 attempts per account from 50,000 IPs. Per-IP limits never trigger; 400 accounts are taken over.
- Password reset tokens are sequential IDs stored in plain text; an attacker resets anyone's password.
- SMS codes protect admin accounts; a SIM swap gives an attacker the codes.

## Concepts

### Defending the login endpoint
| Layer | Control |
|:--|:--|
| Per IP | rate limit (e.g. 10 failures / 15 min) with a Redis store |
| Per account | failed-attempt counter with progressive delays; temporary lock **only** with care (lockouts let attackers lock out victims) |
| Global | detect credential stuffing: failure-rate spikes, many accounts per IP, known-bad IPs |
| Friction | CAPTCHA or proof-of-work after repeated failures |
| Messages | always "Invalid email or password"; same timing for unknown users |
| Breached passwords | block at signup and reset; prompt at login |
| Notifications | email on login from a new device or country |
| MFA | the strongest defense against stuffing |

### Password reset and email verification
| Step | Practice |
|:--|:--|
| Request | always respond the same ("If an account exists, we sent an email") |
| Token | 32 random bytes; store only `sha256(token)`; expires in 15–60 min; single use |
| Link | `https://app.example.com/reset?token=…` (frontend), never the API in emails |
| Use | verify hash + expiry, set the new password (policy + breach check), delete the token |
| After | revoke all sessions, notify the user by email |
| Rate limits | per email and per IP on the request endpoint |
| Email verification | same token design; mark `emailVerifiedAt` |
| Email change | confirm at the **new** address, notify the **old** one |

### Multi-factor authentication
| Method | Strength | Notes |
|:--|:--|:--|
| Passkeys (WebAuthn) | strong, phishing-resistant | public-key credentials bound to your domain; can replace passwords |
| TOTP apps (RFC 6238) | good | shared secret (encrypt at rest), 30 s codes, allow ±1 step |
| Security keys (FIDO2) | strongest | same protocol as passkeys |
| Email codes | weak-moderate | depends on email account security |
| SMS codes | weak | SIM swap, interception; avoid for high-value accounts |
| Recovery codes | backup | 8–10 one-time codes, stored hashed, shown once |

Require MFA for admins; offer it to everyone; **step-up** (re-verify) before sensitive actions (changing email, payout details, disabling MFA).

## Example
Login limits with Redis (per IP and per account):
```ts
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 10, skipSuccessfulRequests: true,
  standardHeaders: 'draft-8', legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:login:ip:', sendCommand: (...a: string[]) => redis.sendCommand(a) }),
});

// per-account failures with progressive delay
export async function accountThrottle(email: string): Promise<number> {
  const key = `login:fail:${createHash('sha256').update(email).digest('hex')}`;
  const failures = Number(await redis.get(key) ?? 0);
  return failures < 5 ? 0 : Math.min(2 ** (failures - 5) * 1000, 60_000); // ms to wait before allowing another try
}
export async function recordFailure(email: string) {
  const key = `login:fail:${createHash('sha256').update(email).digest('hex')}`;
  await redis.multi().incr(key).expire(key, 3600).exec();
}
```
Password reset tokens:
```ts
import { createHash, randomBytes } from 'node:crypto';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

router.post('/auth/password-reset', resetRequestLimiter, async (req, res) => {
  const { email } = z.object({ email: z.email() }).parse(req.body);
  const user = await users.findByEmail(email.toLowerCase());
  if (user) {
    const token = randomBytes(32).toString('base64url');
    await db.query(
      `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '30 minutes')`,
      [sha256(token), user.id]);
    await emailQueue.add('password-reset', { to: user.email, url: `${APP_URL}/reset?token=${token}` });
  }
  res.status(202).json({ message: 'If an account exists for this email, we sent a reset link.' }); // same answer always
});

router.post('/auth/password-reset/confirm', async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(40).max(64), password: PasswordSchema }).parse(req.body);
  const { rows: [row] } = await db.query(
    `DELETE FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > now() RETURNING user_id`, // single use
    [sha256(token)]);
  if (!row) return res.status(400).json({ title: 'This reset link is invalid or has expired.' });
  if (await isBreached(password)) return res.status(422).json({ errors: [{ path: 'password', message: 'Choose a password that has not appeared in a breach.' }] });

  await users.updatePasswordHash(row.user_id, await hashPassword(password));
  await sessions.destroyAllForUser(row.user_id);       // kick out anyone using the old password
  await audit('password.reset.completed', { userId: row.user_id, ip: req.ip });
  await emailQueue.add('password-changed-notice', { userId: row.user_id });
  res.status(204).end();
});
```
TOTP verification sketch (library: also seen `otpauth`; Better Auth's two-factor plugin handles this in lesson 05):
```ts
import { createHmac } from 'node:crypto';

function totp(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', secret).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

export function verifyTotp(secret: Buffer, code: string, now = Date.now()) {
  const step = Math.floor(now / 30_000);
  return [step - 1, step, step + 1].some((s) => totp(secret, s) === code); // ±30 s clock drift
}
// also store the last used step per user to block replay of the same code
```

## Production patterns
- **Layered login defenses**: per-IP and per-account limits, stuffing detection, MFA, breached-password checks.
- **Throttle rather than hard-lock accounts**; lockouts become a denial-of-service tool.
- **Reset tokens: random, hashed, short-lived, single-use**, and resets revoke all sessions.
- **Passkeys and TOTP over SMS**; MFA mandatory for admins; step-up for sensitive actions.
- **Every security email is a notification**: password changed, new login, MFA disabled, email changed.

## Mistakes
Wrong: revealing account existence.
```ts
if (!user) return res.status(404).json({ error: 'No account with this email' });
```
Right: the same 202 message for every request.

Wrong: plain-text, long-lived reset tokens.
```sql
INSERT INTO resets (token, user_id) VALUES ('ab12cd…', 7); -- readable by anyone with DB access, never expires
```
Right: store `sha256(token)`, expire within an hour, delete on use.

Wrong: hard lockout after 5 failures. Attackers lock every account they know the email of. Right: progressive delays, CAPTCHAs, and alerts.

Wrong: disabling MFA with only a session. A stolen session removes the protection. Right: step-up verification (current MFA or password) first.

## Check yourself
1. Why doesn't per-IP rate limiting stop credential stuffing?
2. What four properties should a password reset token have?
3. Why are passkeys phishing-resistant while TOTP codes aren't?

<details>
<summary>Answers</summary>

1. Stuffing spreads attempts across many IPs (botnets, proxies) and few attempts per account; you need per-account limits, global anomaly detection, breached-password checks, and MFA.
2. Unguessable (random, enough entropy), stored only as a hash, short-lived, and single-use (plus invalidating sessions after use).
3. A passkey signature is bound to your domain by the browser; a fake site gets a credential for its own domain, which is useless. A TOTP code typed into a phishing site can be relayed to the real site in real time.
</details>

## Sources
- [OWASP — Credential Stuffing Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html)
- [OWASP — Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP — Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [passkeys.dev](https://passkeys.dev/)
- [RFC 6238 — TOTP](https://www.rfc-editor.org/rfc/rfc6238)
