---
title: Security Fundamentals cheatsheet
tech: Node.js 26, Express 5, Helmet, express-rate-limit, Dependabot, CodeQL, gitleaks
version: Node.js 26 LTS, Express 5.2, Helmet 8, express-rate-limit 8, OWASP Top 10:2025
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Security Fundamentals cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Principles
| Principle | What it means |
|:--|:--|
| ⭐ Defense in depth | several independent controls; one failure isn't a breach |
| ⭐ Least privilege | minimum rights for users, services, DB accounts, tokens |
| ⭐ Deny by default | nothing is allowed unless a rule allows it |
| ⭐ Fail closed | errors in security checks deny access |
| Trust boundary | where data crosses from less to more trusted: validate there |
| Minimize attack surface | fewer endpoints, deps, ports, admin features |
| Secure defaults | safe without configuration |
| Zero trust | authenticate and authorize every request, even internal |
| Don't roll your own crypto | vetted libraries only |
| Separation of duties | no single person can deploy and approve alone |

## Threat modeling
| Item | What it is | Note |
|:--|:--|:--|
| ⭐ 4 questions | what are we building, what can go wrong, what will we do, did we do well | Shostack |
| Data flow diagram | actors, processes, stores, trust boundaries | draw first |
| ⭐ STRIDE | spoofing, tampering, repudiation, info disclosure, DoS, elevation | per boundary |
| DREAD / CVSS | risk scoring | CVSS for vulnerabilities |
| Abuse cases | "as an attacker I want to…" | next to user stories |
| Attack tree | goal broken into steps | complex threats |
| OWASP Threat Dragon | free modeling tool | also seen |

## OWASP Top 10:2025
| # | Category | Typical Node/Express cause |
|:--|:--|:--|
| ⭐ A01 | Broken Access Control | IDOR, missing role checks, SSRF |
| A02 | Security Misconfiguration | verbose errors, open CORS, default creds |
| ⭐ A03 | Software Supply Chain Failures | malicious/vulnerable packages, CI compromise |
| A04 | Cryptographic Failures | weak hashing, no TLS, hardcoded keys |
| ⭐ A05 | Injection | SQL/NoSQL/command injection, XSS |
| A06 | Insecure Design | no limits on resets, client-trusted prices |
| A07 | Authentication Failures | credential stuffing, weak sessions |
| A08 | Software or Data Integrity Failures | unverified webhooks, unsafe deserialization |
| A09 | Security Logging and Alerting Failures | no audit trail, no alerts |
| A10 | Mishandling of Exceptional Conditions | fail-open errors, leaked stack traces |
| API Top 10 (2023) | BOLA, broken auth, BOPLA, resource consumption… | owasp.org/API-Security |

## Injection
| Kind | Safe pattern | Note |
|:--|:--|:--|
| ⭐ SQL values | `pool.query('... WHERE id = $1', [id])` | parameters, never concatenation |
| SQL identifiers | allowlist map → column name | `ORDER BY` can't be parameterized |
| ORM raw queries | Drizzle `` sql`... ${value}` `` parameterizes | `sql.raw()` doesn't |
| ⭐ NoSQL operators | validate types; Mongoose `sanitizeFilter: true` | `{ $ne: null }` attacks |
| ⭐ Shell | `execFile(cmd, [args])` / `spawn` | never `exec` with input |
| Template injection | don't compile user input as templates | |
| Log injection | strip newlines; structured JSON logs | forged log lines |
| CSV/formula injection | prefix `= + - @` cells with `'` | spreadsheet exports |
| Header injection | reject CR/LF in header values | Node rejects most |
| ReDoS | avoid nested quantifiers on input | limit input length |
| Prototype pollution | reject `__proto__`/`constructor` keys; `Object.create(null)` | Zod strips unknown keys |

## Access control
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Object-level check (BOLA/IDOR) | caller may access *this* record | scope queries by owner/tenant |
| Function-level check | caller may use *this* action | role/permission middleware |
| ⭐ Property-level (mass assignment) | only allowlisted fields change | `.strict()` schemas |
| 404 instead of 403 | hides existence | cross-tenant lookups |
| RBAC | permissions via roles | simple orgs |
| ABAC / ReBAC | attributes / relationships decide | also seen: Cerbos, OpenFGA |
| Row-level security | Postgres enforces tenant filter | defense in depth |
| Permission matrix tests | role × action × expected result | integration tests |
| Re-auth for sensitive actions | password/MFA again for email change, delete | |

