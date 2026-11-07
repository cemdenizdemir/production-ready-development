---
title: Authentication & Authorization cheatsheet
tech: Express 5, Redis 8, argon2, Better Auth
version: Express 5.2, Redis 8, argon2 (node-argon2), Better Auth 1.6/1.7, NIST SP 800-63B rev. 4
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Authentication & Authorization cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Concepts
| Term | Meaning |
|:--|:--|
| ⭐ Authentication | who are you? |
| ⭐ Authorization | may you do this, to this? |
| Identity / credential | the user / the proof |
| ⭐ Session | proof of earlier authentication |
| Factor | know / have / are |
| MFA | two or more factors |
| Step-up auth | re-verify before sensitive actions |
| Account takeover (ATO) | attacker controls a real account |

## Password storage
| Item | Value / practice | Note |
|:--|:--|:--|
| ⭐ Algorithm | argon2id | bcrypt for legacy |
| ⭐ OWASP minimum | m=19 MiB (19456 KiB), t=2, p=1 | or m=46 MiB, t=1 |
| Salt | per hash, built in | |
| `argon2.hash` / `verify` / `needsRehash` | node-argon2 API | async |
| Pepper | secret key outside the DB | optional |
| Never | MD5, SHA-*, encryption, plain text | |
| Thread pool | argon2 uses libuv threads | rate-limit logins |

## Password policy (NIST 800-63B rev. 4)
| Rule | Value |
|:--|:--|
| ⭐ Min length (single factor) | 15 |
| Min length (with MFA) | 8 |
| Max length allowed | ≥ 64 |
| ⭐ Composition rules | none |
| ⭐ Periodic rotation | none (change on compromise) |
| ⭐ Breached-password check | required |
| Paste / password managers | allow |
| Hints / security questions | none |
| HIBP range API | `api.pwnedpasswords.com/range/<5 hex>` |

## Sessions
| Item | Practice |
|:--|:--|
| ⭐ ID | 32 random bytes, base64url |
| ⭐ Store | `session:<sha256(id)>` in Redis |
| ⭐ Cookie | `__Host-sid; HttpOnly; Secure; SameSite=Lax; Path=/` |
| Idle timeout | sliding TTL (e.g. 7 d), throttled touches |
| Absolute timeout | e.g. 30 d |
| ⭐ Rotate on login / privilege change | prevents fixation |
| ⭐ Revoke all on password reset | |
| Per-user index | `user:<id>:sessions` set |
| Session list UI | device, location, last active, revoke |
| Logout | delete server-side + clear cookie (same attributes) |

## Sessions vs JWT
| | Session | JWT |
|:--|:--|:--|
| Revocation | instant | hard |
| Size | small | large |
| Server state | yes | no |
| ⭐ Use for | browser users | service-to-service, ID tokens, signed links |
| JWT musts | short exp, check `alg`/`iss`/`aud`/`exp`, no `none` | `jose` (also seen) |
| Refresh tokens | rotation + reuse detection | |

## Login protection
| Control | Practice |
|:--|:--|
| ⭐ Per-IP limit | Redis store, e.g. 10 failures / 15 min |
| ⭐ Per-account throttle | progressive delays |
| Hard lockout | avoid (DoS vector) |
| ⭐ Generic errors | "Invalid email or password" |
| ⭐ Equal timing | dummy hash for unknown users |
| CAPTCHA / proof-of-work | after repeated failures |
| Stuffing detection | failure spikes, many accounts per IP |
| New-device notifications | email the user |
| ⭐ MFA | best stuffing defense |

## Reset and verification tokens
| Property | Value |
|:--|:--|
| ⭐ Random | 32 bytes |
| ⭐ Stored as hash | `sha256(token)` |
| ⭐ Expiry | 15–60 min |
| ⭐ Single use | delete on use (`DELETE … RETURNING`) |
| Same response for all requests | no enumeration |
| After reset | revoke sessions, notify user |
| Email change | confirm new address, notify old |

## MFA methods
| Method | Strength | Note |
|:--|:--|:--|
| ⭐ Passkeys (WebAuthn) | strong, phishing-resistant | domain-bound keys |
| Security keys (FIDO2) | strongest | hardware |
| ⭐ TOTP (RFC 6238) | good | ±1 step window, block replay |
| Email code | moderate | |
| SMS | weak | SIM swap |
| ⭐ Recovery codes | backup | one-time, hashed, shown once |
| Admin MFA | mandatory | |

## Authorization
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ RBAC | roles → permissions | |
| ⭐ Ownership / tenancy | scoped queries | every object |
| ABAC / ReBAC | attributes / relationships | OpenFGA, Cerbos (also seen) |
| ⭐ Permission strings | `orders:refund` | |
| ⭐ `can(user, perm)` | single decision function | |
| ⭐ `requirePermission()` | route middleware | |
| ⭐ Deny by default | | |
| 404 vs 403 | hide other tenants' data / missing permission | |
| Permission matrix tests | role × route × status | |
| Audit privileged actions | actor, target, change | |

