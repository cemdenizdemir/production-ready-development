---
title: Concepts, passwords, and tokens
tech: Express 5, argon2, Node.js 26
version: argon2 (node-argon2), NIST SP 800-63B rev. 4
date: 2026-11-07
covers: [1, 2, 9]
---
# Concepts, passwords, and tokens
[← Overview](00-overview.md)

## Why it matters
- A breach leaks a users table with unsalted SHA-256 hashes. Within a day, most passwords are cracked and tried on users' email and bank accounts.
- A "remember me" JWT valid for 30 days can't be revoked when a laptop is stolen; the only fix is rotating the signing key and logging everyone out.
- Password rules ("one uppercase, one symbol, change every 90 days") push users to `Summer2026!`, which is in every cracking list.

## Concepts

### Vocabulary
| Term | Meaning |
|:--|:--|
| Identity | who someone is (a user record) |
| Credential | proof: password, passkey, OTP, OAuth assertion |
| Authentication (authn) | verifying the credential; answers "who are you?" |
| Session | proof of a past authentication, carried by each request |
| Authorization (authz) | deciding what this identity may do; answers "may you?" |
| Factor | something you know (password), have (device/passkey), are (biometric) |

### Password storage
| Rule | Why |
|:--|:--|
| **argon2id** with OWASP parameters (≥ 19 MiB, t=2, p=1) | memory-hard: expensive to crack on GPUs |
| unique salt per hash (built into argon2 output) | identical passwords get different hashes |
| never fast hashes (MD5, SHA-*) or encryption | fast = crackable; encryption = reversible |
| `needsRehash` on login | upgrade parameters gradually |
| optional pepper (secret key in a secret manager) | a DB leak alone isn't enough |
| bcrypt acceptable for existing systems | 72-byte input limit, CPU-hard only |

argon2 hashing is deliberately slow (tens of ms). node-argon2 runs it off the main thread, but it uses libuv's thread pool: rate-limit login endpoints ([lesson 03](03-login-protection-recovery-mfa.md)).

### Password policy (NIST SP 800-63B rev. 4)
| Do | Don't |
|:--|:--|
| minimum 15 characters if password is the only factor (8 with MFA) | composition rules (uppercase/symbol requirements) |
| allow at least 64 characters, spaces, Unicode | forced periodic changes |
| check against breached-password lists | security questions |
| allow paste and password managers | truncating passwords silently |
| show strength feedback | password hints |

Breached-password checks: the Have I Been Pwned "range" API uses k-anonymity (you send only the first 5 hex characters of the SHA-1).

### Sessions vs JWTs
| | Server-side session (opaque ID) | JWT (self-contained token) |
|:--|:--|:--|
| Verification | look up the ID in Redis | check the signature locally |
| Revocation | delete the session: instant | hard before expiry (denylist or short lifetimes) |
| Size | ~44 chars | hundreds of bytes to KBs |
| State | server stores it | client carries claims (can go stale: role changes) |
| Best for | browser sessions for your own app | short-lived service-to-service tokens, OIDC ID tokens, signed one-time links |

This course uses **opaque sessions in Redis** for users. If you use JWTs: short lifetimes (5–15 min), refresh token rotation with reuse detection, verify `alg`, `iss`, `aud`, `exp`, and never accept `alg: none` (also seen: the `jose` library).

## Example
`src/auth/passwords.ts`
```ts
import argon2 from 'argon2';
import { createHash } from 'node:crypto';

const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const; // OWASP minimum

export const hashPassword = (password: string) => argon2.hash(password, OPTIONS);

export async function verifyPassword(hash: string, password: string) {
  const ok = await argon2.verify(hash, password);
  return { ok, needsRehash: ok && argon2.needsRehash(hash, OPTIONS) };
}

// A precomputed hash to verify against when the user doesn't exist (similar timing, no enumeration)
export const DUMMY_HASH = await argon2.hash('not-a-real-password', OPTIONS);

export async function isBreached(password: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
  const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
    headers: { 'Add-Padding': 'true' },
    signal: AbortSignal.timeout(2_000),
  });
  if (!res.ok) return false;                                   // fail open for availability; log it
  return (await res.text()).split('\n').some((line) => line.startsWith(sha1.slice(5)));
}
```
`src/auth/schemas.ts` — the NIST-style rule in the shared schema.
```ts
import { z } from 'zod';

export const PasswordSchema = z.string()
  .min(15, 'Use at least 15 characters (a passphrase works well)')
  .max(128);                                                    // no composition rules

export const SignupBody = z.object({
  email: z.email().max(254).transform((e) => e.toLowerCase()),
  password: PasswordSchema,
}).strict();
```
Signup route:
```ts
router.post('/auth/signup', signupLimiter, async (req, res) => {
  const { email, password } = SignupBody.parse(req.body);
  if (await isBreached(password)) {
    return res.status(422).json({ errors: [{ path: 'password', message: 'This password appeared in a data breach. Choose another.' }] });
  }
  const passwordHash = await hashPassword(password);
  await users.create({ email, passwordHash });                 // unique index on lower(email)
  // send verification email (lesson 03); don't reveal whether the email already existed
  res.status(202).json({ message: 'Check your inbox to verify your email.' });
});
```

## Production patterns
- **argon2id with OWASP parameters**, rehash on login when parameters change.
- **NIST rules**: long passphrases, breached-password checks, no composition or rotation rules.
- **Opaque server-side sessions** for browser users; JWTs only where their trade-offs fit.
- **Equalize timing for unknown users** (verify against a dummy hash) and return generic messages.
- **Never log passwords or hashes**; redact request bodies on auth routes ([10-observability](../../10-observability/README.md)).

## Mistakes
Wrong: fast hashes.
```ts
const hash = createHash('sha256').update(password).digest('hex'); // billions of guesses per second on GPUs
```
Right: `argon2.hash(password, { type: argon2.argon2id, … })`.

Wrong: early return for unknown users.
```ts
if (!user) return res.status(401).json({ error: 'No such user' }); // enumeration + timing difference
```
Right: verify against `DUMMY_HASH`, then return the same "Invalid email or password".

Wrong: long-lived JWTs in `localStorage` as sessions. Stealable by XSS and not revocable. Right: `HttpOnly` cookie with an opaque session ID.

Wrong: composition rules and forced rotation. Right: length + breach checks + MFA.

## Check yourself
1. Why is argon2id better than SHA-256 for passwords?
2. When is a JWT a better choice than a server-side session?
3. What does NIST SP 800-63B rev. 4 say about password complexity rules?

<details>
<summary>Answers</summary>

1. It's deliberately slow and memory-hard, so each guess costs significant memory and time, making GPU/ASIC cracking far more expensive; SHA-256 is designed to be fast.
2. For short-lived tokens verified by services that shouldn't call a session store (service-to-service calls, OIDC ID tokens, signed download links), where instant revocation matters less than local verification.
3. Don't impose composition rules (required character types) or periodic changes; require length (15+ as a single factor), allow long passphrases, and screen against breached-password lists.
</details>

## Sources
- [OWASP — Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [NIST SP 800-63B rev. 4 — Passwords](https://pages.nist.gov/800-63-4/sp800-63b.html#password)
- [node-argon2](https://github.com/ranisalt/node-argon2)
- [Have I Been Pwned — Pwned Passwords API](https://haveibeenpwned.com/API/v3#PwnedPasswords)
- [OWASP — JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
