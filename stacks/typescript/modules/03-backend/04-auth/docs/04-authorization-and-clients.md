---
title: Authorization and multiple clients
tech: Express 5, TypeScript 6, Redis 8
version: Express 5.2
date: 2026-11-07
covers: [8, 12]
---
# Authorization and multiple clients
[← Overview](00-overview.md)

## Why it matters
- Role checks are sprinkled through route handlers with slightly different logic; one export endpoint checks `role === 'admin'` while another forgets, and viewers download everything.
- A partner integration uses a staff member's personal login; when they leave, the integration breaks, and nobody knows what it had access to.
- The mobile app stores a session cookie in plain storage and can't refresh it; users are logged out daily.

## Concepts

### Authorization models
| Model | Decides by | Fits |
|:--|:--|:--|
| RBAC (role-based) | roles → permissions (`admin`, `member`, `viewer`) | most SaaS apps |
| Ownership / tenancy | does the resource belong to the caller's account/user? | every multi-tenant query |
| ABAC (attribute-based) | attributes of user, resource, context (plan, region, time) | complex rules |
| ReBAC (relationship-based) | relationships ("editor of folder X") | sharing, documents (also seen: OpenFGA, SpiceDB) |

Combine them: **RBAC for actions** plus **ownership/tenancy for objects**.

### Structure
| Piece | Role |
|:--|:--|
| Permissions | strings like `orders:read`, `orders:refund`, `members:invite` |
| Role → permissions map | in code (versioned, reviewed) |
| `can(user, permission)` | one function used everywhere |
| `requirePermission('…')` middleware | function-level checks on routes |
| Scoped queries | object-level checks: `WHERE account_id = $1` |
| Deny by default | missing permission = forbidden |
| Tests | a matrix: role × endpoint × expected status |

