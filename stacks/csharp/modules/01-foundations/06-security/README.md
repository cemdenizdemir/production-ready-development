---
title: Security Fundamentals
module: 01-foundations
tech: ASP.NET Core 10, rate limiting middleware, NetEscapades.AspNetCore.SecurityHeaders, NuGet Audit, Dependabot, CodeQL, gitleaks
---
# Security Fundamentals
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Threat modeling basics: assets, trust boundaries, STRIDE
- [ ] ⭐ OWASP Top 10:2025 mapped to an ASP.NET Core stack
- [ ] ⭐ Injection: SQL and command injection; parameterized queries; EF Core `FromSql` vs `FromSqlRaw`
- [ ] ⭐ Broken access control: deny by default, object-level checks (IDOR), mass assignment
- [ ] XSS and output encoding; Content Security Policy basics
- [ ] CSRF: `SameSite`, `Origin` checks, and tokens
- [ ] ⭐ Security headers: HSTS, HTTPS redirection, and NetEscapades.AspNetCore.SecurityHeaders
- [ ] ⭐ Rate limiting and brute-force protection with the built-in rate limiting middleware
- [ ] SSRF, path traversal, and file upload pitfalls
- [ ] ⭐ Secrets: storage, rotation, and scanning with gitleaks
- [ ] ⭐ Supply chain: NuGet lock files, NuGet Audit, package source mapping, Dependabot, `pnpm audit`
- [ ] Static analysis with CodeQL and security-focused code review
- [ ] Security logging, least privilege, and handling a vulnerability report
- [ ] ⭐ Safe deserialization: `System.Text.Json` defaults, no `BinaryFormatter`, controlled polymorphic types

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Threat modeling and the OWASP Top 10:2025 for ASP.NET Core](docs/01-threat-modeling-owasp.md)
- [02 · Injection, safe deserialization, SSRF, paths, and uploads](docs/02-injection-deserialization-ssrf.md)
- [03 · Access control, XSS, and CSRF](docs/03-access-control-xss-csrf.md)
- [04 · Security headers and rate limiting](docs/04-headers-rate-limiting.md)
- [05 · Secrets, supply chain, CodeQL, and security operations](docs/05-secrets-supply-chain-ops.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/01-foundations/06-security mode=tasks` when you are ready to build._
