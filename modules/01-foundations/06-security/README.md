---
title: Security Fundamentals
module: 01-foundations
tech: Node.js 26, Express 5, Helmet, express-rate-limit, Dependabot, CodeQL, gitleaks
---
# Security Fundamentals
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Threat modeling basics: assets, trust boundaries, STRIDE
- [ ] ⭐ OWASP Top 10:2025 mapped to a Node and Express stack
- [ ] ⭐ Injection: SQL, NoSQL, and command injection; parameterized queries
- [ ] ⭐ Broken access control: deny by default, object-level checks (IDOR), mass assignment
- [ ] XSS and output encoding; Content Security Policy basics
- [ ] CSRF: `SameSite`, `Origin` checks, and tokens
- [ ] ⭐ Security headers with Helmet
- [ ] ⭐ Rate limiting and brute-force protection with express-rate-limit
- [ ] SSRF, path traversal, and file upload pitfalls
- [ ] ⭐ Secrets: storage, rotation, and scanning with gitleaks
- [ ] ⭐ Supply chain: lockfiles, Dependabot, `pnpm audit`, install scripts
- [ ] Static analysis with CodeQL and security-focused code review
- [ ] Security logging, least privilege, and handling a vulnerability report

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Threat modeling and the OWASP Top 10](docs/01-threat-modeling-and-owasp.md)
- [02 · Injection and broken access control](docs/02-injection-and-access-control.md)
- [03 · XSS, CSRF, and security headers](docs/03-xss-csrf-headers.md)
- [04 · Rate limits, SSRF, paths, and uploads](docs/04-abuse-and-server-side-pitfalls.md)
- [05 · Secrets, supply chain, and response](docs/05-secrets-supply-chain-response.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 01-foundations/06-security mode=tasks` when you are ready to build._