## XSS
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Output encoding | escape for HTML/attribute/URL/JS context | React does text by default |
| ⭐ `textContent` over `innerHTML` | inserts text, not markup | |
| `dangerouslySetInnerHTML` | raw HTML in React | sanitize first |
| ⭐ DOMPurify | sanitizes HTML | on output |
| URL scheme check | allow only `http:`/`https:` | `javascript:` links |
| Stored / reflected / DOM XSS | payload in DB / request / client JS | |
| Trusted Types | browser enforces safe DOM sinks | `require-trusted-types-for 'script'` |
| JSON in HTML | escape `<` as `<` | `<script>` breakouts |
| Separate user-content domain | uploads can't run in your origin | |

## CSRF
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `SameSite=Lax` | no cookies on cross-site POSTs | default; not complete |
| ⭐ Origin / `Sec-Fetch-Site` check | reject cross-site state changes | simple API defense |
| Synchronizer token | per-session token in a header/form | server-rendered apps |
| Double-submit cookie | token in cookie + header must match | also seen: `csrf-csrf` |
| Safe methods only read | GET never changes state | |
| JSON-only bodies | forms can't send JSON cross-site | supporting layer |
| `csurf` | old Express middleware | avoid: deprecated |

## Security headers (Helmet 8)
| Header | Value / purpose | Note |
|:--|:--|:--|
| ⭐ `Content-Security-Policy` | allowed sources for scripts, styles, frames | API: `default-src 'none'` |
| CSP `frame-ancestors` | who may frame you | `'none'` |
| CSP nonces + `'strict-dynamic'` | modern script allowlisting | pages |
| `Content-Security-Policy-Report-Only` | test a policy without enforcing | `report-to` |
| ⭐ `Strict-Transport-Security` | HTTPS only | Helmet: 1 year |
| `X-Content-Type-Options: nosniff` | no MIME sniffing | |
| `X-Frame-Options: SAMEORIGIN` | legacy clickjacking defense | CSP replaces it |
| `Referrer-Policy: no-referrer` | no URL leaks | `strict-origin-when-cross-origin` common |
| `Cross-Origin-Opener-Policy` | isolates windows | `same-origin` |
| `Cross-Origin-Resource-Policy` | who may embed resources | `same-origin` |
| `Cross-Origin-Embedder-Policy` | cross-origin isolation | off by default |
| `Permissions-Policy` | disable camera, geolocation, etc. | not set by Helmet |
| `X-Powered-By` | removed | `app.disable('x-powered-by')` |
| ⭐ `app.use(helmet())` | all defaults | tune CSP per app |

## Rate limiting (express-rate-limit 8)
| Option | What it does | Note |
|:--|:--|:--|
| ⭐ `windowMs` / `limit` | window and max requests | `max` is the old name |
| ⭐ `standardHeaders: 'draft-8'` | `RateLimit` + `RateLimit-Policy` headers | |
| `legacyHeaders: false` | drop `X-RateLimit-*` | |
| ⭐ `store` | shared counter (Redis) | `rate-limit-redis` |
| `skipSuccessfulRequests` | count failures only | login |
| `keyGenerator` | custom key (user ID, API key) | use `ipKeyGenerator()` for IPs |
| `ipv6Subnet` | group IPv6 by subnet | default 56 (v8) |
| `handler` / `message` | custom 429 response | |
| `skip(req)` | exempt requests | health checks |
| `validate` | startup checks (e.g. trust proxy) | read its warnings |
| Token bucket / sliding window | algorithms | bursts vs smoothness |
| Per-account failure counter | brute force across IPs | Redis `INCR` + TTL |

## Server-side pitfalls
| Risk | Control | Note |
|:--|:--|:--|
| ⭐ SSRF | allowlist hosts; block private ranges after DNS | `net.BlockList` |
| Cloud metadata | IMDSv2, hop limit 1 | `169.254.169.254` |
| DNS rebinding | pin resolved IP; egress proxy | |
| Redirect to internal | `redirect: 'manual'` or re-check | |
| ⭐ Path traversal | `resolve(base, x)` must start with `base + sep` | or IDs → keys |
| ⭐ Upload size | proxy + app limits | |
| Upload type | magic bytes, not extension | `file-type` package |
| Upload storage | S3 presigned, random names | separate domain |
| Zip bombs / decompression | limit uncompressed size | |
| XXE | disable external entities in XML parsers | avoid XML when possible |
| Open redirect | allowlist redirect targets | `?next=` params |
| Body size DoS | `express.json({ limit: '100kb' })` | |
| Slowloris | `requestTimeout`, `headersTimeout` | proxies help |

## Crypto basics
| Need | Use | Avoid |
|:--|:--|:--|
| ⭐ Password storage | argon2id (or bcrypt) | SHA-256, MD5 |
| Random tokens | `crypto.randomBytes(32)` / `randomUUID()` | `Math.random()` |
| Compare secrets | `crypto.timingSafeEqual` | `===` on HMACs |
| Message integrity | HMAC-SHA256 | plain hashes |
| Encryption at rest (app level) | AES-256-GCM with a KMS-managed key | ECB, homemade schemes |
| Transport | TLS 1.2+ (1.3 preferred) | TLS 1.0/1.1 |
| Webhook verification | provider signature + timestamp tolerance | trusting payloads |