## Clients
| Client | Auth |
|:--|:--|
| ⭐ Next.js web (same site) | HttpOnly cookie; server forwards cookie |
| Mobile | bearer token in secure storage + refresh |
| ⭐ Integrations | account-owned API keys |
| Internal services | short-lived signed tokens, mTLS |
| Third-party apps for users | OAuth 2.x provider |

## API keys
| Practice | Why |
|:--|:--|
| ⭐ `prefix_live_<random>` | recognizable, scannable |
| ⭐ Store hash only | leak-safe |
| ⭐ Show once | |
| Scopes + owning account | least privilege |
| `lastUsedAt`, expiry | hygiene |
| Two active keys | zero-downtime rotation |
| Per-key rate limits | contain misuse |

## OAuth 2.0 / OIDC
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Authorization code + PKCE (S256) | sign-in flow | |
| ⭐ `state` | callback CSRF protection | |
| `nonce` | ID token replay protection | |
| ⭐ ID token checks | signature (JWKS), `iss`, `aud`, `exp`, `nonce` | |
| ⭐ Key users by `(provider, sub)` | stable identity | |
| ⭐ `email_verified` before linking | prevent takeover | |
| Scopes | `openid email profile` | minimal |
| Exact redirect URIs | no code leaks | |
| RFC 9700 | OAuth security BCP | |
| Implicit flow | avoid | deprecated |

## Better Auth
| API / option | What it does | Note |
|:--|:--|:--|
| ⭐ `betterAuth({...})` | server instance | |
| `database: drizzleAdapter(db, { provider: 'pg' })` | storage | or a `pg` Pool |
| `secondaryStorage` | Redis get/set/delete | sessions, rate limits |
| ⭐ `emailAndPassword` | password auth, reset | `minPasswordLength` |
| `password.hash` / `verify` | custom hashing (argon2) | default scrypt |
| `emailVerification.sendVerificationEmail` | your email sender | queue it |
| ⭐ `socialProviders` | GitHub, Google, … | |
| `session.expiresIn` / `updateAge` | lifetimes | |
| `rateLimit` | built-in limits | storage `secondary-storage` |
| `trustedOrigins` | CSRF/origin checks | |
| ⭐ `toNodeHandler(auth)` on `/api/auth/*splat` | Express mount | before `express.json()` |
| ⭐ `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })` | read session | `better-auth/node` |
| Plugins | `twoFactor`, passkey, `organization`, `admin`, API key, OAuth 2.1 provider | |
| `user.additionalFields` | custom user columns | role, accountId |
| `npx @better-auth/cli generate` / `migrate` | schema | Drizzle output |
| `createAuthClient()` | React client | `better-auth/react` |
| 1.5 change | OAuth 2.1 provider replaced OIDC provider plugin | |

## Audit events
| Event | Fields |
|:--|:--|
| ⭐ `login.success` / `login.failure` | user, IP, UA, reason |
| `logout` / `logout.everywhere` / `session.revoked` | actor, sessions |
| ⭐ `password.changed` / `password.reset.*` | user, IP |
| `mfa.enrolled` / `mfa.disabled` / `mfa.failed` | method |
| ⭐ `role.changed` | actor, target, old/new |
| `apikey.created` / `apikey.revoked` | account, scopes |
| Alerts | failure spikes, admin logins from new places |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Fast hashes | crackable | argon2id |
| User enumeration | targeted attacks | generic messages, same timing |
| Session ID reused at login | fixation | rotate |
| Raw session IDs in Redis | stealable from backups | store hashes |
| Sessions survive reset | attacker stays in | revoke all |
| Hard lockouts | attacker-driven DoS | throttling |
| Plain-text reset tokens | account takeover | hash + expiry + single use |
| SMS for admins | SIM swap | passkeys/TOTP |
| Role checks scattered | gaps | `can()` + middleware |
| Trusting client role/ID fields | privilege escalation | server-side identity |
| Email-based OAuth linking | takeover | `sub` + `email_verified` |
| Auth handler after body parser | broken endpoints | mount first |
| Long-lived JWTs in localStorage | theft, no revocation | HttpOnly sessions |

## Sources
| Source | Link |
|:--|:--|
| OWASP Authentication | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html |
| OWASP Password Storage | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html |
| OWASP Session Management | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html |
| OWASP Authorization | https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html |
| NIST SP 800-63B | https://pages.nist.gov/800-63-4/sp800-63b.html |
| RFC 9700 OAuth security | https://www.rfc-editor.org/rfc/rfc9700 |
| Better Auth docs | https://www.better-auth.com/docs |
| passkeys.dev | https://passkeys.dev/ |