Return **404** when a resource exists in another tenant (don't confirm existence); return **403** when the user can see it but lacks the action.

### Several clients, one API
| Client | Auth |
|:--|:--|
| Next.js web app (same site) | `HttpOnly` session cookie set by Express; Server Components forward the cookie ([02-frontend/06-rendering](../../../02-frontend/06-rendering/docs/03-data-and-caching.md)) |
| Mobile app | session token in the platform's secure storage (Keychain/Keystore), sent as `Authorization: Bearer`; short idle timeout + refresh |
| Partner integrations, scripts | **API keys** tied to an account (not a person), scoped, rotatable |
| Your own services | service credentials or short-lived signed tokens (JWT), mTLS inside the network |
| Third-party apps acting for users | OAuth 2.0 authorization server (Better Auth's OAuth 2.1 provider plugin) |

### API keys done right
| Practice | Why |
|:--|:--|
| Format `prefix_live_<random>` | recognizable (secret scanners), environment visible |
| Store `sha256(key)` + prefix | DB leaks don't leak keys; look up by hash |
| Show once at creation | can't be read back |
| Scopes and an owning account | least privilege, survives employee changes |
| `lastUsedAt`, expiry, rotation | find unused keys, rotate without downtime (two active keys) |
| Rate limits per key | contain misuse |

## Example
`src/auth/permissions.ts`
```ts
export const PERMISSIONS = ['orders:read', 'orders:write', 'orders:refund', 'members:invite', 'billing:manage'] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type Role = 'owner' | 'admin' | 'member' | 'viewer';

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: ['orders:read', 'orders:write', 'orders:refund', 'members:invite'],
  member: ['orders:read', 'orders:write'],
  viewer: ['orders:read'],
};

export type AuthUser = { id: string; accountId: string; role: Role };

export const can = (user: AuthUser, permission: Permission) => ROLE_PERMISSIONS[user.role].includes(permission);
```
`src/auth/middleware.ts`
```ts
import type { RequestHandler } from 'express';
import { ForbiddenError } from '#src/http/errors.ts';
import { can, type Permission } from './permissions.ts';

export const requirePermission = (permission: Permission): RequestHandler => (req, _res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  if (!can(req.user, permission)) return next(new ForbiddenError(`Missing permission ${permission}`));
  next();
};
```
Routes: function-level + object-level checks.
```ts
router.post('/orders/:orderId/refunds', requirePermission('orders:refund'), async (req, res) => {
  const { orderId } = OrderIdParams.parse(req.params);
  const order = await orders.getForAccount(req.user!.accountId, orderId); // 404 if another tenant's
  const refund = await refunds.create(order, RefundBody.parse(req.body), req.user!.id);
  await audit('order.refunded', { actor: req.user!.id, orderId, amount: refund.amount });
  res.status(201).json(toRefundDTO(refund));
});
```
API key authentication:
```ts
import { createHash, randomBytes } from 'node:crypto';

export function generateApiKey() {
  const secret = randomBytes(24).toString('base64url');
  const key = `acme_live_${secret}`;
  return { key, hash: createHash('sha256').update(key).digest('hex'), prefix: key.slice(0, 14) }; // show `key` once
}

export const apiKeyAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer acme_')) return next();     // fall through to session auth
  const hash = createHash('sha256').update(header.slice(7)).digest('hex');
  const apiKey = await apiKeys.findActiveByHash(hash);        // includes accountId, scopes, expiresAt
  if (!apiKey) return next(new UnauthorizedError('Invalid API key'));
  req.user = { id: `apikey:${apiKey.id}`, accountId: apiKey.accountId, role: apiKey.role };
  void apiKeys.touchLastUsed(apiKey.id).catch(() => {});      // best effort
  next();
};
```
Permission matrix test (Vitest + Supertest):
```ts
const cases = [
  ['viewer', 'post', '/v1/orders/o1/refunds', 403],
  ['admin', 'post', '/v1/orders/o1/refunds', 201],
  ['member', 'get', '/v1/orders/other-tenant-order', 404],
] as const;

it.each(cases)('%s %s %s → %i', async (role, method, path, status) => {
  const agent = await loginAs(role);
  await agent[method](path).send(validRefund).expect(status);
});
```

## Production patterns
- **One permission model in code**, one `can()` function, middleware for actions, scoped queries for objects.
- **Deny by default**; new routes require an explicit permission.
- **Permission matrix tests** in CI for every protected endpoint.
- **API keys belong to accounts, not people**, are hashed, scoped, rotatable, and rate-limited.
- **Audit privileged actions** (refunds, role changes, exports) with the actor.

## Mistakes
Wrong: ad-hoc role checks.
```ts
if (req.user.role === 'admin' || req.user.role === 'owner') { /* … */ } // repeated, drifting
```
Right: `requirePermission('orders:refund')`.

Wrong: authorization based on data from the client.
```ts
if (req.body.isAdmin) { /* … */ }
```
Right: roles from the server-side session or key record.

Wrong: storing API keys in plain text. Right: store hashes; show the key once.

Wrong: personal accounts for integrations. Right: account-owned API keys or OAuth clients with scopes.

## Check yourself
1. Why combine RBAC with ownership checks instead of using roles alone?
2. When should an endpoint return 404 rather than 403?
3. What makes API keys safer than sharing a user's password with an integration?

<details>
<summary>Answers</summary>

1. Roles say *what* a user may do (refund orders), not *which* objects; without ownership/tenant checks an admin of account A could refund orders of account B.
2. When the resource belongs to another tenant or the user may not even know it exists; 404 avoids confirming existence. Use 403 when the user can see the resource but lacks the permission for this action.
3. Keys are scoped to specific permissions, belong to the account (not a person), can be rotated or revoked individually, are rate-limited and audited per key, and don't expose the user's password or full access.
</details>

## Sources
- [OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP API Security — Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
- [Google — Best practices for managing API keys](https://cloud.google.com/docs/authentication/api-keys-best-practices)
- [OpenFGA — Authorization concepts](https://openfga.dev/docs/authorization-concepts)
- [Better Auth — API key plugin](https://www.better-auth.com/docs/plugins/api-key)