## Secrets
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `.env` ignored, `.env.example` committed | no secrets in Git | |
| ⭐ Secret manager | AWS Secrets Manager / SSM Parameter Store | inject at runtime |
| ⭐ Rotate on leak | revoke first, clean later | |
| GitHub push protection | blocks known secret patterns on push | |
| Secret scanning alerts | finds secrets in history | |
| ⭐ `gitleaks git` | scan repo history | v8.19+ syntax |
| `gitleaks dir` | scan a folder | |
| `gitleaks git --staged --pre-commit` | pre-commit scan | |
| `.gitleaks.toml` / `.gitleaksignore` | custom rules / allowlist findings | |
| `--redact` | hide secrets in output | CI logs |
| Log redaction | Pino `redact` paths | `authorization`, `cookie` |

## Supply chain
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Lockfile + `--frozen-lockfile` | reproducible installs | |
| ⭐ `onlyBuiltDependencies` | allowlist install scripts | pnpm 10 default blocks others |
| `pnpm approve-builds` | approve packages' build scripts | interactive |
| `minimumReleaseAge` | delay brand-new versions | pnpm 10.16+, minutes |
| ⭐ Dependabot alerts + security updates | vulnerable dependency PRs | |
| Dependabot `cooldown` | wait N days before version PRs | |
| Dependabot `groups` | fewer, grouped PRs | |
| `pnpm audit --audit-level high` | known vulnerabilities | |
| `pnpm why <pkg>` | why it's installed | |
| OpenSSF Scorecard | repo security health score | vet dependencies |
| npm provenance / trusted publishing | verifiable package builds | OIDC from CI |
| SBOM | list of components in a build | `docker buildx --sbom` |
| Socket / Snyk | supply-chain scanners | also seen |

## Static analysis and review
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ CodeQL default setup | code scanning with no workflow | Settings → Code security |
| CodeQL advanced setup | workflow with `security-extended` queries | `github/codeql-action` |
| Copilot Autofix | suggested fixes for alerts | GitHub feature |
| Semgrep | pattern-based SAST | also seen |
| ESLint security rules | `no-floating-promises`, `no-implied-eval` | catches some bugs |
| Secure review checklist | authz, validation, injection, secrets, errors, logging | PR template |
| DAST | scan the running app | OWASP ZAP, also seen |
| Pentest / bug bounty | external testing | before big launches |

## Logging and response
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Security event logs | logins, resets, MFA, 403s, admin actions | actor, target, IP, request ID |
| No secrets/PII in logs | redact | |
| Alerts | failed-login spikes, new admins, 403 spikes | |
| ⭐ `SECURITY.md` | how to report vulnerabilities | |
| Private vulnerability reporting | GitHub repo setting | |
| GitHub security advisory | coordinate fix + CVE | |
| CVSS | severity score 0–10 | plus exploitability |
| Incident steps | contain, eradicate, recover, review | see 04-shipping/06 |
| Non-root containers | limit blast radius | `USER node` |
| Scoped DB users | app can't run DDL | migration user separate |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Authz only in the UI | API still open | server-side checks per object |
| Fetch-then-check ownership | easy to forget | scoped queries |
| In-memory rate limits on many instances | limit × instances | Redis store |
| Wrong `trust proxy` | limits keyed on LB IP or spoofable | hop count |
| Escaping on input | double encoding, missed contexts | encode on output |
| `unsafe-inline` in CSP | XSS protection gone | nonces |
| Cleaning history after a leak | secret already copied | rotate first |
| `Math.random()` tokens | predictable | `crypto.randomBytes` |
| Verbose prod errors | leaks internals | generic message + request ID |
| Ignored alerts backlog | real issues hidden | triage to zero |
| `exec` with user input | command injection | `execFile` with args |

## Sources
| Source | Link |
|:--|:--|
| OWASP Top 10:2025 | https://owasp.org/Top10/2025/ |
| OWASP Cheat Sheet Series | https://cheatsheetseries.owasp.org/ |
| OWASP API Security Top 10 | https://owasp.org/API-Security/ |
| Express security best practices | https://expressjs.com/en/advanced/best-practice-security.html |
| Helmet | https://helmetjs.github.io/ |
| express-rate-limit | https://express-rate-limit.mintlify.app/ |
| gitleaks | https://github.com/gitleaks/gitleaks |
| pnpm supply chain security | https://pnpm.io/supply-chain-security |
| GitHub code security | https://docs.github.com/en/code-security |
